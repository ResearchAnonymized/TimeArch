# TimeArch KERKIS Meta-Composition

**Status:** Draft for ANSE-style modeling (Actor · Artifact · Step · Process)  
**Scope:** Brownfield discovery (primary). Greenfield 18-stage treated as optional nested MC.  
**Last updated:** September 2026

This document models TimeArch with the same constructs as the KERKIS / ANSE modeling workshop:

| KERKIS lens | Question |
|-------------|----------|
| **Coordination** | Who runs next? — linear SOP + human gates + bounded re-analyze / critic loops |
| **Communication** | What is passed? — **typed Artifacts** (`IA_*` / `OA_*`), not a growing chat |
| **Knowledge** | What does an agent know? — Role, Task, Constraint, Support in **context slots** |

### Four principles applied to TimeArch

1. **Every piece of knowledge is an Artifact** — typed, named, traceable (imports, inventory, ADRs, SCP, SIP, `agent_pack.json`).
2. **Actors carry no knowledge** — the same LLM endpoint can be Planner, Mapper, or Critic by changing Role/Task Artifacts.
3. **Steps bind knowledge to an Actor** — and declare what flows in and out.
4. **Processes emerge from Artifact flow** — Import → Recover → Change order follows matching subtypes + human gates; no separate ad-hoc chat bus.

---

## 1. Actors

| ID | Kind | Interface | Notes |
|----|------|-----------|-------|
| **FN_import_*** | FN | callable | `fetch-github-repo`, upload path, `fetch-demo-source` |
| **FN_reverse_engineer** | FN | callable | Parsers → as-is artifacts (needs HU confirmation) |
| **FN_inventory** | FN | callable | Build system inventory + as-is Mermaid |
| **AG_score / map / ripple / quality** | AG | endpoint | Change-analysis stages |
| **AG_bf_planner / executor / critic** | AG | endpoint | Nested brownfield multi-agent loop |
| **FN_package / handoff / scp_sip / agent_pack** | FN | callable | Deterministic assembly of human + machine exports |
| **HU_stakeholder** | HU | UI | Propose change; Requirements gate |
| **HU_architect** | HU | UI | Recover review; ADR Go/No-go/Drop |
| **HU_engineer** | HU | UI | AC/tests Go/No-go; Delivery gate |
| **HU_approver** | HU | UI | Release gates → Closed |

**Substitutable:** neighbors only see Artifact interfaces of a Step. Swapping AG for HU on a review Step does not change upstream/downstream subtypes.

---

## 2. Artifacts (typed knowledge)

### Declared inputs (what TimeArch consumes)

| Subtype | Meaning |
|---------|---------|
| **IA_sources** | GitHub repo / uploads / demo pack |
| **IA_change_intent** | Feature change (title, current/desired behavior) |
| **IA_human_verdicts** | Go / No-go / Drop on ADRs, AC, tests |
| **IA_gate_approvals** | Requirements · Architecture · Delivery stamps |
| **IA_re_package** *(optional)* | Upstream RE requirements package (factory path) |

### Intermediate (hidden inside MC)

| Subtype | Meaning |
|---------|---------|
| **OA_imports** | Stored import files + status |
| **OA_inventory** | As-is components, features, Mermaid |
| **OA_mappings** | Feature ↔ architecture mappings |
| **OA_impacts** | Blast radius / ripple findings |
| **OA_adrs** | Draft architectural decisions |
| **OA_work_items** | Implementation checklist |
| **OA_proposed_arch** | To-be Mermaid + files to touch |
| **OA_dev_handoff** | Unified handoff object (gates + scope) |
| **OA_pipeline_snap** | Restore snapshot on reopen |

### Declared outputs (what neighbors see)

| Subtype | Meaning | Audience |
|---------|---------|----------|
| **OA_scp** | Change Proposal (PDF/DOCX/MD) | Stakeholders |
| **OA_sip** | Implementation Build Plan | Engineers |
| **OA_agent_pack** | `agent_pack.json` schema v4 | Coding agents / CI |
| **OA_case_status** | Milestone phase + package status | Orchestrator / dashboard |

**Lineage rule:** every new Artifact records `parents` (e.g. `OA_agent_pack.parents ← OA_dev_handoff ← IA_change_intent + OA_inventory`).

---

## 3. Linear Process (brownfield SOP)

Order is induced by subtype matching + gates — same visual language as the workshop “linear SOP” slide.

```
FN_import → OA_imports
  → FN_reverse_engineer → OA_inventory
  → AG_change_analysis → OA_dev_handoff (draft)
  → HU_decide → IA_human_verdicts
  → HU_build_guide → (Go AC/tests)
  → FN_package → OA_scp · OA_sip · OA_agent_pack
  → HU_release → OA_case_status (Released)
  → HU_close → OA_case_status (Closed)
```

Caption: *Each Step’s inputs are the previous Step’s outputs. Human gates emit approval subtypes that unlock Released.*

### Eligibility / ordering / termination

