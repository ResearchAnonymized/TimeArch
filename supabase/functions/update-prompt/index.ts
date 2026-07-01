// update-prompt — admin-only upsert or reset of a prompt override.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PROMPT_KEYS } from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  key: string;
  content?: string;
  notes?: string;
  reset?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
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

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.key || !PROMPT_KEYS.has(body.key)) {
      return new Response(JSON.stringify({ error: "Unknown prompt key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (body.reset) {
      await admin.from("prompt_overrides").delete().eq("key", body.key);
      await admin.from("audit_log").insert({
        user_id: userId,
        entity_type: "prompt_override",
        action: "reset",
        details: { key: body.key },
      });
      return new Response(JSON.stringify({ ok: true, reset: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return new Response(JSON.stringify({ error: "content is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("prompt_overrides").upsert({
      key: body.key,
      content: body.content,
      notes: body.notes ?? null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to save override", detail: error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("audit_log").insert({
      user_id: userId,
      entity_type: "prompt_override",
      action: "update",
      details: { key: body.key, length: body.content.length },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "update-prompt crashed", detail: String(e).slice(0, 400) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
