// System Disposition Analyzer (Phase 0 — Discovery)
import { getLlmApiKey, getLlmChatCompletionsUrl } from "../_shared/llm-config.ts";
// Synthesizes a Modernize-vs-Rebuild verdict from brownfield evidence using
// the 6R / TIME framework. Three LLM calls (scorecard, component map,
// rationale) routed through LLM API via the existing prompt
// resolver so admins can edit the prompts and reviewers can replay results.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  DISPOSITION_SCORECARD_PROMPT,
  DISPOSITION_COMPONENT_MAP_PROMPT,
  DISPOSITION_RATIONALE_PROMPT,
} from "../_shared/prompt-defaults/disposition.ts";
import { resolvePrompt } from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function llmJson(system: string, user: string, model: string): Promise<any> {
  try {
    const res = await fetch(getLlmChatCompletionsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user.slice(0, 14000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content || "{}";
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function fallbackScores() {
  // Conservative midpoint defaults if the LLM call fails entirely.
  const mid = { score: 2.5, evidence: "Insufficient evidence — heuristic midpoint." };
  return {
    business_fit: mid, technical_health: mid, change_velocity: mid,
    operational_cost: mid, risk: mid, strategic_alignment: mid,
  };
}

function deriveVerdict(scores: any, componentMap: any[]): { verdict: string; confidence: number } {
  const vals = Object.values(scores || {}).map((v: any) => Number(v?.score ?? 0));
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 2.5;
  const counts: Record<string, number> = {};
  for (const c of componentMap || []) {
    const d = c?.disposition || "retain";
    counts[d] = (counts[d] || 0) + 1;
  }
  const total = componentMap?.length || 1;
  const rebuildRatio = (counts.rebuild || 0) / total;
  const rearchRatio = (counts.rearchitect || 0) / total;
  const retainRatio = (counts.retain || 0) / total;

  let verdict = "refactor";
  if (avg >= 4 && retainRatio > 0.6) verdict = "retain";
  else if (avg >= 3.5) verdict = "replatform";
  else if (rebuildRatio > 0.5) verdict = "rebuild";
  else if (rearchRatio > 0.4 || avg < 2) verdict = "rearchitect";
  else if (rebuildRatio > 0 && rearchRatio > 0) verdict = "hybrid";

  const spread = Math.max(...vals) - Math.min(...vals);
  const confidence = Math.min(0.95, Math.max(0.35, 0.85 - spread * 0.08));
  return { verdict, confidence: Number(confidence.toFixed(2)) };
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
    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id, _project_id: project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const { data: project } = await supabase.from("projects")
      .select("mode,name").eq("id", project_id).single();
    if (project?.mode !== "brownfield") {
      return ok({ error: "Disposition analysis is only available for brownfield projects." }, 200);
    }

    // Gather evidence
    const [artifactsRes, driftRes, gapsRes, reqsRes] = await Promise.all([
      supabase.from("architecture_artifacts").select("id,stage,title,content")
        .eq("project_id", project_id),
      supabase.from("drift_findings").select("severity,category,description")
        .eq("project_id", project_id).limit(50),
      supabase.from("architecture_gaps").select("category,severity,title").eq("project_id", project_id),
      supabase.from("requirements").select("id,type").eq("project_id", project_id),
    ]);

    const artifacts = artifactsRes.data || [];
    const drift = driftRes.data || [];
    const gaps = gapsRes.data || [];
    const reqs = reqsRes.data || [];

    // Build component list from the reverse-engineered repo artifact
    const repoArt = artifacts.find((a: any) =>
      a.stage === 6 && a.content?._meta?.provenance === "reverse-engineered");
    const rawComponents: any[] = repoArt?.content?.components || [];
    const componentList = rawComponents.length
      ? rawComponents.slice(0, 12).map((c: any) => ({
          name: c.name || c.kind || "component",
          kind: c.kind || null,
          language: c.language || null,
        }))
      : [{ name: project?.name || "System", kind: "monolith" }];

    const evidence = {
      project_name: project?.name,
      requirement_count: reqs.length,
      nfr_count: reqs.filter((r: any) => r.type === "non_functional").length,
      drift_summary: drift.reduce((acc: any, d: any) => {
        acc[d.severity || "unknown"] = (acc[d.severity || "unknown"] || 0) + 1;
        return acc;
      }, {}),
      drift_examples: drift.slice(0, 8).map((d: any) => ({
        severity: d.severity, category: d.category, description: d.description,
      })),
      gap_summary: gaps.reduce((acc: any, g: any) => {
        acc[g.severity || "unknown"] = (acc[g.severity || "unknown"] || 0) + 1;
        return acc;
      }, {}),
      components: componentList,
      artifacts_present: artifacts.map((a: any) => ({ stage: a.stage, title: a.title })),
    };

    const [scorecardPrompt, componentPrompt, rationalePrompt] = await Promise.all([
      resolvePrompt(supabase, "disposition.scorecard.system", DISPOSITION_SCORECARD_PROMPT),
      resolvePrompt(supabase, "disposition.component-map.system", DISPOSITION_COMPONENT_MAP_PROMPT),
      resolvePrompt(supabase, "disposition.rationale.system", DISPOSITION_RATIONALE_PROMPT),
    ]);

    const userCtx = JSON.stringify(evidence);
    const [scorecard, componentMap] = await Promise.all([
      llmJson(scorecardPrompt, userCtx, "google/gemini-2.5-flash"),
      llmJson(componentPrompt, JSON.stringify({ components: componentList, evidence }),
        "google/gemini-2.5-flash"),
    ]);

    const dimension_scores = scorecard?.dimension_scores || fallbackScores();
    const component_dispositions = Array.isArray(componentMap?.components)
      ? componentMap.components
      : componentList.map((c: any) => ({
          name: c.name, disposition: "refactor", business_value: 3,
          technical_risk: 3, effort: "M",
          rationale: "Heuristic default — LLM unavailable.",
        }));

    const { verdict, confidence } = deriveVerdict(dimension_scores, component_dispositions);

    const rationale = await llmJson(
      rationalePrompt,
      JSON.stringify({
        proposed_verdict: verdict, confidence,
        dimension_scores, components: component_dispositions, evidence,
      }),
      "google/gemini-2.5-pro",
    );

    const overall_verdict = rationale?.overall_verdict || verdict;
    const finalConfidence = typeof rationale?.confidence === "number"
      ? rationale.confidence : confidence;

    const risk_value_matrix = component_dispositions.map((c: any) => ({
      name: c.name,
      x: Number(c.business_value ?? 3),
      y: Number(c.technical_risk ?? 3),
      disposition: c.disposition,
      effort: c.effort,
    }));

    const effort_estimate = component_dispositions.reduce((acc: any, c: any) => {
      const k = c.effort || "M";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, { S: 0, M: 0, L: 0, XL: 0 });

    const rationaleText = rationale
      ? JSON.stringify({
          summary: rationale.executive_summary,
          key_drivers: rationale.key_drivers || [],
          roadmap: rationale.roadmap || [],
        })
      : "Heuristic verdict — LLM rationale unavailable.";

    const { data: inserted, error: insErr } = await supabase
      .from("system_disposition_reports")
      .insert({
        project_id,
        created_by: user.id,
        overall_verdict,
        confidence: finalConfidence,
        dimension_scores,
        component_dispositions,
        risk_value_matrix,
        effort_estimate,
        rationale: rationaleText,
        inputs_hash: String(artifacts.length) + ":" + String(drift.length) + ":" + String(reqs.length),
      })
      .select()
      .single();

    if (insErr) return ok({ error: insErr.message }, 200);
    return ok({ report: inserted });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
