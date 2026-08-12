// Suggest Work Items — reads the project's requirements + prior architecture
// artifacts and asks Lovable AI to propose a starter implementation plan.
// Returns { items: WorkItem[], narrative: string } — the UI stitches them
// into Stage 16's editor so the user can tweak/accept before saving.
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

const SYSTEM = `You are TimeArch's Implementation Planner.
Given a project's requirements and prior architecture artifacts, propose a
pragmatic starter implementation plan as STRICT JSON:

{
  "narrative": "2-4 sentence delivery strategy (sequencing + critical path)",
  "items": [
    {
      "title": "short verb-first work item",
      "component": "component/area from the architecture (optional)",
      "owner": "role suggestion (e.g. Backend, Frontend, Platform, QA)",
      "effort": "S|M|L|XL",
      "sprint": "Sprint 1..N",
      "depends_on": "WI-### if applicable, else empty string",
      "notes": "one-line rationale"
    }
  ]
}

Guidelines:
- Produce 5-10 items grouped across 2-4 sprints.
- Sequence foundational work (auth, data model, infra) before feature work.
- Reference component names from the architecture where possible.
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

    // Gather context: project meta, requirements, key artifacts (components, APIs, infra, plan).
    const [{ data: project }, { data: reqs }, { data: artifacts }] = await Promise.all([
      supabase.from("projects").select("name, description, domain, project_type").eq("id", project_id).maybeSingle(),
      supabase.from("requirements").select("title, description, priority, category").eq("project_id", project_id).limit(40),
      supabase.from("architecture_artifacts").select("stage, title, content").eq("project_id", project_id).in("stage", [4, 6, 8, 10, 15]),
    ]);

    const context = {
      project: project ?? null,
      requirements: (reqs ?? []).map((r: any) => ({
        title: r.title, priority: r.priority, category: r.category,
        summary: (r.description || "").slice(0, 240),
      })),
      artifacts: (artifacts ?? []).map((a: any) => ({
        stage: a.stage,
        title: a.title,
        summary: typeof a.content?.summary === "string" ? a.content.summary.slice(0, 400) : undefined,
        components: Array.isArray(a.content?.components)
          ? a.content.components.slice(0, 20).map((c: any) => c?.name).filter(Boolean)
          : undefined,
        apis: Array.isArray(a.content?.apis)
          ? a.content.apis.slice(0, 20).map((c: any) => c?.name || c?.path).filter(Boolean)
          : undefined,
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

    const EFFORTS = new Set(["S", "M", "L", "XL"]);
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    const items = rawItems.slice(0, 12).map((it: any, i: number) => ({
      id: `WI-${String(i + 1).padStart(3, "0")}`,
      title: String(it?.title || "").slice(0, 160),
      component: String(it?.component || "").slice(0, 80),
      owner: String(it?.owner || "").slice(0, 60),
      effort: EFFORTS.has(it?.effort) ? it.effort : "M",
      sprint: String(it?.sprint || "Sprint 1").slice(0, 40),
      depends_on: String(it?.depends_on || "").slice(0, 40),
      notes: String(it?.notes || "").slice(0, 200),
    })).filter((it: any) => it.title);

    const narrative = typeof parsed.narrative === "string" ? parsed.narrative.slice(0, 2000) : "";

    return ok({ project_id, items, narrative, context_size: {
      requirements: context.requirements.length,
      artifacts: context.artifacts.length,
    }});
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
