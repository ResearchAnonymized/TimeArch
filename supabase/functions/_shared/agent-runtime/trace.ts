// Trace + run lifecycle persistence. Every node call funnels through here so
// the workspace UI (subscribed to `agent_trace_steps` via Supabase Realtime)
// renders a live LangSmith-style timeline.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import type { AgentState, TraceKind } from "./state.ts";

export type AdminClient = SupabaseClient;

export function adminClient(): AdminClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function startRun(
  sb: AdminClient,
  args: { projectId: string; userId: string; stage: number; goal: string },
): Promise<string> {
  const { data, error } = await sb
    .from("agent_runs_v2")
    .insert({
      project_id: args.projectId,
      user_id: args.userId,
      stage: args.stage,
      goal: args.goal,
      status: "running",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`startRun: ${error?.message}`);
  return data.id as string;
}

export async function finishRun(
  sb: AdminClient,
  runId: string,
  patch: { status: "completed" | "failed"; error?: string; final_artifact_id?: string; iterations?: number; tokens_in?: number; tokens_out?: number },
): Promise<void> {
  await sb.from("agent_runs_v2").update({
    ...patch,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

export async function emitTrace(
  sb: AdminClient,
  state: AgentState,
  node: string,
  kind: TraceKind,
  payload: Record<string, unknown>,
  meta?: { tokens_in?: number; tokens_out?: number; duration_ms?: number },
): Promise<void> {
  state.stepIndex += 1;
  const row = {
    run_id: state.runId,
    step_index: state.stepIndex,
    node,
    kind,
    payload,
    tokens_in: meta?.tokens_in ?? null,
    tokens_out: meta?.tokens_out ?? null,
    duration_ms: meta?.duration_ms ?? null,
  };
  // Fire-and-forget — never block the agent on trace writes.
  sb.from("agent_trace_steps").insert(row).then(({ error }) => {
    if (error) console.warn(`[trace] insert failed: ${error.message}`);
  });
}
