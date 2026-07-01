import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  Scale,
  FileSearch,
  Activity,
  GitBranch,
  Eye,
  Layers,
  ChevronDown,
  ChevronRight,
  Beaker,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import { HelpTip } from "./HelpTip";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
}

interface Dimension {
  dimension: string;
  score: number;
  rating: "strong" | "adequate" | "weak" | "critical";
  rationale: string;
  evidence?: string[];
  findings?: string[];
  recommendations?: string[];
}

const DIMENSION_META: Record<string, { label: string; icon: any; description: string }> = {
  completeness: {
    label: "Completeness",
    icon: CheckCircle2,
    description: "Are all required architectural artifacts and decisions present?",
  },
  consistency: {
    label: "Consistency",
    icon: GitBranch,
    description: "Do decisions align with drivers and with each other?",
  },
  feasibility: {
    label: "Feasibility",
    icon: Target,
    description: "Implementable given team, budget, and timeline?",
  },
  risk: {
    label: "Risk Posture",
    icon: AlertTriangle,
    description: "Severity & likelihood of identified failure modes.",
  },
  traceability: {
    label: "Traceability",
    icon: FileSearch,
    description: "Each decision traces to a requirement/driver (ISO 42010).",
  },
  modifiability: {
    label: "Modifiability",
    icon: Activity,
    description: "Cost of accommodating future change (ISO 25010).",
  },
  testability: {
    label: "Testability",
    icon: Beaker,
    description: "Ease of verification and validation (ISO 25010).",
  },
  tradeoff_balance: {
    label: "Tradeoff Balance",
    icon: Scale,
    description: "Quality attribute tradeoffs are explicit and balanced (ATAM).",
  },
  anti_patterns: {
    label: "Anti-Patterns",
    icon: XCircle,
    description: "Presence of known architectural smells.",
  },
  sensitivity_points: {
    label: "Sensitivity Points",
    icon: TrendingUp,
    description: "Decisions that strongly impact quality attributes (ATAM).",
  },
};

const RATING_STYLES: Record<string, { ring: string; bg: string; text: string; bar: string }> = {
  strong: { ring: "ring-success/30", bg: "bg-success/10", text: "text-success", bar: "bg-success" },
  adequate: {
    ring: "ring-primary/30",
    bg: "bg-primary/10",
    text: "text-primary",
    bar: "bg-primary",
  },
  weak: { ring: "ring-warning/30", bg: "bg-warning/10", text: "text-warning", bar: "bg-warning" },
  critical: {
    ring: "ring-destructive/30",
    bg: "bg-destructive/10",
    text: "text-destructive",
    bar: "bg-destructive",
  },
};

const VERDICT_META: Record<string, { label: string; tone: string; icon: any }> = {
  accept: {
    label: "Accept",
    tone: "text-success bg-success/10 border-success/30",
    icon: ShieldCheck,
  },
  accept_with_revisions: {
    label: "Accept with Revisions",
    tone: "text-primary bg-primary/10 border-primary/30",
    icon: CheckCircle2,
  },
  revise: {
    label: "Revise",
    tone: "text-warning bg-warning/10 border-warning/30",
    icon: AlertTriangle,
  },
  reject: {
    label: "Reject",
    tone: "text-destructive bg-destructive/10 border-destructive/30",
    icon: XCircle,
  },
};

