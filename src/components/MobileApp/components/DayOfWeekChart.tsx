import { Card } from "../components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { DayStatsResponse } from "../shared/schema";
import { formatLateTime } from "../lib/utils";

interface DayOfWeekChartProps {
  dailyStats: DayStatsResponse[];
}

export function DayOfWeekChart({ dailyStats }: DayOfWeekChartProps) {
  const dayLookup = new Map(dailyStats.map((item) => [item.day_index, item]));

  const chartData = [
    { day: "SUN", index: 0 },
    { day: "MON", index: 1 },
    { day: "TUE", index: 2 },
    { day: "WED", index: 3 },
    { day: "THU", index: 4 },
    { day: "FRI", index: 5 },
    { day: "SAT", index: 6 },
  ].map(({ day, index }) => {
    const stats = dayLookup.get(index);
    const avgLateSeconds = stats?.avg_lateness_seconds ?? 0;

    return {
      day,
      avgLateMinutes: avgLateSeconds / 60,
      avgLateSeconds,
      count: stats?.stream_count ?? 0,
    };
  });

  return (
    <Card className="relative overflow-hidden border-2 border-secondary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-secondary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 space-y-6">
        <h2 className="font-pixel text-xl md:text-2xl text-center text-secondary drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]" data-testid="heading-day-of-week">
          AVG LATE TIME BY DAY
        </h2>
        
        <div className="w-full h-56 md:h-72" data-testid="chart-day-of-week">
          <ResponsiveContainer width="100%" height="100%" minHeight={224}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="day" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '18px', fontWeight: 'bold' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '16px' }}
                label={{ value: 'Avg Minutes', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontFamily: 'VT323, monospace', fontSize: '18px' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '2px solid hsl(var(--secondary))',
                  borderRadius: '4px',
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  boxShadow: '0 0 15px rgba(236,72,153,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--secondary))' }}
                formatter={(_value: number, _name: string, props: any) => [
                  `${formatLateTime(props.payload.avgLateSeconds)} avg (${props.payload.count} streams)`,
                  'Avg Late'
                ]}
              />
              <Bar 
                dataKey="avgLateMinutes" 
                fill="hsl(var(--chart-2))" 
                radius={[4, 4, 0, 0]}
                style={{ filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.4))' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
    </Card>
  );
}
