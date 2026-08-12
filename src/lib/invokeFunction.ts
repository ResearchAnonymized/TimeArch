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
import { FunctionsHttpError } from "@supabase/supabase-js";
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

/** Prefer the real edge-function body over the generic "non-2xx" message. */
async function messageFromFunctionsError(error: unknown, fallback: string): Promise<string> {
  try {
    if (error instanceof FunctionsHttpError && error.context) {
      const ctx = error.context as Response;
      if (typeof ctx?.json === "function") {
        const body = await ctx.clone().json();
        if (body && typeof body === "object") {
          const rec = body as Record<string, unknown>;
          if (typeof rec.error === "string" && rec.error.trim()) return rec.error.trim();
          if (typeof rec.message === "string" && rec.message.trim()) return rec.message.trim();
        }
      }
      if (typeof ctx?.text === "function") {
        const text = (await ctx.clone().text()).trim();
        if (text && !text.startsWith("<")) return text.slice(0, 400);
      }
    }
  } catch {
    /* ignore parse failures */
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: unknown }).message || "").trim();
    if (msg && msg !== "Edge Function returned a non-2xx status code") return msg;
  }
  return fallback;
}

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
        const detail = await messageFromFunctionsError(
          error,
          error.message || `Function ${name} failed`,
        );
        // Friendly hint when local edge runtime is down
        const message =
          /name resolution failed|Failed to send|fetch failed|ECONNREFUSED/i.test(detail)
            ? `Local Edge Functions are not running. In a terminal run: npm run functions:serve`
            : detail;

        const appErr: AppError = {
          code: "function_error",
          message,
          cause: error,
        };
        log.warn(`invoke ${name} failed (attempt ${attempt + 1})`, appErr);
        if (attempt < retries && isRetriable(appErr)) {
          await sleep(backoffMs * 2 ** attempt);
          continue;
        }
        return err(appErr);
      }

      // Project convention: edge functions may return HTTP 200 with `{ error }` on failure
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
