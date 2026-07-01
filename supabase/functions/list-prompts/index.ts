// list-prompts — return the merged prompt catalog + current overrides.
// Available to any authenticated user (read-only view in the app).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PROMPT_CATALOG } from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    if (!userRes?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: overrides } = await admin
      .from("prompt_overrides")
      .select("key, content, notes, updated_by, updated_at");

    const overrideMap = new Map((overrides || []).map((o: any) => [o.key, o]));

    const items = PROMPT_CATALOG.map((entry) => {
      const ov = overrideMap.get(entry.key);
      return {
        ...entry,
        hasOverride: !!ov,
        currentContent: ov?.content ?? entry.defaultContent,
        notes: ov?.notes ?? null,
        updatedAt: ov?.updated_at ?? null,
        updatedBy: ov?.updated_by ?? null,
      };
    });

    return new Response(JSON.stringify({ prompts: items }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "list-prompts crashed", detail: String(e).slice(0, 400) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
