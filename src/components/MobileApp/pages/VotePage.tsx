import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, Clock, Vote } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import type {
  LeaderboardEntry,
  LivestreamRecord,
  PaginatedResponse,
  TimeStatus,
} from "../shared/schema";
import { formatTimeStatusDelta } from "../lib/utils";
import { apiRequest } from "../lib/queryClient";
import Logo from "../../game/images/l3l3.png";

interface VotePayload {
  videoId: string;
  diffSeconds: number;
  userName: string;
}

type SortField = "userGuess" | "proximityScore";
type SortDirection = "asc" | "desc";

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
  const formatLateTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round((seconds % 60) * 10) / 10;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  };

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

export default function VotePage() {
  const [, setLocation] = useLocation();

  // Voting form state
  const [voteDirection, setVoteDirection] = useState<TimeStatus>("LATE");
  const [voteHours, setVoteHours] = useState("0");
  const [voteMinutes, setVoteMinutes] = useState("0");
  const [voteSeconds, setVoteSeconds] = useState("0");
  const [voteUserName, setVoteUserName] = useState(buildRandomUserName);
  const [voteFormError, setVoteFormError] = useState<string | null>(null);
  const [hasVotedForLatest, setHasVotedForLatest] = useState(false);

  // Results table state  
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>("proximityScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0); // Reset to first page when search changes
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: recentLivestreamPage, isLoading: recentLivestreamLoading } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: ['/api/livestream?size=1&sort=createdAt,desc'],
  });

  const mostRecentLivestream = recentLivestreamPage?.content[0] ?? null;
  const latestVideoId = mostRecentLivestream?.videoId ?? null;
  const isMostRecentScheduled = mostRecentLivestream?.status === "SCHEDULED";
  const canViewVoteResults = mostRecentLivestream?.status === "LIVE" || mostRecentLivestream?.status === "ENDED";

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
    },
    onError: (error) => {
      setVoteFormError(getReadableErrorMessage(error));
    },
  });

  const leaderboardQueryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(pageSize));
    params.set("sort", `${sortField},${sortDirection}`);

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    return `/api/vote/leaderboard/latest?${params.toString()}`;
  }, [page, pageSize, sortField, sortDirection, debouncedSearch]);

  const {
    data: leaderboardPage,
    isPending: leaderboardPending,
    isFetching: leaderboardFetching,
    error: leaderboardError,
  } = useQuery<PaginatedResponse<LeaderboardEntry>>({
    queryKey: [leaderboardQueryPath],
    enabled: canViewVoteResults,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const leaderboardErrorMessage = leaderboardError ? getReadableErrorMessage(leaderboardError) : null;
  const leaderboardEntries = leaderboardPage?.content ?? [];
  const latestActualResult = leaderboardEntries[0]?.actualResult;

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

  if (recentLivestreamLoading || !mostRecentLivestream) {
    return <LoadingScreen />;
  }

  const mostRecentValue = mostRecentLivestream.status === "SCHEDULED"
    ? "SCHEDULED"
    : mostRecentLivestream.timeStatus === "ON_TIME"
      ? "ON TIME!"
      : formatTimeStatusDelta(mostRecentLivestream.diffSeconds, mostRecentLivestream.timeStatus);

  const rows = leaderboardEntries;
  const currentPage = (leaderboardPage?.number ?? page) + 1;
  const totalPages = Math.max(leaderboardPage?.totalPages ?? 1, 1);
  const totalElements = leaderboardPage?.totalElements ?? 0;

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
                {isMostRecentScheduled ? "VOTE" : "VOTE RESULTS"}
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main content with proper top/bottom padding to account for fixed header and mobile browser chrome */}
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
                    {mostRecentLivestream.title}
                  </div>
                  <div className="font-retro text-sm text-muted-foreground">
                    {mostRecentLivestream.status === "SCHEDULED" 
                      ? "SCHEDULED • Voting Open" 
                      : `${mostRecentLivestream.timeStatus} • ${mostRecentLivestream.status}`}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Voting Form (if SCHEDULED) */}
          {isMostRecentScheduled && (
            <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
                    <Vote className="w-6 h-6 text-primary" strokeWidth={2.5} />
                  </div>
                  <h2 className="font-pixel text-xl text-primary">
                    {hasVotedForLatest ? "VOTE SUBMITTED" : "SUBMIT YOUR PREDICTION"}
                  </h2>
                </div>

                {hasVotedForLatest ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-retro">Check back here once the pod goes live to see the results!</span>
                  </div>
                ) : (
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

                    <Button
                      onClick={handleSubmitVote}
                      disabled={voteMutation.isPending}
                      className="w-full font-retro uppercase tracking-wide"
                      data-testid="button-submit-vote"
                    >
                      {voteMutation.isPending ? "Submitting..." : "Submit Vote"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Vote Results (if not SCHEDULED) */}
          {canViewVoteResults && (
            <>
              {/* Filters Card */}
              <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-secondary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />

                <div className="relative z-10 space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Search by Username</span>
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Type to search usernames..."
                      className="font-retro"
                      data-testid="input-search-username"
                    />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Sort By</span>
                      <select
                        value={sortField}
                        onChange={(event) => {
                          setSortField(event.target.value as SortField);
                          setPage(0);
                        }}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                        data-testid="select-sort-field"
                      >
                        <option value="proximityScore">Off By (Proximity)</option>
                        <option value="userGuess">Guess Value</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Direction</span>
                      <select
                        value={sortDirection}
                        onChange={(event) => {
                          setSortDirection(event.target.value as SortDirection);
                          setPage(0);
                        }}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                        data-testid="select-sort-direction"
                      >
                        <option value="asc">ASC</option>
                        <option value="desc">DESC</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Page Size</span>
                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(0);
                        }}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                        data-testid="select-page-size"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                </div>
              </Card>

              {/* Results Table */}
              <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-0 shadow-lg shadow-secondary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />

                <div className="relative z-10">
                  <div className="p-4 md:p-6 border-b border-border/40">
                    <h2 className="font-pixel text-xl text-secondary drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
                      VOTE LEADERBOARD
                    </h2>
                    {latestActualResult !== undefined && (
                      <p className="font-retro text-sm text-muted-foreground mt-2">
                        Actual Result: {formatVoteGuess(latestActualResult)}
                      </p>
                    )}
                  </div>

                  {leaderboardFetching && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/70 backdrop-blur-[1px]">
                      <div className="font-retro text-sm text-muted-foreground animate-pulse" data-testid="table-loading-overlay">
                        Loading vote results...
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    {leaderboardPending && !leaderboardPage ? (
                      <div className="p-8 text-center font-retro text-sm text-muted-foreground">
                        Loading vote results...
                      </div>
                    ) : leaderboardErrorMessage ? (
                      <div className="p-8 text-center">
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive">
                          {leaderboardErrorMessage}
                        </div>
                      </div>
                    ) : rows.length === 0 ? (
                      <div className="p-8 text-center font-retro text-sm text-muted-foreground">
                        No vote results found.
                      </div>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/20">
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-retro text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">#</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-retro text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Username</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-retro text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Guess</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left font-retro text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Off By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((entry, index) => (
                            <tr key={`${entry.userName}-${index}`} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                              <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/70">{page * pageSize + index + 1}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 break-all">{entry.userName}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 whitespace-nowrap">{formatVoteGuess(entry.userGuess)}</td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 whitespace-nowrap">{formatVoteGuess(entry.proximityScore)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </Card>

              {/* Pagination */}
              {rows.length > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                  <p className="font-retro text-sm text-muted-foreground" data-testid="text-table-summary">
                    Showing {rows.length} of {totalElements} votes
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                      disabled={page <= 0 || !!leaderboardPage?.first}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>

                    <span className="font-retro text-sm text-foreground/90" data-testid="text-page-indicator">
                      Page {currentPage} of {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      onClick={() => setPage((prev) => prev + 1)}
                      disabled={!leaderboardPage || leaderboardPage.last}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
