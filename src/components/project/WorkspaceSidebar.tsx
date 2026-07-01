import { useState } from "react";
import { Zap, ArrowLeft, Bot, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import {
  PHASE_GROUPS,
  BROWNFIELD_DISCOVERY_GROUP,
  ACCENT_COLORS,
} from "./sidebar/sidebarConstants";
import type { Stage } from "./sidebar/sidebarConstants";
import SidebarPhaseGroup from "./sidebar/SidebarPhaseGroup";

interface Props {
  stages: Stage[];
  currentStage: number;
  completedStages: number;
  onStageClick: (id: number) => void;
  projectName: string;
}

export default function WorkspaceSidebar({
  stages,
  currentStage,
  completedStages,
  onStageClick,
  projectName,
}: Props) {
  const navigate = useNavigate();
  // Derive phase groups from the stages list — stage 0 means brownfield mode.
  const phaseGroups = stages.some((s) => s.id === 0)
    ? [BROWNFIELD_DISCOVERY_GROUP, ...PHASE_GROUPS]
    : PHASE_GROUPS;
  const activeGroupIdx = phaseGroups.findIndex(
    (g) => currentStage >= g.range[0] && currentStage <= g.range[1],
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = (idx: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const progressPct = Math.round((completedStages / stages.length) * 100);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
          >
            <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
          </button>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
              TimeArch
            </p>
            <p className="text-sm font-display font-bold text-sidebar-foreground truncate">
              {projectName}
            </p>
          </div>
        </div>

        <div className="mt-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold">
              Progress
            </span>
            <span className="text-xs font-mono font-bold text-sidebar-foreground/70">
              {progressPct}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-sidebar-accent overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-sidebar-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-sidebar-foreground/30 mt-1">
            {completedStages} of {stages.length} stages completed
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 space-y-3 overflow-y-auto">
        {phaseGroups.map((group, gi) => (
          <SidebarPhaseGroup
            key={gi}
            group={group}
            colors={ACCENT_COLORS[group.accent]}
            stages={stages}
            currentStage={currentStage}
            completedStages={completedStages}
            isActiveGroup={gi === activeGroupIdx}
            isCollapsed={collapsedGroups.has(gi)}
            onToggle={() => toggleGroup(gi)}
            onStageClick={onStageClick}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden space-y-2">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex items-center gap-1">
            <Bot className="h-3 w-3 text-violet-400/60" />
            <span className="text-[9px] text-sidebar-foreground/40">AI</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-blue-400/60" />
            <span className="text-[9px] text-sidebar-foreground/40">Human</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-amber-400/60" />
            <span className="text-[9px] text-sidebar-foreground/40">Both</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors w-full px-2 py-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
