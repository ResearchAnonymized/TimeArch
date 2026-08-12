import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ChipTone = "ok" | "warn" | "muted" | "info";
export interface SummaryChip {
  label: string;
  value: string | number;
  tone?: ChipTone;
}
export type StageStatus = "empty" | "draft" | "ready" | "locked";

export interface StageSummary {
  chips: SummaryChip[];
  hint?: string;
  status: StageStatus;
  loading: boolean;
}

const EMPTY: StageSummary = { chips: [], status: "empty", loading: true };

/**
 * Fetches a compact per-stage summary (chips + one-liner hint) for the
 * StageHeader strip. Falls back to a generic "artifacts / last run" summary
 * for stages we haven't customised yet.
 */
export function useStageSummary(
  projectId: string,
  stage: number,
  refreshKey?: number,
  isLocked?: boolean,
): StageSummary {
  const [state, setState] = useState<StageSummary>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      const summary = await computeSummary(projectId, stage);
      if (cancelled) return;
      setState({
        ...summary,
        status: isLocked ? "locked" : summary.status,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, stage, refreshKey, isLocked]);

  return state;
}

async function computeSummary(
  projectId: string,
  stage: number,
): Promise<Omit<StageSummary, "loading">> {
  switch (stage) {
    case 1:
      return stage1(projectId);
    case 2:
    case 3:
      return stage2or3(projectId);
    case 4:
      return stage4(projectId);
    default:
      return generic(projectId, stage);
  }
}

// ─── Stage 1: Project setup ──────────────────────────────────────
async function stage1(projectId: string): Promise<Omit<StageSummary, "loading">> {
  const [proj, reqs, arts] = await Promise.all([
    supabase.from("projects").select("name, description, domain, target_users").eq("id", projectId).maybeSingle(),
    supabase.from("requirements").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("architecture_artifacts").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("stage", 1),
  ]);

  const p = (proj.data ?? {}) as Record<string, unknown>;
  const reqCount = reqs.count ?? 0;
  const artCount = arts.count ?? 0;

  const checks = [
    { label: "Project has a name", ok: !!p.name },
    { label: "One-line goal captured", ok: !!(p.description && String(p.description).trim()) },
    { label: "At least one target user", ok: Array.isArray(p.target_users) && p.target_users.length > 0 },
    { label: "Domain identified", ok: !!p.domain },
    { label: "At least one requirement", ok: reqCount > 0 },
  ];
  const done = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);

  return {
    chips: [
      { label: "Checklist", value: `${done}/5`, tone: done === 5 ? "ok" : done >= 3 ? "warn" : "muted" },
      { label: "Requirements", value: reqCount, tone: reqCount > 0 ? "ok" : "muted" },
      { label: "Artifacts", value: artCount, tone: artCount > 0 ? "info" : "muted" },
    ],
    hint: missing.length
      ? missing.length === 1
        ? `1 more to unlock Stage 2 · ${missing[0]}`
        : `${missing.length} more to unlock Stage 2 · ${missing[0]}`
      : undefined,
    status: done === 5 ? "ready" : done > 0 ? "draft" : "empty",
  };
}

// ─── Stage 2/3: Requirements intake & critique ───────────────────
async function stage2or3(projectId: string): Promise<Omit<StageSummary, "loading">> {
  const [reqs, reviews] = await Promise.all([
    supabase.from("requirements").select("id, status").eq("project_id", projectId),
    supabase.from("requirement_reviews").select("id, verdict").eq("project_id", projectId),
  ]);

  const reqRows = reqs.data ?? [];
  const revRows = reviews.data ?? [];
  const total = reqRows.length;
  const ready = reqRows.filter((r) => String(r.status ?? "").toLowerCase() === "approved").length;
  const flagged = revRows.filter((r) => {
    const v = String(r.verdict ?? "").toLowerCase();
    return v && v !== "pass" && v !== "approved";
  }).length;

  return {
    chips: [
      { label: "Requirements", value: total, tone: total > 0 ? "info" : "muted" },
      { label: "Reviewed", value: revRows.length, tone: revRows.length ? "ok" : "muted" },
      { label: "Needs attention", value: flagged, tone: flagged ? "warn" : "ok" },
    ],
    hint: total === 0
      ? "No requirements yet — add or import some to begin"
      : flagged
        ? `${flagged} flagged by the critic — open stage tool to review`
        : undefined,
    status: total === 0 ? "empty" : ready === total ? "ready" : "draft",
  };
}

// ─── Stage 4: Architecture drivers ───────────────────────────────
async function stage4(projectId: string): Promise<Omit<StageSummary, "loading">> {
  const [drivers, arts, reqs] = await Promise.all([
    supabase.from("architecture_drivers").select("id, category").eq("project_id", projectId),
    supabase.from("architecture_artifacts").select("id, created_at").eq("project_id", projectId).eq("stage", 4).order("created_at", { ascending: false }).limit(1),
    supabase.from("requirements").select("id, status").eq("project_id", projectId),
  ]);

  const rows = drivers.data ?? [];
  const reqRows = reqs.data ?? [];
  const lockedReqs = reqRows.filter((r) => ["locked", "approved"].includes(String(r.status ?? "").toLowerCase())).length;
  const constraints = rows.filter((r) => String(r.category ?? "").toLowerCase() === "constraint").length;
  const qas = rows.length - constraints;
  const lastRun = arts.data?.[0]?.created_at ? relativeTime(arts.data[0].created_at as string) : "never";
  const blockedByDraftRequirements = rows.length === 0 && reqRows.length > 0 && lockedReqs === 0;

  return {
    chips: [
      { label: "Drivers", value: qas, tone: qas ? "ok" : "muted" },
      { label: "Constraints", value: constraints, tone: constraints ? "info" : "muted" },
      { label: "Last run", value: lastRun, tone: arts.data?.[0] ? "info" : "muted" },
    ],
    hint: blockedByDraftRequirements
      ? "Requirements are still draft — lock or approve them in Stage 3, then run this stage again"
      : rows.length === 0
        ? "Not run yet — click Run this stage to draft drivers"
        : undefined,
    status: rows.length === 0 ? "empty" : "draft",
  };
}

// ─── Generic fallback for stages 5–18 ────────────────────────────
async function generic(projectId: string, stage: number): Promise<Omit<StageSummary, "loading">> {
  const [arts, approvals] = await Promise.all([
    supabase.from("architecture_artifacts").select("id, created_at").eq("project_id", projectId).eq("stage", stage).order("created_at", { ascending: false }),
    supabase.from("stage_approvals").select("action, created_at").eq("project_id", projectId).eq("stage", stage).order("created_at", { ascending: false }).limit(5),
  ]);

  const artRows = arts.data ?? [];
  const lastRun = artRows[0]?.created_at ? relativeTime(artRows[0].created_at as string) : "never";
  const approved = (approvals.data ?? []).some((a) => a.action === "locked");

  return {
    chips: [
      { label: "Artifacts", value: artRows.length, tone: artRows.length ? "ok" : "muted" },
      { label: "Last run", value: lastRun, tone: artRows[0] ? "info" : "muted" },
      { label: "Approvals", value: approvals.data?.length ?? 0, tone: approved ? "ok" : "muted" },
    ],
    hint: artRows.length === 0 ? "Not run yet — open stage tool or click Run this stage" : undefined,
    status: artRows.length === 0 ? "empty" : approved ? "ready" : "draft",
  };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
