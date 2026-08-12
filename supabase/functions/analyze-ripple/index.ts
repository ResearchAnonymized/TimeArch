// Ripple analyzer (Phase 4).
// Given a feature_change_id + its approved/pending feature_mappings, traverses
// components + gaps + parsed schemas to emit impact_findings classified
// confirmed/probable/possible/unlikely/unknown with evidence refs.
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

interface Impact {
  impacted_element_type: string;
  impacted_element_ref: string;
  impacted_element_label?: string;
  classification: "confirmed" | "probable" | "possible" | "unlikely" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  reason?: string;
  dependency_path?: unknown[];
  recommended_action?: string;
  evidence_refs?: unknown[];
  origin_mapping_id?: string | null;
}

function heuristicRipples(
  mappings: any[],
  components: any[],
  gaps: any[],
): Impact[] {
  const out: Impact[] = [];

  // Every mapped API implies test + deploy impact.
  for (const m of mappings) {
    if (m.element_type === "api" && m.relationship !== "reads") {
      out.push({
        impacted_element_type: "test",
        impacted_element_ref: `contract-tests(${m.element_ref})`,
        impacted_element_label: "API contract tests",
        classification: "confirmed",
        severity: "medium",
        reason: "API modification requires contract test updates.",
        dependency_path: [{ type: m.element_type, ref: m.element_ref }],
        recommended_action: "Update contract tests and consumer stubs.",
        origin_mapping_id: m.id,
        evidence_refs: m.evidence_refs || [],
      });
      out.push({
        impacted_element_type: "deploy",
        impacted_element_ref: `versioning(${m.element_ref})`,
        impacted_element_label: "API version / rollout",
        classification: "probable",
        severity: "medium",
        reason: "Breaking API change may require versioned rollout.",
        dependency_path: [{ type: m.element_type, ref: m.element_ref }],
        recommended_action: "Plan blue/green or versioned release; notify consumers.",
        origin_mapping_id: m.id,
        evidence_refs: m.evidence_refs || [],
      });
    }
    if (m.element_type === "data" && (m.relationship === "modifies" || m.relationship === "writes")) {
      out.push({
        impacted_element_type: "deploy",
        impacted_element_ref: `migration(${m.element_ref})`,
        impacted_element_label: "Schema migration",
        classification: "confirmed",
        severity: "high",
        reason: "Data-model change requires forward migration + rollback plan.",
        dependency_path: [{ type: m.element_type, ref: m.element_ref }],
        recommended_action: "Author reversible migration; verify on staging snapshot.",
        origin_mapping_id: m.id,
        evidence_refs: m.evidence_refs || [],
      });
    }
    if (m.element_type === "component") {
      // Neighbouring components in the discovered graph become "possible" ripples.
      for (const c of components) {
        const name = c.name || c.title;
        if (!name || name === m.element_ref) continue;
        const deps: string[] = c.dependencies || c.depends_on || [];
        if (deps.some((d) => d === m.element_ref)) {
          out.push({
            impacted_element_type: "component",
            impacted_element_ref: name,
            impacted_element_label: c.responsibility || name,
            classification: "probable",
            severity: "medium",
            reason: `Component "${name}" depends on "${m.element_ref}".`,
            dependency_path: [
              { type: "component", ref: m.element_ref },
              { type: "component", ref: name },
            ],
            recommended_action: "Review integration contract and regression tests.",
            origin_mapping_id: m.id,
            evidence_refs: m.evidence_refs || [],
          });
        }
      }
    }
  }

  // Open gaps aligned to touched elements become "possible" ripples.
  for (const g of gaps) {
    if (g.status !== "open") continue;
    out.push({
      impacted_element_type: "quality",
      impacted_element_ref: `${g.category}:${g.title}`.slice(0, 200),
      impacted_element_label: g.title,
      classification: "possible",
      severity: g.severity || "medium",
      reason: `Open architecture gap (${g.framework || "iso_25010"}) may be worsened or exposed by the change.`,
      dependency_path: [],
      recommended_action: g.recommendation || "Address gap alongside the change.",
      evidence_refs: [{ gap_id: g.id, method: "gap-analyzer", confidence: 0.5 }],
    });
  }

  return out;
}

