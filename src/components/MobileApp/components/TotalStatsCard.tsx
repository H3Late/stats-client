import { Card } from "../components/ui/card";
import { formatLateTime } from "../lib/utils";

interface TotalStatsCardProps {
  humanReadable: string;
  averageLateTime: number;
  streamCount: number;
}

export function TotalStatsCard({ humanReadable, averageLateTime, streamCount }: TotalStatsCardProps) {
  return (
    <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-secondary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />
      
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
      
      <div className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground block" data-testid="label-total-late-time">
              Total Late Time
            </span>
            <div className="font-pixel text-lg md:text-xl text-secondary drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]" data-testid="value-total-late-time">
              {humanReadable}
            </div>
          </div>

          <div className="space-y-3">
            <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground block" data-testid="label-average-late-time">
              Average Late Time
            </span>
            <div className="font-pixel text-2xl md:text-3xl text-primary drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" data-testid="value-average-late-time">
              {formatLateTime(averageLateTime)}
            </div>
          </div>
          
          <div className="space-y-3">
            <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground block" data-testid="label-stream-count">
              Total Streams
            </span>
            <div className="font-pixel text-2xl md:text-3xl text-accent drop-shadow-[0_0_10px_rgba(103,232,249,0.5)]" data-testid="value-stream-count">
              {streamCount}
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
    </Card>
  );
}
