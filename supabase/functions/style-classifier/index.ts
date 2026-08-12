// Style Classifier Agent (Brownfield) — classifies the observed architectural
// style of a reverse-engineered system across a curated catalog (monolith,
// modular monolith, microservices, event-driven, layered, pipe-and-filter,
// service-oriented, serverless). Returns { primary, confidence, secondary,
// evidence[], drivers_fit[] } grounded in the imported artifacts.
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

const STYLES = [
  "monolith", "modular_monolith", "microservices", "event_driven",
  "layered", "pipe_and_filter", "service_oriented", "serverless",
] as const;

function aggregate(artifacts: any[]): { components: any[]; signals: Record<string, any>; sourceCount: number } {
  const repoRows = artifacts.filter((a: any) => a.stage === 6);
  const infraRows = artifacts.filter((a: any) => a.stage === 10);
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
  const signals: Record<string, any> = {};
  for (const r of infraRows) Object.assign(signals, r.content?.signals ?? {});
  const sourceLabels = new Set<string>();
  for (const r of [...repoRows, ...infraRows]) {
    const s = r.content?._meta?.source_label;
    if (s) sourceLabels.add(String(s));
  }
  return { components, signals, sourceCount: sourceLabels.size };
}

function heuristic(artifacts: any[]): { primary: string; confidence: "low" | "med" | "high"; evidence: string[] } {
  const evidence: string[] = [];
  const { components, signals, sourceCount } = aggregate(artifacts);

  if (signals.serverless || signals.aws_lambda) { evidence.push("Serverless signals detected in infra."); return { primary: "serverless", confidence: "high", evidence }; }
  if (signals.kafka || signals.rabbitmq || signals.event_bus) { evidence.push("Message broker detected."); return { primary: "event_driven", confidence: "high", evidence }; }
  if (sourceCount >= 3 && signals.kubernetes) { evidence.push(`${sourceCount} independently deployable services on Kubernetes.`); return { primary: "microservices", confidence: "high", evidence }; }
  if (sourceCount >= 3 || components.length >= 8) {
    evidence.push(`${sourceCount} distinct service manifests detected (${components.length} components total).`);
    evidence.push("Each service ships its own manifest — points to microservices decomposition.");
    return { primary: "microservices", confidence: "med", evidence };
  }
  if (components.length >= 4 && components.length <= 7) { evidence.push(`${components.length} well-bounded modules in a single deployable.`); return { primary: "modular_monolith", confidence: "med", evidence }; }
  if (components.length <= 3 && sourceCount <= 1) { evidence.push("Few top-level components — likely a monolith."); return { primary: "monolith", confidence: "med", evidence }; }
  evidence.push("Layered structure inferred from component names.");
  return { primary: "layered", confidence: "low", evidence };
}


async function llmClassify(context: string): Promise<any> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are an architecture-style classifier. Choose from: ${STYLES.join(", ")}. Return STRICT JSON {"primary":"","secondary":"","confidence":"low|med|high","evidence":["<=140 chars", ...],"drivers_fit":[{"driver":"","fit":"good|weak|poor","note":"<=100 chars"}]}. Provide at least 3 concrete evidence bullets grounded in the payload. No prose.` },
          { role: "user", content: context.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    return JSON.parse(j.choices?.[0]?.message?.content || "{}");
  } catch (e) { console.log("llmClassify failed", (e as any)?.message); return null; }
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

    const [{ data: artifacts }, { data: drivers }] = await Promise.all([
      supabase.from("architecture_artifacts").select("stage,title,content").eq("project_id", project_id),
      supabase.from("architecture_drivers").select("title,kind,priority,scenario").eq("project_id", project_id),
    ]);

    const { data: run } = await supabase.from("agent_runs").insert({
      project_id, agent_name: "Style Classifier Agent", stage: 5,
      status: "running", triggered_by: user.id,
      input: { style_catalog: STYLES }, started_at: new Date().toISOString(),
    }).select().single();

    const h = heuristic(artifacts || []);
    const summary = JSON.stringify({
      artifacts: (artifacts || []).map((a: any) => ({ stage: a.stage, title: a.title, components: a.content?.components, signals: a.content?.signals })),
      drivers: drivers || [],
      style_catalog: STYLES,
    });
    const llm = await llmClassify(summary);
    const merged = llm && STYLES.includes(llm.primary)
      ? {
          primary: llm.primary,
          secondary: STYLES.includes(llm.secondary) ? llm.secondary : null,
          confidence: ["low", "med", "high"].includes(llm.confidence) ? llm.confidence : h.confidence,
          evidence: Array.isArray(llm.evidence) ? llm.evidence : h.evidence,
          drivers_fit: Array.isArray(llm.drivers_fit) ? llm.drivers_fit : [],
        }
      : { ...h, secondary: null, drivers_fit: [] };

    const now = new Date().toISOString();
    await supabase.from("system_style").upsert({
      project_id,
      primary_style: merged.primary,
      secondary_style: merged.secondary,
      confidence: merged.confidence,
      evidence: merged.evidence,
      drivers_fit: merged.drivers_fit,
      computed_at: now,
      computed_by: user.id,
    }, { onConflict: "project_id" });

    if (run?.id) {
      await supabase.from("agent_runs").update({
        status: "completed", output: merged, completed_at: now,
      }).eq("id", run.id);
    }
    return ok({ project_id, ...merged });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
