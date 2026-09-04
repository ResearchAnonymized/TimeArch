---
layout: default
title: TimeArch Wiki
permalink: /
---

# TimeArch Wiki

Planning and user guide for **TimeArch** — multi-agent software architecture design and evolution.

**Two audiences:**

1. **Practitioners** — run the app, do brownfield discovery, export change packages  
2. **Partner teams** — connect Requirements Engineering → TimeArch → Coding via an Orchestrator

---

## Start here

| I want to… | Go to |
|------------|-------|
| Run the app locally | [Getting Started](./wiki/Getting-Started.html) |
| Import an existing codebase | [Brownfield Discovery](./wiki/Brownfield-Discovery.html) |
| Hand off to a coding agent | [Software Delivery Package (SDP)](./wiki/Software-Delivery-Package.html) |
| Plan multi-team integration | [Software Factory Integration](./wiki/Software-Factory-Integration.html) |
| Show diagrams in a meeting | [**Interactive diagrams**](./wiki/diagrams.html) |

---

## Brownfield in 30 seconds

```
Import → Recover → Change → Released → Closed
```

Inside **Change**: See changes → Review decisions → Build guide → **Change package** (proposal, build plan, `agent_pack.json`).

[Full brownfield guide →](./wiki/Brownfield-Discovery.html)

---

## Software factory pitch

Treat each team tool as a specialist **worker**. Put a thin **Orchestrator** in the middle that moves a single versioned **Software Delivery Package (SDP)** between stages.

[Integration plan →](./wiki/Software-Factory-Integration.html) · [Open diagrams →](./wiki/diagrams.html)

---

## All pages

| Page | Description |
|------|-------------|
| [Getting Started](./wiki/Getting-Started.html) | Install, sign in, Classic vs Studio |
| [Brownfield Discovery](./wiki/Brownfield-Discovery.html) | Import → Recover → Change workflow |
| [Software Factory Integration](./wiki/Software-Factory-Integration.html) | RE → TimeArch → Coding |
| [Software Delivery Package (SDP)](./wiki/Software-Delivery-Package.html) | Handoff format for coding agents |
| [**Diagrams (interactive)**](./wiki/diagrams.html) | Mermaid charts — best for presentations |
| [Diagrams (markdown)](./wiki/Diagrams.html) | Same diagrams as editable markdown |
| [Team Decisions Log](./wiki/Team-Decisions-Log.html) | Integration decisions to lock |
| [Wiki index](./wiki/Home.html) | Full table of contents |

---

## Process modeling (KERKIS)

| Page | Description |
|------|-------------|
| [**Figure gallery**](./modeling/gallery.html) | Clear-named brownfield process slides |
| [Modeling README](https://github.com/ResearchAnonymized/TimeArch/blob/main/docs/modeling/README.md) | How to read the model |
| [Glossary](https://github.com/ResearchAnonymized/TimeArch/blob/main/docs/modeling/GLOSSARY.md) | Clear name ↔ technical ID |
| [Wrapped process](https://github.com/ResearchAnonymized/TimeArch/blob/main/docs/modeling/META-COMPOSITION.md) | TimeArch Brownfield Discovery |

## Repo links

- [GitHub repository](https://github.com/ResearchAnonymized/TimeArch)
- [ECSA artifact (ARTIFACT.md)](https://github.com/ResearchAnonymized/TimeArch/blob/main/ARTIFACT.md)
- [API / MCP integrations](https://github.com/ResearchAnonymized/TimeArch/blob/main/docs/INTEGRATIONS.md)
