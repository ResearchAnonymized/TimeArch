// Shared helper: enforces that the Architecture Package has been explicitly
// sealed by a human before any implementation-facing stage (>=16) can run.
//
// The seal is represented as a `stage_approvals` row:
//   { stage: 15, action: 'locked', comment: JSON containing "package_locked": true }
//
// Returns null if the gate passes, or a Response (403) if the caller should
// short-circuit. Stages < 16 always pass.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

export const PACKAGE_GATE_STAGE_THRESHOLD = 16;

export interface PackageLockInfo {
  locked: boolean;
  locked_at?: string;
  locked_by?: string;
  approval_id?: string;
}

export async function getPackageLock(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PackageLockInfo> {
  const { data } = await supabase
    .from("stage_approvals")
    .select("id, approved_by, created_at, comment")
    .eq("project_id", projectId)
    .eq("stage", 15)
    .eq("action", "locked")
    .order("created_at", { ascending: false })
    .limit(20);

  for (const row of data ?? []) {
    let payload: any = null;
    try { payload = row.comment ? JSON.parse(row.comment) : null; } catch { /* legacy */ }
    if (payload && payload.package_locked === true) {
      return {
        locked: true,
        approval_id: row.id,
        locked_at: payload.signed_off_at ?? row.created_at,
        locked_by: payload.signed_off_by ?? row.approved_by ?? undefined,
      };
    }
  }
  return { locked: false };
}

export function packageGateBlockedResponse(corsHeaders: Record<string, string>, stage: number) {
  return new Response(
    JSON.stringify({
      error: "ARCHITECTURE_PACKAGE_NOT_LOCKED",
      message:
        `Stage ${stage} is an implementation-ready stage. The Architecture Package must be ` +
        `explicitly approved and sealed by a human in Stage 15 (Stakeholder Approval) ` +
        `before any code generation, implementation review, or evolution agent can run.`,
      next_action: { stage: 15, label: "Approve & Lock Architecture Package" },
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
