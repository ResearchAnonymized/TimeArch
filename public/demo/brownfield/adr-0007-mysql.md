# ADR-0007: Stay on MySQL 5.7 (2021)

## Status
Accepted — 2021-09

## Context
MySQL 5.7 reaches EOL in October 2023. We considered migrating to PostgreSQL
or upgrading to MySQL 8.

## Decision
Upgrade to MySQL 8 in place. Do not switch engines — the ORM, stored
procedures and replication tooling are all MySQL-specific.

## Consequences
- Positive: Minimal application change.
- Negative: Still single-primary; reporting workload remains a problem.
- Follow-up: Introduce a read replica for analytics (not yet done as of 2024).
