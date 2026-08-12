// Entry point for the brownfield multi-agent runtime.
// Same auth/CORS shape as run-agent-v2.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { runBrownfieldAgent } from "../_shared/agent-runtime/brownfield-graph.ts";
import { BROWNFIELD_CONFIGS } from "../_shared/agent-runtime/brownfield-config.ts";
import type { BrownfieldStageKey } from "../_shared/agent-runtime/brownfield-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VALID_STAGE_KEYS: BrownfieldStageKey[] = [
  "mapping", "ripple", "quality", "alternatives", "adr", "plan",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { feature_change_id, stage_key, user_id, goal } = await req.json();
    if (!feature_change_id || !stage_key || !user_id) {
      return jsonResponse({ error: "feature_change_id, stage_key, user_id are required" }, 400);
    }
    if (!VALID_STAGE_KEYS.includes(stage_key)) {
      return jsonResponse({ error: `stage_key must be one of ${VALID_STAGE_KEYS.join(", ")}` }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claims, error: userErr } = await authedClient.auth.getClaims(token);
    const authedUserId = claims?.claims?.sub;
    if (userErr || !authedUserId || authedUserId !== user_id) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Look up the project via feature_change so we can enforce membership.
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: fc, error: fcErr } = await service
      .from("feature_changes")
      .select("id, project_id")
      .eq("id", feature_change_id)
      .maybeSingle();
    if (fcErr || !fc) return jsonResponse({ error: "feature_change not found" }, 404);

    const { data: isMember } = await authedClient.rpc("is_project_member", {
      _user_id: authedUserId, _project_id: fc.project_id,
    });
    if (!isMember) return jsonResponse({ error: "Forbidden: not a project member" }, 403);

    const cfg = BROWNFIELD_CONFIGS[stage_key as BrownfieldStageKey];
    const result = await runBrownfieldAgent({
      projectId: fc.project_id,
      userId: user_id,
      featureChangeId: feature_change_id,
      stageKey: stage_key as BrownfieldStageKey,
      goal,
    });

    return jsonResponse({
      runId: result.runId,
      stage_key: result.stageKey,
      stage_code: cfg.stageCode,
      agent_name: cfg.agentName,
      status: result.status,
      destination_table: result.destinationTable,
      inserted_count: result.insertedCount ?? 0,
      primary_id: result.primaryId,
      iterations: result.iterations,
      tokens: { in: result.tokens_in, out: result.tokens_out },
      verdict: result.verdict,
      error: result.error,
    });
  } catch (e) {
    console.error("run-brownfield-agent error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" }, 500,
    );
  }
});
