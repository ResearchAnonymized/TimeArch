/**
 * Stage 13 — Trade-off review (Studio native).
 *
 * Captures conscious trade-offs: what was chosen, what was sacrificed,
 * why, and the affected quality attributes. Persists as an
 * `executive_summary` artifact for stage 13 (aligned with the
 * validate_architecture registry entry).
 *
 * Readiness gates to advance to Stage 14:
 *   - Stage 12 (Risk analysis) artifact exists.
 *   - ≥3 trade-offs captured, each with decision, sacrifice, rationale.
 *   - Every trade-off references at least one affected quality attribute.
 *   - Overall status set to "passed" or "passed_with_warnings".
 *   - Latest edits saved as an artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, Scale } from "lucide-react";
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

const STATUSES = ["passed", "passed_with_warnings", "failed"] as const;

interface Tradeoff {
  title: string;
  decision: string;
  sacrifice: string;
  rationale: string;
  affects: string[];
  accepted_by: string;
}

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage13Tradeoffs({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(13);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tradeoffs, setTradeoffs] = useState<Tradeoff[]>([]);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("passed_with_warnings");
  const [summary, setSummary] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [riskVersion, setRiskVersion] = useState(0);
  const [qaAttrs, setQaAttrs] = useState<string[]>([]);
  const [titleDraft, setTitleDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, risk, qa] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 13).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 12).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("content").eq("project_id", projectId).eq("stage", 11).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setRiskVersion(risk.data?.version ?? 0);
    const evals = (qa.data?.content as any)?.evaluations;
    setQaAttrs(Array.isArray(evals) ? evals.map((e: any) => e?.attribute).filter((n: unknown): n is string => typeof n === "string") : []);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const c = artifact.data.content as any;
      const t = normalize(c?.tradeoffs);
      const s = STATUSES.includes(c?.validation_status) ? c.validation_status : "passed_with_warnings";
      const sum = typeof c?.summary === "string" ? c.summary : "";
      setTradeoffs(t); setStatus(s); setSummary(sum);
      setSavedHash(hashOf(t, s, sum));
    } else {
      setTradeoffs([]); setStatus("passed_with_warnings"); setSummary("");
      setSavedHash(hashOf([], "passed_with_warnings", "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 13, load);

  const dirty = hashOf(tradeoffs, status, summary) !== savedHash;
  const hasRisks = riskVersion > 0;
  const enough = tradeoffs.length >= 3;
  const complete = tradeoffs.every((t) => t.decision.trim() && t.sacrifice.trim() && t.rationale.trim());
  const withAffects = tradeoffs.every((t) => t.affects.length > 0);
  const statusOk = status !== "failed";
  const ready = hasRisks && enough && complete && withAffects && statusOk && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasRisks) issues.push("Stage 12 (Risk analysis) must be locked first.");
    if (!enough) issues.push(`Capture at least 3 trade-offs (have ${tradeoffs.length}).`);
    const incomplete = tradeoffs.filter((t) => !t.decision.trim() || !t.sacrifice.trim() || !t.rationale.trim());
    if (incomplete.length > 0) issues.push(`${incomplete.length} trade-off(s) missing decision/sacrifice/rationale.`);
    const noAffects = tradeoffs.filter((t) => t.affects.length === 0);
    if (noAffects.length > 0) issues.push(`${noAffects.length} trade-off(s) don't reference any quality attribute.`);
    if (!statusOk) issues.push("Overall validation status is 'failed' — resolve blockers first.");
    if (artifactVersion === 0) issues.push("Save the review as an artifact version before advancing.");
    return issues;
  }, [tradeoffs, hasRisks, enough, statusOk, artifactVersion]);

  function addTradeoff() {
    const t = titleDraft.trim();
    if (!t) return toast.error("Give the trade-off a title.");
    setTradeoffs((p) => [...p, { title: t, decision: "", sacrifice: "", rationale: "", affects: [], accepted_by: "" }]);
    setTitleDraft("");
  }
  function updateTradeoff(i: number, patch: Partial<Tradeoff>) { setTradeoffs((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
  function removeTradeoff(i: number) { setTradeoffs((p) => p.filter((_, idx) => idx !== i)); }
  function toggleAffect(i: number, attr: string) {
    const cur = tradeoffs[i].affects;
    updateTradeoff(i, { affects: cur.includes(attr) ? cur.filter((a) => a !== attr) : [...cur, attr] });
  }

  async function persist() {
    if (tradeoffs.length === 0) return toast.error("Add at least one trade-off.");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 13, type: "executive_summary",
      title: `Trade-off Review (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Trade-off Review (v${nextVersion})`,
        summary: summary || `${tradeoffs.length} conscious trade-offs documented across ${new Set(tradeoffs.flatMap((t) => t.affects)).size} quality attribute(s).`,
        key_findings: tradeoffs.slice(0, 5).map((t) => `${t.title}: ${t.decision} (sacrificing ${t.sacrifice})`),
        validation_status: status,
        tradeoffs,
        consistency_checks: [
          { check: "All trade-offs reference quality attributes", status: withAffects ? "passed" : "failed" },
          { check: "All trade-offs have rationale", status: complete ? "passed" : "failed" },
        ],
        governance_readiness: { ready: statusOk, blockers: statusOk ? [] : ["Overall status is 'failed'"] },
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasRisks ? "Lock the risk analysis in Stage 12 first."
    : !enough ? "Document at least 3 trade-offs."
    : !complete ? "Every trade-off needs a decision, sacrifice and rationale."
    : !withAffects ? "Link each trade-off to at least one quality attribute."
    : !statusOk ? "Overall status must not be 'failed'."
    : artifactVersion === 0 ? "Save the review before advancing."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 13 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : tradeoffs.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : tradeoffs.length > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Trade-offs", value: loading ? "—" : tradeoffs.length, sub: `≥3 needed`, tone: enough ? "emerald" : "amber" },
        { label: "Complete", value: loading ? "—" : tradeoffs.filter((t) => t.decision && t.sacrifice && t.rationale).length, sub: `of ${tradeoffs.length}`, tone: complete ? "emerald" : "amber" },
        { label: "Attributes touched", value: loading ? "—" : new Set(tradeoffs.flatMap((t) => t.affects)).size, sub: `of ${qaAttrs.length} evaluated`, tone: "primary" },
        { label: "Verdict", value: status.replace(/_/g, " "), sub: statusOk ? "acceptable" : "blocked", tone: status === "passed" ? "emerald" : status === "passed_with_warnings" ? "amber" : "rose" },
      ]}
      checks={[
        { key: "risks", label: `Risk analysis locked (Stage 12${riskVersion ? ` v${riskVersion}` : ""})`, ok: hasRisks },
        { key: "count", label: "≥3 trade-offs captured", ok: enough },
        { key: "fields", label: "Every trade-off has decision, sacrifice and rationale", ok: complete },
        { key: "affects", label: "Every trade-off references at least one quality attribute", ok: withAffects },
        { key: "verdict", label: "Overall status is not 'failed'", ok: statusOk },
        { key: "saved", label: "Latest review saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready for the final quality checklists?"
      checklistBlurb="Stage 14 pulls trade-offs and gaps into ADRs and the documentation package."
      advance={{ label: ready ? "Trade-offs locked — advance to Stage 14" : "Complete the trade-off review to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Quality checklists", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Auto-generate trade-off review"
        subtitle={!hasRisks ? "Lock the risk analysis first." : "Runs the Architecture Validator agent."}
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasRisks ? "Capture risks in Stage 12 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <div className="md:col-span-3 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Verdict:</span>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Executive summary of the trade-off review…" className="md:col-span-9 text-xs" />
        </div>
      </SectionCard>

      <SectionCard title={`Trade-offs (${tradeoffs.length})`} subtitle="For each: what we chose, what we gave up, why, and which quality attributes it affects.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Trade-off title (e.g. Eventual consistency over strong consistency in checkout)" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTradeoff(); } }} />
          <Button onClick={addTradeoff} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : tradeoffs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Scale className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No trade-offs documented yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {tradeoffs.map((t, i) => (
              <li key={i} className="rounded-xl border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={t.title} onChange={(ev) => updateTradeoff(i, { title: ev.target.value })} className="flex-1 text-sm font-semibold" />
                  <Input value={t.accepted_by} onChange={(ev) => updateTradeoff(i, { accepted_by: ev.target.value })} placeholder="Accepted by" className="w-48 text-xs" />
                  <Button size="icon" variant="ghost" onClick={() => removeTradeoff(i)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Textarea rows={2} value={t.decision} onChange={(ev) => updateTradeoff(i, { decision: ev.target.value })} placeholder="Decision (what we chose)" className="text-xs" />
                  <Textarea rows={2} value={t.sacrifice} onChange={(ev) => updateTradeoff(i, { sacrifice: ev.target.value })} placeholder="Sacrifice (what we gave up)" className="text-xs" />
                  <Textarea rows={2} value={t.rationale} onChange={(ev) => updateTradeoff(i, { rationale: ev.target.value })} placeholder="Rationale (why it's worth it)" className="text-xs" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Affected quality attributes *</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {qaAttrs.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground italic">No attributes from Stage 11 — add them there first.</span>
                    ) : qaAttrs.map((a) => {
                      const on = t.affects.includes(a);
                      return (
                        <button key={a} type="button" onClick={() => toggleAffect(i, a)} className={cn("text-[11px] rounded-full border px-2 py-0.5 transition-colors", on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>{a}</button>
                      );
                    })}
                  </div>
                </div>
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

function normalize(raw: unknown): Tradeoff[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t: any) => {
    if (!t || typeof t.title !== "string") return null;
    return {
      title: t.title,
      decision: typeof t.decision === "string" ? t.decision : "",
      sacrifice: typeof t.sacrifice === "string" ? t.sacrifice : "",
      rationale: typeof t.rationale === "string" ? t.rationale : "",
      affects: Array.isArray(t.affects) ? t.affects.filter((a: unknown): a is string => typeof a === "string") : [],
      accepted_by: typeof t.accepted_by === "string" ? t.accepted_by : "",
    } as Tradeoff;
  }).filter((t): t is Tradeoff => !!t);
}

function hashOf(tradeoffs: Tradeoff[], status: string, summary: string): string {
  return JSON.stringify({ tradeoffs: tradeoffs.map((t) => [t.title, t.decision, t.sacrifice, t.rationale, [...t.affects].sort(), t.accepted_by]), status, summary });
}
