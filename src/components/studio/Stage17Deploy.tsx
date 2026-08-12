/**
 * Stage 17 — Deployment blueprint (Studio native).
 *
 * Environments, cutover plan, rollback plan and runbook links. Optional
 * agent generates a first-cut blueprint from the implementation plan.
 *
 * Readiness gates to advance to Stage 18 (Continuous evolution):
 *   - Stage 16 (Implementation plan) locked.
 *   - ≥1 environment defined (prod required).
 *   - ≥3 cutover steps with owner.
 *   - Rollback plan (≥60 chars) and runbook URL provided.
 *   - Latest blueprint saved as an artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import PackageLockStatus from "@/components/studio/PackageLockStatus";
import { cn } from "@/lib/utils";

const ENV_TIERS = ["dev", "staging", "prod", "dr"] as const;
type EnvTier = typeof ENV_TIERS[number];

interface EnvRow { name: string; tier: EnvTier; region: string; notes: string }
interface CutoverStep { order: number; step: string; owner: string; window: string }

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage17Deploy({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(17);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [envs, setEnvs] = useState<EnvRow[]>([]);
  const [steps, setSteps] = useState<CutoverStep[]>([]);
  const [rollback, setRollback] = useState("");
  const [runbook, setRunbook] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [planVersion, setPlanVersion] = useState(0);
  const [envDraft, setEnvDraft] = useState("");
  const [stepDraft, setStepDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [own, plan] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 17).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 16).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setPlanVersion(plan.data?.version ?? 0);
    if (own.data) {
      setArtifactVersion(own.data.version ?? 0);
      const c = own.data.content as any;
      const e = normalizeEnvs(c?.environments);
      const s = normalizeSteps(c?.cutover_steps);
      setEnvs(e); setSteps(s);
      setRollback(typeof c?.rollback_plan === "string" ? c.rollback_plan : "");
      setRunbook(typeof c?.runbook_url === "string" ? c.runbook_url : "");
      setSavedHash(hashOf(e, s, typeof c?.rollback_plan === "string" ? c.rollback_plan : "", typeof c?.runbook_url === "string" ? c.runbook_url : ""));
    } else {
      setEnvs([]); setSteps([]); setRollback(""); setRunbook("");
      setSavedHash(hashOf([], [], "", "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 17, load);

  const dirty = hashOf(envs, steps, rollback, runbook) !== savedHash;
  const hasPlan = planVersion > 0;
  const hasProd = envs.some((e) => e.tier === "prod");
  const enoughSteps = steps.length >= 3;
  const stepsComplete = steps.every((s) => s.step.trim() && s.owner.trim());
  const rollbackOk = rollback.trim().length >= 60;
  const runbookOk = /^https?:\/\//i.test(runbook.trim());
  const ready = hasPlan && hasProd && enoughSteps && stepsComplete && rollbackOk && runbookOk && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasPlan) issues.push("Stage 16 (Implementation plan) must be locked first.");
    if (envs.length === 0) issues.push("Define at least one target environment.");
    if (!hasProd) issues.push("At least one environment must be tier 'prod'.");
    if (!enoughSteps) issues.push(`Add at least 3 cutover steps (have ${steps.length}).`);
    if (!stepsComplete) issues.push("Every cutover step needs a description and an owner.");
    if (!rollbackOk) issues.push(`Rollback plan too short (${rollback.trim().length}/60 chars).`);
    if (!runbookOk) issues.push("Provide a runbook URL (must start with http/https).");
    if (artifactVersion === 0) issues.push("Save the blueprint as an artifact version before advancing.");
    return issues;
  }, [envs, steps, rollback, runbook, hasPlan, hasProd, enoughSteps, stepsComplete, rollbackOk, runbookOk, artifactVersion]);

  function addEnv() {
    const n = envDraft.trim();
    if (!n) return toast.error("Give the environment a name.");
    setEnvs((p) => [...p, { name: n, tier: "dev", region: "", notes: "" }]);
    setEnvDraft("");
  }
  function updateEnv(i: number, patch: Partial<EnvRow>) { setEnvs((p) => p.map((e, idx) => (idx === i ? { ...e, ...patch } : e))); }
  function removeEnv(i: number) { setEnvs((p) => p.filter((_, idx) => idx !== i)); }
  function addStep() {
    const s = stepDraft.trim();
    if (!s) return toast.error("Describe the cutover step.");
    setSteps((p) => [...p, { order: p.length + 1, step: s, owner: "", window: "" }]);
    setStepDraft("");
  }
  function updateStep(i: number, patch: Partial<CutoverStep>) { setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s))); }
  function removeStep(i: number) { setSteps((p) => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 }))); }

  async function suggestBlueprint() {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-deployment-blueprint", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const nextEnvs = normalizeEnvs(data?.environments);
      const nextSteps = normalizeSteps(data?.cutover_steps);
      if (nextEnvs.length === 0 && nextSteps.length === 0) {
        toast.error("The AI didn't return a usable blueprint — try again or fill in manually.");
        return;
      }
      setEnvs(replaceMode ? nextEnvs : [...envs, ...nextEnvs]);
      setSteps(
        (replaceMode ? nextSteps : [...steps, ...nextSteps]).map((s, idx) => ({ ...s, order: idx + 1 }))
      );
      if (typeof data?.rollback_plan === "string" && data.rollback_plan && (!rollback.trim() || replaceMode)) {
        setRollback(data.rollback_plan);
      }
      if (typeof data?.runbook_url === "string" && data.runbook_url && (!runbook.trim() || replaceMode)) {
        setRunbook(data.runbook_url);
      }
      toast.success(`Added ${nextEnvs.length} environment(s) and ${nextSteps.length} cutover step(s). Review and Save when ready.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate blueprint.");
    } finally {
      setSuggesting(false);
    }
  }

  async function persist() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 17, type: "validation_report",
      title: `Deployment Blueprint (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Deployment Blueprint (v${nextVersion})`,
        summary: `${envs.length} environment(s), ${steps.length} cutover step(s).`,
        key_findings: [
          `Environments: ${envs.map((e) => `${e.name}(${e.tier})`).join(", ") || "—"}.`,
          `Cutover has ${steps.length} step(s).`,
          `Plan anchor: Stage 16 v${planVersion}.`,
        ],
        environments: envs,
        cutover_steps: steps,
        rollback_plan: rollback,
        runbook_url: runbook,
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasPlan ? "Lock the implementation plan in Stage 16 first."
    : !hasProd ? "Add a prod-tier environment."
    : !enoughSteps ? "Add at least 3 cutover steps."
    : !stepsComplete ? "Every cutover step needs an owner."
    : !rollbackOk ? "Rollback plan must be at least 60 characters."
    : !runbookOk ? "Runbook URL must start with http/https."
    : artifactVersion === 0 ? "Save the blueprint before advancing."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 17 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : envs.length > 0 || steps.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : envs.length > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Environments", value: loading ? "—" : envs.length, sub: hasProd ? "prod covered" : "prod required", tone: hasProd ? "emerald" : "amber" },
        { label: "Cutover steps", value: loading ? "—" : steps.length, sub: "≥3 needed", tone: enoughSteps ? "emerald" : "amber" },
        { label: "Rollback", value: loading ? "—" : rollback.trim().length, sub: "≥60 chars", tone: rollbackOk ? "emerald" : "amber" },
        { label: "Runbook", value: runbookOk ? "OK" : "—", sub: "URL required", tone: runbookOk ? "emerald" : "amber" },
      ]}
      checks={[
        { key: "plan", label: `Implementation plan locked (Stage 16${planVersion ? ` v${planVersion}` : ""})`, ok: hasPlan },
        { key: "prod", label: "Prod-tier environment defined", ok: hasProd },
        { key: "steps", label: "≥3 cutover steps with owner", ok: enoughSteps && stepsComplete },
        { key: "rollback", label: "Rollback plan written (≥60 chars)", ok: rollbackOk },
        { key: "runbook", label: "Runbook URL provided", ok: runbookOk },
        { key: "saved", label: "Blueprint saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready for continuous evolution?"
      checklistBlurb="Stage 18 tracks drift, KPIs and feedback loops after go-live."
      advance={{ label: ready ? "Blueprint locked — advance to Stage 18" : "Complete the deployment blueprint to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Continuous evolution", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Populate the deployment blueprint"
        subtitle={hasPlan
          ? "Suggest environments, cutover steps, rollback plan and a runbook URL from the approved plan — then edit below."
          : "Locked until an Implementation Plan (Stage 16) is saved."}
        right={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={suggestBlueprint}
              disabled={suggesting || !hasPlan}
              className="gap-1.5"
              title="Reads Stage 16 plan + infra artifacts and drafts the blueprint fields below."
            >
              {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {suggesting ? "Suggesting…" : envs.length === 0 && steps.length === 0 ? "Suggest blueprint" : "Suggest more"}
            </Button>
          </div>
        }
      >
        <PackageLockStatus projectId={projectId} onStage={17} />
        {envs.length > 0 || steps.length > 0 ? (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 cursor-pointer select-none">
            <input type="checkbox" checked={replaceMode} onChange={(e) => setReplaceMode(e.target.checked)} className="h-3 w-3" />
            Replace existing entries when suggesting (otherwise append)
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground mt-2">
          Note: the legacy "Run Code Validation" agent produces a different artifact shape and does not populate these fields — use <b>Suggest blueprint</b> above (or fill in manually) to prepare Stage 17 for advance.
        </p>
      </SectionCard>

      <SectionCard
        title="Runbook & rollback"
        subtitle="Where the ops team goes when something breaks — and how you fall back."
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasPlan ? "Create a delivery plan in Stage 16 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Runbook URL *</label>
        <Input value={runbook} onChange={(e) => setRunbook(e.target.value)} placeholder="https://…/runbook" className={cn(!runbookOk && runbook && "border-rose-500/40")} />
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mt-4 mb-1 block">Rollback plan *</label>
        <Textarea rows={4} value={rollback} onChange={(e) => setRollback(e.target.value)} placeholder="How to revert cleanly — data compatibility, DNS, feature flags, decision authority. Minimum 60 characters." />
        <div className="text-[10px] text-muted-foreground mt-1">{rollback.trim().length} / 60 chars minimum</div>
      </SectionCard>

      <SectionCard title={`Environments (${envs.length})`} subtitle="Every target the release must land in.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Environment name (e.g. eu-west-prod)" value={envDraft} onChange={(e) => setEnvDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEnv(); } }} />
          <Button onClick={addEnv} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
          : envs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8"><Rocket className="h-6 w-6 mx-auto mb-2 opacity-40" />No environments yet.</div>
          ) : (
            <ul className="space-y-2">
              {envs.map((e, i) => (
                <li key={i} className={cn("rounded-lg border px-3 py-2.5", e.tier === "prod" && "border-emerald-500/30 bg-emerald-500/5")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Environment name</label>
                      <Input value={e.name} onChange={(ev) => updateEnv(i, { name: ev.target.value })} className="h-8 text-xs font-semibold mt-0.5" />
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 mt-4 flex-shrink-0" onClick={() => removeEnv(i)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tier</label>
                      <Select value={e.tier} onValueChange={(v) => updateEnv(i, { tier: v as EnvTier })}>
                        <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                        <SelectContent>{ENV_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Region</label>
                      <Input value={e.region} onChange={(ev) => updateEnv(i, { region: ev.target.value })} placeholder="e.g. eu-west-1" className="h-8 text-xs mt-0.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</label>
                      <Textarea
                        value={e.notes}
                        onChange={(ev) => updateEnv(i, { notes: ev.target.value })}
                        placeholder="Purpose, caveats, dependencies, capacity notes — write as much as you need."
                        rows={4}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${Math.max(el.scrollHeight, 96)}px`; } }}
                        onInput={(ev) => { const t = ev.currentTarget; t.style.height = "auto"; t.style.height = `${Math.max(t.scrollHeight, 96)}px`; }}
                        className="text-sm leading-relaxed mt-0.5 resize-y min-h-[6rem] w-full overflow-hidden"
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <SectionCard title={`Cutover steps (${steps.length})`} subtitle="Ordered sequence for go-live. Each step needs an owner.">
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Cutover step (e.g. Freeze writes on legacy DB)" value={stepDraft} onChange={(e) => setStepDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }} />
          <Button onClick={addStep} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
          : steps.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No cutover steps yet.</div>
          ) : (
            <ul className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="rounded-lg border px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">#{s.order}</span>
                    <Input value={s.step} onChange={(ev) => updateStep(i, { step: ev.target.value })} placeholder="Describe the step" className="h-8 text-xs font-semibold flex-1" />
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => removeStep(i)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</label>
                      <Input value={s.owner} onChange={(ev) => updateStep(i, { owner: ev.target.value })} placeholder="e.g. DBA Team" className="h-8 text-xs mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Window</label>
                      <Input value={s.window} onChange={(ev) => updateStep(i, { window: ev.target.value })} placeholder="e.g. T+0h" className="h-8 text-xs mt-0.5" />
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

function normalizeEnvs(raw: unknown): EnvRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: any) => {
    if (!e || typeof e.name !== "string") return null;
    const tier: EnvTier = ENV_TIERS.includes(e.tier) ? e.tier : "dev";
    return { name: e.name, tier, region: typeof e.region === "string" ? e.region : "", notes: typeof e.notes === "string" ? e.notes : "" };
  }).filter(Boolean) as EnvRow[];
}
function normalizeSteps(raw: unknown): CutoverStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any, idx: number) => {
    if (!s || typeof s.step !== "string") return null;
    return { order: typeof s.order === "number" ? s.order : idx + 1, step: s.step, owner: typeof s.owner === "string" ? s.owner : "", window: typeof s.window === "string" ? s.window : "" };
  }).filter(Boolean) as CutoverStep[];
}
function hashOf(envs: EnvRow[], steps: CutoverStep[], rollback: string, runbook: string): string {
  return JSON.stringify({ envs, steps, rollback, runbook });
}
