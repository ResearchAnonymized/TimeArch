/**
 * ImplementationPlanView (Phase 9) — generates and lists work items for a
 * feature change, grouped by category with validation criteria.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCw, ListChecks, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FeatureChange { id: string; title: string; is_active: boolean }
interface WorkItem {
  id: string; title: string; description: string | null;
  category: string; priority: string; effort: string | null; status: string;
  validation_criteria: string[] | null; dependencies: string[] | null;
  ordering: number;
}

const catColor: Record<string, string> = {
  design: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  implementation: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  migration: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  test: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  rollout: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  observability: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  documentation: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  rollback: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};
const priColor: Record<string, string> = {
  critical: "bg-red-600 text-white", high: "bg-amber-600 text-white",
  medium: "bg-blue-600 text-white", low: "bg-slate-600 text-white",
};

export default function ImplementationPlanView({ projectId }: { projectId: string }) {
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
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
    const { data } = await supabase.from("feature_work_items")
      .select("*").eq("feature_change_id", fcId).order("ordering");
    setItems((data as unknown as WorkItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadChanges(); }, [loadChanges]);
  useEffect(() => { if (activeId) void load(activeId); }, [activeId, load]);

  const run = async (replace = false) => {
    if (!activeId) return;
    setRunning(true);
    const res = await invokeFunction<{ feature_change_id: string; replace?: boolean }, { work_item_count: number; error?: string }>(
      "plan-feature-implementation", { feature_change_id: activeId, replace },
    );
    setRunning(false);
    if (!res.ok) return toast.error(errorOf(res)?.message || "Failed");
    if (res.value?.error) return toast.error(res.value.error);
    toast.success(`${res.value?.work_item_count ?? 0} work items generated`);
    void load(activeId);
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("feature_work_items").update({ status }).eq("id", id);
    if (activeId) void load(activeId);
  };
  const remove = async (id: string) => {
    await supabase.from("feature_work_items").delete().eq("id", id);
    if (activeId) void load(activeId);
  };

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-cyan-600" />
        <h3 className="text-sm font-semibold">Implementation plan</h3>
      </div>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a feature change first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={"px-3 py-1 rounded-md text-xs border " + (activeId === c.id
                  ? "bg-cyan-600 text-white border-cyan-600" : "bg-background border-border hover:bg-muted")}
              >{c.title}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run(false)} disabled={!activeId || running}>
              {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ListChecks className="h-3 w-3 mr-1" />}
              Generate plan
            </Button>
            {items.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running}>
                <RotateCw className="h-3 w-3 mr-1" /> Regenerate
              </Button>
            )}
          </div>
          {loading ? <p className="text-xs text-muted-foreground">Loading…</p> :
           items.length === 0 ? <p className="text-xs text-muted-foreground">No plan yet.</p> :
           <ol className="space-y-2">
             {items.map((it, i) => (
               <li key={it.id} className="rounded-lg border border-border bg-background p-3">
                 <div className="flex items-start justify-between gap-2">
                   <div className="min-w-0">
                     <div className="flex flex-wrap items-center gap-1.5">
                       <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                       <Badge className={"text-[10px] " + (catColor[it.category] || "")}>{it.category}</Badge>
                       <Badge className={"text-[10px] " + (priColor[it.priority] || "")}>{it.priority}</Badge>
                       {it.effort && <Badge variant="outline" className="text-[10px]">Effort: {it.effort}</Badge>}
                       <Badge variant={it.status === "done" ? "default" : "outline"} className="text-[10px]">{it.status}</Badge>
                       <span className="font-medium text-sm">{it.title}</span>
                     </div>
                     {it.description && <p className="text-xs text-muted-foreground mt-1">{it.description}</p>}
                     {(it.validation_criteria || []).length > 0 && (
                       <div className="mt-1">
                         <div className="text-[10px] font-medium text-muted-foreground uppercase">Validate</div>
                         <ul className="list-disc pl-4 text-xs space-y-0.5">
                           {it.validation_criteria!.map((v, k) => <li key={k}>{v}</li>)}
                         </ul>
                       </div>
                     )}
                     {(it.dependencies || []).length > 0 && (
                       <p className="text-[10px] text-muted-foreground mt-1">Depends on: {it.dependencies!.join(" · ")}</p>
                     )}
                   </div>
                   <div className="flex flex-col gap-1">
                     {it.status !== "in_progress" && (
                       <Button size="sm" variant="outline" onClick={() => setStatus(it.id, "in_progress")}>Start</Button>
                     )}
                     {it.status !== "done" && (
                       <Button size="sm" variant="outline" onClick={() => setStatus(it.id, "done")}>Done</Button>
                     )}
                     <Button size="sm" variant="ghost" onClick={() => remove(it.id)}>
                       <Trash2 className="h-3 w-3" />
                     </Button>
                   </div>
                 </div>
               </li>
             ))}
           </ol>}
        </>
      )}
    </div>
  );
}
