# Open Science Statement — TimeArch

This document accompanies the ECSA 2026 submission of **TimeArch** and is
intended for the ECSA Open Science Track and the Artifact Evaluation
committee. It states, in one place, what is open, how the evaluation was
conducted, and what its limits are.

## 1. What is open

| Asset | License | Location |
|---|---|---|
| Source code (frontend + edge functions) | MIT | this repository |
| 28 system prompts | CC BY 4.0 | `prompts/` |
| ShopFlow brownfield demo pack (SRS, ADRs, OpenAPI, SQL) | CC BY 4.0 | `public/demo/brownfield/` |
| LLM cassette (SHA-256 keyed request/response log) | CC BY 4.0 | `reproducibility/llm-cassette.json` |
| Repeatability dataset (N=10) | CC BY 4.0 | `reproducibility/repeatability-N10.csv` |
| Golden brownfield baseline | CC BY 4.0 | `reproducibility/baseline/` |
| Persistent archive (versioned) | — | Zenodo DOI `10.5281/zenodo.20090303` |

## 2. Preregistered evaluation protocol

1. **Subjects.** Three case studies from the paper (ITS, IoT monitoring,
   MoodFlow) plus the ShopFlow brownfield baseline.
2. **Procedure.** For each case, run `scripts/reproduce.sh` in `replay` mode.
   For repeatability, run each stage 10× in `live` mode against
   `gemini-2.5-flash` with `temperature=0.2` and record artifact hashes,
   token counts, and Critic verdicts.
3. **Metrics.**
   - *Fidelity* — diff of produced artifacts vs. `reproducibility/baseline/`.
   - *Repeatability* — coefficient of variation (CV) of Critic scores across
     the 10 runs (target CV ≤ 0.05).
   - *Governance* — count of blocked stage transitions when the package-lock
     seal is absent (target: 100 % of stages ≥ 16 blocked).
4. **Rubric.** ISO/IEC 29148 + INCOSE requirement quality + ATAM sensitivity /
   trade-off tagging. Rubric text is in `prompts/critic-*`.

## 3. Reproducibility modes

- `LLM_MODE=replay` (default) — deterministic replay of the shipped cassette,
  no network, no API key. Used by AE reviewers.
- `LLM_MODE=record` — re-runs the pipeline live and refreshes the cassette.
- `LLM_MODE=live` — free exploration with a user-supplied `LLM_API_KEY`.

## 4. Threats to validity and limitations

- **Model drift.** Repeatability numbers are pinned to Gemini 2.5 Flash / Pro
  as of the paper's cut-off. Other providers work via `src/lib/llm-catalog.ts`
  but are not part of the reported baseline.
- **Case coverage.** The cassette only covers the three cases in the paper;
  novel domains require `live` mode.
- **Human-in-the-loop.** Governance gates (Stage 15 seal, code-generation
  gate) require a human approver — the automated reproduction stops at the
  gate and records the decision that a human made in the paper's run.
- **Anonymity.** This repository is the anonymised mirror used for
  double-blind review. Author names and affiliations are withheld until
  acceptance; the Zenodo record is versioned accordingly.

## 5. Ethics and data

No personal data is included. Demo SRS documents were synthesised for the
paper. LLM responses in the cassette are model outputs, not user data.

## 6. How to cite

See `CITATION.cff`. Please cite both the paper and the Zenodo archive.
