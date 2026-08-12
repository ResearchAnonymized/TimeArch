// Phase 7 — Architecture alternatives generator.
// Given a feature_change_id + its mappings/ripples, produces 2-4 candidate
// architecture alternatives with pros/cons, quality-attribute scores, effort,
// risk, and evidence refs. Marks one as recommended.
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

const PROMPT = `You are a brownfield software architect proposing solution alternatives for a specific feature change.

Return STRICT JSON only:
{"alternatives":[{
  "name":"short name",
  "description":"2-3 sentences",
  "pros":["..."],
  "cons":["..."],
  "quality_scores":{"performance":1..5,"security":1..5,"availability":1..5,"modifiability":1..5,"cost":1..5,"time_to_market":1..5},
  "effort":"S|M|L|XL",
  "risk":"low|medium|high",
  "recommended":true|false,
  "evidence_refs":[{"path":"","method":"llm","confidence":0.7}]
}]}

Rules:
- Produce 2-4 DISTINCT alternatives (e.g. in-place refactor vs new service vs event-driven vs bought SaaS). Cover a real trade-off spectrum.
- Ground each in the supplied context (mappings, ripples, gaps, style).
- Mark exactly ONE as recommended=true — the best balance for the stated drivers.
- No prose outside JSON.`;

async function llmGen(ctx: string): Promise<any[]> {
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
    return Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
  } catch (e) {
    console.error("llmGen failed", e);
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

    const [{ data: mappings }, { data: ripples }, { data: gaps }, { data: style }] = await Promise.all([
      supabase.from("feature_mappings").select("element_type,element_ref,relationship").eq("feature_change_id", feature_change_id),
      supabase.from("impact_findings").select("impacted_element_type,impacted_element_ref,severity,classification").eq("feature_change_id", feature_change_id).limit(30),
      supabase.from("architecture_gaps").select("title,category,severity").eq("project_id", fc.project_id).eq("status", "open").limit(15),
      supabase.from("system_style").select("primary,secondary,evidence").eq("project_id", fc.project_id).maybeSingle(),
    ]);

    const ctx = JSON.stringify({
      feature_change: {
        title: fc.title, change_type: fc.change_type,
        desired_behavior: fc.desired_behavior, constraints: fc.constraints,
      },
      mappings: mappings || [], ripples: ripples || [],
      open_gaps: gaps || [], style: style || null,
    });

    let alts = await llmGen(ctx);
    if (!alts.length) {
      // Deterministic fallback so the UI always has something to compare.
      alts = [
        {
          name: "In-place refactor",
          description: "Modify the existing components identified in the mappings without changing topology.",
          pros: ["Lowest disruption", "Reuses existing tests & deploys"],
          cons: ["May accumulate more debt", "Limited quality upside"],
          quality_scores: { performance: 3, security: 3, availability: 3, modifiability: 2, cost: 4, time_to_market: 4 },
          effort: "M", risk: "low", recommended: true,
          evidence_refs: [{ method: "heuristic", confidence: 0.4 }],
        },
        {
          name: "Extract new service",
          description: "Peel the changed responsibility into a new service with its own data store and contract.",
          pros: ["Cleaner boundary", "Independent scaling"],
          cons: ["Higher effort", "New operational surface"],
          quality_scores: { performance: 4, security: 3, availability: 4, modifiability: 4, cost: 2, time_to_market: 2 },
          effort: "L", risk: "medium", recommended: false,
          evidence_refs: [{ method: "heuristic", confidence: 0.4 }],
        },
      ];
    }

    if (replace) {
      await supabase.from("architecture_alternatives").delete().eq("feature_change_id", feature_change_id);
    }

    // Ensure exactly one recommended.
    let recSet = false;
    const rows = alts.slice(0, 5).map((a: any) => {
      const rec = !recSet && a.recommended === true;
      if (rec) recSet = true;
      return {
        project_id: fc.project_id,
        feature_change_id,
        created_by: user.id,
        name: String(a.name || "Unnamed").slice(0, 200),
        description: a.description ? String(a.description).slice(0, 2000) : null,
        pros: Array.isArray(a.pros) ? a.pros : [],
        cons: Array.isArray(a.cons) ? a.cons : [],
        quality_scores: a.quality_scores || {},
        effort: ["S", "M", "L", "XL"].includes(a.effort) ? a.effort : "M",
        risk: ["low", "medium", "high"].includes(a.risk) ? a.risk : "medium",
        recommended: rec,
        evidence_refs: a.evidence_refs || [],
      };
    });
    if (!recSet && rows.length) rows[0].recommended = true;

    const { data: ins, error: insErr } = await supabase
      .from("architecture_alternatives").insert(rows).select("id");
    if (insErr) return ok({ error: insErr.message }, 200);

    return ok({ feature_change_id, alternative_count: ins?.length ?? rows.length });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
