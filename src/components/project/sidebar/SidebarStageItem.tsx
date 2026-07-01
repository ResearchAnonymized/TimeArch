import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { Stage, AccentColors } from "./sidebarConstants";
import { STAGE_RESPONSIBILITY, RESPONSIBILITY_STYLES } from "./sidebarConstants";

interface Props {
  stage: Stage;
  isCurrent: boolean;
  isCompleted: boolean;
  colors: AccentColors;
  onStageClick: (id: number) => void;
}

export default function SidebarStageItem({
  stage,
  isCurrent,
  isCompleted,
  colors,
  onStageClick,
}: Props) {
  const StageIcon = stage.icon;
  const resp = STAGE_RESPONSIBILITY[stage.id];
  const respStyle = resp ? RESPONSIBILITY_STYLES[resp.type] : null;

  return (
    <button
      onClick={() => onStageClick(stage.id)}
      className={cn(
        "w-full flex items-center gap-2.5 pl-3 pr-2 py-[7px] text-left transition-all relative group/item",
        isCurrent
          ? `${colors.activeBg} ${colors.activeText} font-semibold border-l-2 ${colors.activeBorder} -ml-px`
          : isCompleted
            ? "text-sidebar-foreground/55 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
            : "text-sidebar-foreground/35 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent/30",
      )}
    >
      {isCompleted && !isCurrent ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70 flex-shrink-0" />
      ) : isCurrent ? (
        <span className="relative flex-shrink-0 h-3.5 w-3.5">
          <StageIcon className={cn("h-3.5 w-3.5", colors.activeText)} />
          <motion.span
            className={cn("absolute -inset-1 rounded-full", colors.activeBg)}
            animate={{ opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          />
        </span>
      ) : (
        <StageIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
      )}

      <span className="truncate text-[12.5px] flex-1">{stage.label}</span>

      {resp &&
        respStyle &&
        (() => {
          const RespIcon = respStyle.icon;
          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <RespIcon className={cn("h-3 w-3 flex-shrink-0", respStyle.className)} />
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {resp.label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}

      <span
        className={cn(
          "text-[9px] font-mono flex-shrink-0 tabular-nums",
          isCurrent ? "opacity-50" : "text-sidebar-foreground/20",
        )}
      >
        {String(stage.id).padStart(2, "0")}
      </span>
    </button>
  );
}
