import axios from 'axios';
import { config } from '../utils/config'

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

export interface Livestream {
  _id: string;
  videoId: string;
  scheduledStartTime: string;
  actualStartTime: string;
  lateTime: number;
  title: string;
}

export interface EpisodeWithDate {
  title: string;
  videoId: string;
  lateTime: number;
  scheduledStartTime: string;
  date: string; // YYYY-MM
}




interface ErrorResponse {
    message: string;
    details: Record<string, any>;
}

export class YoutubeApiManager {
    private static instance: YoutubeApiManager;
    private baseUrl: string;

    private constructor() {
        this.baseUrl = config.YOUTUBE_API_URL;
    }

    public static getInstance(): YoutubeApiManager {
        if (!YoutubeApiManager.instance) {
            YoutubeApiManager.instance = new YoutubeApiManager();
        }
        return YoutubeApiManager.instance;
    }

    public async getStats(): Promise<StatsResponse> {
        try {
            const response = await axios.get<StatsResponse>(`${this.baseUrl}/api/stats`);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                const errorData = error.response.data as ErrorResponse;
                console.error('YouTube API Error:', errorData.message);
                throw errorData;
            } else {
                console.error('Unexpected error:', error);
                throw {
                    message: 'Failed to fetch YouTube stats',
                    details: { originalError: error }
                } as ErrorResponse;
            }
        }
    }

    public async getLivestreams(limit: number = 100, offset: number = 0): Promise<any[]> {
        try {
            const response = await axios.get<{ livestreams: any[] }>(`${this.baseUrl}/api/livestreams`, {
                params: { limit, offset }
            });
            return response.data.livestreams;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {  
                const errorData = error.response.data as ErrorResponse;
                console.error('YouTube API Error:', errorData.message);
                throw errorData;
            } else {
                console.error('Unexpected error:', error);
                throw {
                    message: 'Failed to fetch YouTube livestreams',
                    details: { originalError: error }
                } as ErrorResponse;
            }
        }
    }

}

