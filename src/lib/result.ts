/**
 * Result<T, E> — explicit error channel.
 *
 * Service-layer functions return Result instead of throwing so call-sites
 * are forced to handle both success and failure paths.
 *
 * @example
 *   const res = await projectsService.get(id);
 *   if (!res.ok) return notifyError(res.error, "loading project");
 *   const project = res.value;
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Access the error of a failed Result.
 *
 * The project disables `strictNullChecks`, which prevents TypeScript from
 * narrowing discriminated unions through `if (!res.ok)`. Use this helper
 * after checking `!res.ok` to read `.error` without a TS2339.
 */
export function errorOf<E>(r: Result<unknown, E>): E {
  return (r as { ok: false; error: E }).error;
}

export interface AppError {
  /** Stable machine code, e.g. "not_found", "network", "unauthorized". */
  code: string;
  /** Human-friendly message safe to surface in a toast. */
  message: string;
  /** Optional underlying cause (kept for logs, not for UI). */
  cause?: unknown;
}

export function toAppError(input: unknown, fallbackMessage = "Something went wrong"): AppError {
  if (input && typeof input === "object" && "code" in input && "message" in input) {
    return input as AppError;
  }
  if (input instanceof Error) {
    return { code: "exception", message: input.message || fallbackMessage, cause: input };
  }
  if (typeof input === "string") {
    return { code: "exception", message: input };
  }
  return { code: "unknown", message: fallbackMessage, cause: input };
}

/** Convert a `Result` back to a thrown error — useful for react-query mutationFns. */
export function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  const failure = r as { ok: false; error: AppError };
  const e: Error & { code?: string } = new Error(failure.error.message);
  e.code = failure.error.code;
  throw e;
}
