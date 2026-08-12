import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Route,
  Save,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Layers,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Gap {
  id: string;
  title: string;
  category: string;
  framework: string;
  severity: "low" | "medium" | "high" | "critical";
  effort: "low" | "medium" | "high";
  recommendation: string | null;
  current_state: string | null;
  target_state: string | null;
  status: string;
}

interface Wave {
  id: string;
  name: string;
  goal: string;
  pattern: string;
  gaps: Gap[];
}

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const EFF_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

function computeWaves(gaps: Gap[]): Wave[] {
  const open = gaps.filter((g) => g.status === "open");
  const sorted = [...open].sort((a, b) => {
    const score = (g: Gap) => SEV_RANK[g.severity] * 2 - EFF_RANK[g.effort];
    return score(b) - score(a);
  });
  const waves: Wave[] = [
    {
      id: "wave-0",
      name: "Wave 0 — Stabilize",
      goal: "Eliminate critical/high risk gaps with low or medium effort first.",
      pattern: "Quick wins · Strangler entry points",
      gaps: [],
    },
    {
      id: "wave-1",
      name: "Wave 1 — Strangle",
      goal: "Wrap legacy seams with new façades, replace one bounded context at a time.",
      pattern: "Strangler Fig · Branch by Abstraction",
      gaps: [],
    },
    {
      id: "wave-2",
      name: "Wave 2 — Modernise",
      goal: "Address structural and observability debt across remaining components.",
      pattern: "Anti-Corruption Layer · Event Interception",
      gaps: [],
    },
    {
      id: "wave-3",
      name: "Wave 3 — Optimise",
      goal: "Polish, low-priority refinements and long-tail hardening.",
      pattern: "Continuous improvement",
      gaps: [],
    },
  ];
  for (const g of sorted) {
    if ((g.severity === "critical" || g.severity === "high") && g.effort !== "high")
      waves[0].gaps.push(g);
    else if (g.severity === "high" || (g.severity === "medium" && g.effort === "high"))
      waves[1].gaps.push(g);
    else if (g.severity === "medium") waves[2].gaps.push(g);
    else waves[3].gaps.push(g);
  }
  return waves;
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-destructive/70",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

interface Props {
  projectId: string;
}

export default function EvolutionPlanWorkspace({ projectId }: Props) {
  const { user } = useAuth();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: gapData }, { data: artData }] = await Promise.all([
      supabase
        .from("architecture_gaps")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("architecture_artifacts")
        .select("created_at")
        .eq("project_id", projectId)
        .eq("stage", 16)
        .eq("type", "executive_summary")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setGaps((gapData as Gap[]) || []);
    setSavedAt(artData?.[0]?.created_at || null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const waves = useMemo(() => computeWaves(gaps), [gaps]);
  const openCount = gaps.filter((g) => g.status === "open").length;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const content = {
        _meta: { provenance: "brownfield-evolution-plan", generated_at: new Date().toISOString() },
        summary: `Evolution roadmap derived from ${openCount} open architectural gap${openCount === 1 ? "" : "s"}.`,
        method: "Strangler Fig migration with risk-ranked waves (severity × effort).",
        total_open_gaps: openCount,
        waves: waves.map((w) => ({
          name: w.name,
          goal: w.goal,
          pattern: w.pattern,
          item_count: w.gaps.length,
          items: w.gaps.map((g) => ({
            id: g.id,
            title: g.title,
            severity: g.severity,
            effort: g.effort,
            recommendation: g.recommendation,
          })),
        })),
      };
      const { error } = await supabase.from("architecture_artifacts").insert({
        project_id: projectId,
        stage: 16,
        type: "executive_summary",
        title: "Evolution Plan (Brownfield Migration Roadmap)",
        status: "draft",
        generated_by: "Evolution Planner (Brownfield)",
        created_by: user.id,
        content,
      });
      if (error) throw error;
      toast.success("Evolution plan saved as Stage 16 artifact");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (openCount === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
        <ShieldAlert className="h-7 w-7 text-muted-foreground mx-auto mb-3" />
        <h2 className="font-display font-bold text-lg mb-1">No open gaps to plan against</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Run the <em>Gap Analyzer</em> on Stage 11 first — the Evolution Plan turns open gaps into
          a risk-ranked migration roadmap.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Route className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold mb-1">Evolution Plan</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Strangler Fig migration roadmap. Waves are ordered by{" "}
              <span className="font-mono text-foreground/80">severity × (1 / effort)</span> and
              grouped by typical refactoring phase. Edit by resolving / dismissing gaps on Stage 11.
            </p>
            {savedAt && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Last saved as artifact: {new Date(savedAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save as artifact
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {waves.map((w) => (
          <div key={w.id} className="rounded-md border bg-card p-3">
            <p className="text-2xl font-display font-bold tabular-nums">{w.gaps.length}</p>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              {w.name.replace(/^Wave \d+ — /, "")}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {waves.map((w, idx) => (
          <div key={w.id} className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-display font-bold">
                {idx}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-sm">{w.name}</h3>
                <p className="text-[11px] text-muted-foreground">{w.goal}</p>
              </div>
              <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                <GitBranch className="h-3 w-3 mr-1" />
                {w.pattern}
              </Badge>
              <Badge className="text-[10px]">
                {w.gaps.length} item{w.gaps.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {w.gaps.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground italic">
                No items in this wave.
              </p>
            ) : (
              <ul className="divide-y">
                {w.gaps.map((g) => (
                  <li key={g.id} className="px-4 py-2.5 flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                        SEV_DOT[g.severity],
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{g.title}</p>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {g.framework.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {g.category}
                        </Badge>
                      </div>
                      {g.recommendation && (
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                          <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                          <span>{g.recommendation}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
                      <span className="px-1.5 py-0.5 rounded bg-muted">{g.severity}</span>
                      <span className="px-1.5 py-0.5 rounded bg-muted">{g.effort} effort</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground flex items-start gap-2">
        <Layers className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          <span className="font-semibold text-foreground">How it works:</span> Wave 0 collects
          critical/high gaps with manageable effort (quick wins). Wave 1 wraps legacy seams using
          Strangler Fig / Branch by Abstraction. Wave 2 addresses structural modernisation. Wave 3
          captures long-tail polish. Save the plan as a Stage 16 artifact to lock the baseline.
        </p>
      </div>
    </div>
  );
}
