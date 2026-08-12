/**
 * AlternativeCompareView (Phase 7) — for the active feature change, generates
 * and compares architecture alternatives with quality scores, pros/cons, and
 * a recommended option. Feeds into ADR authoring.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCw, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EvidencePanel, { type EvidenceRef } from "./EvidencePanel";

interface FeatureChange { id: string; title: string; is_active: boolean }

interface Alternative {
  id: string;
  name: string;
  description: string | null;
  pros: string[] | null;
  cons: string[] | null;
  quality_scores: Record<string, number> | null;
  effort: string | null;
  risk: string | null;
  recommended: boolean;
  evidence_refs: EvidenceRef[] | null;
}

const attrs = ["performance", "security", "availability", "modifiability", "cost", "time_to_market"];

const riskColor: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export default function AlternativeCompareView({ projectId }: { projectId: string }) {
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [alts, setAlts] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedEvId, setSelectedEvId] = useState<string | null>(null);

  const loadChanges = useCallback(async () => {
    const { data } = await supabase
      .from("feature_changes").select("id,title,is_active")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    const list = (data as FeatureChange[]) || [];
    setChanges(list);
    const active = list.find((c) => c.is_active) || list[0];
    if (active && !activeId) setActiveId(active.id);
  }, [projectId, activeId]);

  const loadAlts = useCallback(async (fcId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("architecture_alternatives").select("*").eq("feature_change_id", fcId)
      .order("recommended", { ascending: false }).order("created_at", { ascending: true });
    setAlts((data as unknown as Alternative[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadChanges(); }, [loadChanges]);
  useEffect(() => { if (activeId) void loadAlts(activeId); }, [activeId, loadAlts]);

  const run = async (replace = false) => {
    if (!activeId) return;
    setRunning(true);
    const res = await invokeFunction<{ feature_change_id: string; replace?: boolean }, { alternative_count: number; error?: string }>(
      "generate-alternatives", { feature_change_id: activeId, replace },
    );
    setRunning(false);
    if (!res.ok) { toast.error(errorOf(res)?.message || "Failed"); return; }
    if (res.value?.error) { toast.error(res.value.error); return; }
    toast.success(`${res.value?.alternative_count ?? 0} alternatives generated`);
    void loadAlts(activeId);
  };

  const selectedAlt = alts.find((a) => a.id === selectedEvId);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold">Architecture alternatives</h3>
      </div>
      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a feature change first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={"px-3 py-1 rounded-md text-xs border " + (activeId === c.id
                  ? "bg-blue-600 text-white border-blue-600" : "bg-background border-border hover:bg-muted")}
              >{c.title}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run(false)} disabled={!activeId || running}>
              {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Generate
            </Button>
            {alts.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running}>
                <RotateCw className="h-3 w-3 mr-1" /> Regenerate
              </Button>
            )}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr,320px]">
            <div className="space-y-2">
              {loading ? <p className="text-xs text-muted-foreground">Loading…</p> :
               alts.length === 0 ? <p className="text-xs text-muted-foreground">No alternatives yet. Click Generate.</p> :
               alts.map((a) => (
                <div key={a.id} className={"rounded-lg border p-3 " + (a.recommended ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background")}>
                  <div className="flex items-center gap-2 mb-1">
                    {a.recommended && <Star className="h-3 w-3 text-emerald-600 fill-emerald-600" />}
                    <span className="font-medium text-sm">{a.name}</span>
                    {a.effort && <Badge variant="outline" className="text-[10px]">Effort: {a.effort}</Badge>}
                    {a.risk && <Badge className={"text-[10px] " + (riskColor[a.risk] || "")}>Risk: {a.risk}</Badge>}
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mb-2">{a.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">Pros</div>
                      <ul className="list-disc pl-4 space-y-0.5">{(a.pros || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-medium text-red-700 dark:text-red-300 mb-1">Cons</div>
                      <ul className="list-disc pl-4 space-y-0.5">{(a.cons || []).map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                  </div>
                  {a.quality_scores && Object.keys(a.quality_scores).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {attrs.map((k) => {
                        const v = a.quality_scores?.[k];
                        if (typeof v !== "number") return null;
                        return <Badge key={k} variant="outline" className="text-[10px]">{k}: {v}/5</Badge>;
                      })}
                    </div>
                  )}
                  {(a.evidence_refs || []).length > 0 && (
                    <button
                      onClick={() => setSelectedEvId(a.id === selectedEvId ? null : a.id)}
                      className="mt-2 text-[10px] text-blue-600 hover:underline"
                    >View evidence ({a.evidence_refs?.length})</button>
                  )}
                </div>
              ))}
            </div>
            <EvidencePanel
              title={selectedAlt ? `Evidence · ${selectedAlt.name}` : "Evidence"}
              refs={selectedAlt?.evidence_refs || []}
              emptyLabel="Select an alternative to view its evidence."
            />
          </div>
        </>
      )}
    </div>
  );
}
