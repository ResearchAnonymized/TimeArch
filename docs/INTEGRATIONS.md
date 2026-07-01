# TimeArch — External Tool Access

TimeArch exposes its agents and project data to external tools through four
complementary surfaces. All four share a single auth model: **bearer API
tokens** issued in-app at `/integrations`.

| Surface | Best for | Endpoint |
| --- | --- | --- |
| **REST API** | CI pipelines, scripts, dashboards, custom UIs | `POST /functions/v1/public-api` |
| **MCP server** | IDE assistants (Cursor, Claude Desktop, Lovable) | `POST /functions/v1/mcp-server` |
| **CLI / SDK**  | Local automation, ad-hoc terminal use | `sdk/cli.mjs`, `sdk/timearch.ts` |
| **Webhooks**   | Push events into Jira, Slack, GitHub, n8n | Configured per-project |

Base origin:
```
https://yyqbxzcjnpsijkjbfjcg.supabase.co
```

---

## 1 · Issue an API token

1. Sign in to TimeArch.
2. Open **Settings → Integrations** (`/integrations`).
3. Click **Issue token**, choose a name and scopes (`read`, `write`, `admin`),
   optionally scope it to a single project.
4. The plaintext token is shown **once** (`ta_…`). Store it in your secret
   manager — TimeArch only keeps the SHA-256 hash.

Revoke at any time from the same screen.

## 2 · REST API

Single endpoint, op-routed:

```http
POST https://<project>.functions.supabase.co/public-api
Authorization: Bearer ta_…
Content-Type: application/json

{ "op": "disposition", "project_id": "<uuid>" }
```

| op | Method | Scope | Notes |
| --- | --- | --- | --- |
| `health` | GET | read | Returns token id and scopes. |
| `projects` | GET | read | Projects the token can see. |
| `artifacts` | GET `?project=` | read | Architecture artifacts. |
| `requirements` | GET `?project=` | read | Project requirements. |
| `reverse_engineer` | POST | write | Re-parse uploaded imports. |
| `drift_detect` | POST | write | Diff baseline vs current imports. |
| `disposition` | POST | write | Run 6R/TIME analysis. |
| `webhook_test` | POST | write | Fire a test event to configured endpoints. |

Errors always come back as `{ "error": "<reason>" }`.

## 3 · MCP server

For MCP-compatible clients. Example config for Cursor / Claude Desktop:

```json
{
  "mcpServers": {
    "timearch": {
      "url": "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/mcp-server",
      "headers": { "Authorization": "Bearer ta_…" }
    }
  }
}
```

Tools exposed:
- `timearch_list_projects`
- `timearch_list_artifacts({ project_id })`
- `timearch_list_requirements({ project_id })`
- `timearch_reverse_engineer({ project_id })`
- `timearch_drift_detect({ project_id })`
- `timearch_disposition_analyze({ project_id })`

## 4 · CLI / SDK

```bash
export TIMEARCH_TOKEN=ta_…
node sdk/cli.mjs projects
node sdk/cli.mjs disposition <projectId>
```

Or programmatically:

```ts
import { TimeArch } from "./sdk/timearch";
const t = new TimeArch({ token: process.env.TIMEARCH_TOKEN! });
const [p] = await t.listProjects();
await t.disposition(p.id);
```

## 5 · Webhooks

Configure per-project endpoints in `/integrations`. Each delivery includes:

```
POST <your-url>
X-TimeArch-Event:     disposition.completed
X-TimeArch-Timestamp: 1730000000          # seconds since epoch
X-TimeArch-Signature: sha256=<hex>
Content-Type:         application/json

{ "event": "...", "project_id": "...", "sent_at": "...", "data": { ... } }
```

Verify deliveries by:

1. Rejecting requests where `|now − X-TimeArch-Timestamp| > 300` seconds
   (replay-attack window).
2. Computing `HMAC-SHA256(secret, "${timestamp}.${body}")` and comparing the
   hex digest to `X-TimeArch-Signature` in constant time.

Events currently emitted:

- `reverse_engineer.completed`
- `drift.detected`
- `disposition.completed`
- `custom` (via `webhook_test`)

All deliveries — success and failure — are logged in `webhook_deliveries`
and visible in the UI.

## 6 · Security model

- Tokens are stored as SHA-256 hashes; plaintext is never persisted.
- Project access is enforced via `is_project_member` on every call, even when
  the token is `admin`-scoped.
- Tokens can be project-scoped, expire on a fixed date, and be revoked
  instantly.
- Each token has a **per-minute rate limit** (default 60 req/min) enforced
  atomically in PostgreSQL via `api_check_rate`. Exceeding it returns
  HTTP 429 with `retry-after: 60`.
- Tokens may be locked to one or more **IPs or CIDR ranges**; non-matching
  callers get HTTP 403 `ip_not_allowed`.
- Every call is recorded in `api_call_log` (op, status, IP, latency) so you
  can audit usage and revoke compromised tokens quickly.
- Webhook payloads are signed **and timestamped** to prevent replay attacks;
  treat the signing secret like a password.

