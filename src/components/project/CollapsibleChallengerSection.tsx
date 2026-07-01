import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Swords,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  RotateCcw,
  Cloud,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChallengerDecisions } from "@/hooks/useChallengerDecisions";
import { useChallengerLayoutPref } from "@/hooks/useChallengerLayoutPref";
import { useAuth } from "@/contexts/AuthContext";
import ChallengerReviewPanel from "./ChallengerReviewPanel";
import ChallengerContextTracePanel from "./ChallengerContextTracePanel";
import ChallengerSummaryPanel from "./ChallengerSummaryPanel";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
  /** Override default collapsed state. */
  defaultCollapsed?: boolean;
}

/**
 * Collapsible wrapper around ChallengerReviewPanel.
 *
 * Layout preference resolution order:
 *   1. Saved user choice (local + optional cross-device sync per stage)
 *   2. Computed default: expand only when there is open challenger work
 *
 * Users can clear their saved choice ("Reset Challenger layout") and opt in
 * to syncing the choice to their account so it follows them across devices.
 */
export default function CollapsibleChallengerSection({
  projectId,
  stage,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
  defaultCollapsed,
}: Props) {
  const { user } = useAuth();
  const {
    loading,
    concerns,
    reviewMeta,
    decidedCount,
    acceptedCount,
    allDecided,
    primaryArtifactId,
  } = useChallengerDecisions(projectId, stage, refreshKey);

  const total = concerns.length;
  const remaining = total - decidedCount;
  const hasRunBefore = !!reviewMeta;
  const hasOpenWork = total > 0 && !allDecided;

  const { storedOpen, syncEnabled, setOpenPreference, resetPreference, setSyncEnabled } =
    useChallengerLayoutPref(projectId, stage);

  // Default: collapsed unless there is open challenger work in progress.
  const computedDefault = defaultCollapsed ?? !hasOpenWork;
  const [open, setOpen] = useState<boolean>(storedOpen !== null ? storedOpen : computedDefault);

  // Sync local UI state with stored preference / computed default.
  useEffect(() => {
    setOpen(storedOpen !== null ? storedOpen : !hasOpenWork);
  }, [storedOpen, hasOpenWork]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card px-4 py-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
        <Swords className="h-3.5 w-3.5 animate-pulse" />
        Loading Challenger review…
      </div>
    );
  }

  // Determine the summary state for the collapsed header.
  let stateLabel: string;
  let StateIcon = Swords;
  let toneClass = "border-border bg-card";
  let pillClass = "bg-muted text-muted-foreground border-border";

  if (!hasRunBefore && !primaryArtifactId) {
    stateLabel = "Challenger not available yet";
  } else if (!hasRunBefore) {
    stateLabel = "Challenger not run";
    StateIcon = Swords;
    pillClass = "bg-primary/10 text-primary border-primary/30";
  } else if (total === 0) {
    stateLabel = "No concerns raised";
    StateIcon = ShieldCheck;
    toneClass = "border-success/30 bg-success/5";
    pillClass = "bg-success/10 text-success border-success/30";
  } else if (allDecided) {
    stateLabel = `All ${total} concerns reviewed`;
    StateIcon = CheckCircle2;
    toneClass = "border-success/30 bg-success/5";
    pillClass = "bg-success/10 text-success border-success/30";
  } else {
    stateLabel = `${remaining} of ${total} concerns left to review`;
    StateIcon = AlertTriangle;
    toneClass = "border-warning/40 bg-warning/5";
    pillClass = "bg-warning/10 text-warning border-warning/30";
  }

  const toggle = () => {
    const next = !open;
    setOpen(next);
    void setOpenPreference(next);
  };

  const handleReset = async () => {
    await resetPreference();
    toast({
      title: "Challenger layout reset",
      description: "This stage now follows the default expand/collapse behavior.",
    });
  };

  const handleToggleSync = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in to sync your Challenger layout across devices.",
        variant: "destructive",
      });
      return;
    }
    const next = !syncEnabled;
    await setSyncEnabled(next);
    toast({
      title: next ? "Sync enabled" : "Sync disabled",
      description: next
        ? "Your Challenger layout will follow you across browsers and devices."
        : "Your Challenger layout is saved on this device only.",
    });
  };

  return (
    <section className={cn("rounded-lg border overflow-hidden transition-colors", toneClass)}>
      {/* Collapsible header */}
      <div className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 transition-colors">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-expanded={open}
          aria-controls={`challenger-section-${stage}`}
        >
          <div className="h-7 w-7 rounded-md bg-background/70 border flex items-center justify-center flex-shrink-0">
            <StateIcon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Challenger Architect
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                  pillClass,
                )}
              >
                {stateLabel}
              </span>
              {hasRunBefore && total > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  · {acceptedCount} kept · {decidedCount}/{total} decided
                </span>
              )}
              {syncEnabled && (
                <span
                  title="Layout synced to your account"
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                >
                  <Cloud className="h-3 w-3" />
                  Synced
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
            {open ? (
              <>
                Hide <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              aria-label="Challenger layout options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px]">
              Challenger layout (Stage {stage})
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void handleReset();
              }}
              disabled={storedOpen === null}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span>Reset Challenger layout</span>
                <span className="text-[10.5px] text-muted-foreground">
                  {storedOpen === null
                    ? "No saved choice for this stage"
                    : "Clear saved choice for this stage"}
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void handleToggleSync();
              }}
            >
              {syncEnabled ? (
                <CloudOff className="h-3.5 w-3.5" />
              ) : (
                <Cloud className="h-3.5 w-3.5" />
              )}
              <div className="flex flex-col">
                <span>{syncEnabled ? "Disable cross-device sync" : "Sync to my account"}</span>
                <span className="text-[10.5px] text-muted-foreground">
                  {syncEnabled
                    ? "Stop syncing layout across browsers"
                    : "Save layout to your profile"}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`challenger-section-${stage}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 space-y-3">
              <ChallengerSummaryPanel projectId={projectId} stage={stage} refreshKey={refreshKey} />
              <ChallengerContextTracePanel
                projectId={projectId}
                stage={stage}
                refreshKey={refreshKey}
              />
              <ChallengerReviewPanel
                projectId={projectId}
                stage={stage}
                refreshKey={refreshKey}
                onRefine={async (bundle) => {
                  await onRunStage?.({ refinement: bundle });
                }}
                onChallenge={async () => {
                  await onRunStage?.({ challenge_only: true });
                }}
                refining={stageRunning}
                challenging={stageRunning}
                onAdvance={onAdvance}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed quick action: when never run, surface the run CTA inline */}
      {!open && !hasRunBefore && primaryArtifactId && (
        <div className="border-t px-4 py-2 flex items-center gap-2 bg-background/40">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={!onRunStage || stageRunning}
            onClick={() => onRunStage?.({ challenge_only: true })}
          >
            <Swords className="h-3 w-3" />
            {stageRunning ? "Running…" : "Run Challenger"}
          </Button>
          <span className="text-[10.5px] text-muted-foreground">
            Optional second opinion · You can lock without it.
          </span>
        </div>
      )}
    </section>
  );
}
