# Diagrams — Software Factory

Visual overview for partner meetings. All diagrams use [Mermaid](https://mermaid.js.org/) (renders on GitHub, GitLab, many Markdown previews, and Notion with a Mermaid block).

---

## 1. Big picture — hub and spoke

Tools never talk to each other directly. The **Orchestrator** is the only hub.

```mermaid
flowchart TB
  subgraph Actors["People"]
    U[Stakeholder / Product]
    HA[Human approver — RE]
    HB[Human approver — Architecture]
  end

  subgraph Hub["Orchestration layer"]
    O[Orchestrator<br/>runs · gates · audit]
    S[(Artifact store<br/>SDP versions)]
  end

  subgraph Workers["Specialist systems"]
    RE[RE tools]
    TA[TimeArch]
    CD[Coding tools]
  end

  U -->|intent / change request| O
  O <-->|start job / callback| RE
  O <-->|start job / callback| TA
  O <-->|start job / callback| CD
  O --> S
  RE -.->|Requirements Package| S
  TA -.->|SDP / Change Package| S
  CD -.->|PR + verification| S

  HA -.->|approve RE package| O
  HB -.->|approve SDP| O

  style O fill:#3b82f6,color:#fff
  style S fill:#64748b,color:#fff
```

---

## 2. End-to-end sequence (happy path)

```mermaid
sequenceDiagram
  autonumber
  actor User as Stakeholder
  participant Orch as Orchestrator
  participant RE as RE tools
  participant TA as TimeArch
  participant Code as Coding tools
  participant Git as Git repo / CI

  User->>Orch: Submit intent (new feature / change)
  Orch->>Orch: Create Run (run_id)

  Orch->>RE: Start requirements job
  RE-->>Orch: Requirements Package (draft)
  Note over Orch,RE: Gate 1 — human approve RE
  Orch->>TA: Import requirements (+ optional as-is sources)

  TA->>TA: Architecture / Change analysis
  TA-->>Orch: Export SDP (draft)
  Note over Orch,TA: Gate 2 — human approve architecture
  Orch->>Code: Start implementation (SDP + repo URL)

  Code->>Git: Open PR + run tests
  Git-->>Code: CI results
  Code-->>Orch: PR URL + verification.json
  Orch->>Orch: Close Run / store lineage
  Orch-->>User: Done (or loop on gaps)
```

---

## 3. Run state machine

```mermaid
stateDiagram-v2
  [*] --> Created
  Created --> RE_Running: dispatch RE
  RE_Running --> RE_PendingApproval: package ready
  RE_PendingApproval --> Arch_Running: approved
  RE_PendingApproval --> Failed: rejected
  Arch_Running --> Arch_PendingApproval: SDP ready
  Arch_PendingApproval --> Coding_Running: approved
  Arch_PendingApproval --> Failed: rejected
  Coding_Running --> Verifying: PR opened
  Verifying --> Completed: CI green
  Verifying --> Coding_Running: fix loop
  Verifying --> Failed: blocked
  Failed --> [*]
  Completed --> [*]
```

---

## 4. What moves between stages

```mermaid
flowchart LR
  subgraph In["Into TimeArch"]
    RP[Requirements Package<br/>YAML / JSON]
    BF[Optional brownfield<br/>code · API · schema]
  end

  subgraph TA["TimeArch"]
    A[Architecture & ADRs]
    C[Change Package]
    W[Work items]
  end

  subgraph Out["Out of TimeArch = SDP"]
    SDP[Software Delivery Package<br/>manifest + YAML + MD + JSON]
  end

  subgraph CodeOut["Out of Coding"]
    PR[Git PR]
    V[verification.json]
  end

  RP --> TA
  BF --> TA
  A --> SDP
  C --> SDP
  W --> SDP
  SDP --> PR
  SDP --> V
```

---

## 5. SDP contents (artifact map)

```mermaid
flowchart TB
  SDP["SDP ZIP / folder"]

  SDP --> M[package.json<br/>manifest]
  SDP --> R[requirements.yaml]
  SDP --> AR[architecture.yaml]
  SDP --> CP[change_package.md<br/>stakeholders]
  SDP --> CB[coding_brief.md<br/>engineers / LLMs]
  SDP --> WI[work_items.json]
  SDP --> ADR[adr/*.md]
  SDP --> BF[brownfield/*<br/>optional]
  SDP --> TR[traces/*<br/>optional]

  CP -.->|human review| H[Stakeholders]
  CB -.->|paste into agent| L[Coding LLM / engineer]
  WI -.->|checklist| CI[CI / project board]
```

---

## 6. Anti-pattern vs recommended

```mermaid
flowchart TB
  subgraph Bad["Avoid — pairwise spaghetti"]
    RE1[RE] <--> TA1[TimeArch]
    TA1 <--> CD1[Coding]
    RE1 <--> CD1
  end

  subgraph Good["Prefer — hub and spoke"]
    O2[Orchestrator]
    RE2[RE] --- O2
    TA2[TimeArch] --- O2
    CD2[Coding] --- O2
  end
```

---

## 7. Lineage (requirement → code)

```mermaid
flowchart LR
  REQ[REQ-12<br/>requirement] --> DEC[ADR / decision]
  DEC --> WI[wi_001<br/>work item]
  WI --> FILE[src/... files]
  FILE --> PR[Pull request]
  PR --> RUN[Run audit log]

  style REQ fill:#22c55e,color:#fff
  style PR fill:#3b82f6,color:#fff
  style RUN fill:#64748b,color:#fff
```

---

## How to present tomorrow

1. Start with **§1 Big picture** (hub).  
2. Walk **§2 Sequence** step by step.  
3. Show **§5 SDP** as “the only handoff”.  
4. End with **§6** — why not direct tool-to-tool links.

---

## See also

- [Software Factory Integration](./Software-Factory-Integration.md)  
- [Software Delivery Package (SDP)](./Software-Delivery-Package.md)  
- [Home](./Home.md)
