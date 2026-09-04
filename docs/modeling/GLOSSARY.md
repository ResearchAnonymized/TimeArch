# Glossary — clear names for TimeArch components

Use the **Clear name** on slides and GitHub figures. Keep the **Technical ID** for code and schema matching.

---

## Building blocks (KERKIS)

| Clear name | Technical ID | What it means |
|------------|--------------|---------------|
| **Worker** | Actor | Who executes a step: code, AI, or human. Knows nothing by itself. |
| **Code worker** | FN | Deterministic function — same input → same output |
| **AI worker** | AG | LLM endpoint — behavior comes from injected knowledge |
| **Human worker** | HU | Person deciding via the UI |
| **Knowledge package** | Artifact | Typed, named, traceable unit of knowledge |
| **Input package** | IA_* | Knowledge TimeArch consumes |
| **Output package** | OA_* | Knowledge TimeArch produces |
| **Context package** | Role / Task / Rules / References | Shapes an AI prompt; does not “drive” the pipeline alone |
| **Work step** | Step | One worker + declared inputs/outputs/context |
| **Process** | Process | Several steps wired by matching package types |
| **Wrapped process** | Meta-composition (MC) | A whole process shown as **one** step to neighbors |

---

## Input packages (what goes into TimeArch)

| Clear name | Technical ID | Description |
|------------|--------------|-------------|
| **System sources** | `IA_sources` | GitHub repo, uploaded ZIP/docs, or demo pack |
| **Requested change** | `IA_change_intent` | Feature/requirement: current vs desired behavior |
| **Human verdicts** | `IA_human_verdicts` | Go / No-go / Drop on decisions, criteria, tests |
| **Release approvals** | `IA_gate_approvals` | Requirements · Architecture · Delivery stamps |
| **Requirements package** *(optional)* | `IA_re_package` | Upstream RE handoff in a multi-team factory |

---

## Intermediate packages (inside TimeArch only)

| Clear name | Technical ID | Description |
|------------|--------------|-------------|
| **Imported files** | `OA_imports` | Stored uploads / cloned files + status |
| **System inventory** | `OA_inventory` | As-is components, features, Mermaid diagram |
| **Feature–architecture mapping** | `OA_mappings` | Links requested change to components |
| **Blast-radius findings** | `OA_impacts` | What else is affected |
| **Draft decisions (ADRs)** | `OA_adrs` | Architecture decision records |
| **Work items** | `OA_work_items` | Implementation checklist |
| **Proposed architecture** | `OA_proposed_arch` | To-be diagram + files to touch |
| **Draft handoff** | `OA_dev_handoff` | Combined decisions, criteria, gates (pre-release) |
| **Pipeline snapshot** | `OA_pipeline_snap` | Saved state so reopen does not force re-analyze |

---

## Output packages (what neighbors see)

| Clear name | Technical ID | Audience | Description |
|------------|--------------|----------|-------------|
| **Change Proposal** | `OA_scp` | Stakeholders | Human document (PDF/DOCX): why change, as-is → to-be |
| **Build Plan** | `OA_sip` | Engineers | What to implement and how to verify |
| **Agent Pack JSON** | `OA_agent_pack` | Coding agents / CI | Machine handoff (`agent_pack.json` v4) with `may_implement` |
| **Case status** | `OA_case_status` | Dashboard / Orchestrator | Milestone phase + draft/approved/closed |

---

## Work steps (brownfield path)

| Clear name | Milestone | Worker | Consumes | Produces |
|------------|-----------|--------|----------|----------|
| **Import sources** | Import | Code + Human | System sources | Imported files |
| **Recover as-is architecture** | Recover | Code + Human review | Imported files | System inventory |
| **Analyze change** | Change · See changes | AI (+ code) | Inventory + Requested change | Draft handoff |
| **Review decisions** | Change · Decide | Human (architect) | Draft decisions | Human verdicts (Go only forward) |
| **Lock build guide** | Change · Build guide | Human (engineer) | Go decisions + criteria/tests | Approved tests / criteria |
| **Assemble package** | Change · Package | Code | Filtered handoff | Change Proposal, Build Plan, Agent Pack |
| **Approve release** | Released | Human (approver) | Package + gates | Case status = released |
| **Close case** | Closed | Human + Code | Released case | Locked project / closed status |

---

## Workers used in TimeArch

| Clear name | Kind | Examples in product |
|------------|------|---------------------|
| **Import from GitHub / upload** | Code | `fetch-github-repo`, file upload |
| **Reverse-engineer as-is** | Code | `reverse-engineer` parsers |
| **Build system inventory** | Code | Inventory + as-is Mermaid |
| **Map change to architecture** | AI | `map-feature-to-architecture` |
| **Blast-radius analysis** | AI | `analyze-ripple` |
| **Quality impact** | AI | `assess-quality-impact` |
| **Change coordinator / critic** | AI | Brownfield planner · executor · critic |
| **Assemble exports** | Code | SCP/SIP PDF, `agent_pack.json` |
| **Architect** | Human | Go / No-go / Drop on ADRs |
| **Engineer** | Human | Go / No-go on acceptance criteria & tests |
| **Approver** | Human | Release gates |

---

## Wrapped processes (names for “Meta-composition”)

Avoid saying only “Meta-composition” on slides. Prefer:

| Clear name | Technical ID | Outside sees |
|------------|--------------|--------------|
| **TimeArch Brownfield Discovery** | `MC_timearch_brownfield` | System sources + Requested change → Change Proposal, Build Plan, Agent Pack, Case status |
| **Change analysis** | `MC_change_analysis` | Inventory + Requested change → Draft handoff |

---

## Safety rule (say this on Agent Pack figures)

> Coding agents may write code **only if** Agent Pack says **may implement = true** (all human release gates passed).
