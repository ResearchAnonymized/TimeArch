/**
 * Stage 18 — Continuous evolution (Studio native).
 *
 * The terminal stage of the lifecycle. Captures the KPIs, drift signals,
 * and feedback cadences that keep the architecture healthy after go-live.
 * Optional agent proposes evolution paths from prior artifacts.
 *
 * Completion gates (no further stage to advance to):
 *   - Stage 17 (Deployment blueprint) locked.
 *   - ≥3 KPIs with target and cadence.
 *   - ≥1 drift signal defined (with source + threshold).
 *   - ≥1 feedback loop (channel + cadence + owner).
 *   - Evolution narrative (≥120 chars).
 *   - Latest evolution plan saved as an artifact version.
 *
 * When all gates pass the stage marks the project's lifecycle complete —
 * the "advance" button records the completion via the parent handler.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, TrendingUp, Radar, Repeat, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import PackageLockStatus from "@/components/studio/PackageLockStatus";

interface Kpi { name: string; target: string; cadence: string; owner: string }
interface DriftSignal { name: string; source: string; threshold: string; response: string }
interface FeedbackLoop { channel: string; cadence: string; owner: string; input_type: string }

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage18Evolution({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [signals, setSignals] = useState<DriftSignal[]>([]);
  const [loops, setLoops] = useState<FeedbackLoop[]>([]);
  const [narrative, setNarrative] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [deployVersion, setDeployVersion] = useState(0);
  const [kpiDraft, setKpiDraft] = useState("");
  const [signalDraft, setSignalDraft] = useState("");
  const [loopDraft, setLoopDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [own, deploy] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 18).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 17).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setDeployVersion(deploy.data?.version ?? 0);
    if (own.data) {
      setArtifactVersion(own.data.version ?? 0);
      const c = own.data.content as any;
      const k = normKpis(c?.kpis); const s = normSignals(c?.drift_signals); const l = normLoops(c?.feedback_loops);
      const n = typeof c?.narrative === "string" ? c.narrative : typeof c?.summary === "string" ? c.summary : "";
      setKpis(k); setSignals(s); setLoops(l); setNarrative(n);
      setSavedHash(hashOf(k, s, l, n));
    } else {
      setKpis([]); setSignals([]); setLoops([]); setNarrative("");
      setSavedHash(hashOf([], [], [], "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 18, load);

  const dirty = hashOf(kpis, signals, loops, narrative) !== savedHash;
  const hasDeploy = deployVersion > 0;
  const enoughKpis = kpis.length >= 3;
  const kpisComplete = kpis.every((k) => k.name.trim() && k.target.trim() && k.cadence.trim());
  const hasSignals = signals.length >= 1 && signals.every((s) => s.name.trim() && s.source.trim() && s.threshold.trim());
  const hasLoops = loops.length >= 1 && loops.every((l) => l.channel.trim() && l.cadence.trim() && l.owner.trim());
  const narrativeOk = narrative.trim().length >= 120;
  const ready = hasDeploy && enoughKpis && kpisComplete && hasSignals && hasLoops && narrativeOk && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasDeploy) issues.push("Stage 17 (Deployment blueprint) must be locked first.");
    if (!enoughKpis) issues.push(`Define at least 3 KPIs (have ${kpis.length}).`);
    if (!kpisComplete) issues.push("Every KPI needs a name, target and cadence.");
    if (!hasSignals) issues.push("Define at least 1 drift signal with source and threshold.");
    if (!hasLoops) issues.push("Define at least 1 feedback loop with channel, cadence and owner.");
    if (!narrativeOk) issues.push(`Evolution narrative too short (${narrative.trim().length}/120 chars).`);
    if (artifactVersion === 0) issues.push("Save the evolution plan as an artifact version before completing.");
    return issues;
  }, [kpis, signals, loops, narrative, hasDeploy, enoughKpis, kpisComplete, hasSignals, hasLoops, narrativeOk, artifactVersion]);

  function addKpi() {
    const n = kpiDraft.trim(); if (!n) return toast.error("Give the KPI a name.");
    setKpis((p) => [...p, { name: n, target: "", cadence: "monthly", owner: "" }]); setKpiDraft("");
  }
  function addSignal() {
    const n = signalDraft.trim(); if (!n) return toast.error("Give the signal a name.");
    setSignals((p) => [...p, { name: n, source: "", threshold: "", response: "" }]); setSignalDraft("");
  }
  function addLoop() {
    const n = loopDraft.trim(); if (!n) return toast.error("Give the loop a channel.");
    setLoops((p) => [...p, { channel: n, cadence: "monthly", owner: "", input_type: "" }]); setLoopDraft("");
  }

  async function persist() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 18, type: "executive_summary",
      title: `Continuous Evolution Plan (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Continuous Evolution Plan (v${nextVersion})`,
        summary: narrative,
        narrative,
        key_findings: [
          `${kpis.length} KPI(s), ${signals.length} drift signal(s), ${loops.length} feedback loop(s).`,
          `Deployment anchor: Stage 17 v${deployVersion}.`,
        ],
        kpis, drift_signals: signals, feedback_loops: loops,
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasDeploy ? "Lock the deployment blueprint in Stage 17 first."
    : !enoughKpis || !kpisComplete ? "Add at least 3 complete KPIs."
    : !hasSignals ? "Add at least one drift signal."
    : !hasLoops ? "Add at least one feedback loop."
    : !narrativeOk ? "Evolution narrative must be at least 120 characters."
    : artifactVersion === 0 ? "Save the evolution plan first."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 18 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Lifecycle complete" : kpis.length + signals.length + loops.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : "primary" }}
      stats={[
        { label: "KPIs", value: loading ? "—" : kpis.length, sub: "≥3 needed", tone: enoughKpis && kpisComplete ? "emerald" : "amber" },
        { label: "Drift signals", value: loading ? "—" : signals.length, sub: "≥1 needed", tone: hasSignals ? "emerald" : "amber" },
        { label: "Feedback loops", value: loading ? "—" : loops.length, sub: "≥1 needed", tone: hasLoops ? "emerald" : "amber" },
        { label: "Narrative", value: loading ? "—" : narrative.trim().length, sub: "≥120 chars", tone: narrativeOk ? "emerald" : "amber" },
      ]}
      checks={[
        { key: "deploy", label: `Deployment blueprint locked (Stage 17${deployVersion ? ` v${deployVersion}` : ""})`, ok: hasDeploy },
        { key: "kpis", label: "≥3 KPIs with target & cadence", ok: enoughKpis && kpisComplete },
        { key: "signals", label: "Drift signals defined", ok: hasSignals },
        { key: "loops", label: "Feedback loops defined", ok: hasLoops },
        { key: "narrative", label: "Evolution narrative written (≥120 chars)", ok: narrativeOk },
        { key: "saved", label: "Evolution plan saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready to declare the lifecycle complete?"
      checklistBlurb="Stage 18 is the terminal stage — this locks the full 18-stage journey."
      advance={{ label: ready ? "Evolution plan locked — mark lifecycle complete" : "Complete the evolution plan to finish", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Complete lifecycle", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Run the Continuous Evolution agent"
        subtitle={hasDeploy
          ? "Drafts KPIs, drift signals and feedback-loop cadence from Stage 17's blueprint."
          : "Locked until a Deployment Blueprint (Stage 17) is saved."}
        right={
          <RunAgentButton
            onRun={runStage}
            running={running || polling}
            hasArtifact={artifactVersion > 0}
            disabledReason={!hasDeploy ? "Complete deployment planning in Stage 17 first." : undefined}
          />
        }
      >
        <PackageLockStatus projectId={projectId} onStage={18} />
        <p className="text-xs text-muted-foreground mt-2">
          Saves a new evolution-plan artifact version. Refine the fields below afterwards.
        </p>
      </SectionCard>

      <SectionCard
        title="Evolution narrative"
        subtitle="How the architecture will keep evolving — cadence, triggers, and decision authority."
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasDeploy ? "Complete deployment planning in Stage 17 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <Textarea rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Describe how the system will evolve — review cadence, evolution triggers, tech-debt policy, and the decision authority for material changes. Minimum 120 characters." />
        <div className="text-[10px] text-muted-foreground mt-1">{narrative.trim().length} / 120 chars minimum</div>
        {ready && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2">
            <PartyPopper className="h-4 w-4 text-emerald-500 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-emerald-700 dark:text-emerald-300">All 18 stages are complete.</div>
              <div className="text-muted-foreground">Lock the lifecycle to signal continuous operation.</div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={`KPIs (${kpis.length})`} subtitle="Quantitative measures that tell you the architecture is healthy.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="KPI name (e.g. p95 checkout latency)" value={kpiDraft} onChange={(e) => setKpiDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKpi(); } }} />
          <Button onClick={addKpi} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
          : kpis.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8"><TrendingUp className="h-6 w-6 mx-auto mb-2 opacity-40" />No KPIs yet.</div>
          ) : (
            <ul className="space-y-2">
              {kpis.map((k, i) => (
                <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-md border px-3 py-2">
                  <Input value={k.name} onChange={(e) => setKpis((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="md:col-span-4 h-8 text-xs font-semibold" />
                  <Input value={k.target} onChange={(e) => setKpis((p) => p.map((x, idx) => idx === i ? { ...x, target: e.target.value } : x))} placeholder="Target (e.g. <300ms)" className="md:col-span-3 h-8 text-xs" />
                  <Input value={k.cadence} onChange={(e) => setKpis((p) => p.map((x, idx) => idx === i ? { ...x, cadence: e.target.value } : x))} placeholder="Cadence" className="md:col-span-2 h-8 text-xs" />
                  <Input value={k.owner} onChange={(e) => setKpis((p) => p.map((x, idx) => idx === i ? { ...x, owner: e.target.value } : x))} placeholder="Owner" className="md:col-span-2 h-8 text-xs" />
                  <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end h-8 w-8" onClick={() => setKpis((p) => p.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <SectionCard title={`Drift signals (${signals.length})`} subtitle="Early-warning indicators that the architecture is drifting from intent.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Signal name (e.g. Unauthorized public buckets)" value={signalDraft} onChange={(e) => setSignalDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSignal(); } }} />
          <Button onClick={addSignal} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
          : signals.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8"><Radar className="h-6 w-6 mx-auto mb-2 opacity-40" />No signals yet.</div>
          ) : (
            <ul className="space-y-2">
              {signals.map((s, i) => (
                <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-md border px-3 py-2">
                  <Input value={s.name} onChange={(e) => setSignals((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="md:col-span-3 h-8 text-xs font-semibold" />
                  <Input value={s.source} onChange={(e) => setSignals((p) => p.map((x, idx) => idx === i ? { ...x, source: e.target.value } : x))} placeholder="Source (tool / metric)" className="md:col-span-3 h-8 text-xs" />
                  <Input value={s.threshold} onChange={(e) => setSignals((p) => p.map((x, idx) => idx === i ? { ...x, threshold: e.target.value } : x))} placeholder="Threshold" className="md:col-span-2 h-8 text-xs" />
                  <Input value={s.response} onChange={(e) => setSignals((p) => p.map((x, idx) => idx === i ? { ...x, response: e.target.value } : x))} placeholder="Response" className="md:col-span-3 h-8 text-xs" />
                  <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end h-8 w-8" onClick={() => setSignals((p) => p.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <SectionCard title={`Feedback loops (${loops.length})`} subtitle="How real-world signals feed back into architecture decisions.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Channel (e.g. Post-incident review)" value={loopDraft} onChange={(e) => setLoopDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLoop(); } }} />
          <Button onClick={addLoop} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
          : loops.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8"><Repeat className="h-6 w-6 mx-auto mb-2 opacity-40" />No feedback loops yet.</div>
          ) : (
            <ul className="space-y-2">
              {loops.map((l, i) => (
                <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-md border px-3 py-2">
                  <Input value={l.channel} onChange={(e) => setLoops((p) => p.map((x, idx) => idx === i ? { ...x, channel: e.target.value } : x))} className="md:col-span-4 h-8 text-xs font-semibold" />
                  <Input value={l.cadence} onChange={(e) => setLoops((p) => p.map((x, idx) => idx === i ? { ...x, cadence: e.target.value } : x))} placeholder="Cadence" className="md:col-span-2 h-8 text-xs" />
                  <Input value={l.owner} onChange={(e) => setLoops((p) => p.map((x, idx) => idx === i ? { ...x, owner: e.target.value } : x))} placeholder="Owner" className="md:col-span-2 h-8 text-xs" />
                  <Input value={l.input_type} onChange={(e) => setLoops((p) => p.map((x, idx) => idx === i ? { ...x, input_type: e.target.value } : x))} placeholder="Input type" className="md:col-span-3 h-8 text-xs" />
                  <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end h-8 w-8" onClick={() => setLoops((p) => p.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      {validation.length > 0 && (
        <SectionCard title="Validation issues" subtitle="Resolve these before completing the lifecycle.">
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

function normKpis(raw: unknown): Kpi[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k: any) => {
    if (!k || typeof k.name !== "string") return null;
    return { name: k.name, target: typeof k.target === "string" ? k.target : "", cadence: typeof k.cadence === "string" ? k.cadence : "monthly", owner: typeof k.owner === "string" ? k.owner : "" };
  }).filter(Boolean) as Kpi[];
}
function normSignals(raw: unknown): DriftSignal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => {
    if (!s || typeof s.name !== "string") return null;
    return { name: s.name, source: typeof s.source === "string" ? s.source : "", threshold: typeof s.threshold === "string" ? s.threshold : "", response: typeof s.response === "string" ? s.response : "" };
  }).filter(Boolean) as DriftSignal[];
}
function normLoops(raw: unknown): FeedbackLoop[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l: any) => {
    if (!l || typeof l.channel !== "string") return null;
    return { channel: l.channel, cadence: typeof l.cadence === "string" ? l.cadence : "monthly", owner: typeof l.owner === "string" ? l.owner : "", input_type: typeof l.input_type === "string" ? l.input_type : "" };
  }).filter(Boolean) as FeedbackLoop[];
}
function hashOf(k: Kpi[], s: DriftSignal[], l: FeedbackLoop[], n: string): string {
  return JSON.stringify({ k, s, l, n });
}
