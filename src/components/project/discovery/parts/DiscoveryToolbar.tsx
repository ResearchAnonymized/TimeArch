import { cn } from "@/lib/utils";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { BrownfieldMode } from "./ModeToggle";

const STEP_TITLE: Record<1 | 2 | 3, string> = {
  1: "Import",
  2: "Recover",
  3: "Change",
};

interface Props {
  step: 1 | 2 | 3;
  hasImports: boolean;
  onRestart: () => void;
  onPersist: () => void;
  /** Compact bar when left rail owns Import/Recover/Change */
  compact?: boolean;
  mode?: BrownfieldMode;
  onModeChange?: (mode: BrownfieldMode) => void;
  modeDisabled?: boolean;
}

export default function DiscoveryToolbar({
  step,
  hasImports,
  onRestart,
  onPersist,
  compact,
  mode,
  onModeChange,
  modeDisabled,
}: Props) {
  const isLive = mode === "live";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {STEP_TITLE[step]}
        </h2>
        {!compact && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Brownfield · Step {step}/3
            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {mode && onModeChange && (
          <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
            {(["demo", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={modeDisabled}
                onClick={() => onModeChange(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  modeDisabled && "opacity-50 cursor-not-allowed",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {hasImports && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestart}
            className="h-8 px-2 text-xs"
            title="Restart from Import"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            onPersist();
            toast.success("Progress saved");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
