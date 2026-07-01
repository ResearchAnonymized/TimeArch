#!/usr/bin/env bash
# TimeArch — ECSA 2026 AE smoke test (≤ 2 min).
# Verifies the artifact bundle is internally consistent without hitting any
# external service: install deps, type-check, run unit tests, and verify the
# LLM cassette + brownfield demo pack are present.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke] 1/5  Node + bun versions"
node -v
bun --version || echo "(bun optional)"

echo "[smoke] 2/5  Installing dependencies"
if command -v bun >/dev/null 2>&1; then
  bun install --frozen-lockfile
else
  npm install --legacy-peer-deps
fi

echo "[smoke] 3/5  Verifying reproducibility assets"
test -f reproducibility/llm-cassette.json          || { echo "  ! missing llm-cassette.json"; exit 1; }
test -f reproducibility/repeatability-N10.csv      || { echo "  ! missing repeatability-N10.csv"; exit 1; }
test -d public/demo/brownfield                     || { echo "  ! missing brownfield demo pack"; exit 1; }
echo "  ok"

echo "[smoke] 4/5  Type-check"
npx tsc --noEmit

echo "[smoke] 5/5  Unit tests"
npx vitest run --reporter=dot

echo "[smoke] PASS — artifact bundle is internally consistent."
