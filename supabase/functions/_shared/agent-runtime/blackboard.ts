// Shared Postgres-backed blackboard so nodes (and tools) can read/write
// working memory keyed by run_id. The executor reads its plan, partial
// findings, and notes through this layer; the critic reads the latest
// draft from here rather than re-deriving it.
import type { AdminClient } from "./trace.ts";

export class Blackboard {
  constructor(private sb: AdminClient, private runId: string) {}

  async write(key: string, value: unknown): Promise<void> {
    await this.sb.from("agent_blackboard").upsert({
      run_id: this.runId,
      key,
      value: value as object,
      updated_at: new Date().toISOString(),
    }, { onConflict: "run_id,key" });
  }

  async read<T = unknown>(key: string): Promise<T | null> {
    const { data } = await this.sb
      .from("agent_blackboard")
      .select("value")
      .eq("run_id", this.runId)
      .eq("key", key)
      .maybeSingle();
    return (data?.value ?? null) as T | null;
  }

  async all(): Promise<Record<string, unknown>> {
    const { data } = await this.sb
      .from("agent_blackboard")
      .select("key, value")
      .eq("run_id", this.runId);
    const out: Record<string, unknown> = {};
    for (const row of data ?? []) out[row.key as string] = row.value;
    return out;
  }
}
