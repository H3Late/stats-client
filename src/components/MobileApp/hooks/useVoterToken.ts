import { useState } from "react";

const VOTER_TOKEN_KEY = "contest:voter-token";
export const SUBMITTER_NAME_KEY = "contest:submitter-name";

export function useVoterToken(): string {
  const [token] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(VOTER_TOKEN_KEY);
      if (stored) return stored;
      const fresh = crypto.randomUUID();
      localStorage.setItem(VOTER_TOKEN_KEY, fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });
  return token;
}

export function getStoredSubmitterName(): string {
  try {
    return localStorage.getItem(SUBMITTER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveSubmitterName(name: string): void {
  try {
    localStorage.setItem(SUBMITTER_NAME_KEY, name);
  } catch {
    // ignore
  }
}
