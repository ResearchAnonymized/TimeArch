// Phase 6 — Quality attribute impact assessment for a feature change.
// Uses mappings + ripples + open gaps + drift to produce per-attribute
// direction/severity/rationale rows in quality_impact_assessments.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ATTRIBUTES = [
  "performance", "security", "availability", "reliability",
  "modifiability", "testability", "usability", "cost",
] as const;

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PROMPT = `You are a quality-attribute analyst (ISO/IEC 25010 + ATAM).
For a proposed feature change, return per-attribute impact.
Return STRICT JSON: {"assessments":[{"attribute":"performance|security|availability|reliability|modifiability|testability|usability|cost","direction":"improves|degrades|neutral","severity":"low|medium|high|critical","rationale":"1-2 sentences","mitigations":["..."],"evidence_refs":[{"method":"llm","confidence":0.7}]}]}
Include all 8 attributes above, no prose.`;

async function llmAssess(ctx: string): Promise<any[]> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: ctx.slice(0, 14000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    return Array.isArray(parsed.assessments) ? parsed.assessments : [];
  } catch (e) {
    console.error("llmAssess failed", e);
    return [];
  }
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

    const { feature_change_id, replace } = await req.json();
    if (!feature_change_id) return ok({ error: "feature_change_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: fc } = await supabase
      .from("feature_changes").select("*").eq("id", feature_change_id).single();
    if (!fc) return ok({ error: "Feature change not found" }, 404);

    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id, _project_id: fc.project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const [{ data: mappings }, { data: ripples }, { data: gaps }] = await Promise.all([
      supabase.from("feature_mappings").select("element_type,element_ref,relationship").eq("feature_change_id", feature_change_id),
      supabase.from("impact_findings").select("impacted_element_type,severity,classification").eq("feature_change_id", feature_change_id).limit(30),
      supabase.from("architecture_gaps").select("title,category,severity").eq("project_id", fc.project_id).eq("status", "open").limit(15),
    ]);

    const ctx = JSON.stringify({
      feature_change: { title: fc.title, change_type: fc.change_type, desired_behavior: fc.desired_behavior },
      mappings: mappings || [], ripples: ripples || [], open_gaps: gaps || [],
    });

    let assessments = await llmAssess(ctx);
    if (!assessments.length) {
      assessments = ATTRIBUTES.map((a) => ({
        attribute: a, direction: "neutral", severity: "medium",
        rationale: "Heuristic placeholder — LLM unavailable.",
        mitigations: [], evidence_refs: [{ method: "heuristic", confidence: 0.3 }],
      }));
    }

    if (replace) {
      await supabase.from("quality_impact_assessments").delete().eq("feature_change_id", feature_change_id);
    }

    const rows = assessments.slice(0, 20).map((a: any) => ({
      project_id: fc.project_id,
      feature_change_id,
      created_by: user.id,
      attribute: String(a.attribute || "unknown").slice(0, 60),
      direction: ["improves", "degrades", "neutral"].includes(a.direction) ? a.direction : "neutral",
      severity: ["low", "medium", "high", "critical"].includes(a.severity) ? a.severity : "medium",
      rationale: a.rationale ? String(a.rationale).slice(0, 2000) : null,
      mitigations: Array.isArray(a.mitigations) ? a.mitigations : [],
      evidence_refs: a.evidence_refs || [],
    }));

    const { data: ins, error: insErr } = await supabase
      .from("quality_impact_assessments").insert(rows).select("id");
    if (insErr) return ok({ error: insErr.message }, 200);

    return ok({ feature_change_id, assessment_count: ins?.length ?? rows.length });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
