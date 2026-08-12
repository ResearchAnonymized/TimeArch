import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Settings2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRunStage } from "@/hooks/useRunStage";
import GovernancePane from "@/components/project/GovernancePane";
import StageRail from "./StageRail";
import BrownfieldStageRail from "./BrownfieldStageRail";
import RequirementsMain from "./RequirementsMain";
import StageHeader from "./StageHeader";
import ThemeToggle from "@/components/ThemeToggle";

import { getStage, type ProjectMode } from "@/components/studio/stage-registry";
import StageToolPane from "./StageToolPane";
import { StageShellProvider } from "@/components/studio/StageShellContext";
import { useDiscoveryStep } from "@/features/discovery/hooks";
import {
  computeDiscoveryCaseProgress,
  loadDiscoveryProgress,
  type DiscoveryCaseProgress,
} from "@/lib/discoveryCase";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  mode?: string;
  [key: string]: unknown;
}

interface Props {
  project: Project;
  onProjectChange: (p: Project) => void;
}

export default function InboxWorkspace({ project, onProjectChange }: Props) {
  const nav = useNavigate();
  const projectMode: ProjectMode =
    project.mode === "brownfield" ? "brownfield" : project.mode === "hybrid" ? "hybrid" : "greenfield";
  // Brownfield/hybrid projects start at stage 0 (Discovery). Greenfield projects
  // have no stage 0, so clamp to ≥1.
  const minStage = projectMode === "greenfield" ? 1 : 0;
  const [currentStage, setCurrentStage] = useState(
    Math.max(minStage, project.current_stage ?? minStage),
  );
  const [lockedStages, setLockedStages] = useState<Set<number>>(new Set());
  const [advancing, setAdvancing] = useState(false);
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { step: discoveryStep, setStep: setDiscoveryStep } = useDiscoveryStep(project.id);
  const [discoveryFlags, setDiscoveryFlags] = useState({ hasImports: false, hasParsed: false });
  const [caseProgress, setCaseProgress] = useState<DiscoveryCaseProgress | null>(null);
  const useBrownfieldNav = projectMode === "brownfield" || projectMode === "hybrid";

  useEffect(() => {
    if (!useBrownfieldNav) return;
    let cancelled = false;
    void loadDiscoveryProgress(project.id).then((p) => {
      if (!cancelled) setCaseProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, project.status, useBrownfieldNav, discoveryFlags, refreshKey]);

  // Optimistic progress from live discovery flags while artifact query catches up
  const liveProgress =
    useBrownfieldNav
      ? computeDiscoveryCaseProgress({
          hasImports: discoveryFlags.hasImports || !!caseProgress?.hasImports,
          hasRecovered: discoveryFlags.hasParsed || !!caseProgress?.hasRecovered,
          hasPackage: !!caseProgress?.hasPackage,
          packageStatus: caseProgress?.packageStatus,
          projectStatus: project.status,
          closedAt: caseProgress?.closedAt,
        })
      : null;

  const fetchLocks = useCallback(async () => {
    const { data } = await supabase
      .from("stage_approvals")
      .select("stage")
      .eq("project_id", project.id)
      .eq("action", "locked");
    setLockedStages(new Set((data || []).map((a) => a.stage)));
  }, [project.id]);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks, refreshKey]);

  const handleRunComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
    fetchLocks();
  }, [fetchLocks]);

  const { runStage, running, isManualStage } = useRunStage(
    project.id,
    currentStage,
    handleRunComplete,
  );

  async function advanceStage(target: number) {
    setAdvancing(true);
    const { error } = await supabase
      .from("projects")
      .update({ current_stage: target, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    setAdvancing(false);
    if (error) {
      toast.error(`Couldn't advance: ${error.message}`);
      return;
    }
    onProjectChange({ ...project, current_stage: target });
    setCurrentStage(target);
    toast.success(`Moved to stage ${target}`);
  }

  const stage = getStage(currentStage);
  const isLocked = lockedStages.has(currentStage);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Left rail — brownfield: Import/Recover/Change; else full lifecycle */}
      {useBrownfieldNav ? (
        <BrownfieldStageRail
          discoveryStep={discoveryStep}
          onDiscoveryStep={setDiscoveryStep}
          hasImports={discoveryFlags.hasImports}
          hasParsed={discoveryFlags.hasParsed}
          currentStage={currentStage}
          lockedStages={lockedStages}
          onSelectStage={setCurrentStage}
          projectMode={projectMode}
        />
      ) : (
        <StageRail
          currentStage={currentStage}
          lockedStages={lockedStages}
          onSelect={setCurrentStage}
          projectMode={projectMode}
        />
      )}

      {/* Center: header + main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b bg-card/60 backdrop-blur flex items-center px-4 gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => nav("/studio/dashboard")}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Dashboard</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="font-medium text-foreground truncate max-w-[220px]" title={project.name}>
              {project.name}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-muted-foreground truncate">
              {stage.n === 0
                ? `Discovery · ${stage.title}`
                : `Stage ${String(stage.n).padStart(2, "0")} · ${stage.title}`}
            </span>
            {projectMode !== "greenfield" && (
              <span
                className={`ml-1 hidden sm:inline text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  projectMode === "brownfield"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                }`}
              >
                {projectMode}
              </span>
            )}
            {liveProgress && (
              <span
                className={cn(
                  "ml-1 hidden md:inline text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  liveProgress.phase === "closed"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-primary/25 bg-primary/5 text-primary",
                )}
                title={liveProgress.detail}
              >
                {liveProgress.completed}/{liveProgress.total} · {liveProgress.label}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Sheet open={governanceOpen} onOpenChange={setGovernanceOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Governance
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-96 p-0 overflow-y-auto">
                <GovernancePane
                  currentStage={currentStage}
                  completedStages={lockedStages.size}
                  projectId={project.id}
                  projectName={project.name}
                  onStageRunComplete={handleRunComplete}
                />
              </SheetContent>
            </Sheet>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          {currentStage === 0 ? (
            <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5">
              <StageShellProvider compact>
                <StageToolPane
                  projectId={project.id}
                  currentStage={0}
                  projectName={project.name}
                  projectDescription={project.description}
                  advancing={advancing}
                  onAdvance={(n) => advanceStage(n)}
                  discoveryStep={discoveryStep}
                  onDiscoveryStep={setDiscoveryStep}
                  onDiscoveryProgress={setDiscoveryFlags}
                  hideInlineStepRail={useBrownfieldNav}
                />
              </StageShellProvider>
            </div>
          ) : (
            <>
              <StageHeader
                projectId={project.id}
                currentStage={currentStage}
                refreshKey={refreshKey}
                onRun={isManualStage ? undefined : () => runStage()}
                running={running}
                onAdvance={() => advanceStage(currentStage + 1)}
                advancing={advancing}
                isLocked={isLocked}
              />
              <div className="flex-1 min-w-0 overflow-hidden">
                <RequirementsMain
                  projectId={project.id}
                  refreshKey={refreshKey}
                  currentStage={currentStage}
                  projectName={project.name}
                  projectDescription={project.description}
                  advancing={advancing}
                  onAdvance={(n) => advanceStage(n)}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

