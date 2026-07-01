// Shared HTTP helpers for edge functions.
// All edge functions return HTTP 200 even on logical failure (project convention),
// so callers see a stable `{ ok, data? , error? }` envelope.
//
// Usage:
//   import { handle, ok, fail, requireUser } from "../_shared/http.ts";
//   serve(handle(async (req) => {
//     const user = await requireUser(req);
//     return ok({ hello: user.id });
//   }));

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function ok<T>(data: T): Response {
  return jsonResponse({ ok: true, data });
}

export function fail(error: string, extra?: Record<string, unknown>): Response {
  // Always HTTP 200 so the client-side adapter can read `{ error }` reliably.
  return jsonResponse({ ok: false, error, ...(extra ?? {}) });
}

export type Handler = (req: Request) => Promise<Response> | Response;

/**
 * Wraps a handler with CORS preflight + last-resort error catch.
 */
export function handle(fn: Handler): Handler {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unhandled error";
      console.error("[edge-function]", message, e);
      return fail(message);
    }
  };
}
