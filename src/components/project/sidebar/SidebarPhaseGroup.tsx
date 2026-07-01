import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Stage, PhaseGroup, AccentColors } from "./sidebarConstants";
import SidebarStageItem from "./SidebarStageItem";

interface Props {
  group: PhaseGroup;
  colors: AccentColors;
  stages: Stage[];
  currentStage: number;
  completedStages: number;
  isActiveGroup: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onStageClick: (id: number) => void;
}

export default function SidebarPhaseGroup({
  group,
  colors,
  stages,
  currentStage,
  completedStages,
  isActiveGroup,
  isCollapsed,
  onToggle,
  onStageClick,
}: Props) {
  const groupStages = stages.filter((s) => s.id >= group.range[0] && s.id <= group.range[1]);
  const groupCompleted = groupStages.filter((s) => s.id <= completedStages).length;
  const allDone = groupCompleted === groupStages.length;

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
          isActiveGroup
            ? `${colors.phaseBg} ring-1 ${colors.phaseRing}`
            : "hover:bg-sidebar-accent/50",
        )}
      >
        <div className="flex-shrink-0">
          {allDone ? (
            <CheckCircle2 className={cn("h-4 w-4", colors.label)} />
          ) : (
            <div className="relative h-4 w-4 flex items-center justify-center">
              <svg className="h-4 w-4 -rotate-90" viewBox="0 0 16 16">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-sidebar-foreground/10"
                />
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={colors.label}
                  strokeDasharray={`${(groupCompleted / groupStages.length) * 37.7} 37.7`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <p
            className={cn(
              "text-[10px] uppercase tracking-widest font-bold leading-tight whitespace-pre-line",
              isActiveGroup ? colors.label : "text-sidebar-foreground/50",
            )}
          >
            {group.label}
          </p>
        </div>

        <span className="text-[9px] font-mono text-sidebar-foreground/30 flex-shrink-0">
          {groupCompleted}/{groupStages.length}
        </span>

        <ChevronRight
          className={cn(
            "h-3 w-3 text-sidebar-foreground/25 transition-transform duration-200 flex-shrink-0",
            !isCollapsed && "rotate-90",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-1 border-l border-sidebar-border/40 pl-0">
              {groupStages.map((stage) => (
                <SidebarStageItem
                  key={stage.id}
                  stage={stage}
                  isCurrent={stage.id === currentStage}
                  isCompleted={stage.id <= completedStages}
                  colors={colors}
                  onStageClick={onStageClick}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
