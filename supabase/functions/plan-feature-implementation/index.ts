// Phase 9 — Implementation planner. Reads a feature change and its full
// lineage (accepted ADR, mappings, ripples, quality assessments) and emits
// concrete work items with validation criteria & evidence citations.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PROMPT = `You are a brownfield delivery planner. Given a feature change and its lineage (mappings, ripples, quality impacts, accepted ADR), produce concrete, ordered work items.

Return STRICT JSON only:
{"items":[{
  "title":"short imperative",
  "description":"1-3 sentences",
  "category":"design|implementation|migration|test|rollout|observability|documentation|rollback",
  "priority":"low|medium|high|critical",
  "effort":"S|M|L|XL",
  "validation_criteria":["testable criterion", "..."],
  "dependencies":["title of earlier item"],
  "evidence_refs":[{"path":"","method":"llm","confidence":0.7}]
}]}

Rules:
- 5-12 items covering: prep, implementation, tests, migrations if any, rollout, observability, rollback.
- Every item needs at least one validation_criterion.
- Reference concrete elements from mappings/ripples/ADR where possible.
- No prose outside JSON.`;

async function llmPlan(ctx: string): Promise<any[]> {
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
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    console.error("llmPlan failed", e);
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

    const [{ data: mappings }, { data: ripples }, { data: qias }, { data: adrs }] = await Promise.all([
      supabase.from("feature_mappings").select("element_type,element_ref,relationship,review_status").eq("feature_change_id", feature_change_id),
      supabase.from("impact_findings").select("impacted_element_type,impacted_element_ref,classification,severity,recommended_action").eq("feature_change_id", feature_change_id).limit(30),
      supabase.from("quality_impact_assessments").select("attribute,direction,severity,rationale,mitigations").eq("feature_change_id", feature_change_id),
      supabase.from("adr_records").select("id,number,title,status,decision,consequences").eq("feature_change_id", feature_change_id).order("created_at", { ascending: false }),
    ]);

    const acceptedAdr = (adrs || []).find((a: any) => a.status === "accepted") || (adrs || [])[0] || null;

    const ctx = JSON.stringify({
      feature_change: {
        title: fc.title, change_type: fc.change_type,
        desired_behavior: fc.desired_behavior, constraints: fc.constraints,
      },
      accepted_adr: acceptedAdr,
      mappings: mappings || [], ripples: ripples || [], quality: qias || [],
    });

    let items = await llmPlan(ctx);
    if (!items.length) {
      items = [
        { title: "Design spike", description: "Confirm approach and interfaces.", category: "design", priority: "high", effort: "S", validation_criteria: ["Design doc approved"], dependencies: [], evidence_refs: [{ method: "heuristic", confidence: 0.3 }] },
        { title: "Implement change", description: "Apply changes to identified components.", category: "implementation", priority: "high", effort: "M", validation_criteria: ["All mappings updated"], dependencies: ["Design spike"], evidence_refs: [{ method: "heuristic", confidence: 0.3 }] },
        { title: "Regression tests", description: "Cover impacted components and contracts.", category: "test", priority: "high", effort: "M", validation_criteria: ["CI green"], dependencies: ["Implement change"], evidence_refs: [{ method: "heuristic", confidence: 0.3 }] },
        { title: "Staged rollout", description: "Gradual release with monitoring.", category: "rollout", priority: "medium", effort: "S", validation_criteria: ["Error budget preserved"], dependencies: ["Regression tests"], evidence_refs: [{ method: "heuristic", confidence: 0.3 }] },
      ];
    }

    if (replace) {
      await supabase.from("feature_work_items").delete().eq("feature_change_id", feature_change_id);
    }

    const rows = items.slice(0, 15).map((it: any, idx: number) => ({
      project_id: fc.project_id,
      feature_change_id,
      adr_id: acceptedAdr?.id || null,
      created_by: user.id,
      title: String(it.title || "Untitled").slice(0, 300),
      description: it.description ? String(it.description).slice(0, 2000) : null,
      category: ["design","implementation","migration","test","rollout","observability","documentation","rollback"].includes(it.category) ? it.category : "implementation",
      priority: ["low","medium","high","critical"].includes(it.priority) ? it.priority : "medium",
      effort: ["S","M","L","XL"].includes(it.effort) ? it.effort : "M",
      status: "proposed",
      validation_criteria: Array.isArray(it.validation_criteria) ? it.validation_criteria : [],
      dependencies: Array.isArray(it.dependencies) ? it.dependencies : [],
      evidence_refs: it.evidence_refs || [],
      ordering: idx,
    }));

    const { data: ins, error: insErr } = await supabase
      .from("feature_work_items").insert(rows).select("id");
    if (insErr) return ok({ error: insErr.message }, 200);

    return ok({ feature_change_id, work_item_count: ins?.length ?? rows.length, adr_id: acceptedAdr?.id || null });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
