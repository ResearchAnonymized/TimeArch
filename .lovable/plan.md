# Empirical Validation — Experiment Ground (Sprint Plan)

## Goal
Add an in-app **Experiment Ground** that auto-runs the complete brownfield loop (map → ripple → quality → alternatives → plan+ADR) end-to-end for a chosen proposal (or mined PR) under existing guardrails, records everything, and produces a comparable report. Two evaluation tracks share the same runner:
- **Retrospective** — replay a real merged PR (auto-metrics vs. ground-truth diff)
- **Prospective** — hand-authored feature proposal (rubric-scored)

Non-goals: no new agent stages, no fine-tuning, no public-user feature (admin/dev only).

---

## Architecture (one page)

```text
Experiment Ground UI  ─▶  experiment-run edge fn  ─▶  feature_changes
   (proposals, runs,           ├─ map-feature-to-architecture
    per-stage viewer,          ├─ analyze-ripple
    rubric, report)            ├─ assess-quality-impact
                               ├─ generate-alternatives
                               └─ plan-feature-implementation (+ADR)
                        writes: experiment_runs, experiment_stage_results,
                                experiment_rubric_scores (prospective)
```

Guardrails inherited from existing stages: critic loops, JSON recovery, HTTP-200-on-error. Runner adds: per-run wall/token caps, concurrency lock (max 2/project), retry-once-then-record, partial-completion never aborts the report.

---

## Sprint 1 — Runner + data model (backend spine)

**Ships:** SQL migration, `experiment-run` edge function, one-click trigger button in Discovery workspace.

Tables (auth-only, RLS via `is_project_member`, GRANTs to `authenticated`+`service_role`):
- `experiment_proposals` (project_id, title, description, change_type, expected_hints jsonb, source, pr_number nullable, created_by)
- `experiment_runs` (project_id, proposal_id nullable, feature_change_id, track, status, wall_ms, tokens_in, tokens_out, guardrail_events jsonb, summary jsonb, started_at, finished_at)
- `experiment_stage_results` (run_id, stage_key, status, row_count, wall_ms, raw jsonb, metrics jsonb)
- `experiment_rubric_scores` (run_id, rater_user_id, dimension, score 0–3, comment)

Runner behavior:
1. Insert `feature_change` from proposal (or reuse PR-derived one)
2. Sequentially invoke the 5 loop functions; between stages record status/rows/latency
3. Timeouts: 90s per stage, 10min per run, 200k tokens
4. On stage failure: log guardrail event, continue to next stage, mark run `partial`
5. Advisory lock `pg_try_advisory_lock(hashtext('exp:'||project_id))` for concurrency

Acceptance: POST `/experiment-run` with `{project_id, proposal_id}` produces a completed run whose `experiment_stage_results` has 5 rows.

---

## Sprint 2 — Experiment Ground UI

**Ships:** `/experiments/:projectId` route (admin/owner only), three panels.

- **Proposals panel** — table + "New proposal" dialog (title, description, change_type, expected components hint). "Run once" and "Run ×3" per row.
- **Runs panel** — live-updating list; expand a row to see per-stage cards (status pill, row count, wall_ms, raw JSON viewer, guardrail events).
- **Discovery workspace** gets a small "Open Experiment Ground" button (admin only).

Acceptance: user creates a proposal, presses Run, sees stage cards fill in real time, and lands on a completed run detail view.

---

## Sprint 3 — Metrics, rubric, report

**Ships:** auto-metrics for retrospective runs, rubric drawer for prospective runs, aggregated report + CSV.

- Retrospective metrics computed server-side during the run:
  - Mapping precision/recall vs. `expected_hints.components`
  - Ripple Jaccard vs. `expected_hints.files`
  - Quality direction agreement, alternatives count, plan-task count
- Rubric drawer (prospective): 6 stage dimensions + usefulness + hallucination on 0–3 scale, Cohen's κ across raters
- **Report panel**: per-proposal aggregates (mean/median metrics, guardrail-trip rate), CSV + Markdown export

Acceptance: report shows a row per proposal with numeric metrics and export button produces a valid CSV.

---

## Sprint 4 — Batch, CLI, reproducibility, docs

**Ships:** `experiment-batch` fn, CLI commands, cassette integration, protocol doc.

- `experiment-batch` — queue N proposals × M repeats, concurrency=2
- `sdk/cli.mjs experiment {run|batch|report}`
- `scripts/reproduce.sh --experiment` re-runs last N with LLM cassette pinned
- Seed `benchmarks/proposals/petclinic.yaml` (5 proposals: additive endpoint, cross-cutting auth, schema change, caching NFR, risky ORM swap) + loader `experiment-load-proposals`
- `docs/EMPIRICAL-VALIDATION.md` — research questions, corpus, metrics formulas, threats, statistical treatment

Acceptance: single CLI command runs the full batch and produces `results.csv` reproducibly from the cassette.

---

## Defaults chosen (adjust anytime)
- Access: `admin` role only for the panel
- Caps: 10 min wall / 200k tokens per run, concurrency 2/project
- Seed: 5 PetClinic proposals shipped in Sprint 4
- Batch mode: uses live gateway; add `--cassette` flag to force cassette

---

## Kick-off
Starting **Sprint 1** now: SQL migration for the four tables + `experiment-run` edge function.
