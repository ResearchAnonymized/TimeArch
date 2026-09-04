# TimeArch Greenfield Architecture Lifecycle — wrapped process model

**Clear title:** TimeArch Greenfield Architecture Lifecycle (one wrapped process)  
**Technical ID:** `MC_timearch_greenfield`  
**Scope:** New systems — Studio/Classic **stages 1–18** (no Import/Recover).  
**Companion:** [Glossary](./GLOSSARY.md) · [Greenfield figures](./figures/greenfield/README.md) · [Gallery](./gallery.html)

Brownfield twin: [META-COMPOSITION.md](./META-COMPOSITION.md) (*TimeArch Brownfield Discovery*).

---

## Outside view (what partners see)

```
Project brief + Requirements corpus
              │
              ▼
┌──────────────────────────────────────────┐
│  TimeArch Greenfield Architecture        │
│  Lifecycle (one wrapped process)         │
└──────────────────────────────────────────┘
              │
              ▼
SRS · SAD · AAR · FAP · Sealed package · Scaffolding · Status
```

| Direction | Clear name | Description |
|-----------|------------|-------------|
| In | Project brief | Name, description, mode = greenfield |
| In | Requirements corpus | Uploads, intake text, or structured requirements |
| In | Requirements package *(optional)* | Upstream RE handoff |
| Out | SRS | Software Requirements Specification |
| Out | SAD | Software Architecture Document |
| Out | AAR | Architecture Assessment Report (ATAM-style) |
| Out | FAP | Full Architecture Package |
| Out | Sealed package | Stage 15 architecture package lock |
| Out | Implementation scaffolding | Stages 16–17 plan / deploy outputs |
| Out | Project lifecycle status | Current stage, locks |

**Hidden inside:** per-stage artifacts, Mermaid, agent traces, RAG, checklist refinements.

---

## Inside view — four phases (stages 1–18)

| Phase | Stages | Clear focus |
|-------|--------|-------------|
| **Requirement Definition** | 1–3 | Setup, intake, critique |
| **Architecture Design** | 4–10 | Drivers → style → components → data → APIs → concerns → infra |
| **Validation & Assurance** | 11–14 | ATAM, risks, trade-offs, quality checklists / docs |
| **Delivery & Evolution** | 15–18 | Stakeholder seal → plan → deploy → evolve |

**Stage 15** is a **human gate**. Stages **16–18** stay blocked until the package is sealed.

---

## Workers (greenfield)

| Kind | Clear role | Examples |
|------|------------|----------|
| Code | Persist, lock, assemble documents, package-lock checks | `package-lock.ts`, `generate-document` |
| AI | Per-stage generators; Planner→Executor→Critic on 2, 3, 7; Challenger on demand | `run-agent` / `run-agent-v2` |
| Human | Project author, architect (accept/dismiss/lock), Stage 15 approvers | Studio / Classic UI |

---

## Human review & seal

1. **Per-stage:** AI draft → Architect accept / dismiss / refine → Lock stage  
2. **Optional Challenger:** Scientific Challenger → Architect triage → refine Generator  
3. **Stage 15:** Stakeholder register → **Record approval** → `package_locked`  
4. **Then** Implementation plan, Deployment blueprint, Continuous evolution may run  

---

## Nested wrapped processes

| Clear name | Technical ID | Meaning |
|------------|--------------|---------|
| **Agentic stage delivery** | `MC_agentic_stage` | Planner → Executor → Critic (stages 2, 3, 7) |
| **Architecture stage challenge loop** | `MC_stage_challenge` | Generator → Challenger → Human → Refine |

---

## Contract (one sentence)

> **TimeArch Greenfield Architecture Lifecycle** turns a **project brief + requirements** into **architecture documents and a sealed package**, then unlocks **implementation scaffolding** only after Stage 15 human approval.

---

## See also

- [Greenfield figures](./figures/greenfield/README.md)  
- [Brownfield wrapped process](./META-COMPOSITION.md)  
- [Getting Started](../wiki/Getting-Started.md)
