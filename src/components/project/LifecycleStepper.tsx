import { CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Stage {
  id: number;
  label: string;
  icon: LucideIcon;
  short: string;
}

interface Props {
  stages: Stage[];
  currentStage: number;
  completedStages: number;
  onStageClick: (id: number) => void;
}

const PHASE_GROUPS = [
  { label: "Requirement Definition", range: [1, 3] as const, accent: "primary" },
  { label: "Architecture Design", range: [4, 10] as const, accent: "violet" },
  { label: "Validation & Assurance", range: [11, 14] as const, accent: "amber" },
  { label: "Delivery & Evolution", range: [15, 18] as const, accent: "emerald" },
];

const ACCENT_MAP: Record<
  string,
  {
    activeBg: string;
    activeText: string;
    doneBg: string;
    doneText: string;
    pillBg: string;
    pillText: string;
    bar: string;
  }
> = {
  primary: {
    activeBg: "bg-primary/10",
    activeText: "text-primary",
    doneBg: "bg-primary/8",
    doneText: "text-primary",
    pillBg: "bg-primary",
    pillText: "text-primary-foreground",
    bar: "bg-primary",
  },
  violet: {
    activeBg: "bg-violet-500/10",
    activeText: "text-violet-600 dark:text-violet-400",
    doneBg: "bg-violet-500/8",
    doneText: "text-violet-600 dark:text-violet-400",
    pillBg: "bg-violet-500",
    pillText: "text-white",
    bar: "bg-violet-500",
  },
  amber: {
    activeBg: "bg-amber-500/10",
    activeText: "text-amber-600 dark:text-amber-400",
    doneBg: "bg-amber-500/8",
    doneText: "text-amber-600 dark:text-amber-400",
    pillBg: "bg-amber-500",
    pillText: "text-white",
    bar: "bg-amber-500",
  },
  emerald: {
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-600 dark:text-emerald-400",
    doneBg: "bg-emerald-500/8",
    doneText: "text-emerald-600 dark:text-emerald-400",
    pillBg: "bg-emerald-500",
    pillText: "text-white",
    bar: "bg-emerald-500",
  },
};

export default function LifecycleStepper({
  stages,
  currentStage,
  completedStages,
  onStageClick,
}: Props) {
  const activeGroupIdx = PHASE_GROUPS.findIndex(
    (g) => currentStage >= g.range[0] && currentStage <= g.range[1],
  );
  const [expandedGroup, setExpandedGroup] = useState<number | null>(
    activeGroupIdx >= 0 ? activeGroupIdx : 0,
  );

  const totalCompleted = completedStages;
  const progressPct = Math.round((totalCompleted / stages.length) * 100);

  return (
    <div className="border-b bg-card/80 backdrop-blur-sm flex-shrink-0">
      {/* Thin progress bar */}
      <div className="h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-4 py-2.5">
        {/* Phase navigation row */}
        <div className="flex items-center gap-2">
          {PHASE_GROUPS.map((group, gi) => {
            const colors = ACCENT_MAP[group.accent];
            const groupStages = stages.filter(
              (s) => s.id >= group.range[0] && s.id <= group.range[1],
            );
            const groupCompleted = groupStages.filter((s) => s.id <= completedStages).length;
            const groupTotal = groupStages.length;
            const isActive = currentStage >= group.range[0] && currentStage <= group.range[1];
            const isExpanded = expandedGroup === gi;
            const allDone = groupCompleted === groupTotal;

            // Phase connector line
            const prevDone =
              gi > 0 &&
              PHASE_GROUPS.slice(0, gi).every((pg) => {
                const pStages = stages.filter((s) => s.id >= pg.range[0] && s.id <= pg.range[1]);
                return pStages.every((s) => s.id <= completedStages);
              });

            return (
              <div key={gi} className="flex items-center gap-2">
                {gi > 0 && (
                  <div
                    className={cn("w-6 h-px", prevDone || isActive ? "bg-border" : "bg-border/40")}
                  />
                )}

                <div className="flex flex-col items-start">
                  {/* Phase header */}
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : gi)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all group",
                      isActive
                        ? `${colors.activeBg} ${colors.activeText}`
                        : allDone
                          ? `${colors.doneBg} ${colors.doneText}`
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    {/* Phase progress ring */}
                    <div className="relative h-5 w-5 flex items-center justify-center">
                      {allDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <>
                          <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="opacity-15"
                            />
                            <circle
                              cx="10"
                              cy="10"
                              r="8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeDasharray={`${(groupCompleted / groupTotal) * 50.26} 50.26`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute text-[7px] font-mono font-bold">
                            {groupCompleted}
                          </span>
                        </>
                      )}
                    </div>

                    <span className="font-display tracking-wide">{group.label}</span>

                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200 opacity-50",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  {/* Expanded stage pills */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-1 mt-1.5 ml-1 overflow-hidden"
                      >
                        {groupStages.map((stage) => {
                          const isCompleted = stage.id <= completedStages;
                          const isCurrent = stage.id === currentStage;
                          const StageIcon = stage.icon;

                          return (
                            <Tooltip key={stage.id}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onStageClick(stage.id)}
                                  className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
                                    isCurrent
                                      ? `${colors.pillBg} ${colors.pillText} shadow-sm`
                                      : isCompleted
                                        ? `${colors.doneBg} ${colors.doneText}`
                                        : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted",
                                  )}
                                >
                                  {isCompleted && !isCurrent ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <StageIcon className="h-3 w-3" />
                                  )}
                                  <span className="hidden sm:inline">{stage.label}</span>
                                  <span className="sm:hidden">{stage.short}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                <p className="font-display font-semibold">{stage.label}</p>
                                <p className="text-muted-foreground">
                                  Stage {stage.id} of 18 · {group.label} phase
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}

          {/* Overall progress */}
          <div className="ml-auto flex items-center gap-2 pl-4 border-l">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground leading-none">Progress</p>
              <p className="text-sm font-display font-bold leading-tight">{progressPct}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
