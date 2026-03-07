import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type {
  DayStatsResponse,
  LivestreamRecord,
  LivestreamStatsResponse,
  PaginatedResponse,
  TrendLivestream,
} from "../shared/schema";
import { StatCard } from "../components/StatCard";
import { TotalStatsCard } from "../components/TotalStatsCard";
import { LatenessTrendChart } from "../components/LatenessTrendChart";
import { DayOfWeekChart } from "../components/DayOfWeekChart";
import { LoadingScreen } from "../components/LoadingScreen";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/button";
import { Clock, TrendingUp } from "lucide-react";
import { formatDurationVerbose, formatLateTime, formatTimeStatusDelta } from "../lib/utils";
import Logo from "../../game/images/l3l3.png";

export default function Dashboard() {
  const [, setLocation] = useLocation();

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

  const mostRecentLivestream = recentLivestreamPage.content[0] ?? null;


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
    ? mostRecentLivestream.timeStatus === "ON_TIME" ? "ON TIME!" : formatTimeStatusDelta(mostRecentLivestream.diffSeconds, mostRecentLivestream.timeStatus)
    : "No data";

  const mostRecentDetail = mostRecentLivestream
    ? `${mostRecentLivestream.timeStatus} • ${mostRecentLivestream.status}`
    : undefined;

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
    </div>
  );
}
