/**
 * Standardized "Run agent" control used across every Studio stage.
 *
 * Consolidates what used to be re-implemented per-stage:
 *   - Sparkles idle icon / Loader2 spinner while running or polling.
 *   - Label toggles between "Run agent" and "Re-run agent" based on
 *     whether an artifact already exists.
 *   - When disabled, a tooltip explains *why* (previously silent).
 *
 * Two modes:
 *   1. Stage mode — pass `stage` + `projectId`; internally uses
 *      `useRunStage` and calls `onDone` on completion.
 *   2. Custom mode — pass `onRun` for stages whose "run" isn't a
 *      standard `run-agent` invocation (e.g. Stage 5's classifier).
 */

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRunStage } from "@/hooks/useRunStage";

type BaseProps = {
  /** True when at least one artifact/version already exists — toggles label. */
  hasArtifact?: boolean;
  /** If set, the button is disabled and the reason is shown in a tooltip. */
  disabledReason?: string;
  /** Idle label; falls back to "Run agent" / "Re-run agent". */
  idleLabel?: string;
  rerunLabel?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
};

type StageModeProps = BaseProps & {
  projectId: string;
  stage: number;
  onDone?: () => void;
  onRun?: never;
  running?: never;
};

type CustomModeProps = BaseProps & {
  /** Custom async handler for stages that don't use `useRunStage`. */
  onRun: () => void | Promise<void>;
  /** External running state for custom-mode buttons. */
  running?: boolean;
  projectId?: never;
  stage?: never;
  onDone?: never;
};

type Props = StageModeProps | CustomModeProps;

export default function RunAgentButton(props: Props) {
  const {
    hasArtifact = false,
    disabledReason,
    idleLabel,
    rerunLabel,
    size = "sm",
    variant = "outline",
    className,
  } = props;

  // Stage mode: wire up the shared hook. Always call the hook (rules of hooks);
  // pass safe defaults when in custom mode.
  const isStageMode = "stage" in props && typeof props.stage === "number";
  const hookProjectId = isStageMode ? (props as StageModeProps).projectId : "";
  const hookStage = isStageMode ? (props as StageModeProps).stage : 0;
  const hookOnDone = isStageMode ? (props as StageModeProps).onDone : undefined;
  const { runStage, running: hookRunning, polling } = useRunStage(hookProjectId, hookStage, hookOnDone);

  const externalRunning = !isStageMode ? !!(props as CustomModeProps).running : false;
  const busy = isStageMode ? hookRunning || polling : externalRunning;
  const disabled = busy || !!disabledReason;

  const label =
    (hasArtifact ? rerunLabel : idleLabel) ?? (hasArtifact ? "Re-run agent" : "Run agent");

  const handleClick = () => {
    if (disabled) return;
    if (isStageMode) {
      runStage();
    } else {
      void (props as CustomModeProps).onRun();
    }
  };

  const button = (
    <Button
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={disabled}
      className={className}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  );

  if (!disabledReason) return button;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        {/* Wrap in span so tooltip fires even when the button is disabled. */}
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
