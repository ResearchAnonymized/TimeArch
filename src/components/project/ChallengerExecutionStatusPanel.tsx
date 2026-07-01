import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Swords,
  Wand2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentRun {
  id: string;
  agent_name: string;
  status: "pending" | "running" | "completed" | "failed";
  stage: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
}

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  /** When true, show only the most recent N runs in collapsed view. Default 5. */
  recentLimit?: number;
}

type PipelinePhase = "run" | "challenge" | "refine";

const PHASE_META: Record<PipelinePhase, { label: string; icon: typeof Activity; tone: string }> = {
  run: { label: "Run", icon: Activity, tone: "text-blue-500" },
  challenge: { label: "Challenge", icon: Swords, tone: "text-amber-500" },
  refine: { label: "Refine", icon: Wand2, tone: "text-violet-500" },
};

function classifyRun(run: AgentRun): PipelinePhase {
  const input = (run.input ?? {}) as Record<string, unknown>;
  const opts = (input.options ?? {}) as Record<string, unknown>;
  if (opts.refinement) return "refine";
  if (opts.challenge_only) return "challenge";
  // Heuristic fallback by agent name
  const name = (run.agent_name ?? "").toLowerCase();
  if (name.includes("challeng")) return "challenge";
  if (name.includes("refine")) return "refine";
  return "run";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

/**
 * Real-time execution status for the Challenger pipeline (Run → Challenge → Refine).
 * Subscribes to agent_runs for the given project + stage and renders an at-a-glance
 * activity feed plus a phase summary so users can see progress and outputs live.
 */
export default function ChallengerExecutionStatusPanel({
  projectId,
  stage,
  refreshKey,
  recentLimit = 5,
}: Props) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRuns = async () => {
    const { data, error } = await supabase
      .from("agent_runs")
      .select(
        "id, agent_name, status, stage, created_at, started_at, completed_at, error, input, output",
      )
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setRuns(data as unknown as AgentRun[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRuns();
    // Realtime subscription for live updates
    const channel = supabase
      .channel(`agent-runs-stage-${stage}-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as AgentRun | undefined;
          if (!row || row.stage !== stage) return;
          fetchRuns();
        },
      )
      .subscribe();

    // Lightweight polling fallback (8s) in case realtime is unavailable
    const poll = window.setInterval(fetchRuns, 8000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, stage, refreshKey]);

  const activeRun = useMemo(
    () => runs.find((r) => r.status === "running" || r.status === "pending"),
    [runs],
  );

  const phaseSummary = useMemo(() => {
    const summary: Record<PipelinePhase, { last?: AgentRun; count: number }> = {
      run: { count: 0 },
      challenge: { count: 0 },
      refine: { count: 0 },
    };
    for (const r of runs) {
      const phase = classifyRun(r);
      summary[phase].count += 1;
      if (!summary[phase].last) summary[phase].last = r;
    }
    return summary;
  }, [runs]);

  const recent = runs.slice(0, recentLimit);

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 transition-colors text-left"
        aria-expanded={open}
      >
        <div
          className={cn(
            "h-7 w-7 rounded-md border flex items-center justify-center flex-shrink-0",
            activeRun ? "bg-primary/10 border-primary/30" : "bg-background/70",
          )}
        >
          {activeRun ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Status · Stage {stage}
            </span>
            {activeRun ? (
              <Badge variant="secondary" className="text-[10px] py-0 h-4">
                {PHASE_META[classifyRun(activeRun)].label} in progress
              </Badge>
            ) : runs.length > 0 ? (
              <span className="text-[10.5px] text-muted-foreground">
                Last activity {relativeTime(runs[0].created_at)}
              </span>
            ) : (
              <span className="text-[10.5px] text-muted-foreground">No runs yet</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setLoading(true);
              fetchRuns();
            }}
            aria-label="Refresh execution status"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 space-y-3">
              {/* Phase pipeline summary */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PHASE_META) as PipelinePhase[]).map((phase, idx) => {
                  const meta = PHASE_META[phase];
                  const Icon = meta.icon;
                  const info = phaseSummary[phase];
                  const isActive = activeRun && classifyRun(activeRun) === phase;
                  return (
                    <div
                      key={phase}
                      className={cn(
                        "rounded-md border px-3 py-2 transition-colors relative",
                        isActive ? "border-primary/40 bg-primary/5" : "bg-background/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5", meta.tone)} />
                        <span className="text-[11px] font-semibold">{meta.label}</span>
                        {isActive && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
                        )}
                      </div>
                      <div className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                        {info.count} {info.count === 1 ? "run" : "runs"}
                        {info.last && <> · {relativeTime(info.last.created_at)}</>}
                      </div>
                      {idx < 2 && (
                        <div className="hidden md:block absolute -right-1 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                          →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recent runs list */}
              <div className="rounded-md border divide-y">
                <div className="px-3 py-1.5 bg-muted/30 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Recent activity
                </div>
                {loading && runs.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading runs…
                  </div>
                ) : recent.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-muted-foreground">
                    No runs recorded for this stage. Trigger Run, Challenge, or Refine to see live
                    status here.
                  </div>
                ) : (
                  recent.map((run) => {
                    const phase = classifyRun(run);
                    const meta = PHASE_META[phase];
                    const Icon = meta.icon;
                    const expanded = expandedId === run.id;
                    const start = run.started_at ?? run.created_at;
                    const end = run.completed_at;
                    const durationMs = end
                      ? new Date(end).getTime() - new Date(start).getTime()
                      : run.status === "running"
                        ? Date.now() - new Date(start).getTime()
                        : null;

                    let statusBadge;
                    if (run.status === "completed") {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      );
                    } else if (run.status === "failed") {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Failed
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                          <Loader2 className="h-3 w-3 animate-spin" />{" "}
                          {run.status === "pending" ? "Pending" : "Running"}
                        </span>
                      );
                    }

                    return (
                      <div key={run.id} className="px-3 py-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : run.id)}
                          className="w-full flex items-center gap-2 text-left"
                        >
                          <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta.tone)} />
                          <span className="font-medium truncate">{run.agent_name}</span>
                          <Badge variant="outline" className="text-[9.5px] py-0 h-4">
                            {meta.label}
                          </Badge>
                          <div className="ml-auto flex items-center gap-3 text-muted-foreground tabular-nums">
                            {durationMs !== null && <span>{formatDuration(durationMs)}</span>}
                            <span>{relativeTime(run.created_at)}</span>
                            {statusBadge}
                            {expanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </div>
                        </button>

                        {expanded && (
                          <div className="mt-2 pl-5 space-y-1.5 text-[10.5px] text-muted-foreground">
                            {run.error && (
                              <div className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-destructive">
                                {run.error}
                              </div>
                            )}
                            {run.output && typeof run.output === "object" && (
                              <div className="space-y-0.5">
                                {(() => {
                                  const out = run.output as Record<string, unknown>;
                                  const title =
                                    typeof out.artifact_title === "string"
                                      ? out.artifact_title
                                      : null;
                                  const artifactId =
                                    typeof out.artifact_id === "string" ? out.artifact_id : null;
                                  const summary =
                                    typeof out.summary === "string" ? out.summary : null;
                                  return (
                                    <>
                                      {title && (
                                        <div>
                                          <span className="font-medium text-foreground">
                                            Artifact:
                                          </span>{" "}
                                          {title}
                                        </div>
                                      )}
                                      {artifactId && (
                                        <div className="font-mono text-[10px] truncate">
                                          id: {artifactId}
                                        </div>
                                      )}
                                      {summary && <div className="line-clamp-3">{summary}</div>}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            <div className="flex items-center gap-3 pt-1 text-[10px]">
                              <span>Started: {new Date(start).toLocaleTimeString()}</span>
                              {end && <span>Ended: {new Date(end).toLocaleTimeString()}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
