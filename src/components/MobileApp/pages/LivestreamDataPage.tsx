import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Tv } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { ThemeToggle } from "../components/ThemeToggle";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import type {
  LivestreamRecord,
  LivestreamStatus,
  PaginatedResponse,
  TimeStatus,
} from "../shared/schema";
import { formatTimeStatusDelta } from "../lib/utils";

type StatusFilter = "ALL" | LivestreamStatus;
type TimeStatusFilter = "ALL" | TimeStatus;
type SortField = "actualStart" | "scheduledStart" | "diffSeconds" | "title" | "duration";
type SortDirection = "asc" | "desc";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }

  const absSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const remainingSeconds = absSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function statusBadgeClass(status: LivestreamStatus): string {
  switch (status) {
    case "LIVE":
      return "border-green-500/50 bg-green-500/15 text-green-300";
    case "SCHEDULED":
      return "border-cyan-500/50 bg-cyan-500/15 text-cyan-300";
    case "CANCELLED":
      return "border-red-500/50 bg-red-500/15 text-red-300";
    case "ENDED":
    default:
      return "border-primary/50 bg-primary/15 text-primary";
  }
}

function timeStatusBadgeClass(timeStatus: TimeStatus): string {
  switch (timeStatus) {
    case "EARLY":
      return "border-blue-500/50 bg-blue-500/15 text-blue-300";
    case "ON_TIME":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
    case "LATE":
    default:
      return "border-secondary/50 bg-secondary/15 text-secondary";
  }
}

export default function LivestreamDataPage() {
  const [, setLocation] = useLocation();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [timeStatusFilter, setTimeStatusFilter] = useState<TimeStatusFilter>("ALL");
  const [sortField, setSortField] = useState<SortField>("actualStart");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(pageSize));
    params.set("sort", `${sortField},${sortDirection}`);

    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }

    if (timeStatusFilter !== "ALL") {
      params.set("timeStatus", timeStatusFilter);
    }

    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    return `/api/livestream?${params.toString()}`;
  }, [page, pageSize, sortField, sortDirection, statusFilter, timeStatusFilter, debouncedSearch]);

  const { data, isPending, isFetching } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: [queryPath],
    placeholderData: keepPreviousData,
  });

  if (isPending && !data) {
    return <LoadingScreen />;
  }

  const rows = data?.content ?? [];
  const currentPage = (data?.number ?? page) + 1;
  const totalPages = Math.max(data?.totalPages ?? 1, 1);
  const totalElements = data?.totalElements ?? 0;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.15] pointer-events-none z-0" />

      <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0">
        <div className="w-full h-1 bg-foreground/50 animate-scanline" />
      </div>

      <header className="fixed top-0 left-0 right-0 border-b-2 border-primary/40 bg-card/90 backdrop-blur-md shadow-lg shadow-primary/10 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="p-2 rounded-md bg-primary/20 border-2 border-primary/40">
              <Tv className="w-6 h-6 md:w-8 md:h-8 text-primary" strokeWidth={2.5} />
            </div>

            <div className="min-w-0">
              <h1 className="font-pixel text-lg md:text-2xl text-primary truncate drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" data-testid="heading-livestream-data">
                LIVESTREAMS
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-8">
        <div className="container mx-auto px-4 space-y-6">
          <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20 mt-20">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Search (Video ID or Title)</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Type to search..."
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm placeholder:text-muted-foreground/50"
                  data-testid="input-search"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    setPage(0);
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                  data-testid="select-status-filter"
                >
                  <option value="ALL">All</option>
                  <option value="LIVE">LIVE</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="ENDED">ENDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-retro text-xs uppercase tracking-wide text-muted-foreground">Time Status</span>
                <select
                  value={timeStatusFilter}
                  onChange={(event) => {
                    setTimeStatusFilter(event.target.value as TimeStatusFilter);
                    setPage(0);
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 font-retro text-sm pr-8"
                  data-testid="select-time-status-filter"
                >
                  <option value="ALL">All</option>
                  <option value="LATE">LATE</option>
                  <option value="EARLY">EARLY</option>
                  <option value="ON_TIME">ON_TIME</option>
                </select>
              </label>

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
                  <option value="actualStart">Actual Start</option>
                  <option value="scheduledStart">Scheduled Start</option>
                  <option value="diffSeconds">Lateness</option>
                  <option value="title">Title</option>
                  <option value="totalDurationSeconds">Duration</option>
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
                  <option value="desc">DESC</option>
                  <option value="asc">ASC</option>
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

          <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-0 shadow-lg shadow-secondary/20">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />

            {isFetching && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/70 backdrop-blur-[1px]">
                <div className="font-retro text-sm text-muted-foreground animate-pulse" data-testid="table-loading-overlay">
                  Loading table data...
                </div>
              </div>
            )}

            <div className="relative z-10 overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20">
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Video ID</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Scheduled</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Actual</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Delta</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Time Status</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Duration</th>
                    <th className="px-4 py-3 text-left font-retro text-xs uppercase tracking-wider text-muted-foreground">Watch</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center font-retro text-muted-foreground"
                        data-testid="table-empty-state"
                      >
                        No livestream records found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((stream) => (
                      <tr key={stream.videoId} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-retro text-sm text-foreground/80">{stream.videoId}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground max-w-[340px]">
                          <div className="line-clamp-2">{stream.title}</div>
                        </td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/80">{formatDateTime(stream.scheduledStart)}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/80">{formatDateTime(stream.actualStart)}</td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/90">
                          {formatTimeStatusDelta(stream.diffSeconds, stream.timeStatus)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 font-retro text-xs ${timeStatusBadgeClass(stream.timeStatus)}`}
                          >
                            {stream.timeStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded border px-2 py-0.5 font-retro text-xs ${statusBadgeClass(stream.status)}`}>
                            {stream.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-retro text-sm text-foreground/80">{formatDuration(stream.totalDurationSeconds)}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="group relative text-[#7462B3] hover:bg-[#d2758e]/10 hover:text-[#d2758e]"
                            onClick={() => {
                              window.location.href = `https://www.youtube.com/watch?v=${stream.videoId}`;
                            }}
                            data-testid={`button-watch-youtube-${stream.videoId}`}
                            aria-label="Watch on youtube"
                          >
                            <FaYoutube className="h-5 w-5" />
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-card px-2 py-1 font-retro text-[10px] uppercase tracking-wide text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              Watch on youtube
                            </span>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="font-retro text-sm text-muted-foreground" data-testid="text-table-summary">
              Showing {rows.length} of {totalElements} records
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page <= 0 || !!data?.first}
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
                disabled={!data || data.last}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
