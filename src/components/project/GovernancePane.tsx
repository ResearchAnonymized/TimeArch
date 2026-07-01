import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Lock,
  Clock,
  Play,
  Loader2,
  ArrowRight,
  Shield,
  AlertTriangle,
  FastForward,
  StopCircle,
  ChevronDown,
  FileDown,
  Sparkles,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { HelpTip } from "./HelpTip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DocumentGenerator from "./DocumentGenerator";
import StageReportDownloader from "./StageReportDownloader";
import MermaidTemplateSettings from "./MermaidTemplateSettings";
import { motion, AnimatePresence } from "framer-motion";
import { getStageChecklist } from "./stageChecklists";
import { ValidationChecklist } from "./ValidationChecklist";
import { getRequiredAccessToken } from "@/lib/authenticated-functions";
import { AgentTracePanel } from "@/components/agent-trace/AgentTracePanel";

// Mirror of supabase/functions/_shared/agent-runtime/config.ts::AGENTIC_STAGES.
// Stages routed through the LangGraph-style planner/executor/critic runtime.
const AGENTIC_STAGES = new Set<number>([2, 3, 7]);
const agentFnFor = (stage: number) =>
  AGENTIC_STAGES.has(stage) ||
  (typeof window !== "undefined" && localStorage.getItem("timearch.agentic.allStages") === "1")
    ? "run-agent-v2" : "run-agent";

interface Props {
  currentStage: number;
  completedStages: number;
  projectId: string;
  projectName?: string;
  onStageRunComplete?: () => void;
}

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  stage: number;
  error: string | null;
}

interface Approval {
  id: string;
  stage: number;
  action: string;
  comment: string | null;
  created_at: string;
  approved_by: string;
}

const STAGE_LABELS: Record<number, string> = {
  0: "Discovery & Reverse Engineering",
  1: "Requirement Collection",
  2: "Requirement Analysis",
  3: "Architecture Drivers",
  4: "Style Selection",
  5: "Tradeoff Evaluation",
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
  9: "Cross-Cutting Concerns",
  10: "Infrastructure & Deployment",
  11: "Quality Attributes",
  12: "Risk Assessment",
  13: "Architecture Validation",
  14: "Documentation & ADRs",
  15: "Stakeholder Approval",
  16: "Code Generation",
  17: "Implementation Review",
  18: "Architecture Evolution",
};

const MANUAL_STAGES = [0, 1, 15];

const POLL_TIMEOUT_MS = 8 * 60 * 1000;
const POLL_INITIAL_MS = 1000;
const POLL_MAX_MS = 30000;

type WorkflowStep = "run" | "review" | "lock";

function getWorkflowStep(stageRuns: AgentRun[], isManual: boolean): WorkflowStep {
  if (isManual) return "review";
  const hasCompleted = stageRuns.some((r) => r.status === "completed");
  if (!hasCompleted) return "run";
  return "review";
}

const STEP_TIPS: Record<string, string> = {
  run: "Execute the AI agent for this stage. The agent uses RAG-grounded knowledge and your project context to generate architecture artifacts.",
  review: "Review the generated output, evaluator feedback, and knowledge sources before locking.",
  lock: "Finalize this stage. Locked stages feed into downstream stages and cannot be modified without unlocking.",
};

