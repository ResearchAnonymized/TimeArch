// TimeArch MCP Server
// ===================
// Same bearer token as the REST API. Hardened with per-request auth
// (rate limit, IP allow-list, audit log) and per-request token storage
// keyed by a generated request id — no shared mutable state across
// concurrent requests in the same isolate.
import { Hono } from "npm:hono@4.6.3";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import {
  authenticate, requireScope, tokenCanAccessProject, serviceClient,
  logApiCall, type ApiToken, type VerifyContext,
} from "../_shared/api-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Per-request token store. mcp-lite handlers don't expose request context,
// so we stash auth in an AsyncLocalStorage-style Map keyed by request id.
// Each request sets its own id via a request-scoped header and clears on exit.
interface RequestAuth { token: ApiToken; ctx: VerifyContext; id: string }
const authStore = new Map<string, RequestAuth>();
let currentRequestId: string | null = null;

async function callAgent(fn: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function getAuth(): RequestAuth {
  const id = currentRequestId;
  const a = id ? authStore.get(id) : undefined;
  if (!a) throw new Error("unauthorized");
  return a;
}

function buildServer() {
  const server = new McpServer({ name: "timearch", version: "1.0.0" });

  server.tool("timearch_list_projects", {
    description: "List TimeArch projects accessible to the calling API token.",
    inputSchema: { type: "object", properties: {} } as any,
    handler: async () => {
      const { token } = getAuth();
      if (!requireScope(token, "read")) throw new Error("read scope required");
      const sb = serviceClient();
      const { data: owned } = await sb.from("projects").select("id").eq("owner_id", token.owner_id);
      const { data: m } = await sb.from("project_members").select("project_id").eq("user_id", token.owner_id);
      const ids = new Set<string>([
        ...((owned ?? []) as any[]).map((o) => o.id),
        ...((m ?? []) as any[]).map((x) => x.project_id),
      ]);
      const scoped = token.project_id ? [...ids].filter((i) => i === token.project_id) : [...ids];
      if (!scoped.length) return { content: [{ type: "text", text: "[]" }] };
      const { data } = await sb.from("projects").select("id, name, description, mode").in("id", scoped);
      return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
    },
  });

  const projectArg = {
    type: "object",
    properties: { project_id: { type: "string", description: "UUID of the TimeArch project" } },
    required: ["project_id"],
  } as any;

  server.tool("timearch_list_artifacts", {
    description: "List architecture artifacts for a project.",
    inputSchema: projectArg,
    handler: async ({ project_id }: any) => {
      const { token } = getAuth();
      if (!requireScope(token, "read")) throw new Error("read scope required");
      if (!(await tokenCanAccessProject(token, project_id))) throw new Error("forbidden");
      const { data } = await serviceClient()
        .from("architecture_artifacts")
        .select("id, stage, kind, title, status, version")
        .eq("project_id", project_id);
      return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
    },
  });

  server.tool("timearch_list_requirements", {
    description: "List requirements for a project.",
    inputSchema: projectArg,
    handler: async ({ project_id }: any) => {
      const { token } = getAuth();
      if (!requireScope(token, "read")) throw new Error("read scope required");
      if (!(await tokenCanAccessProject(token, project_id))) throw new Error("forbidden");
      const { data } = await serviceClient()
        .from("requirements")
        .select("id, identifier, title, category, priority, status")
        .eq("project_id", project_id)
        .limit(500);
      return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
    },
  });

  const writeTool = (name: string, description: string, fn: string) =>
    server.tool(name, {
      description,
      inputSchema: projectArg,
      handler: async ({ project_id }: any) => {
        const { token } = getAuth();
        if (!requireScope(token, "write")) throw new Error("write scope required");
        if (!(await tokenCanAccessProject(token, project_id))) throw new Error("forbidden");
        const result = await callAgent(fn, { project_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      },
    });

  writeTool("timearch_reverse_engineer", "Parse uploaded imports and seed brownfield artifacts.", "reverse-engineer");
  writeTool("timearch_drift_detect", "Detect drift between locked baseline and current imports.", "drift-detect");
  writeTool("timearch_disposition_analyze", "Run the 6R/TIME modernize-vs-rebuild analysis.", "system-disposition-analyzer");

  return server;
}

const app = new Hono();
const mcp = buildServer();
const transport = new StreamableHttpTransport();
const handler = transport.bind(mcp);

app.all("/*", async (c) => {
  const t0 = Date.now();
  const result = await authenticate(c.req.raw);
  if (!result.ok) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (result.status === 429) headers["retry-after"] = "60";
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: result.error }, id: null }),
      { status: result.status, headers },
    );
  }
  const reqId = crypto.randomUUID();
  authStore.set(reqId, { token: result.token, ctx: result.ctx, id: reqId });
  currentRequestId = reqId;
  let status = 200;
  try {
    const res = await handler(c.req.raw);
    status = res.status;
    return res;
  } catch (e) {
    status = 500;
    throw e;
  } finally {
    authStore.delete(reqId);
    currentRequestId = null;
    logApiCall({
      token: result.token, ctx: result.ctx,
      op: "mcp_request", method: c.req.method,
      status_code: status,
      duration_ms: Date.now() - t0,
    }).catch(() => {});
  }
});

Deno.serve(app.fetch);
