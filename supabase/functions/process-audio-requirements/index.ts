import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { AUDIO_EXTRACTION_PROMPT } from "../_shared/prompt-defaults/audio-extraction.ts";

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
    const { project_id, user_id, audio_base64, transcript, input_mode, existing_requirements } = await req.json();

    if (!project_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing project_id or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!audio_base64 && !transcript) {
      return new Response(
        JSON.stringify({ error: "Either audio_base64 or transcript is required" }),
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

    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const audioSystemPrompt = await resolvePrompt(
      supabase,
      "process-audio-requirements.extraction.system",
      AUDIO_EXTRACTION_PROMPT,
    );
    const messages: any[] = [
      { role: "system", content: audioSystemPrompt },
    ];

    let userContent: any;

    if (audio_base64) {
      // Send audio directly to Gemini multimodal
      // Gemini accepts inline_data with audio
      userContent = [
        {
          type: "text",
          text: `PROJECT CONTEXT:\nName: ${project?.name || "Unknown"}\nDescription: ${project?.description || "None"}\n\nINPUT MODE: ${input_mode || "audio_upload"}\n\nPlease analyze the following audio recording of a requirements discussion. Identify speakers, extract requirements, and provide a complete analysis.\n\n${existing_requirements?.length ? `EXISTING REQUIREMENTS (avoid duplicates):\n${JSON.stringify(existing_requirements, null, 2)}` : ""}`,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:audio/webm;base64,${audio_base64}`,
          },
        },
      ];
    } else {
      // Use transcript text
      userContent = `PROJECT CONTEXT:\nName: ${project?.name || "Unknown"}\nDescription: ${project?.description || "None"}\n\nINPUT MODE: ${input_mode || "audio_transcript"}\n\nTRANSCRIPT OF DISCUSSION:\n${transcript}\n\n${existing_requirements?.length ? `EXISTING REQUIREMENTS (avoid duplicates):\n${JSON.stringify(existing_requirements, null, 2)}` : ""}`;
    }

    messages.push({ role: "user", content: userContent });

    // Call AI - use Gemini 2.5 Pro for best audio understanding
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: audio_base64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = { raw_output: content, parse_error: true };
        }
      } else {
        parsed = { raw_output: content, parse_error: true };
      }
    }

    // Log to audit
    await supabase.from("audit_log").insert({
      project_id,
      user_id,
      entity_type: "requirement_intake",
      action: "audio_extraction",
      details: {
        input_mode: input_mode || (audio_base64 ? "audio_upload" : "audio_transcript"),
        has_audio: !!audio_base64,
        speakers_found: parsed.speakers?.length || 0,
        fr_count: parsed.functional_requirements?.length || 0,
        nfr_count: parsed.non_functional_requirements?.length || 0,
      },
    });

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-audio-requirements error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
