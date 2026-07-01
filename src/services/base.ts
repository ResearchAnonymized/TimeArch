/**
 * Service layer base — Repository pattern.
 *
 * Every service wraps Supabase table access behind a typed surface that
 * returns `Result<T, AppError>` instead of throwing. UI components must
 * never import `supabase` directly; they go through a service.
 */
import { type PostgrestError } from "@supabase/supabase-js";
import { type AppError, err, ok, type Result } from "@/lib/result";

export function fromPostgrest(e: PostgrestError | null, fallback = "Database error"): AppError {
  if (!e) return { code: "unknown", message: fallback };
  // PGRST116 = no rows returned in `.single()`
  if (e.code === "PGRST116") return { code: "not_found", message: "Not found", cause: e };
  if (e.code === "42501") return { code: "forbidden", message: "Permission denied", cause: e };
  return { code: e.code ?? "db_error", message: e.message || fallback, cause: e };
}

/** Helper that turns a Supabase `{ data, error }` response into a `Result`. */
export function toResult<T>(data: T | null, error: PostgrestError | null): Result<T> {
  if (error) return err(fromPostgrest(error));
  if (data === null) return err({ code: "not_found", message: "Not found" });
  return ok(data);
}
