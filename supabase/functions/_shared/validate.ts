// Zod-powered request validation for edge functions.
import { z, type ZodTypeAny } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { fail } from "./http.ts";

export { z };

/**
 * Parse a request body against a Zod schema.
 * Returns `{ ok: true, data }` on success or a ready-to-return `Response` on failure.
 */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail("Invalid JSON body") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail("Validation failed", { issues: parsed.error.flatten() }),
    };
  }
  return { ok: true, data: parsed.data };
}
