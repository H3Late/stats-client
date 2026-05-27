import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Spring Boot API response types
export type LivestreamStatus = "LIVE" | "SCHEDULED" | "ENDED" | "CANCELLED";
export type TimeStatus = "LATE" | "EARLY" | "ON_TIME";

export interface LivestreamRecord {
  videoId: string;
  title: string;
  scheduledStart: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  diffSeconds: number;
  totalDurationSeconds: number | null;
  status: LivestreamStatus;
  timeStatus: TimeStatus;
  createdAt: string;
}

export interface SortInfo {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface PageableInfo {
  offset: number;
  pageNumber: number;
  pageSize: number;
  paged: boolean;
  sort: SortInfo;
  unpaged: boolean;
}

export interface PaginatedResponse<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  pageable: PageableInfo;
  size: number;
  sort: SortInfo;
  totalElements: number;
  totalPages: number;
}

export interface LivestreamStatsResponse {
  avg_lateness_seconds: number;
  record_lateness_seconds: number;
  record_video_id: string | null;
  record_video_title: string | null;
  total_early_count: number;
  total_late_count: number;
  total_late_time_seconds: number;
  total_on_time_count: number;
  total_streams: number;
}

export interface DayStatsResponse {
  avg_lateness_seconds: number;
  day_index: number;
  day_of_week: string;
  stream_count: number;
}

export interface LeaderboardEntry {
  userName: string;
  userGuess: number;
  actualResult: number;
  proximityScore: number;
}

// Frontend chart type used after mapping API records
export interface TrendLivestream {
  videoId: string;
  title: string;
  actualStartTime: string;
  scheduledStartTime: string | null;
  lateTime: number;
}

