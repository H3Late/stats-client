import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ThumbsUp, ExternalLink, Flag } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { ContestClip } from "../../shared/contestSchema";
import { apiRequest } from "../../lib/queryClient";

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const parts = error.message.split(":");
    const msg = parts.slice(1).join(":").trim();
    return msg.length > 0 ? msg : error.message;
  }
  return "Something went wrong. Please try again.";
}

const RANK_ICONS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const REPORT_REASONS = [
  { value: "INAPPROPRIATE", label: "Inappropriate" },
  { value: "SPAM", label: "Spam" },
  { value: "OFF_TOPIC", label: "Off Topic" },
  { value: "OTHER", label: "Other" },
] as const;

type ReportReason = typeof REPORT_REASONS[number]["value"];

interface ContestClipCardProps {
  clip: ContestClip;
  rank: number;
  voterToken: string;
  hasVoted: boolean;
  votesRemaining: number;
  isVoting: boolean;
  contestActive: boolean;
  isMyClip: boolean;
  onVote: (clipId: number) => void;
  onUnvote: (clipId: number) => void;
}

export function ContestClipCard({
  clip,
  rank,
  voterToken,
  hasVoted,
  votesRemaining,
  isVoting,
  contestActive,
  isMyClip,
  onVote,
  onUnvote,
}: ContestClipCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("INAPPROPRIATE");
  const [reportDescription, setReportDescription] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);

  const embedSrc = `https://www.youtube.com/embed/${clip.videoId}?start=${clip.startSeconds}&end=${clip.endSeconds}&autoplay=0`;
  const duration = clip.endSeconds - clip.startSeconds;

  const reportMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/contest/clip-contest/clips/${clip.id}/report`, {
        reporterToken: voterToken,
        reason: reportReason,
        description: reportDescription || null,
      }),
    onSuccess: () => {
      setReportDone(true);
      setReportError(null);
    },
    onError: (err) => {
      setReportError(getReadableError(err));
    },
  });

  const canVote = contestActive && !hasVoted && votesRemaining > 0 && !isMyClip;
  const canUnvote = contestActive && hasVoted && !isMyClip;

  const borderColor =
    rank === 1
      ? "border-yellow-500/60 shadow-yellow-500/20"
      : rank === 2
      ? "border-slate-400/60 shadow-slate-400/20"
      : rank === 3
      ? "border-amber-600/60 shadow-amber-600/20"
      : "border-primary/40 shadow-primary/20";

  return (
    <>
      <Card className={`relative overflow-hidden border-2 ${borderColor} bg-card/95 backdrop-blur-sm shadow-lg hover-elevate transition-all duration-300 flex flex-col`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        {/* YouTube embed */}
        <div className="relative w-full aspect-video bg-black/40">
          <iframe
            src={embedSrc}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            title={clip.title}
          />
        </div>

        {/* Card body */}
        <div className="relative z-10 p-4 flex flex-col gap-3 flex-1">
          {/* Rank + title row */}
          <div className="flex items-start gap-2">
            {rank <= 3 && (
              <span className="text-lg leading-none mt-0.5 shrink-0">{RANK_ICONS[rank]}</span>
            )}
            {rank > 3 && (
              <span className="font-pixel text-xs text-muted-foreground shrink-0 mt-1">#{rank}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-retro text-base text-foreground leading-snug line-clamp-2">{clip.title}</p>
              {clip.description && (
                <p className="font-retro text-xs text-muted-foreground mt-1 line-clamp-2">{clip.description}</p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-retro text-xs text-muted-foreground">
              <span className="text-foreground/70">{clip.submitterName}</span>
              {isMyClip && (
                <span className="ml-1 text-accent text-xs">(you)</span>
              )}
            </div>
            <div className="flex items-center gap-1 font-retro text-xs text-muted-foreground">
              <span>{formatTimestamp(clip.startSeconds)} – {formatTimestamp(clip.endSeconds)}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{duration}s</span>
            </div>
          </div>

          {/* Vote row */}
          <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border/40">
            <div className="flex items-center gap-2">
              <ThumbsUp className={`w-4 h-4 ${hasVoted ? "text-primary fill-primary" : "text-muted-foreground"}`} />
              <span className="font-pixel text-sm text-primary">{clip.voteCount}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="font-retro text-xs text-muted-foreground/50 hover:text-destructive h-7 px-2"
                onClick={() => { setReportOpen(true); setReportDone(false); setReportError(null); }}
              >
                <Flag className="w-3 h-3 mr-1" />
                Report
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="font-retro text-xs text-muted-foreground/50 hover:text-foreground h-7 px-2"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${clip.videoId}&t=${clip.startSeconds}`, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                YT
              </Button>

              {contestActive && !isMyClip && (
                hasVoted ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-retro text-xs uppercase border-primary/50 text-primary h-8"
                    onClick={() => onUnvote(clip.id)}
                    disabled={isVoting}
                  >
                    ✓ Voted
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="font-retro text-xs uppercase h-8"
                    onClick={() => onVote(clip.id)}
                    disabled={isVoting || votesRemaining === 0}
                    title={votesRemaining === 0 ? "No votes remaining today" : undefined}
                  >
                    Vote
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </Card>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-pixel text-sm text-primary">REPORT CLIP</DialogTitle>
          </DialogHeader>

          {reportDone ? (
            <div className="py-4 text-center">
              <p className="font-retro text-foreground">Thanks — we'll review this clip.</p>
              <Button
                className="mt-4 font-retro"
                variant="outline"
                onClick={() => setReportOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-retro text-xs uppercase text-muted-foreground">Reason</Label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as ReportReason)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-retro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-retro text-xs uppercase text-muted-foreground">Details (optional)</Label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-retro placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              {reportError && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive">
                  {reportError}
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="font-retro" onClick={() => setReportOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="font-retro"
                  onClick={() => reportMutation.mutate()}
                  disabled={reportMutation.isPending}
                >
                  {reportMutation.isPending ? "Reporting..." : "Submit Report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