| Rule | TimeArch meaning |
|------|------------------|
| **Eligibility** | Recover fires when `OA_imports` exists; Re-analyze when `OA_inventory` + `IA_change_intent` exist |
| **Ordering** | Producer→consumer edges from matching subtypes; Review/Build/Release wait on HU |
| **Termination** | Closed when case locked; unconsumed sinks = `OA_scp`, `OA_sip`, `OA_agent_pack` |

---

## 4. Routing and feedback (without a control-flow graph)

```
AG_change_analysis → OA_draft_handoff
  → HU_review_decisions (router: Go | No-go | Drop)
       ├─ Go → HU_build_guide → FN_package
       └─ No-go / Drop → (feedback) optional re-trigger AG_change_analysis
                         (optional_input_subtypes + iteration_limit)
```

| Mechanism | TimeArch |
|-----------|----------|
| **Routing by subtype** | Only **Go** ADRs/AC/tests enter SIP / `implement_now` |
| **Re-trigger** | **Re-analyze** recovers inventory + intent; adds new intent/edits as context |
| **Bounded** | Critic/replan loops and UI re-analyze are practical iteration limits |
| **Release router** | Gates incomplete → `implement_now.allowed = false`; all approved → may implement |

---

## 5. Example AG Step (detail)

### `AG map_feature_to_architecture`

| Slot | Content |
|------|---------|
| **Role** | Brownfield architecture mapper |
| **Task** | Map proposed change to recovered components |
| **Constraint** | Ground claims in inventory evidence |
| **Support** | OA_inventory, IA_change_intent, prior mappings |
| **Input** | `IA_change_intent` (+ inventory as support) |
| **Output** | `OA_mappings` (`parents: IA_change_intent, OA_inventory`) |

Prompt assembly: system ← Role; user ← Task + Constraint + Support + Input.  
Actor = LLM endpoint (AG). Same endpoint can play Critic by swapping Role/Task Artifacts.

---

## 6. Final Meta-composition (neighbors’ view)

### Outside (one Step)

```
IA_sources + IA_change_intent
        │
        ▼
┌───────────────────────────┐
│  MC timearch_brownfield   │
│  (one Step from outside)  │
└───────────────────────────┘
        │
        ▼
OA_scp · OA_sip · OA_agent_pack · OA_case_status
```

> From outside: **one Step**. Inputs and outputs only; internal Artifact store hidden.

### Inside (encapsulation)

```
┌─ MC timearch_brownfield ─────────────────────────────────────┐
│  IA_sources → FN_import → OA_imports                         │
│  OA_imports → FN_recover → OA_inventory                      │
│  OA_inventory + IA_change_intent → MC_change_analysis         │
│       (AG stages + optional AG planner/executor/critic loop) │
│  OA_dev_handoff → HU_decide → HU_guide → FN_exports          │
│  HU_release ↔ OA_agent_pack.authorization                    │
│  Hidden: mappings, ripple, traces, pipeline snapshots        │
└──────────────────────────────────────────────────────────────┘
```

### Nested meta-composition: `MC_change_analysis`

Treat Re-analyze as one Step from the milestone SOP’s perspective:

| Inside | Role |
|--------|------|
| AG score → map → ripple → quality → alts → plan | Linear typed pipeline |
| AG_bf_planner → FN_dispatch → AG_executor → AG_critic → FN_collect | Optional orchestrator loop with `OA_STATE` feedback + iteration_limit |
| FN_package / FN_handoff | Emit draft `OA_dev_handoff` |

---

## 7. Outer contract (one sentence)

> **TimeArch** transforms **as-is sources + change intent** into an **immutable, gate-aware delivery package** whose machine face is **`agent_pack.json`**; coding agents implement only if `authorization.may_implement` / `implement_now.allowed` is true.

---

## 8. Workshop checklist (TimeArch filled)

| Workshop step | TimeArch answer |
|---------------|-----------------|
| 1. Name the Artifacts | See §2 — `IA_sources`, `IA_change_intent`, `OA_scp`, `OA_sip`, `OA_agent_pack`, … |
| 2. Split knowledge from work | Role/Task/Constraint/Support = slots; mappings/ADRs/pack = I/O |
| 3. Choose Actor kind | FN parsers & exporters; AG analysis; HU gates |
| 4. Declare the Steps | §§3–5 |
| 5. Let subtypes wire it | SOP in §3; feedback in §4 |
| 6. Wrap it | **MC timearch_brownfield** in §6 |

**Hint check:** If we replace the LLM behind AG_map with another endpoint, does the drawing stay valid? Yes — knowledge lives in Role/Task/Support Artifacts, not in the Actor.

---

## See also

- [ChatGPT + draw.io prompt](./KERKIS-CHATGPT-PROMPT.md)
- [Mermaid figures](./KERKIS-figures.md)
- [Brownfield Discovery](../wiki/Brownfield-Discovery.md)
- [Software Delivery Package](../wiki/Software-Delivery-Package.md)
