# ChatGPT / draw.io prompt — TimeArch Brownfield figures

Copy the prompt below into ChatGPT (or Claude). Prefer **clear English names** on every box; put technical IDs in parentheses only if needed.

Naming reference: [../GLOSSARY.md](../GLOSSARY.md)

---

## Prompt (copy from here)

```text
You draw KERKIS / ANSE-style architecture slides for TimeArch.

NAMING RULE (critical):
Every box must show a clear English name first.
Optional technical ID in parentheses underneath — never IDs alone.
Examples:
- "System sources (code · docs · GitHub)" not only "IA_sources"
- "TimeArch Brownfield Discovery (wrapped process)" not only "Meta-composition" or "MC_timearch_brownfield"
- "Change Proposal (for stakeholders)" not only "OA_scp"
- "Agent Pack JSON (for coding agents)" not only "OA_agent_pack"
- "Review decisions (Go / No-go)" not only "HU_decide"

Visual language:
- Navy rectangle = automated step (code or AI)
- Tan rounded rectangle = knowledge package
- Grey-blue = human decision
- Dashed tan = prompt context (Role, Task, Rules, References)
- Solid arrows = package flow
- Dashed red = rework / feedback

TimeArch outside contract:
Inputs: System sources, Requested change
Outputs: Change Proposal, Build Plan, Agent Pack JSON, Case status
Wrapped process name: TimeArch Brownfield Discovery

Inside path:
Import sources → Recover as-is architecture → Analyze change →
Review decisions → Lock build guide → Assemble package →
Approve release → Close case

Produce these 6 figures with titles, captions, Mermaid, and draw.io node lists:
1. Outside + inside wrapped process (main deliverable)
2. Step-by-step brownfield path
3. Who does the work (Code / AI / Human) with TimeArch examples
4. Human review and rework loop (Go vs No-go)
5. One AI step detail: Map change to architecture
6. Nested Change analysis (coordinator + specialists)

Also give a one-paragraph title-slide narrative in plain English.
```

---

## After generation

1. Import Mermaid into draw.io (**Arrange → Insert → Advanced → Mermaid**)  
2. Save under `docs/modeling/figures/` using the numbered clear filenames  
3. Update [figures/README.md](../figures/README.md) and [gallery.html](../gallery.html)
