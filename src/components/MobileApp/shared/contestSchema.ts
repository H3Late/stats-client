export interface Contest {
  id: number;
  type: "WEEKLY" | "MONTHLY";
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "ENDED";
  dailyVoteBudget: number;
  maxClipDurationSeconds: number;
  maxSubmissionsPerUser: number;
  voteRefreshSchedule: string;
  createdAt: string;
}

export interface ContestClip {
  id: number;
  contestId: number;
  videoId: string;
  title: string;
  description: string | null;
  startSeconds: number;
  endSeconds: number;
  submitterToken: string;
  submitterName: string;
  submittedAt: string;
  voteCount: number;
  removed: boolean;
}

export interface ContestResult {
  id: number;
  contestId: number;
  rank: number;
  clipId: number;
  submitterName: string;
  voteCount: number;
  recordedAt: string;
}

export interface VoterStatusResponse {
  votesRemainingToday: number;
  nextPeriodStart: string;
  votedClipIds: number[];
}
