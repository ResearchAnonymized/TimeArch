/**
 * 7R Modernization Roadmap.
 *
 * Reads persisted rows from `public.modernization_items` produced by the
 * `modernization-planner` edge function. Empty state prompts running the
 * planner; "Re-run" re-invokes and reloads.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, ArrowUpDown, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Action = "Retain" | "Rehost" | "Replatform" | "Refactor" | "Repurchase" | "Retire" | "Relocate";

const ACTION_STYLE: Record<string, string> = {
  Retain: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  Rehost: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  Replatform: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
  Refactor: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  Repurchase: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  Retire: "bg-red-500/10 text-red-700 border-red-500/30",
  Relocate: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

interface Row {
  id: string;
  name: string;
  action: Action;
  effort: number;
  impact: number;
  roi: number;
  rationale: string | null;
  computed_at: string;
}

export default function SevenRRoadmapPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [sortBy, setSortBy] = useState<"roi" | "effort" | "impact">("roi");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("modernization_items")
      .select("id,name,action,effort,impact,roi,rationale,computed_at")
      .eq("project_id", projectId);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const runPlanner = async () => {
    setRunning(true);
    const r = await discoveryService.planModernization({ project_id: projectId });
    setRunning(false);
    if (!r.ok) {
      toast.error(errorOf(r)?.message ?? "Failed");
      return;
    }
    const data = (r as any).data ?? {};
    if (data.error) {
      toast.warning(data.error);
    } else if (!data.items?.length) {
      toast.warning("Planner produced 0 items — no reverse-engineered components available yet.");
    } else {
      toast.success(`Modernization Planner produced ${data.items.length} item(s)`);
    }
    load();
  };


  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      sortBy === "roi" ? Number(b.roi) - Number(a.roi)
        : sortBy === "effort" ? a.effort - b.effort
          : b.impact - a.impact,
    );
  }, [rows, sortBy]);
  const lastRun = rows[0]?.computed_at ? new Date(rows[0].computed_at).toLocaleString() : null;

  return (
    <section className="rounded-xl border-2 border-blue-600/30 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600/10 via-slate-500/5 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-display text-sm font-bold">7R Modernization Roadmap</h3>
          <span className="text-[11px] text-muted-foreground">
            {rows.length} items{lastRun ? ` · last run ${lastRun}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px]">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            {(["roi", "impact", "effort"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  "px-2 py-0.5 rounded border font-medium",
                  sortBy === s ? "border-blue-600/60 bg-blue-600/10 text-blue-700" : "border-transparent text-muted-foreground hover:border-border",
                )}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={runPlanner} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> :
              rows.length ? <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {rows.length ? "Re-run" : "Run Planner"}
          </Button>
        </div>
      </header>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No roadmap yet. Run the Modernization Planner to generate one.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Item</th>
                <th className="text-left px-2 py-2 font-semibold">7R action</th>
                <th className="text-right px-2 py-2 font-semibold">Effort</th>
                <th className="text-right px-2 py-2 font-semibold">Impact</th>
                <th className="text-right px-4 py-2 font-semibold">ROI</th>
                <th className="text-left px-4 py-2 font-semibold">Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono">{r.name}</td>
                  <td className="px-2 py-2">
                    <span className={cn(
                      "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border",
                      ACTION_STYLE[r.action] ?? ACTION_STYLE.Rehost,
                    )}>
                      {r.action}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.effort}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.impact}</td>
                  <td className={cn(
                    "px-4 py-2 text-right tabular-nums font-bold",
                    Number(r.roi) >= 2 ? "text-emerald-600" : Number(r.roi) >= 1 ? "text-blue-600" : "text-amber-600",
                  )}>
                    {Number(r.roi).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
