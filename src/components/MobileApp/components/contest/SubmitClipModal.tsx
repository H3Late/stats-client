import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { Contest } from "../../shared/contestSchema";
import type { LivestreamRecord } from "../../shared/schema";
import { apiRequest } from "../../lib/queryClient";
import { saveSubmitterName } from "../../hooks/useVoterToken";

function parseNonNegativeInt(val: string): number {
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function hmsToSeconds(h: string, m: string, s: string): number {
  return parseNonNegativeInt(h) * 3600 + parseNonNegativeInt(m) * 60 + parseNonNegativeInt(s);
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const parts = error.message.split(":");
    const msg = parts.slice(1).join(":").trim();
    return msg.length > 0 ? msg : error.message;
  }
  return "Unable to submit clip. Please try again.";
}

interface SubmitClipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: Contest;
  voterToken: string;
  initialSubmitterName: string;
  onSuccess: () => void;
}

export function SubmitClipModal({
  open,
  onOpenChange,
  contest,
  voterToken,
  initialSubmitterName,
  onSuccess,
}: SubmitClipModalProps) {
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [startH, setStartH] = useState("0");
  const [startM, setStartM] = useState("0");
  const [startS, setStartS] = useState("0");
  const [endH, setEndH] = useState("0");
  const [endM, setEndM] = useState("0");
  const [endS, setEndS] = useState("0");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitterName, setSubmitterName] = useState(initialSubmitterName);
  const [formError, setFormError] = useState<string | null>(null);

  const startSeconds = hmsToSeconds(startH, startM, startS);
  const endSeconds = hmsToSeconds(endH, endM, endS);

  const { data: eligibleStreams, isLoading: streamsLoading } = useQuery<LivestreamRecord[]>({
    queryKey: ["eligible-streams", contest.id],
    queryFn: () =>
      apiRequest("GET", `/api/contest/clip-contest/${contest.id}/eligible-streams`).then((r) =>
        r.json()
      ),
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/contest/clip-contest/${contest.id}/clips`, {
        videoId: selectedVideoId,
        title: title.trim(),
        description: description.trim() || null,
        startSeconds,
        endSeconds,
        submitterToken: voterToken,
        submitterName: submitterName.trim(),
      }),
    onSuccess: () => {
      saveSubmitterName(submitterName.trim());
      onSuccess();
      handleClose();
    },
    onError: (err) => {
      setFormError(getReadableError(err));
    },
  });

  function handleClose() {
    onOpenChange(false);
    setSelectedVideoId("");
    setStartH("0"); setStartM("0"); setStartS("0");
    setEndH("0"); setEndM("0"); setEndS("0");
    setTitle("");
    setDescription("");
    setFormError(null);
    submitMutation.reset();
  }

  function handleSubmit() {
    setFormError(null);

    if (!selectedVideoId) {
      setFormError("Please select a stream to clip.");
      return;
    }
    if (!submitterName.trim()) {
      setFormError("Please enter your display name.");
      return;
    }
    if (!title.trim()) {
      setFormError("Please enter a title for your clip.");
      return;
    }
    if (endSeconds <= startSeconds) {
      setFormError("End time must be after start time.");
      return;
    }

    const duration = endSeconds - startSeconds;
    if (duration < 5) {
      setFormError("Clip must be at least 5 seconds long.");
      return;
    }
    if (duration > contest.maxClipDurationSeconds) {
      setFormError(`Clip cannot be longer than ${contest.maxClipDurationSeconds} seconds.`);
      return;
    }

    submitMutation.mutate();
  }

  const previewYouTubeUrl = selectedVideoId
    ? `https://www.youtube.com/watch?v=${selectedVideoId}&t=${startSeconds}`
    : null;

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-retro placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const hmsInputClass =
    "w-16 h-10 rounded-md border border-input bg-background px-2 py-2 text-sm font-retro text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-pixel text-primary text-sm">SUBMIT A CLIP</DialogTitle>
          <DialogDescription className="font-retro text-xs text-muted-foreground">
            Select a moment from this week's streams. Max {contest.maxClipDurationSeconds}s per clip, up to {contest.maxSubmissionsPerUser} clips total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Stream selector */}
          <div className="space-y-1.5">
            <Label className="font-retro text-xs uppercase text-muted-foreground">Stream</Label>
            {streamsLoading ? (
              <div className="flex items-center gap-2 h-10 px-3 border border-input rounded-md">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="font-retro text-sm text-muted-foreground">Loading streams...</span>
              </div>
            ) : !eligibleStreams?.length ? (
              <p className="font-retro text-sm text-muted-foreground px-3 py-2 border border-input rounded-md">
                No streams available for this contest period.
              </p>
            ) : (
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a stream...</option>
                {eligibleStreams.map((s) => (
                  <option key={s.videoId} value={s.videoId}>
                    {s.title}
                    {s.actualStart
                      ? ` — ${new Date(s.actualStart).toLocaleDateString()}`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-retro text-xs uppercase text-muted-foreground">Start Time</Label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={startH}
                  onChange={(e) => setStartH(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={startM}
                  onChange={(e) => setStartM(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">m</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={startS}
                  onChange={(e) => setStartS(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">s</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-retro text-xs uppercase text-muted-foreground">End Time</Label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={endH}
                  onChange={(e) => setEndH(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={endM}
                  onChange={(e) => setEndM(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">m</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={endS}
                  onChange={(e) => setEndS(e.target.value)}
                  className={hmsInputClass}
                  placeholder="0"
                />
                <span className="font-retro text-xs text-muted-foreground">s</span>
              </div>
            </div>
          </div>

          {/* Preview link */}
          {previewYouTubeUrl && endSeconds > startSeconds && (
            <Button
              variant="outline"
              size="sm"
              className="font-retro text-xs uppercase w-full"
              onClick={() => window.open(previewYouTubeUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Preview on YouTube at {startSeconds}s
            </Button>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="font-retro text-xs uppercase text-muted-foreground">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Why is this the best moment?"
              maxLength={120}
              className="font-retro"
            />
            <p className="font-retro text-xs text-muted-foreground text-right">
              {title.length}/120
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="font-retro text-xs uppercase text-muted-foreground">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add some context..."
              rows={2}
              maxLength={280}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-retro placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label className="font-retro text-xs uppercase text-muted-foreground">
              Your Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              placeholder="What should we call you?"
              maxLength={40}
              className="font-retro"
            />
            <p className="font-retro text-xs text-muted-foreground">
              Displayed on leaderboard and winners list.
            </p>
          </div>

          {/* Error */}
          {formError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive">
              {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="font-retro uppercase flex-1"
              onClick={handleClose}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="font-retro uppercase flex-1"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Clip"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
