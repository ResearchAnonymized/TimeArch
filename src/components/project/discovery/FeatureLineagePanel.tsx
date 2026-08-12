/**
 * FeatureLineagePanel (Phase 10 — observability polish) — end-to-end trace
 * of a feature change across the entire brownfield loop. Counts + click-
 * through summaries so reviewers can audit provenance in one place.
 */
import { useCallback, useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface FeatureChange { id: string; title: string; is_active: boolean; change_type: string }
interface Counts {
  mappings: number; approvedMappings: number;
  ripples: number; confirmedRipples: number;
  quality: number; degrading: number;
  alternatives: number; recommended: number;
  adrs: number; accepted: number;
  work_items: number; done: number;
}

export default function FeatureLineagePanel({ projectId }: { projectId: string }) {
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);

  const loadChanges = useCallback(async () => {
    const { data } = await supabase.from("feature_changes")
      .select("id,title,is_active,change_type").eq("project_id", projectId).order("created_at", { ascending: false });
    const list = (data as FeatureChange[]) || [];
    setChanges(list);
    const active = list.find((c) => c.is_active) || list[0];
    if (active && !activeId) setActiveId(active.id);
  }, [projectId, activeId]);

  const load = useCallback(async (fcId: string) => {
    const [m, r, q, a, d, w] = await Promise.all([
      supabase.from("feature_mappings").select("id,review_status", { count: "exact" }).eq("feature_change_id", fcId),
      supabase.from("impact_findings").select("id,classification", { count: "exact" }).eq("feature_change_id", fcId),
      supabase.from("quality_impact_assessments").select("id,direction", { count: "exact" }).eq("feature_change_id", fcId),
      supabase.from("architecture_alternatives").select("id,recommended", { count: "exact" }).eq("feature_change_id", fcId),
      supabase.from("adr_records").select("id,status", { count: "exact" }).eq("feature_change_id", fcId),
      supabase.from("feature_work_items").select("id,status", { count: "exact" }).eq("feature_change_id", fcId),
    ]);
    setCounts({
      mappings: m.data?.length || 0,
      approvedMappings: (m.data || []).filter((x: any) => x.review_status === "approved").length,
      ripples: r.data?.length || 0,
      confirmedRipples: (r.data || []).filter((x: any) => x.classification === "confirmed").length,
      quality: q.data?.length || 0,
      degrading: (q.data || []).filter((x: any) => x.direction === "degrades").length,
      alternatives: a.data?.length || 0,
      recommended: (a.data || []).filter((x: any) => x.recommended).length,
      adrs: d.data?.length || 0,
      accepted: (d.data || []).filter((x: any) => x.status === "accepted").length,
      work_items: w.data?.length || 0,
      done: (w.data || []).filter((x: any) => x.status === "done").length,
    });
  }, []);

  useEffect(() => { void loadChanges(); }, [loadChanges]);
  useEffect(() => { if (activeId) void load(activeId); }, [activeId, load]);

  const stages = counts ? [
    { key: "map", label: "Mapping", total: counts.mappings, secondary: `${counts.approvedMappings} approved`, done: counts.approvedMappings > 0 },
    { key: "rip", label: "Ripple", total: counts.ripples, secondary: `${counts.confirmedRipples} confirmed`, done: counts.ripples > 0 },
    { key: "qua", label: "Quality", total: counts.quality, secondary: `${counts.degrading} degrading`, done: counts.quality > 0 },
    { key: "alt", label: "Alternatives", total: counts.alternatives, secondary: `${counts.recommended} recommended`, done: counts.recommended > 0 },
    { key: "adr", label: "ADR", total: counts.adrs, secondary: `${counts.accepted} accepted`, done: counts.accepted > 0 },
    { key: "plan", label: "Plan", total: counts.work_items, secondary: `${counts.done} done`, done: counts.work_items > 0 },
  ] : [];

  return (
    <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold">Feature-change lineage</h3>
      </div>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No feature changes yet.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={"px-3 py-1 rounded-md text-xs border " + (activeId === c.id
                  ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                  : "bg-background border-border hover:bg-muted")}
              >{c.title}</button>
            ))}
          </div>
          {counts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {stages.map((s, i) => (
                <div key={s.key} className="relative rounded-lg border border-border bg-background p-3">
                  <div className="text-[10px] uppercase text-muted-foreground">Step {i + 1}</div>
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-xl font-semibold">{s.total}</span>
                    <span className="text-[10px] text-muted-foreground">records</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.secondary}</div>
                  <Badge className={"absolute top-2 right-2 text-[9px] " + (s.done
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30")}>
                    {s.done ? "✓" : "—"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Every step above cites its source via <code>evidence_refs</code> — open a specific step's panel to inspect.
          </p>
        </>
      )}
    </div>
  );
}
