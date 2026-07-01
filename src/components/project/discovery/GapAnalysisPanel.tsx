import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Gap {
  id: string;
  category: string;
  framework: string;
  title: string;
  description: string | null;
  current_state: string | null;
  target_state: string | null;
  severity: "low" | "medium" | "high" | "critical";
  effort: "low" | "medium" | "high";
  recommendation: string | null;
  status: string;
  created_at: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};
const EFFORT_STYLE: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-600",
  low: "bg-emerald-500/10 text-emerald-600",
};

interface Props {
  projectId: string;
}

export default function GapAnalysisPanel({ projectId }: Props) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "iso_25010" | "aws_wa" | "iso_29148">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("architecture_gaps")
      .select("*")
      .eq("project_id", projectId)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setGaps((data as Gap[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRun = async (replace: boolean) => {
    setRunning(true);
    try {
      const res = await callAuthenticatedFunction<{ gap_count: number; error?: string }>(
        "gap-analyzer",
        { project_id: projectId, replace },
      );
      if (res.error) throw new Error(res.error);
      toast.success(`Identified ${res.gap_count} gap${res.gap_count === 1 ? "" : "s"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Gap analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: string, status: "resolved" | "wontfix") => {
    const { error } = await supabase.from("architecture_gaps").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "resolved" ? "Marked resolved" : "Dismissed");
    await load();
  };

  const filtered = gaps.filter(
    (g) => g.status === "open" && (filter === "all" || g.framework === filter),
  );
  const counts = {
    critical: gaps.filter((g) => g.status === "open" && g.severity === "critical").length,
    high: gaps.filter((g) => g.status === "open" && g.severity === "high").length,
    medium: gaps.filter((g) => g.status === "open" && g.severity === "medium").length,
    low: gaps.filter((g) => g.status === "open" && g.severity === "low").length,
  };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold mb-1">Gap Analysis (Brownfield)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Compares the as-is reverse-engineered artifacts against ISO/IEC 25010 quality
              characteristics and AWS Well-Architected pillars. Each gap feeds the Evolution Plan.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleRun(false)} disabled={running}>
              {running ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              Analyze
            </Button>
            {gaps.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => handleRun(true)} disabled={running}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Re-run
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Severity summary */}
      {gaps.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <div key={sev} className={cn("rounded-md border p-3", SEVERITY_STYLE[sev])}>
              <p className="text-2xl font-display font-bold tabular-nums">{counts[sev]}</p>
              <p className="text-[10px] uppercase tracking-wide font-semibold">{sev}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {gaps.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "iso_25010", "aws_wa", "iso_29148"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 rounded border font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {f === "all"
                ? "All"
                : f === "iso_25010"
                  ? "ISO 25010"
                  : f === "aws_wa"
                    ? "AWS WA"
                    : "ISO 29148"}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          {gaps.length === 0 ? (
            <>
              <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-display font-bold mb-1">No analysis yet</p>
              <p className="text-xs text-muted-foreground">
                Click <em>Analyze</em> to identify gaps from your reverse-engineered artifacts.
              </p>
            </>
          ) : (
            <>
              <ShieldCheck className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-display font-bold">No open gaps in this filter</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <div key={g.id} className="rounded-md border bg-card p-3.5">
              <div className="flex items-start gap-2 mb-2">
                <Badge className={cn("text-[9px] border", SEVERITY_STYLE[g.severity])}>
                  {g.severity}
                </Badge>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {g.framework.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="text-[9px]">
                  {g.category}
                </Badge>
                <Badge className={cn("text-[9px] ml-auto", EFFORT_STYLE[g.effort])}>
                  {g.effort} effort
                </Badge>
              </div>
              <h4 className="font-display font-semibold text-sm mb-1.5">{g.title}</h4>
              {g.current_state && (
                <p className="text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground/70">As-is:</span> {g.current_state}
                </p>
              )}
              {g.target_state && (
                <p className="text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-foreground/70">To-be:</span> {g.target_state}
                </p>
              )}
              {g.recommendation && (
                <p className="text-xs mt-2 p-2 rounded bg-primary/5 border-l-2 border-primary">
                  <span className="font-semibold">Recommendation:</span> {g.recommendation}
                </p>
              )}
              <div className="flex justify-end gap-1 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleResolve(g.id, "wontfix")}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Dismiss
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleResolve(g.id, "resolved")}
                >
                  <ShieldCheck className="h-3 w-3 mr-1" /> Resolve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
