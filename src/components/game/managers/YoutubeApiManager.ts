import axios from 'axios';
import { config } from '../utils/config';
import { formatDurationVerbose } from '../../MobileApp/lib/utils';

export interface MostRecent {
  videoId: string;
  lateTime: number;
  title: string;
  actualStartTime: string;
  scheduledStartTime: string;
}

export interface MaxLate {
  videoId: string;
  lateTime: number;
  title: string;
}

export interface DailyStats {
  sunday: { count: number; totalLateTime: number };
  monday: { count: number; totalLateTime: number };
  tuesday: { count: number; totalLateTime: number };
  wednesday: { count: number; totalLateTime: number };
  thursday: { count: number; totalLateTime: number };
  friday: { count: number; totalLateTime: number };
  saturday: { count: number; totalLateTime: number };
}

export interface StatsResponse {
  humanReadable: string;
  totalLateTime: number;
  averageLateTime: number;
  mostRecent: MostRecent;
  max: MaxLate;
  daily: DailyStats;
  lastUpdateDate: string;
  streamCount: number;
}

// Spring Boot response shapes (internal)
interface SpringGlobalStats {
  total_streams: number;
  avg_lateness_seconds: number;
  total_late_time_seconds: number;
  record_lateness_seconds: number;
  record_video_id: string;
  record_video_title: string;
  total_late_count: number;
  total_early_count: number;
  total_on_time_count: number;
}

interface SpringDayStats {
  day_of_week: string;
  day_index: number;
  stream_count: number;
  avg_lateness_seconds: number;
}

interface SpringLivestream {
  videoId: string;
  title: string;
  scheduledStart: string | null;
  actualStart: string | null;
  diffSeconds: number | null;
  status: string;
  timeStatus: string | null;
}

interface SpringPage<T> {
  content: T[];
  totalElements: number;
  number: number;
  size: number;
}

interface ErrorResponse {
  message: string;
  details: Record<string, unknown>;
}

export class YoutubeApiManager {
    private static instance: YoutubeApiManager;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = config.API_URL;
    }

    public static getInstance(): YoutubeApiManager {
        if (!YoutubeApiManager.instance) {
            YoutubeApiManager.instance = new YoutubeApiManager();
        }
        return YoutubeApiManager.instance;
    }

    public async getStats(): Promise<StatsResponse> {
        try {
            const [globalRes, dayRes, recentRes] = await Promise.all([
                axios.get<SpringGlobalStats>(`${this.baseUrl}/api/livestream/stats`),
                axios.get<SpringDayStats[]>(`${this.baseUrl}/api/livestream/stats/day`),
                axios.get<SpringPage<SpringLivestream>>(`${this.baseUrl}/api/livestream`, {
                    params: { status: 'ENDED', size: 1, sort: 'actualStart,desc' }
                }),
            ]);

            const gs = globalRes.data;
            const days = dayRes.data;
            const mostRecentStream = recentRes.data.content[0] ?? null;

            const daily: DailyStats = {
                sunday:    { count: 0, totalLateTime: 0 },
                monday:    { count: 0, totalLateTime: 0 },
                tuesday:   { count: 0, totalLateTime: 0 },
                wednesday: { count: 0, totalLateTime: 0 },
                thursday:  { count: 0, totalLateTime: 0 },
                friday:    { count: 0, totalLateTime: 0 },
                saturday:  { count: 0, totalLateTime: 0 },
            };

            for (const d of days) {
                const dayName = d.day_of_week.toLowerCase() as keyof DailyStats;
                if (dayName in daily) {
                    daily[dayName] = {
                        count: d.stream_count,
                        totalLateTime: Math.round(d.avg_lateness_seconds * d.stream_count),
                    };
                }
            }

            const mostRecent: MostRecent = mostRecentStream
                ? {
                      videoId: mostRecentStream.videoId,
                      lateTime: mostRecentStream.diffSeconds ?? 0,
                      title: mostRecentStream.title,
                      actualStartTime: mostRecentStream.actualStart ?? '',
                      scheduledStartTime: mostRecentStream.scheduledStart ?? '',
                  }
                : { videoId: '', lateTime: 0, title: '', actualStartTime: '', scheduledStartTime: '' };

            return {
                humanReadable: formatDurationVerbose(gs.total_late_time_seconds),
                totalLateTime: gs.total_late_time_seconds,
                averageLateTime: gs.avg_lateness_seconds,
                mostRecent,
                max: {
                    videoId: gs.record_video_id,
                    lateTime: gs.record_lateness_seconds,
                    title: gs.record_video_title,
                },
                daily,
                lastUpdateDate: mostRecentStream?.actualStart ?? new Date().toISOString(),
                streamCount: gs.total_streams,
            };
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data as ErrorResponse;
                console.error('Stats API Error:', errorData.message);
                throw errorData;
            }
            console.error('Unexpected error:', error);
            throw {
                message: 'Failed to fetch stats',
                details: { originalError: error },
            } as ErrorResponse;
        }
    }

}