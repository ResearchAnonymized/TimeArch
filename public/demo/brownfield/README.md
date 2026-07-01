# ShopFlow demo brownfield pack

Synthetic artifacts for demoing TimeArch's brownfield discovery, gap analysis,
evolution planning and drift-detection flows.

Files:
- `openapi.yaml` — legacy public API contract (10 endpoints, no pagination, sync checkout).
- `schema.sql` — MySQL schema export (MD5 passwords, no migrations history).
- `srs.md` — informal SRS describing as-is + to-be expectations.
- `adr-0001-monolith.md` — historical decision to keep the monolith.
- `adr-0007-mysql.md` — historical decision to stay on MySQL.

Use the **Load demo pack** button on the Discovery stage of any brownfield
project to import all of these in one click.
