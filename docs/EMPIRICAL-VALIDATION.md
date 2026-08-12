# Empirical Validation Plan — TimeArch Brownfield Loop

This document defines how we evaluate TimeArch's brownfield discovery loop
(Mapping → Ripple → Quality → Alternatives → Plan/ADR) using the built-in
**Experiment Ground** (`/experiments/:projectId`).

## Research Questions

- **RQ1 — Feasibility.** Can the loop complete end-to-end for representative
  change proposals within acceptable wall-clock time and without guardrail
  trips?
- **RQ2 — Accuracy.** How closely does the loop's output match human-authored
  ground truth for component mapping, ripple set, and quality-attribute
  direction?
- **RQ3 — Usefulness.** Do expert raters judge the generated alternatives,
  ADRs and work plans as actionable (rubric ≥ 2/3 on Usefulness) with low
  hallucination (rubric ≥ 2/3 on Hallucination)?
- **RQ4 — Stability.** How consistent are results across `N` repeated runs of
  the same proposal (variance in F1, Jaccard, wall time)?

## Corpus

Seed corpus lives in [`docs/experiments/seed-proposals.json`](./experiments/seed-proposals.json)
and is loaded into any project from the Experiment Ground's **Load seed corpus**
button. Five proposals cover the four `change_type`s (`add`, `modify`,
`remove`, `migrate`) across a Spring PetClinic-shaped codebase.

Each proposal carries `expected_hints`:

| Field        | Type                              | Used by            |
| ------------ | --------------------------------- | ------------------ |
| `components` | `string[]`                        | Mapping precision/recall/F1 |
| `files`      | `string[]`                        | Ripple Jaccard      |
| `qualities`  | `{attribute, direction}[]`        | Quality direction-agreement |

## Metrics

Computed automatically by the `experiment-run` edge function after every run
and persisted on `experiment_stage_results.metrics`.

- **Mapping** — precision, recall, F1 vs. `hints.components`.
  `F1 = 2·P·R / (P+R)`; report macro-mean over the corpus.
- **Ripple** — Jaccard index vs. `hints.files`.
  `J = |A ∩ B| / |A ∪ B|`.
- **Quality** — direction agreement rate: fraction of `hints.qualities` whose
  `(attribute, direction)` pair appears in the generated assessments.
- **Alternatives** — count + `recommended` count (descriptive only, no ground
  truth).
- **Plan** — work-item count and `has_adr` flag.
- **Wall time** — per-stage `wall_ms` and per-run total. Runs also record
  `guardrail_events` (per-stage timeouts, empty outputs, HTTP errors).

## Rubric (Prospective)

Eight dimensions scored 0–3 in the Experiment Ground's `RubricDrawer`:

| Dimension       | 0 – Unusable          | 1 – Partial          | 2 – Useful           | 3 – Excellent               |
| --------------- | --------------------- | -------------------- | -------------------- | --------------------------- |
| Mapping         | Wrong components      | Some misses          | Mostly right         | Precise + no false hits     |
| Ripple          | Missing critical hops | Coarse but useful    | Right files          | Right files + reasoning     |
| Quality         | Wrong directions      | Some right           | Directions right     | Directions + magnitudes     |
| Alternatives    | Only one option       | Options overlap      | Clear tradeoffs      | Tradeoffs + fit rationale   |
| ADR             | Missing / boilerplate | Context only         | Context + decision   | Full ADR incl. consequences |
| Plan            | Vague tasks           | Tasks w/o order      | Ordered, sized       | Ordered, sized, ADR-linked  |
| Usefulness      | Not actionable        | Some hints           | Actionable overall   | Ready to hand to a dev      |
| Hallucination   | Fabricates freely     | Occasional fake refs | Rarely fabricates    | No fabricated references    |

Inter-rater reliability: report Cohen's κ per dimension once ≥ 2 raters
score the same run.

## Protocol

1. **Setup.** Load seed corpus into a fresh project that has completed
   brownfield import (repo + parsed feature_mappings).
2. **Batch run.** From the Experiment Ground, "Run all × 3" to generate 15
   runs (5 proposals × 3 repeats).
3. **Rubric.** Two raters independently score every completed run.
4. **Export.** Download aggregate CSV from the Report panel and rubric CSV
   from the drawer for offline analysis.
