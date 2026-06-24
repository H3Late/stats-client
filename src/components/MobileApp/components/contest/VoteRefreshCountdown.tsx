import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeLeft(target: string): TimeLeft {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

interface CountdownProps {
  targetDate: string;
  label: string;
  colorClass?: string;
}

export function VoteRefreshCountdown({ targetDate, label, colorClass = "text-primary" }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (timeLeft.total <= 0) return null;

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}D`);
  parts.push(`${String(timeLeft.hours).padStart(2, "0")}H`);
  parts.push(`${String(timeLeft.minutes).padStart(2, "0")}M`);
  parts.push(`${String(timeLeft.seconds).padStart(2, "0")}S`);

  return (
    <div className="text-right">
      <div className={`font-pixel text-base ${colorClass} drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]`}>
        {parts.join(" ")}
      </div>
      <div className="font-retro text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
