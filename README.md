# TimeArch

**A governed, multi-agent platform for software architecture design and evolution.**

TimeArch guides teams from heterogeneous requirements through a structured 18-stage lifecycle—requirements analysis, architecture design, validation, governance, and controlled delivery—using specialized AI agents grounded in standards (ISO 25010, AWS Well-Architected, SEI ADD) and human approval gates.

Companion open-source artifact to the ECSA 2026 Industry Track paper *TimeArch: A Multi-Agent Approach for Software Architecture Design*.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![ECSA 2026](https://img.shields.io/badge/ECSA%202026-Artifact-blue)](ARTIFACT.md)
[![Zenodo](https://img.shields.io/badge/Zenodo-10.5281%2Fzenodo.20090303-blue)](https://doi.org/10.5281/zenodo.20090303)

---

## Highlights

- **18-stage lifecycle** across four phases: Define → Design → Validate → Deliver & Evolve
- **Multi-agent orchestration** — generator, challenger, critic, and verifier roles with traceable outputs
- **RAG-grounded reasoning** — retrieval from a curated architecture knowledge base before each agent run
- **Governance by design** — stage locking, package-lock gates, and formal approval before code generation
- **Brownfield discovery** — reverse engineering, gap analysis, drift detection, and Gartner 6R / TIME disposition
- **Professional exports** — SRS, SAD, ADRs, and assessment reports (PDF / DOCX)
- **Replay mode** — deterministic LLM playback for research reproduction without API keys

---

## Quick start (macOS / Linux)

**New here?** Follow the step-by-step guide: **[docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)** (~3–4 minutes).

```bash
git clone https://github.com/ResearchAnonymized/TimeArch.git
cd TimeArch
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:8080** in your browser. Sign in (or create an account), then start a new project from the dashboard.

| Requirement | Version |
|-------------|---------|
| Node.js | 20 LTS or newer (22+ recommended) |
| npm | 10+ |
| RAM | 8 GB recommended |
| Disk | ~3 GB (including `node_modules`) |

> **Note:** Bun is optional. Use `npm install --legacy-peer-deps` to avoid peer-dependency conflicts with Vite 8.

---

## What you can do

| Workflow | Description |
|----------|-------------|
| **Greenfield project** | Paste requirements, run stages 1–18, review agent outputs, approve architecture, export documents |
| **Brownfield project** | Upload legacy artifacts (SRS, ADRs, OpenAPI, SQL), run discovery, disposition, and evolution planning |
| **Prompt library** | Inspect and edit system prompts at runtime (admin) |
| **Replay / research** | Run `bash scripts/smoke-test.sh` and `bash scripts/reproduce.sh` in `LLM_MODE=replay` — see [ARTIFACT.md](ARTIFACT.md) |

Live demo (hosted): [https://sda-assistant.com/](https://sda-assistant.com/)

---

## Configuration

Copy `.env.example` to `.env`. The frontend needs Supabase publishable credentials (included in the example for the shared demo backend):

```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=...
```

For **live LLM runs** on your own Supabase deployment, configure edge-function secrets:

```env
LLM_API_KEY=sk-...
LLM_API_BASE_URL=https://api.openai.com   # any OpenAI-compatible endpoint
```

For **artifact reproduction** only:

```env
LLM_MODE=replay
LLM_CASSETTE_PATH=./reproducibility/llm-cassette.json
```

---

## Repository layout

```
TimeArch/
├── src/                          React + Vite frontend (workspace UI)
├── supabase/
│   ├── functions/                Deno edge functions (agents, one folder each)
│   ├── migrations/               PostgreSQL schema, RLS, RAG search
│   └── functions/_shared/
│       └── prompt-defaults/      Versioned system prompts
├── public/demo/brownfield/       ShopFlow demo pack (SRS, ADRs, OpenAPI, SQL)
├── scripts/                      smoke-test.sh, reproduce.sh, brownfield runner
├── reproducibility/              LLM cassette, baseline, N=10 repeatability data
├── docs/
│   ├── GETTING-STARTED.md         Local setup guide (start here)
│   ├── ARCHITECTURE.md           Code conventions and patterns
│   └── INTEGRATIONS.md           MCP, API, external tools
├── ARTIFACT.md                   ECSA artifact evaluation guide
└── OPEN-SCIENCE.md               Open science statement
```

---

## Development commands

```bash
npm run dev          # Start dev server → http://localhost:8080
npm run build        # Production build
npm run test         # Unit tests (Vitest)
npm run lint         # ESLint
npm run preview      # Preview production build locally
```

---

## Research & citation

| Resource | Link |
|----------|------|
| Artifact evaluation | [ARTIFACT.md](ARTIFACT.md) |
| Open science / protocol | [OPEN-SCIENCE.md](OPEN-SCIENCE.md) |
| Persistent archive | [Zenodo DOI 10.5281/zenodo.20090303](https://doi.org/10.5281/zenodo.20090303) |
| Citation metadata | [CITATION.cff](CITATION.cff) |

**ECSA reviewers** — minimal reproduction path:

```bash
bash scripts/smoke-test.sh
LLM_MODE=replay bash scripts/reproduce.sh
```

Outputs are written to `reproducibility/_out/`.

---

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for code style, folder layout, and pull-request expectations.

---

## License

- **Source code:** [MIT](LICENSE)
- **Demo data & recorded LLM outputs:** CC BY 4.0

---

## Acknowledgements

Supported by Business Finland under project ANSE (1822/31/2025).
