# ADR-0001: Keep the PHP monolith (2018)

## Status
Accepted — 2018-03

## Context
The team evaluated extracting the catalog and checkout into separate services.
At the time, the company had 4 engineers and ~6k MAU. Operational maturity was
low (no container orchestration, no CI/CD).

## Decision
Keep ShopFlow as a single PHP monolith on bare metal. Defer service extraction
until traffic or team size justifies the operational cost.

## Consequences
- Positive: Fast iteration, single deploy unit, simple ops.
- Negative: Tight coupling between catalog, cart, checkout and admin code paths.
- Negative: Reporting queries contend with transactional traffic on the same DB.

## Revisit when
- Team size > 10 engineers, OR
- Checkout p95 latency > 2s sustained, OR
- A reporting workload requires more than 30s of DB time.
