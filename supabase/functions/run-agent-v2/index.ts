// Agentic-runtime entry point. Same request contract as `run-agent` so the
// existing `useRunStage` hook can call it transparently when a stage is
// flagged as agentic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { runAgentic } from "../_shared/agent-runtime/graph.ts";
import { AGENTIC_STAGES } from "../_shared/agent-runtime/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id, stage, user_id, goal } = await req.json();
    if (!project_id || !user_id || !stage) {
      return new Response(JSON.stringify({ error: "Missing project_id, stage, or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claims, error: userErr } = await authedClient.auth.getClaims(token);
    const authedUserId = claims?.claims?.sub;
    if (userErr || !authedUserId || authedUserId !== user_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isMember } = await authedClient.rpc("is_project_member", {
      _user_id: authedUserId, _project_id: project_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a project member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!AGENTIC_STAGES.has(stage)) {
      return new Response(JSON.stringify({ error: `Stage ${stage} not yet routed to the agentic runtime.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Architecture package gate — block implementation-ready stages until a
    // human has explicitly sealed the package at Stage 15.
    if (stage >= 16) {
      const service = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { getPackageLock, packageGateBlockedResponse } =
        await import("../_shared/package-lock.ts");
      const lock = await getPackageLock(service, project_id);
      if (!lock.locked) return packageGateBlockedResponse(corsHeaders, stage);
    }

    // Kick off — keep the request open so the client gets the final verdict,
    // but `useRunStage` will also fall back to polling agent_runs_v2 if the
    // edge function times out.
    const result = await runAgentic({ projectId: project_id, userId: user_id, stage, goal });
    return new Response(JSON.stringify({
      runId: result.runId,
      status: result.status,
      artifact_id: result.artifactId,
      iterations: result.iterations,
      tokens: { in: result.tokens_in, out: result.tokens_out },
      verdict: result.verdict,
      error: result.error,
      agent: `agentic-runtime stage-${stage}`,
      artifact_title: result.verdict ? "Agentic run complete" : "Agentic run",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("run-agent-v2 error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
