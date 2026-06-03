import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Clock } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { CastVote } from "../components/CastVote";
import { VoteResults } from "../components/VoteResults";
import type {
  LivestreamRecord,
  PaginatedResponse,
  TimeStatus,
} from "../shared/schema";
import { formatTimeStatusDelta } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import Logo from "../../game/images/l3l3.png";

interface VotePayload {
  diffSeconds: number;
  userName: string;
}

const PENDING_VOTE_STORAGE_KEY = "vote:submitted:pending";

function buildRandomUserName(): string {
  const randomSequence = Math.floor(100000 + Math.random() * 900000);
  return `FupaTroopa#${randomSequence}`;
}

function parsePositiveInteger(value: string): number {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || Number.isNaN(parsedValue)) return 0;
  return Math.max(0, parsedValue);
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const splitMessage = error.message.split(":");
    const messageWithoutStatus = splitMessage.slice(1).join(":").trim();
    return messageWithoutStatus.length > 0 ? messageWithoutStatus : error.message;
  }
  return "Unable to complete request. Please try again.";
}

type ActiveTab = "cast" | "results";

export default function VotePage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialTab: ActiveTab = new URLSearchParams(search).get("tab") === "results" ? "results" : "cast";
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  const [voteDirection, setVoteDirection] = useState<TimeStatus>("LATE");
  const [voteHours, setVoteHours] = useState("0");
  const [voteMinutes, setVoteMinutes] = useState("0");
  const [voteSeconds, setVoteSeconds] = useState("0");
  const [voteUserName, setVoteUserName] = useState(buildRandomUserName);
  const [voteFormError, setVoteFormError] = useState<string | null>(null);

  const [hasPendingVote, setHasPendingVote] = useState(false);

  const { data: recentLivestreamPage, isLoading: recentLivestreamLoading } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: ['/api/livestream?size=1&sort=createdAt,desc'],
  });

  const mostRecentLivestream = recentLivestreamPage?.content[0] ?? null;
  const isMostRecentScheduled = mostRecentLivestream?.status === "SCHEDULED";
  const canViewVoteResults = mostRecentLivestream?.status === "LIVE" || mostRecentLivestream?.status === "ENDED";

  const voteSuccessMessage = isMostRecentScheduled
    ? "Vote saved for the upcoming livestream."
    : "Vote saved for the next livestream.";

  useEffect(() => {
    try {
      setHasPendingVote(window.localStorage.getItem(PENDING_VOTE_STORAGE_KEY) !== null);
    } catch {
      setHasPendingVote(false);
    }
  }, []);

  // Clear pending vote only when a stream that started AFTER the vote submission goes LIVE/ENDED.
  // Without the timestamp check, any already-ENDED stream would clear the flag on every mount.
  useEffect(() => {
    if (!canViewVoteResults || !mostRecentLivestream) return;

    try {
      const submittedAt = Number(window.localStorage.getItem(PENDING_VOTE_STORAGE_KEY));
      if (!submittedAt) return;

      const streamStartedAt = mostRecentLivestream.actualStart
        ? new Date(mostRecentLivestream.actualStart).getTime()
        : new Date(mostRecentLivestream.createdAt).getTime();

      if (streamStartedAt > submittedAt) {
        window.localStorage.removeItem(PENDING_VOTE_STORAGE_KEY);
        setHasPendingVote(false);
      }
    } catch {
      // ignore
    }
  }, [canViewVoteResults, mostRecentLivestream]);

  const voteMutation = useMutation({
    mutationFn: async (payload: VotePayload) => {
      await apiRequest("POST", "/api/vote", payload);
    },
    onSuccess: () => {
      try {
        window.localStorage.setItem(PENDING_VOTE_STORAGE_KEY, Date.now().toString());
      } catch {
        // ignore
      }
      setHasPendingVote(true);
      setVoteFormError(null);
    },
    onError: (error) => {
      setVoteFormError(getReadableErrorMessage(error));
    },
  });

  const handleSubmitVote = () => {
    if (hasPendingVote) {
      setVoteFormError("You already have a vote saved for the next livestream.");
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
    if (voteDirection === "EARLY") diffSeconds = -totalSeconds;
    if (voteDirection === "LATE") diffSeconds = totalSeconds;

    setVoteFormError(null);
    voteMutation.mutate({ diffSeconds, userName: normalizedUserName });
  };

  if (recentLivestreamLoading) {
    return <LoadingScreen />;
  }

  const hasMostRecentLivestream = mostRecentLivestream !== null;

  const mostRecentValue = !hasMostRecentLivestream
    ? "NO STREAM DATA"
    : mostRecentLivestream.status === "SCHEDULED"
      ? "SCHEDULED"
      : mostRecentLivestream.timeStatus === "ON_TIME"
        ? "ON TIME!"
        : formatTimeStatusDelta(mostRecentLivestream.diffSeconds, mostRecentLivestream.timeStatus);

  const mostRecentTitle = mostRecentLivestream?.title ?? "No livestream has been tracked yet.";

  const mostRecentStatusText = !hasMostRecentLivestream
    ? "Voting Open"
    : mostRecentLivestream.status === "SCHEDULED"
      ? "SCHEDULED • Voting Open"
      : `${mostRecentLivestream.timeStatus} • ${mostRecentLivestream.status}`;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background patterns */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.15] pointer-events-none z-0" />

      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
        <div className="w-full h-1 bg-foreground/50 animate-scanline" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 border-b-2 border-primary/40 bg-card/90 backdrop-blur-md shadow-lg shadow-primary/10 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <img src={Logo} alt="L3L3 Logo" className="w-12 h-12 md:w-16 md:h-16" />

            <div className="min-w-0">
              <h1 className="font-pixel text-lg md:text-2xl text-primary truncate drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" data-testid="heading-vote-page">
                VOTE
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="container mx-auto px-4 space-y-6 pt-4 md:pt-0">
          {/* Stream Info Card */}
          <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20 mt-20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
                  <Clock className="w-6 h-6 text-primary" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-retro text-lg uppercase tracking-wide text-muted-foreground">Most Recent Stream</h2>
                  <div className="font-pixel text-xl md:text-2xl text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    {mostRecentValue}
                  </div>
                  <div className="font-retro text-base text-foreground/90 line-clamp-2">
                    {mostRecentTitle}
                  </div>
                  <div className="font-retro text-sm text-muted-foreground">
                    {mostRecentStatusText}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={activeTab === "cast" ? "default" : "outline"}
              onClick={() => setActiveTab("cast")}
              className="font-retro uppercase tracking-wide"
              data-testid="tab-cast-vote"
            >
              Cast Vote
            </Button>
            <Button
              variant={activeTab === "results" ? "default" : "outline"}
              onClick={() => setActiveTab("results")}
              className="font-retro uppercase tracking-wide"
              data-testid="tab-vote-results"
            >
              Previous Results
            </Button>
          </div>

          {/* Tab Content */}
          {activeTab === "cast" && (
            <CastVote
              hasPendingVote={hasPendingVote}
              voteSuccessMessage={voteSuccessMessage}
              isPending={voteMutation.isPending}
              voteFormError={voteFormError}
              voteUserName={voteUserName}
              voteDirection={voteDirection}
              voteHours={voteHours}
              voteMinutes={voteMinutes}
              voteSeconds={voteSeconds}
              onUserNameChange={setVoteUserName}
              onDirectionChange={setVoteDirection}
              onHoursChange={setVoteHours}
              onMinutesChange={setVoteMinutes}
              onSecondsChange={setVoteSeconds}
              onSubmit={handleSubmitVote}
            />
          )}

          {activeTab === "results" && <VoteResults />}
        </div>
      </main>
    </div>
  );
}
