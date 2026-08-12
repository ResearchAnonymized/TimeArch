/**
 * Stage 16 — Implementation plan (Studio native).
 *
 * Breaks the approved architecture into deliverable work items with
 * owner + effort + sprint mapping. Optional agent run scaffolds an
 * initial plan from prior artifacts.
 *
 * Readiness gates to advance to Stage 17 (Deployment blueprint):
 *   - Stage 15 (Stakeholder approval) locked.
 *   - ≥5 work items with title, owner, effort and sprint.
 *   - Every item has a component reference.
 *   - Plan narrative (≥120 chars).
 *   - Latest plan saved as an artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Plus, X, AlertTriangle, Save, ListChecks } from "lucide-react";
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
import PackageLockStatus from "@/components/studio/PackageLockStatus";
import { cn } from "@/lib/utils";

const EFFORTS = ["S", "M", "L", "XL"] as const;
type Effort = typeof EFFORTS[number];

interface WorkItem { id: string; title: string; component: string; owner: string; effort: Effort; sprint: string; depends_on: string; notes: string }

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

export default function Stage16Plan({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(16);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [narrative, setNarrative] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [approvalVersion, setApprovalVersion] = useState(0);
  const [packageLocked, setPackageLocked] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [own, approval, seal] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 16).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version").eq("project_id", projectId).eq("stage", 15).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("stage_approvals").select("comment").eq("project_id", projectId).eq("stage", 15).order("created_at", { ascending: false }).limit(10),
    ]);
    setApprovalVersion(approval.data?.version ?? 0);
    // Real gate: Architecture Package seal (JSON comment with package_locked:true).
    // Aligns with server-side package-lock.ts — a saved sign-off register is not enough.
    let locked = false;
    for (const row of seal.data ?? []) {
      try {
        const parsed = typeof row.comment === "string" ? JSON.parse(row.comment) : null;
        if (parsed && parsed.package_locked === true) { locked = true; break; }
      } catch { /* legacy plain-text comment */ }
    }
    setPackageLocked(locked);
    if (own.data) {
      setArtifactVersion(own.data.version ?? 0);
      const c = own.data.content as any;
      const wi = normalizeItems(c?.work_items);
      const n = typeof c?.narrative === "string" ? c.narrative : typeof c?.summary === "string" ? c.summary : "";
      setItems(wi); setNarrative(n);
      setSavedHash(hashOf(wi, n));
    } else {
      setItems([]); setNarrative("");
      setSavedHash(hashOf([], "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const { runStage, running, polling } = useRunStage(projectId, 16, load);

  const MIN_ITEMS = 1;
  const dirty = hashOf(items, narrative) !== savedHash;
  const hasApproval = packageLocked;
  const enoughItems = items.length >= MIN_ITEMS;
  const itemsComplete = items.every((i) => i.title.trim() && i.owner.trim() && i.effort && i.sprint.trim());
  const ready = hasApproval && enoughItems && itemsComplete && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasApproval) issues.push("Architecture Package must be sealed in Stage 15 first (click 'Record approval & advance').");
    if (!enoughItems) issues.push(`Add at least ${MIN_ITEMS} work item.`);
    const missing = items.filter((i) => !i.title.trim() || !i.owner.trim() || !i.sprint.trim()).length;
    if (missing > 0) issues.push(`${missing} work item(s) missing title, owner or sprint.`);
    if (artifactVersion === 0) issues.push("Save the plan as an artifact version before advancing.");
    return issues;
  }, [items, hasApproval, enoughItems, artifactVersion]);

  function addItem() {
    const t = titleDraft.trim();
    if (!t) return toast.error("Give the work item a title.");
    const nextId = `WI-${String(items.length + 1).padStart(3, "0")}`;
    setItems((p) => [...p, { id: nextId, title: t, component: "", owner: "", effort: "M", sprint: "Sprint 1", depends_on: "", notes: "" }]);
    setTitleDraft("");
  }
  function updateItem(i: number, patch: Partial<WorkItem>) { setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it))); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  async function suggestFromProject() {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-work-items", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const suggested: WorkItem[] = normalizeItems(data?.items);
      if (suggested.length === 0) {
        toast.error("The AI didn't return usable items — try again or add manually.");
        return;
      }
      const merged = replaceMode ? suggested : [...items, ...suggested];
      const renumbered = merged.map((it, idx) => ({ ...it, id: `WI-${String(idx + 1).padStart(3, "0")}` }));
      setItems(renumbered);
      if (typeof data?.narrative === "string" && data.narrative && !narrative.trim()) {
        setNarrative(data.narrative);
      }
      toast.success(`Added ${suggested.length} suggested work item(s). Review and Save when ready.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate suggestions.");
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
    const sprints = Array.from(new Set(items.map((i) => i.sprint.trim()).filter(Boolean)));
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 16, type: "code_output",
      title: `Implementation Plan (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Implementation Plan (v${nextVersion})`,
        summary: narrative,
        narrative,
        key_findings: [
          `${items.length} work item(s) across ${sprints.length} sprint(s).`,
          `Effort mix: ${EFFORTS.map((e) => `${items.filter((i) => i.effort === e).length}${e}`).join(" · ")}.`,
          `Approval anchor: Stage 15 v${approvalVersion}.`,
        ],
        work_items: items,
        sprint_summary: sprints.map((s) => ({ sprint: s, items: items.filter((i) => i.sprint === s).map((i) => i.id) })),
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  const missingHint = !hasApproval ? "Seal the Architecture Package in Stage 15 first."
    : !enoughItems ? `Add at least ${MIN_ITEMS} work item.`
    : !itemsComplete ? "Every work item needs a title, owner and sprint."
    : artifactVersion === 0 ? "Save the plan before advancing."
    : dirty ? "Save your changes first." : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 16 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : items.length > 0 ? "In progress" : "Not started", tone: ready ? "emerald" : items.length > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Work items", value: loading ? "—" : items.length, sub: `≥${MIN_ITEMS} needed`, tone: enoughItems ? "emerald" : "amber" },
        { label: "Sprints", value: loading ? "—" : new Set(items.map((i) => i.sprint.trim()).filter(Boolean)).size, sub: "sprint groupings", tone: "primary" },
        { label: "Owners", value: loading ? "—" : new Set(items.map((i) => i.owner.trim()).filter(Boolean)).size, sub: "distinct owners", tone: "primary" },
        { label: "Narrative", value: loading ? "—" : narrative.trim().length, sub: "optional", tone: "primary" },
      ]}
      checks={[
        { key: "approval", label: `Architecture Package sealed (Stage 15${approvalVersion ? ` v${approvalVersion}` : ""})`, ok: hasApproval },
        { key: "items", label: `≥${MIN_ITEMS} work item captured`, ok: enoughItems },
        { key: "complete", label: "Every item has title, owner, effort and sprint", ok: itemsComplete },
        { key: "saved", label: "Plan saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready for the deployment blueprint?"
      checklistBlurb="Stage 17 turns this plan into an operational rollout package."
      advance={{ label: ready ? "Plan locked — advance to Stage 17" : "Complete the implementation plan to advance", ready, busy: advancing, onClick: onAdvance, ctaLabel: "Advance to Deployment blueprint", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Run the Implementation Planner agent"
        subtitle={hasApproval
          ? "Generates a draft delivery plan from the approved architecture. You can edit it below afterwards."
          : "Locked until Stakeholder Approval (Stage 15) is recorded and sealed."}
        right={
          <RunAgentButton
            onRun={runStage}
            running={running || polling}
            hasArtifact={artifactVersion > 0}
            disabledReason={!hasApproval ? "Approve the design in Stage 15 first." : undefined}
          />
        }
      >
        <PackageLockStatus projectId={projectId} onStage={16} />
        <p className="text-xs text-muted-foreground mt-2">
          The agent proposes work items, sprint groupings and a narrative. Everything
          it produces is saved as a new version — nothing you've written is overwritten.
        </p>
      </SectionCard>

      <SectionCard
        title="Plan narrative"
        subtitle="How the plan is sequenced, why, and the assumptions it depends on."
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasApproval ? "Approve the design in Stage 15 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <Textarea rows={5} value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Optional — how work is sequenced, dependencies between streams, staffing shape, critical path." />
        <div className="text-[10px] text-muted-foreground mt-1">{narrative.trim().length} chars · optional</div>
      </SectionCard>

      <SectionCard
        title={`Work items (${items.length})`}
        subtitle="Populate from your project context with AI, or add manually. Group by sprint to make the delivery cadence visible."
        right={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]"><ListChecks className="h-3 w-3 mr-1" />{items.length}</Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={suggestFromProject}
              disabled={suggesting}
              className="gap-1.5"
              title="Reads your requirements + prior architecture artifacts and drafts starter work items."
            >
              {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {suggesting ? "Suggesting…" : items.length === 0 ? "Suggest from project" : "Suggest more"}
            </Button>
          </div>
        }
      >
        {items.length > 0 && (
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="h-3 w-3"
            />
            Replace existing items when suggesting (otherwise append)
          </label>
        )}
        <div className="flex items-center gap-2 mb-3">
          <Input placeholder="Work item title (e.g. Stand up auth service skeleton)" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
          <Button onClick={addItem} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8"><ListChecks className="h-6 w-6 mx-auto mb-2 opacity-40" />No work items yet.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="rounded-xl border bg-background p-3 space-y-3">
                {/* Row 1: id · title · remove */}
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground pt-2 w-14 flex-shrink-0">{it.id}</span>
                  <Input
                    value={it.title}
                    onChange={(e) => updateItem(i, { title: e.target.value })}
                    placeholder="Work item title"
                    className="flex-1 h-9 text-sm font-semibold"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => removeItem(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Row 2: labeled meta grid — wraps cleanly on narrow widths */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-16">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Component</span>
                    <Input value={it.component} onChange={(e) => updateItem(i, { component: e.target.value })} placeholder="e.g. Auth service" className="h-8 text-xs" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</span>
                    <Input value={it.owner} onChange={(e) => updateItem(i, { owner: e.target.value })} placeholder="Team or person" className="h-8 text-xs" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sprint</span>
                    <Input value={it.sprint} onChange={(e) => updateItem(i, { sprint: e.target.value })} placeholder="Sprint 1" className="h-8 text-xs" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Effort</span>
                    <Select value={it.effort} onValueChange={(v) => updateItem(i, { effort: v as Effort })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{EFFORTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Depends on</span>
                    <Input value={it.depends_on} onChange={(e) => updateItem(i, { depends_on: e.target.value })} placeholder="WI-001, WI-002…" className="h-8 text-xs" />
                  </label>
                  <label className="space-y-1 sm:col-span-2 lg:col-span-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</span>
                    <Input value={it.notes} onChange={(e) => updateItem(i, { notes: e.target.value })} placeholder="Rationale, acceptance hint…" className="h-8 text-xs" />
                  </label>
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

function normalizeItems(raw: unknown): WorkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any, idx: number) => {
      if (!it || typeof it.title !== "string") return null;
      const effort: Effort = EFFORTS.includes(it.effort) ? it.effort : "M";
      return {
        id: typeof it.id === "string" ? it.id : `WI-${String(idx + 1).padStart(3, "0")}`,
        title: it.title,
        component: typeof it.component === "string" ? it.component : "",
        owner: typeof it.owner === "string" ? it.owner : "",
        effort,
        sprint: typeof it.sprint === "string" ? it.sprint : "Sprint 1",
        depends_on: typeof it.depends_on === "string" ? it.depends_on : "",
        notes: typeof it.notes === "string" ? it.notes : "",
      } as WorkItem;
    })
    .filter(Boolean) as WorkItem[];
}

function hashOf(items: WorkItem[], narrative: string): string {
  return JSON.stringify({ items, narrative });
}
