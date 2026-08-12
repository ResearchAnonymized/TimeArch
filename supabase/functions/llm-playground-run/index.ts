// Run a single prompt against either (a) a Lovable AI Gateway model or
// (b) a user-registered custom endpoint stored in `llm_endpoints`.
// Admins only.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface Body {
  model?: string;
  endpointId?: string;
  systemPrompt?: string;
  userPrompt: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await sb.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const body = (await req.json()) as Body;
    if (!body?.userPrompt) return json({ error: "userPrompt required" }, 400);

    const messages = [
      ...(body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : []),
      { role: "user", content: body.userPrompt },
    ];

    let url: string;
    let apiKey: string | undefined;
    let modelId: string;

    if (body.endpointId) {
      const { data: ep, error } = await sb
        .from("llm_endpoints")
        .select("*")
        .eq("id", body.endpointId)
        .maybeSingle();
      if (error || !ep) return json({ error: "Endpoint not found" }, 404);
      if (ep.provider === "local") {
        return json(
          { error: "Local endpoints must be called from the browser." },
          400,
        );
      }
      url = `${String(ep.base_url).replace(/\/$/, "")}/chat/completions`;
      modelId = ep.model_id;
      apiKey = ep.api_key_secret_name ? Deno.env.get(ep.api_key_secret_name) : undefined;
    } else {
      if (!body.model) return json({ error: "model or endpointId required" }, 400);
      if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);
      url = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      modelId = body.model;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model: modelId, messages }),
    });

    const text = await res.text();
    if (!res.ok) return json({ error: `Upstream ${res.status}: ${text.slice(0, 400)}` }, 200);

    const data = JSON.parse(text);
    return json({
      text: data?.choices?.[0]?.message?.content ?? "(no content)",
      model: modelId,
      latencyMs: 0,
      tokens: data?.usage
        ? {
            prompt: data.usage.prompt_tokens,
            completion: data.usage.completion_tokens,
            total: data.usage.total_tokens,
          }
        : undefined,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 200);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
