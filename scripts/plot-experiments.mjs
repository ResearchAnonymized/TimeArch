#!/usr/bin/env node
/**
 * plot-experiments.mjs — turn Experiment Ground CSV exports into paper figures.
 *
 * Consumes the CSVs exported from the Report panel:
 *   • Runs CSV   (per-run rows, includes `track`) → precision/recall/F1, wall-time box plots
 *   • Rubric CSV (rater × dimension × score)      → per-dimension mean + Cohen's κ heatmap
 *
 * Emits self-contained SVG under docs/figures/. LaTeX can \includegraphics them
 * directly, or convert to PNG with `rsvg-convert -a fig.svg -o fig.png` if
 * your build pipeline wants raster.
 *
 * Usage:
 *   node scripts/plot-experiments.mjs \
 *     --runs=reproducibility/baseline/runs.csv \
 *     --rubric=reproducibility/baseline/rubric.csv \
 *     --out=docs/figures
 *
 * Zero dependencies (pure ES modules) — safe to run in CI without install.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ─── args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  }),
);
const runsPath   = args.runs   ?? "reproducibility/baseline/runs.csv";
const rubricPath = args.rubric ?? null;
const outDir     = args.out    ?? "docs/figures";
mkdirSync(outDir, { recursive: true });

// ─── tiny CSV parser (handles quoted fields, "" escapes) ─────────────────
function parseCsv(text) {
  const rows = [];
  let cur = [""], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { cur[cur.length - 1] += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur[cur.length - 1] += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") cur.push("");
      else if (c === "\n") { rows.push(cur); cur = [""]; }
      else if (c !== "\r") cur[cur.length - 1] += c;
    }
  }
  if (cur.length > 1 || cur[0] !== "") rows.push(cur);
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ─── stats ───────────────────────────────────────────────────────────────
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

// Pairwise Cohen's κ across raters for a single dimension (same as UI).
function cohenKappa(scores, dimension) {
  const filtered = scores.filter((s) => s.dimension === dimension);
  const byRun = new Map();
  for (const s of filtered) {
    if (!byRun.has(s.run_id)) byRun.set(s.run_id, new Map());
    byRun.get(s.run_id).set(s.rater_user_id, +s.score);
  }
  const raters = [...new Set(filtered.map((s) => s.rater_user_id))];
  if (raters.length < 2) return null;
  const kappas = [];
  for (let i = 0; i < raters.length; i++) for (let j = i + 1; j < raters.length; j++) {
    const a = [], b = [];
    for (const [, m] of byRun) {
      const va = m.get(raters[i]), vb = m.get(raters[j]);
      if (va !== undefined && vb !== undefined) { a.push(va); b.push(vb); }
    }
    if (a.length < 2) continue;
    const cats = [...new Set([...a, ...b])].sort();
    const n = a.length;
    const po = a.reduce((acc, v, k) => acc + (v === b[k] ? 1 : 0), 0) / n;
    let pe = 0;
    for (const c of cats) {
      const pa = a.filter((v) => v === c).length / n;
      const pb = b.filter((v) => v === c).length / n;
      pe += pa * pb;
    }
    kappas.push(pe === 1 ? 1 : (po - pe) / (1 - pe));
  }
  return kappas.length ? kappas.reduce((x, y) => x + y, 0) / kappas.length : null;
}

// ─── SVG helpers ─────────────────────────────────────────────────────────
const PALETTE = { prospective: "#3b82f6", retrospective: "#f59e0b", grid: "#e5e7eb", ink: "#0f172a", muted: "#64748b" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgOpen(w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12" role="img" aria-label="${esc(title)}">`;
}
function svgClose() { return "</svg>"; }

function write(name, svg) {
  const path = resolve(outDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg, "utf8");
  console.log("wrote", path);
}

// ─── Figure 1: grouped bar chart — F1 / Jaccard / Direction, per track ───
function figMetricsByTrack(rows) {
  const metrics = [
    { key: "mapping_f1",        label: "Mapping F1" },
    { key: "ripple_jaccard",    label: "Ripple Jaccard" },
    { key: "quality_direction", label: "Quality direction" },
  ];
  const tracks = ["prospective", "retrospective"];
  const grouped = new Map();
  for (const r of rows) {
    if (r.status !== "completed" && r.status !== "partial") continue;
    if (!grouped.has(r.track)) grouped.set(r.track, []);
    grouped.get(r.track).push(r);
  }
  const stats = {};
  for (const t of tracks) {
    const rs = grouped.get(t) ?? [];
    stats[t] = Object.fromEntries(metrics.map((m) => {
      const xs = rs.map((r) => num(r[m.key])).filter((v) => v !== null);
      return [m.key, { mean: mean(xs), n: xs.length }];
    }));
  }

  const W = 640, H = 340, pad = { l: 60, r: 20, t: 40, b: 60 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const barW = innerW / (metrics.length * (tracks.length + 1));
  let svg = svgOpen(W, H, "Metrics by track");
  svg += `<text x="${W/2}" y="20" text-anchor="middle" font-weight="600" fill="${PALETTE.ink}">Auto-metrics by track (mean across runs)</text>`;
  // y axis
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + innerH - (innerH * i / 5);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="${PALETTE.grid}"/>`;
    svg += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" fill="${PALETTE.muted}">${(i/5).toFixed(1)}</text>`;
  }
  // bars
  metrics.forEach((m, mi) => {
    const groupX = pad.l + mi * (innerW / metrics.length) + (innerW / metrics.length - barW * tracks.length) / 2;
    tracks.forEach((t, ti) => {
      const s = stats[t][m.key];
      const v = s.mean ?? 0;
      const h = innerH * v;
      const x = groupX + ti * barW;
      const y = pad.t + innerH - h;
      svg += `<rect x="${x}" y="${y}" width="${barW - 4}" height="${h}" fill="${PALETTE[t]}" opacity="0.9"/>`;
      svg += `<text x="${x + (barW - 4)/2}" y="${y - 4}" text-anchor="middle" fill="${PALETTE.ink}" font-size="10">${s.mean === null ? "—" : v.toFixed(2)}</text>`;
      svg += `<text x="${x + (barW - 4)/2}" y="${pad.t + innerH + 14}" text-anchor="middle" fill="${PALETTE.muted}" font-size="9">n=${s.n}</text>`;
    });
    svg += `<text x="${groupX + barW * tracks.length / 2}" y="${pad.t + innerH + 32}" text-anchor="middle" fill="${PALETTE.ink}">${esc(m.label)}</text>`;
  });
  // legend
  tracks.forEach((t, i) => {
    const lx = pad.l + i * 140;
    svg += `<rect x="${lx}" y="${H - 18}" width="12" height="12" fill="${PALETTE[t]}"/>`;
    svg += `<text x="${lx + 18}" y="${H - 8}" fill="${PALETTE.ink}">${t}</text>`;
  });
  svg += svgClose();
  write("metrics-by-track.svg", svg);
}

// ─── Figure 2: wall-time box plot per stage-group, by track ──────────────
function figWallTime(rows) {
  const tracks = ["prospective", "retrospective"];
  const groups = new Map();
  for (const r of rows) {
    const key = r.track;
    if (!groups.has(key)) groups.set(key, []);
    const ms = num(r.wall_ms);
    if (ms !== null) groups.get(key).push(ms / 1000); // seconds
  }
  const W = 480, H = 320, pad = { l: 60, r: 20, t: 40, b: 50 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const all = [...groups.values()].flat();
  const yMax = Math.max(1, ...all) * 1.1;
  const boxW = innerW / (tracks.length + 1);

  let svg = svgOpen(W, H, "Wall time per run");
  svg += `<text x="${W/2}" y="20" text-anchor="middle" font-weight="600" fill="${PALETTE.ink}">Wall time per run (seconds)</text>`;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + innerH - (innerH * i / 5);
    const v = (yMax * i / 5).toFixed(0);
    svg += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="${PALETTE.grid}"/>`;
    svg += `<text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" fill="${PALETTE.muted}">${v}</text>`;
  }
  tracks.forEach((t, ti) => {
    const xs = groups.get(t) ?? [];
    if (xs.length === 0) return;
    const q1 = quantile(xs, 0.25), med = quantile(xs, 0.5), q3 = quantile(xs, 0.75);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    const cx = pad.l + (ti + 0.75) * boxW;
    const y = (v) => pad.t + innerH - (innerH * v / yMax);
    svg += `<line x1="${cx}" y1="${y(lo)}" x2="${cx}" y2="${y(hi)}" stroke="${PALETTE.ink}"/>`;
    svg += `<rect x="${cx - boxW*0.3}" y="${y(q3)}" width="${boxW*0.6}" height="${y(q1) - y(q3)}" fill="${PALETTE[t]}" opacity="0.85" stroke="${PALETTE.ink}"/>`;
    svg += `<line x1="${cx - boxW*0.3}" y1="${y(med)}" x2="${cx + boxW*0.3}" y2="${y(med)}" stroke="${PALETTE.ink}" stroke-width="2"/>`;
    svg += `<text x="${cx}" y="${pad.t + innerH + 18}" text-anchor="middle" fill="${PALETTE.ink}">${t}</text>`;
    svg += `<text x="${cx}" y="${pad.t + innerH + 32}" text-anchor="middle" fill="${PALETTE.muted}" font-size="10">n=${xs.length} · med=${med.toFixed(1)}s</text>`;
  });
  svg += svgClose();
  write("walltime-by-track.svg", svg);
}

// ─── Figure 3: rubric — mean score + κ per dimension ─────────────────────
function figRubric(scores) {
  const dims = [...new Set(scores.map((s) => s.dimension))].sort();
  if (dims.length === 0) { console.log("skip rubric fig (no scores)"); return; }
  const stats = dims.map((d) => {
    const xs = scores.filter((s) => s.dimension === d).map((s) => +s.score);
    return { dim: d, mean: mean(xs), n: xs.length, kappa: cohenKappa(scores, d) };
  });

  const W = 620, H = 60 + 40 * dims.length, pad = { l: 160, r: 20, t: 40, b: 30 };
  let svg = svgOpen(W, H, "Rubric summary");
  svg += `<text x="${W/2}" y="20" text-anchor="middle" font-weight="600" fill="${PALETTE.ink}">Rubric — mean score (1–5) &amp; Cohen's κ per dimension</text>`;
  const barMax = W - pad.l - pad.r - 120;
  stats.forEach((s, i) => {
    const y = pad.t + i * 40;
    svg += `<text x="${pad.l - 10}" y="${y + 14}" text-anchor="end" fill="${PALETTE.ink}">${esc(s.dim)}</text>`;
    const w = s.mean === null ? 0 : barMax * (s.mean / 5);
    svg += `<rect x="${pad.l}" y="${y}" width="${barMax}" height="20" fill="${PALETTE.grid}"/>`;
    svg += `<rect x="${pad.l}" y="${y}" width="${w}" height="20" fill="${PALETTE.prospective}"/>`;
    svg += `<text x="${pad.l + barMax + 8}" y="${y + 14}" fill="${PALETTE.ink}" font-size="11">μ=${s.mean === null ? "—" : s.mean.toFixed(2)}  n=${s.n}  κ=${s.kappa === null ? "n/a" : s.kappa.toFixed(2)}</text>`;
  });
  svg += svgClose();
  write("rubric-summary.svg", svg);
}

// ─── Figure 4: text summary — machine-readable stats bundle for the paper ─
function writeStatsJson(rows, scores) {
  const byTrack = {};
  for (const r of rows) {
    const t = r.track ?? "unknown";
    if (!byTrack[t]) byTrack[t] = { n: 0, mapping_f1: [], ripple_jaccard: [], quality_direction: [], wall_ms: [] };
    byTrack[t].n++;
    for (const k of ["mapping_f1", "ripple_jaccard", "quality_direction"]) {
      const v = num(r[k]); if (v !== null) byTrack[t][k].push(v);
    }
    const w = num(r.wall_ms); if (w !== null) byTrack[t].wall_ms.push(w);
  }
  const summary = {};
  for (const [t, s] of Object.entries(byTrack)) {
    summary[t] = {
      runs: s.n,
      mapping_f1_mean: mean(s.mapping_f1),
      ripple_jaccard_mean: mean(s.ripple_jaccard),
      quality_direction_mean: mean(s.quality_direction),
      wall_ms_median: quantile(s.wall_ms, 0.5),
    };
  }
  const rubric = {};
  const dims = [...new Set(scores.map((s) => s.dimension))];
  for (const d of dims) {
    const xs = scores.filter((s) => s.dimension === d).map((s) => +s.score);
    rubric[d] = { n: xs.length, mean: mean(xs), kappa: cohenKappa(scores, d) };
  }
  const path = resolve(outDir, "experiment-summary.json");
  writeFileSync(path, JSON.stringify({ tracks: summary, rubric, generated_at: new Date().toISOString() }, null, 2));
  console.log("wrote", path);
}

// ─── main ────────────────────────────────────────────────────────────────
let rows = [];
try {
  rows = parseCsv(readFileSync(runsPath, "utf8"));
  console.log(`loaded ${rows.length} runs from ${runsPath}`);
} catch (e) {
  console.error(`could not read runs CSV at ${runsPath}: ${e.message}`);
  console.error(`export it from Experiment Ground → Report → "Runs CSV" and pass --runs=<path>`);
  process.exit(1);
}
let scores = [];
if (rubricPath) {
  try {
    scores = parseCsv(readFileSync(rubricPath, "utf8"));
    console.log(`loaded ${scores.length} rubric scores from ${rubricPath}`);
  } catch (e) {
    console.warn(`skipping rubric fig — could not read ${rubricPath}: ${e.message}`);
  }
}

figMetricsByTrack(rows);
figWallTime(rows);
figRubric(scores);
writeStatsJson(rows, scores);
console.log(`\nDone. Include in LaTeX: \\includegraphics{figures/metrics-by-track.svg}`);
