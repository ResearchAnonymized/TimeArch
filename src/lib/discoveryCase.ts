/**
 * Brownfield "discovery case" progress — separate from greenfield stages 1–18.
 * Synced to an architecture artifact so the dashboard can show real status.
 */
import { supabase } from "@/integrations/supabase/client";

export type DiscoveryCasePhase =
  | "import"
  | "recover"
  | "change"
  | "released"
  | "closed";

export interface DiscoveryCaseProgress {
  phase: DiscoveryCasePhase;
  /** 0–4 completed milestones (import → closed) */
  completed: number;
  total: number;
  label: string;
  detail: string;
  pct: number;
  hasImports: boolean;
  hasRecovered: boolean;
  hasPackage: boolean;
  packageStatus: "none" | "draft" | "in_review" | "approved";
  closedAt?: string | null;
}

const PHASE_ORDER: DiscoveryCasePhase[] = [
  "import",
  "recover",
  "change",
  "released",
  "closed",
];

const PHASE_LABEL: Record<DiscoveryCasePhase, { label: string; detail: string }> = {
  import: { label: "Importing sources", detail: "Upload code and documents" },
  recover: { label: "Recovering architecture", detail: "Reverse-engineer as-is" },
  change: { label: "Working the change", detail: "Propose, decide, build guide" },
  released: { label: "Package released", detail: "Ready for coding systems" },
  closed: { label: "Case closed", detail: "Discovery case complete" },
};

export function computeDiscoveryCaseProgress(input: {
  hasImports: boolean;
  hasRecovered: boolean;
  hasPackage: boolean;
  packageStatus?: "none" | "draft" | "in_review" | "approved";
  projectStatus?: string;
  closedAt?: string | null;
}): DiscoveryCaseProgress {
  const packageStatus = input.packageStatus || (input.hasPackage ? "draft" : "none");
  const closed =
    input.projectStatus === "locked" || input.projectStatus === "archived" || !!input.closedAt;

  let phase: DiscoveryCasePhase = "import";
  if (closed) phase = "closed";
  else if (packageStatus === "approved") phase = "released";
  else if (input.hasPackage || input.hasRecovered) phase = "change";
  else if (input.hasImports) phase = "recover";
  else phase = "import";

  // Milestones completed toward close
  let completed = 0;
  if (input.hasImports) completed = 1;
  if (input.hasRecovered) completed = 2;
  if (input.hasPackage) completed = 3;
  if (packageStatus === "approved") completed = 4;
  if (closed) completed = 5;

  const total = 5;
  const meta = PHASE_LABEL[phase];
  return {
    phase,
    completed,
    total,
    label: meta.label,
    detail: meta.detail,
    pct: Math.round((completed / total) * 100),
    hasImports: input.hasImports,
    hasRecovered: input.hasRecovered,
    hasPackage: input.hasPackage,
    packageStatus,
    closedAt: input.closedAt || null,
  };
}

