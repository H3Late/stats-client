import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type {
  DayStatsResponse,
  LeaderboardEntry,
  LivestreamRecord,
  LivestreamStatsResponse,
  PaginatedResponse,
  TimeStatus,
  TrendLivestream,
} from "../shared/schema";
import { StatCard } from "../components/StatCard";
import { TotalStatsCard } from "../components/TotalStatsCard";
import { LatenessTrendChart } from "../components/LatenessTrendChart";
import { DayOfWeekChart } from "../components/DayOfWeekChart";
import { LoadingScreen } from "../components/LoadingScreen";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Clock, TrendingUp } from "lucide-react";
import { formatDurationVerbose, formatLateTime, formatTimeStatusDelta } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import Logo from "../../game/images/l3l3.png";

interface VotePayload {
  videoId: string;
  diffSeconds: number;
  userName: string;
}

function buildRandomUserName(): string {
  const randomSequence = Math.floor(100000 + Math.random() * 900000);
  return `FupaTroopa#${randomSequence}`;
}

function getVoteStorageKey(videoId: string): string {
  return `vote:submitted:${videoId}`;
}

function parsePositiveInteger(value: string): number {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || Number.isNaN(parsedValue)) {
    return 0;
  }

  return Math.max(0, parsedValue);
}

function formatVoteGuess(diffSeconds: number): string {
  if (diffSeconds === 0) {
    return "ON TIME";
  }

  if (diffSeconds < 0) {
    return `${formatLateTime(Math.abs(diffSeconds))} early`;
  }

  return `${formatLateTime(diffSeconds)} late`;
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const splitMessage = error.message.split(":");
    const messageWithoutStatus = splitMessage.slice(1).join(":").trim();

    return messageWithoutStatus.length > 0 ? messageWithoutStatus : error.message;
  }

  return "Unable to complete request. Please try again.";
}

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const [isVoteDialogOpen, setIsVoteDialogOpen] = useState(false);
  const [isVoteResultsDialogOpen, setIsVoteResultsDialogOpen] = useState(false);
  const [hasVotedForLatest, setHasVotedForLatest] = useState(false);
  const [voteDirection, setVoteDirection] = useState<TimeStatus>("LATE");
  const [voteHours, setVoteHours] = useState("0");
  const [voteMinutes, setVoteMinutes] = useState("0");
  const [voteSeconds, setVoteSeconds] = useState("0");
  const [voteUserName, setVoteUserName] = useState(buildRandomUserName);
  const [voteFormError, setVoteFormError] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<LivestreamStatsResponse>({
    queryKey: ['/api/livestream/stats'],
  });

  const { data: dailyStats, isLoading: dailyStatsLoading } = useQuery<DayStatsResponse[]>({
    queryKey: ['/api/livestream/stats/day'],
  });

  const { data: recentLivestreamPage, isLoading: recentLivestreamLoading } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: ['/api/livestream?size=1&sort=createdAt,desc'],
  });

  const { data: trendLivestreamPage, isLoading: trendLivestreamLoading } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: ['/api/livestream?size=10&timeStatus=LATE&sort=actualStart,desc'],
  });

  const mostRecentLivestream = recentLivestreamPage?.content[0] ?? null;
  const latestVideoId = mostRecentLivestream?.videoId ?? null;
  const isMostRecentScheduled = mostRecentLivestream?.status === "SCHEDULED";
  const canViewVoteResults =
    mostRecentLivestream?.status === "LIVE" || mostRecentLivestream?.status === "ENDED";

  useEffect(() => {
    if (!latestVideoId) {
      setHasVotedForLatest(false);
      return;
    }

    try {
      const hasStoredVote = window.localStorage.getItem(getVoteStorageKey(latestVideoId)) === "true";
      setHasVotedForLatest(hasStoredVote);
    } catch {
      setHasVotedForLatest(false);
    }
  }, [latestVideoId]);

  const voteMutation = useMutation({
    mutationFn: async (payload: VotePayload) => {
      await apiRequest("POST", `/api/vote/${payload.videoId}`, payload);
    },
    onSuccess: (_response, payload) => {
      try {
        window.localStorage.setItem(getVoteStorageKey(payload.videoId), "true");
      } catch {
        // Ignore localStorage failures and still honor in-memory state.
      }

      setHasVotedForLatest(true);
      setVoteFormError(null);
      setIsVoteDialogOpen(false);
    },
    onError: (error) => {
      setVoteFormError(getReadableErrorMessage(error));
    },
  });

  const {
    data: leaderboardEntries,
    isPending: leaderboardPending,
    error: leaderboardError,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/vote/leaderboard/latest"],
    enabled: isVoteResultsDialogOpen && canViewVoteResults,
    staleTime: 0,
  });

  const leaderboardErrorMessage = leaderboardError ? getReadableErrorMessage(leaderboardError) : null;
  const latestActualResult = leaderboardEntries?.[0]?.actualResult;

  const openVoteDialog = () => {
    setVoteDirection("LATE");
    setVoteHours("0");
    setVoteMinutes("0");
    setVoteSeconds("0");
    setVoteUserName(buildRandomUserName());
    setVoteFormError(null);
    voteMutation.reset();
    setIsVoteDialogOpen(true);
  };

  const handleSubmitVote = () => {
    if (!latestVideoId) {
      setVoteFormError("No scheduled stream is available for voting.");
      return;
    }

    if (hasVotedForLatest) {
      setVoteFormError("You already voted for this stream.");
      return;
    }

    const normalizedUserName = voteUserName.trim();

    if (!normalizedUserName) {
      setVoteFormError("Please enter a username before submitting your vote.");
      return;
    }

    const hoursValue = parsePositiveInteger(voteHours);
    const minutesValue = parsePositiveInteger(voteMinutes);
    const secondsValue = parsePositiveInteger(voteSeconds);
    const totalSeconds = (hoursValue * 3600) + (minutesValue * 60) + secondsValue;

    let diffSeconds = 0;

    if (voteDirection === "EARLY") {
      diffSeconds = -totalSeconds;
    }

    if (voteDirection === "LATE") {
      diffSeconds = totalSeconds;
    }

    setVoteFormError(null);
    voteMutation.mutate({
      videoId: latestVideoId,
      diffSeconds,
      userName: normalizedUserName,
    });
  };

  const handleMostRecentActionClick = () => {
    if (isMostRecentScheduled) {
      if (!hasVotedForLatest) {
        openVoteDialog();
      }
      return;
    }

    if (canViewVoteResults) {
      setIsVoteResultsDialogOpen(true);
    }
  };

  if (
    statsLoading ||
    dailyStatsLoading ||
    recentLivestreamLoading ||
    trendLivestreamLoading ||
    !stats ||
    !dailyStats ||
    !recentLivestreamPage ||
    !trendLivestreamPage
  ) {
    return <LoadingScreen />;
  }

  const trendLivestreams: TrendLivestream[] = trendLivestreamPage.content.map((stream) => ({
    videoId: stream.videoId,
    title: stream.title,
    actualStartTime: stream.actualStart ?? stream.createdAt,
    scheduledStartTime: stream.scheduledStart,
    lateTime: Math.max(0, stream.diffSeconds),
  }));

  const averageLateSeconds = stats.avg_lateness_seconds;
  const recordLateSeconds = stats.record_lateness_seconds;
  const totalLateTimeHumanReadable = formatDurationVerbose(stats.total_late_time_seconds);

  const mostLateTitle =
    stats.record_video_title ?? (stats.record_video_id ? `Video ID: ${stats.record_video_id}` : "No record data");

  const mostRecentValue = mostRecentLivestream
    ? mostRecentLivestream.status === "SCHEDULED"
      ? "SCHEDULED"
      : mostRecentLivestream.timeStatus === "ON_TIME"
        ? "ON TIME!"
        : formatTimeStatusDelta(mostRecentLivestream.diffSeconds, mostRecentLivestream.timeStatus)
    : "No data";

  const mostRecentDetail = mostRecentLivestream
    ? mostRecentLivestream.status === "SCHEDULED"
      ? "SCHEDULED • Voting Open"
      : `${mostRecentLivestream.timeStatus} • ${mostRecentLivestream.status}`
    : undefined;

  const mostRecentActionLabel = isMostRecentScheduled
    ? hasVotedForLatest
      ? "✓ Already voted"
      : "Vote how late"
    : canViewVoteResults
      ? "View vote results"
      : undefined;

  const mostRecentActionDisabled = isMostRecentScheduled ? hasVotedForLatest : false;

  const lastUpdatedDate = mostRecentLivestream?.createdAt
    ? new Date(mostRecentLivestream.createdAt).toLocaleDateString()
    : "—";

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background patterns */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.15] pointer-events-none z-0" />
      
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
        <div className="w-full h-1 bg-foreground/50 animate-scanline" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 border-b-2 border-primary/40 bg-card/90 backdrop-blur-md shadow-lg shadow-primary/10 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <img src={Logo} alt="L3L3 Logo" className="w-16 h-16" />
            <div>
              <h1 className="font-pixel text-xl md:text-1xl text-primary drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" data-testid="heading-main">
                H3 POD
              </h1>
              <p className="font-retro text-sm md:text-base text-muted-foreground sm:block">
                LATE TRACKER
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block font-retro text-sm text-muted-foreground" data-testid="text-last-updated">
              Last Updated: {lastUpdatedDate}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content with proper top padding to account for fixed header */}
      <main className="relative z-10 pt-20 pb-6">
        <div className="container mx-auto px-4 py-20 md:py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <StatCard
              icon={Clock}
              label="Most Recent"
              value={mostRecentValue}
              subtitle={mostRecentLivestream?.title ?? "No recent stream found"}
              detail={mostRecentDetail}
              videoId={mostRecentLivestream?.videoId}
              actionLabel={mostRecentActionLabel}
              actionDisabled={mostRecentActionDisabled}
              onActionClick={mostRecentActionLabel ? handleMostRecentActionClick : undefined}
              actionTestId="button-most-recent-action"
            />
            
            <StatCard
              icon={TrendingUp}
              label="Most Late"
              value={formatLateTime(recordLateSeconds)}
              subtitle={mostLateTitle}
              videoId={stats.record_video_id}
            />
          </div>

          <TotalStatsCard
            humanReadable={totalLateTimeHumanReadable}
            averageLateTime={averageLateSeconds}
            streamCount={stats.total_streams}
          />

          <div className="space-y-6">
            <LatenessTrendChart livestreams={trendLivestreams} />
            <DayOfWeekChart dailyStats={dailyStats} />
          </div>

          <div className="flex justify-center">
            <Button
              variant="secondary"
              className="font-retro uppercase tracking-wide"
              onClick={() => setLocation('/data')}
              data-testid="button-view-full-dataset"
            >
              View Full Dataset
            </Button>
          </div>

          <footer className="text-center font-retro text-sm md:text-base text-muted-foreground py-4">
            <p>Tracking H3 Podcast YouTube Live Stream Lateness</p>
            <p style={{ marginTop: 10}}>This is a fan made website and is not associated with the H3 Podcast</p>
            <p style={{ fontSize: 12 }}>  (with ✌️ & ❤️) </p>

            <p className="text-xs mt-1 md:hidden" data-testid="text-last-updated-mobile">
              Last Updated: {lastUpdatedDate}
            </p>
          </footer>
        </div>
      </main>

      <Dialog
        open={isVoteDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsVoteDialogOpen(nextOpen);

          if (!nextOpen) {
            setVoteFormError(null);
            voteMutation.reset();
          }
        }}
      >
        <DialogContent className="border-2 border-primary/40 bg-card/95 backdrop-blur-sm shadow-lg shadow-primary/20 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-pixel text-xl text-primary">VOTE HOW LATE</DialogTitle>
            <DialogDescription className="font-retro text-muted-foreground">
              Submit your prediction for the most recent scheduled stream.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vote-username" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                Username
              </Label>
              <Input
                id="vote-username"
                value={voteUserName}
                onChange={(event) => setVoteUserName(event.target.value)}
                className="font-retro"
                placeholder="FupaTroopa#123456"
                data-testid="input-vote-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vote-direction" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                Prediction Type
              </Label>
              <select
                id="vote-direction"
                value={voteDirection}
                onChange={(event) => setVoteDirection(event.target.value as TimeStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                data-testid="select-vote-direction"
              >
                <option value="LATE">LATE</option>
                <option value="EARLY">EARLY</option>
                <option value="ON_TIME">ON_TIME</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vote-hours" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Hours
                </Label>
                <Input
                  id="vote-hours"
                  type="number"
                  min={0}
                  step={1}
                  value={voteHours}
                  onChange={(event) => setVoteHours(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-hours"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vote-minutes" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Minutes
                </Label>
                <Input
                  id="vote-minutes"
                  type="number"
                  min={0}
                  step={1}
                  value={voteMinutes}
                  onChange={(event) => setVoteMinutes(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-minutes"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vote-seconds" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Seconds
                </Label>
                <Input
                  id="vote-seconds"
                  type="number"
                  min={0}
                  step={1}
                  value={voteSeconds}
                  onChange={(event) => setVoteSeconds(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-seconds"
                />
              </div>
            </div>

            {voteFormError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive" data-testid="text-vote-error">
                {voteFormError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsVoteDialogOpen(false)}
              className="font-retro uppercase tracking-wide"
              data-testid="button-cancel-vote"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitVote}
              disabled={voteMutation.isPending || hasVotedForLatest}
              className="font-retro uppercase tracking-wide"
              data-testid="button-submit-vote"
            >
              {voteMutation.isPending ? "Submitting..." : "Submit Vote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isVoteResultsDialogOpen} onOpenChange={setIsVoteResultsDialogOpen}>
        <DialogContent className="border-2 border-secondary/40 bg-card/95 backdrop-blur-sm shadow-lg shadow-secondary/20 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-pixel text-xl text-secondary">VOTE RESULTS</DialogTitle>
            <DialogDescription className="font-retro text-muted-foreground">
              Leaderboard for the latest stream vote predictions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {latestActualResult !== undefined && (
              <div className="font-retro text-sm text-muted-foreground" data-testid="text-vote-actual-result">
                Actual Result: {formatVoteGuess(latestActualResult)}
              </div>
            )}

            {leaderboardPending && (
              <div className="font-retro text-sm text-muted-foreground" data-testid="text-vote-results-loading">
                Loading vote results...
              </div>
            )}

            {!leaderboardPending && leaderboardErrorMessage && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive" data-testid="text-vote-results-error">
                {leaderboardErrorMessage}
              </div>
            )}

            {!leaderboardPending && !leaderboardErrorMessage && (leaderboardEntries?.length ?? 0) === 0 && (
              <div className="font-retro text-sm text-muted-foreground" data-testid="text-vote-results-empty">
                No votes have been submitted yet.
              </div>
            )}

            {!leaderboardPending && !leaderboardErrorMessage && (leaderboardEntries?.length ?? 0) > 0 && (
              <div className="overflow-x-auto rounded-md border border-border/50">
                <table className="w-full min-w-[640px] border-collapse" data-testid="table-vote-results">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/20">
                      <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Username</th>
                      <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Guess</th>
                      <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Actual</th>
                      <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Off By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardEntries?.map((entry, entryIndex) => (
                      <tr key={`${entry.userName}-${entryIndex}`} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-retro text-sm text-foreground/90">{entry.userName}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/90">{formatVoteGuess(entry.userGuess)}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/90">{formatVoteGuess(entry.actualResult)}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/90">{formatVoteGuess(entry.proximityScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
