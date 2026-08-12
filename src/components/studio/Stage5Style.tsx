/**
 * Stage 5 — Style selection (Studio native).
 *
 * Clean Clause-style surface built on StageShell. Lets the user:
 *   - Browse a curated catalog of architectural styles grouped by category
 *   - See each style scored against the drivers captured in Stage 4
 *   - Pick a primary style and an optional secondary (hybrid) style
 *   - Optionally auto-classify via the `style-classifier` edge function
 *   - Persist the choice to `system_style`
 *
 * Readiness gate to advance to Stage 6:
 *   - Primary style selected
 *   - Confidence explicitly set (low / med / high)
 *   - At least one evidence bullet captured (from either the auto-classifier
 *     or a manual note the architect adds)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Layers,
  Cloud,
  Boxes,
  Zap,
  Building2,
  Radio,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { cn } from "@/lib/utils";
import RunAgentButton from "@/components/studio/RunAgentButton";

// ── Style catalog ────────────────────────────────────────────────────────

type StyleKey =
  | "monolith"
  | "modular_monolith"
  | "layered"
  | "microservices"
  | "service_oriented"
  | "event_driven"
  | "pipe_and_filter"
  | "serverless";

type Category = "monolithic" | "distributed" | "event" | "serverless";

interface StyleDef {
  key: StyleKey;
  label: string;
  category: Category;
  blurb: string;
  strengths: string[];
  weaknesses: string[];
  /** Base fit weights per driver kind (0..1). */
  weights: Partial<Record<string, number>>;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Boxes; tone: string }> = {
  monolithic: { label: "Monolithic", icon: Building2, tone: "text-slate-600 dark:text-slate-300" },
  distributed: { label: "Distributed", icon: Boxes, tone: "text-blue-600 dark:text-blue-300" },
  event: { label: "Event-driven", icon: Radio, tone: "text-violet-600 dark:text-violet-300" },
  serverless: { label: "Serverless", icon: Cloud, tone: "text-emerald-600 dark:text-emerald-300" },
};

const STYLES: StyleDef[] = [
  {
    key: "monolith",
    label: "Monolith",
    category: "monolithic",
    blurb: "Single deployable, one shared database. Fastest path to production for a small team.",
    strengths: ["Low ops overhead", "Simple transactions", "Fast local dev loop"],
    weaknesses: ["Hard to scale teams", "Coupling grows over time", "All-or-nothing deploy"],
    weights: { quality: 0.4, constraint: 0.7, concern: 0.5 },
  },
  {
    key: "modular_monolith",
    label: "Modular Monolith",
    category: "monolithic",
    blurb: "One deployable with strict module boundaries. Best of monolith speed + service discipline.",
    strengths: ["Clean seams", "Refactor-friendly", "One transaction boundary"],
    weaknesses: ["Discipline required", "Still a single deploy", "Shared runtime limits"],
    weights: { quality: 0.7, constraint: 0.7, concern: 0.7 },
  },
  {
    key: "layered",
    label: "Layered",
    category: "monolithic",
    blurb: "Presentation / application / domain / infrastructure. The classical enterprise stack.",
    strengths: ["Familiar to most teams", "Clear responsibilities", "Framework support"],
    weaknesses: ["Rigid across layers", "Cross-cutting is awkward", "Can become anemic"],
    weights: { quality: 0.5, constraint: 0.6, concern: 0.55 },
  },
  {
    key: "microservices",
    label: "Microservices",
    category: "distributed",
    blurb: "Small, independently deployable services owned by autonomous teams.",
    strengths: ["Team autonomy", "Independent scale", "Polyglot friendly"],
    weaknesses: ["Ops complexity", "Distributed transactions", "Requires platform team"],
    weights: { quality: 0.85, constraint: 0.55, concern: 0.75 },
  },
  {
    key: "service_oriented",
    label: "Service-Oriented",
    category: "distributed",
    blurb: "Coarser services around business capabilities, often with an ESB or shared contracts.",
    strengths: ["Enterprise reuse", "Governance-friendly", "Contract-first"],
    weaknesses: ["Central bus risk", "Slower to evolve", "Heavy tooling"],
    weights: { quality: 0.6, constraint: 0.7, concern: 0.6 },
  },
  {
    key: "event_driven",
    label: "Event-Driven",
    category: "event",
    blurb: "Producers emit events, consumers react. Great for real-time and loose coupling.",
    strengths: ["Loose coupling", "Elastic throughput", "Natural audit trail"],
    weaknesses: ["Eventual consistency", "Debugging is harder", "Schema evolution risk"],
    weights: { quality: 0.85, constraint: 0.5, concern: 0.8 },
  },
  {
    key: "pipe_and_filter",
    label: "Pipe & Filter",
    category: "event",
    blurb: "Composable stages transforming a stream. Ideal for ETL, media, analytics pipelines.",
    strengths: ["Highly composable", "Testable stages", "Parallelizable"],
    weaknesses: ["Not for interactive apps", "Backpressure design", "State handling is tricky"],
    weights: { quality: 0.7, constraint: 0.55, concern: 0.6 },
  },
  {
    key: "serverless",
    label: "Serverless",
    category: "serverless",
    blurb: "Functions + managed services. Pay per invocation, zero infra to babysit.",
    strengths: ["No servers", "Auto-scale", "Great for spiky loads"],
    weaknesses: ["Cold starts", "Vendor lock-in", "Local dev friction"],
    weights: { quality: 0.75, constraint: 0.45, concern: 0.7 },
  },
];