export default function ChallengerEvaluationPanel({ projectId, stage, refreshKey }: Props) {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [showATAM, setShowATAM] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at", { ascending: false });

    const chal = (data || []).find(
      (a: any) =>
        a.generated_by?.includes("Challenger") || a.title?.startsWith("Challenger Review:"),
    );
    if (chal) {
      const content = recoverArtifactContent(chal.content);
      setEvaluation(content);
    } else {
      setEvaluation(null);
    }
    setLoading(false);
  }, [projectId, stage]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading scientific evaluation…
      </div>
    );
  }

  if (!evaluation || !Array.isArray(evaluation.evaluation_dimensions)) {
    return null;
  }

  const verdict = VERDICT_META[evaluation.verdict] || VERDICT_META.revise;
  const VerdictIcon = verdict.icon;
  const dims: Dimension[] = evaluation.evaluation_dimensions || [];
  const atam = evaluation.atam_analysis || {};
  const standards: string[] = evaluation.standards_referenced || [];
  const strengths: string[] = evaluation.strengths_acknowledged || [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card overflow-hidden shadow-sm"
    >
      {/* ── Header ────────────────────────────────────────── */}
      <header className="px-5 py-4 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Swords className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
                Challenger Architect — Scientific Evaluation
                <HelpTip text="Multi-criteria architecture evaluation grounded in ISO/IEC 25010, SEI ATAM, ISO 42010, and TOGAF compliance review." />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed max-w-xl">
                {evaluation.executive_summary}
              </p>
            </div>
          </div>

          {/* Verdict + score */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                Overall Score
              </p>
              <p className="text-2xl font-display font-bold text-foreground tabular-nums">
                {Math.round(evaluation.overall_score)}
                <span className="text-xs text-muted-foreground font-normal">/100</span>
              </p>
              {typeof evaluation.confidence === "number" && (
                <p className="text-[9px] text-muted-foreground">
                  Confidence: {Math.round(evaluation.confidence)}%
                </p>
              )}
            </div>
            <div
              className={cn(
                "px-3 py-2 rounded-lg border flex items-center gap-1.5 text-xs font-medium",
                verdict.tone,
              )}
            >
              <VerdictIcon className="h-3.5 w-3.5" />
              {verdict.label}
            </div>
          </div>
        </div>

        {/* Standards row */}
        {standards.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Standards applied:
            </span>
            {standards.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[9px] font-mono">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* ── Dimensions Grid ───────────────────────────────── */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Evaluation Dimensions
          </h4>
          <span className="text-[10px] text-muted-foreground">{dims.length} criteria assessed</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {dims.map((d, i) => {
            const meta = DIMENSION_META[d.dimension] || {
              label: d.dimension,
              icon: Eye,
              description: "",
            };
            const Icon = meta.icon;
            const styles = RATING_STYLES[d.rating] || RATING_STYLES.adequate;
            const isOpen = expandedDim === d.dimension;
            const score = Math.max(0, Math.min(100, Math.round(d.score)));

            return (
              <motion.div
                key={d.dimension}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "rounded-lg border bg-background overflow-hidden transition-all",
                  isOpen && "ring-1 ring-primary/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedDim(isOpen ? null : d.dimension)}
                  className="w-full text-left p-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
                        styles.bg,
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", styles.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">{meta.label}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded",
                              styles.bg,
                              styles.text,
                            )}
                          >
                            {d.rating}
                          </span>
                          <span className="text-xs font-mono tabular-nums font-semibold">
                            {score}
                          </span>
                          {isOpen ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.6, delay: i * 0.03 }}
                          className={cn("h-full rounded-full", styles.bar)}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                        {d.rationale}
                      </p>
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-border/40">
                        <p className="text-[10px] text-muted-foreground italic mt-2">
                          {meta.description}
                        </p>

                        {d.findings && d.findings.length > 0 && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">
                              Findings
                            </p>
                            <ul className="space-y-1">
                              {d.findings.map((f, j) => (
                                <li
                                  key={j}
                                  className="text-[11px] text-muted-foreground flex gap-1.5 leading-relaxed"
                                >
                                  <span className="text-primary flex-shrink-0">•</span>
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {d.evidence && d.evidence.length > 0 && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">
                              Evidence
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {d.evidence.map((e, j) => (
                                <span
                                  key={j}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/5 border border-primary/20 text-primary"
                                >
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {d.recommendations && d.recommendations.length > 0 && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-foreground/70 mb-1">
                              Recommendations
                            </p>
                            <ul className="space-y-1">
                              {d.recommendations.map((r, j) => (
                                <li
                                  key={j}
                                  className="text-[11px] text-foreground/80 flex gap-1.5 leading-relaxed"
                                >
                                  <span className="text-success flex-shrink-0">→</span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="mt-4 p-3 rounded-lg border border-success/20 bg-success/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Strengths Acknowledged
            </p>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5 leading-relaxed">
                  <span className="text-success flex-shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ATAM analysis (collapsible) */}
        {atam.sensitivity_points?.length || atam.tradeoff_points?.length || atam.risks?.length ? (
          <div className="mt-4 rounded-lg border bg-secondary/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowATAM(!showATAM)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-secondary/40 transition-colors"
            >
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Beaker className="h-3.5 w-3.5 text-primary" />
                ATAM Analysis
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({atam.sensitivity_points?.length || 0} sensitivity ·{" "}
                  {atam.tradeoff_points?.length || 0} tradeoffs · {atam.risks?.length || 0} risks)
                </span>
              </span>
              {showATAM ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <AnimatePresence>
              {showATAM && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 space-y-3 border-t">
                    {atam.sensitivity_points?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">
                          Sensitivity Points
                        </p>
                        {atam.sensitivity_points.map((sp: any, i: number) => (
                          <div
                            key={i}
                            className="text-[11px] p-2 rounded bg-card border border-border/40 mb-1.5"
                          >
                            <p className="font-medium">{sp.decision}</p>
                            <p className="text-muted-foreground mt-0.5">{sp.impact}</p>
                            {sp.affected_attributes?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {sp.affected_attributes.map((a: string, j: number) => (
                                  <span
                                    key={j}
                                    className="text-[9px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary"
                                  >
                                    {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {atam.tradeoff_points?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-warning mb-1.5">
                          Tradeoff Points
                        </p>
                        {atam.tradeoff_points.map((tp: any, i: number) => (
                          <div
                            key={i}
                            className="text-[11px] p-2 rounded bg-card border border-border/40 mb-1.5"
                          >
                            <p className="font-medium">{tp.decision}</p>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                              <div>
                                <p className="text-[9px] uppercase text-success font-semibold">
                                  Gains
                                </p>
                                <ul className="space-y-0.5">
                                  {(tp.gains || []).map((g: string, j: number) => (
                                    <li key={j} className="text-muted-foreground">
                                      + {g}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase text-destructive font-semibold">
                                  Sacrifices
                                </p>
                                <ul className="space-y-0.5">
                                  {(tp.sacrifices || []).map((s: string, j: number) => (
                                    <li key={j} className="text-muted-foreground">
                                      − {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {atam.risks?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1.5">
                          Risks
                        </p>
                        {atam.risks.map((r: any, i: number) => (
                          <div
                            key={i}
                            className="text-[11px] p-2 rounded bg-card border border-border/40 mb-1.5"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{r.risk}</span>
                              <Badge variant="outline" className="text-[9px]">
                                {r.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[9px]">
                                likelihood: {r.likelihood}
                              </Badge>
                            </div>
                            {r.mitigation && (
                              <p className="text-muted-foreground mt-1">
                                Mitigation: {r.mitigation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {atam.non_risks?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-success mb-1.5">
                          Non-Risks (verified safe)
                        </p>
                        <ul className="space-y-0.5">
                          {atam.non_risks.map((n: string, i: number) => (
                            <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                              <span className="text-success">✓</span>
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}

        {/* Final assessment footer */}
        {evaluation.final_assessment && (
          <div className="mt-3 p-3 rounded-lg border-l-2 border-primary bg-primary/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
              Final Assessment
            </p>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {evaluation.final_assessment}
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}
