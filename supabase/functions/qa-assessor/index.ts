// QA Assessor Agent (Brownfield) — produces an ISO/IEC 25010:2023 As-Is quality
// scorecard by combining heuristic signals from architecture_gaps + a compact
// LLM rationale pass. Returns { characteristics: [{ key,label,score,rationale }],
// overall, notes }. Does NOT persist to a dedicated table — the frontend renders
// the response, and the payload is echoed into agent_runs.output for audit.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CHARACTERISTICS = [
  "functional_suitability", "performance_efficiency", "compatibility",
  "interaction_capability", "reliability", "security",
  "maintainability", "flexibility", "safety",
] as const;

const SEV_PENALTY: Record<string, number> = { critical: 2.0, high: 1.2, medium: 0.6, low: 0.25 };

function heuristicScores(gaps: any[]) {
  return CHARACTERISTICS.map((key) => {
    const norm = key.replace(/_/g, " ");
    const alt = key.split("_")[0];
    const related = gaps.filter((g) => {
      const cat = (g.category ?? "").toLowerCase();
      return cat.includes(norm) || cat.includes(alt);
    });
    const penalty = related.reduce((s, g) => s + (SEV_PENALTY[g.severity] ?? 0.4), 0);
    return { key, score: Math.max(1, Math.min(5, 5 - penalty)), gap_count: related.length };
  });
}

async function llmRationale(context: string): Promise<Record<string, string>> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a software-quality assessor grounded in ISO/IEC 25010:2023. For each characteristic listed in the user payload, output STRICT JSON {\"rationales\":{\"<key>\":\"one-sentence rationale (<=140 chars) grounded in the evidence\"}}. No prose." },
          { role: "user", content: context.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return {};
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    return parsed.rationales ?? {};
  } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return ok({ error: "Missing authorization" }, 401);
    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser(token);
    const user = ud?.user;
    if (!user) return ok({ error: "Unauthorized" }, 401);
    const { project_id } = await req.json();
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const [{ data: gaps }, { data: artifacts }] = await Promise.all([
      supabase.from("architecture_gaps").select("id,category,severity,title,framework").eq("project_id", project_id),
      supabase.from("architecture_artifacts").select("stage,title,content").eq("project_id", project_id),
    ]);

    const { data: run } = await supabase.from("agent_runs").insert({
      project_id, agent_name: "QA Assessor Agent", stage: 11,
      status: "running", triggered_by: user.id,
      input: { characteristics: CHARACTERISTICS }, started_at: new Date().toISOString(),
    }).select().single();

    const heur = heuristicScores(gaps || []);
    const summary = JSON.stringify({
      characteristics: CHARACTERISTICS,
      gaps: (gaps || []).map((g: any) => ({ category: g.category, severity: g.severity, title: g.title })),
      artifacts: (artifacts || []).map((a: any) => ({ stage: a.stage, title: a.title, signals: a.content?.signals })),
    });
    const rationales = await llmRationale(summary);
    const characteristics = heur.map((h) => ({
      key: h.key,
      score: h.score,
      gap_count: h.gap_count,
      rationale: rationales[h.key] ?? (h.gap_count ? `${h.gap_count} gap(s) reduce this score.` : "No gaps recorded."),
    }));
    const overall = +(characteristics.reduce((s, c) => s + c.score, 0) / characteristics.length).toFixed(2);

    // Persist per-characteristic scores
    const now = new Date().toISOString();
    const rows = characteristics.map((c) => ({
      project_id, characteristic: c.key, score: c.score,
      gap_count: c.gap_count, rationale: c.rationale,
      computed_at: now, computed_by: user.id,
    }));
    await supabase.from("quality_scores").upsert(rows, { onConflict: "project_id,characteristic" });

    if (run?.id) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output: { characteristics, overall },
        completed_at: now,
      }).eq("id", run.id);
    }
    return ok({ project_id, characteristics, overall });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
