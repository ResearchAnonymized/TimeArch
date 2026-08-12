/**
 * Stage 15 — Stakeholder Approval (Studio native).
 *
 * Human-driven sign-off. Consumes the Stage 14 documentation package
 * (executive summary + ADRs + ISO 25010 checklist) and records a
 * stakeholder register. Also writes one row per formal decision to the
 * `stage_approvals` table for governance history.
 *
 * Readiness gates to advance to Stage 16 (Implementation plan):
 *   - Stage 14 (Quality checklists / documentation) locked.
 *   - ≥2 stakeholder decisions recorded (name + role + decision + comment).
 *   - No outstanding "rejected" decisions.
 *   - Approval note (≥80 chars) capturing conditions / next steps.
 *   - Latest register saved as a Stage 15 artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X, AlertTriangle, Save, ShieldCheck, FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import PackageLockStatus from "@/components/studio/PackageLockStatus";
import { cn } from "@/lib/utils";

type Decision = "approved" | "approved_with_conditions" | "rejected" | "pending";

interface Signoff {
  name: string;
  role: string;
  decision: Decision;
  comment: string;
  decided_at?: string;
}

interface Props { projectId: string; advancing: boolean; onAdvance: () => void }

const DECISIONS: Decision[] = ["pending", "approved", "approved_with_conditions", "rejected"];

export default function Stage15Approval({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockRefreshKey, setLockRefreshKey] = useState(0);
  const [signoffs, setSignoffs] = useState<Signoff[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const [savedHash, setSavedHash] = useState("");
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [docsVersion, setDocsVersion] = useState(0);
  const [docsSummary, setDocsSummary] = useState<string>("");
  const [docsAdrCount, setDocsAdrCount] = useState<number>(0);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [own, docs] = await Promise.all([
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 15).order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("architecture_artifacts").select("id, version, content").eq("project_id", projectId).eq("stage", 14).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setDocsVersion(docs.data?.version ?? 0);
    const dc = (docs.data?.content ?? {}) as any;
    setDocsSummary(typeof dc?.executive_summary?.overview === "string" ? dc.executive_summary.overview : typeof dc?.summary === "string" ? dc.summary : "");
    setDocsAdrCount(Array.isArray(dc?.adrs) ? dc.adrs.length : 0);
    if (own.data) {
      setArtifactVersion(own.data.version ?? 0);
      const c = own.data.content as any;
      const s = normalizeSignoffs(c?.signoffs);
      const n = typeof c?.approval_note === "string" ? c.approval_note : "";
      setSignoffs(s); setApprovalNote(n);
      setSavedHash(hashOf(s, n));
    } else {
      setSignoffs([]); setApprovalNote("");
      setSavedHash(hashOf([], "")); setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const dirty = hashOf(signoffs, approvalNote) !== savedHash;
  const hasDocs = docsVersion > 0;
  const enough = signoffs.filter((s) => s.decision !== "pending").length >= 2;
  const noReject = signoffs.every((s) => s.decision !== "rejected");
  const NOTE_MIN = 0; // approval note is optional now
  const noteOk = true;
  const ready = hasDocs && enough && noReject && artifactVersion > 0 && !dirty;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasDocs) issues.push("Stage 14 (Quality checklists & documentation) must be locked first.");
    const decided = signoffs.filter((s) => s.decision !== "pending").length;
    if (decided < 2) issues.push(`Need at least 2 stakeholder decisions (have ${decided}).`);
    const rej = signoffs.filter((s) => s.decision === "rejected").length;
    if (rej > 0) issues.push(`${rej} stakeholder decision(s) still marked 'rejected' — resolve before advancing.`);
    if (artifactVersion === 0) issues.push("Save the sign-off register as an artifact version before advancing.");
    return issues;
  }, [signoffs, hasDocs, artifactVersion]);

  function addSignoff() {
    const n = draftName.trim(); const r = draftRole.trim();
    if (!n || !r) return toast.error("Add both a stakeholder name and role.");
    setSignoffs((p) => [...p, { name: n, role: r, decision: "pending", comment: "" }]);
    setDraftName(""); setDraftRole("");
  }
  function updateSignoff(i: number, patch: Partial<Signoff>) {
    setSignoffs((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch, decided_at: patch.decision && patch.decision !== "pending" ? new Date().toISOString() : s.decided_at } : s)));
  }
  function removeSignoff(i: number) { setSignoffs((p) => p.filter((_, idx) => idx !== i)); }

  async function persist() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); return toast.error("You need to be signed in."); }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const approvedCount = signoffs.filter((s) => s.decision === "approved").length;
    const conditionalCount = signoffs.filter((s) => s.decision === "approved_with_conditions").length;
    const rejectedCount = signoffs.filter((s) => s.decision === "rejected").length;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId, stage: 15, type: "executive_summary",
      title: `Stakeholder Approval Register (v${nextVersion})`, version: nextVersion, status: "draft", created_by: uid, generated_by: "studio_manual",
      content: {
        title: `Stakeholder Approval Register (v${nextVersion})`,
        summary: approvalNote,
        key_findings: [
          `${approvedCount} approved, ${conditionalCount} approved-with-conditions, ${rejectedCount} rejected.`,
          `${signoffs.length} stakeholder(s) recorded.`,
          `Docs package v${docsVersion} · ${docsAdrCount} ADR(s).`,
        ],
        approval_note: approvalNote,
        signoffs,
        docs_version: docsVersion,
      } as unknown as never,
    });
    setSaving(false);
    if (error) return toast.error(`Couldn't save: ${error.message}`);
    toast.success(`Saved as v${nextVersion}`); await load();
  }

  async function lockApproval() {
    if (!ready) return;
    setLocking(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setLocking(false); return toast.error("You need to be signed in."); }
    const now = new Date().toISOString();
    // Snapshot every prior stage's latest artifact so the seal is auditable.
    const { data: artifactSnapshot } = await supabase
      .from("architecture_artifacts")
      .select("id, stage, type, title, status, version")
      .eq("project_id", projectId);
    // NOTE: the server-side gate (supabase/functions/_shared/package-lock.ts)
    // and CodeGenerationGate on the client both require the comment to be
    // JSON containing `package_locked: true`. Writing a plain-text comment
    // here would leave Stage 16–18 blocked with ARCHITECTURE_PACKAGE_NOT_LOCKED.
    const sealComment = JSON.stringify({
      package_locked: true,
      signoff_statement: approvalNote.slice(0, 2000),
      signed_off_by: uid,
      signed_off_at: now,
      signoffs,
      docs_version: docsVersion,
      artifact_count: artifactSnapshot?.length ?? 0,
      artifact_snapshot: artifactSnapshot ?? [],
      approval_artifact_version: artifactVersion,
    });
    const { error } = await supabase.from("stage_approvals").insert({
      project_id: projectId, stage: 15,
      action: "locked",
      approved_by: uid,
      comment: sealComment,
    });
    if (!error) {
      await supabase.from("audit_log").insert({
        project_id: projectId, user_id: uid,
        entity_type: "project", entity_id: null,
        action: "architecture_package_locked",
        details: {
          stage: 15, locked_at: now,
          artifact_count: artifactSnapshot?.length ?? 0,
          via: "stage15_record_approval_and_advance",
        },
      });
    }
    setLocking(false);
    if (error) return toast.error(`Couldn't lock: ${error.message}`);
    toast.success("Architecture Package sealed — Stages 16–18 are now unlocked.");
    setLockRefreshKey((k) => k + 1);
    onAdvance();
  }

  const missingHint = !hasDocs ? "Lock the documentation package in Stage 14 first."
    : !enough ? "Record at least 2 stakeholder decisions."
    : !noReject ? "Resolve rejected decisions before advancing."
    : artifactVersion === 0 ? "Save the register before advancing."
    : dirty ? "Save your changes first." : undefined;

  const decidedCount = signoffs.filter((s) => s.decision !== "pending").length;
  const approvedCount = signoffs.filter((s) => s.decision === "approved" || s.decision === "approved_with_conditions").length;
  const rejectedCount = signoffs.filter((s) => s.decision === "rejected").length;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 15 }}
      kicker={kickerFor(stage)} title={stage.title} blurb={stage.blurb}
      statusPill={{ label: ready ? "Ready to advance" : decidedCount > 0 ? "In review" : "Not started", tone: ready ? "emerald" : decidedCount > 0 ? "primary" : "neutral" }}
      stats={[
        { label: "Stakeholders", value: loading ? "—" : signoffs.length, sub: "on the register", tone: signoffs.length > 0 ? "primary" : "neutral" },
        { label: "Decisions", value: loading ? "—" : `${decidedCount}/${signoffs.length || 0}`, sub: "≥2 needed", tone: enough ? "emerald" : "amber" },
        { label: "Approvals", value: loading ? "—" : approvedCount, sub: "incl. conditional", tone: approvedCount > 0 ? "emerald" : "neutral" },
        { label: "Rejections", value: loading ? "—" : rejectedCount, sub: rejectedCount > 0 ? "must be resolved" : "clear", tone: rejectedCount > 0 ? "rose" : "emerald" },
      ]}
      checks={[
        { key: "docs", label: `Documentation package locked (Stage 14${docsVersion ? ` v${docsVersion}` : ""})`, ok: hasDocs },
        { key: "decisions", label: "≥2 stakeholder decisions recorded", ok: enough },
        { key: "noreject", label: "No outstanding rejections", ok: noReject },
        { key: "saved", label: "Register saved as an artifact version", ok: artifactVersion > 0 && !dirty },
      ]}
      checklistTitle="Ready to hand over for implementation planning?"
      checklistBlurb="Stage 16 breaks the approved architecture into deliverable increments."
      advance={{ label: ready ? "Approval complete — advance to Stage 16" : "Complete the sign-off register to advance", ready, busy: advancing || locking, onClick: lockApproval, ctaLabel: "Record approval & advance", missingHint }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      <SectionCard
        title="Manual stage — no Run-agent button"
        subtitle="Stakeholder Approval is a human sign-off gate. Instead of running an agent, you lock the Architecture Package here."
        right={
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    size="sm"
                    onClick={lockApproval}
                    disabled={!ready || locking || advancing}
                    className="gap-1.5"
                  >
                    {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                    {ready ? "Lock Architecture Package" : "Lock package (checklist incomplete)"}
                  </Button>
                </span>
              </TooltipTrigger>
              {missingHint && (
                <TooltipContent side="top" className="max-w-[260px] text-xs">
                  {missingHint}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        }
      >
        <div className="mb-3">
          <PackageLockStatus projectId={projectId} onStage={15} refreshKey={lockRefreshKey} />
        </div>
        <p className="text-xs text-muted-foreground">
          Record each stakeholder's decision below and write the approval note.
          Once the checklist is green, click <span className="font-semibold text-foreground">Lock Architecture Package</span> above
          (or <span className="font-semibold text-foreground">Record approval &amp; advance</span> at the bottom) — both do the same thing
          and unlock the Run-agent buttons on Stages 16, 17 and 18.
        </p>
      </SectionCard>

      <SectionCard
        title="Approval package"
        subtitle={hasDocs ? `Docs v${docsVersion} · ${docsAdrCount} ADR(s) — read below before recording decisions.` : "Lock the documentation package in Stage 14 first."}
        right={
          <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Save version" : "Saved"}
          </Button>
        }
      >
        {docsSummary ? (
          <div className="rounded-lg border bg-background/60 p-3 text-sm leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">{docsSummary}</div>
        ) : (
          <div className="text-xs text-muted-foreground py-4 text-center"><FileText className="h-5 w-5 mx-auto mb-1 opacity-40" />No executive summary found in Stage 14 yet.</div>
        )}
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 mt-4 block">Approval note (optional)</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            { label: "✅ Agree", text: "Agree — architecture package approved as presented, no conditions attached." },
            { label: "✅ Agree with conditions", text: "Agree with conditions — approved subject to the follow-up actions noted by the delivery team." },
            { label: "❌ Do not agree", text: "Do not agree — approval withheld pending the concerns raised during the review being addressed." },
            { label: "🕒 Needs revision", text: "Needs revision — please revise the flagged sections and resubmit for sign-off." },
          ].map((p) => (
            <Button key={p.label} type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2"
              onClick={() => setApprovalNote(p.text)}>{p.label}</Button>
          ))}
        </div>
        <Textarea rows={4} value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder="Optional — pick a preset above or write your own." />
        <div className="text-[10px] text-muted-foreground mt-1">Optional. Leave blank or use a preset.</div>
      </SectionCard>

      <SectionCard
        title={`Sign-off register (${signoffs.length})`}
        subtitle="Record each stakeholder's decision, then save the register as an artifact version."
        right={
          <Button size="sm" onClick={persist} disabled={saving || (!dirty && artifactVersion > 0)} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {artifactVersion === 0 ? "Save sign-off register" : dirty ? "Save new version" : `Saved v${artifactVersion}`}
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3">
          <Input placeholder="Name" value={draftName} onChange={(e) => setDraftName(e.target.value)} className="md:col-span-5" />
          <Input placeholder="Role (e.g. CTO, Security lead)" value={draftRole} onChange={(e) => setDraftRole(e.target.value)} className="md:col-span-5" />
          <Button onClick={addSignoff} className="md:col-span-2 gap-1"><Plus className="h-4 w-4" /> Add</Button>
        </div>
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : signoffs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8"><ShieldCheck className="h-6 w-6 mx-auto mb-2 opacity-40" />No stakeholders yet.</div>
        ) : (
          <ul className="space-y-2">
            {signoffs.map((s, i) => (
              <li key={i} className={cn("grid grid-cols-1 md:grid-cols-12 gap-2 items-start rounded-md border px-3 py-2",
                s.decision === "approved" && "border-emerald-500/30 bg-emerald-500/5",
                s.decision === "approved_with_conditions" && "border-amber-500/30 bg-amber-500/5",
                s.decision === "rejected" && "border-rose-500/30 bg-rose-500/5",
              )}>
                <Input value={s.name} onChange={(e) => updateSignoff(i, { name: e.target.value })} className="md:col-span-3 h-8 text-xs font-semibold" />
                <Input value={s.role} onChange={(e) => updateSignoff(i, { role: e.target.value })} className="md:col-span-2 h-8 text-xs" />
                <Select value={s.decision} onValueChange={(v) => updateSignoff(i, { decision: v as Decision })}>
                  <SelectTrigger className="md:col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{DECISIONS.map((d) => <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={s.comment} onChange={(e) => updateSignoff(i, { comment: e.target.value })} placeholder="Comment / conditions" className="md:col-span-3 h-8 text-xs" />
                <Button size="icon" variant="ghost" className="md:col-span-1 justify-self-end h-8 w-8" onClick={() => removeSignoff(i)}><X className="h-4 w-4" /></Button>
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

function normalizeSignoffs(raw: unknown): Signoff[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => {
      if (!s || typeof s.name !== "string" || typeof s.role !== "string") return null;
      const decision: Decision = DECISIONS.includes(s.decision) ? s.decision : "pending";
      return { name: s.name, role: s.role, decision, comment: typeof s.comment === "string" ? s.comment : "", decided_at: typeof s.decided_at === "string" ? s.decided_at : undefined };
    })
    .filter(Boolean) as Signoff[];
}

function hashOf(signoffs: Signoff[], note: string): string {
  return JSON.stringify({ signoffs, note });
}
