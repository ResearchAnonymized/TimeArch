// Feature → Architecture mapping agent (Phase 3).
// Given a feature_change_id, reads discovery outputs (components, APIs, data,
// requirements) and produces evidence-grounded mappings into
// public.feature_mappings.
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

interface Mapping {
  element_type: string;
  element_ref: string;
  element_label?: string;
  relationship: string;
  confidence: number;
  rationale?: string;
  evidence_refs?: unknown[];
}

async function llmMap(context: string): Promise<Mapping[]> {
  try {
    const prompt = `You are a brownfield architecture analyst. Given a feature change and a summary of the existing system, identify the CORE architecture elements the change directly touches.

Return STRICT JSON only:
{"mappings":[{"element_type":"ui|api|service|domain|data|event|external|test|deploy|component","element_ref":"exact class/module/table name","element_label":"human label","relationship":"touches|modifies|reads|writes|replaces|extends|removes","confidence":0.0-1.0,"rationale":"why","evidence_refs":[{"path":"file","method":"llm","confidence":0.8}]}]}

Rules:
- **element_ref MUST be class-level or module-level** (e.g. "OwnerController", "OwnerRepository", "owners" table). Do NOT include method signatures, individual test names, or method-level refs — those belong in ripple analysis.
- Return AT MOST 6 mappings, ranked by confidence descending. Prefer precision over recall.
- Include at most one mapping per architectural layer touched (UI, API, service, domain, data).
- Do not emit generic entries like "application", "deployment pipeline", "schema" unless directly modified.
- Prefer exact refs from the provided system summary.
- No prose outside JSON.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: context.slice(0, 14000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed.mappings) ? parsed.mappings : [];
  } catch (e) {
    console.error("llmMap failed", e);
    return [];
  }
}

function heuristicMappings(
  featureChange: any,
  imports: any[],
  artifacts: any[],
): Mapping[] {
  const out: Mapping[] = [];
  const importEvidence = (imp: any) => ({
    import_id: imp.id,
    path: imp.source_label || imp.storage_path || "unknown",
    method: "heuristic",
    confidence: 0.6,
  });

  const openapi = imports.find((i) => i.kind === "openapi" || /openapi|swagger/i.test(i.source_label || ""));
  if (openapi) {
    out.push({
      element_type: "api",
      element_ref: openapi.source_label || "OpenAPI",
      element_label: "API surface",
      relationship: "modifies",
      confidence: 0.6,
      rationale: "Feature change likely alters the public API contract.",
      evidence_refs: [importEvidence(openapi)],
    });
  }

  const schema = imports.find((i) => i.kind === "db_schema" || i.kind === "schema" || /schema|sql/i.test(i.source_label || ""));
  if (schema) {
    out.push({
      element_type: "data",
      element_ref: schema.source_label || "Database schema",
      element_label: "Data model",
      relationship: /add|migrate/i.test(featureChange.change_type) ? "modifies" : "reads",
      confidence: 0.55,
      rationale: "Any behavioral change usually reads or writes the persisted schema.",
      evidence_refs: [importEvidence(schema)],
    });
  }

  const componentArtifact = artifacts.find((a) => a.stage === 6);
  const components: any[] = componentArtifact?.content?.components || [];
  const titleLower = (featureChange.title || "").toLowerCase();
  for (const c of components.slice(0, 6)) {
    const name = c.name || c.title || "";
    if (!name) continue;
    const hit = titleLower.includes(name.toLowerCase().slice(0, 8));
    out.push({
      element_type: "component",
      element_ref: name,
      element_label: c.responsibility || c.description || name,
      relationship: hit ? "modifies" : "touches",
      confidence: hit ? 0.7 : 0.35,
      rationale: hit
        ? "Component name appears in the feature-change title."
        : "Discovered component in the current system; ripple candidate.",
      evidence_refs: componentArtifact
        ? [{ artifact_id: componentArtifact.id, path: "stage6.components", method: "heuristic", confidence: 0.5 }]
        : [],
    });
  }

  return out;
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

    const { data: fc, error: fcErr } = await supabase
      .from("feature_changes")
      .select("*")
      .eq("id", feature_change_id)
      .single();
    if (fcErr || !fc) return ok({ error: "Feature change not found" }, 404);

    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id,
      _project_id: fc.project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const [{ data: imports }, { data: artifacts }] = await Promise.all([
      supabase
        .from("project_imports")
        .select("id,kind,source_label,storage_path,parsed_summary")
        .eq("project_id", fc.project_id),
      supabase
        .from("architecture_artifacts")
        .select("id,stage,title,content")
        .eq("project_id", fc.project_id),
    ]);

    const heur = heuristicMappings(fc, imports || [], artifacts || []);

    const ctx = JSON.stringify({
      feature_change: {
        title: fc.title,
        description: fc.description,
        change_type: fc.change_type,
        current_behavior: fc.current_behavior,
        desired_behavior: fc.desired_behavior,
      },
      imports: (imports || []).map((i: any) => ({
        kind: i.kind,
        label: i.source_label,
        summary: i.parsed_summary,
      })),
      components: artifacts?.find((a: any) => a.stage === 6)?.content?.components || [],
    });
    const llm = await llmMap(ctx);

    const seen = new Set<string>();
    const merged: Mapping[] = [...heur, ...llm].filter((m) => {
      const k = `${m.element_type}::${m.element_ref}`.toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (replace) {
      await supabase
        .from("feature_mappings")
        .delete()
        .eq("feature_change_id", feature_change_id);
    }

    let inserted = 0;
    if (merged.length) {
      const rows = merged.map((m) => ({
        project_id: fc.project_id,
        feature_change_id,
        element_type: m.element_type || "component",
        element_ref: String(m.element_ref || "unknown").slice(0, 500),
        element_label: m.element_label ? String(m.element_label).slice(0, 500) : null,
        relationship: m.relationship || "touches",
        confidence: typeof m.confidence === "number" ? m.confidence : 0.5,
        source: "ai",
        review_status: "pending",
        rationale: m.rationale || null,
        evidence_refs: m.evidence_refs || [],
        created_by: user.id,
      }));
      const { error: insErr, data: ins } = await supabase
        .from("feature_mappings")
        .insert(rows)
        .select("id");
      if (insErr) return ok({ error: insErr.message }, 200);
      inserted = ins?.length ?? rows.length;
    }

    return ok({ feature_change_id, mapping_count: inserted, heuristic: heur.length, llm: llm.length });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
