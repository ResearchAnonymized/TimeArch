// Issue a new TimeArch API token for the calling user.
// Returns the plaintext ONCE; the server stores only sha256(token).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { sha256Hex } from "../_shared/api-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (error || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "Untitled token").slice(0, 80);
    const scopes = Array.isArray(body.scopes) && body.scopes.length ? body.scopes : ["read"];
    const projectId = body.project_id ?? null;
    const expiresAt = body.expires_at ?? null;
    const rateLimit = Number.isFinite(body.rate_limit_per_min)
      ? Math.max(1, Math.min(6000, Math.floor(body.rate_limit_per_min)))
      : 60;
    const allowedIps = Array.isArray(body.allowed_ips) && body.allowed_ips.length
      ? body.allowed_ips.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 50)
      : null;

    // Generate a 32-byte random token, base64url-encoded, prefixed `ta_`.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `ta_${b64}`;
    const hash = await sha256Hex(token);
    const prefix = token.slice(0, 11);

    // Use the user-scoped client so RLS records owner_id correctly.
    const { data, error: insErr } = await sb
      .from("api_tokens")
      .insert({
        owner_id: userId, project_id: projectId, name, prefix, token_hash: hash,
        scopes, expires_at: expiresAt,
        rate_limit_per_min: rateLimit, allowed_ips: allowedIps,
      })
      .select("id, name, prefix, scopes, created_at, expires_at, rate_limit_per_min, allowed_ips")
      .single();
    if (insErr) return json({ error: insErr.message }, 400);

    return json({ token, record: data });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
