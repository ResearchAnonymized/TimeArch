// Suggest Deployment Blueprint — reads the project's implementation plan +
// infra artifact + prior architecture, and asks Lovable AI to propose a
// starter deployment blueprint (environments, cutover steps, rollback plan,
// runbook URL) matching Stage 17's UI shape.
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

const SYSTEM = `You are TimeArch's Deployment Blueprint Planner.
Given a project's implementation plan and infrastructure artifacts, propose a
pragmatic deployment blueprint as STRICT JSON:

{
  "environments": [
    { "name": "eu-west-dev",    "tier": "dev",     "region": "eu-west-1", "notes": "" },
    { "name": "eu-west-stage",  "tier": "staging", "region": "eu-west-1", "notes": "" },
    { "name": "eu-west-prod",   "tier": "prod",    "region": "eu-west-1", "notes": "" }
  ],
  "cutover_steps": [
    { "order": 1, "step": "Freeze writes on legacy DB", "owner": "Platform", "window": "T-1h" }
  ],
  "rollback_plan": "How to revert cleanly — data compatibility, DNS, feature flags, decision authority. 2-4 sentences.",
  "runbook_url": "https://…/runbook"
}

Guidelines:
- Provide 2–4 environments; ALWAYS include exactly one with tier "prod".
- Allowed tiers: "dev" | "staging" | "prod" | "dr".
- Provide 5–8 ordered cutover steps; each needs an owner (role name) and a window like "T-1h" / "T+0h".
- Rollback plan MUST be at least 80 characters and describe how to revert cleanly.
- runbook_url must be a placeholder HTTPS URL if no real one is known.
- No prose outside JSON.`;

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

    const body = await req.json().catch(() => ({}));
    const project_id = body.project_id as string | undefined;
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const [{ data: project }, { data: artifacts }] = await Promise.all([
      supabase.from("projects").select("name, description, domain, project_type").eq("id", project_id).maybeSingle(),
      supabase.from("architecture_artifacts").select("stage, title, content").eq("project_id", project_id).in("stage", [6, 8, 10, 16]),
    ]);

    const context = {
      project: project ?? null,
      artifacts: (artifacts ?? []).map((a: any) => ({
        stage: a.stage,
        title: a.title,
        summary: typeof a.content?.summary === "string" ? a.content.summary.slice(0, 400) : undefined,
        components: Array.isArray(a.content?.components)
          ? a.content.components.slice(0, 20).map((c: any) => c?.name).filter(Boolean)
          : undefined,
        work_items: Array.isArray(a.content?.work_items)
          ? a.content.work_items.slice(0, 20).map((w: any) => ({ title: w?.title, sprint: w?.sprint }))
          : undefined,
        infra_signals: a.content?.signals ?? undefined,
      })),
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(context).slice(0, 14000) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) return ok({ error: "Rate limited — please try again in a moment." }, 200);
    if (res.status === 402) return ok({ error: "AI credits exhausted for this workspace." }, 200);
    if (!res.ok) return ok({ error: `AI gateway error (${res.status}).` }, 200);

    const j = await res.json();
    let parsed: any = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const TIERS = new Set(["dev", "staging", "prod", "dr"]);
    const environments = (Array.isArray(parsed.environments) ? parsed.environments : [])
      .slice(0, 6)
      .map((e: any) => ({
        name: String(e?.name || "").slice(0, 80),
        tier: TIERS.has(e?.tier) ? e.tier : "dev",
        region: String(e?.region || "").slice(0, 60),
        notes: String(e?.notes || "").slice(0, 200),
      }))
      .filter((e: any) => e.name);

    const cutover_steps = (Array.isArray(parsed.cutover_steps) ? parsed.cutover_steps : [])
      .slice(0, 12)
      .map((s: any, idx: number) => ({
        order: Number.isFinite(s?.order) ? Number(s.order) : idx + 1,
        step: String(s?.step || "").slice(0, 240),
        owner: String(s?.owner || "").slice(0, 60),
        window: String(s?.window || "").slice(0, 40),
      }))
      .filter((s: any) => s.step)
      .map((s: any, idx: number) => ({ ...s, order: idx + 1 }));

    const rollback_plan = typeof parsed.rollback_plan === "string" ? parsed.rollback_plan.slice(0, 2000) : "";
    const runbook_url = typeof parsed.runbook_url === "string" ? parsed.runbook_url.slice(0, 500) : "";

    return ok({ project_id, environments, cutover_steps, rollback_plan, runbook_url });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
