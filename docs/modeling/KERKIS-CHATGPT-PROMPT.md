# ChatGPT / draw.io prompt — TimeArch KERKIS Meta-Composition

Copy everything below the line into ChatGPT (or Claude). Then paste the Mermaid / draw.io XML it returns into [draw.io](https://app.diagrams.net/) (**Arrange → Insert → Advanced → Mermaid**, or import `.drawio`).

---

## Prompt (copy from here)

```text
You are helping me produce KERKIS / ANSE-style modeling figures for a real product called TimeArch.

## KERKIS rules you MUST follow
Four constructs only:
1. Actor — FN (deterministic code), AG (LLM endpoint), or HU (human via UI). Actors know nothing by themselves.
2. Artifact — typed unit of knowledge: subtype, id, content, parents. Prefixes: IA_* inputs, OA_* outputs. Dashed boxes = context slots (Role, Task, Constraint, Support) that shape the prompt, they do not “drive” execution like production Artifacts.
3. Step — one executor (Actor) + declared input_subtypes, output_subtypes, context_slots. Optional: optional_input_subtypes, iteration_limit. Fires when every required input subtype has an unbound Artifact.
4. Process — one or more Steps. Order is INDUCED by Artifact subtype matching, NOT a separate control-flow graph. Cycles are feedback edges via optional_input_subtypes (bounded by iteration_limit).

Meta-composition (MC): a Process can be wrapped as one Step. From outside, neighbors see only declared IA_*/OA_*. Internal Artifact store is hidden.

Visual language (match ANSE workshop slides):
- Dark blue rounded rectangle = Step (executes), labeled FN_*, AG_*, HU_*, or MC_*
- Tan/beige rounded rectangle = production Artifact (drives execution)
- Dashed tan box = context Artifact (shapes the prompt)
- Solid arrows = Artifact flow
- Dashed red arrows = feedback / re-trigger
- Grey-blue Step = Human Actor
- Gold circle AG / dark circle FN / grey circle HU when showing Actor kinds

## TimeArch system to model (brownfield — primary)

Outer process milestones:
Import → Recover → Change → Released → Closed

Inside Change:
See changes (analyze) → Review decisions (Go/No-go/Drop) → Build guide (AC/tests) → Change package (SCP, SIP, agent_pack.json)

Key Actors:
- FN_import (GitHub/upload/demo), FN_reverse_engineer, FN_inventory
- AG_score, AG_map, AG_ripple, AG_quality (and optional AG planner/executor/critic loop)
- FN_handoff, FN_scp_sip, FN_agent_pack
- HU_architect (ADR verdicts), HU_engineer (AC/tests), HU_approver (release gates)

Key Artifacts:
- IA_sources, IA_change_intent, IA_human_verdicts, IA_gate_approvals
- OA_imports, OA_inventory, OA_mappings, OA_impacts, OA_adrs, OA_dev_handoff
- OA_scp (Change Proposal), OA_sip (Build Plan), OA_agent_pack (machine JSON v4 with authorization.may_implement + implement_now), OA_case_status

Outer MC contract:
MC_timearch_brownfield
  inputs:  IA_sources, IA_change_intent
  outputs: OA_scp, OA_sip, OA_agent_pack, OA_case_status
Hidden inside: parsers, inventory, analysis agents, Go/No-go UI, traces.

Principles to print on figures where relevant:
- Every piece of knowledge is an Artifact
- Actors carry no knowledge
- Steps bind knowledge to an Actor
- Processes emerge from Artifact flow
- Agents only implement when OA_agent_pack.authorization.may_implement is true

## Deliverables — produce ALL of these

For EACH figure:
A) A short title + 2–4 bullet caption (workshop style)
B) Valid Mermaid that draw.io can import
C) A textual node/edge list for redrawing by hand in draw.io if Mermaid fails
D) Keep labels short; use the exact subtype names above

### Figure 1 — KERKIS lenses for TimeArch
Three columns: Coordination / Communication / Knowledge applied to TimeArch (linear+gates+loops; typed Artifacts; Role/Task/Constraint/Support).

### Figure 2 — Four constructs, one execution model
Show: Artifact A_REQ-style flow into a Step with AG Actor on top and Role/Task context below; output Artifact; then “…or a whole Process” nesting note. Map labels to TimeArch (e.g. IA_change_intent → AG Step → OA_adrs).

### Figure 3 — Actor kinds used in TimeArch
Three columns FN / AG / HU with TimeArch examples; bottom banners: Substitutable; Decoupling from knowledge.

### Figure 4 — Detail: one AG Step (map_feature_to_architecture)
Like the workshop “AG produce_adrs” slide: context slots Role/Task/Constraint/Support; input IA_change_intent; prompt assembly; AG endpoint; output OA_mappings with parents.

### Figure 5 — Linear SOP Process (brownfield)
Horizontal: FN_import → OA_imports → FN_recover → OA_inventory → AG_analyze → OA_dev_handoff → HU_decide → HU_guide → FN_package → OA_scp/OA_sip/OA_agent_pack → HU_release → OA_case_status
Caption: order follows matching subtypes + gates.

### Figure 6 — Routing & feedback without control-flow graph
AG_analyze → OA_draft → HU_review (router: Go | No-go) → Go path to FN_package; No-go dashed red feedback re-triggers AG_analyze via optional_input; note iteration_limit; release gate sets may_implement.

### Figure 7 — FINAL Meta-composition (most important)
TOP: outside view — IA_sources + IA_change_intent → MC_timearch_brownfield → OA_scp · OA_sip · OA_agent_pack · OA_case_status
BOTTOM: inside dashed box — Import, Recover, MC_change_analysis (AG pipeline + optional critic loop), HU gates, FN exports; mark hidden internals; show OA_STATE-style feedback only inside analysis if needed.
Right-side bullets: Executor=Actor or Process; Encapsulation; Hierarchy for free; Neighbors only see Artifact interface.

### Figure 8 — Optional nested orchestrator (change analysis)
MC_change_analysis as one Step from outside emitting OA_dev_handoff; inside AG_orchestrator / FN_dispatch / AG_map|ripple|quality / FN_collect / OA_STATE loop with iteration_limit — same pattern as workshop “release_orchestration”.

## Output format
- Use markdown headings Figure 1 … Figure 8
- Under each: Caption, then ```mermaid``` block, then “Draw.io checklist” bullets
- After all figures: give a single “Master narrative” paragraph I can put on a title slide: “TimeArch as KERKIS meta-composition”
- Do NOT invent greenfield 18-stage detail unless as a one-line nested MC note
- Do NOT replace typed Artifacts with chat transcripts
```

---

## How to use the output in draw.io

1. Open https://app.diagrams.net/
2. **Arrange → Insert → Advanced → Mermaid** (or **Extras → Edit Diagram** and paste if using Mermaid plugin)
3. Paste one figure’s Mermaid at a time
4. Restyle to match workshop colors:
   - Steps: fill `#1e3a5f`, font white
   - Artifacts: fill `#e8d4b0`
   - Context slots: dashed stroke, fill `#f5ebe0`
   - HU steps: fill `#6b7c93`
   - Feedback: red dashed connectors
5. Export PNG/SVG for slides; save `.drawio` into `docs/modeling/drawio/`

## After ChatGPT

Paste refined figures back into this repo:

- Update `KERKIS-figures.md` Mermaid blocks
- Save draw.io files under `docs/modeling/drawio/`
- Commit and push

## Shorter prompt (if token-limited)

If the model truncates, send:

> Using the KERKIS Actor/Artifact/Step/Process rules, draw **only Figure 7 — Meta-composition for MC_timearch_brownfield** with outside view and inside view. Inputs: IA_sources, IA_change_intent. Outputs: OA_scp, OA_sip, OA_agent_pack, OA_case_status. Inside: Import → Recover → AG analysis → HU Go/No-go → FN package → HU release. Return Mermaid + draw.io node list.
