/**
 * Stage 14 — Quality checklists & Documentation package (Studio native).
 *
 * Combines the ISO 25010 quality checklist verification with the ADR
 * / documentation package that Stage 15 (Stakeholder approval)
 * receives.
 *
 * Readiness gates to advance to Stage 15 (Stakeholder approval):
 *   - Stage 13 (Trade-off review) artifact exists.
 *   - Every ISO 25010 checklist item marked ready / partial / gap with a note.
 *   - No item in "gap" state.
 *   - ≥3 ADRs recorded (title + context + decision + consequences).
 *   - Executive summary written (≥120 chars).
 *   - Latest edits saved as an artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, ClipboardCheck, FileText } from "lucide-react";
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

const ISO_25010_ATTRS = [
  "Functional suitability",
  "Performance efficiency",
  "Compatibility",
  "Usability",
  "Reliability",
  "Security",
  "Maintainability",
  "Portability",
];

const CHECK_STATES = ["ready", "partial", "gap"] as const;

interface CheckItem { attribute: string; status: (typeof CHECK_STATES)[number]; note: string }
interface Adr { id: string; title: string; status: string; context: string; decision: string; consequences: string; rationale: string }

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage14Checklists({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(14);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>(() => ISO_25010_ATTRS.map((a) => ({ attribute: a, status: "partial", note: "" })));
  const [adrs, setAdrs] = useState<Adr[]>([]);
  const [execSummary, setExecSummary] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [tradeVersion, setTradeVersion] = useState(0);
  const [adrTitleDraft, setAdrTitleDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, trade] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 14).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 13).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setTradeVersion(trade.data?.version ?? 0);
    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const c = artifact.data.content as any;
      const ch = normalizeChecks(c?.iso25010_checklist);
      const a = normalizeAdrs(c?.adrs);
      const es = typeof c?.executive_summary?.overview === "string" ? c.executive_summary.overview : typeof c?.summary === "string" ? c.summary : "";
      setChecks(ch); setAdrs(a); setExecSummary(es);
      setSavedHash(hashOf(ch, a, es));
    } else {
      const initChecks = ISO_25010_ATTRS.map((a) => ({ attribute: a, status: "partial" as const, note: "" }));
      setChecks(initChecks); setAdrs([]); setExecSummary("");
      setSavedHash(hashOf(initChecks, [], "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 14, load);

  const dirty = hashOf(checks, adrs, execSummary) !== savedHash;
  const hasTrade = tradeVersion > 0;
  const allNotes = checks.every((c) => c.note.trim().length > 0);
  const noGaps = checks.every((c) => c.status !== "gap");
  const enoughAdrs = adrs.length >= 3;
  const adrsComplete = adrs.every((a) => a.title.trim() && a.context.trim() && a.decision.trim() && a.consequences.trim());
  const summaryOk = execSummary.trim().length >= 120;
  const ready = hasTrade && allNotes && noGaps && enoughAdrs && adrsComplete && summaryOk && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasTrade) issues.push("Stage 13 (Trade-off review) must be locked first.");
    const missingNotes = checks.filter((c) => !c.note.trim());
    if (missingNotes.length > 0) issues.push(`${missingNotes.length} ISO 25010 attribute(s) missing a note.`);
    const gaps = checks.filter((c) => c.status === "gap");
    if (gaps.length > 0) issues.push(`${gaps.length} attribute(s) still marked as 'gap' — resolve or downgrade to 'partial' with a note.`);
    if (!enoughAdrs) issues.push(`Record at least 3 ADRs (have ${adrs.length}).`);
    const incompleteAdrs = adrs.filter((a) => !a.title.trim() || !a.context.trim() || !a.decision.trim() || !a.consequences.trim());
    if (incompleteAdrs.length > 0) issues.push(`${incompleteAdrs.length} ADR(s) missing title, context, decision or consequences.`);
    if (!summaryOk) issues.push(`Executive summary too short (${execSummary.trim().length}/120 chars).`);
    if (artifactVersion === 0) issues.push("Save the documentation package as an artifact version before advancing.");
    return issues;
  }, [checks, adrs, execSummary, hasTrade, enoughAdrs, summaryOk, artifactVersion]);

  function updateCheck(i: number, patch: Partial<CheckItem>) { setChecks((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c))); }
  function addAdr() {
    const t = adrTitleDraft.trim();
    if (!t) return toast.error("Give the ADR a title.");
    const nextId = `ADR-${String(adrs.length + 1).padStart(4, "0")}`;
    setAdrs((p) => [...p, { id: nextId, title: t, status: "accepted", context: "", decision: "", consequences: "", rationale: "" }]);
    setAdrTitleDraft("");
  }
  function updateAdr(i: number, patch: Partial<Adr>) { setAdrs((p) => p.map((a, idx) => (idx === i ? { ...a, ...patch } : a))); }
  function removeAdr(i: number) { setAdrs((p) => p.filter((_, idx) => idx !== i)); }

  async function persist() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 14, type: "executive_summary",
      title: `Documentation & Quality Checklists (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Documentation & Quality Checklists (v${nextVersion})`,
        summary: execSummary,
        key_findings: [
          `${checks.filter((c) => c.status === "ready").length}/${checks.length} ISO 25010 attributes ready.`,
          `${adrs.length} architecture decision record(s) captured.`,
          `${checks.filter((c) => c.status === "gap").length} remaining gap(s).`,
        ],
        executive_summary: { overview: execSummary, key_decisions: adrs.slice(0, 5).map((a) => a.title), risks_and_mitigations: [], implementation_roadmap: "" },
        iso25010_checklist: checks,
        adrs: adrs.map((a) => ({
          id: a.id, title: a.title, status: a.status,
          context: a.context, decision: a.decision,
          consequences: a.consequences.split("\n").filter(Boolean),
          rationale: a.rationale,
        })),
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasTrade ? "Lock the trade-off review in Stage 13 first."
    : !allNotes ? "Every ISO 25010 attribute needs a note."
    : !noGaps ? "Resolve every 'gap' item before advancing."
    : !enoughAdrs ? "Record at least 3 ADRs."
    : !adrsComplete ? "Every ADR needs title, context, decision and consequences."
    : !summaryOk ? "Executive summary must be at least 120 characters."
    : artifactVersion === 0 ? "Save the documentation package before advancing."
    : dirty ? "Save your changes first." : undefined;

  const readyCount = checks.filter((c) => c.status === "ready").length;
  const gapCount = checks.filter((c) => c.status === "gap").length;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 14 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready for stakeholder approval" : (adrs.length > 0 || readyCount > 0) ? "In progress" : "Not started", tone: ready ? "emerald" : (adrs.length > 0 || readyCount > 0) ? "primary" : "neutral" }}
      stats={[
        { label: "ISO 25010", value: loading ? "—" : `${readyCount}/${checks.length}`, sub: "attributes ready", tone: noGaps && allNotes ? "emerald" : "amber" },
        { label: "Gaps", value: loading ? "—" : gapCount, sub: "must be resolved", tone: gapCount > 0 ? "rose" : "emerald" },
        { label: "ADRs", value: loading ? "—" : adrs.length, sub: `≥3 needed`, tone: enoughAdrs ? "emerald" : "amber" },
        { label: "Exec summary", value: loading ? "—" : `${execSummary.trim().length}`, sub: `≥120 chars`, tone: summaryOk ? "emerald" : "amber" },
      ]}
      checks={[
        { key: "trade", label: `Trade-off review locked (Stage 13${tradeVersion ? ` v${tradeVersion}` : ""})`, ok: hasTrade },
        { key: "notes", label: "Every ISO 25010 attribute has a note", ok: allNotes },
        { key: "nogaps", label: "No attribute left as 'gap'", ok: noGaps },
        { key: "adrs", label: "≥3 architecture decision records recorded", ok: enoughAdrs && adrsComplete },
        { key: "summary", label: "Executive summary written (≥120 chars)", ok: summaryOk },
        { key: "saved", label: "Latest documentation saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready to hand over for stakeholder approval?"
      checklistBlurb="Stage 15 wraps the delivery phase — stakeholders receive this package for sign-off."
      advance={{ label: ready ? "Documentation locked — advance to Stage 15" : "Complete the checklists & documentation to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Stakeholder approval", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Auto-generate documentation package"
        subtitle={!hasTrade ? "Lock the trade-off review first." : "Runs the Documentation agent to synthesise ADRs and the executive summary."}
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasTrade ? "Capture trade-offs in Stage 13 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Executive summary *</label>
        <Textarea rows={4} value={execSummary} onChange={(e) => setExecSummary(e.target.value)} placeholder="A stakeholder-ready overview: what we're building, why this shape, the top decisions and known trade-offs. Minimum 120 characters." />
        <div className="text-[10px] text-muted-foreground mt-1">{execSummary.trim().length} / 120 chars minimum</div>
      </SectionCard>

      <SectionCard
        title="ISO 25010 quality checklist"
        subtitle="Mark each characteristic ready, partial or gap — and add a supporting note."
        right={<Badge variant="outline" className="text-[10px]"><ClipboardCheck className="h-3 w-3 mr-1" />{readyCount}/{checks.length}</Badge>}
      >
        <ul className="space-y-1.5">
          {checks.map((c, i) => (
            <li key={c.attribute} className={cn("grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-md border px-3 py-2", c.status === "gap" && "border-rose-500/30 bg-rose-500/5", c.status === "ready" && "border-emerald-500/30 bg-emerald-500/5", c.status === "partial" && "border-amber-500/30 bg-amber-500/5")}>
              <span className="md:col-span-3 text-sm font-semibold">{c.attribute}</span>
              <Select value={c.status} onValueChange={(v) => updateCheck(i, { status: v as any })}>
                <SelectTrigger className="md:col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CHECK_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={c.note} onChange={(e) => updateCheck(i, { note: e.target.value })} placeholder="Evidence / follow-up note (required)" className="md:col-span-7 h-8 text-xs" />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={`Architecture Decision Records (${adrs.length})`} subtitle="One ADR per material decision. Each needs context, decision and consequences.">
        <AdrCoverageStrip adrs={adrs} minRequired={3} />
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="ADR title (e.g. Adopt event sourcing for orders)" value={adrTitleDraft} onChange={(e) => setAdrTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAdr(); } }} />
          <Button onClick={addAdr} className="gap-1"><Plus className="h-4 w-4" /> Add ADR</Button>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : adrs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <FileText className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No ADRs yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {adrs.map((a, i) => (
              <li key={i} id={`adr-item-${i}`} className="rounded-xl border bg-background p-3 space-y-2 scroll-mt-24">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <span className="md:col-span-2 font-mono text-[10px] text-muted-foreground">{a.id}</span>
                  <Input value={a.title} onChange={(ev) => updateAdr(i, { title: ev.target.value })} className="md:col-span-7 text-sm font-semibold" />
                  <Select value={a.status} onValueChange={(v) => updateAdr(i, { status: v })}>
                    <SelectTrigger className="md:col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["proposed", "accepted", "deprecated", "superseded"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end" onClick={() => removeAdr(i)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Textarea rows={2} value={a.context} onChange={(ev) => updateAdr(i, { context: ev.target.value })} placeholder="Context (what forces are at play)" className="text-xs" />
                  <Textarea rows={2} value={a.decision} onChange={(ev) => updateAdr(i, { decision: ev.target.value })} placeholder="Decision (what we decided)" className="text-xs" />
                  <Textarea rows={2} value={a.consequences} onChange={(ev) => updateAdr(i, { consequences: ev.target.value })} placeholder="Consequences (one per line)" className="text-xs" />
                  <Textarea rows={2} value={a.rationale} onChange={(ev) => updateAdr(i, { rationale: ev.target.value })} placeholder="Rationale" className="text-xs" />
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

function AdrCoverageStrip({ adrs, minRequired }: { adrs: Adr[]; minRequired: number }) {
  const items = adrs.map((a, i) => {
    const complete = a.title.trim() && a.context.trim() && a.decision.trim() && a.consequences.trim();
    const tone = a.status === "accepted" && complete
      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
      : !complete
        ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20"
        : "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20";
    const label = !complete ? "gap" : a.status;
    return { i, id: a.id, title: a.title || "(untitled)", tone, label };
  });
  const missing = Math.max(0, minRequired - adrs.length);
  const jump = (i: number) => {
    const el = document.getElementById(`adr-item-${i}`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("ring-2","ring-primary"); setTimeout(() => el.classList.remove("ring-2","ring-primary"), 1400); }
  };
  const accepted = items.filter((x) => x.label === "accepted").length;
  const drafts = items.filter((x) => x.label !== "accepted" && x.label !== "gap").length;
  const gaps = items.filter((x) => x.label === "gap").length;
  return (
    <div className="mb-3 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">ADR coverage</span>
        <span className="text-[10px] text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{accepted} accepted</span>
          {" · "}
          <span className="text-amber-600 dark:text-amber-400 font-medium">{drafts} drafted</span>
          {" · "}
          <span className="text-rose-600 dark:text-rose-400 font-medium">{gaps} incomplete</span>
          {missing > 0 && <> · <span className="text-rose-600 dark:text-rose-400 font-medium">{missing} missing slot{missing === 1 ? "" : "s"}</span></>}
        </span>
      </div>
      {items.length === 0 && missing === 0 ? (
        <p className="text-xs text-muted-foreground">No ADRs yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <button
              key={it.i}
              type="button"
              onClick={() => jump(it.i)}
              className={cn("px-2 py-1 rounded-md border text-[11px] font-medium transition-colors max-w-[220px] truncate", it.tone)}
              title={`${it.id} — ${it.title} (${it.label}) · click to jump`}
            >
              <span className="font-mono text-[10px] opacity-70 mr-1">{it.id}</span>{it.title}
            </button>
          ))}
          {Array.from({ length: missing }).map((_, i) => (
            <span key={`m-${i}`} className="px-2 py-1 rounded-md border border-dashed border-rose-500/40 text-rose-600 dark:text-rose-400 text-[11px] font-medium bg-rose-500/5">
              + ADR needed
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeChecks(raw: unknown): CheckItem[] {

  const base: CheckItem[] = ISO_25010_ATTRS.map((a) => ({ attribute: a, status: "partial", note: "" }));
  if (!Array.isArray(raw)) return base;
  const byAttr = new Map<string, CheckItem>();
  for (const c of raw as any[]) {
    if (c && typeof c.attribute === "string") {
      byAttr.set(c.attribute, {
        attribute: c.attribute,
        status: CHECK_STATES.includes(c.status) ? c.status : "partial",
        note: typeof c.note === "string" ? c.note : "",
      });
    }
  }
  return base.map((b) => byAttr.get(b.attribute) ?? b);
}

function normalizeAdrs(raw: unknown): Adr[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: any, idx: number) => {
    if (!a || typeof a.title !== "string") return null;
    const consequences = Array.isArray(a.consequences) ? a.consequences.filter((x: unknown) => typeof x === "string").join("\n") : typeof a.consequences === "string" ? a.consequences : "";
    return {
      id: typeof a.id === "string" ? a.id : `ADR-${String(idx + 1).padStart(4, "0")}`,
      title: a.title,
      status: typeof a.status === "string" ? a.status : "accepted",
      context: typeof a.context === "string" ? a.context : "",
      decision: typeof a.decision === "string" ? a.decision : "",
      consequences,
      rationale: typeof a.rationale === "string" ? a.rationale : "",
    } as Adr;
  }).filter((a): a is Adr => !!a);
}

function hashOf(checks: CheckItem[], adrs: Adr[], summary: string): string {
  return JSON.stringify({
    checks: checks.map((c) => [c.attribute, c.status, c.note]),
    adrs: adrs.map((a) => [a.id, a.title, a.status, a.context, a.decision, a.consequences, a.rationale]),
    summary,
  });
}
