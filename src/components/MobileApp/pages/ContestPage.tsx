import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Film, Trophy, Zap } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ContestClipCard } from "../components/contest/ContestClipCard";
import { SubmitClipModal } from "../components/contest/SubmitClipModal";
import { VoteRefreshCountdown } from "../components/contest/VoteRefreshCountdown";
import type { Contest, ContestClip, VoterStatusResponse } from "../shared/contestSchema";
import type { PaginatedResponse } from "../shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useVoterToken, getStoredSubmitterName } from "../hooks/useVoterToken";
import { config } from "../../game/utils/config";
import Logo from "../../game/images/l3l3.png";

const PAGE_SIZE = 4;

function formatContestDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const parts = error.message.split(":");
    const msg = parts.slice(1).join(":").trim();
    return msg.length > 0 ? msg : error.message;
  }
  return "Something went wrong.";
}

export default function ContestPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const voterToken = useVoterToken();

  const [page, setPage] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [pendingClipId, setPendingClipId] = useState<number | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Fetch active contest — 404 → null (no contest)
  const { data: contest, isLoading: contestLoading } = useQuery<Contest | null>({
    queryKey: ["contest-active"],
    queryFn: async () => {
      const res = await fetch(`${config.API_URL}/api/contest/clip-contest/active`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: Failed to load contest`);
      return res.json() as Promise<Contest>;
    },
  });

  const contestId = contest?.id ?? null;

  // Fetch clips for this page
  const { data: clipsPage, isLoading: clipsLoading } = useQuery<PaginatedResponse<ContestClip>>({
    queryKey: ["contest-clips", contestId, page],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/contest/clip-contest/${contestId}/clips?page=${page}&size=${PAGE_SIZE}`
      ).then((r) => r.json()),
    enabled: !!contestId,
  });

  // Fetch voter status (budget + which clips voted on)
  const { data: voterStatus } = useQuery<VoterStatusResponse>({
    queryKey: ["contest-voter-status", contestId, voterToken],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/contest/clip-contest/${contestId}/voter/${voterToken}`
      ).then((r) => r.json()),
    enabled: !!contestId,
    refetchInterval: 60_000,
  });

  function invalidateContestData() {
    queryClient.invalidateQueries({ queryKey: ["contest-clips", contestId] });
    queryClient.invalidateQueries({ queryKey: ["contest-voter-status", contestId, voterToken] });
  }

  const voteMutation = useMutation({
    mutationFn: (clipId: number) =>
      apiRequest("POST", `/api/contest/clip-contest/clips/${clipId}/vote`, {
        voterToken,
      }),
    onMutate: (clipId) => {
      setPendingClipId(clipId);
      setVoteError(null);
    },
    onSuccess: () => {
      invalidateContestData();
    },
    onError: (err) => {
      setVoteError(getReadableError(err));
    },
    onSettled: () => setPendingClipId(null),
  });

  const unvoteMutation = useMutation({
    mutationFn: (clipId: number) =>
      apiRequest(
        "DELETE",
        `/api/contest/clip-contest/clips/${clipId}/vote?voterToken=${encodeURIComponent(voterToken)}`
      ),
    onMutate: (clipId) => {
      setPendingClipId(clipId);
      setVoteError(null);
    },
    onSuccess: () => {
      invalidateContestData();
    },
    onError: (err) => {
      setVoteError(getReadableError(err));
    },
    onSettled: () => setPendingClipId(null),
  });

  if (contestLoading) return <LoadingScreen />;

  const clips = clipsPage?.content ?? [];
  const totalPages = clipsPage?.totalPages ?? 0;
  const totalClips = clipsPage?.totalElements ?? 0;
  const votesRemaining = voterStatus?.votesRemainingToday ?? 0;
  const votedClipIds = new Set(voterStatus?.votedClipIds ?? []);
  const isVoting = voteMutation.isPending || unvoteMutation.isPending;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background */}
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
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={Logo} alt="L3L3 Logo" className="w-12 h-12 md:w-16 md:h-16" />
            <div className="min-w-0">
              <h1 className="font-pixel text-lg md:text-2xl text-primary truncate drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                CLIP CONTEST
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="container mx-auto px-4 space-y-6 pt-4 md:pt-0">

          {/* No active contest */}
          {contest == null && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-5 mt-20">
              <div className="p-4 rounded-full bg-muted/30 border border-border">
                <Trophy className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <div>
                <h2 className="font-pixel text-xl text-muted-foreground">NO ACTIVE CONTEST</h2>
                <p className="font-retro text-muted-foreground mt-2">
                  Check back soon for the next weekly clip contest!
                </p>
              </div>
              <Button
                variant="outline"
                className="font-retro uppercase tracking-wide"
                onClick={() => setLocation("/contest/hall-of-fame")}
              >
                <Trophy className="w-4 h-4 mr-2" />
                View Hall of Fame
              </Button>
            </div>
          )}

          {/* Active contest */}
          {contest != null && (
            <>
              {/* Contest banner */}
              <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20 mt-20">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-md bg-primary/20 border border-primary/40">
                          <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground">
                          {contest.type === "WEEKLY" ? "Weekly" : "Monthly"} Contest
                        </span>
                      </div>
                      <p className="font-retro text-sm text-muted-foreground">
                        {formatContestDate(contest.startDate)} — {formatContestDate(contest.endDate)}
                      </p>
                    </div>
                    <VoteRefreshCountdown
                      targetDate={contest.endDate}
                      label="ENDS IN"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <Button
                      className="font-retro uppercase tracking-wide"
                      onClick={() => setSubmitOpen(true)}
                    >
                      + Submit a Clip
                    </Button>
                    <Button
                      variant="outline"
                      className="font-retro uppercase tracking-wide"
                      onClick={() => setLocation("/contest/hall-of-fame")}
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Hall of Fame
                    </Button>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              </Card>

              {/* Voter status */}
              {voterStatus && (
                <Card className="relative overflow-hidden border-2 border-accent/40 bg-card/95 backdrop-blur-sm p-4 shadow-lg shadow-accent/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-accent/20 border border-accent/40">
                        <Zap className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <div className="font-pixel text-sm text-accent">
                          {votesRemaining}{" "}
                          {votesRemaining === 1 ? "VOTE" : "VOTES"} REMAINING
                        </div>
                        <div className="font-retro text-xs text-muted-foreground uppercase">
                          {contest.voteRefreshSchedule === "DAILY"
                            ? "Resets at midnight UTC"
                            : `Resets on ${contest.voteRefreshSchedule}`}
                        </div>
                      </div>
                    </div>
                    {votesRemaining === 0 && voterStatus.nextPeriodStart && (
                      <VoteRefreshCountdown
                        targetDate={voterStatus.nextPeriodStart}
                        label="NEXT VOTES IN"
                        colorClass="text-accent"
                      />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
                </Card>
              )}

              {/* Vote error */}
              {voteError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive">
                  {voteError}
                </p>
              )}

              {/* Clips leaderboard */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-pixel text-lg text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    TOP CLIPS
                  </h2>
                  {totalClips > 0 && (
                    <span className="font-retro text-sm text-muted-foreground">
                      {totalClips} submission{totalClips !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {clipsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border-2 border-primary/20 bg-card/50 aspect-[4/3] animate-pulse"
                      />
                    ))}
                  </div>
                ) : clips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <div className="p-4 rounded-full bg-muted/30 border border-border">
                      <Film className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                    <p className="font-pixel text-sm text-muted-foreground">NO CLIPS YET</p>
                    <p className="font-retro text-sm text-muted-foreground">
                      Be the first to submit a clip!
                    </p>
                    <Button
                      className="font-retro uppercase mt-2"
                      onClick={() => setSubmitOpen(true)}
                    >
                      + Submit a Clip
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clips.map((clip, i) => (
                      <ContestClipCard
                        key={clip.id}
                        clip={clip}
                        rank={i + 1 + page * PAGE_SIZE}
                        voterToken={voterToken}
                        hasVoted={votedClipIds.has(clip.id)}
                        votesRemaining={votesRemaining}
                        isVoting={isVoting && pendingClipId === clip.id}
                        contestActive={contest.status === "ACTIVE"}
                        isMyClip={clip.submitterToken === voterToken}
                        onVote={(id) => voteMutation.mutate(id)}
                        onUnvote={(id) => unvoteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-retro"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ← Prev
                    </Button>
                    <span className="font-retro text-sm text-muted-foreground">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-retro"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <footer className="text-center font-retro text-sm text-muted-foreground py-4">
            <p>Submit your favorite moments from this week's streams</p>
            <p className="text-xs mt-1">This is a fan made website and is not associated with the H3 Podcast</p>
          </footer>
        </div>
      </main>

      {/* Submit modal */}
      {contest != null && (
        <SubmitClipModal
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          contest={contest}
          voterToken={voterToken}
          initialSubmitterName={getStoredSubmitterName()}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["contest-clips", contestId] });
            setPage(0);
          }}
        />
      )}
    </div>
  );
}
