/**
 * NextStepsPanel — shown when the Discovery wizard is complete.
 * Visually answers: (i) what to do next and (ii) how to prepare the document.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers,
  ShieldCheck,
  ClipboardList,
  Rocket,
  Pencil,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectId: string;
  onJumpToStage?: (stage: number) => void;
}

type Recommendation = {
  stage: number;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
  icon: React.ComponentType<{ className?: string }>;
};

export default function NextStepsPanel({ projectId, onJumpToStage }: Props) {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("title, content, stage")
        .eq("project_id", projectId);

      const rows = (data || []) as Array<{ title: string; content: any; stage: number }>;
      const find = (needle: string) =>
        rows.find((r) => (r.title || "").toLowerCase().includes(needle))?.content;
      const ripple: any = find("ripple");
      const quality: any = find("quality");
      const impact: any = find("impact") || find("change");

      const out: Recommendation[] = [];

      // Always recommend documentation
      out.push({
        stage: 14,
        label: "Documentation & ADRs",
        reason: "Generate the formal architecture document with your new ADR baked in",
        priority: "high",
        icon: FileText,
      });

      const rippleHigh =
        ripple?.affected_components?.some?.((c: any) => c.impact === "high") ||
        (ripple?.risk_level ?? "").toLowerCase() === "high";
      if (rippleHigh) {
        out.push({
          stage: 11,
          label: "ATAM Risk Analysis",
          reason: "Ripple flagged high-impact components — re-validate architectural risks",
          priority: "high",
          icon: ShieldCheck,
        });
      }

      const qualityRegression = (quality?.attributes || []).some?.(
        (a: any) => (a.delta ?? 0) < 0 || a.status === "degraded",
      );
      if (qualityRegression) {
        out.push({
          stage: 13,
          label: "Trade-off Review",
          reason: "Quality attributes are affected — record trade-off decisions",
          priority: "high",
          icon: Layers,
        });
      }

      const highImpact = (impact?.changes || []).some?.(
        (c: any) => (c.impact_score ?? 0) >= 4,
      );
      if (highImpact || rippleHigh) {
        out.push({
          stage: 16,
          label: "Implementation Plan",
          reason: "Turn the approved change into concrete tasks and sequencing",
          priority: "medium",
          icon: ClipboardList,
        });
      }

      out.push({
        stage: 17,
        label: "Deployment & Rollout",
        reason: "Plan the rollout, feature flags, and rollback path",
        priority: "low",
        icon: Rocket,
      });

      setRecs(out);
      setLoading(false);
    };
    load();
  }, [projectId]);

  const priorityStyles = {
    high: "border-blue-600/40 bg-blue-600/5",
    medium: "border-amber-500/30 bg-amber-500/5",
    low: "border-border bg-muted/20",
  };
  const priorityLabel = {
    high: "Recommended",
    medium: "Suggested",
    low: "Optional",
  };
  const priorityDot = {
    high: "bg-blue-600",
    medium: "bg-amber-500",
    low: "bg-muted-foreground",
  };

  const goStage = (stage: number) => {
    if (onJumpToStage) onJumpToStage(stage);
  };

  return (
    <div className="space-y-4">
      {/* Completion banner */}
      <div className="rounded-xl border-2 border-emerald-600/40 bg-emerald-600/5 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            🎉 Discovery loop complete
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Every decision now has evidence, a component map, ripple analysis, quality delta, an
            ADR, and an implementation plan.
          </div>
        </div>
      </div>

      {/* Two-column: Next stages + Prepare document */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recommended next stages */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-semibold">
              i. What to do next — recommended stages
            </h4>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground italic py-4">
              Analyzing findings…
            </div>
          ) : (
            <div className="space-y-2">
              {recs.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div
                    key={r.stage}
                    className={`rounded-lg border p-3 flex items-start gap-3 ${priorityStyles[r.priority]}`}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${priorityDot[r.priority]}`}
                      />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground w-16">
                        {priorityLabel[r.priority]}
                      </span>
                      <div className="h-7 w-7 rounded-md bg-background border flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5 text-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Stage {r.stage}
                        </span>
                        <span className="text-sm font-semibold">{r.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.reason}</div>
                    </div>
                    <button
                      onClick={() => goStage(r.stage)}
                      className="shrink-0 self-center rounded-md border border-blue-600/40 bg-background hover:bg-blue-600 hover:text-white px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {recs.length === 0 && (
                <div className="text-xs text-muted-foreground italic">
                  No follow-up stages required — the change is self-contained.
                </div>
              )}
            </div>
          )}

          {/* Mini flow diagram */}
          <div className="mt-4 pt-3 border-t">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Flow
            </div>
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
              <span className="rounded-full border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                ✓ Discovery
              </span>
              {recs.map((r) => (
                <span key={r.stage} className="flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="rounded-full border border-blue-600/30 bg-blue-600/5 px-2 py-0.5 text-blue-700 dark:text-blue-300">
                    S{r.stage} · {r.label.split(" ")[0]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Prepare document */}
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/5 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Pencil className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">ii. Prepare the document</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Your wizard outputs feed directly into the architecture document. Open the editor to
            review, refine, and export.
          </p>

          <ol className="space-y-2 text-xs mb-4">
            <li className="flex gap-2">
              <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                1
              </span>
              <span className="text-foreground">
                Auto-pull ADR, ripple, quality & plan into sections
              </span>
            </li>
            <li className="flex gap-2">
              <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                2
              </span>
              <span className="text-foreground">Edit sections & diagrams inline</span>
            </li>
            <li className="flex gap-2">
              <span className="h-4 w-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                3
              </span>
              <span className="text-foreground">Export as PDF, DOCX, Markdown, or JSON</span>
            </li>
          </ol>

          <div className="mt-auto space-y-2">
            <button
              onClick={() => navigate(`/project/${projectId}/document`)}
              className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Open Document Editor
            </button>
            <button
              onClick={() => goStage(14)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Jump to Stage 14 (Docs)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
