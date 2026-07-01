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
const BASE = process.env.TIMEARCH_BASE_URL
  ?? "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/public-api";

if (!TOKEN) { console.error("TIMEARCH_TOKEN env var is required"); process.exit(2); }

const [, , cmd, projectId] = process.argv;
if (!cmd) {
  console.error("usage: cli.mjs <projects|artifacts|requirements|reverse-engineer|drift-detect|disposition|health> [projectId]");
  process.exit(2);
}

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
