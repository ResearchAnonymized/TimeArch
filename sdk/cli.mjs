#!/usr/bin/env node
/**
 * TimeArch CLI — minimal wrapper around the public REST API.
 *
 *   export TIMEARCH_TOKEN=ta_…
 *   node sdk/cli.mjs projects
 *   node sdk/cli.mjs artifacts <projectId>
 *   node sdk/cli.mjs reverse-engineer <projectId>
 *   node sdk/cli.mjs drift-detect <projectId>
 *   node sdk/cli.mjs disposition <projectId>
 *
 * Override the gateway with TIMEARCH_BASE_URL.
 */
const TOKEN = process.env.TIMEARCH_TOKEN;
const JWT = process.env.TIMEARCH_JWT;    // Supabase user JWT — required for experiment commands
const BASE = process.env.TIMEARCH_BASE_URL
  ?? "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/public-api";
const FN_BASE = process.env.TIMEARCH_FN_BASE_URL
  ?? "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1";
const ANON_KEY = process.env.TIMEARCH_ANON_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cWJ4emNqbnBzaWpramJmamNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODYyNTUsImV4cCI6MjA4OTM2MjI1NX0.zrNpGEXkg-R59Mwkp9Koz8y8QD0eoWjbuoHA9i1XpJg";

const [, , cmd, ...rest] = process.argv;
const projectId = rest[0];
if (!cmd) {
  console.error("usage: cli.mjs <projects|artifacts|requirements|reverse-engineer|drift-detect|disposition|health|experiment> [args...]");
  console.error("       cli.mjs experiment run   <projectId> <proposalId>");
  console.error("       cli.mjs experiment batch <projectId> <proposalId,proposalId,...> [repeat=3]");
  console.error("       cli.mjs experiment report <projectId>");
  process.exit(2);
}

// ─── Experiment subcommands ────────────────────────────────────────────────
if (cmd === "experiment") {
  if (!JWT) { console.error("TIMEARCH_JWT env var (Supabase user JWT) is required for experiment commands"); process.exit(2); }
  const sub = rest[0];
  const args = rest.slice(1);
  const fnFetch = (fn, body) => fetch(`${FN_BASE}/${fn}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${JWT}`, apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (sub === "run") {
    const [pid, propId] = args;
    if (!pid || !propId) { console.error("usage: experiment run <projectId> <proposalId>"); process.exit(2); }
    const r = await fnFetch("experiment-run", { project_id: pid, proposal_id: propId, track: "prospective" });
    const t = await r.text();
    console.log(t);
    process.exit(r.ok ? 0 : 1);
  }
  if (sub === "batch") {
    const [pid, ids, repeatArg] = args;
    if (!pid || !ids) { console.error("usage: experiment batch <projectId> <p1,p2,...> [repeat=3]"); process.exit(2); }
    const proposalIds = ids.split(",").map((s) => s.trim()).filter(Boolean);
    const repeat = Math.max(1, Number(repeatArg ?? 3) || 3);
    let started = 0, failed = 0;
    for (let i = 0; i < repeat; i++) {
      for (const p of proposalIds) {
        const r = await fnFetch("experiment-run", { project_id: pid, proposal_id: p, track: "prospective" });
        if (r.ok) started++; else failed++;
        process.stdout.write(`.${r.ok ? "" : "!"}`);
        await new Promise((res) => setTimeout(res, 400));
      }
    }
    console.log(`\nbatch done: ${started} started, ${failed} failed (total ${proposalIds.length * repeat})`);
    process.exit(failed === 0 ? 0 : 1);
  }
  if (sub === "report") {
    const [pid] = args;
    if (!pid) { console.error("usage: experiment report <projectId>"); process.exit(2); }
    // Read via PostgREST — same JWT, RLS enforced.
    const url = `${process.env.TIMEARCH_REST_BASE_URL ?? "https://yyqbxzcjnpsijkjbfjcg.supabase.co/rest/v1"}/experiment_runs?project_id=eq.${pid}&order=started_at.desc&limit=100`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${JWT}`, apikey: ANON_KEY } });
    const t = await r.text();
    console.log(t);
    process.exit(r.ok ? 0 : 1);
  }
  console.error(`unknown experiment subcommand: ${sub}`);
  process.exit(2);
}

if (!TOKEN) { console.error("TIMEARCH_TOKEN env var is required"); process.exit(2); }

const map = {
  health:           { op: "health" },
  projects:         { op: "projects" },
  artifacts:        { op: "artifacts",    needsProject: true, query: true },
  requirements:     { op: "requirements", needsProject: true, query: true },
  "reverse-engineer": { op: "reverse_engineer", needsProject: true, post: true },
  "drift-detect":     { op: "drift_detect",     needsProject: true, post: true },
  disposition:        { op: "disposition",      needsProject: true, post: true },
};
const spec = map[cmd];
if (!spec) { console.error(`unknown command: ${cmd}`); process.exit(2); }
if (spec.needsProject && !projectId) { console.error("projectId required"); process.exit(2); }

const qs = new URLSearchParams({ op: spec.op, ...(spec.query ? { project: projectId } : {}) });
const url = `${BASE}?${qs}`;
const init = {
  method: spec.post ? "POST" : "GET",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
};
if (spec.post) init.body = JSON.stringify({ op: spec.op, project_id: projectId });

const res = await fetch(url, init);
const text = await res.text();
try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
catch { console.log(text); }
process.exit(res.ok ? 0 : 1);