async function llmRipples(context: string): Promise<Impact[]> {
  try {
    const prompt = `You are a brownfield ripple-effect analyst. Given a feature change, its confirmed architecture mappings, and the surrounding system context, identify additional ripple effects the team may miss.

Return STRICT JSON only:
{"impacts":[{"impacted_element_type":"ui|api|service|domain|data|event|external|test|deploy|component|quality|security|performance","impacted_element_ref":"exact ref","impacted_element_label":"label","classification":"confirmed|probable|possible|unlikely|unknown","severity":"low|medium|high|critical","reason":"why","dependency_path":[{"type":"","ref":""}],"recommended_action":"","evidence_refs":[{"path":"","method":"llm","confidence":0.7}]}]}

Rules:
- Do NOT repeat elements already in mappings — surface SECONDARY ripples.
- Prefer confirmed/probable classifications only when there is clear reasoning.
- Max 15 impacts, no prose.`;

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
    return Array.isArray(parsed.impacts) ? parsed.impacts : [];
  } catch (e) {
    console.error("llmRipples failed", e);
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
      .from("feature_changes")
      .select("*")
      .eq("id", feature_change_id)
      .single();
    if (!fc) return ok({ error: "Feature change not found" }, 404);

    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id,
      _project_id: fc.project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const [{ data: mappings }, { data: artifacts }, { data: gaps }] = await Promise.all([
      supabase.from("feature_mappings").select("*").eq("feature_change_id", feature_change_id),
      supabase
        .from("architecture_artifacts")
        .select("id,stage,title,content")
        .eq("project_id", fc.project_id),
      supabase.from("architecture_gaps").select("id,title,category,framework,severity,status,recommendation").eq("project_id", fc.project_id),
    ]);

    if (!mappings || mappings.length === 0) {
      return ok({ error: "No mappings yet. Run map-feature-to-architecture first." }, 200);
    }

    const components: any[] = artifacts?.find((a: any) => a.stage === 6)?.content?.components || [];

    const heur = heuristicRipples(mappings || [], components, gaps || []);
    const ctx = JSON.stringify({
      feature_change: {
        title: fc.title,
        change_type: fc.change_type,
        desired_behavior: fc.desired_behavior,
      },
      mappings: (mappings || []).map((m: any) => ({
        type: m.element_type,
        ref: m.element_ref,
        rel: m.relationship,
      })),
      components: components.slice(0, 20),
      open_gaps: (gaps || []).filter((g: any) => g.status === "open").map((g: any) => g.title),
    });
    const llm = await llmRipples(ctx);

    const seen = new Set<string>();
    const merged: Impact[] = [...heur, ...llm].filter((i) => {
      const k = `${i.impacted_element_type}::${i.impacted_element_ref}`.toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (replace) {
      await supabase.from("impact_findings").delete().eq("feature_change_id", feature_change_id);
    }

    let inserted = 0;
    if (merged.length) {
      const rows = merged.map((i) => ({
        project_id: fc.project_id,
        feature_change_id,
        origin_mapping_id: i.origin_mapping_id || null,
        impacted_element_type: i.impacted_element_type || "component",
        impacted_element_ref: String(i.impacted_element_ref || "unknown").slice(0, 500),
        impacted_element_label: i.impacted_element_label ? String(i.impacted_element_label).slice(0, 500) : null,
        classification: ["confirmed", "probable", "possible", "unlikely", "unknown"].includes(i.classification)
          ? i.classification
          : "possible",
        severity: ["low", "medium", "high", "critical"].includes(i.severity) ? i.severity : "medium",
        reason: i.reason || null,
        dependency_path: i.dependency_path || [],
        recommended_action: i.recommended_action || null,
        evidence_refs: i.evidence_refs || [],
      }));
      const { error: insErr, data: ins } = await supabase
        .from("impact_findings")
        .insert(rows)
        .select("id");
      if (insErr) return ok({ error: insErr.message }, 200);
      inserted = ins?.length ?? rows.length;
    }

    return ok({ feature_change_id, impact_count: inserted, heuristic: heur.length, llm: llm.length });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
