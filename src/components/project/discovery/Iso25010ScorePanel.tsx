/**
 * ISO/IEC 25010:2023 As-Is quality scoring surface.
 *
 * Reads persisted rows from `public.quality_scores` produced by the
 * `qa-assessor` edge function. If no rows exist yet, the panel prompts to
 * run the assessor. "Re-run" re-invokes the agent and reloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Gauge, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CHARACTERISTICS = [
  { key: "functional_suitability", label: "Functional suitability" },
  { key: "performance_efficiency", label: "Performance efficiency" },
  { key: "compatibility", label: "Compatibility" },
  { key: "interaction_capability", label: "Interaction capability" },
  { key: "reliability", label: "Reliability" },
  { key: "security", label: "Security" },
  { key: "maintainability", label: "Maintainability" },
  { key: "flexibility", label: "Flexibility" },
  { key: "safety", label: "Safety" },
] as const;

interface Row {
  characteristic: string;
  score: number;
  gap_count: number;
  rationale: string | null;
  computed_at: string;
}

function tone(score: number) {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-blue-500";
  if (score >= 2) return "bg-amber-500";
  return "bg-red-500";
}

export default function Iso25010ScorePanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quality_scores")
      .select("characteristic,score,gap_count,rationale,computed_at")
      .eq("project_id", projectId);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const runAssessor = async () => {
    setRunning(true);
    const r = await discoveryService.assessQuality({ project_id: projectId });
    setRunning(false);
    if (!r.ok) {
      toast.error(errorOf(r)?.message ?? "Failed");
      return;
    }
    toast.success("QA Assessor completed");
    load();
  };

  const view = useMemo(() => {
    const byKey = new Map(rows.map((r) => [r.characteristic, r]));
    return CHARACTERISTICS.map((c) => ({ ...c, row: byKey.get(c.key) }));
  }, [rows]);
  const overall = useMemo(() => {
    const filled = view.filter((v) => v.row);
    if (!filled.length) return "—";
    return (filled.reduce((s, v) => s + Number(v.row!.score), 0) / filled.length).toFixed(1);
  }, [view]);
  const lastRun = rows[0]?.computed_at
    ? new Date(rows[0].computed_at).toLocaleString()
    : null;

  return (
    <section className="rounded-xl border-2 border-blue-600/30 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600/10 via-slate-500/5 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-display text-sm font-bold">ISO/IEC 25010 — As-Is quality</h3>
          <span className="text-[11px] text-muted-foreground">
            {lastRun ? `Last run ${lastRun}` : "Not yet assessed"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Overall <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{overall}</span>/5
          </span>
          <Button size="sm" variant="outline" onClick={runAssessor} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> :
              rows.length ? <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {rows.length ? "Re-run" : "Run QA Assessor"}
          </Button>
        </div>
      </header>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No stored scorecard yet. Run the QA Assessor Agent to generate one.
        </div>
      ) : (
        <div className="divide-y">
          {view.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_180px_60px] items-start gap-3 px-5 py-2.5 text-xs">
              <div>
                <div className="font-medium">{r.label}</div>
                {r.row?.rationale && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{r.row.rationale}</div>
                )}
              </div>
              <div className="h-2 bg-muted rounded overflow-hidden mt-1">
                {r.row && (
                  <div
                    className={cn("h-full transition-all", tone(Number(r.row.score)))}
                    style={{ width: `${(Number(r.row.score) / 5) * 100}%` }}
                  />
                )}
              </div>
              <span className="font-mono text-right tabular-nums mt-1">
                {r.row ? `${Number(r.row.score).toFixed(1)}/5` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
