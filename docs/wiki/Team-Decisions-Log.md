# Team Decisions Log

Track partner decisions for the software factory. Update after each meeting.

---

## Open (propose locking)

| # | Decision | Options | Proposed | Owner | Status |
|---|----------|---------|----------|-------|--------|
| D1 | Connection topology | Hub-and-spoke vs pairwise | **Hub-and-spoke via Orchestrator** | Orch + leads | Open |
| D2 | Handoff format | SDP vs PDF-only vs chat | **SDP v0.2** (`agent_pack.json` + SCP/SIP) | TimeArch | Partial — app exports shipped |
| D3 | Approval gates | None / Arch-only / RE+Arch | **RE approve + Arch approve before Coding** | All | Partial — brownfield gates in app |
| D4 | Coding output | Files in chat vs Git PR | **PR + verification.json** | Coding | Open |
| D5 | TimeArch near-term focus | More UI phases vs import/export APIs | **Import/export SDP APIs** | TimeArch | Partial — UI + JSON export done; REST ZIP pending |
| D6 | Shared identity | Separate logins vs SSO | **Shared OIDC/Google SSO** | Orch | Open |
| D7 | Workflow engine | Temporal / Conductor / custom | TBD | Orch | Open |

---

## Partially implemented (TimeArch app)

| # | Decision | What shipped | Gap |
|---|----------|--------------|-----|
| D2 | SDP handoff | `agent_pack.json`, SCP/SIP PDF/DOCX from Change package | Orchestrator ZIP bundle + `package.json` manifest API |
| D3 | Approval gates | Go/No-go/Drop on ADRs, AC, tests; Release tab gates | RE-stage gate before TimeArch (Orchestrator-owned) |
| D5 | Export APIs | Integrations page: REST, MCP, CLI | `POST /runs/export-sdp` for full ZIP |

---

## Meeting template

**Date:**  
**Attendees:**  

### Agreed

- …

### Deferred

- …

### Actions

| Action | Owner | Due |
|--------|-------|-----|
| | | |

---

## Resolved

_(Move rows here when locked.)_

| # | Decision | Locked choice | Date |
|---|----------|---------------|------|
| — | — | — | — |

---

## See also

- [Brownfield Discovery](./Brownfield-Discovery.md)  
- [Software Factory Integration](./Software-Factory-Integration.md)  
- [Software Delivery Package (SDP)](./Software-Delivery-Package.md)  
- [Home](./Home.md)
