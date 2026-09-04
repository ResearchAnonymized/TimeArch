# TimeArch Brownfield Discovery — wrapped process model

**Clear title:** TimeArch Brownfield Discovery (one wrapped process)  
**Technical ID:** `MC_timearch_brownfield`  
**Avoid saying only:** “Meta-composition” — always pair with the clear title above.

**Scope:** Brownfield (Import → Recover → Change → Released → Closed).  
**Companion:** [Glossary](./GLOSSARY.md) · [Figures](./figures/README.md) · [Gallery](./gallery.html)

---

## Why this model

KERKIS asks three questions. TimeArch answers them like this:

| Question | TimeArch answer |
|----------|-----------------|
| **Who runs next?** | Linear brownfield path + human gates + bounded rework loops |
| **What is passed?** | Typed **knowledge packages** (not a chat dump) |
| **What does AI know?** | Role, Task, Rules, References injected per step |

### Principles (plain English)

1. Every piece of knowledge is a **named package** (traceable).  
2. **Workers** (code / AI / human) carry no baked-in knowledge.  
3. A **work step** binds packages to one worker and declares in/out.  
4. The **process order** follows package types + gates — not an ad-hoc chat bus.

---

## Outside view (what partners see)

```
System sources  +  Requested change
              │
              ▼
┌─────────────────────────────────────┐
│  TimeArch Brownfield Discovery      │
│  (one wrapped process)              │
└─────────────────────────────────────┘
              │
              ▼
Change Proposal · Build Plan · Agent Pack JSON · Case status
```

| Direction | Clear name | Description |
|-----------|------------|-------------|
| In | System sources | Code, docs, GitHub, or demo |
| In | Requested change | What to add or modify |
| Out | Change Proposal | Stakeholder document |
| Out | Build Plan | Engineer implementation guide |
| Out | Agent Pack JSON | Machine handoff; respect `may_implement` |
| Out | Case status | Progress / released / closed |

**Hidden inside:** parsers, inventory details, mappings, blast-radius tables, agent traces, UI screens.

---

## Inside view (steps)

| Order | Clear step name | Worker | Main output |
|------:|-----------------|--------|-------------|
| 1 | Import sources | Code + Human | Imported files |
| 2 | Recover as-is architecture | Code + Human review | System inventory |
| 3 | Analyze change | AI (+ code) | Draft handoff |
| 4 | Review decisions | Human (architect) | Go / No-go / Drop |
| 5 | Lock build guide | Human (engineer) | Approved criteria & tests |
| 6 | Assemble package | Code | Change Proposal, Build Plan, Agent Pack |
| 7 | Approve release | Human (approver) | Case status = released |
| 8 | Close case | Human + Code | Case closed / project locked |

See drawn figure: [01 — wrapped process](./figures/01-timearch-brownfield-wrapped-process.jpg)  
See drawn figure: [02 — step by step](./figures/02-brownfield-step-by-step.jpg)

---

## Workers

See [03 — Who does the work](./figures/03-who-does-the-work.jpg) and the [Glossary](./GLOSSARY.md#workers-used-in-timearch).

---

## Human review & rework

See [04 — Human review and rework](./figures/04-human-review-and-rework.jpg).

- **Go** items flow into Build Plan and Agent Pack.  
- **No-go / Drop** can re-trigger Analyze with feedback (bounded retries).  
- Coding agents implement only when Agent Pack **may implement = true**.

---

## One AI step (example)

See [05 — One AI step in detail](./figures/05-one-ai-step-in-detail.jpg).

**Map change to architecture**

| Slot | Content |
|------|---------|
| Role | Brownfield architecture mapper |
| Task | Link requested change to existing components |
| Rules | Only claim what the inventory supports |
| References | System inventory + evidence |
| Input | Requested change |
| Output | Feature–architecture mapping (with parents) |

---

## Nested wrapped process: Change analysis

See [06 — Nested change analysis](./figures/06-nested-change-analysis.jpg).

From outside, **Change analysis** is one step: inventory + requested change → Draft handoff.  
Inside: Coordinator → Dispatcher → Map / Blast-radius / Quality → Collector, with a bounded progress loop.

---

## Contract (one sentence)

> **TimeArch Brownfield Discovery** turns **system sources + a requested change** into a **gate-aware delivery package** (Change Proposal, Build Plan, Agent Pack); coding agents may implement only when the Agent Pack allows it.

---

## See also

- [Modeling README](./README.md)  
- [Glossary](./GLOSSARY.md)  
- [ChatGPT / draw.io prompt](./prompts/chatgpt-drawio.md)  
- [Brownfield user guide](../wiki/Brownfield-Discovery.md)
