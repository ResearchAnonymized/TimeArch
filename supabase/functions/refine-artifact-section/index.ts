// Surgical refinement: ask the AI to patch only the section of an artifact
// that addresses a specific checklist item, given a list of identified gaps.
// The patch is merged into the existing artifact content (no destructive overwrite).

import { createClient } from "jsr:@supabase/supabase-js@2";

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
  stage: number;
  itemId: string;
  itemLabel: string;
  artifactId: string;
  gaps: string[];
}

function trim(text: string, max = 14000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…[truncated]";
}

function deepMerge(base: any, patch: any): any {
  if (Array.isArray(patch)) {
    if (Array.isArray(base)) return [...base, ...patch];
    return patch;
  }
  if (patch && typeof patch === "object") {
    const out: any = { ...(base && typeof base === "object" ? base : {}) };
    for (const k of Object.keys(patch)) {
      out[k] = deepMerge(out[k], patch[k]);
    }
    return out;
  }
  return patch !== undefined ? patch : base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.artifactId || !body?.itemLabel || !body?.projectId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT
    const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isMember } = await client.rpc("is_project_member", {
      _user_id: userData.user.id,
      _project_id: body.projectId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { data: artifact, error: artErr } = await client
      .from("architecture_artifacts")
      .select("id, title, type, content, status")
      .eq("id", body.artifactId)
      .maybeSingle();

    if (artErr || !artifact) {
      return new Response(JSON.stringify({ error: "Artifact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (artifact.status === "locked") {
      return new Response(JSON.stringify({ error: "Artifact is locked. Unlock to refine." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const artifactText = trim(JSON.stringify(artifact.content, null, 2));
    const gapsText = body.gaps.length
      ? body.gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")
      : "(no specific gaps provided — improve coverage of the item)";

    const systemPrompt = `You are a senior software architect refining an existing architecture artifact.

The architect has identified that ONE checklist item is not adequately covered.
Your job is to produce a JSON PATCH OBJECT that, when deep-merged into the existing artifact,
fully addresses that checklist item while preserving everything else.

Strict rules:
- Output ONLY a JSON object with two top-level keys: "patch" and "summary".
  - "patch": the partial JSON to deep-merge into the existing artifact.content.
    Use the same key naming conventions as the existing artifact. Add new sections
    where appropriate (e.g., for cross-cutting concerns: security/observability/
    resilience/caching keys, concern_diagrams, controls, etc.).
  - "summary": a 1-2 sentence plain-language description of what was added.
- Do NOT delete, rename, or rewrite existing keys. ONLY add or extend.
- Be concrete and specific (real mechanisms, real patterns), not vague.
- For diagrams, use Mermaid syntax inside string fields named "mermaid" or "diagram".`;

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPromptResolved = await resolvePrompt(
      client,
      "refine-artifact-section.system",
      systemPrompt,
    );

    const userPrompt = `STAGE: ${body.stage}
CHECKLIST ITEM TO ADDRESS: ${body.itemLabel}

IDENTIFIED GAPS:
${gapsText}

EXISTING ARTIFACT (${artifact.title}):
${artifactText}

Produce the JSON { "patch": ..., "summary": ... } object now.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPromptResolved },
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

    const patch = parsed?.patch && typeof parsed.patch === "object" ? parsed.patch : null;
    const summary = typeof parsed?.summary === "string" ? parsed.summary : "Section refined.";

    if (!patch) {
      return new Response(
        JSON.stringify({ error: "AI did not return a valid patch", summary }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Capture before/after snapshots so the UI can show a diff and explain
    // exactly what changed. We pretty-print the JSON for line-based diffing.
    const beforeJson = JSON.stringify(artifact.content ?? {}, null, 2);
    const merged = deepMerge(artifact.content, patch);
    const afterJson = JSON.stringify(merged, null, 2);
    const patchJson = JSON.stringify(patch, null, 2);

    // Mark refinement provenance — append to a history list so we keep every
    // run, not just the latest, and store snapshots for the diff viewer.
    const existing = artifact.content?._refinements;
    const historyArray = Array.isArray(existing)
      ? existing
      : existing && typeof existing === "object"
        ? Object.values(existing)
        : [];

    const newRecord = {
      item_id: body.itemId,
      item_label: body.itemLabel,
      gaps: body.gaps,
      summary,
      refined_at: new Date().toISOString(),
      before: beforeJson,
      after: afterJson,
      patch: patchJson,
    };

    merged._refinements = [...historyArray, newRecord];

    const { error: updErr } = await client
      .from("architecture_artifacts")
      .update({
        content: merged,
        updated_at: new Date().toISOString(),
        generated_by: (artifact as any).generated_by
          ? `${(artifact as any).generated_by} + Refinement`
          : "Refinement",
      })
      .eq("id", body.artifactId);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit
    await client.from("audit_log").insert({
      project_id: body.projectId,
      entity_type: "artifact",
      entity_id: body.artifactId,
      action: "refine_section",
      details: { stage: body.stage, item_id: body.itemId, item_label: body.itemLabel, gaps: body.gaps, summary },
    });

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
