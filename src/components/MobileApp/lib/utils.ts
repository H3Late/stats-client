import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { TimeStatus } from "../shared/schema"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLateTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round((seconds % 60) * 10) / 10;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}

export function formatLateTimeVerbose(seconds: number): { minutes: number; seconds: number; formatted: string } {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return {
    minutes,
    seconds: remainingSeconds,
    formatted: formatLateTime(seconds)
  };
}

export function formatDurationFromMinutes(totalMinutes: number): string {
  return formatDurationVerbose(Math.round(totalMinutes * 60));
}

export function formatDurationVerbose(totalSeconds: number): string {
  const absSeconds = Math.max(0, Math.round(totalSeconds));

  const days = Math.floor(absSeconds / 86400);
  const hours = Math.floor((absSeconds % 86400) / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = absSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days === 1 ? "" : "s"}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  }

  return parts.join(", ");
}

export function formatTimeStatusDelta(diffSeconds: number, timeStatus: TimeStatus): string {
  const formatted = formatLateTime(Math.abs(diffSeconds));

  switch (timeStatus) {
    case "EARLY":
      return `${formatted} early`;
    case "ON_TIME":
      return `${formatted} on time`;
    case "LATE":
    default:
      return `${formatted} late`;
  }
}