export async function loadDiscoverySignals(projectId: string): Promise<{
  hasImports: boolean;
  hasRecovered: boolean;
  packageStatus: "none" | "draft" | "in_review" | "approved";
  closedAt: string | null;
}> {
  const [importsRes, artsRes, projRes] = await Promise.all([
    supabase
      .from("project_imports")
      .select("id, status")
      .eq("project_id", projectId)
      .limit(20),
    supabase
      .from("architecture_artifacts")
      .select("type, title, content, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("projects").select("status").eq("id", projectId).maybeSingle(),
  ]);

  const imports = importsRes.data || [];
  const hasImports = imports.length > 0;
  const hasRecovered = imports.some((i) => i.status === "parsed" || i.status === "ready");

  let packageStatus: "none" | "draft" | "in_review" | "approved" = "none";
  let closedAt: string | null = null;

  for (const row of artsRes.data || []) {
    const content = (row.content || {}) as Record<string, unknown>;
    const meta = content._meta as Record<string, unknown> | undefined;
    if (meta?.kind === "discovery_case" && meta.closed_at) {
      closedAt = String(meta.closed_at);
    }
    if (meta?.kind === "dev_handoff") {
      const st = String(meta.status || content.status || "draft");
      if (st === "approved") packageStatus = "approved";
      else if (st === "in_review" && packageStatus !== "approved") packageStatus = "in_review";
      else if (packageStatus === "none") packageStatus = "draft";
    }
  }

  if (projRes.data?.status === "locked" || projRes.data?.status === "archived") {
    closedAt = closedAt || new Date().toISOString();
  }

  return {
    hasImports,
    hasRecovered: hasRecovered || hasImports,
    packageStatus,
    closedAt,
  };
}

export async function loadDiscoveryProgress(projectId: string): Promise<DiscoveryCaseProgress> {
  const signals = await loadDiscoverySignals(projectId);
  const { data: proj } = await supabase
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .maybeSingle();
  return computeDiscoveryCaseProgress({
    ...signals,
    hasPackage: signals.packageStatus !== "none",
    projectStatus: proj?.status,
  });
}

/** Batch progress for studio dashboard cards. */
export async function loadDiscoveryProgressMap(
  projectIds: string[],
): Promise<Record<string, DiscoveryCaseProgress>> {
  const out: Record<string, DiscoveryCaseProgress> = {};
  if (!projectIds.length) return out;

  const [importsRes, artsRes, projRes] = await Promise.all([
    supabase
      .from("project_imports")
      .select("project_id, status")
      .in("project_id", projectIds),
    supabase
      .from("architecture_artifacts")
      .select("project_id, content, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("projects").select("id, status").in("id", projectIds),
  ]);

  const byProjectImports = new Map<string, { any: boolean; recovered: boolean }>();
  for (const id of projectIds) byProjectImports.set(id, { any: false, recovered: false });
  for (const row of importsRes.data || []) {
    const cur = byProjectImports.get(row.project_id) || { any: false, recovered: false };
    cur.any = true;
    if (row.status === "parsed" || row.status === "ready") cur.recovered = true;
    byProjectImports.set(row.project_id, cur);
  }

  const pkgStatus = new Map<string, "none" | "draft" | "in_review" | "approved">();
  const closedAt = new Map<string, string>();
  for (const id of projectIds) pkgStatus.set(id, "none");

  for (const row of artsRes.data || []) {
    const content = (row.content || {}) as Record<string, unknown>;
    const meta = content._meta as Record<string, unknown> | undefined;
    if (meta?.kind === "discovery_case" && meta.closed_at && !closedAt.has(row.project_id)) {
      closedAt.set(row.project_id, String(meta.closed_at));
    }
    if (meta?.kind === "dev_handoff") {
      const st = String(meta.status || "draft");
      const cur = pkgStatus.get(row.project_id) || "none";
      if (st === "approved") pkgStatus.set(row.project_id, "approved");
      else if (st === "in_review" && cur !== "approved") pkgStatus.set(row.project_id, "in_review");
      else if (cur === "none") pkgStatus.set(row.project_id, "draft");
    }
  }

  const statusById = new Map((projRes.data || []).map((p) => [p.id, p.status]));

  for (const id of projectIds) {
    const imp = byProjectImports.get(id) || { any: false, recovered: false };
    const ps = pkgStatus.get(id) || "none";
    out[id] = computeDiscoveryCaseProgress({
      hasImports: imp.any,
      hasRecovered: imp.recovered || imp.any,
      hasPackage: ps !== "none",
      packageStatus: ps,
      projectStatus: statusById.get(id),
      closedAt: closedAt.get(id) || null,
    });
  }
  return out;
}

export async function persistDiscoveryCaseMarker(
  projectId: string,
  userId: string,
  patch: { closed?: boolean; note?: string },
) {
  const closedAt = patch.closed ? new Date().toISOString() : null;
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 0,
    type: "executive_summary",
    title: patch.closed ? "Discovery case closed" : "Discovery case update",
    content: {
      _meta: {
        kind: "discovery_case",
        closed_at: closedAt,
        note: patch.note || null,
        updated_at: new Date().toISOString(),
      },
    },
    status: patch.closed ? "approved" : "draft",
    generated_by: "Discovery Case",
    created_by: userId,
    locked_at: patch.closed ? closedAt : null,
    locked_by: patch.closed ? userId : null,
  });
}

/** Final action: close the brownfield discovery case. */
export async function closeDiscoveryCase(
  projectId: string,
  userId: string,
  note?: string,
): Promise<DiscoveryCaseProgress> {
  await persistDiscoveryCaseMarker(projectId, userId, { closed: true, note });
  await supabase
    .from("projects")
    .update({
      status: "locked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  return loadDiscoveryProgress(projectId);
}

export function phaseIndex(phase: DiscoveryCasePhase): number {
  return PHASE_ORDER.indexOf(phase);
}
