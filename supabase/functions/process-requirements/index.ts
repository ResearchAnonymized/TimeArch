import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { EXTRACTION_PROMPT } from "../_shared/prompt-defaults/extraction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, user_id, input_text, input_mode, existing_requirements } = await req.json();

    if (!project_id || !user_id || !input_text) {
      return new Response(
        JSON.stringify({ error: "Missing project_id, user_id, or input_text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ─── AUTH: verify JWT, identity, and project membership ────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: userErr } = await authedClient.auth.getClaims(token);
    const authedUserId = claimsData?.claims?.sub;
    if (userErr || !authedUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (authedUserId !== user_id) {
      return new Response(JSON.stringify({ error: "Forbidden: user_id mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isMember } = await authedClient.rpc("is_project_member", {
      _user_id: authedUserId, _project_id: project_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a project member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get project context
    const { data: project } = await supabase
      .from("projects")
      .select("name, description")
      .eq("id", project_id)
      .single();

    let userPrompt = `INPUT MODE: ${input_mode || "free_text"}\n\n`;
    
    if (project) {
      userPrompt += `PROJECT CONTEXT:\nName: ${project.name}\nDescription: ${project.description || "None provided"}\n\n`;
    }

    userPrompt += `INPUT CONTENT:\n${input_text}`;

    if (existing_requirements && existing_requirements.length > 0) {
      userPrompt += `\n\nEXISTING REQUIREMENTS (already captured - avoid duplicates):\n${JSON.stringify(existing_requirements, null, 2)}`;
    }

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPrompt = await resolvePrompt(
      supabase,
      "process-requirements.extraction.system",
      EXTRACTION_PROMPT,
    );

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    content = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Attempt recovery: extract JSON object from content
      try {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          // Fix trailing commas before closing brackets
          let cleaned = match[0].replace(/,\s*([}\]])/g, "$1");
          parsed = JSON.parse(cleaned);
        } else {
          parsed = { raw_output: content, parse_error: true };
        }
      } catch {
        parsed = { raw_output: content, parse_error: true };
      }
    }

    // Log to audit
    await supabase.from("audit_log").insert({
      project_id,
      user_id,
      entity_type: "requirement_intake",
      action: "ai_extraction",
      details: {
        input_mode,
        input_length: input_text.length,
        fr_count: parsed.functional_requirements?.length || 0,
        nfr_count: parsed.non_functional_requirements?.length || 0,
        ambiguity_count: parsed.ambiguities?.length || 0,
      },
    });

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-requirements error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
