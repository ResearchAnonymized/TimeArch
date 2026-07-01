import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Swords,
  ShieldCheck,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Scale,
  Loader2,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChallengerDecisions } from "@/hooks/useChallengerDecisions";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
}

interface DriverRow {
  id: string;
  label: string;
  category: string | null;
  priority: string;
  description: string | null;
}

interface DimensionRow {
  dimension: string;
  score: number;
  rating?: string;
  rationale?: string;
}

interface ConflictRow {
  driver: DriverRow;
  reasons: string[];
  worstSeverity: "critical" | "high" | "medium" | "low";
  weakestDimensionScore: number | null;
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const DIMENSION_DRIVER_KEYWORDS: Record<string, string[]> = {
  modifiability: ["maintainability", "modifiability", "extensibility", "evolvability"],
  testability: ["testability", "quality", "verification"],
  risk: ["reliability", "availability", "security", "compliance"],
  feasibility: ["cost", "team", "delivery", "time", "schedule"],
  consistency: ["consistency", "integrity"],
  traceability: ["compliance", "audit", "governance"],
  tradeoff_balance: ["performance", "scalability", "cost"],
  anti_patterns: ["maintainability", "complexity"],
  sensitivity_points: ["performance", "scalability", "availability", "security"],
  completeness: ["compliance", "governance"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  scalability: ["scalability", "throughput", "load", "growth"],
  performance: ["performance", "latency", "response", "speed"],
  security: ["security", "auth", "encryption", "privacy", "compliance"],
  cost: ["cost", "budget", "spend", "tco"],
  complexity: ["complexity", "maintainability", "modifiability"],
  maintainability: ["maintainability", "modifiability", "extensibility"],
  reliability: ["reliability", "availability", "resilience", "uptime"],
  operability: ["operability", "observability", "deployability"],
  team_fit: ["team", "skill", "cognitive", "delivery"],
  data: ["data", "consistency", "integrity"],
  compliance: ["compliance", "governance", "audit", "regulatory"],
};

function severityColor(sev: ConflictRow["worstSeverity"]) {
  switch (sev) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "high":
      return "bg-warning/10 text-warning border-warning/30";
    case "medium":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function scoreTone(score: number) {
  if (score >= 75) return { bar: "bg-success", text: "text-success" };
  if (score >= 55) return { bar: "bg-primary", text: "text-primary" };
  if (score >= 35) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-destructive", text: "text-destructive" };
}

function verdictMeta(v: string | null | undefined) {
  const verdict = String(v || "").toLowerCase();
  if (verdict === "accept" || verdict === "approved" || verdict === "approve") {
    return {
      label: "Agreed",
      tone: "border-success/30 bg-success/5",
      pill: "bg-success/15 text-success border-success/30",
      Icon: ThumbsUp,
      headline: "The Challenger AGREED with the recommendation",
      explainer:
        "The Challenger Architect found no material reason to reject the chosen architectural style. The recommendation aligns with the project's drivers and the supporting evidence holds up under independent review.",
    };
  }
  if (
    verdict === "accept_with_revisions" ||
    verdict === "approve_with_revisions" ||
    verdict === "approve_with_minor_revisions"
  ) {
    return {
      label: "Agreed with revisions",
      tone: "border-warning/30 bg-warning/5",
      pill: "bg-warning/15 text-warning border-warning/30",
      Icon: Scale,
      headline: "The Challenger AGREED — with revisions",
      explainer:
        "The Challenger accepts the chosen style in principle, but raised specific concerns the architect should address before locking the stage.",
    };
  }
  if (verdict === "revise") {
    return {
      label: "Challenged — revise",
      tone: "border-warning/40 bg-warning/5",
      pill: "bg-warning/15 text-warning border-warning/30",
      Icon: AlertTriangle,
      headline: "The Challenger CHALLENGED the recommendation",
      explainer:
        "The Challenger believes the recommendation needs rework. Material concerns were raised — review the conflicting drivers and weakest dimensions below before proceeding.",
    };
  }
  if (verdict === "reject") {
    return {
      label: "Rejected",
      tone: "border-destructive/40 bg-destructive/5",
      pill: "bg-destructive/15 text-destructive border-destructive/30",
      Icon: ThumbsDown,
      headline: "The Challenger REJECTED the recommendation",
      explainer:
        "The Challenger believes the chosen style is unfit for this project's drivers. Strongly consider an alternative before locking the stage.",
    };
  }
  return {
    label: "Pending",
    tone: "border-border bg-card",
    pill: "bg-muted text-muted-foreground border-border",
    Icon: Swords,
    headline: "Challenger verdict pending",
    explainer: "Run the Challenger Architect to get an independent verdict on the recommendation.",
  };
}

export default function ChallengerSummaryPanel({ projectId, stage, refreshKey }: Props) {
  const { loading, reviewMeta, concerns } = useChallengerDecisions(projectId, stage, refreshKey);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDriversLoading(true);
      const { data } = await supabase
        .from("architecture_drivers")
        .select("id,label,category,priority,description")
        .eq("project_id", projectId)
        .order("priority", { ascending: true });
      if (!cancelled) {
        setDrivers((data || []) as DriverRow[]);
        setDriversLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const dimensions: DimensionRow[] = useMemo(() => {
    const arr = Array.isArray(reviewMeta?.evaluation_dimensions)
      ? (reviewMeta.evaluation_dimensions as DimensionRow[])
      : [];
    return [...arr].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  }, [reviewMeta]);

  const tradeoffSacrifices: string[] = useMemo(() => {
    const tps = reviewMeta?.atam_analysis?.tradeoff_points;
    if (!Array.isArray(tps)) return [];
    const out: string[] = [];
    for (const tp of tps) {
      if (Array.isArray(tp?.sacrifices)) {
        for (const s of tp.sacrifices) if (typeof s === "string") out.push(s);
      }
    }
    return out;
  }, [reviewMeta]);

  // Compute conflicting drivers: a driver is "conflicting" if any concern,
  // weak dimension, or tradeoff sacrifice can be matched to it via keyword.
  const conflicts: ConflictRow[] = useMemo(() => {
    if (!drivers.length) return [];

    const driverHaystack = (d: DriverRow) =>
      `${d.label} ${d.category ?? ""} ${d.description ?? ""}`.toLowerCase();

    const matchKeywords = (text: string, keywords: string[]) =>
      keywords.some((k) => text.includes(k));

    const map = new Map<string, ConflictRow>();

    const ensure = (d: DriverRow) => {
      if (!map.has(d.id)) {
        map.set(d.id, {
          driver: d,
          reasons: [],
          worstSeverity: "low",
          weakestDimensionScore: null,
        });
      }
      return map.get(d.id)!;
    };

    // 1. Concerns: match concern.category + issue text against driver keywords/text.
    for (const c of concerns || []) {
      const cat = String(c?.category || "").toLowerCase();
      const issue = String(c?.issue || "").toLowerCase();
      const sev = String(c?.severity || "medium").toLowerCase() as ConflictRow["worstSeverity"];
      const catKeywords = CATEGORY_KEYWORDS[cat] || [];
      for (const d of drivers) {
        const hay = driverHaystack(d);
        const matched =
          (cat && hay.includes(cat)) ||
          (catKeywords.length && matchKeywords(hay, catKeywords)) ||
          (issue && d.label && issue.includes(d.label.toLowerCase()));
        if (matched) {
          const row = ensure(d);
          if (SEVERITY_RANK[sev] > SEVERITY_RANK[row.worstSeverity]) row.worstSeverity = sev;
          const reason = `${sev.toUpperCase()} concern: ${c.issue}`;
          if (!row.reasons.includes(reason)) row.reasons.push(reason);
        }
      }
    }

    // 2. Weak dimensions (score < 60): match dimension keywords to drivers.
    for (const dim of dimensions) {
      if ((dim.score ?? 100) >= 60) continue;
      const keywords = DIMENSION_DRIVER_KEYWORDS[dim.dimension] || [];
      if (!keywords.length) continue;
      for (const d of drivers) {
        const hay = driverHaystack(d);
        if (matchKeywords(hay, keywords)) {
          const row = ensure(d);
          row.weakestDimensionScore = Math.min(row.weakestDimensionScore ?? 100, dim.score ?? 0);
          const reason = `Weak ${dim.dimension.replace(/_/g, " ")} (${Math.round(dim.score)}/100)`;
          if (!row.reasons.includes(reason)) row.reasons.push(reason);
        }
      }
    }

    // 3. Tradeoff sacrifices: match each sacrifice text against driver text.
    for (const sac of tradeoffSacrifices) {
      const lower = sac.toLowerCase();
      for (const d of drivers) {
        const hay = driverHaystack(d);
        const labelHit = d.label && lower.includes(d.label.toLowerCase());
        const catHit = d.category && lower.includes(d.category.toLowerCase());
        if (labelHit || catHit || hay.split(/\s+/).some((w) => w.length > 4 && lower.includes(w))) {
          const row = ensure(d);
          const reason = `Tradeoff sacrifice: ${sac}`;
          if (!row.reasons.includes(reason)) row.reasons.push(reason);
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        const sev = SEVERITY_RANK[b.worstSeverity] - SEVERITY_RANK[a.worstSeverity];
        if (sev !== 0) return sev;
        return (a.weakestDimensionScore ?? 100) - (b.weakestDimensionScore ?? 100);
      })
      .slice(0, 5);
  }, [drivers, concerns, dimensions, tradeoffSacrifices]);

  if (loading || driversLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading Challenger summary…
      </div>
    );
  }

  if (!reviewMeta) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Swords className="h-3.5 w-3.5" />
        Run the Challenger Architect to see why it would challenge or agree with this
        recommendation.
      </div>
    );
  }

  const meta = verdictMeta(reviewMeta.verdict);
  const Icon = meta.Icon;
  const confidence =
    typeof reviewMeta.confidence === "number" ? Math.round(reviewMeta.confidence) : null;
  const overall =
    typeof reviewMeta.overall_score === "number" ? Math.round(reviewMeta.overall_score) : null;
  const summary: string = reviewMeta.executive_summary || reviewMeta.summary || "";
  const finalAssessment: string = reviewMeta.final_assessment || "";

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-lg border overflow-hidden", meta.tone)}
    >
      {/* Header — verdict + scores */}
      <div className="px-4 py-3 border-b bg-background/40">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-background border flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Challenger Summary
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                  meta.pill,
                )}
              >
                {meta.label}
              </span>
              {overall !== null && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-background tabular-nums">
                  Score {overall}/100
                </span>
              )}
              {confidence !== null && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-background tabular-nums">
                  {confidence}% confidence
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-1">{meta.headline}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{meta.explainer}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Why — executive narrative */}
        {(summary || finalAssessment) && (
          <div className="rounded-md border bg-background/60 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Info className="h-3 w-3" />
              Why the Challenger reached this verdict
            </div>
            {summary && (
              <p className="text-[12.5px] leading-relaxed text-foreground/90">{summary}</p>
            )}
            {finalAssessment && (
              <p className="text-[11.5px] leading-relaxed text-muted-foreground italic">
                {finalAssessment}
              </p>
            )}
          </div>
        )}

        {/* Top conflicting drivers */}
        <div className="rounded-md border bg-background/60 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <AlertTriangle className="h-3 w-3" />
            Top conflicting architectural drivers
          </div>
          {conflicts.length === 0 ? (
            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground italic">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              No drivers materially conflict with the recommendation according to this review.
            </div>
          ) : (
            <ul className="space-y-2">
              {conflicts.map(({ driver, reasons, worstSeverity, weakestDimensionScore }) => (
                <li key={driver.id} className="rounded-md border bg-card p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-foreground">
                      {driver.label}
                    </span>
                    {driver.category && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {driver.category}
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-muted text-muted-foreground capitalize">
                      {driver.priority}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize",
                        severityColor(worstSeverity),
                      )}
                    >
                      Conflict: {worstSeverity}
                    </span>
                    {weakestDimensionScore !== null && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-background tabular-nums">
                        Linked dimension {Math.round(weakestDimensionScore)}/100
                      </span>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {reasons.slice(0, 3).map((r, idx) => (
                      <li
                        key={idx}
                        className="text-[11.5px] leading-relaxed text-foreground/85 flex gap-1.5"
                      >
                        <span className="text-muted-foreground">•</span>
                        <span className="break-words">{r}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Per-dimension scores */}
        {dimensions.length > 0 && (
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <ShieldCheck className="h-3 w-3" />
              Evaluation scores by dimension (sorted weakest first)
            </div>
            <div className="space-y-1.5">
              {dimensions.map((dim) => {
                const score = Math.round(dim.score ?? 0);
                const tone = scoreTone(score);
                return (
                  <div
                    key={dim.dimension}
                    className="grid grid-cols-[140px_1fr_56px] items-center gap-2"
                  >
                    <span
                      className="text-[11.5px] capitalize text-foreground/90 truncate"
                      title={dim.dimension.replace(/_/g, " ")}
                    >
                      {dim.dimension.replace(/_/g, " ")}
                    </span>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", tone.bar)}
                        style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
                      />
                    </div>
                    <span
                      className={cn("text-[11px] font-semibold tabular-nums text-right", tone.text)}
                    >
                      {score}/100
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
