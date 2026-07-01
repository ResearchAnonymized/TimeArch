# Brownfield demo runner

One-command end-to-end run of the ShopFlow brownfield pipeline:
upload demo pack → reverse-engineer → gap-analyzer → drift-detect.

## Usage

```bash
SUPABASE_URL="https://yyqbxzcjnpsijkjbfjcg.supabase.co" \
SUPABASE_ANON_KEY="<anon key>" \
DEMO_EMAIL="you@example.com" \
DEMO_PASSWORD="••••••••" \
npx tsx scripts/run-brownfield-demo.ts
```

Optional: pass `PROJECT_ID=<uuid>` to reuse an existing brownfield project.
Without it, a fresh project named **ShopFlow Demo** is created and the
authenticated user becomes its owner.

The user must already exist and be approved. The script signs in via email/
password, uploads the five files in `public/demo/brownfield/`, then invokes
the three edge functions in sequence and prints a JSON summary with import,
gap, and drift counts.
