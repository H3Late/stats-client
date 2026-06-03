import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Tv, X } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import {
  DataGrid,
  GridFilterPanel,
  Toolbar,
  ToolbarButton,
  FilterPanelTrigger,
} from "@mui/x-data-grid";
import type { GridColDef, GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import FilterListIcon from "@mui/icons-material/FilterList";
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
type SortField = "actualStart" | "scheduledStart" | "diffSeconds" | "title" | "totalDurationSeconds";

declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides {
    searchQuery: string;
    onSearchChange: (value: string) => void;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";

  const absSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const remainingSeconds = absSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
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

const SORTABLE_FIELDS: Record<string, SortField> = {
  actualStart: "actualStart",
  scheduledStart: "scheduledStart",
  diffSeconds: "diffSeconds",
  title: "title",
  totalDurationSeconds: "totalDurationSeconds",
};

function LivestreamToolbar({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <Toolbar style={{ justifyContent: "flex-start", padding: "36px 12px" }}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by video ID or title..."
        className="h-12 flex-1 min-w-[180px] max-w-sm rounded-md border border-input bg-background px-3 font-retro text-sm placeholder:text-muted-foreground/50"
        data-testid="input-search"
      />
      <Tooltip title="Filters">
        <FilterPanelTrigger
          render={(props, state) => (
            <ToolbarButton {...props}>
              <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                <FilterListIcon fontSize="small" />
              </Badge>
            </ToolbarButton>
          )}
        />
      </Tooltip>
    </Toolbar>
  );
}

function CustomFilterPanel(props: React.ComponentProps<typeof GridFilterPanel>) {
  return (
    <div>
      <div className="hidden sm:flex items-center px-3 py-2 border-b border-border/40">
        <span className="font-retro text-sm uppercase tracking-wide text-muted-foreground">
          Add a filter
        </span>
      </div>
      <GridFilterPanel {...props} />
    </div>
  );
}

function CancelFilterIcon() {
  return (
    <span className="flex items-center gap-1 font-retro text-sm">
      <X className="w-3.5 h-3.5" />
      Cancel
    </span>
  );
}

export default function LivestreamDataPage() {
  const [, setLocation] = useLocation();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [timeStatusFilter, setTimeStatusFilter] = useState<TimeStatusFilter>("ALL");
  const [sortField, setSortField] = useState<SortField>("actualStart");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(pageSize));
    params.set("sort", `${sortField},${sortDirection}`);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (timeStatusFilter !== "ALL") params.set("timeStatus", timeStatusFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    return `/api/livestream?${params.toString()}`;
  }, [page, pageSize, sortField, sortDirection, statusFilter, timeStatusFilter, debouncedSearch]);

  const { data, isPending, isFetching } = useQuery<PaginatedResponse<LivestreamRecord>>({
    queryKey: [queryPath],
    placeholderData: keepPreviousData,
  });

  const sortModel = useMemo(
    () => [{ field: sortField, sort: sortDirection }],
    [sortField, sortDirection],
  );

  function handleSortModelChange(model: GridSortModel) {
    const newField = model[0] ? SORTABLE_FIELDS[model[0].field] : "actualStart";
    const newDirection = model[0]?.sort ?? "desc";
    if (!newField || (newField === sortField && newDirection === sortDirection)) return;
    setSortField(newField);
    setSortDirection(newDirection);
    setPage(0);
  }

  function handleFilterModelChange(model: GridFilterModel) {
    const statusItem = model.items.find((item) => item.field === "status" && item.value);
    const newStatus = (statusItem?.value as StatusFilter) ?? "ALL";

    const timeStatusItem = model.items.find((item) => item.field === "timeStatus" && item.value);
    const newTimeStatus = (timeStatusItem?.value as TimeStatusFilter) ?? "ALL";

    if (newStatus === statusFilter && newTimeStatus === timeStatusFilter) return;
    setStatusFilter(newStatus);
    setTimeStatusFilter(newTimeStatus);
    setPage(0);
  }

  const columns: GridColDef<LivestreamRecord>[] = useMemo(() => [
    {
      field: "videoId",
      headerName: "Video ID",
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: ({ value }) => (
        <span className="font-retro text-sm text-foreground/80">{value}</span>
      ),
    },
    {
      field: "title",
      headerName: "Title",
      flex: 1,
      minWidth: 260,
      sortable: true,
      filterable: false,
      renderCell: ({ row }) => (
        <div className="flex items-start gap-2 py-1 w-full">
          <div className="line-clamp-2 flex-1 min-w-0 font-retro text-sm text-foreground">
            {row.title}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="group relative h-7 w-7 shrink-0 text-[#7462B3] hover:bg-[#d2758e]/10 hover:text-[#d2758e]"
            onClick={() => {
              window.location.href = `https://www.youtube.com/watch?v=${row.videoId}`;
            }}
            data-testid={`button-watch-youtube-${row.videoId}`}
            aria-label="Watch on youtube"
          >
            <FaYoutube className="h-4 w-4" />
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-card px-2 py-1 font-retro text-[10px] uppercase tracking-wide text-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Watch on youtube
            </span>
          </Button>
        </div>
      ),
    },
    {
      field: "scheduledStart",
      headerName: "Scheduled Start",
      width: 170,
      sortable: true,
      filterable: false,
      renderCell: ({ value }) => (
        <span className="font-retro text-sm text-foreground/80">{formatDateTime(value)}</span>
      ),
    },
    {
      field: "actualStart",
      headerName: "Actual Start",
      width: 170,
      sortable: true,
      filterable: false,
      renderCell: ({ value }) => (
        <span className="font-retro text-sm text-foreground/80">{formatDateTime(value)}</span>
      ),
    },
    {
      field: "diffSeconds",
      headerName: "Difference",
      width: 130,
      sortable: true,
      filterable: false,
      renderCell: ({ row }) => (
        <span className="font-retro text-sm text-foreground/90">
          {formatTimeStatusDelta(row.diffSeconds, row.timeStatus)}
        </span>
      ),
    },
    {
      field: "timeStatus",
      headerName: "Time Status",
      width: 120,
      sortable: false,
      filterable: true,
      type: "singleSelect",
      valueOptions: ["LATE", "EARLY", "ON_TIME"],
      renderCell: ({ value }) => (
        <span className={`inline-flex rounded border px-2 py-0.5 font-retro text-xs ${timeStatusBadgeClass(value)}`}>
          {value}
        </span>
      ),
    },
    {
      field: "status",
      headerName: "Stream Status",
      width: 130,
      sortable: false,
      filterable: true,
      type: "singleSelect",
      valueOptions: ["LIVE", "SCHEDULED", "ENDED", "CANCELLED"],
      renderCell: ({ value }) => (
        <span className={`inline-flex rounded border px-2 py-0.5 font-retro text-xs ${statusBadgeClass(value)}`}>
          {value}
        </span>
      ),
    },
    {
      field: "totalDurationSeconds",
      headerName: "Stream Duration",
      width: 140,
      sortable: true,
      filterable: false,
      renderCell: ({ value }) => (
        <span className="font-retro text-sm text-foreground/80">{formatDuration(value)}</span>
      ),
    },
  ], []);

  if (isPending && !data) {
    return <LoadingScreen />;
  }

  const rows = data?.content ?? [];
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
              <h1
                className="font-pixel text-lg md:text-2xl text-primary truncate drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                data-testid="heading-livestream-data"
              >
                LIVESTREAMS
              </h1>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-8">
        <div className="container mx-auto px-4 space-y-6">
          <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-0 shadow-lg shadow-secondary/20 mt-20">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none z-0" />

            <div className="relative z-10">
              <DataGrid
                rows={rows}
                columns={columns}
                getRowId={(row) => row.videoId}
                loading={isFetching}
                rowCount={totalElements}
                paginationMode="server"
                sortingMode="server"
                filterMode="server"
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={({ page: p, pageSize: ps }) => {
                  setPage(p);
                  setPageSize(ps);
                }}
                sortModel={sortModel}
                onSortModelChange={handleSortModelChange}
                onFilterModelChange={handleFilterModelChange}
                pageSizeOptions={[10, 25, 50]}
                showToolbar
                slots={{
                  toolbar: LivestreamToolbar,
                  filterPanel: CustomFilterPanel,
                  filterPanelDeleteIcon: CancelFilterIcon,
                  noRowsOverlay: () => (
                    <div
                      className="flex items-center justify-center h-full font-retro text-muted-foreground"
                      data-testid="table-empty-state"
                    >
                      No livestream records found for the current filters.
                    </div>
                  ),
                }}
                slotProps={{
                  filterPanel: {
                    filterFormProps: {
                      deleteIconProps: {
                        sx: { width: "auto", px: 1, borderRadius: 1 },
                      },
                    },
                  },
                  toolbar: {
                    searchQuery,
                    onSearchChange: setSearchQuery,
                  },
                }}
                disableRowSelectionOnClick
                autoHeight
                sx={{ minWidth: 0 }}
              />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
