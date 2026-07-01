/**
 * Adapter for Supabase Edge Function invocations.
 *
 * Centralises:
 *  - typed request/response generics
 *  - unified error envelope (`{ error: string }`)
 *  - basic 5xx retry with exponential backoff
 *  - structured logging
 *
 * All edge-function callers should go through `invokeFunction` instead of
 * calling `supabase.functions.invoke` directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { type AppError, err, ok, type Result, toAppError } from "@/lib/result";
import { createLogger } from "@/lib/logger";

const log = createLogger("invokeFunction");

export interface InvokeOptions {
  /** Number of retry attempts for network / 5xx failures. Default: 1. */
  retries?: number;
  /** Base backoff in ms (doubles per attempt). Default: 400. */
  backoffMs?: number;
  /** AbortSignal for caller-side cancellation. */
  signal?: AbortSignal;
}

const isRetriable = (e: AppError) =>
  e.code === "network" || e.code === "server_error" || e.code === "timeout";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function invokeFunction<TReq extends object, TRes = unknown>(
  name: string,
  body: TReq,
  opts: InvokeOptions = {},
): Promise<Result<TRes>> {
  const { retries = 1, backoffMs = 400 } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke<TRes>(name, { body });

      if (error) {
        const appErr: AppError = {
          code: "function_error",
          message: error.message || `Function ${name} failed`,
          cause: error,
        };
        log.warn(`invoke ${name} failed (attempt ${attempt + 1})`, appErr);
        if (attempt < retries && isRetriable(appErr)) {
          await sleep(backoffMs * 2 ** attempt);
          continue;
        }
        return err(appErr);
      }

      // Project convention: edge functions return HTTP 200 with `{ error }` on failure
      const maybeEnvelope = data as unknown as { error?: unknown } | null;
      if (
        maybeEnvelope &&
        typeof maybeEnvelope === "object" &&
        "error" in maybeEnvelope &&
        maybeEnvelope.error
      ) {
        const message = String(maybeEnvelope.error ?? "Unknown error");
        return err({ code: "function_error", message, cause: data });
      }

      return ok(data as TRes);
    } catch (e) {
      const appErr = toAppError(e, `Failed to call ${name}`);
      log.error(`invoke ${name} threw`, appErr);
      if (attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      return err(appErr);
    }
  }

  return err({ code: "unknown", message: `Function ${name} retries exhausted` });
}