5. **Analyze.** Report mean ± 95% CI per metric; use Wilcoxon signed-rank
   for paired comparisons across model / prompt variants.

## Guardrails (Threats to Validity)

- **Per-stage timeout** 90s, **per-run timeout** 130s; a stage that trips is
  recorded as `stage_error` in `guardrail_events` and metrics for that stage
  are omitted from aggregates.
- **Empty outputs** are recorded as `stage_empty` so partial runs do not
  silently inflate downstream stages.
- **Model drift.** Runs record model + prompt version in
  `experiment_runs.summary`; re-run baselines after any prompt change.
- **Corpus bias.** Seed corpus is Spring PetClinic-shaped; broaden with
  additional projects before publishing external claims.
- **Ground-truth authorship.** `expected_hints` are hand-authored by the
  TimeArch team; validation on independent projects requires fresh hints.

## Reporting

For a report-ready extract, use the Experiment Ground's **Report CSV** to
produce `report.csv` with one row per proposal and columns:
`run_count, completed, partial, failed, mean_wall_ms, guardrail_trip_rate,
mapping_f1, ripple_jaccard, quality_direction, plan_task_mean`.

Rubric raw scores export as `rubric.csv` (one row per `run × rater × dimension`),
and the report panel renders **Cohen's κ** per dimension whenever ≥ 2 raters
have overlapping scored runs (interpretation follows Landis & Koch 1977).

## Headless / CLI

The `sdk/cli.mjs` wrapper adds three `experiment` subcommands so batches can
run outside the browser (CI, artifact evaluation):

```bash
export TIMEARCH_JWT=<supabase-user-jwt>   # from Dev Tools → Application → localStorage
node sdk/cli.mjs experiment run    <projectId> <proposalId>
node sdk/cli.mjs experiment batch  <projectId> <p1,p2,p3> 3   # 3 repeats
node sdk/cli.mjs experiment report <projectId>                # dumps runs JSON
```

The reproduction script also accepts `--experiment=<projectId>` to append a
full Experiment Ground batch after the brownfield replay:

```bash
TIMEARCH_JWT=… bash scripts/reproduce.sh --experiment=<projectId>
```



## Retrospective track — real merged-PR oracle

The prospective track scores runs against hand-authored `expected_hints` (which
we wrote), so reviewers may reasonably question ground-truth bias. The
**retrospective track** eliminates that concern by using the file list of a
real merged pull request as ground truth:

1. Open a proposal in Experiment Ground.
2. Paste the PR URL (e.g. `https://github.com/spring-projects/spring-petclinic/pull/1234`)
   into the "Link merged PR" input and click **Link PR**.
3. The `experiment-link-pr` edge function calls the GitHub REST API, downloads
   the PR's file list, and merges it into `expected_hints.files`. Existing
   ripple-Jaccard and mapping-kernel matching pick it up unchanged.
4. Toggle **Retrospective** in the Proposals card header and click **Run all**.
5. Runs are stored with `experiment_runs.track = 'retrospective'` so the report
   can split metrics per track.

Public repos need no setup; add a `GITHUB_TOKEN` secret for private repos or
higher rate limits.

## Paper figures

Export **Runs CSV** (per-run rows including `track`) and **Rubric CSV** from
the Report panel, then generate publication-ready SVG figures with the
zero-dependency plotting script:

```bash
node scripts/plot-experiments.mjs \
  --runs=reproducibility/baseline/runs.csv \
  --rubric=reproducibility/baseline/rubric.csv \
  --out=docs/figures
```

Emitted artifacts:

| File                          | Content                                             |
| ----------------------------- | --------------------------------------------------- |
| `metrics-by-track.svg`        | Mean F1 / Jaccard / direction, prospective vs retro |
| `walltime-by-track.svg`       | Per-run wall-time box plot by track                 |
| `rubric-summary.svg`          | Mean score + Cohen's κ per rubric dimension         |
| `experiment-summary.json`     | Machine-readable stats bundle for LaTeX tables      |

Include in LaTeX with `\includegraphics{figures/metrics-by-track.svg}` (via
`svg` package) or rasterize with `rsvg-convert -a fig.svg -o fig.png`.


