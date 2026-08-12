# TimeArch — Reproducibility package (ECSA 2026 AE)

This directory contains everything a reviewer needs to **deterministically
reproduce every numerical claim in the TimeArch paper without an LLM API
key**.

## Contents

| File                          | Purpose                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `llm-cassette.json`           | Locked (prompt-hash → response) cassette played back when `LLM_MODE=replay`.             |
| `repeatability-N10.csv`       | Raw scores from 10 successive replays of the brownfield pipeline.                        |
| `baseline/`                   | Golden outputs of `scripts/reproduce.sh` — diffed against fresh runs to detect drift.    |
| `_out/`                       | Generated at run time by `scripts/reproduce.sh`; safe to delete.                         |

## Modes

- `LLM_MODE=replay` — **default for reviewers.** No network, no API key.
  A miss throws a clear error naming the uncovered prompt.
- `LLM_MODE=live`   — calls the Lovable AI Gateway; needs `LOVABLE_API_KEY`.
- `LLM_MODE=record` — calls live AND appends new entries to the cassette.

## Auto-bootstrap

`scripts/reproduce.sh` will **automatically bootstrap** the bundle the first
time it runs if (a) the cassette is empty *or* `baseline/` is empty, and
(b) `LOVABLE_API_KEY` is set. It runs the brownfield pipeline once in
`record` mode (the remaining 9 repeatability runs are replays against the
freshly-recorded cassette), then copies the outputs into `baseline/`.

```bash
export LOVABLE_API_KEY=sk-...
bash scripts/reproduce.sh                 # auto-bootstrap if needed
bash scripts/reproduce.sh --bootstrap     # force re-record + re-baseline
bash scripts/reproduce.sh --no-bootstrap  # never record, even if empty
```

After bootstrap, commit `reproducibility/llm-cassette.json` and
`reproducibility/baseline/` so subsequent reviewer runs work with
`LLM_MODE=replay` and zero secrets.

## How to refresh the cassette (maintainer only)

```bash
export LLM_MODE=record
export LOVABLE_API_KEY=sk-...
export LLM_CASSETTE_PATH=$PWD/reproducibility/llm-cassette.json
bash scripts/reproduce.sh
git add reproducibility/llm-cassette.json reproducibility/baseline/
```

## Mapping paper claims → artifact files

| Paper claim                                            | Reproduced by                                  |
| ------------------------------------------------------ | ---------------------------------------------- |
| 18-stage lifecycle runs end-to-end on brownfield input | `scripts/reproduce.sh` step 1                  |
| Repeatability CV ≤ 0.05 across N=10 replays            | `scripts/reproduce.sh` step 3 → `variance.json`|
| Critic verdicts cover 29148 / INCOSE / ATAM            | Outputs in `_out/run-*.json`, key `critic`     |
