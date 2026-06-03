import { CheckCircle, Vote } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { TimeStatus } from "../shared/schema";

interface CastVoteProps {
  hasPendingVote: boolean;
  voteSuccessMessage: string;
  isPending: boolean;
  voteFormError: string | null;
  voteUserName: string;
  voteDirection: TimeStatus;
  voteHours: string;
  voteMinutes: string;
  voteSeconds: string;
  onUserNameChange: (value: string) => void;
  onDirectionChange: (value: TimeStatus) => void;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  onSecondsChange: (value: string) => void;
  onSubmit: () => void;
}

export function CastVote({
  hasPendingVote,
  voteSuccessMessage,
  isPending,
  voteFormError,
  voteUserName,
  voteDirection,
  voteHours,
  voteMinutes,
  voteSeconds,
  onUserNameChange,
  onDirectionChange,
  onHoursChange,
  onMinutesChange,
  onSecondsChange,
  onSubmit,
}: CastVoteProps) {
  return (
    <Card className="relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-4 md:p-6 shadow-lg shadow-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
            <Vote className="w-6 h-6 text-primary" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-pixel text-xl text-primary">
              How late will the next stream be?
            </h2>
            <p className="font-retro text-sm text-muted-foreground mt-0.5">
              {hasPendingVote ? "Vote submitted!" : "Submit your vote!"}
            </p>
          </div>
        </div>

        {hasPendingVote ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-retro">{voteSuccessMessage}</span>
            </div>
            <p className="font-retro text-sm text-muted-foreground">
              Check back here once the pod goes live to see the results!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vote-username" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                Username
              </Label>
              <Input
                id="vote-username"
                value={voteUserName}
                onChange={(event) => onUserNameChange(event.target.value)}
                className="font-retro"
                placeholder="FupaTroopa#123456"
                data-testid="input-vote-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vote-direction" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                Prediction Type
              </Label>
              <select
                id="vote-direction"
                value={voteDirection}
                onChange={(event) => onDirectionChange(event.target.value as TimeStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-retro text-sm"
                data-testid="select-vote-direction"
              >
                <option value="LATE">LATE</option>
                <option value="EARLY">EARLY</option>
                <option value="ON_TIME">ON_TIME</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vote-hours" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Hours
                </Label>
                <Input
                  id="vote-hours"
                  type="number"
                  min={0}
                  step={1}
                  value={voteHours}
                  onChange={(event) => onHoursChange(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-hours"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vote-minutes" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Minutes
                </Label>
                <Input
                  id="vote-minutes"
                  type="number"
                  min={0}
                  step={1}
                  value={voteMinutes}
                  onChange={(event) => onMinutesChange(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-minutes"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vote-seconds" className="font-retro text-xs uppercase tracking-wide text-muted-foreground">
                  Seconds
                </Label>
                <Input
                  id="vote-seconds"
                  type="number"
                  min={0}
                  step={1}
                  value={voteSeconds}
                  onChange={(event) => onSecondsChange(event.target.value)}
                  disabled={voteDirection === "ON_TIME"}
                  className="font-retro"
                  data-testid="input-vote-seconds"
                />
              </div>
            </div>

            {voteFormError && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 font-retro text-sm text-destructive"
                data-testid="text-vote-error"
              >
                {voteFormError}
              </div>
            )}

            <Button
              onClick={onSubmit}
              disabled={isPending}
              className="w-full font-retro uppercase tracking-wide"
              data-testid="button-submit-vote"
            >
              {isPending ? "Submitting..." : "Submit Vote"}
            </Button>

            <p className="font-retro text-xs text-muted-foreground text-center">
              Note: Votes cannot be changed once submitted.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
