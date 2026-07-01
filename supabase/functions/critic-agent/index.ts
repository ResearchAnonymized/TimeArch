// Requirement Critic Agent
// Reviews AI-extracted requirements (Stage 2) or architecture drivers (Stage 3)
// against ISO/IEC/IEEE 29148 + INCOSE quality criteria. Produces per-item
// verdicts (approve / revise / reject) with rationale and suggested rewrites.
//
// Verdicts are persisted to public.requirement_reviews so the UI can display
// review badges, filter by severity, and show audit trails.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { SYSTEM_PROMPT_REQUIREMENTS } from "../_shared/prompt-defaults/critic-requirements.ts";
import { SYSTEM_PROMPT_DRIVERS } from "../_shared/prompt-defaults/critic-drivers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  projectId: string;
  stage: 2 | 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId, stage } = (await req.json()) as Body;
    if (!projectId || (stage !== 2 && stage !== 3)) {
      return new Response(JSON.stringify({ error: "projectId and stage (2 or 3) are required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Enforce project membership — caller must belong to the project.
    const { data: isMember, error: memberErr } = await admin.rpc("is_project_member", {
      _user_id: userId,
      _project_id: projectId,
    });
    if (memberErr || !isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a project member" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Build the items list
    let items: Array<{ key: string; label: string; text: string }> = [];

    if (stage === 2) {
      const { data: reqs } = await admin
        .from("requirements")
        .select("id, requirement_id, title, description, type, priority, acceptance_criteria")
        .eq("project_id", projectId)
        .order("requirement_id");
      items = (reqs || []).map((r: any) => ({
        key: r.requirement_id,
        label: r.title,
        text: `[${r.requirement_id}] ${r.title}\nType: ${r.type} | Priority: ${r.priority}\n${r.description || ""}\nAcceptance: ${
          Array.isArray(r.acceptance_criteria) ? r.acceptance_criteria.join("; ") : r.acceptance_criteria || "(none)"
        }`,
      }));
    } else {
      const { data: drivers } = await admin
        .from("architecture_drivers")
        .select("id, label, description, category, priority")
        .eq("project_id", projectId)
        .order("label");
      items = (drivers || []).map((d: any) => ({
        key: d.label,
        label: d.label,
        text: `[${d.label}] (${d.category || "uncategorized"}, ${d.priority})\n${d.description || ""}`,
      }));
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: `No ${stage === 2 ? "requirements" : "drivers"} to review.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPromptDefault = stage === 2 ? SYSTEM_PROMPT_REQUIREMENTS : SYSTEM_PROMPT_DRIVERS;
    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPrompt = await resolvePrompt(
      admin,
      stage === 2 ? "critic-agent.requirements.system" : "critic-agent.drivers.system",
      systemPromptDefault,
    );
    const userPrompt = `Review the following ${items.length} ${stage === 2 ? "requirements" : "drivers"}:\n\n${
      items.map((i) => i.text).join("\n\n---\n\n")
    }\n\nReturn JSON { "reviews": [...] } with one entry per item.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: "AI gateway failed", detail: errText.slice(0, 500) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const reviews: any[] = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
    if (reviews.length === 0) {
      return new Response(
        JSON.stringify({ error: "Critic produced no reviews." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Wipe previous critic verdicts for this project+stage so the UI shows
    // only the latest review pass (audit history lives in audit_log).
    await admin
      .from("requirement_reviews")
      .delete()
      .eq("project_id", projectId)
      .eq("stage", stage)
      .eq("target_type", stage === 2 ? "requirement" : "driver");

    const rows = reviews
      .filter((r) => r?.target_key && r?.verdict)
      .map((r) => ({
        project_id: projectId,
        stage,
        target_type: stage === 2 ? "requirement" : "driver",
        target_key: String(r.target_key),
        target_label:
          items.find((i) => i.key === String(r.target_key))?.label || String(r.target_key),
        verdict: ["approve", "revise", "reject"].includes(r.verdict) ? r.verdict : "revise",
        severity: ["info", "minor", "major", "critical"].includes(r.severity) ? r.severity : "minor",
        rationale: typeof r.rationale === "string" ? r.rationale : null,
        suggested_rewrite: typeof r.suggested_rewrite === "string" ? r.suggested_rewrite : null,
        violated_rules: Array.isArray(r.violated_rules) ? r.violated_rules : [],
        created_by: userId,
      }));

    if (rows.length > 0) {
      const { error: insErr } = await admin.from("requirement_reviews").insert(rows);
      if (insErr) {
        return new Response(
          JSON.stringify({ error: "Failed to persist reviews", detail: insErr.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Audit
    await admin.from("audit_log").insert({
      project_id: projectId,
      user_id: userId,
      action: "critic_review",
      entity_type: stage === 2 ? "requirements" : "drivers",
      details: {
        stage,
        reviewed: rows.length,
        approve: rows.filter((r) => r.verdict === "approve").length,
        revise: rows.filter((r) => r.verdict === "revise").length,
        reject: rows.filter((r) => r.verdict === "reject").length,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        reviewed: rows.length,
        summary: {
          approve: rows.filter((r) => r.verdict === "approve").length,
          revise: rows.filter((r) => r.verdict === "revise").length,
          reject: rows.filter((r) => r.verdict === "reject").length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Critic agent crashed", detail: String(e).slice(0, 500) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
