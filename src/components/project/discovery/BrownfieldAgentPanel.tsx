/**
 * Multi-agent brownfield workbench.
 *
 * One button per brownfield stage → invokes the Planner/Executor/Critic/
 * Persist pipeline via `run-brownfield-agent`. The AgentTracePanel below
 * subscribes to `agent_trace_steps` and renders each node's activity live.
 *
 * Stage codes on agent_runs_v2.stage:
 *   101 mapping · 102 ripple · 103 quality · 104 alternatives · 105 adr · 106 plan
 */
import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentTracePanel } from "@/components/agent-trace/AgentTracePanel";
import { discoveryService } from "@/services/discoveryService";
import { useAuth } from "@/contexts/AuthContext";
import { notifySuccess, notifyError } from "@/lib/notify";
import { createLogger } from "@/lib/logger";
import { Loader2, Play, PlayCircle, Users } from "lucide-react";

const log = createLogger("BrownfieldAgentPanel");

type StageKey = "mapping" | "ripple" | "quality" | "alternatives" | "adr" | "plan";

interface StageMeta {
  key: StageKey;
  code: number;
  label: string;
  destination: string;
  blurb: string;
}

const STAGES: StageMeta[] = [
  { key: "mapping",      code: 101, label: "Feature Mapping",       destination: "feature_mappings",           blurb: "Map the change to core architecture elements." },
  { key: "ripple",       code: 102, label: "Ripple Analysis",       destination: "impact_findings",            blurb: "Trace secondary impacts through the system." },
  { key: "quality",      code: 103, label: "Quality Impact",        destination: "quality_impact_assessments", blurb: "Score ISO 25010 attribute impacts." },
  { key: "alternatives", code: 104, label: "Alternatives",          destination: "architecture_alternatives",  blurb: "Generate 2–4 distinct solution options." },
  { key: "adr",          code: 105, label: "ADR Author",            destination: "adr_records",                blurb: "Draft the Architecture Decision Record." },
  { key: "plan",         code: 106, label: "Implementation Plan",   destination: "feature_work_items",         blurb: "Produce an ordered, testable work plan." },
];

const STAGE_ORDER: StageKey[] = ["mapping", "ripple", "quality", "alternatives", "adr", "plan"];

export interface BrownfieldAgentPanelProps {
  projectId: string;
  featureChangeId: string | null;
  className?: string;
}

export function BrownfieldAgentPanel({ projectId, featureChangeId, className }: BrownfieldAgentPanelProps) {
  const { user } = useAuth();
  const [runningStage, setRunningStage] = useState<StageKey | null>(null);
  const [runAllActive, setRunAllActive] = useState(false);
  const [activeStageForTrace, setActiveStageForTrace] = useState<StageMeta>(STAGES[0]);

  const disabled = !user || !featureChangeId || runningStage !== null || runAllActive;

  const runStage = useCallback(async (stage: StageMeta) => {
    if (!user?.id || !featureChangeId) {
      notifyError("Select a feature change first.");
      return null;
    }
    setRunningStage(stage.key);
    setActiveStageForTrace(stage);
    try {
      const result = await discoveryService.runBrownfieldAgent({
        feature_change_id: featureChangeId,
        stage_key: stage.key,
        user_id: user.id,
      });
      if (!result.ok) {
        notifyError(`${stage.label} failed: ${(result as { ok: false; error: { message: string } }).error.message}`);
        log.warn("brownfield agent failed", (result as { ok: false; error: unknown }).error);
        return null;
      }
      const data = result.value;
      if (data.status === "completed") {
        notifySuccess(
          `${stage.label}: ${data.inserted_count ?? 0} row(s) into ${data.destination_table}. Critic score ${data.verdict?.score?.toFixed?.(2) ?? "n/a"}.`,
        );
      } else {
        notifyError(`${stage.label} failed: ${data.error ?? "unknown"}`);
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notifyError(`${stage.label} threw: ${msg}`);
      log.error("brownfield agent threw", e);
      return null;
    } finally {
      setRunningStage(null);
    }
  }, [user, featureChangeId]);

  const runAll = useCallback(async () => {
    if (!user?.id || !featureChangeId) {
      notifyError("Select a feature change first.");
      return;
    }
    setRunAllActive(true);
    try {
      for (const key of STAGE_ORDER) {
        const stage = STAGES.find((s) => s.key === key)!;
        const data = await runStage(stage);
        if (!data || data.status !== "completed") {
          notifyError(`Halting: ${stage.label} did not complete.`);
          break;
        }
      }
    } finally {
      setRunAllActive(false);
    }
  }, [user, featureChangeId, runStage]);

  const activeStageCode = activeStageForTrace.code;
  const headerHint = useMemo(() => {
    if (!featureChangeId) return "Pick a feature change to run the multi-agent pipeline.";
    return "Planner → Executor (tool loop) → Critic → Persist, per stage.";
  }, [featureChangeId]);

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <Card className="p-4 space-y-4">
        {!featureChangeId && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <strong>Agents are paused.</strong> Upload/parse is done, but this pipeline needs a{" "}
            <strong>feature change</strong> to analyze. Scroll up to <em>Feature changes</em>, click{" "}
            <strong>+ New change</strong>, save it (and optionally Score changes), then come back —
            <em>Run agent</em> / <em>Run all 6 stages</em> will unlock.
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Multi-agent brownfield runtime</h3>
              <Badge variant="outline" className="text-[10px]">Planner · Executor · Critic · Persist</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{headerHint}</p>
          </div>
          <Button
            size="sm"
            onClick={runAll}
            disabled={disabled}
            className="shrink-0"
          >
            {runAllActive
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Running all…</>
              : <><PlayCircle className="h-3.5 w-3.5 mr-1" /> Run all 6 stages</>}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {STAGES.map((stage) => {
            const isRunning = runningStage === stage.key;
            const isActive = activeStageForTrace.key === stage.key;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setActiveStageForTrace(stage)}
                className={`text-left rounded-md border p-3 space-y-2 transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <Badge variant="secondary" className="text-[10px]">#{stage.code}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{stage.blurb}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">→ {stage.destination}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs"
                  disabled={disabled}
                  onClick={(e) => { e.stopPropagation(); runStage(stage); }}
                >
                  {isRunning
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</>
                    : <><Play className="h-3 w-3 mr-1" /> Run agent</>}
                </Button>
              </button>
            );
          })}
        </div>
      </Card>

      <AgentTracePanel
        projectId={projectId}
        stage={activeStageCode}
        key={`${activeStageCode}-${featureChangeId ?? "none"}`}
      />
    </div>
  );
}
