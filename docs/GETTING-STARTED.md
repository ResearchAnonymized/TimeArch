# Getting Started with TimeArch (macOS)

This guide gets TimeArch running on your Mac in about **3–4 minutes**. No prior experience with the codebase is required.

---

## What you need

| Tool | How to check | Install (if missing) |
|------|--------------|----------------------|
| **Git** | `git --version` | [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/) or `xcode-select --install` |
| **Node.js 20+** | `node --version` | [nodejs.org](https://nodejs.org/) or `brew install node@22` |
| **npm** | `npm --version` | Included with Node |

You do **not** need Docker, Bun, or an LLM API key to explore the UI. The example `.env` points at the shared Supabase backend used by the live demo.

---

## Step 1 — Get the code

```bash
git clone https://github.com/ResearchAnonymized/TimeArch.git
cd TimeArch
```

Or, if you already have the project folder:

```bash
cd ~/TimeArch   # adjust path if needed
```

---

## Step 2 — Install dependencies

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag avoids a known peer-dependency conflict between Vite 8 and some dev tools. Installation takes 1–2 minutes on a typical Mac.

**Verify** (optional):

```bash
npm run build
```

A successful build confirms the frontend compiles. You can skip this if you only want to run the dev server.

---

## Step 3 — Configure environment

```bash
cp .env.example .env
```

The copied file already contains Supabase **publishable** keys for the shared demo backend. You do not need to change anything to browse the app locally.

Open `.env` only if you:

- Point the frontend at **your own** Supabase project, or
- Run edge functions in **live LLM mode** (`LLM_API_KEY`, `LLM_API_BASE_URL` on the server side).

---

## Step 4 — Start the dev server

```bash
npm run dev
```

When Vite is ready, open:

**http://localhost:8080**

> The dev server uses port **8080** (not 5173). If the page is blank after upgrading dependencies, hard-refresh with `Cmd + Shift + R`.

Leave the terminal running while you use the app. Press `Ctrl + C` to stop the server.

---

## Step 5 — Sign in and create a project

1. On the landing page, click **Sign In** or **Start Free**.
2. **Create an account** with email and password, or use **Google** sign-in (if enabled on the backend).
3. New accounts may require **admin approval** — you will see a pending-approval screen until approved on the hosted backend.
4. From the **Dashboard**, click **New Project**.
5. Choose a mode:
   - **Greenfield** — start from requirements and walk through the full lifecycle.
   - **Brownfield** — upload existing artifacts and use the discovery pipeline.

---

## Step 6 — Walk through the lifecycle (greenfield)

After opening a project:

1. Use the **sidebar** to move through phases: Define → Design → Validate → Deliver.
2. At each stage, read the intro banner, then click **Run stage** (or the stage CTA) to invoke the agent.
3. Review structured output in the workspace panes; expand **Challenger** or **Critic** sections when present.
4. Use **Lock & advance** when you accept a stage’s output.
5. At **Stage 15 (Approval)**, complete the governance review before code-generation stages unlock.
6. Export documents from the documentation / export bars where available.

Agent calls run on the **remote Supabase backend** configured in `.env`. Your Mac only runs the React frontend.

---

## Optional — Try the brownfield demo pack

Sample files ship in `public/demo/brownfield/` (ShopFlow: SRS, ADRs, OpenAPI, SQL).

In a **brownfield** project:

1. Open **Discovery** in the sidebar.
2. Upload the demo files (or use in-app demo loaders if available).
3. Run **Reverse engineer** → **Gap analysis** → **Drift detection** → **System disposition**.

For scripted reproduction (reviewers / researchers):

```bash
# Requires demo account credentials on the hosted backend
export DEMO_EMAIL=your@email.com
export DEMO_PASSWORD=your-password
bash scripts/reproduce.sh
```

See [ARTIFACT.md](../ARTIFACT.md) for the full reproduction protocol.

---

## Troubleshooting

### Blank white screen at localhost:8080

```bash
rm -rf node_modules/.vite
npm install react-is --legacy-peer-deps
npm run dev
```

Then hard-refresh the browser (`Cmd + Shift + R`).

### `npm install` fails with ERESOLVE

Always use:

```bash
npm install --legacy-peer-deps
```

### Port 8080 already in use

```bash
lsof -ti :8080 | xargs kill -9
npm run dev
```

Or change the port in `vite.config.ts`.

### Agents fail or hang

- Confirm you are **signed in** and the project is **approved** (if required).
- The shared demo backend must be **reachable** (network required for agent runs).
- Live LLM mode needs `LLM_API_KEY` and `LLM_API_BASE_URL` set as **Supabase secrets**, not only in local `.env`.

### `npm ci` fails in smoke test

Use the install command from Step 2, then:

```bash
bash scripts/smoke-test.sh
```

---

## What to read next

| Topic | Document |
|-------|----------|
| Code layout & conventions | [ARCHITECTURE.md](ARCHITECTURE.md) |
| ECSA artifact / reproduction | [ARTIFACT.md](../ARTIFACT.md) |
| MCP & API integrations | [INTEGRATIONS.md](INTEGRATIONS.md) |
| Open science & evaluation | [OPEN-SCIENCE.md](../OPEN-SCIENCE.md) |

---

## Quick reference

```bash
# Daily development
cd TimeArch
npm run dev                    # → http://localhost:8080

# Quality checks
npm run test
npm run lint
npm run build

# Research / AE bundle
bash scripts/smoke-test.sh
LLM_MODE=replay bash scripts/reproduce.sh
```

You are ready to use TimeArch locally. For questions about the research artifact, open an issue on [GitHub](https://github.com/ResearchAnonymized/TimeArch).
