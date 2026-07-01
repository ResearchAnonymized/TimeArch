/**
 * Generic query hook over a `Result`-returning service call.
 * Bridges the Result world to react-query's thrown-error world.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { unwrap, type Result } from "@/lib/result";

export function useResultQuery<T>(
  key: readonly unknown[],
  fn: () => Promise<Result<T>>,
  options?: Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error>({
    queryKey: [...key],
    queryFn: async () => unwrap(await fn()),
    ...options,
  });
}