export default function GovernancePane({
  currentStage,
  completedStages,
  projectId,
  projectName,
  onStageRunComplete,
}: Props) {
  const { user } = useAuth();
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [running, setRunning] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunCancelled = useRef(false);
  const [autoRunStage, setAutoRunStage] = useState<number | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Checklist state
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [justification, setJustification] = useState("");
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Reset checklist when stage changes
  useEffect(() => {
    setCheckedItems(new Set());
    setJustification("");
    setChecklistOpen(false);
  }, [currentStage]);

  const fetchData = async () => {
    const [runsRes, approvalsRes] = await Promise.all([
      supabase
        .from("agent_runs")
        .select("id, agent_name, status, stage, error")
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("stage_approvals")
        .select("id, stage, action, comment, created_at, approved_by")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    if (runsRes.data) setAgentRuns(runsRes.data);
    if (approvalsRes.data) setApprovals(approvalsRes.data);
  };

  useEffect(() => {
    fetchData();
  }, [projectId, currentStage]);

  const pollStageCompletion = async (stage: number, since: string): Promise<boolean> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let interval = POLL_INITIAL_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const { data, error } = await supabase
        .from("agent_runs")
        .select("status, error, agent_name")
        .eq("project_id", projectId)
        .eq("stage", stage)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        interval = Math.min(interval * 2, POLL_MAX_MS);
        continue;
      }

      if (data?.status === "completed") return true;
      if (data?.status === "failed") {
        toast.error(data.error || `${data.agent_name || "Agent"} failed`);
        return false;
      }

      interval = data ? POLL_INITIAL_MS : Math.min(interval * 2, POLL_MAX_MS);
    }

    toast.error("Agent run is taking longer than expected. Refresh shortly to see the result.");
    return false;
  };

  const runSingleStage = async (stage: number): Promise<boolean> => {
    if (!user || MANUAL_STAGES.includes(stage)) return true;
    try {
      const startedAt = new Date().toISOString();
      const token = await getRequiredAccessToken();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${agentFnFor(stage)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, stage, user_id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(`Stage ${stage} failed: ${data.error || "Agent execution failed"}`);
        return false;
      }
      if (data.queued || data.status === "running") {
        return await pollStageCompletion(stage, startedAt);
      }
      return true;
    } catch (err: any) {
      toast.error(`Stage ${stage}: ${err.message || "Failed to run agent"}`);
      return false;
    }
  };

  const lockSingleStage = async (stage: number): Promise<boolean> => {
    if (!user) return false;
    const existing = approvals.find((a) => a.action === "locked" && a.stage === stage);
    if (existing) return true;
    try {
      const { error } = await supabase.from("stage_approvals").insert({
        project_id: projectId,
        stage,
        action: "locked" as any,
        approved_by: user.id,
        comment: `Stage ${stage} auto-locked`,
      });
      if (error) throw error;
      const nextStage = Math.min(stage + 1, 18);
      await supabase.from("projects").update({ current_stage: nextStage }).eq("id", projectId);
      return true;
    } catch (err: any) {
      toast.error(`Failed to lock stage ${stage}: ${err.message}`);
      return false;
    }
  };

  const handleRunStage = async () => {
    if (!user || MANUAL_STAGES.includes(currentStage)) return;
    setRunning(true);
    try {
      const startedAt = new Date().toISOString();
      const token = await getRequiredAccessToken();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${agentFnFor(currentStage)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_id: projectId, stage: currentStage, user_id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Agent execution failed");
      } else if (data.queued || data.status === "running") {
        toast.info(`${data.agent} is running in the background.`);
        const completed = await pollStageCompletion(currentStage, startedAt);
        if (completed) {
          toast.success(`${data.agent} completed.`);
          onStageRunComplete?.();
        }
      } else {
        toast.success(`${data.agent} completed: ${data.artifact_title}`);
        onStageRunComplete?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to run agent");
    } finally {
      setRunning(false);
      fetchData();
    }
  };

  const checklist = getStageChecklist(currentStage);
  const allChecked = checkedItems.size === checklist.length;

  const toggleCheck = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleLockStage = async () => {
    if (!user) return;
    if (!allChecked) {
      toast.error("Please complete all validation checklist items before locking.");
      setChecklistOpen(true);
      return;
    }
    const alreadyLocked = approvals.some((a) => a.action === "locked" && a.stage === currentStage);
    if (alreadyLocked) {
      toast.info(`Stage "${STAGE_LABELS[currentStage]}" is already locked.`);
      return;
    }
    try {
      const commentPayload = JSON.stringify({
        checklist: checklist.map((c) => ({ id: c.id, label: c.label, checked: true })),
        justification: justification.trim() || null,
        approved_at: new Date().toISOString(),
      });
      const { error } = await supabase.from("stage_approvals").insert({
        project_id: projectId,
        stage: currentStage,
        action: "locked" as any,
        approved_by: user.id,
        comment: commentPayload,
      });
      if (error) throw error;
      const nextStage = Math.min(currentStage + 1, 18);
      await supabase.from("projects").update({ current_stage: nextStage }).eq("id", projectId);
      toast.success(`Stage "${STAGE_LABELS[currentStage]}" locked with validation checklist!`);
      await fetchData();
      onStageRunComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to lock stage");
    }
  };

  const handleAutoRunAll = async () => {
    if (!user) return;
    setAutoRunning(true);
    autoRunCancelled.current = false;
    const lockedSet = new Set(approvals.filter((a) => a.action === "locked").map((a) => a.stage));
    for (let stage = currentStage; stage <= 18; stage++) {
      if (autoRunCancelled.current) {
        toast.info("Auto-run cancelled.");
        break;
      }
      if (lockedSet.has(stage)) continue;
      setAutoRunStage(stage);
      if (MANUAL_STAGES.includes(stage)) {
        toast.info(`Stage ${stage} "${STAGE_LABELS[stage]}" requires manual input — skipping.`);
        continue;
      }
      toast.loading(`Running Stage ${stage}: ${STAGE_LABELS[stage]}...`, { id: `auto-${stage}` });
      const runOk = await runSingleStage(stage);
      if (!runOk || autoRunCancelled.current) {
        toast.dismiss(`auto-${stage}`);
        break;
      }
      const lockOk = await lockSingleStage(stage);
      toast.dismiss(`auto-${stage}`);
      if (!lockOk || autoRunCancelled.current) break;
      toast.success(`Stage ${stage}: ${STAGE_LABELS[stage]} ✓`);
      lockedSet.add(stage);
      await fetchData();
      onStageRunComplete?.();
    }
    setAutoRunning(false);
    setAutoRunStage(null);
    await fetchData();
    onStageRunComplete?.();
    if (!autoRunCancelled.current) toast.success("Auto-run pipeline complete!");
  };

  const handleCancelAutoRun = () => {
    autoRunCancelled.current = true;
  };

  const lockedApprovals = approvals.filter((a) => a.action === "locked");
  const stageRuns = agentRuns.filter((r) => r.stage === currentStage);
  const isManualStage = MANUAL_STAGES.includes(currentStage);
  const workflowStep = getWorkflowStep(stageRuns, isManualStage);
  const hasOutput = stageRuns.some((r) => r.status === "completed");
  const stageIsLocked = lockedApprovals.some((a) => a.stage === currentStage);
  const lastRun = stageRuns.length > 0 ? stageRuns[stageRuns.length - 1] : null;
  const stageFailed = !isManualStage && lastRun?.status === "failed" && !hasOutput;
  const uniqueLockedCount = new Set(lockedApprovals.map((a) => a.stage)).size;
  const overallProgress = Math.round((uniqueLockedCount / 18) * 100);

  // Detect unresolved revision flag for current stage
  const stageApprovals = approvals.filter((a) => a.stage === currentStage);
  const lastFlag = stageApprovals.find((a) => a.action === "revision_requested");
  const lastLockOrDismiss = stageApprovals.find(
    (a) => a.action === "locked" || a.action === "approved",
  );
  const isFlagged =
    lastFlag &&
    (!lastLockOrDismiss || new Date(lastFlag.created_at) > new Date(lastLockOrDismiss.created_at));
  const flagData = isFlagged
    ? (() => {
        try {
          return JSON.parse(lastFlag.comment || "{}");
        } catch {
          return null;
        }
      })()
    : null;

  const canShowChecklist = (isManualStage || hasOutput) && !stageIsLocked && !stageFailed;

  const steps: { key: WorkflowStep; label: string; done: boolean }[] = [
    {
      key: "run",
      label: isManualStage ? "Input Data" : "Run Agent",
      done: hasOutput || isManualStage,
    },
    { key: "review", label: "Review & Validate", done: allChecked && canShowChecklist },
    { key: "lock", label: "Lock & Advance", done: stageIsLocked },
  ];

  const showAgentTrace = AGENTIC_STAGES.has(currentStage) ||
    (typeof window !== "undefined" && localStorage.getItem("timearch.agentic.allStages") === "1");

  return (
    <div className="p-4 space-y-4">
      {showAgentTrace && (
        <AgentTracePanel projectId={projectId} stage={currentStage} />
      )}
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
          <Shield className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-foreground">
            Governance
          </h3>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            Stage Control & Workflow
          </p>
        </div>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Overall Progress
          </span>
          <span className="text-sm font-mono font-bold text-foreground">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-1.5" />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{uniqueLockedCount} of 18 locked</span>
          <span className="font-mono">{18 - uniqueLockedCount} remaining</span>
        </div>
      </div>

      {/* Current Stage Workflow */}
      <motion.div
        className="rounded-xl border bg-card p-3 space-y-3 relative overflow-hidden"
        layout
      >
        <AnimatePresence>
          {running && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-0"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 relative z-10">
          <motion.span
            className={cn(
              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors",
              running
                ? "text-amber-400 bg-amber-500/15"
                : stageIsLocked
                  ? "text-emerald-400 bg-emerald-500/15"
                  : "text-primary bg-primary/10",
            )}
            animate={running ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {String(currentStage).padStart(2, "0")}
          </motion.span>
          <h4 className="text-[11px] font-display font-semibold text-foreground truncate">
            {STAGE_LABELS[currentStage]}
          </h4>
          {running && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto"
            >
              <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <motion.span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
                Running
              </span>
            </motion.div>
          )}
        </div>

        {/* Workflow steps */}
        <div className="flex items-center gap-1 relative z-10">
          {steps.map((step, i) => {
            const isActive = workflowStep === step.key && !step.done;
            const isRunningStep = running && step.key === "run";
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg cursor-help transition-colors relative overflow-hidden",
                        step.done
                          ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                          : isRunningStep
                            ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                            : isActive
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "bg-muted/30",
                      )}
                      animate={
                        isRunningStep
                          ? {
                              boxShadow: [
                                "0 0 0px rgba(245,158,11,0)",
                                "0 0 12px rgba(245,158,11,0.15)",
                                "0 0 0px rgba(245,158,11,0)",
                              ],
                            }
                          : {}
                      }
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {(isActive || isRunningStep) && (
                        <motion.div
                          className={cn(
                            "absolute bottom-0 left-0 right-0 h-0.5",
                            isRunningStep ? "bg-amber-400" : "bg-primary",
                          )}
                          layoutId="step-indicator"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      {step.done && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500/50" />
                      )}
                      <motion.div
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold border",
                          step.done
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : isRunningStep
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : isActive
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground/40 border-transparent",
                        )}
                        animate={isRunningStep ? { rotate: [0, 360] } : {}}
                        transition={
                          isRunningStep ? { repeat: Infinity, duration: 3, ease: "linear" } : {}
                        }
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isRunningStep ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          i + 1
                        )}
                      </motion.div>
                      <span
                        className={cn(
                          "text-[9px] font-semibold leading-none text-center",
                          step.done
                            ? "text-emerald-500 dark:text-emerald-400"
                            : isRunningStep
                              ? "text-amber-500 dark:text-amber-400"
                              : isActive
                                ? "text-primary"
                                : "text-muted-foreground/50",
                        )}
                      >
                        {step.label}
                      </span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                    {STEP_TIPS[step.key]}
                  </TooltipContent>
                </Tooltip>
                {i < steps.length - 1 && (
                  <motion.div
                    animate={step.done ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <ArrowRight
                      className={cn(
                        "h-3 w-3 flex-shrink-0",
                        step.done
                          ? "text-emerald-400"
                          : isRunningStep
                            ? "text-amber-400/60"
                            : "text-muted-foreground/20",
                      )}
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Failed stage warning */}
        {stageFailed && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 relative z-10">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-destructive">
                Stage failed — cannot lock
              </p>
              {lastRun?.error && (
                <p
                  className="text-[9px] text-muted-foreground truncate mt-0.5"
                  title={lastRun.error}
                >
                  {lastRun.error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Revision flag warning — blocks locking */}
        {isFlagged && !stageIsLocked && (
          <div className="relative z-10 rounded-lg border border-warning/30 bg-warning/5 p-2.5 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-warning">Flagged for Revision</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Locking is blocked until this flag is resolved. Review the issues and dismiss when
                  ready.
                </p>
                {flagData?.justification && (
                  <p className="text-[10px] text-foreground mt-1.5 p-1.5 rounded bg-muted/50 italic">
                    "{flagData.justification}"
                  </p>
                )}
                {flagData?.unchecked_count > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {flagData.unchecked_count} checklist item
                    {flagData.unchecked_count > 1 ? "s" : ""} were unchecked when flagged.
                  </p>
                )}
                <p className="text-[8px] text-muted-foreground/60 mt-1 font-mono tabular-nums">
                  Flagged{" "}
                  {new Date(lastFlag!.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-[11px] h-7 border-warning/30 text-warning hover:bg-warning/10"
              onClick={async () => {
                if (!user) return;
                try {
                  const { error } = await supabase.from("stage_approvals").insert({
                    project_id: projectId,
                    stage: currentStage,
                    action: "approved" as any,
                    approved_by: user.id,
                    comment: JSON.stringify({
                      resolved_flag: lastFlag!.id,
                      resolved_at: new Date().toISOString(),
                    }),
                  });
                  if (error) throw error;
                  toast.success(`Revision flag resolved for "${STAGE_LABELS[currentStage]}".`);
                  setCheckedItems(new Set());
                  setJustification("");
                  await fetchData();
                } catch (err: any) {
                  toast.error(
                    typeof err === "string" ? err : err?.message || "Failed to resolve flag",
                  );
                }
              }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Resolve & Dismiss Flag
            </Button>
          </div>
        )}

        {/* Validation Checklist — evidence-driven, with AI verify + surgical refine */}
        {canShowChecklist && (
          <ValidationChecklist
            projectId={projectId}
            stage={currentStage}
            open={checklistOpen}
            onOpenChange={setChecklistOpen}
            checkedItems={checkedItems}
            setCheckedItems={setCheckedItems}
            justification={justification}
            onJustificationChange={setJustification}
          />
        )}

        {/* Action buttons */}
        <div className="space-y-2 relative z-10">
          <div className="flex gap-2">
            {!isManualStage && (
              <Button
                variant={hasOutput ? "outline" : stageFailed ? "destructive" : "default"}
                size="sm"
                className={cn(
                  "flex-1 gap-1.5 text-[11px] h-8 transition-all",
                  running &&
                    "ring-1 ring-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 border-amber-500/20",
                )}
                onClick={handleRunStage}
                disabled={running || autoRunning}
              >
                {running ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {running
                  ? "Running..."
                  : stageFailed
                    ? "Retry Stage"
                    : hasOutput
                      ? "Re-run"
                      : "Run Stage"}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(isManualStage ? "flex-1" : "")}>
                  <Button
                    variant="default"
                    size="sm"
                    className={cn(
                      "w-full gap-1.5 text-[11px] h-8 transition-all",
                      stageIsLocked
                        ? "bg-emerald-600/80 text-white cursor-default"
                        : stageFailed || !allChecked || isFlagged
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white",
                    )}
                    onClick={handleLockStage}
                    disabled={
                      stageIsLocked ||
                      autoRunning ||
                      stageFailed ||
                      (!isManualStage && !hasOutput) ||
                      !allChecked ||
                      !!isFlagged
                    }
                  >
                    <Lock className="h-3 w-3" />
                    {stageIsLocked ? "Locked" : "Lock & Advance"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!stageIsLocked && (
                <TooltipContent side="bottom" className="text-xs">
                  {isFlagged
                    ? "Resolve the revision flag before locking"
                    : stageFailed
                      ? "Fix the failed stage before locking"
                      : !allChecked
                        ? `Complete all ${checklist.length} checklist items first`
                        : !isManualStage && !hasOutput
                          ? "Run the stage agent first"
                          : "Lock this stage"}
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Guidance text */}
          {canShowChecklist && !stageIsLocked && (
            <p className="text-[9px] text-muted-foreground/70 leading-relaxed px-1">
              {allChecked
                ? "✅ All items verified — you can now lock this stage. Or flag for revision if issues remain."
                : `Check all ${checklist.length} items above to enable locking. Use "Flag for Revision" to record concerns and block locking until resolved.`}
            </p>
          )}

          {/* Flag for Revision — save checklist + notes without locking */}
          {canShowChecklist && !stageIsLocked && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-[11px] h-8 border-warning/30 text-warning hover:bg-warning/10"
              disabled={autoRunning}
              onClick={async () => {
                if (!user) return;
                try {
                  const commentPayload = JSON.stringify({
                    checklist: checklist.map((c) => ({
                      id: c.id,
                      label: c.label,
                      checked: checkedItems.has(c.id),
                    })),
                    justification: justification.trim() || null,
                    flagged_at: new Date().toISOString(),
                    unchecked_count: checklist.length - checkedItems.size,
                  });
                  const { error } = await supabase.from("stage_approvals").insert({
                    project_id: projectId,
                    stage: currentStage,
                    action: "revision_requested" as any,
                    approved_by: user.id,
                    comment: commentPayload,
                  });
                  if (error) throw error;
                  toast.success(`Stage "${STAGE_LABELS[currentStage]}" flagged for revision.`);
                  await fetchData();
                } catch (err: any) {
                  toast.error(
                    typeof err === "string" ? err : err?.message || "Failed to flag stage",
                  );
                }
              }}
            >
              <AlertTriangle className="h-3 w-3" />
              Flag for Revision
            </Button>
          )}
        </div>
      </motion.div>

      {/* Autonomous Pipeline */}
      <div className="rounded-xl border border-dashed border-primary/20 bg-primary/[0.03] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-display font-semibold text-foreground">
            Autonomous Pipeline
          </span>
        </div>
        {autoRunning ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="truncate">
                Stage {autoRunStage}: {STAGE_LABELS[autoRunStage || 0]}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full gap-1.5 text-[11px] h-8"
              onClick={handleCancelAutoRun}
            >
              <StopCircle className="h-3 w-3" /> Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-[11px] h-8 border-primary/20 hover:bg-primary/5"
            onClick={handleAutoRunAll}
            disabled={running || uniqueLockedCount >= 18}
          >
            <FastForward className="h-3 w-3" />
            {uniqueLockedCount >= 18 ? "All Complete" : "Run All Automatically"}
          </Button>
        )}
        <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
          Auto-executes agents, locks outputs, and advances through remaining stages. Manual stages
          and checklists are skipped.
        </p>
      </div>

      {/* Downloads */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileDown className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Downloads
          </span>
        </div>
        <div className="rounded-xl bg-muted/20 p-2 space-y-2">
          <StageReportDownloader
            projectId={projectId}
            projectName={projectName || "Project"}
            currentStage={currentStage}
          />
          <DocumentGenerator
            projectId={projectId}
            projectName={projectName || "Project"}
            currentStage={currentStage}
          />
          <div className="pt-1 border-t border-border/40 flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">Diagram look & feel</span>
            <MermaidTemplateSettings />
          </div>
        </div>
      </div>

      {/* Agent Runs */}
      {stageRuns.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
            Agent Runs
            <HelpTip text="History of AI agent executions for this stage." />
          </h4>
          <div className="space-y-1">
            {stageRuns.map((run) => (
              <div
                key={run.id}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]",
                  run.status === "completed"
                    ? "bg-emerald-500/5"
                    : run.status === "failed"
                      ? "bg-destructive/5"
                      : "bg-muted/30",
                )}
              >
                {run.status === "completed" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                ) : run.status === "running" ? (
                  <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />
                ) : run.status === "failed" ? (
                  <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className="truncate font-medium">{run.agent_name}</span>
                {run.status === "failed" && run.error && (
                  <span
                    className="text-destructive text-[9px] ml-auto truncate max-w-[80px]"
                    title={run.error}
                  >
                    {run.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Stages */}
      {uniqueLockedCount > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setHistoryExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 w-full text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Lock className="h-3 w-3" />
            <span>Locked Stages</span>
            <span className="text-[9px] font-mono ml-1 opacity-60">{uniqueLockedCount}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 ml-auto transition-transform",
                historyExpanded && "rotate-180",
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {historyExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pt-1">
                  {Array.from(new Map(lockedApprovals.map((l) => [l.stage, l])).values())
                    .sort((a, b) => a.stage - b.stage)
                    .map((lock) => (
                      <div
                        key={lock.id}
                        className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/5"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-500/60 flex-shrink-0" />
                        <span className="font-medium text-foreground/70">
                          {STAGE_LABELS[lock.stage]}
                        </span>
                        <span className="text-muted-foreground/50 ml-auto text-[9px] font-mono">
                          {new Date(lock.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
