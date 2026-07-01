import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Zap,
  FileText,
  Shield,
  Cpu,
  GitBranch,
  Database,
  Globe,
  BarChart3,
  Bug,
  ClipboardCheck,
  Eye,
  ThumbsUp,
  Code2,
  PackageCheck,
  RefreshCw,
  Settings2,
  Layers,
  Cloud,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  ChevronRight,
  Compass,
} from "lucide-react";
import {
  PHASE_GROUPS,
  ACCENT_COLORS,
  getPhaseGroupsForMode,
} from "@/components/project/sidebar/sidebarConstants";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackWidget from "@/components/FeedbackWidget";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import WorkspaceSidebar from "@/components/project/WorkspaceSidebar";
import ContextPane from "@/components/project/ContextPane";
import SynthesisPane from "@/components/project/SynthesisPane";
import GovernancePane from "@/components/project/GovernancePane";
import KeyboardShortcutsOverlay from "@/components/project/KeyboardShortcutsOverlay";
import UnlockedRequirementsBanner from "@/components/project/UnlockedRequirementsBanner";
import { DensityProvider } from "@/contexts/DensityContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRunStage } from "@/hooks/useRunStage";

const STAGE_DISCOVERY = {
  id: 0,
  label: "Discovery & Reverse Engineering",
  icon: Compass,
  short: "DSC",
};

const STAGES = [
  { id: 1, label: "Requirement Collection", icon: FileText, short: "REQ" },
  { id: 2, label: "Requirement Analysis", icon: Shield, short: "ANL" },
  { id: 3, label: "Architecture Drivers", icon: Cpu, short: "DRV" },
  { id: 4, label: "Style Recommender", icon: GitBranch, short: "STY" },
  { id: 5, label: "Tradeoff Evaluation", icon: BarChart3, short: "EVL" },
  { id: 6, label: "System Decomposition", icon: Database, short: "DEC" },
  { id: 7, label: "Data Architecture", icon: Database, short: "DAT" },
  { id: 8, label: "API & Integration", icon: Globe, short: "API" },
  { id: 9, label: "Cross-Cutting Concerns", icon: Layers, short: "CCC" },
  { id: 10, label: "Infrastructure & Deploy", icon: Cloud, short: "INF" },
  { id: 11, label: "Quality Attributes", icon: BarChart3, short: "QUA" },
  { id: 12, label: "Risk Assessment", icon: Bug, short: "RSK" },
  { id: 13, label: "Architecture Validation", icon: ClipboardCheck, short: "VAL" },
  { id: 14, label: "Documentation & ADRs", icon: Eye, short: "DOC" },
  { id: 15, label: "Stakeholder Approval", icon: ThumbsUp, short: "APR" },
  { id: 16, label: "Code Generation", icon: Code2, short: "GEN" },
  { id: 17, label: "Implementation Review", icon: PackageCheck, short: "IMP" },
  { id: 18, label: "Architecture Evolution", icon: RefreshCw, short: "EVO" },
];

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  mode?: string;
}

