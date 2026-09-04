# TimeArch Wiki

**Live site (GitHub Pages):** https://researchanonymized.github.io/TimeArch/

**Interactive diagrams:** https://researchanonymized.github.io/TimeArch/wiki/diagrams.html

---

## What is TimeArch?

TimeArch is a multi-agent lifecycle for **software architecture design and evolution**. It helps teams move from requirements and existing code to architecture decisions, change packages, and implementation handoffs — with human gates at every critical step.

Use this wiki for:

- **Running the app** and understanding the two UI modes (Classic vs Studio)
- **Brownfield discovery** — import an existing system, recover its architecture, and produce a change package
- **Multi-team integration** — how Requirements Engineering, TimeArch, and Coding tools connect through an Orchestrator

---

## Start here

| If you want to… | Read |
|-----------------|------|
| Run TimeArch locally and sign in | [Getting Started](./Getting-Started.md) |
| Work with an existing codebase (brownfield) | [Brownfield Discovery](./Brownfield-Discovery.md) |
| Hand off to a coding agent or CI pipeline | [Software Delivery Package (SDP)](./Software-Delivery-Package.md) |
| Plan integration with RE and Coding teams | [Software Factory Integration](./Software-Factory-Integration.md) |
| Present diagrams in a meeting | [Diagrams (interactive)](./diagrams.html) |

---

## Two ways to work in the app

TimeArch offers **two UI experiences** over the same agents, data, and artifacts. Switch anytime from the header.

| Mode | Best for | What you see |
|------|----------|--------------|
| **Classic** | Power users | Full 18-stage sidebar, requirements, agents, and artifacts on one canvas |
| **Studio** | Guided walkthrough | One stage at a time, primary action up front, advanced tools in a drawer |

Both modes support **greenfield** (new system, 18-stage lifecycle) and **brownfield** (import → recover → change).

---

## Brownfield at a glance

For existing systems, progress is tracked in **five milestones** (not the greenfield 18 stages):

```
Import → Recover → Change → Released → Closed
```

Inside **Change**, you walk four revision steps:

```
See changes → Review decisions → Build guide → Change package
```

The **Change package** step produces human documents (proposal, build plan) and machine output (`agent_pack.json`) for coding agents.

Details: [Brownfield Discovery](./Brownfield-Discovery.md)

---

## Wiki pages

| Page | Audience | Purpose |
|------|----------|---------|
| [Getting Started](./Getting-Started.md) | Developers, reviewers | Install, run, sign in, choose a mode |
| [Brownfield Discovery](./Brownfield-Discovery.md) | Architects, product | Import → Recover → Change workflow |
| [Software Factory Integration](./Software-Factory-Integration.md) | All partner teams | RE → TimeArch → Coding via Orchestrator |
| [Software Delivery Package (SDP)](./Software-Delivery-Package.md) | Architects + Coding | Handoff format (`agent_pack.json`, documents) |
| [Diagrams](./Diagrams.md) | All teams | Mermaid visuals (markdown) |
| [Diagrams (live)](./diagrams.html) | All teams | Interactive Mermaid on GitHub Pages |
| [Team Decisions Log](./Team-Decisions-Log.md) | Leads | Integration decisions to lock |

---

## Related repo docs

- [Architecture & code conventions](../ARCHITECTURE.md)
- [External integrations (API, MCP, CLI)](../INTEGRATIONS.md)
- [ECSA artifact evaluation](../ARTIFACT.md)
- [Contributing](../CONTRIBUTING.md)

---

*Last updated: August 2026*
