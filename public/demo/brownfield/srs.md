# ShopFlow — Existing System Brief (informal SRS)

## Context
ShopFlow is a 10-year-old PHP monolith serving ~40k MAU. Single MySQL primary,
no read replica. Deployed to two bare-metal servers behind an HAProxy. Releases
are manual (rsync + service restart) every Friday.

## Functional capabilities (as-is)
- Browse and search the product catalog.
- Anonymous and authenticated cart.
- Checkout with Stripe (synchronous call inside the HTTP request).
- Order history for authenticated users.
- Admin back-office: product CRUD, user list, sales reports.
- Transactional emails (order confirmation, password reset) sent inline via SMTP.

## Known pain points
- Friday deploys cause 5–15 min downtime.
- Admin sales report locks the orders table for ~30s.
- No staging environment; bugs are caught in prod.
- Passwords still stored as unsalted MD5.
- No audit trail for admin actions beyond a free-text `audit_log` table.

## Stakeholder asks (to-be)
- Move to zero-downtime deploys.
- Decouple checkout from payment + email (introduce async workers).
- Replace MD5 with Argon2id and force a password reset on next login.
- Provide a separate read replica for reporting.
- Introduce per-environment infrastructure (dev / staging / prod) as code.

## Constraints
- Cannot rewrite from scratch — must evolve incrementally.
- Must preserve existing public API contract for at least 12 months.
- Compliance: PCI-DSS SAQ-A (Stripe Elements already used on the front-end).
