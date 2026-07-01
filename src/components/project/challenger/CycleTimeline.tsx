import {
  Sparkles,
  MessageSquareWarning,
  ListChecks,
  RefreshCw,
  FileCheck2,
  Check,
  Loader2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StepState = "done" | "active" | "pending";

interface Props {
  cycle: number;
  hasChallenger: boolean;
  totalConcerns: number;
  decidedCount: number;
  acceptedCount: number;
  modifiedCount: number;
  rejectedCount: number;
  refining?: boolean;
  primaryCreatedAt?: string | null;
  primaryTitle?: string | null;
  primaryVersion?: number;
  challengerCreatedAt?: string | null;
  lastDecisionAt?: string | null;
  refinedCreatedAt?: string | null;
  refinedTitle?: string | null;
  refinedVersion?: number;
  refinedCycle?: number;
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface StepDef {
  id: string;
  num: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  state: StepState;
  badge?: string; // tiny number/version badge on the circle
  tooltip: React.ReactNode;
}

export default function CycleTimeline(props: Props) {
  const {
    cycle,
    hasChallenger,
    totalConcerns,
    decidedCount,
    acceptedCount,
    modifiedCount,
    rejectedCount,
    refining,
    primaryCreatedAt,
    primaryTitle,
    primaryVersion,
    challengerCreatedAt,
    lastDecisionAt,
    refinedCreatedAt,
    refinedTitle,
    refinedVersion,
    refinedCycle,
  } = props;

  const allDecided = totalConcerns > 0 && decidedCount === totalConcerns;
  const refined = (refinedCycle ?? cycle) >= 2;
  const willRefine = acceptedCount + modifiedCount > 0;
  // "Cycle complete" = user has decided every concern AND chose not to keep
  // any material problem (everything dismissed, or no concerns at all). In
  // that case the rerun + new-version steps are not required — show them as
  // "skipped/done" so nothing nudges the user toward a forced 2nd cycle.
  const cycleComplete = hasChallenger && allDecided && !willRefine;

  const step1State: StepState = primaryCreatedAt ? "done" : "active";
  const step2State: StepState = hasChallenger ? "done" : primaryCreatedAt ? "active" : "pending";
  const step3State: StepState = !hasChallenger ? "pending" : allDecided ? "done" : "active";
  const step4State: StepState = refined
    ? "done"
    : refining
      ? "active"
      : cycleComplete
        ? "done"
        : allDecided && willRefine && cycle < 2
          ? "active"
          : "pending";
  const step5State: StepState = refined
    ? "done"
    : refining
      ? "active"
      : cycleComplete
        ? "done"
        : "pending";

  const steps: StepDef[] = [
    {
      id: "v1",
      num: 1,
      label: "Draft",
      icon: Sparkles,
      state: step1State,
      badge: primaryCreatedAt ? `v${primaryVersion ?? 1}` : undefined,
      tooltip: primaryCreatedAt ? (
        <>
          <div className="font-semibold mb-0.5">Draft created</div>
          <div className="opacity-80">
            {primaryTitle} · v{primaryVersion ?? 1}
          </div>
          <div className="opacity-60 text-[10px] mt-0.5">{relTime(primaryCreatedAt)}</div>
        </>
      ) : (
        "Run the agent to create the first draft"
      ),
    },
    {
      id: "review",
      num: 2,
      label: "Concerns",
      icon: MessageSquareWarning,
      state: step2State,
      badge: hasChallenger ? String(totalConcerns) : undefined,
      tooltip: hasChallenger ? (
        <>
          <div className="font-semibold mb-0.5">
            {totalConcerns} concern{totalConcerns === 1 ? "" : "s"} raised
          </div>
          <div className="opacity-60 text-[10px]">{relTime(challengerCreatedAt)}</div>
        </>
      ) : (
        "Reviewer hasn't run yet"
      ),
    },
    {
      id: "decisions",
      num: 3,
      label: "Decide",
      icon: ListChecks,
      state: step3State,
      badge: hasChallenger ? `${decidedCount}/${totalConcerns}` : undefined,
      tooltip: hasChallenger ? (
        <>
          <div className="font-semibold mb-1">
            {decidedCount} of {totalConcerns} decided
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <div className="text-success font-bold tabular-nums text-sm">{acceptedCount}</div>
              <div className="opacity-70">kept</div>
            </div>
            <div>
              <div className="text-primary font-bold tabular-nums text-sm">{modifiedCount}</div>
              <div className="opacity-70">revised</div>
            </div>
            <div>
              <div className="opacity-90 font-bold tabular-nums text-sm">{rejectedCount}</div>
              <div className="opacity-70">dismissed</div>
            </div>
          </div>
          {lastDecisionAt && (
            <div className="opacity-60 text-[10px] mt-1">Last: {relTime(lastDecisionAt)}</div>
          )}
        </>
      ) : (
        "Waiting for concerns"
      ),
    },
    {
      id: "refine",
      num: 4,
      label: refining ? "Rerunning" : cycleComplete && !refined ? "Skipped" : "Rerun",
      icon: refining ? Loader2 : RefreshCw,
      state: step4State,
      tooltip: refined
        ? "Rerun complete"
        : refining
          ? "Generator is rerunning with your feedback…"
          : cycleComplete
            ? "No material problems remain — rerun not needed"
            : willRefine && allDecided
              ? "Press Refine recommendation below"
              : cycle >= 2
                ? "Cycle limit reached"
                : "Decide every concern first",
    },
    {
      id: "refined",
      num: 5,
      label: cycleComplete && !refined ? "Locked-in" : "New version",
      icon: FileCheck2,
      state: step5State,
      badge: refined ? `v${refinedVersion ?? 2}` : cycleComplete && !refined ? "v1" : undefined,
      tooltip: refined ? (
        <>
          <div className="font-semibold mb-0.5">New version ready</div>
          <div className="opacity-80">
            {refinedTitle ?? primaryTitle} · v{refinedVersion ?? 2}
          </div>
          <div className="opacity-60 text-[10px] mt-0.5">{relTime(refinedCreatedAt)}</div>
        </>
      ) : cycleComplete ? (
        "Original draft kept — ready to lock"
      ) : (
        "Appears here after rerun"
      ),
    },
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const progressPct = (doneCount / (steps.length - 1)) * 100;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="border-b bg-card px-4 pt-3 pb-4">
        {/* tiny header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
            {cycleComplete && !refined
              ? "Cycle complete · ready to lock"
              : refined
                ? `Refined · cycle ${refinedCycle ?? cycle}`
                : `Cycle ${cycle}`}
          </span>
          <span className="text-[10.5px] tabular-nums text-muted-foreground">
            {doneCount}/{steps.length}
          </span>
        </div>

        {/* timeline */}
        <div className="relative px-4">
          {/* connector track */}
          <div className="absolute left-4 right-4 top-5 h-0.5 bg-muted rounded-full" />
          {/* progress fill */}
          <div
            className="absolute left-4 top-5 h-0.5 bg-success rounded-full transition-all duration-500"
            style={{ width: `calc((100% - 2rem) * ${progressPct} / 100)` }}
          />

          <ol className="relative grid grid-cols-5 gap-1">
            {steps.map((s) => {
              const Icon = s.icon;
              const isDone = s.state === "done";
              const isActive = s.state === "active";
              return (
                <li key={s.id} className="flex flex-col items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40",
                          isDone &&
                            "bg-success text-success-foreground border-success shadow-sm hover:scale-105",
                          isActive &&
                            "bg-primary text-primary-foreground border-primary shadow-md hover:scale-105 ring-4 ring-primary/15",
                          !isDone &&
                            !isActive &&
                            "bg-background text-muted-foreground border-border hover:border-foreground/30",
                        )}
                        aria-label={s.label}
                      >
                        {isDone ? (
                          <Check className="h-5 w-5" strokeWidth={3} />
                        ) : isActive && s.id === "refine" && refining ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                        {/* number/version chip */}
                        {s.badge && (
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full border-2 border-card text-[9.5px] font-extrabold tabular-nums flex items-center justify-center shadow-sm",
                              isDone && "bg-success text-success-foreground",
                              isActive && "bg-primary text-primary-foreground",
                              !isDone && !isActive && "bg-muted text-foreground",
                            )}
                          >
                            {s.badge}
                          </span>
                        )}
                        {/* pulsing ring on active */}
                        {isActive && (
                          <span className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping pointer-events-none" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-[11px]">
                      {s.tooltip}
                    </TooltipContent>
                  </Tooltip>
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold leading-tight text-center",
                      isDone && "text-success",
                      isActive && "text-primary",
                      !isDone && !isActive && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </TooltipProvider>
  );
}
