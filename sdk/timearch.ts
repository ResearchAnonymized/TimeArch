/**
 * TimeArch SDK — minimal TypeScript client for the public REST API.
 *
 * Usage:
 *   import { TimeArch } from "./sdk/timearch";
 *   const t = new TimeArch({ token: process.env.TIMEARCH_TOKEN! });
 *   const projects = await t.listProjects();
 *   await t.disposition(projects[0].id);
 *
 * Works in Node ≥18, Deno, Bun, and modern browsers (uses global `fetch`).
 */
export interface TimeArchOptions {
  /** Bearer API token issued at /integrations. */
  token: string;
  /** Override the default project URL (e.g. for self-hosted deployments). */
  baseUrl?: string;
}

const DEFAULT_BASE = "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/public-api";

export class TimeArch {
  constructor(private readonly opts: TimeArchOptions) {}

  private async call<T>(init: { op: string; method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> }): Promise<T> {
    const base = this.opts.baseUrl ?? DEFAULT_BASE;
    const method = init.method ?? (init.body ? "POST" : "GET");
    const qs = new URLSearchParams({ op: init.op, ...(init.query ?? {}) }).toString();
    const url = `${base}?${qs}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.token}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify({ op: init.op, ...(init.body as object) }) : undefined,
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    if (!res.ok || parsed?.error) {
      throw new Error(`TimeArch ${init.op} failed (${res.status}): ${parsed?.error ?? text}`);
    }
    return parsed as T;
  }

  health() { return this.call<{ ok: boolean; token_id: string; scopes: string[] }>({ op: "health" }); }
  listProjects() { return this.call<{ items: any[] }>({ op: "projects" }).then((r) => r.items); }
  listArtifacts(projectId: string) {
    return this.call<{ items: any[] }>({ op: "artifacts", query: { project: projectId } }).then((r) => r.items);
  }
  listRequirements(projectId: string) {
    return this.call<{ items: any[] }>({ op: "requirements", query: { project: projectId } }).then((r) => r.items);
  }
  reverseEngineer(projectId: string) { return this.call({ op: "reverse_engineer", body: { project_id: projectId } }); }
  driftDetect(projectId: string)     { return this.call({ op: "drift_detect",     body: { project_id: projectId } }); }
  disposition(projectId: string)     { return this.call({ op: "disposition",      body: { project_id: projectId } }); }
}
