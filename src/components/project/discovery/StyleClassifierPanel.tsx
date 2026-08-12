/**
 * Architectural Style Classifier panel (Brownfield). Invokes the
 * `style-classifier` edge function and renders the predicted style,
 * confidence, evidence bullets, and per-driver fit.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Layers, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import { toast } from "sonner";

interface Result {
  primary: string;
  secondary: string | null;
  confidence: "low" | "med" | "high";
  evidence: string[];
  drivers_fit: Array<{ driver: string; fit: string; note: string }>;
  computed_at?: string;
}

const fmt = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function StyleClassifierPanel({ projectId }: { projectId: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("system_style")
      .select("primary_style,secondary_style,confidence,evidence,drivers_fit,computed_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      setResult({
        primary: data.primary_style,
        secondary: data.secondary_style,
        confidence: data.confidence as Result["confidence"],
        evidence: (data.evidence as string[]) ?? [],
        drivers_fit: (data.drivers_fit as Result["drivers_fit"]) ?? [],
        computed_at: data.computed_at,
      });
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    const r = await discoveryService.classifyStyle({ project_id: projectId });
    setRunning(false);
    if (!r.ok) {
      toast.error(errorOf(r)?.message ?? "Failed");
      return;
    }
    toast.success("Style classified");
    load();
  };

  return (
    <section className="rounded-xl border-2 border-blue-600/30 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600/10 via-slate-500/5 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-display text-sm font-bold">Architectural style — classifier</h3>
          {result?.computed_at && (
            <span className="text-[11px] text-muted-foreground">
              Last run {new Date(result.computed_at).toLocaleString()}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> :
            result ? <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          {result ? "Re-classify" : "Classify"}
        </Button>
      </header>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !result ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">Run the classifier to detect the observed architectural style across the imported evidence.</p>
      ) : (
        <div className="p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Primary style</span>
            <span className="rounded bg-blue-600/10 border border-blue-600/40 px-2 py-0.5 font-mono font-bold text-blue-700 dark:text-blue-300">{fmt(result.primary)}</span>
            {result.secondary && (
              <>
                <span className="text-[11px] text-muted-foreground">Secondary</span>
                <span className="rounded bg-slate-500/10 border border-slate-500/40 px-2 py-0.5 font-mono text-slate-700 dark:text-slate-300">{fmt(result.secondary)}</span>
              </>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">Confidence <span className="font-mono font-bold uppercase">{result.confidence}</span></span>
          </div>
          {result.evidence.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Evidence</h4>
              <ul className="list-disc pl-5 space-y-1">
                {result.evidence.map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            </div>
          )}
          {result.drivers_fit.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Driver fit</h4>
              <table className="w-full text-left">
                <thead className="text-[11px] text-muted-foreground">
                  <tr><th className="py-1">Driver</th><th>Fit</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {result.drivers_fit.map((d, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-2">{d.driver}</td>
                      <td className="pr-2 font-mono uppercase">{d.fit}</td>
                      <td className="text-muted-foreground">{d.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
