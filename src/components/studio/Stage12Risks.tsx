/**
 * Stage 12 — Risk analysis (Studio native).
 *
 * Manages the risk register: title, category, probability, impact,
 * derived severity, mitigation strategy and owner. Advance to Stage 13
 * requires every high/critical risk to have a substantive mitigation
 * and an owner assigned.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, ShieldAlert } from "lucide-react";
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

const LEVELS = ["very_low", "low", "medium", "high", "very_high"] as const;
const LEVEL_SCORE: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 };
const CATEGORIES = ["Technical", "Delivery", "Operational", "Security", "Compliance", "People", "Vendor"];

interface Risk {
  id: string;
  title: string;
  category: string;
  description: string;
  probability: (typeof LEVELS)[number];
  impact: (typeof LEVELS)[number];
  mitigation_strategy: string;
  owner: string;
  status: string;
}

function severityOf(p: string, i: string): "low" | "medium" | "high" | "critical" {
  const s = (LEVEL_SCORE[p] || 1) * (LEVEL_SCORE[i] || 1);
  if (s >= 20) return "critical";
  if (s >= 12) return "high";
  if (s >= 6) return "medium";
  return "low";
}

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage12Risks({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(12);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [overall, setOverall] = useState<string>("medium");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [qaVersion, setQaVersion] = useState(0);
  const [titleDraft, setTitleDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, qa] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 12).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 11).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setQaVersion(qa.data?.version ?? 0);
    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const c = artifact.data.content as any;
      const r = normalizeRisks(c?.risks);
      const o = typeof c?.overall_risk_level === "string" ? c.overall_risk_level : "medium";
      setRisks(r); setOverall(o); setSavedHash(hashOf(r, o));
    } else {
      setRisks([]); setOverall("medium"); setSavedHash(hashOf([], "medium")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 12, load);

  const dirty = hashOf(risks, overall) !== savedHash;
  const hasQa = qaVersion > 0;
  const enough = risks.length >= 3;
  const highRisks = risks.filter((r) => severityOf(r.probability, r.impact) === "high" || severityOf(r.probability, r.impact) === "critical");
  const unmitigated = highRisks.filter((r) => !r.mitigation_strategy || r.mitigation_strategy.trim().length < 10);
  const missingOwner = highRisks.filter((r) => !r.owner.trim());
  const ready = hasQa && enough && unmitigated.length === 0 && missingOwner.length === 0 && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasQa) issues.push("Stage 11 (ATAM) must be locked first.");
    if (!enough) issues.push(`Add at least 3 risks (have ${risks.length}).`);
    if (unmitigated.length > 0) issues.push(`${unmitigated.length} high/critical risk(s) without adequate mitigation (min 10 chars).`);
    if (missingOwner.length > 0) issues.push(`${missingOwner.length} high/critical risk(s) without an owner.`);
    if (artifactVersion === 0) issues.push("Save the register as an artifact version before advancing.");
    return issues;
  }, [risks, hasQa, enough, unmitigated, missingOwner, artifactVersion]);

  function addRisk() {
    const t = titleDraft.trim();
    if (!t) return toast.error("Give the risk a title.");
    const nextId = `R-${String(risks.length + 1).padStart(3, "0")}`;
    setRisks((p) => [...p, { id: nextId, title: t, category: "Technical", description: "", probability: "medium", impact: "medium", mitigation_strategy: "", owner: "", status: "open" }]);
    setTitleDraft("");
  }
  function updateRisk(i: number, patch: Partial<Risk>) { setRisks((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function removeRisk(i: number) { setRisks((p) => p.filter((_, idx) => idx !== i)); }

  async function persist() {
    if (risks.length === 0) return toast.error("Add at least one risk first.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const enrichedRisks = risks.map((r) => ({ ...r, severity: severityOf(r.probability, r.impact) }));
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 12, type: "risk_analysis",
      title: `Risk Analysis (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Risk Analysis (v${nextVersion})`,
        summary: `${risks.length} risks tracked · ${highRisks.length} high/critical · overall ${overall}.`,
        key_findings: enrichedRisks.slice(0, 5).map((r) => `${r.id} ${r.title}: ${r.severity}`),
        risk_summary: `Register of ${risks.length} risks across ${new Set(risks.map((r) => r.category)).size} categories.`,
        risks: enrichedRisks,
        overall_risk_level: overall,
        top_risks_summary: enrichedRisks.filter((r) => r.severity === "critical" || r.severity === "high").map((r) => `${r.id} ${r.title}`),
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasQa ? "Lock the ATAM evaluation in Stage 11 first."
    : !enough ? "Add at least 3 risks."
    : unmitigated.length > 0 ? "Every high/critical risk needs a substantive mitigation."
    : missingOwner.length > 0 ? "Assign owners to high/critical risks."
    : artifactVersion === 0 ? "Save the register before advancing."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 12 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : risks.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : risks.length > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Risks", value: loading ? "—" : risks.length, sub: `≥3 needed`, tone: enough ? "emerald" : "amber" },
        { label: "High/critical", value: loading ? "—" : highRisks.length, sub: `${unmitigated.length} unmitigated`, tone: unmitigated.length > 0 ? "rose" : "primary" },
        { label: "Missing owner", value: loading ? "—" : missingOwner.length, sub: "on high/critical", tone: missingOwner.length > 0 ? "rose" : "emerald" },
        { label: "Overall", value: overall, sub: "risk level", tone: overall === "high" || overall === "critical" ? "rose" : overall === "medium" ? "amber" : "emerald" },
      ]}
      checks={[
        { key: "qa", label: `ATAM locked (Stage 11${qaVersion ? ` v${qaVersion}` : ""})`, ok: hasQa },
        { key: "count", label: "≥3 risks captured", ok: enough },
        { key: "mit", label: "Every high/critical risk has a substantive mitigation", ok: unmitigated.length === 0 },
        { key: "own", label: "Every high/critical risk has an owner", ok: missingOwner.length === 0 },
        { key: "saved", label: "Latest register saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready for the trade-off review?"
      checklistBlurb="Stage 13 revisits the design against your ATAM ratings and this risk register."
      advance={{ label: ready ? "Register locked — advance to Stage 13" : "Complete the risk analysis to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Trade-off review", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Auto-generate risk register"
        subtitle={!hasQa ? "Lock the ATAM evaluation first." : "Runs the Risk Analysis agent against your architecture and quality attributes."}
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasQa ? "Complete ATAM evaluation in Stage 11 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Overall risk level:</span>
          <Select value={overall} onValueChange={setOverall}>
            <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{["low", "medium", "high", "critical"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
          {artifactVersion > 0 && <span className="text-muted-foreground ml-auto">Artifact <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span></span>}
        </div>
      </SectionCard>

      <SectionCard title={`Risk register (${risks.length})`} subtitle="Severity is auto-computed from probability × impact.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Risk title (e.g. Payments API outage cascades to checkout)" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRisk(); } }} />
          <Button onClick={addRisk} className="gap-1"><Plus className="h-4 w-4" /> Add risk</Button>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : risks.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <ShieldAlert className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No risks yet. Add one above or run the agent.
          </div>
        ) : (
          <ul className="space-y-3">
            {risks.map((r, i) => {
              const sev = severityOf(r.probability, r.impact);
              const highLike = sev === "high" || sev === "critical";
              return (
                <li key={i} className={cn("rounded-xl border bg-background p-3 space-y-2", highLike && "border-rose-500/30")}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <span className="md:col-span-1 font-mono text-[10px] text-muted-foreground">{r.id}</span>
                    <Input value={r.title} onChange={(ev) => updateRisk(i, { title: ev.target.value })} className="md:col-span-5 text-sm font-semibold" />
                    <Select value={r.category} onValueChange={(v) => updateRisk(i, { category: v })}>
                      <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={r.owner} onChange={(ev) => updateRisk(i, { owner: ev.target.value })} placeholder="Owner" className="md:col-span-3 text-sm" />
                    <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end" onClick={() => removeRisk(i)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3 flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">Prob</span>
                      <Select value={r.probability} onValueChange={(v) => updateRisk(i, { probability: v as any })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">Impact</span>
                      <Select value={r.impact} onValueChange={(v) => updateRisk(i, { impact: v as any })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Badge variant="outline" className={cn("md:col-span-2 justify-center text-[10px] font-semibold uppercase", sev === "critical" && "border-rose-600 bg-rose-500/10 text-rose-600", sev === "high" && "border-rose-500/50 text-rose-500", sev === "medium" && "border-amber-500/50 text-amber-600", sev === "low" && "border-emerald-500/50 text-emerald-600")}>Severity: {sev}</Badge>
                    <Select value={r.status} onValueChange={(v) => updateRisk(i, { status: v })}>
                      <SelectTrigger className="md:col-span-4 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{["open", "mitigating", "monitoring", "accepted", "closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Textarea rows={2} value={r.description} onChange={(ev) => updateRisk(i, { description: ev.target.value })} placeholder="What could go wrong and how it manifests." className="text-xs" />
                  <Textarea rows={2} value={r.mitigation_strategy} onChange={(ev) => updateRisk(i, { mitigation_strategy: ev.target.value })} placeholder="Mitigation strategy (required for high/critical)." className={cn("text-xs", highLike && !r.mitigation_strategy && "border-rose-500/40")} />
                </li>
              );
            })}
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

function normalizeRisks(raw: unknown): Risk[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any, idx: number) => {
    if (!r || typeof r.title !== "string") return null;
    return {
      id: typeof r.id === "string" ? r.id : `R-${String(idx + 1).padStart(3, "0")}`,
      title: r.title,
      category: typeof r.category === "string" ? r.category : "Technical",
      description: typeof r.description === "string" ? r.description : "",
      probability: LEVELS.includes(r.probability) ? r.probability : "medium",
      impact: LEVELS.includes(r.impact) ? r.impact : "medium",
      mitigation_strategy: typeof r.mitigation_strategy === "string" ? r.mitigation_strategy : "",
      owner: typeof r.owner === "string" ? r.owner : "",
      status: typeof r.status === "string" ? r.status : "open",
    } as Risk;
  }).filter((r): r is Risk => !!r);
}

function hashOf(risks: Risk[], overall: string): string {
  return JSON.stringify({ risks: risks.map((r) => [r.id, r.title, r.category, r.description, r.probability, r.impact, r.mitigation_strategy, r.owner, r.status]), overall });
}
