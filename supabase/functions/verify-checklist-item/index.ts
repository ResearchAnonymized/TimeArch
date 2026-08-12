// Verify a single checklist item against the stage's primary artifact using
// the Lovable AI Gateway (Gemini Flash). Returns a structured verdict.

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
}

function trim(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…[truncated]";
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
    if (!body?.projectId || !body?.stage || !body?.itemId || !body?.itemLabel || !body?.artifactId) {
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

    // Service client for privileged reads + membership check
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isMember } = await userClient.rpc("is_project_member", {
      _user_id: userData.user.id,
      _project_id: body.projectId,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { data: artifact, error: artErr } = await userClient
      .from("architecture_artifacts")
      .select("id, title, type, content")
      .eq("id", body.artifactId)
      .maybeSingle();

    if (artErr || !artifact) {
      return new Response(JSON.stringify({ error: "Artifact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const artifactText = trim(JSON.stringify(artifact.content, null, 2));

    const systemPrompt = `You are a senior software architect performing rigorous architecture review.
You will be given a single checklist item and the full JSON artifact for an architecture stage.
Your job is to determine whether the artifact actually addresses the checklist item.

Return ONLY a JSON object matching this schema:
{
  "status": "green" | "amber" | "red",
  "confidence": <0..1>,
  "evidenceQuotes": [<short quote or path showing coverage>, ...],
  "gaps": [<specific missing aspects>, ...],
  "suggestions": [<concrete recommended additions>, ...]
}

Status rules:
- green: All aspects of the item are clearly addressed with concrete details.
- amber: Item is partially addressed; some aspects are weak, vague, or missing.
- red: Item is not meaningfully addressed in the artifact.

Be strict. Vague mentions ("we will use security best practices") = amber or red, not green.`;

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPromptResolved = await resolvePrompt(
      userClient,
      "verify-checklist-item.system",
      systemPrompt,
    );

    const userPrompt = `STAGE: ${body.stage}
CHECKLIST ITEM: ${body.itemLabel}
ARTIFACT TITLE: ${artifact.title}
ARTIFACT TYPE: ${artifact.type}

ARTIFACT JSON:
${artifactText}

Evaluate whether this checklist item is addressed. Respond with the JSON object only.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    let verdict: any;
    try {
      verdict = JSON.parse(raw);
    } catch {
      // Try to recover JSON from a code-fence
      const m = raw.match(/\{[\s\S]*\}/);
      verdict = m ? JSON.parse(m[0]) : {};
    }

    // Normalize
    const normalized = {
      status: ["green", "amber", "red"].includes(verdict.status) ? verdict.status : "amber",
      confidence: typeof verdict.confidence === "number" ? Math.max(0, Math.min(1, verdict.confidence)) : 0.5,
      evidenceQuotes: Array.isArray(verdict.evidenceQuotes) ? verdict.evidenceQuotes.slice(0, 6).map(String) : [],
      gaps: Array.isArray(verdict.gaps) ? verdict.gaps.slice(0, 6).map(String) : [],
      suggestions: Array.isArray(verdict.suggestions) ? verdict.suggestions.slice(0, 6).map(String) : [],
    };

    return new Response(JSON.stringify({ verdict: normalized }), {
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
