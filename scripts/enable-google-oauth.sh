#!/usr/bin/env bash
# Enable Google OAuth for local TimeArch (Supabase).
# Usage:
#   ./scripts/enable-google-oauth.sh "<CLIENT_ID>" "<CLIENT_SECRET>"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CID="${1:-}"
CSEC="${2:-}"
if [[ -z "$CID" || -z "$CSEC" ]]; then
  echo "Usage: $0 <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>"
  echo
  echo "Create a Web OAuth client at:"
  echo "  https://console.cloud.google.com/apis/credentials"
  echo "Authorized JavaScript origins:"
  echo "  http://localhost:8082"
  echo "  http://127.0.0.1:8082"
  echo "Authorized redirect URI (exact):"
  echo "  http://127.0.0.1:54321/auth/v1/callback"
  exit 1
fi

mkdir -p "$ROOT/supabase"
cat > "$ROOT/supabase/.env" <<EOF
GOOGLE_CLIENT_ID=$CID
GOOGLE_CLIENT_SECRET=$CSEC
EOF

# Also keep copies in .env.local for documentation / tooling
if [[ -f "$ROOT/.env.local" ]]; then
  grep -q '^GOOGLE_CLIENT_ID=' "$ROOT/.env.local" 2>/dev/null \
    && sed -i.bak "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$CID|" "$ROOT/.env.local" \
    || printf '\nGOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\n' "$CID" "$CSEC" >> "$ROOT/.env.local"
  grep -q '^GOOGLE_CLIENT_SECRET=' "$ROOT/.env.local" 2>/dev/null \
    && sed -i.bak "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$CSEC|" "$ROOT/.env.local" \
    || true
  rm -f "$ROOT/.env.local.bak"
fi

echo "Wrote supabase/.env — restarting local Supabase auth stack…"
cd "$ROOT"
npx supabase stop
npx supabase start
echo
echo "Checking Google provider…"
ANON=$(grep VITE_SUPABASE_PUBLISHABLE_KEY "$ROOT/.env" | cut -d= -f2)
curl -s "http://127.0.0.1:54321/auth/v1/settings" -H "apikey: $ANON" \
  | python3 -c 'import sys,json; e=(json.load(sys.stdin).get("external") or {}); print("google enabled:", e.get("google"))'
echo "Done. Open http://localhost:8082/auth and use Continue with Google."