const STYLE_MAP = new Map(STYLES.map((s) => [s.key, s] as const));

const CONFIDENCES = ["low", "med", "high"] as const;
type Confidence = (typeof CONFIDENCES)[number];

// ── Types ────────────────────────────────────────────────────────────────

interface Driver {
  id: string;
  label: string;
  category: string | null;
  priority: "low" | "medium" | "high" | null;
}

interface SystemStyle {
  primary_style: string;
  secondary_style: string | null;
  confidence: string;
  evidence: string[];
  drivers_fit: Array<{ driver: string; fit: string; note: string }>;
  computed_at: string | null;
}

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function Stage5Style({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(5);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [saved, setSaved] = useState<SystemStyle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const [primary, setPrimary] = useState<StyleKey | "">("");
  const [secondary, setSecondary] = useState<StyleKey | "none">("none");
  const [confidence, setConfidence] = useState<Confidence>("med");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [newEvidence, setNewEvidence] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [dr, ss] = await Promise.all([
      supabase
        .from("architecture_drivers")
        .select("id, label, category, priority")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("system_style")
        .select("primary_style, secondary_style, confidence, evidence, drivers_fit, computed_at")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    setDrivers((dr.data ?? []) as Driver[]);
    if (ss.data) {
      const row: SystemStyle = {
        primary_style: ss.data.primary_style,
        secondary_style: ss.data.secondary_style,
        confidence: ss.data.confidence,
        evidence: (ss.data.evidence as string[]) ?? [],
        drivers_fit: (ss.data.drivers_fit as SystemStyle["drivers_fit"]) ?? [],
        computed_at: ss.data.computed_at,
      };
      setSaved(row);
      if (STYLE_MAP.has(row.primary_style as StyleKey)) setPrimary(row.primary_style as StyleKey);
      if (row.secondary_style && STYLE_MAP.has(row.secondary_style as StyleKey))
        setSecondary(row.secondary_style as StyleKey);
      if (CONFIDENCES.includes(row.confidence as Confidence))
        setConfidence(row.confidence as Confidence);
      setEvidence(row.evidence);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Score every style against the captured drivers.
  const scored = useMemo(() => {
    const priorityMult = { high: 1, medium: 0.6, low: 0.3 } as const;
    return STYLES.map((s) => {
      let score = 0;
      let max = 0;
      for (const d of drivers) {
        const mult = priorityMult[(d.priority ?? "medium") as keyof typeof priorityMult];
        const w = s.weights[d.category ?? "quality"] ?? 0.5;
        score += w * mult;
        max += mult;
      }
      const pct = max > 0 ? Math.round((score / max) * 100) : 50;
      return { ...s, score: pct };
    }).sort((a, b) => b.score - a.score);
  }, [drivers]);

  const visible = useMemo(
    () => (categoryFilter === "all" ? scored : scored.filter((s) => s.category === categoryFilter)),
    [scored, categoryFilter],
  );

  const topScore = scored[0]?.score ?? 0;

  const primaryDef = primary ? STYLE_MAP.get(primary) : null;
  const secondaryDef = secondary !== "none" ? STYLE_MAP.get(secondary as StyleKey) : null;

  const ready = Boolean(primary) && evidence.length > 0;

  async function persist() {
    if (!primary) {
      toast.error("Pick a primary style first.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("system_style").upsert(
      {
        project_id: projectId,
        primary_style: primary,
        secondary_style: secondary === "none" ? null : secondary,
        confidence,
        evidence,
        drivers_fit: saved?.drivers_fit ?? [],
        computed_at: new Date().toISOString(),
        computed_by: userData.user?.id ?? null,
      },
      { onConflict: "project_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save: ${error.message}`);
      return;
    }
    toast.success("Style saved");
    load();
  }

  async function autoClassify() {
    setClassifying(true);
    const r = await discoveryService.classifyStyle({ project_id: projectId });
    setClassifying(false);
    if (!r.ok) {
      toast.error(errorOf(r)?.message ?? "Classifier failed");
      return;
    }
    toast.success("Auto-classified from your artifacts");
    load();
  }

  function addEvidence() {
    const t = newEvidence.trim();
    if (!t) return;
    setEvidence((prev) => [...prev, t]);
    setNewEvidence("");
  }

  return (
    <StageShell
      versionHistory={{ projectId, stage: 5 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : primary ? "In progress" : "Not started",
        tone: ready ? "emerald" : primary ? "primary" : "neutral",
      }}
      stats={[
        {
          label: "Drivers scored",
          value: loading ? "—" : drivers.length,
          sub: drivers.length === 0 ? "add drivers first" : "informing scores",
          tone: drivers.length > 0 ? "primary" : "amber",
        },
        {
          label: "Best fit",
          value: loading ? "—" : `${topScore}%`,
          sub: scored[0]?.label ?? "—",
          tone: topScore >= 70 ? "emerald" : "neutral",
        },
        {
          label: "Confidence",
          value: confidence.toUpperCase(),
          sub: "how sure you are",
          tone: confidence === "high" ? "emerald" : confidence === "med" ? "primary" : "amber",
        },
        {
          label: "Evidence",
          value: evidence.length,
          sub: "notes captured",
          tone: evidence.length > 0 ? "emerald" : "neutral",
        },
      ]}
      checks={[
        { key: "prim", label: "Primary style selected", ok: !!primary },
        { key: "conf", label: "Confidence set", ok: CONFIDENCES.includes(confidence) },
        { key: "evid", label: "At least one evidence note captured", ok: evidence.length > 0 },
        { key: "saved", label: "Selection saved to system_style", ok: saved?.primary_style === primary && !!primary },
      ]}
      checklistTitle="Ready to lock the architecture style?"
      checklistBlurb="The style you pick here shapes component design, data model, and infrastructure decisions downstream."
      advance={{
        label: ready ? "Style is locked — advance to Stage 6" : "Pick a style and note the reasoning to advance",
        ready: ready && saved?.primary_style === primary,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Component design",
        missingHint: !primary
          ? "Pick a primary style."
          : evidence.length === 0
            ? "Add at least one evidence note."
            : saved?.primary_style !== primary
              ? "Save your selection first."
              : undefined,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-classify + summary */}
      <SectionCard
        title="Auto-classify from artifacts"
        subtitle="Runs the Style Classifier against your imported components, infra signals, and drivers."
        right={
          <RunAgentButton
            onRun={autoClassify}
            running={classifying}
            hasArtifact={!!saved}
            idleLabel="Run agent"
            rerunLabel="Re-run agent"
          />
        }
      >
        {saved ? (
          <div className="text-xs text-muted-foreground">
            Last run {saved.computed_at ? new Date(saved.computed_at).toLocaleString() : "—"} — suggested{" "}
            <span className="font-mono font-bold text-foreground">
              {formatStyle(saved.primary_style)}
            </span>
            {saved.secondary_style && (
              <>
                {" "}
                with secondary{" "}
                <span className="font-mono text-foreground">{formatStyle(saved.secondary_style)}</span>
              </>
            )}
            {" · "}confidence <span className="font-mono uppercase">{saved.confidence}</span>.
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            No classifier run yet. You can also pick a style manually below.
          </div>
        )}
      </SectionCard>

      {/* Category filter */}
      <SectionCard
        title="Candidate styles"
        subtitle={
          drivers.length === 0
            ? "Scores default to 50% until you add drivers in Stage 4."
            : `Scored against your ${drivers.length} driver${drivers.length === 1 ? "" : "s"}, weighted by priority.`
        }
        right={
          <div className="flex items-center gap-1">
            <CategoryChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
              All
            </CategoryChip>
            {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
              <CategoryChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                {CATEGORY_META[c].label}
              </CategoryChip>
            ))}
          </div>
        }
      >
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((s) => {
            const isPrimary = primary === s.key;
            const isSecondary = secondary === s.key;
            const Icon = CATEGORY_META[s.category].icon;
            return (
              <li
                key={s.key}
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  isPrimary
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : isSecondary
                      ? "border-violet-500/50 bg-violet-500/5"
                      : "border-border bg-background hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={cn("h-4 w-4 flex-shrink-0", CATEGORY_META[s.category].tone)} />
                    <h3 className="font-semibold text-sm truncate">{s.label}</h3>
                  </div>
                  <ScorePill score={s.score} />
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{s.blurb}</p>
                <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                      Strengths
                    </p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {s.strengths.map((x) => (
                        <li key={x}>· {x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold mb-1">
                      Trade-offs
                    </p>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {s.weaknesses.map((x) => (
                        <li key={x}>· {x}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isPrimary ? "default" : "outline"}
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setPrimary(s.key);
                      if (secondary === s.key) setSecondary("none");
                    }}
                  >
                    {isPrimary ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : null}
                    {isPrimary ? "Primary" : "Set as primary"}
                  </Button>
                  <Button
                    size="sm"
                    variant={isSecondary ? "secondary" : "ghost"}
                    className="h-8 text-xs"
                    disabled={isPrimary}
                    onClick={() => setSecondary(isSecondary ? "none" : s.key)}
                  >
                    {isSecondary ? "Secondary ✓" : "Secondary"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {/* Comparison */}
      {primaryDef && (
        <SectionCard
          title="Your selection"
          subtitle={
            secondaryDef
              ? `${primaryDef.label} as the primary style, with ${secondaryDef.label} for the parts that don't fit.`
              : `${primaryDef.label} as the primary style. Consider adding a secondary if any drivers pull hard the other way.`
          }
        >
          <div className={cn("grid gap-3", secondaryDef ? "md:grid-cols-2" : "grid-cols-1")}>
            <StyleSummary def={primaryDef} kind="primary" />
            {secondaryDef && <StyleSummary def={secondaryDef} kind="secondary" />}
          </div>
        </SectionCard>
      )}

      {/* Confidence + evidence + save */}
      <SectionCard title="Confidence & rationale" subtitle="Why this style? Note anything future reviewers should know.">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">
              Confidence
            </label>
            <Select value={confidence} onValueChange={(v) => setConfidence(v as Confidence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "low" ? "Low — worth a spike" : c === "med" ? "Medium — reasonable" : "High — well-evidenced"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1 block">
              Evidence notes
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newEvidence}
                onChange={(e) => setNewEvidence(e.target.value)}
                placeholder="e.g. 'Team of 3 → monolith wins on ops overhead'"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEvidence())}
              />
              <Button variant="outline" onClick={addEvidence} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {evidence.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Add at least one evidence note (or run the auto-classifier) to advance.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {evidence.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{e}</span>
                    <button
                      onClick={() => setEvidence((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-rose-500"
                      aria-label="Remove note"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={persist} disabled={saving || !primary} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save selection
          </Button>
        </div>
      </SectionCard>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading style data…
        </div>
      )}
    </StageShell>
  );
}

// ── Primitives ───────────────────────────────────────────────────────────

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : score >= 55
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-muted-foreground/20 bg-muted/40 text-muted-foreground";
  return (
    <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold flex-shrink-0", tone)}>
      {score}%
    </span>
  );
}

function StyleSummary({ def, kind }: { def: StyleDef; kind: "primary" | "secondary" }) {
  const Icon = CATEGORY_META[def.category].icon;
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        kind === "primary" ? "border-primary/40 bg-primary/5" : "border-violet-500/40 bg-violet-500/5",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", CATEGORY_META[def.category].tone)} />
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {kind}
        </span>
        <h4 className="font-semibold text-sm ml-1">{def.label}</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{def.blurb}</p>
    </div>
  );
}

function formatStyle(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
