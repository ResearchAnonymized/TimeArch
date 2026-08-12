# Getting Started

How to run TimeArch locally, sign in, and pick a working mode.

---

## Quick start (reviewers / replay mode)

For ECSA artifact evaluation — no API keys required:

```bash
git clone https://github.com/ResearchAnonymized/TimeArch.git
cd TimeArch
cp .env.example .env          # LLM_MODE=replay by default
npm install
npm run dev                   # http://localhost:5173
```

Run the full reproduction bundle:

```bash
bash scripts/smoke-test.sh    # ≤ 2 min sanity check
bash scripts/reproduce.sh     # ≤ 30 min paper reproduction
```

Outputs land in `reproducibility/_out/`. See [ARTIFACT.md](../../ARTIFACT.md) for details.

---

## Running against a live backend

The frontend needs a Supabase project (cloud or local). Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / publishable key (safe in frontend) |
| `LLM_MODE` | `replay` (cassette), `live` (real LLM), or `record` |

For **live LLM** calls, also configure an API key as documented in `.env.example`.

### Local Supabase (optional)

If you run Supabase locally with Docker:

1. Start Docker Desktop.
2. Point `.env` at `http://127.0.0.1:54321` and the local anon key from `supabase status`.
3. Apply migrations: `supabase db reset` (or `supabase migration up`).
4. Serve edge functions in a second terminal: `supabase functions serve`.

Without edge functions running, imports (GitHub, reverse-engineer, agents) will fail with a non-2xx error.

---

## Sign in

| Environment | How to sign in |
|-------------|----------------|
| **Cloud** (default `.env.example`) | Your own account, or Google OAuth if enabled |
| **Local Supabase** | Email/password user created by your local seed script |

Projects belong to the account you sign in with. If you switch between cloud and local backends, you will see different project lists — that is expected.

---

## Choose Classic or Studio

After sign-in, TimeArch asks which UI you prefer (you can change later from the header):

| Mode | When to use it |
|------|----------------|
| **Classic** | You know the 18-stage lifecycle and want everything visible |
| **Studio** | You want guided, one-step-at-a-time navigation |

Both modes use the same database, agents, and exports.

---

## Create a project

1. Open the **Dashboard**.
2. Click **New project**.
3. Pick **Greenfield** (new system) or **Brownfield** (existing codebase).

| Type | Next step |
|------|-----------|
| Greenfield | Requirements intake → 18-stage Studio or Classic workspace |
| Brownfield | [Brownfield Discovery](./Brownfield-Discovery.md) — Import → Recover → Change |

---

## Common tasks

| Task | Where |
|------|-------|
| Import a GitHub repo | Brownfield → **Import** → paste repo URL |
| Reverse-engineer architecture | Brownfield → **Recover** |
| Propose a change | Brownfield → **Change** → add requirements → **Re-analyze** |
| Export for a coding agent | Change package tab → **Machine record** → download `agent_pack.json` |
| Issue API token | Settings → **Integrations** |
| Switch UI mode | Header → Classic / Studio toggle |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No projects on dashboard | Wrong Supabase URL / different account | Check `.env` matches the backend you expect; sign in with the right user |
| "Edge Function returned a non-2xx status code" | Functions not running (local) or misconfigured (cloud) | Start `supabase functions serve` locally; check Supabase logs |
| GitHub import 404 | Repo private or URL wrong | Set `GITHUB_TOKEN` in Supabase secrets for private repos |
| Old change package missing diagrams | Package created before re-analyze | Open the revision → **Re-analyze** to refresh recovered features and Mermaid sources |

---

## See also

- [Brownfield Discovery](./Brownfield-Discovery.md)
- [Software Delivery Package (SDP)](./Software-Delivery-Package.md)
- [Integrations (REST, MCP, CLI)](../INTEGRATIONS.md)
- [Home](./Home.md)
