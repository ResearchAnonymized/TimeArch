// Live agent-trace visualisation. Subscribes to `agent_trace_steps` via
// Supabase Realtime so users can watch the planner → executor (tool calls)
// → critic loop unfold step by step. Used for the LangGraph-style runtime
// (run-agent-v2). Mount it next to the stage runner in the workspace.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, Wrench, CheckCircle2, AlertCircle, Sparkles, Save, Activity,
} from "lucide-react";

interface TraceStep {
  id: number;
  run_id: string;
  step_index: number;
  node: string;
  kind: "thought" | "tool_call" | "tool_result" | "llm" | "error" | "verdict";
  payload: Record<string, unknown>;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  created_at: string;
}

interface AgentRun {
  id: string;
  stage: number;
  status: "running" | "completed" | "failed";
  goal: string;
  iterations: number;
  tokens_in: number;
  tokens_out: number;
  final_artifact_id: string | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

const NODE_ICON: Record<string, JSX.Element> = {
  planner: <Sparkles className="h-3.5 w-3.5" />,
  executor: <Brain className="h-3.5 w-3.5" />,
  critic: <CheckCircle2 className="h-3.5 w-3.5" />,
  persist: <Save className="h-3.5 w-3.5" />,
  runtime: <Activity className="h-3.5 w-3.5" />,
};

const KIND_ICON: Record<TraceStep["kind"], JSX.Element> = {
  thought: <Brain className="h-3.5 w-3.5" />,
  tool_call: <Wrench className="h-3.5 w-3.5" />,
  tool_result: <Wrench className="h-3.5 w-3.5" />,
  llm: <Sparkles className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  verdict: <CheckCircle2 className="h-3.5 w-3.5" />,
};

function formatPayload(step: TraceStep): string {
  const p = step.payload;
  if (step.kind === "thought") return String((p as any).thought ?? "");
  if (step.kind === "tool_call") return `${(p as any).tool}(${JSON.stringify((p as any).args).slice(0, 160)})`;
  if (step.kind === "tool_result") {
    const ok = (p as any).ok;
    return `${(p as any).tool} ⇒ ${ok ? "ok" : (p as any).error ?? "error"}${
      (p as any).preview ? ` · ${(p as any).preview.slice(0, 160)}` : ""
    }`;
  }
  if (step.kind === "verdict") {
    const v = p as any;
    return `score=${v.score?.toFixed?.(2) ?? "?"} · pass=${v.pass} · ${v.rationale?.slice?.(0, 160) ?? ""}`;
  }
  if (step.kind === "error") return String((p as any).message ?? JSON.stringify(p));
  if (step.node === "planner") return `plan (${(p as any).plan?.length ?? 0} steps)${(p as any).replan ? " · replan" : ""}`;
  if (step.node === "persist") return `committed artifact ${((p as any).artifact_id as string)?.slice(0, 8)}`;
  return JSON.stringify(p).slice(0, 200);
}

export interface AgentTracePanelProps {
  projectId: string;
  stage?: number;          // when set, scope to this stage's runs
  runId?: string;          // when set, pin to a specific run
  className?: string;
}

export function AgentTracePanel({ projectId, stage, runId, className }: AgentTracePanelProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(runId ?? null);
  const [steps, setSteps] = useState<TraceStep[]>([]);

  // 1) Load the list of recent runs for this project/stage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("agent_runs_v2")
        .select("*")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(10);
      if (stage != null) q = q.eq("stage", stage);
      const { data } = await q;
      if (cancelled) return;
      const rows = ((data ?? []) as unknown) as AgentRun[];
      setRuns(rows);
      if (!runId && !activeRunId && rows[0]) setActiveRunId(rows[0].id);
    })();
    // Subscribe to run updates so status/iterations refresh live.
    const ch = supabase
      .channel(`agent_runs_v2:${projectId}:${stage ?? "all"}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "agent_runs_v2", filter: `project_id=eq.${projectId}` },
          (payload) => {
            const row = payload.new as unknown as AgentRun;
            if (!row || (stage != null && row.stage !== stage)) return;
            setRuns((prev) => {
              const idx = prev.findIndex((r) => r.id === row.id);
              if (idx >= 0) { const copy = [...prev]; copy[idx] = row; return copy; }
              return [row, ...prev].slice(0, 10);
            });
            if (!activeRunId) setActiveRunId(row.id);
          })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [projectId, stage, runId, activeRunId]);

  // 2) For the active run, load trace steps + subscribe.
  useEffect(() => {
    if (!activeRunId) { setSteps([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agent_trace_steps")
        .select("*")
        .eq("run_id", activeRunId)
        .order("step_index", { ascending: true });
      if (!cancelled) setSteps(((data ?? []) as unknown) as TraceStep[]);
    })();
    const ch = supabase
      .channel(`agent_trace_steps:${activeRunId}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_trace_steps", filter: `run_id=eq.${activeRunId}` },
          (payload) => setSteps((prev) => [...prev, payload.new as unknown as TraceStep]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeRunId]);

  const activeRun = useMemo(() => runs.find((r) => r.id === activeRunId) ?? null, [runs, activeRunId]);

  return (
    <Card className={`p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Agent trace</h3>
          {activeRun && (
            <Badge variant={activeRun.status === "completed" ? "default" : activeRun.status === "failed" ? "destructive" : "secondary"}>
              {activeRun.status}
            </Badge>
          )}
        </div>
        {runs.length > 1 && (
          <select
            value={activeRunId ?? ""}
            onChange={(e) => setActiveRunId(e.target.value || null)}
            className="text-xs bg-background border border-border rounded px-2 py-1"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id.slice(0, 6)} · stage {r.stage} · {new Date(r.started_at).toLocaleTimeString()}
              </option>
            ))}
          </select>
        )}
      </div>

      {activeRun && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>iterations: <strong>{activeRun.iterations}</strong></span>
          <span>tokens in/out: <strong>{activeRun.tokens_in}/{activeRun.tokens_out}</strong></span>
          {activeRun.final_artifact_id && (
            <span>artifact: <code>{activeRun.final_artifact_id.slice(0, 8)}</code></span>
          )}
          {activeRun.error && <span className="text-destructive">error: {activeRun.error}</span>}
        </div>
      )}

      <ScrollArea className="h-[360px] pr-2">
        {steps.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-8 text-center">
            No trace yet — run an agentic stage to see live planner / executor / critic activity.
          </div>
        ) : (
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex gap-2 text-xs">
                <span className="text-muted-foreground tabular-nums w-6 shrink-0">{s.step_index}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {NODE_ICON[s.node] ?? <Activity className="h-3.5 w-3.5" />}
                  <Badge variant="outline" className="text-[10px] px-1 py-0">{s.node}</Badge>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {KIND_ICON[s.kind]}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.kind}</span>
                </span>
                <span className="flex-1 break-words text-foreground/90">{formatPayload(s)}</span>
                {s.duration_ms != null && (
                  <span className="text-muted-foreground tabular-nums shrink-0">{s.duration_ms}ms</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </ScrollArea>
    </Card>
  );
}

export default AgentTracePanel;
