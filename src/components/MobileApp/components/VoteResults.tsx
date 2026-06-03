import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { TbCrown } from "react-icons/tb";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { LeaderboardEntry, PaginatedResponse } from "../shared/schema";
import { formatLateTime } from "../lib/utils";

type SortField = "userGuess" | "proximityScore";
type SortDirection = "asc" | "desc";

function formatVoteGuess(diffSeconds: number, rawScore = false): string {
  if (diffSeconds === 0) return "ON TIME";
  if (diffSeconds < 0) return `${formatLateTime(Math.abs(diffSeconds))} early`;
  return rawScore === false ? `${formatLateTime(diffSeconds)} late` : `${formatLateTime(diffSeconds)}`;
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const splitMessage = error.message.split(":");
    const messageWithoutStatus = splitMessage.slice(1).join(":").trim();
    return messageWithoutStatus.length > 0 ? messageWithoutStatus : error.message;
  }
  return "Unable to complete request. Please try again.";
}

function buildLeaderboardEntryKey(entry: LeaderboardEntry): string {
  return `${entry.userName}::${entry.userGuess}::${entry.proximityScore}`;
}

function getCrownClassName(rank: number): string {
  if (rank === 1) return "text-amber-400";
  if (rank === 2) return "text-slate-300";
  return "text-orange-500";
}

export function VoteResults() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>("proximityScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const { data: topThreeLeaderboardPage } = useQuery<PaginatedResponse<LeaderboardEntry>>({
    queryKey: ["/api/vote/leaderboard/latest?page=0&size=3&sort=proximityScore,asc"],
    staleTime: 30000,
  });

  const leaderboardErrorMessage = leaderboardError ? getReadableErrorMessage(leaderboardError) : null;
  const leaderboardEntries = leaderboardPage?.content ?? [];
  const topThreeEntries = topThreeLeaderboardPage?.content ?? [];

  const topThreeRankMap = useMemo(() => {
    const rankMap = new Map<string, number>();
    topThreeEntries.forEach((entry, index) => {
      rankMap.set(buildLeaderboardEntryKey(entry), index + 1);
    });
    return rankMap;
  }, [topThreeEntries]);

  const firstPlaceWinner = topThreeEntries[0]?.userName;
  const firstPlaceGuess = topThreeEntries[0]?.userGuess;
  const latestActualResult = leaderboardEntries[0]?.actualResult;

  const rows = leaderboardEntries;
  const currentPage = (leaderboardPage?.number ?? page) + 1;
  const totalPages = Math.max(leaderboardPage?.totalPages ?? 1, 1);
  const totalElements = leaderboardPage?.totalElements ?? 0;

  return (
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
            {firstPlaceWinner && (
              <p className="font-retro text-md text-foreground mt-2 animate-bounce" data-testid="text-winner-announcement">
                Closest guess '{
                  <span className="text-primary-400">{formatVoteGuess(firstPlaceGuess ?? 0)}</span>
                }' by
                <span className="text-amber-400">
                  {" " + firstPlaceWinner}
                </span>
              </p>
            )}
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
                No vote results yet — check back after the next stream!
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
                  {rows.map((entry, index) => {
                    const entryKey = buildLeaderboardEntryKey(entry);
                    const topRank = topThreeRankMap.get(entryKey);

                    return (
                      <tr key={`${entry.userName}-${index}`} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/70">{page * pageSize + index + 1}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 break-all">
                          <span className="inline-flex items-center gap-2">
                            <span>{entry.userName}</span>
                            {topRank && (
                              <TbCrown
                                className={`w-4 h-4 ${getCrownClassName(topRank)}`}
                                aria-label={`Top ${topRank} ranking`}
                              />
                            )}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 whitespace-nowrap">{formatVoteGuess(entry.userGuess)}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-retro text-xs sm:text-sm text-foreground/90 whitespace-nowrap">{formatVoteGuess(entry.proximityScore, true)}</td>
                      </tr>
                    );
                  })}
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
  );
}
