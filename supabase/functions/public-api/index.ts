// TimeArch Public REST API
// =========================
// Bearer-token authenticated, machine-friendly façade over the agent edge
// functions. Lets external tools (CI, IDE plugins, dashboards) read project
// state and trigger brownfield/disposition runs.
//
// Auth:  Authorization: Bearer <token>      (issued at /integrations)
// Base:  POST https://<project>.functions.supabase.co/public-api
//
// Routes (selected via `?op=` or JSON body `{op}`):
//   GET  ?op=health                  → liveness
//   GET  ?op=projects                → projects the token can see
//   GET  ?op=artifacts&project=…     → architecture_artifacts for the project
//   GET  ?op=requirements&project=…  → requirements for the project
//   POST {op:"reverse_engineer", project_id}
//   POST {op:"drift_detect",     project_id}
//   POST {op:"disposition",      project_id}
//   POST {op:"webhook_test",     project_id, event?, payload?}
import { authenticate, requireScope, tokenCanAccessProject, serviceClient, logApiCall } from "../_shared/api-auth.ts";
import { dispatchWebhooks } from "../_shared/webhooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-ratelimit-limit, x-ratelimit-remaining, retry-after",
};
const json = (b: unknown, s = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, ...extra, "Content-Type": "application/json" } });


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function proxyAgent(name: string, body: unknown, ownerJwt?: string): Promise<unknown> {
  // Internal call uses the service role; we've already proven the caller can
  // access the project via the API-token check.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const authResult = await authenticate(req);
  if (!authResult.ok) {
    const headers = authResult.status === 429
      ? { "retry-after": "60", "x-ratelimit-limit": "60", "x-ratelimit-remaining": "0" }
      : {};
    return json({ error: authResult.error }, authResult.status, headers);
  }
  const { token, ctx } = authResult;

  const url = new URL(req.url);
  const qOp = url.searchParams.get("op");
  let bodyOp: string | null = null;
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); bodyOp = body?.op ?? null; } catch { /* ignore */ }
  }
  const op = qOp ?? bodyOp ?? "health";
  const sb = serviceClient();

  let res: Response;
  let projectIdForLog: string | null = null;
  try {
    switch (op) {
      case "health":
        res = json({ ok: true, token_id: token.id, scopes: token.scopes, rate_limit_per_min: token.rate_limit_per_min });
        break;

      case "projects": {
        if (!requireScope(token, "read")) { res = json({ error: "scope_required:read" }, 403); break; }
        const { data: memberships } = await sb
          .from("project_members").select("project_id").eq("user_id", token.owner_id);
        const { data: owned } = await sb
          .from("projects").select("id").eq("owner_id", token.owner_id);
        const ids = new Set<string>([
          ...((memberships ?? []) as any[]).map((m) => m.project_id),
          ...((owned ?? []) as any[]).map((p) => p.id),
        ]);
        const scoped = token.project_id ? [...ids].filter((id) => id === token.project_id) : [...ids];
        if (!scoped.length) { res = json({ items: [] }); break; }
        const { data } = await sb.from("projects").select("id, name, description, mode, created_at").in("id", scoped);
        res = json({ items: data ?? [] });
        break;
      }

      case "artifacts": {
        if (!requireScope(token, "read")) { res = json({ error: "scope_required:read" }, 403); break; }
        const projectId = url.searchParams.get("project") ?? body.project_id;
        if (!projectId) { res = json({ error: "project_id required" }, 400); break; }
        projectIdForLog = projectId;
        if (!(await tokenCanAccessProject(token, projectId))) { res = json({ error: "forbidden" }, 403); break; }
        const { data } = await sb
          .from("architecture_artifacts")
          .select("id, stage, kind, title, status, version, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });
        res = json({ items: data ?? [] });
        break;
      }

      case "requirements": {
        if (!requireScope(token, "read")) { res = json({ error: "scope_required:read" }, 403); break; }
        const projectId = url.searchParams.get("project") ?? body.project_id;
        if (!projectId) { res = json({ error: "project_id required" }, 400); break; }
        projectIdForLog = projectId;
        if (!(await tokenCanAccessProject(token, projectId))) { res = json({ error: "forbidden" }, 403); break; }
        const { data } = await sb
          .from("requirements")
          .select("id, identifier, title, description, category, priority, status")
          .eq("project_id", projectId)
          .limit(500);
        res = json({ items: data ?? [] });
        break;
      }

      case "reverse_engineer":
      case "drift_detect":
      case "disposition": {
        if (!requireScope(token, "write")) { res = json({ error: "scope_required:write" }, 403); break; }
        const projectId = body.project_id;
        if (!projectId) { res = json({ error: "project_id required" }, 400); break; }
        projectIdForLog = projectId;
        if (!(await tokenCanAccessProject(token, projectId))) { res = json({ error: "forbidden" }, 403); break; }
        const fn = op === "disposition" ? "system-disposition-analyzer" : op.replace("_", "-");
        const result = await proxyAgent(fn, { project_id: projectId });
        const event = op === "reverse_engineer" ? "reverse_engineer.completed"
                   : op === "drift_detect" ? "drift.detected"
                   : "disposition.completed";
        await dispatchWebhooks({ projectId, event, payload: { result } }).catch(() => {});
        res = json({ ok: true, op, result });
        break;
      }

      case "webhook_test": {
        if (!requireScope(token, "write")) { res = json({ error: "scope_required:write" }, 403); break; }
        const projectId = body.project_id;
        if (!projectId) { res = json({ error: "project_id required" }, 400); break; }
        projectIdForLog = projectId;
        if (!(await tokenCanAccessProject(token, projectId))) { res = json({ error: "forbidden" }, 403); break; }
        const r = await dispatchWebhooks({
          projectId,
          event: body.event ?? "custom",
          payload: body.payload ?? { test: true, ts: new Date().toISOString() },
        });
        res = json({ ok: true, ...r });
        break;
      }

      default:
        res = json({ error: `unknown_op:${op}` }, 400);
    }
  } catch (e) {
    res = json({ error: (e as Error).message }, 500);
  }

  // Best-effort audit log (don't block the response).
  logApiCall({
    token, ctx, op, method: req.method,
    project_id: projectIdForLog,
    status_code: res.status,
    error: res.status >= 400 ? `http_${res.status}` : null,
    duration_ms: Date.now() - t0,
  }).catch(() => {});

  return res;
});

