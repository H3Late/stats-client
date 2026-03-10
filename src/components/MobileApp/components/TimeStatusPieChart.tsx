import { Card } from "../components/ui/card";
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface TimeStatusPieChartProps {
  lateCount: number;
  onTimeCount: number;
  earlyCount: number;
  totalStreams: number;
}

export function TimeStatusPieChart({
  lateCount,
  onTimeCount,
  earlyCount,
  totalStreams,
}: TimeStatusPieChartProps) {
  const chartData = [
    { key: "LATE", label: "LATE", count: lateCount, color: "hsl(var(--chart-1))" },
    { key: "ON_TIME", label: "ON TIME", count: onTimeCount, color: "hsl(var(--chart-2))" },
    { key: "EARLY", label: "EARLY", count: earlyCount, color: "hsl(var(--chart-3))" },
  ].map((item) => ({
    ...item,
    percentage: totalStreams > 0 ? (item.count / totalStreams) * 100 : 0,
  }));

  return (
    <Card className="relative overflow-hidden border-2 border-accent/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-accent/20">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-pixel text-xl md:text-2xl text-accent drop-shadow-[0_0_8px_rgba(34,197,94,0.35)]" data-testid="heading-time-status-breakdown">
            START TIME BREAKDOWN
          </h2>
          <p className="font-retro text-sm text-muted-foreground/70" data-testid="label-time-status-breakdown-subtitle">
            (% and stream count)
          </p>
        </div>

        <div className="w-full h-64 md:h-80" data-testid="chart-time-status-breakdown">
          <ResponsiveContainer width="100%" height="100%" minHeight={256}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="48%"
                innerRadius="48%"
                outerRadius="78%"
                stroke="hsl(var(--card))"
                strokeWidth={2}
                paddingAngle={2}
                isAnimationActive
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "2px solid hsl(var(--accent))",
                  color: "rgb(48, 201, 232)",
                  borderRadius: "4px",
                  fontFamily: "VT323, monospace",
                  fontSize: "18px",
                  boxShadow: "0 0 15px rgba(34,197,94,0.25)",
                  padding: "12px",                  
                }}
                labelStyle={{ color: "rgb(48, 201, 232)" }}
                itemStyle={{ color: "rgb(48, 201, 232)" }}
                formatter={(value: number, _name: string, props: any) => {
                  const percentage = props.payload?.percentage ?? 0;
                  return [`${value} streams (${percentage.toFixed(1)}%)`, "Count"];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="list-time-status-breakdown">
          {chartData.map((entry) => (
            <div key={entry.key} className="rounded-md border border-border/60 bg-background/60 px-3 py-2">
              <div className="font-retro text-xs text-muted-foreground">{entry.label}</div>
              <div className="font-pixel text-lg leading-none" style={{ color: entry.color }}>
                {entry.percentage.toFixed(1)}%
              </div>
              <div className="font-retro text-sm text-foreground/90">{entry.count} streams</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
    </Card>
  );
}