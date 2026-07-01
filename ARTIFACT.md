# TimeArch — ECSA 2026 Artifact Evaluation Submission

**Paper**: *TimeArch: A Multi-Agent LLM Lifecycle for Software Architecture
Design and Evolution* (ECSA 2026 Industry Track)
**Artifact DOI**: *(assigned on Zenodo release of tag `v1.0-ecsa-ae`)*
**License**: MIT (code), CC BY 4.0 (data)
**Badges requested**: Publicly Shared · Documented & Functional · Reproducible Results · Reusable

---

## 1. What this artifact contains

| Layer            | Path                                                  | Purpose                                                   |
| ---------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Source snapshot  | `src/`, `supabase/functions/`, `supabase/migrations/` | Full TimeArch app (React + Vite + Supabase).         |
| Demo inputs      | `public/demo/brownfield/`                             | ShopFlow SRS, two ADRs, OpenAPI, MySQL schema.            |
| Locked LLM trace | `reproducibility/llm-cassette.json`                   | Prompt-hash → response, played back in `LLM_MODE=replay`. |
| Reproduction     | `scripts/reproduce.sh`, `scripts/smoke-test.sh`       | One-shot scripts; outputs land in `reproducibility/_out/`.|
| Baseline outputs | `reproducibility/baseline/`                           | Golden artefacts to diff against fresh runs.              |
| Repeatability    | `reproducibility/repeatability-N10.csv`               | Raw N=10 variance experiment.                             |

## 2. Reviewer requirements

- Docker 24+ **or** Node 20 + Bun ≥ 1.1
- 8 GB RAM, ~3 GB disk
- **No GPU. No API keys. No internet during reproduction** (replay mode).

## 3. Smoke test (≤ 2 minutes)

```bash
bash scripts/smoke-test.sh
```

Installs dependencies, type-checks, runs unit tests, and verifies the
cassette + demo pack exist. Exit code 0 ⇒ bundle is internally consistent.

## 4. Full reproduction (≤ 30 minutes)

```bash
cp .env.example .env          # default LLM_MODE=replay
bash scripts/reproduce.sh
```

Reproduces:

1. Brownfield pipeline end-to-end (reverse-engineer → gap → drift).
2. Repeatability experiment (10 replays → variance report).
3. Diff against `reproducibility/baseline/`.

All outputs land in `reproducibility/_out/`.

### Auto-bootstrap (maintainer convenience)

If the cassette or `reproducibility/baseline/` is empty **and**
`LLM_API_KEY` is set, `scripts/reproduce.sh` automatically runs once
in `record` mode to populate both, then promotes the run as the new
baseline. Pass `--bootstrap` to force a re-record, or `--no-bootstrap` to
disable. Reviewers without an API key never trigger this path — they get
pure `replay` behavior with a clear error if any prompt is uncovered.

## 5. Mapping paper claims → artifact

| § / Claim in paper                              | File / command                                            |
| ----------------------------------------------- | --------------------------------------------------------- |
| §3 18-stage lifecycle                           | `supabase/functions/run-agent/stages/registry.ts`         |
| §4 Multi-agent debate (Critic / Challenger)     | `supabase/functions/critic-agent/`, `run-agent/lib/challenger.ts` |
| §5 ISO 29148 / INCOSE / ATAM verdicts           | `reproducibility/_out/run-*.json` → `critic` field        |
| §6.1 Brownfield reverse-engineer + gap + drift  | `scripts/reproduce.sh` step 1                             |
| §6.3 Repeatability CV ≤ 0.05 (N=10)             | `scripts/reproduce.sh` step 3 → `variance.json`           |
| §7 Threats to validity — repeatability          | `reproducibility/repeatability-N10.csv`                   |

## 6. Reusability story

- The 18 stage handlers in `supabase/functions/run-agent/stages/handlers/`
  are independently invokable; each takes `{project_id, options}` and emits
  versioned artifacts.
- The Critic agent (`supabase/functions/critic-agent/index.ts`) accepts any
  requirement set conforming to `schemas/requirement.json` and emits a
  verdict against 29148, INCOSE, and ATAM — usable outside TimeArch.
- The replay-mode LLM wrapper (`supabase/functions/_shared/llm.ts`) is a
  drop-in pattern for other Deno/Edge-Function research artifacts that need
  deterministic playback.

## 7. Limitations & honest caveats

- **Live mode** (re-running agents against a real LLM) requires
  `LLM_API_KEY` and incurs cost. Replay mode is the default and the
  only mode the AE reviewer is expected to use.
- The cassette captures the **prompts the maintainer ran**. If a code
  change alters a prompt, replay will throw a clear miss error — this is
  by design (it surfaces drift) and is documented in
  `reproducibility/README.md`.
- Stage 14–18 outputs depend on stage 1–13 being completed; the
  brownfield demo seeds the prerequisite state automatically.
- The Supabase backend is reachable read-only with the publishable
  anon key shipped in `.env.example`. Reviewers do **not** need backend
  write access — replay mode runs the agents locally.

## 8. License

- Code: MIT (`LICENSE`)
- Demo data and recorded LLM outputs: CC BY 4.0

## 9. How to cite

See `CITATION.cff`.
