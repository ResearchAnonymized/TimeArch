#!/usr/bin/env bash
# TimeArch — ECSA 2026 AE full reproduction (≤ 30 min).
#
# Default: LLM_MODE=replay (no network, no API key).
#
# Auto-bootstrap: if the cassette is missing/empty OR the baseline directory
# is empty, this script can run ONCE in record mode against the live LLM API to populate both, then promote the run as the new baseline.
# AI Gateway to populate both, then promote the run as the new baseline.
#
# Bootstrap is triggered when EITHER:
#   • LLM_API_KEY is set AND cassette is empty / baseline is empty, OR
#   • --bootstrap is passed explicitly
#
# Pass --no-bootstrap to disable. Pass --force-bootstrap to refresh even if
# the cassette already has entries.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BOOTSTRAP_FLAG="auto"   # auto | force | off
for arg in "$@"; do
  case "$arg" in
    --bootstrap)        BOOTSTRAP_FLAG="force" ;;
    --force-bootstrap)  BOOTSTRAP_FLAG="force" ;;
    --no-bootstrap)     BOOTSTRAP_FLAG="off" ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

CASSETTE="${LLM_CASSETTE_PATH:-$ROOT/reproducibility/llm-cassette.json}"
export LLM_CASSETTE_PATH="$CASSETTE"
OUT="$ROOT/reproducibility/_out"
BASE="$ROOT/reproducibility/baseline"
mkdir -p "$OUT" "$BASE"

# ─── Decide whether to bootstrap ───────────────────────────────────────────
cassette_entries() {
  if [ ! -f "$CASSETTE" ]; then echo 0; return; fi
  node -e '
    const fs=require("fs");
    try {
      const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const n=Object.keys(j).filter(k=>!k.startsWith("_")).length;
      console.log(n);
    } catch { console.log(0); }
  ' "$CASSETTE"
}

baseline_empty() {
  # treat the dir as empty if it only contains .gitkeep / hidden files
  [ -z "$(find "$BASE" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -print -quit)" ]
}

NEED_BOOTSTRAP="no"
ENTRIES="$(cassette_entries)"
if [ "$BOOTSTRAP_FLAG" = "force" ]; then
  NEED_BOOTSTRAP="yes"
elif [ "$BOOTSTRAP_FLAG" = "auto" ]; then
  if { [ "$ENTRIES" -eq 0 ] || baseline_empty; } && [ -n "${LLM_API_KEY:-}" ]; then
    NEED_BOOTSTRAP="yes"
  fi
fi

if [ "$NEED_BOOTSTRAP" = "yes" ]; then
  if [ -z "${LLM_API_KEY:-}" ]; then
    echo "[reproduce] !! bootstrap requested but LLM_API_KEY is not set."
    echo "[reproduce]    Set it (live configured LLM API key) and re-run, or use --no-bootstrap."
    exit 3
  fi
  echo "[reproduce] ── BOOTSTRAP MODE ────────────────────────────────────────"
  echo "[reproduce]    cassette entries=$ENTRIES  baseline_empty=$(baseline_empty && echo yes || echo no)"
  echo "[reproduce]    Running once with LLM_MODE=record to populate cassette + baseline."
  export LLM_MODE=record
else
  export LLM_MODE="${LLM_MODE:-replay}"
fi

echo "[reproduce] LLM_MODE=$LLM_MODE  cassette=$CASSETTE  entries=$ENTRIES"

# ─── 1. Brownfield pipeline ────────────────────────────────────────────────
echo "[reproduce] 1/4  Brownfield pipeline (reverse-engineer → gap → drift)"
npx tsx scripts/run-brownfield-demo.ts \
    > "$OUT/brownfield-summary.json" 2> "$OUT/brownfield.log" || {
  echo "  ! brownfield run failed — see $OUT/brownfield.log"
  exit 1
}

# ─── 2. Repeatability (N=10) ───────────────────────────────────────────────
# In bootstrap mode we only do 1 recording pass (cost) + 9 replays to verify
# the cassette is hit-complete. In normal mode all 10 are replays.
echo "[reproduce] 2/4  Repeatability experiment (N=10)"
for i in $(seq 1 10); do
  if [ "$LLM_MODE" = "record" ] && [ "$i" -ge 2 ]; then
    LLM_MODE=replay npx tsx scripts/run-brownfield-demo.ts \
        > "$OUT/run-$i.json" 2>> "$OUT/repeatability.log"
  else
    npx tsx scripts/run-brownfield-demo.ts \
        > "$OUT/run-$i.json" 2>> "$OUT/repeatability.log"
  fi
done

# ─── 3. Variance report ────────────────────────────────────────────────────
echo "[reproduce] 3/4  Computing variance"
node -e '
  const fs=require("fs");
  const runs=Array.from({length:10},(_,i)=>JSON.parse(fs.readFileSync(`./reproducibility/_out/run-${i+1}.json`,"utf8")));
  const gaps=runs.map(r=>r.gaps);
  const mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;
  const sd=Math.sqrt(gaps.reduce((a,b)=>a+(b-mean)**2,0)/gaps.length);
  fs.writeFileSync("./reproducibility/_out/variance.json",
    JSON.stringify({gaps,mean,sd,cv:mean?sd/mean:0},null,2));
  console.log(`  gaps mean=${mean.toFixed(2)}  sd=${sd.toFixed(3)}  cv=${mean?(sd/mean).toFixed(3):"n/a"}`);
'

# ─── 4a. Bootstrap promotion: copy outputs into baseline ───────────────────
if [ "$NEED_BOOTSTRAP" = "yes" ]; then
  echo "[reproduce] 4/4  Promoting this run to reproducibility/baseline/"
  cp "$OUT/brownfield-summary.json" "$BASE/brownfield-summary.json"
  cp "$OUT/variance.json"          "$BASE/variance.json"
  for i in $(seq 1 10); do cp "$OUT/run-$i.json" "$BASE/run-$i.json"; done
  NEW_ENTRIES="$(cassette_entries)"
  echo "  ✓ baseline populated  ✓ cassette now has $NEW_ENTRIES entries"
  echo "[reproduce] Bootstrap complete. Commit reproducibility/llm-cassette.json"
  echo "[reproduce] and reproducibility/baseline/ so reviewers can run in replay mode."
  exit 0
fi

# ─── 4b. Normal mode: diff against locked baseline ─────────────────────────
echo "[reproduce] 4/4  Diff against locked baseline"
if baseline_empty; then
  echo "  (no baseline yet — run once with LLM_API_KEY set, or pass --bootstrap)"
else
  if diff -q "$BASE/brownfield-summary.json" "$OUT/brownfield-summary.json" >/dev/null; then
    echo "  ✓ brownfield-summary.json matches baseline"
  else
    echo "  ! brownfield-summary.json differs — see diff:"
    diff "$BASE/brownfield-summary.json" "$OUT/brownfield-summary.json" || true
  fi
fi

echo "[reproduce] DONE — outputs in $OUT/"
