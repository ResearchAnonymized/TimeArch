/**
 * Stage 11 — ATAM / Quality attribute evaluation (Studio native).
 *
 * Loads the latest `quality_attributes` artifact for stage 11, lets the
 * user edit per-attribute evaluations (rating, score 1–10, assessment)
 * and critical gaps, and persists a new artifact version.
 *
 * Readiness gates to advance to Stage 12 (Risk analysis):
 *   - Stage 10 (infrastructure) artifact exists.
 *   - ≥4 attribute evaluations captured, each with a score and assessment.
 *   - No "weak" rating without a listed concern OR recommendation.
 *   - Critical gaps section reviewed (either populated or explicitly empty via a saved artifact).
 *   - Latest edits saved as an artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import { cn } from "@/lib/utils";

const RATINGS = ["strong", "adequate", "weak"] as const;
const OVERALL = ["strong", "adequate", "needs_improvement", "weak"] as const;
const DEFAULT_ATTRIBUTES = ["Performance", "Scalability", "Security", "Availability", "Maintainability", "Usability", "Testability"];

interface Evaluation {
  attribute: string;
  rating: (typeof RATINGS)[number];
  score: number;
  assessment: string;
  concerns: string[];
  recommendations: string[];
}

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage11Atam({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(11);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [overall, setOverall] = useState<(typeof OVERALL)[number]>("adequate");
  const [savedHash, setSavedHash] = useState<string>("");
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [infraVersion, setInfraVersion] = useState<number>(0);
  const [attrDraft, setAttrDraft] = useState("");
  const [gapDraft, setGapDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, infra] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 11).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 10).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setInfraVersion(infra.data?.version ?? 0);
    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const c = artifact.data.content as any;
      const e = normalizeEvals(c?.evaluations);
      const g = Array.isArray(c?.critical_gaps) ? c.critical_gaps.filter((x: unknown) => typeof x === "string") : [];
      const o = toOverall(c?.overall_score);
      setEvals(e); setGaps(g); setOverall(o);
      setSavedHash(hashOf(e, g, o));
    } else {
      setEvals([]); setGaps([]); setOverall("adequate");
      setSavedHash(hashOf([], [], "adequate"));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 11, load);

  const dirty = hashOf(evals, gaps, overall) !== savedHash;
  const hasInfra = infraVersion > 0;
  const enoughEvals = evals.length >= 4;
  const evalsComplete = evals.every((e) => e.score > 0 && e.assessment.trim().length > 0);
  const weakWithoutMitigation = evals.filter((e) => e.rating === "weak" && e.concerns.length === 0 && e.recommendations.length === 0);
  const ready = hasInfra && enoughEvals && evalsComplete && weakWithoutMitigation.length === 0 && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasInfra) issues.push("Stage 10 (infrastructure) must be locked first.");
    if (!enoughEvals) issues.push(`Add at least 4 quality attribute evaluations (have ${evals.length}).`);
    const missing = evals.filter((e) => !e.assessment.trim() || e.score <= 0);
    if (missing.length > 0) issues.push(`${missing.length} evaluation(s) missing score or assessment.`);
    if (weakWithoutMitigation.length > 0) issues.push(`${weakWithoutMitigation.length} weak attribute(s) with no concern or recommendation listed.`);
    if (artifactVersion === 0) issues.push("Save the evaluation as an artifact version before advancing.");
    return issues;
  }, [evals, hasInfra, enoughEvals, weakWithoutMitigation, artifactVersion]);

  function addEval(name?: string) {
    const attr = (name ?? attrDraft).trim();
    if (!attr) return toast.error("Attribute name is required.");
    if (evals.some((e) => e.attribute.toLowerCase() === attr.toLowerCase())) return toast.error("Attribute already added.");
    setEvals((p) => [...p, { attribute: attr, rating: "adequate", score: 6, assessment: "", concerns: [], recommendations: [] }]);
    setAttrDraft("");
  }
  function updateEval(i: number, patch: Partial<Evaluation>) {
    setEvals((p) => p.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeEval(i: number) { setEvals((p) => p.filter((_, idx) => idx !== i)); }
  function addListItem(i: number, key: "concerns" | "recommendations", value: string) {
    const v = value.trim(); if (!v) return;
    updateEval(i, { [key]: [...evals[i][key], v] } as Partial<Evaluation>);
  }
  function removeListItem(i: number, key: "concerns" | "recommendations", idx: number) {
    updateEval(i, { [key]: evals[i][key].filter((_, k) => k !== idx) } as Partial<Evaluation>);
  }
  function addGap() {
    const v = gapDraft.trim(); if (!v) return;
    setGaps((p) => [...p, v]); setGapDraft("");
  }
  function removeGap(i: number) { setGaps((p) => p.filter((_, idx) => idx !== i)); }

  async function persist() {
    if (evals.length === 0) return toast.error("Add at least one evaluation first.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const avg = evals.reduce((s, e) => s + e.score, 0) / evals.length;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 11, type: "quality_evaluation",
      title: `Quality Attribute Evaluation (v${nextVersion})`,
      version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Quality Attribute Evaluation (v${nextVersion})`,
        summary: `${evals.length} attributes evaluated, average score ${avg.toFixed(1)}/10, ${gaps.length} critical gap(s).`,
        key_findings: evals.slice(0, 5).map((e) => `${e.attribute}: ${e.rating} (${e.score}/10)`),
        overall_score: overall,
        evaluations: evals,
        critical_gaps: gaps,
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasInfra ? "Lock the infrastructure design in Stage 10 first."
    : !enoughEvals ? "Evaluate at least 4 quality attributes."
    : !evalsComplete ? "Every attribute needs a score and assessment."
    : weakWithoutMitigation.length > 0 ? "Add a concern or recommendation for each weak attribute."
    : artifactVersion === 0 ? "Save the evaluation before advancing."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 11 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : evals.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : evals.length > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Attributes", value: loading ? "—" : evals.length, sub: `≥4 needed`, tone: enoughEvals ? "emerald" : "amber" },
        { label: "Avg score", value: loading || evals.length === 0 ? "—" : (evals.reduce((s, e) => s + e.score, 0) / evals.length).toFixed(1), sub: "out of 10", tone: "primary" },
        { label: "Weak", value: loading ? "—" : evals.filter((e) => e.rating === "weak").length, sub: `${weakWithoutMitigation.length} unmitigated`, tone: weakWithoutMitigation.length > 0 ? "rose" : "emerald" },
        { label: "Critical gaps", value: loading ? "—" : gaps.length, sub: "for Stage 12", tone: "primary" },
      ]}
      checks={[
        { key: "infra", label: `Infrastructure locked (Stage 10${infraVersion ? ` v${infraVersion}` : ""})`, ok: hasInfra },
        { key: "count", label: "≥4 quality attributes evaluated", ok: enoughEvals },
        { key: "complete", label: "Every evaluation has a score and assessment", ok: evalsComplete },
        { key: "weak", label: "Weak attributes have concerns or recommendations", ok: weakWithoutMitigation.length === 0 },
        { key: "saved", label: "Latest evaluation saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready to move into risk analysis?"
      checklistBlurb="Stage 12 uses these ratings to seed the risk register."
      advance={{ label: ready ? "Evaluation locked — advance to Stage 12" : "Complete the ATAM evaluation to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Risk analysis", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Auto-generate evaluation"
        subtitle={!hasInfra ? "Lock the infrastructure design first." : "Runs the Quality Attribute agent against your architecture."}
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasInfra ? "Complete infrastructure design in Stage 10 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Overall verdict:</span>
          <Select value={overall} onValueChange={(v) => setOverall(v as any)}>
            <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{OVERALL.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
          {artifactVersion > 0 && <span className="text-muted-foreground ml-auto">Artifact <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span></span>}
        </div>
      </SectionCard>

      <SectionCard title={`Quality attribute evaluations (${evals.length})`} subtitle="Score each attribute 1–10 and record the reasoning.">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Input placeholder="Attribute name (e.g. Performance)" value={attrDraft} onChange={(e) => setAttrDraft(e.target.value)} className="max-w-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEval(); } }} />
          <Button onClick={() => addEval()} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
          <span className="text-[11px] text-muted-foreground">Quick add:</span>
          {DEFAULT_ATTRIBUTES.filter((a) => !evals.some((e) => e.attribute.toLowerCase() === a.toLowerCase())).slice(0, 6).map((a) => (
            <Button key={a} size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => addEval(a)}>{a}</Button>
          ))}
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : evals.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Gauge className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No evaluations yet. Add attributes above or run the agent.
          </div>
        ) : (
          <ul className="space-y-3">
            {evals.map((e, i) => (
              <li key={i} className="rounded-xl border bg-background p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <Input value={e.attribute} onChange={(ev) => updateEval(i, { attribute: ev.target.value })} className="md:col-span-3 font-mono text-sm font-semibold" />
                  <Select value={e.rating} onValueChange={(v) => updateEval(i, { rating: v as any })}>
                    <SelectTrigger className={cn("md:col-span-2", e.rating === "weak" && "border-rose-500/40 text-rose-600", e.rating === "strong" && "border-emerald-500/40 text-emerald-600")}><SelectValue /></SelectTrigger>
                    <SelectContent>{RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <Input type="number" min={1} max={10} value={e.score} onChange={(ev) => updateEval(i, { score: Number(ev.target.value) || 0 })} className="h-9" />
                    <span className="text-xs text-muted-foreground">/10</span>
                  </div>
                  <Input value={e.assessment} onChange={(ev) => updateEval(i, { assessment: ev.target.value })} placeholder="Assessment summary" className="md:col-span-4 text-sm" />
                  <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end" onClick={() => removeEval(i)} aria-label={`Remove ${e.attribute}`}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ListEditor label="Concerns" items={e.concerns} onAdd={(v) => addListItem(i, "concerns", v)} onRemove={(k) => removeListItem(i, "concerns", k)} tone="rose" />
                  <ListEditor label="Recommendations" items={e.recommendations} onAdd={(v) => addListItem(i, "recommendations", v)} onRemove={(k) => removeListItem(i, "recommendations", k)} tone="emerald" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={`Critical gaps (${gaps.length})`} subtitle="These flow into the Stage 12 risk register.">
        <div className="flex items-center gap-2 mb-2">
          <Input placeholder="e.g. No DDoS protection at edge" value={gapDraft} onChange={(e) => setGapDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGap(); } }} />
          <Button onClick={addGap} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {gaps.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No critical gaps yet.</p>
        ) : (
          <ul className="space-y-1">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>{g}</span>
                <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeGap(i)}><X className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {validation.length > 0 && (
        <SectionCard title="Validation issues" subtitle="Resolve these before advancing.">
          <ul className="space-y-1.5">
            {validation.map((v, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" /><span>{v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </StageShell>
  );
}

function ListEditor({ label, items, onAdd, onRemove, tone }: { label: string; items: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; tone: "rose" | "emerald" }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add ${label.toLowerCase()}…`} className="h-7 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(draft); setDraft(""); } }} />
        <Button size="sm" variant="ghost" className="h-7" onClick={() => { onAdd(draft); setDraft(""); }}><Plus className="h-3 w-3" /></Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded bg-background px-2 py-1 text-[11px]">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone === "rose" ? "bg-rose-500" : "bg-emerald-500")} />
          <span className="flex-1">{item}</span>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onRemove(i)}><X className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}

function toRating(v: unknown): (typeof RATINGS)[number] {
  const s = String(v ?? "").toLowerCase().trim();
  if (!s) return "adequate";
  if ((RATINGS as readonly string[]).includes(s)) return s as (typeof RATINGS)[number];
  if (/(strong|excellent|good|high|robust|mature)/.test(s)) return "strong";
  if (/(weak|poor|low|insufficient|lacking|critical|bad)/.test(s)) return "weak";
  return "adequate";
}

function toOverall(v: unknown): (typeof OVERALL)[number] {
  const s = String(v ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if ((OVERALL as readonly string[]).includes(s)) return s as (typeof OVERALL)[number];
  if (/(strong|excellent|good|mature)/.test(s)) return "strong";
  if (/(weak|poor|critical|bad)/.test(s)) return "weak";
  if (/(needs|improve|partial|gaps|moderate)/.test(s)) return "needs_improvement";
  return "adequate";
}

function normalizeEvals(raw: unknown): Evaluation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: any) => {
    if (!e || typeof e.attribute !== "string") return null;
    const scoreNum = Number(e.score);
    const assessment = typeof e.assessment === "string" && e.assessment.trim()
      ? e.assessment
      : typeof e.notes === "string" ? e.notes
      : typeof e.rationale === "string" ? e.rationale
      : Array.isArray(e.strengths) && e.strengths.length ? e.strengths.join("; ")
      : "";
    return {
      attribute: e.attribute,
      rating: toRating(e.rating),
      score: Number.isFinite(scoreNum) && scoreNum > 0 ? Math.min(10, Math.max(1, scoreNum)) : 6,
      assessment,
      concerns: Array.isArray(e.concerns) ? e.concerns.filter((c: unknown) => typeof c === "string") : [],
      recommendations: Array.isArray(e.recommendations) ? e.recommendations.filter((c: unknown) => typeof c === "string") : [],
    } as Evaluation;
  }).filter((e): e is Evaluation => !!e);
}

function hashOf(evals: Evaluation[], gaps: string[], overall: string): string {
  return JSON.stringify({ evals: evals.map((e) => [e.attribute, e.rating, e.score, e.assessment, [...e.concerns].sort(), [...e.recommendations].sort()]), gaps: [...gaps].sort(), overall });
}