export default function ProjectWorkspace() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [currentStage, setCurrentStageRaw] = useState(1);
  const [completedStages, setCompletedStages] = useState(0);
  const [lockedStageSet, setLockedStageSet] = useState<Set<number>>(new Set());

  // Guard: Stage 16 (Code Generation) requires Stage 14 (Documentation & ADRs) to be locked.
  const isBrownfieldMode = project?.mode === "brownfield";
  const setCurrentStage = useCallback<typeof setCurrentStageRaw>(
    (value) => {
      setCurrentStageRaw((prev) => {
        const next = typeof value === "function" ? (value as (p: number) => number)(prev) : value;
        // Brownfield Evolution Plan (16) & Drift Detection (18) are independent of Code Generation,
        // so they don't require Stage 14 to be locked.
        const isBrownfieldOnlyView = isBrownfieldMode && (next === 16 || next === 18);
        if (next >= 16 && !isBrownfieldOnlyView && !lockedStageSet.has(14)) {
          import("sonner").then(({ toast }) =>
            toast.warning("Lock Stage 14 (Documentation & ADRs) before entering Code Generation."),
          );
          return 14;
        }
        return next;
      });
    },
    [lockedStageSet, isBrownfieldMode],
  );
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rightOpen, setRightOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [governanceOpen, setGovernanceOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const fetchProject = async () => {
    if (!projectId || !user) return;
    const [projectRes, approvalsRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("stage_approvals")
        .select("stage")
        .eq("project_id", projectId)
        .eq("action", "locked"),
    ]);
    if (projectRes.error || !projectRes.data) {
      navigate("/dashboard");
      return;
    }
    setProject(projectRes.data as ProjectData);
    const lockedStages = new Set<number>((approvalsRes.data || []).map((a) => a.stage));
    setLockedStageSet(lockedStages);
    setCompletedStages(lockedStages.size);
    // Apply guard to the persisted current_stage as well
    const persisted = projectRes.data.current_stage;
    setCurrentStageRaw(persisted >= 16 && !lockedStages.has(14) ? 14 : persisted);
    setLoading(false);
  };

  const handleStageRunComplete = useCallback(() => {
    setRefreshKey((k) => k + 1);
    fetchProject();
  }, []);

  const { runStage, running: stageRunning } = useRunStage(
    projectId || "",
    currentStage,
    handleStageRunComplete,
  );

  useEffect(() => {
    fetchProject();
  }, [projectId, user, navigate]);

  // Mode-aware stage list & phase groups (greenfield = unchanged; brownfield prepends Stage 0)
  const isBrownfield = project?.mode === "brownfield";
  const visibleStages = isBrownfield ? [STAGE_DISCOVERY, ...STAGES] : STAGES;
  const visiblePhaseGroups = getPhaseGroupsForMode(project?.mode);
  const minStage = isBrownfield ? 0 : 1;

  // Keyboard shortcuts for stage navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentStage((prev) => Math.max(minStage, prev - 1));
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentStage((prev) => Math.min(STAGES.length, prev + 1));
      } else if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCurrentStage(Number(e.key));
      } else if (e.key === "0" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCurrentStage(isBrownfield ? 0 : 10);
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setShortcutsOpen(false);
      }
    },
    [minStage, isBrownfield, setCurrentStage],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Compute current phase progress
  const currentPhase = visiblePhaseGroups.find(
    (p) => currentStage >= p.range[0] && currentStage <= p.range[1],
  );
  const phaseTotal = currentPhase ? currentPhase.range[1] - currentPhase.range[0] + 1 : 1;
  const phaseCompleted = currentPhase
    ? Math.min(completedStages, currentPhase.range[1]) - currentPhase.range[0] + 1
    : 0;
  const phaseCompletedClamped = Math.max(0, phaseCompleted);
  const phaseFraction = phaseCompletedClamped / phaseTotal;
  const phaseAccent = currentPhase ? ACCENT_COLORS[currentPhase.accent] : ACCENT_COLORS.blue;
  const phaseLabel = currentPhase?.label.replace("\n", " ") ?? "";

  // SVG ring constants
  const ringSize = 18;
  const ringStroke = 2;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - phaseFraction);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <FeedbackWidget projectId={project.id} />
        <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

        {/* Left sidebar - Stage navigation */}
        <WorkspaceSidebar
          stages={visibleStages}
          currentStage={currentStage}
          completedStages={completedStages}
          onStageClick={setCurrentStage}
          projectName={project.name}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Compact header */}
          <header className="border-b bg-card flex-shrink-0">
            <div className="flex h-11 items-center px-3 gap-2">
              <SidebarTrigger className="h-7 w-7" />
              <div className="h-4 w-px bg-border" />

              {/* Breadcrumb navigation */}
              <nav className="hidden sm:flex items-center gap-1 text-xs min-w-0">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Dashboard
                </button>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                <span
                  className="font-medium text-foreground truncate max-w-[140px]"
                  title={project.name}
                >
                  {project.name}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                <span className={`${phaseAccent.activeText} font-medium whitespace-nowrap`}>
                  {phaseLabel}
                </span>
                <div
                  className="flex-shrink-0"
                  title={`${phaseCompletedClamped}/${phaseTotal} stages completed`}
                >
                  <svg width={ringSize} height={ringSize} className="block -rotate-90">
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={ringStroke}
                      className="text-muted-foreground/20"
                    />
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={ringRadius}
                      fill="none"
                      strokeWidth={ringStroke}
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      className={phaseAccent.activeText}
                      style={{ transition: "stroke-dashoffset 0.4s ease" }}
                    />
                  </svg>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                <span
                  className="text-primary font-medium truncate max-w-[160px]"
                  title={visibleStages.find((s) => s.id === currentStage)?.label}
                >
                  {visibleStages.find((s) => s.id === currentStage)?.label}
                </span>
              </nav>
              {/* Mobile: just project name */}
              <h1 className="sm:hidden font-display text-sm font-semibold truncate text-foreground">
                {project.name}
              </h1>

              {/* Context pane toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hidden lg:inline-flex"
                onClick={() => setContextOpen((prev) => !prev)}
                title={contextOpen ? "Collapse context pane" : "Expand context pane"}
              >
                {contextOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>

              <div className="ml-auto flex items-center gap-1">
                {/* Governance pane toggle on xl+ */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hidden xl:inline-flex"
                  onClick={() => setGovernanceOpen((prev) => !prev)}
                  title={governanceOpen ? "Collapse governance pane" : "Expand governance pane"}
                >
                  {governanceOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
                <ThemeToggle />
                {/* Context pane as sheet on small screens */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
                    <ContextPane
                      currentStage={currentStage}
                      projectId={project.id}
                      refreshKey={refreshKey}
                    />
                  </SheetContent>
                </Sheet>
                {/* Governance toggle (visible below xl) */}
                <Sheet open={rightOpen} onOpenChange={setRightOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
                    <GovernancePane
                      currentStage={currentStage}
                      completedStages={completedStages}
                      projectId={project.id}
                      projectName={project.name}
                      onStageRunComplete={handleStageRunComplete}
                    />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </header>

          {/* Content area: Context + Synthesis + Governance */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Context pane - collapsible on lg+ */}
            <div
              className={cn(
                "border-r bg-card overflow-y-auto flex-shrink-0 hidden lg:block transition-[width] duration-300 ease-in-out",
                contextOpen ? "w-72" : "w-0 border-r-0",
              )}
            >
              <div
                className={cn(
                  "w-72 min-w-[18rem]",
                  !contextOpen && "opacity-0 pointer-events-none",
                )}
              >
                <ContextPane
                  currentStage={currentStage}
                  projectId={project.id}
                  refreshKey={refreshKey}
                />
              </div>
            </div>

            {/* Center: main workspace */}
            <div className="flex-1 overflow-y-auto">
              <DensityProvider>
                {currentStage >= 4 && (
                  <div className="px-6 pt-4">
                    <UnlockedRequirementsBanner
                      projectId={project.id}
                      currentStage={currentStage}
                      onJumpToStage={(s) => setCurrentStage(s)}
                      refreshKey={refreshKey}
                    />
                  </div>
                )}
                <SynthesisPane
                  currentStage={currentStage}
                  stages={visibleStages}
                  projectId={project.id}
                  projectMode={project.mode}
                  refreshKey={refreshKey}
                  completedStages={completedStages}
                  onRunStage={runStage}
                  stageRunning={stageRunning}
                  onAdvance={(next) => {
                    setCurrentStage(next);
                    handleStageRunComplete();
                  }}
                />
              </DensityProvider>
            </div>

            {/* Right: Governance pane - collapsible on xl+ */}
            <div
              className={cn(
                "border-l bg-card overflow-y-auto flex-shrink-0 hidden lg:block transition-[width] duration-300 ease-in-out",
                governanceOpen ? "w-72" : "w-0 border-l-0",
              )}
            >
              <div
                className={cn(
                  "w-72 min-w-[18rem]",
                  !governanceOpen && "opacity-0 pointer-events-none",
                )}
              >
                <GovernancePane
                  currentStage={currentStage}
                  completedStages={completedStages}
                  projectId={project.id}
                  projectName={project.name}
                  onStageRunComplete={handleStageRunComplete}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
