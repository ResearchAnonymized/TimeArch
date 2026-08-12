// Modernization Planner Agent (Brownfield) — turns confirmed reverse-engineered
// components into a 7R roadmap (Retain / Rehost / Replatform / Refactor /
// Repurchase / Retire / Relocate) with effort (1-5), impact (1-5) and ROI.
// Heuristic baseline + optional LLM enrichment. Returns { items: [...] }.
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

const SEVEN_R = ["Retain", "Rehost", "Replatform", "Refactor", "Repurchase", "Retire", "Relocate"] as const;

function suggest(component: any, hasIaC: boolean): { action: string; effort: number; impact: number; rationale: string } {
  const name = String(component.name || "").toLowerCase();
  if (/legacy|deprecated|old|obsolete/.test(name)) return { action: "Retire", effort: 2, impact: 4, rationale: "Name suggests deprecated component." };
  if (/admin|report|batch/.test(name)) return { action: "Repurchase", effort: 3, impact: 3, rationale: "Non-differentiating capability — consider SaaS." };
  if (/auth|payment|billing/.test(name)) return { action: "Refactor", effort: 4, impact: 5, rationale: "Domain-critical: modernise in place with strong tests." };
  if (!hasIaC) return { action: "Rehost", effort: 2, impact: 2, rationale: "Lift-and-shift first to get to modern infra." };
  return { action: "Replatform", effort: 3, impact: 3, rationale: "Small platform upgrades unlock elasticity." };
}

async function llmEnrich(context: string): Promise<any[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a cloud modernization planner using AWS/Gartner 7R (Retain/Rehost/Replatform/Refactor/Repurchase/Retire/Relocate). For each component in the payload, return STRICT JSON {\"items\":[{\"name\":\"\",\"action\":\"\",\"effort\":1-5,\"impact\":1-5,\"rationale\":\"<=140 chars\"}]}. No prose." },
          { role: "user", content: context.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const j = await res.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) { console.log("llmEnrich failed", (e as any)?.message); return []; }
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

    const { data: artifacts } = await supabase
      .from("architecture_artifacts")
      .select("stage,title,content").eq("project_id", project_id);
    // Aggregate ALL reverse-engineered stage-6 decomposition artifacts (there may be
    // one per detected service). De-dup components by name.
    const repoRows = (artifacts || []).filter((a: any) => a.stage === 6 && a.content?._meta?.provenance === "reverse-engineered");
    const infra = (artifacts || []).find((a: any) => a.stage === 10);
    const seen = new Set<string>();
    const components: any[] = [];
    for (const r of repoRows) {
      for (const c of (r.content?.components ?? [])) {
        const k = String(c?.name || "").toLowerCase().trim();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        components.push(c);
      }
    }
    const hasIaC = !!(infra?.content?.signals?.dockerfile || infra?.content?.signals?.kubernetes || infra?.content?.signals?.terraform);

    if (components.length === 0) {
      return ok({
        project_id, items: [],
        error: "No reverse-engineered components found. Run Reconstruction (Stage 6) first, then re-run the planner.",
      });
    }


    const { data: run } = await supabase.from("agent_runs").insert({
      project_id, agent_name: "Modernization Planner Agent", stage: 16,
      status: "running", triggered_by: user.id,
      input: { component_count: components.length }, started_at: new Date().toISOString(),
    }).select().single();

    const heur = components.map((c: any) => ({ name: c.name || "component", ...suggest(c, hasIaC) }));
    const enriched = await llmEnrich(JSON.stringify({ components, hasIaC }));
    const byName = new Map<string, any>();
    for (const h of heur) byName.set(h.name.toLowerCase(), h);
    for (const e of enriched) {
      const k = String(e.name || "").toLowerCase();
      if (!k) continue;
      const prev = byName.get(k) || { name: e.name };
      byName.set(k, {
        name: prev.name || e.name,
        action: SEVEN_R.includes(e.action) ? e.action : prev.action || "Replatform",
        effort: Number.isFinite(e.effort) ? Math.min(5, Math.max(1, e.effort)) : prev.effort ?? 3,
        impact: Number.isFinite(e.impact) ? Math.min(5, Math.max(1, e.impact)) : prev.impact ?? 3,
        rationale: e.rationale || prev.rationale || "",
      });
    }
    const items = Array.from(byName.values()).map((i: any) => ({
      ...i,
      roi: +(i.impact / Math.max(1, i.effort)).toFixed(2),
    }));

    // Persist — replace prior roadmap for this project
    const now = new Date().toISOString();
    await supabase.from("modernization_items").delete().eq("project_id", project_id);
    if (items.length > 0) {
      await supabase.from("modernization_items").insert(
        items.map((i: any) => ({
          project_id, name: i.name, action: i.action,
          effort: i.effort, impact: i.impact, roi: i.roi,
          rationale: i.rationale, computed_at: now, computed_by: user.id,
        })),
      );
    }

    if (run?.id) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output: { items, hasIaC },
        completed_at: now,
      }).eq("id", run.id);
    }
    return ok({ project_id, items });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
