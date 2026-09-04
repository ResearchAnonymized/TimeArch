# TimeArch KERKIS — Mermaid figures

**Drawn figures (PNG):** [figures gallery](./figures.html) · folder [`figures/`](./figures/)

Import Mermaid into [draw.io](https://app.diagrams.net/) via **Arrange → Insert → Advanced → Mermaid**.  
Full narrative: [KERKIS-TimeArch-Meta-Composition.md](./KERKIS-TimeArch-Meta-Composition.md) · Prompt: [KERKIS-CHATGPT-PROMPT.md](./KERKIS-CHATGPT-PROMPT.md)

---

## Drawn figure index

| # | Figure | PNG |
|---|--------|-----|
| 1 | KERKIS lenses | ![fig01](./figures/fig01-kerkis-lenses.jpg) |
| 2 | Four constructs | ![fig02](./figures/fig02-four-constructs.jpg) |
| 3 | Actor kinds | ![fig03](./figures/fig03-actors.jpg) |
| 4 | AG Step detail | ![fig04](./figures/fig04-ag-step-detail.jpg) |
| 5 | Linear SOP | ![fig05](./figures/fig05-linear-sop.jpg) |
| 6 | Routing & feedback | ![fig06](./figures/fig06-routing-feedback.jpg) |
| 7 | **FINAL Meta-composition** | ![fig07](./figures/fig07-meta-composition.jpg) |
| 8 | Nested orchestrator | ![fig08](./figures/fig08-nested-orchestrator.jpg) |

---

## Figure 1 — KERKIS lenses for TimeArch

![Figure 1](./figures/fig01-kerkis-lenses.jpg)

```mermaid
flowchart TB
  subgraph Coordination["Coordination — who runs next"]
    C1[linear SOP]
    C2[human gates]
    C3[bounded loops<br/>re-analyze · critic]
  end
  subgraph Communication["Communication — what is passed"]
    M1[typed Artifacts IA_/OA_]
    M2[not a growing chat]
  end
  subgraph Knowledge["Knowledge — what an agent knows"]
    K1[Role]
    K2[Task]
    K3[Constraint]
    K4[Support]
  end
```

---

## Figure 2 — Four constructs, one execution model

![Figure 2](./figures/fig02-four-constructs.jpg)

```mermaid
flowchart LR
  IA[IA_change_intent] --> ST[AG Step<br/>map / analyze]
  AG((AG)) --> ST
  Role-.-> ST
  Task-.-> ST
  ST --> OA[OA_adrs / OA_mappings]
  ST -.-> Nest["…or a whole Process<br/>MC_change_analysis"]
```

---

## Figure 3 — Actor kinds in TimeArch

![Figure 3](./figures/fig03-actors.jpg)

```mermaid
flowchart LR
  subgraph FN["FN — deterministic"]
    F1[FN_import]
    F2[FN_reverse_engineer]
    F3[FN_agent_pack]
  end
  subgraph AG["AG — LLM endpoint"]
    A1[AG_map]
    A2[AG_ripple]
    A3[AG_critic]
  end
  subgraph HU["HU — human UI"]
    H1[HU_architect]
    H2[HU_engineer]
    H3[HU_approver]
  end
```

---

## Figure 4 — AG Step detail: map_feature_to_architecture

![Figure 4](./figures/fig04-ag-step-detail.jpg)

```mermaid
flowchart TB
  Role[Role: Brownfield mapper]
  Task[Task: Map change to components]
  Const[Constraint: Ground in inventory]
  Supp[Support: OA_inventory]
  Role -.-> PA[Prompt assembly]
  Task -.-> PA
  Const -.-> PA
  Supp -.-> PA
  IA[IA_change_intent] --> PA
  PA --> AG((AG))
  AG --> OA[OA_mappings<br/>parents: IA_change_intent, OA_inventory]
```

---

## Figure 5 — Linear SOP (brownfield)

![Figure 5](./figures/fig05-linear-sop.jpg)

```mermaid
flowchart LR
  FN1[FN_import] --> A1[OA_imports]
  A1 --> FN2[FN_recover]
  FN2 --> A2[OA_inventory]
  A2 --> AG1[AG_analyze]
  IA[IA_change_intent] --> AG1
  AG1 --> A3[OA_dev_handoff]
  A3 --> HU1[HU_decide]
  HU1 --> HU2[HU_guide]
  HU2 --> FN3[FN_package]
  FN3 --> A4[OA_scp]
  FN3 --> A5[OA_sip]
  FN3 --> A6[OA_agent_pack]
  A6 --> HU3[HU_release]
  HU3 --> A7[OA_case_status]
```

*Each Step’s inputs are the previous Step’s outputs. Order follows matching subtypes + human gates.*

---

## Figure 6 — Routing and feedback

![Figure 6](./figures/fig06-routing-feedback.jpg)

```mermaid
flowchart LR
  AG[AG_analyze] --> D[OA_draft_handoff]
  D --> HU[HU_review<br/>router: Go · No-go · Drop]
  HU --> GO[Go]
  HU --> NG[No-go / Drop]
  GO --> FN[FN_package]
  FN --> PACK[OA_agent_pack]
  NG -.->|feedback re-triggers<br/>optional_input · iteration_limit| AG
```

---

## Figure 7 — FINAL Meta-composition

![Figure 7](./figures/fig07-meta-composition.jpg)

### Outside

```mermaid
flowchart LR
  IA1[IA_sources] --> MC[MC_timearch_brownfield]
  IA2[IA_change_intent] --> MC
  MC --> OA1[OA_scp]
  MC --> OA2[OA_sip]
  MC --> OA3[OA_agent_pack]
  MC --> OA4[OA_case_status]
```

*From outside: one Step. Inputs and outputs only; internal Artifact store hidden.*

### Inside

```mermaid
flowchart TB
  subgraph MC["MC_timearch_brownfield"]
    IA_S[IA_sources] --> IMP[FN_import]
    IMP --> IMPA[OA_imports]
    IMPA --> REC[FN_recover]
    REC --> INV[OA_inventory]
    INV --> CH[MC_change_analysis]
    IA_C[IA_change_intent] --> CH
    CH --> HO[OA_dev_handoff]
    HO --> DEC[HU_decide / HU_guide]
    DEC --> PKG[FN_package]
    PKG --> OUT[OA_scp · OA_sip · OA_agent_pack]
    OUT --> REL[HU_release]
    REL --> ST[OA_case_status]
  end
```

| Rule | Meaning |
|------|---------|
| Executor = Actor or Process | `MC_change_analysis` fits where an AG Step fits |
| Encapsulation | Only declared IA enter; only unconsumed OA leave |
| Hierarchy for free | Milestones wrap nested analysis Process |
| Artifact interface | Neighbors never see mappings/traces/UI |

---

## Figure 8 — Nested MC_change_analysis (orchestrator pattern)

![Figure 8](./figures/fig08-nested-orchestrator.jpg)

```mermaid
flowchart TB
  subgraph Outer["From outside: one Step → OA_dev_handoff"]
    INx[IA_change_intent + OA_inventory] --> MCx[MC_change_analysis]
    MCx --> OUTx[OA_dev_handoff]
  end

  subgraph Inner["Inside MC_change_analysis"]
    ORCH[AG_orchestrator]
    REG[[Support: agent registry]]
    ROLE[[Role: change analyst]]
    REG -.-> ORCH
    ROLE -.-> ORCH
    ORCH -->|decision| DISP[FN_dispatch]
    DISP --> M[AG_map]
    DISP --> R[AG_ripple]
    DISP --> Q[AG_quality]
    M --> COL[FN_collect]
    R --> COL
    Q --> COL
    COL -.->|OA_STATE optional_input<br/>iteration_limit| ORCH
    ORCH -->|done| HO2[OA_dev_handoff]
  end
```

---

## Master narrative (title slide)

**TimeArch as KERKIS meta-composition:** a brownfield Process that binds Role/Task knowledge to FN, AG, and HU Actors, moves typed Artifacts from sources to inventory to decisions, and wraps as **MC_timearch_brownfield** — exposing only a Change Proposal, Build Plan, gate-aware `agent_pack.json`, and case status to the software factory.
