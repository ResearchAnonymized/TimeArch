# TimeArch

A multi-agent LLM lifecycle for software architecture design and evolution.
Companion artifact to the ECSA 2026 industry-track paper of the same name.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![ECSA 2026 AE](https://img.shields.io/badge/ECSA%202026-Artifact%20Evaluation-blue)](ARTIFACT.md)
[![Replay mode](https://img.shields.io/badge/LLM__MODE-replay-green)](reproducibility/README.md)

---

## TL;DR for ECSA reviewers

```bash
git clone <this repo> timearch && cd timearch
cp .env.example .env          # LLM_MODE=replay (no API key needed)
bash scripts/smoke-test.sh    # ≤ 2 min — sanity check
bash scripts/reproduce.sh     # ≤ 30 min — full paper reproduction
```

Outputs land in `reproducibility/_out/`. See **[ARTIFACT.md](ARTIFACT.md)**
for the full AE submission (badges, claims → files mapping, limitations).

## Running the app interactively

```bash
bun install
bun run dev                   # http://localhost:5173
```

The frontend connects to Lovable Cloud with the publishable anon key in
`.env.example`. Sign in, create a project, and walk through the 18-stage
lifecycle in the workspace.

## Wiki (multi-team factory)

Planning docs and user guides — also published at https://researchanonymized.github.io/TimeArch/

- [Wiki home](docs/wiki/Home.md)
- [Getting started](docs/wiki/Getting-Started.md)
- [Brownfield discovery](docs/wiki/Brownfield-Discovery.md)
- [Software Factory Integration](docs/wiki/Software-Factory-Integration.md)
- [Diagrams](docs/wiki/Diagrams.md)
- [Software Delivery Package (SDP)](docs/wiki/Software-Delivery-Package.md)
- [Team Decisions Log](docs/wiki/Team-Decisions-Log.md)

## Repository layout

```
src/                          React + Vite frontend
supabase/functions/           Deno edge functions (one folder per agent)
supabase/migrations/          Database schema + RLS + GRANTs
public/demo/brownfield/       ShopFlow demo pack (SRS, ADRs, OpenAPI, SQL)
scripts/                      reproduce.sh, smoke-test.sh, brownfield runner
reproducibility/              Cassette, baseline, N=10 repeatability CSV
docs/ARCHITECTURE.md          High-level architecture overview
ARTIFACT.md                   ECSA 2026 AE submission document
CITATION.cff                  How to cite the paper + artifact
```

## Claims (paper) → evidence (this repo)

| Claim (paper §) | Evidence |
|---|---|
| 18-stage lifecycle across 4 phases (§3.2) | `supabase/functions/stage-*`, `prompts/` |
| Multi-agent roles Generator / Challenger / Critic / Verifier (§3.3) | `supabase/functions/_shared/agent-runtime/` |
| Weighted PostgreSQL `tsvector` RAG grounding (§3.4) | `supabase/migrations/*rag*.sql` |
| Governance engine with package-lock gate (§3.5) | `supabase/functions/_shared/package-lock.ts`, Stage 15 UI |
| Brownfield disposition (Gartner 6R ∪ TIME) (§4.3) | `supabase/functions/system-disposition-analyzer/`, baseline in `reproducibility/baseline/disposition-shopflow.json` |
| Repeatability CV ≤ 0.05 across stages (§4.2) | `reproducibility/repeatability-N10.csv` |
| Three-layer retry / iteration logic (§3.6) | `supabase/functions/_shared/agent-runtime/` (transport + repair + HITL) |
| 28 externalised prompts, editable at runtime | `prompts/`, `public.prompt_overrides`, `/prompts` UI |
| Feasibility on ITS, IoT, MoodFlow (§4.4) | `reproducibility/cases/` |

## Open Science

See [`OPEN-SCIENCE.md`](OPEN-SCIENCE.md) for the data / methods / limitations
statement, the preregistered evaluation protocol, and the raw scores used in
the paper. Persistent archive:
[Zenodo 10.5281/zenodo.20090303](https://doi.org/10.5281/zenodo.20090303).

## License

MIT — see [`LICENSE`](LICENSE). Demo data and recorded LLM outputs are
released under CC BY 4.0.

