import { Card } from "../components/ui/card";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Livestream } from "../shared/schema";
import { formatLateTime } from "../lib/utils";

interface LatenessTrendChartProps {
  livestreams: Livestream[];
}

export function LatenessTrendChart({ livestreams }: LatenessTrendChartProps) {
  const chartData = livestreams
    .slice()
    .reverse()
    .map((stream, index) => ({
      index,
      date: new Date(stream.actualStartTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      lateTime: stream.lateTime,
      lateMinutes: Math.floor(stream.lateTime / 60),
      title: stream.title,
      actualStartTime: stream.actualStartTime,
    }));

  return (
    <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-6 shadow-lg shadow-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="font-pixel text-xl md:text-2xl text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" data-testid="heading-lateness-trend">
            LATENESS OVER TIME
          </h2>
          <p className="font-retro text-sm text-muted-foreground/70" data-testid="label-last-episodes">
            (Last 10 Episodes)
          </p>
        </div>
        
        <div className="w-full h-64 md:h-80" data-testid="chart-lateness-trend">
          <ResponsiveContainer width="100%" height="100%" minHeight={256}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="index"
                tickFormatter={(value) => chartData[value]?.date ?? ''}
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '16px' }}
                label={{ value: 'Episode Date', position: 'insideBottom', offset: -5, style: { fill: 'hsl(var(--muted-foreground))', fontFamily: 'VT323, monospace', fontSize: '18px' } }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontFamily: 'VT323, monospace', fontSize: '16px' }}
                label={{ value: 'Minutes Late', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontFamily: 'VT323, monospace', fontSize: '18px' } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '2px solid hsl(var(--primary))',
                  borderRadius: '4px',
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  boxShadow: '0 0 15px rgba(168,85,247,0.3)',
                  padding: '12px',
                }}
                labelStyle={{ display: 'none' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload[0]) return null;
                  const data = payload[0].payload;
                  const date = new Date(data.actualStartTime);
                  const formattedDate = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                  
                  return (
                    <div style={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '2px solid hsl(var(--primary))',
                      borderRadius: '4px',
                      fontFamily: 'VT323, monospace',
                      fontSize: '18px',
                      padding: '12px',
                      boxShadow: '0 0 15px rgba(168,85,247,0.3)',
                    }}>
                      <div style={{ color: 'hsl(var(--primary))', marginBottom: '8px', fontWeight: 'bold' }}>
                        {data.title}
                      </div>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '16px', marginBottom: '4px' }}>
                        {formattedDate}
                      </div>
                      <div style={{ color: 'hsl(var(--secondary))' }}>
                        Late Time: {formatLateTime(data.lateTime)}
                      </div>
                    </div>
                  );
                }}
              />
              <Line 
                type="monotone" 
                dataKey="lateMinutes" 
                stroke="hsl(var(--chart-1))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--chart-1))', r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </Card>
  );
}
