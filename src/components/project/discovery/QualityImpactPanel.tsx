/**
 * QualityImpactPanel (Phase 6) — per-attribute impact of a feature change.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FeatureChange { id: string; title: string; is_active: boolean }
interface Assessment {
  id: string; attribute: string; direction: "improves" | "degrades" | "neutral";
  severity: "low" | "medium" | "high" | "critical";
  rationale: string | null; mitigations: string[] | null;
}

const dirColor: Record<string, string> = {
  improves: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  degrades: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  neutral: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};
const sevColor: Record<string, string> = {
  critical: "bg-red-600 text-white", high: "bg-amber-600 text-white",
  medium: "bg-blue-600 text-white", low: "bg-slate-600 text-white",
};

export default function QualityImpactPanel({ projectId }: { projectId: string }) {
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadChanges = useCallback(async () => {
    const { data } = await supabase.from("feature_changes")
      .select("id,title,is_active").eq("project_id", projectId).order("created_at", { ascending: false });
    const list = (data as FeatureChange[]) || [];
    setChanges(list);
    const active = list.find((c) => c.is_active) || list[0];
    if (active && !activeId) setActiveId(active.id);
  }, [projectId, activeId]);

  const load = useCallback(async (fcId: string) => {
    setLoading(true);
    const { data } = await supabase.from("quality_impact_assessments")
      .select("*").eq("feature_change_id", fcId).order("attribute");
    setItems((data as unknown as Assessment[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadChanges(); }, [loadChanges]);
  useEffect(() => { if (activeId) void load(activeId); }, [activeId, load]);

  const run = async (replace = false) => {
    if (!activeId) return;
    setRunning(true);
    const res = await invokeFunction<{ feature_change_id: string; replace?: boolean }, { assessment_count: number; error?: string }>(
      "assess-quality-impact", { feature_change_id: activeId, replace },
    );
    setRunning(false);
    if (!res.ok) return toast.error(errorOf(res)?.message || "Failed");
    if (res.value?.error) return toast.error(res.value.error);
    toast.success(`${res.value?.assessment_count ?? 0} attributes assessed`);
    void load(activeId);
  };

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-semibold">Quality attribute impact</h3>
      </div>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a feature change first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={"px-3 py-1 rounded-md text-xs border " + (activeId === c.id
                  ? "bg-purple-600 text-white border-purple-600" : "bg-background border-border hover:bg-muted")}
              >{c.title}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run(false)} disabled={!activeId || running}>
              {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
              Assess
            </Button>
            {items.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running}>
                <RotateCw className="h-3 w-3 mr-1" /> Re-run
              </Button>
            )}
          </div>
          {loading ? <p className="text-xs text-muted-foreground">Loading…</p> :
           items.length === 0 ? <p className="text-xs text-muted-foreground">No assessment yet.</p> :
           <div className="grid gap-2 sm:grid-cols-2">
             {items.map((it) => (
               <div key={it.id} className="rounded-lg border border-border bg-background p-3">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="font-medium text-sm capitalize">{it.attribute}</span>
                   <Badge className={"text-[10px] " + (dirColor[it.direction] || "")}>{it.direction}</Badge>
                   <Badge className={"text-[10px] " + (sevColor[it.severity] || "")}>{it.severity}</Badge>
                 </div>
                 {it.rationale && <p className="text-xs text-muted-foreground">{it.rationale}</p>}
                 {(it.mitigations || []).length > 0 && (
                   <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
                     {it.mitigations!.map((m, i) => <li key={i}>{m}</li>)}
                   </ul>
                 )}
               </div>
             ))}
           </div>}
        </>
      )}
    </div>
  );
}
