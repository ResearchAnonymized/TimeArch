import { Play, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PollProgress } from "@/hooks/useRunStage";

interface RunStageCTAProps {
  stageLabel?: string;
  onRun?: () => void;
  running?: boolean;
  isManualStage?: boolean;
  className?: string;
  polling?: boolean;
  onCancel?: () => void;
  progress?: PollProgress;
}

const STATUS_LABEL: Record<NonNullable<PollProgress["status"]>, string> = {
  pending: "Queued",
  running: "Running",
  waiting: "Checking…",
  idle: "",
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

/**
 * Inline call-to-action button for workspace empty states.
 * Shows live polling progress (status, attempts, ETA) when the agent is being
 * monitored via the exponential-backoff loop, plus a Cancel button.
 */
export default function RunStageCTA({
  stageLabel,
  onRun,
  running,
  isManualStage,
  className,
  polling,
  onCancel,
  progress,
}: RunStageCTAProps) {
  if (isManualStage) {
    return (
      <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto">
        This stage requires manual input. Add your data above to proceed.
      </p>
    );
  }

  // Progress bar value: how close we are to the next poll (0 → 100).
  const intervalMs = progress?.intervalMs ?? 0;
  const nextPollInMs = progress?.nextPollInMs ?? 0;
  const tickPct =
    intervalMs > 0
      ? Math.max(0, Math.min(100, ((intervalMs - nextPollInMs) / intervalMs) * 100))
      : 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2 mt-2">
        <Button onClick={() => onRun?.()} disabled={running || !onRun} size="sm" className="gap-2">
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {polling ? "Monitoring…" : "Running Agent…"}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run {stageLabel ? stageLabel : "Stage"}
            </>
          )}
        </Button>
        {polling && onCancel && (
          <Button onClick={onCancel} size="sm" variant="outline" className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
      </div>

      {polling && progress && progress.status !== "idle" && (
        <div className="mt-3 mx-auto max-w-sm rounded-md border border-border/60 bg-muted/30 p-3 text-left">
          <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {STATUS_LABEL[progress.status]}
              {progress.agentName ? ` · ${progress.agentName}` : ""}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatDuration(progress.elapsedMs)} elapsed
            </span>
          </div>
          <Progress value={tickPct} className="h-1 mt-2" />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>Attempt #{progress.attempts}</span>
            <span>
              {progress.status === "waiting"
                ? "Checking now"
                : `Next check in ${Math.ceil(nextPollInMs / 1000)}s`}
            </span>
          </div>
        </div>
      )}

      {!onRun && !polling && (
        <p className="text-[10px] text-muted-foreground/50 mt-1.5">Or use the Governance panel →</p>
      )}
    </div>
  );
}
