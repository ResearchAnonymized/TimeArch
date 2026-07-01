// Supabase client factories for edge functions.
// Keep this the single source of `createClient(...)` calls so we can swap
// SDK versions or add instrumentation in one place.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL) throw new Error("SUPABASE_URL not set");

/** Service-role client. Bypasses RLS. Use for trusted server work only. */
export function getServiceClient(): SupabaseClient {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** User-scoped client that respects RLS using the caller's JWT. */
export function getUserClient(authHeader: string | null): SupabaseClient {
  if (!ANON_KEY) throw new Error("SUPABASE_ANON_KEY not set");
  return createClient(SUPABASE_URL!, ANON_KEY, {
    global: { headers: { Authorization: authHeader ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve the authenticated user from the request, or return null. */
export async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const client = getUserClient(auth);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Require an authenticated user — throws if missing. Use inside `handle()`. */
export async function requireUser(req: Request) {
  const user = await getUser(req);
  if (!user) throw new Error("Unauthorized");
  return user;
}
