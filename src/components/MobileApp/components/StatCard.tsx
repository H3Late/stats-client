import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { type LucideIcon, ExternalLink, Check } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle?: string;
  detail?: string;
  className?: string;
  videoId?: string | null;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionChecked?: boolean;
  onActionClick?: () => void;
  actionTestId?: string;
  secondaryActionLabel?: string;
  onSecondaryActionClick?: () => void;
  secondaryActionTestId?: string;
  actionsLabel?: string;
  actionsLabelClassName?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  detail,
  className,
  videoId,
  actionLabel,
  actionDisabled = false,
  actionChecked = false,
  onActionClick,
  actionTestId,
  secondaryActionLabel,
  onSecondaryActionClick,
  secondaryActionTestId,
  actionsLabel,
  actionsLabelClassName,
}: StatCardProps) {
  const handleWatchOnYouTube = () => {
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={cn(
      "relative overflow-hidden border-2 border-primary/40 bg-card/95 backdrop-blur-sm p-6 pb-[10px]",
      "shadow-lg shadow-primary/20",
      "hover-elevate transition-all duration-300",
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      
      <div className="relative z-10 flex flex-col justify-between min-h-full">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/20 border border-primary/40">
              <Icon className="w-6 h-6 text-primary" strokeWidth={2.5} />
            </div>
            <span className="font-retro text-lg uppercase tracking-wide text-muted-foreground" data-testid={`label-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {label}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="font-pixel text-2xl md:text-3xl text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" data-testid={`value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </div>
            
            {subtitle && (
              <div className="font-retro text-base md:text-lg text-foreground/90 line-clamp-2" data-testid={`subtitle-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                {subtitle}
              </div>
            )}

            {detail && (
              <div className="font-retro text-sm text-muted-foreground" data-testid={`detail-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                {detail}
              </div>
            )}
          </div>
        </div>

        {(actionLabel || secondaryActionLabel || videoId) && (
          <div className="mt-4 space-y-2">
            {actionsLabel && (
              <span className={cn("font-retro text-lg uppercase tracking-wide text-muted-foreground block", actionsLabelClassName)}>
                {actionsLabel}
              </span>
            )}

            {(actionLabel || secondaryActionLabel) && (
              <div className={secondaryActionLabel && actionLabel ? "grid grid-cols-1 md:grid-cols-2 gap-2" : undefined}>
                {actionLabel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onActionClick}
                    disabled={actionDisabled || !onActionClick}
                    className="font-retro text-xs uppercase tracking-wide flex items-center justify-center gap-2 w-full h-12"
                    data-testid={actionTestId ?? `button-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {actionChecked && <Check className="w-4 h-4" />}
                    {actionLabel}
                  </Button>
                )}

                {secondaryActionLabel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSecondaryActionClick}
                    disabled={!onSecondaryActionClick}
                    className="font-retro text-xs uppercase tracking-wide flex items-center justify-center gap-2 w-full h-12"
                    data-testid={secondaryActionTestId ?? `button-secondary-action-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {secondaryActionLabel}
                  </Button>
                )}
              </div>
            )}

            {videoId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleWatchOnYouTube}
                className="font-retro text-xs uppercase tracking-wide flex items-center gap-2 w-full h-12"
                data-testid={`button-watch-youtube-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <ExternalLink className="w-4 h-4" />
                Watch on YouTube
              </Button>
            )}
          </div>
        )}
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </Card>
  );
}
