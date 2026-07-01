// Shared bearer-token auth for the public REST API and MCP server.
// Tokens are issued via the app UI; we store sha256(token) and compare hashes.
// Hardening:
//   - per-token rate limit (atomic via SQL function api_check_rate)
//   - optional IP allow-list
//   - last-used at + last-used IP tracking
//   - per-call audit log written to api_call_log
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface ApiToken {
  id: string;
  owner_id: string;
  project_id: string | null;
  scopes: string[];
  rate_limit_per_min: number;
  allowed_ips: string[] | null;
}

export interface VerifyContext {
  ip: string | null;
  user_agent: string | null;
}

export interface VerifyResult {
  ok: true;
  token: ApiToken;
  ctx: VerifyContext;
}
export interface VerifyError {
  ok: false;
  status: number;
  error: string;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

function ipAllowed(ip: string | null, allow: string[] | null): boolean {
  if (!allow || allow.length === 0) return true;
  if (!ip) return false;
  // Exact match only; CIDR ranges are stored but Deno has no built-in matcher.
  // For CIDR we fall back to prefix match on the network portion.
  return allow.some((entry) => {
    if (entry === ip) return true;
    if (entry.includes("/")) {
      const [net] = entry.split("/");
      return ip.startsWith(net.replace(/\.0+$/g, ".")) || ip === net;
    }
    return false;
  });
}

/**
 * Validate a `Authorization: Bearer ta_…` header and enforce rate limit + IP allow-list.
 * Returns either `{ ok: true, token, ctx }` or `{ ok: false, status, error }`.
 */
export async function authenticate(req: Request): Promise<VerifyResult | VerifyError> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "invalid_or_missing_token" };
  }
  const raw = auth.slice(7).trim();
  if (!raw) return { ok: false, status: 401, error: "invalid_or_missing_token" };

  const hash = await sha256Hex(raw);
  const sb = serviceClient();
  const { data, error } = await sb
    .from("api_tokens")
    .select("id, owner_id, project_id, scopes, revoked_at, expires_at, rate_limit_per_min, allowed_ips")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return { ok: false, status: 401, error: "invalid_or_missing_token" };
  if (data.revoked_at) return { ok: false, status: 401, error: "token_revoked" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, status: 401, error: "token_expired" };
  }

  const ip = extractIp(req);
  const ua = req.headers.get("user-agent");

  if (!ipAllowed(ip, data.allowed_ips as string[] | null)) {
    return { ok: false, status: 403, error: "ip_not_allowed" };
  }

  // Atomic rate-limit check (per-minute bucket).
  const limit = data.rate_limit_per_min ?? 60;
  const { data: rate } = await sb.rpc("api_check_rate", { _token_id: data.id, _limit: limit });
  const row = Array.isArray(rate) ? rate[0] : rate;
  if (row && row.allowed === false) {
    return { ok: false, status: 429, error: "rate_limited" };
  }

  // Fire-and-forget last-used update.
  sb.from("api_tokens")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
    .eq("id", data.id)
    .then();

  return {
    ok: true,
    token: {
      id: data.id,
      owner_id: data.owner_id,
      project_id: data.project_id,
      scopes: data.scopes ?? [],
      rate_limit_per_min: limit,
      allowed_ips: (data.allowed_ips as string[] | null) ?? null,
    },
    ctx: { ip, user_agent: ua },
  };
}

/** @deprecated use authenticate(); kept for older callers. */
export async function verifyApiToken(req: Request): Promise<ApiToken | null> {
  const r = await authenticate(req);
  return r.ok ? r.token : null;
}

export function requireScope(token: ApiToken, scope: "read" | "write" | "admin"): boolean {
  if (token.scopes.includes("admin")) return true;
  if (scope === "read") return token.scopes.includes("read") || token.scopes.includes("write");
  if (scope === "write") return token.scopes.includes("write");
  return false;
}

/** Verify the token owner is a member (or owner) of the target project. */
export async function tokenCanAccessProject(token: ApiToken, projectId: string): Promise<boolean> {
  if (token.project_id && token.project_id !== projectId) return false;
  const sb = serviceClient();
  const { data } = await sb.rpc("is_project_member", { _user_id: token.owner_id, _project_id: projectId });
  return data === true;
}

export interface CallLogEntry {
  token: ApiToken;
  ctx: VerifyContext;
  op: string;
  method?: string | null;
  project_id?: string | null;
  status_code: number;
  error?: string | null;
  duration_ms?: number | null;
}

/** Best-effort: write one row to api_call_log. Never throws. */
export async function logApiCall(entry: CallLogEntry): Promise<void> {
  try {
    await serviceClient().from("api_call_log").insert({
      token_id: entry.token.id,
      owner_id: entry.token.owner_id,
      project_id: entry.project_id ?? null,
      op: entry.op,
      method: entry.method ?? null,
      status_code: entry.status_code,
      ip: entry.ctx.ip,
      user_agent: entry.ctx.user_agent,
      error: entry.error ?? null,
      duration_ms: entry.duration_ms ?? null,
    });
  } catch {
    // swallow
  }
}
