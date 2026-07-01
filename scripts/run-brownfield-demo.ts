#!/usr/bin/env -S npx tsx
/**
 * One-command brownfield demo runner.
 *
 * Loads the ShopFlow demo pack into a project, runs the reverse-engineer,
 * gap-analyzer, and drift-detect edge functions end-to-end, then prints a
 * summary of seeded artifacts, gaps, and drift findings.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   DEMO_EMAIL=you@x.com DEMO_PASSWORD=... \
 *   PROJECT_ID=<uuid>  npx tsx scripts/run-brownfield-demo.ts
 *
 * If PROJECT_ID is omitted a fresh brownfield project named "ShopFlow Demo"
 * is created and used.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
let PROJECT_ID = process.env.PROJECT_ID;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Set SUPABASE_URL + SUPABASE_ANON_KEY");
if (!EMAIL || !PASSWORD) throw new Error("Set DEMO_EMAIL + DEMO_PASSWORD");

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = resolve(__dirname, "../public/demo/brownfield");
const DEMO_PACK = [
  { file: "openapi.yaml",         kind: "openapi",   label: "ShopFlow legacy OpenAPI" },
  { file: "schema.sql",           kind: "db_schema", label: "ShopFlow MySQL schema" },
  { file: "srs.md",               kind: "srs",       label: "ShopFlow existing-system brief" },
  { file: "adr-0001-monolith.md", kind: "adr",       label: "ADR-0001 Keep monolith" },
  { file: "adr-0007-mysql.md",    kind: "adr",       label: "ADR-0007 Stay on MySQL" },
];

const log = (s: string) => console.log(`[demo] ${s}`);

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

  log(`signing in as ${EMAIL}`);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
  if (authErr || !auth.session) throw new Error(`auth failed: ${authErr?.message}`);
  const token = auth.session.access_token;
  const userId = auth.user!.id;

  if (!PROJECT_ID) {
    log("creating brownfield project 'ShopFlow Demo'");
    const { data: proj, error } = await supabase.from("projects").insert({
      name: "ShopFlow Demo", description: "Auto-seeded brownfield demo", mode: "brownfield", owner_id: userId,
    }).select("id").single();
    if (error) throw error;
    PROJECT_ID = proj.id;
  }
  log(`project ${PROJECT_ID}`);

  log("uploading demo pack");
  let uploaded = 0;
  for (const item of DEMO_PACK) {
    const bytes = readFileSync(resolve(DEMO_DIR, item.file));
    const path = `${PROJECT_ID}/${Date.now()}-${item.file}`;
    const { error: upErr } = await supabase.storage.from("project-imports")
      .upload(path, bytes, { contentType: "text/plain", upsert: false });
    if (upErr) { log(`  ! upload ${item.file}: ${upErr.message}`); continue; }
    const { error: insErr } = await supabase.from("project_imports").insert({
      project_id: PROJECT_ID, kind: item.kind, source_label: item.label, storage_path: path, created_by: userId,
    });
    if (insErr) { log(`  ! insert ${item.file}: ${insErr.message}`); continue; }
    uploaded++;
  }
  log(`uploaded ${uploaded}/${DEMO_PACK.length} artifacts`);

  const callFn = async (name: string, body: unknown) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    const j = t ? JSON.parse(t) : {};
    if (!r.ok) throw new Error(`${name} failed: ${j.error || r.status}`);
    return j;
  };

  log("→ reverse-engineer");
  const re = await callFn("reverse-engineer", { project_id: PROJECT_ID });
  log(`  parsed=${(re.results || []).filter((r: any) => r.status === "parsed").length} failed=${(re.results || []).filter((r: any) => r.status === "failed").length}`);

  log("→ gap-analyzer");
  const ga = await callFn("gap-analyzer", { project_id: PROJECT_ID, replace: true });
  log(`  gaps=${ga.gap_count}`);

  log("→ drift-detect");
  const dd = await callFn("drift-detect", { project_id: PROJECT_ID });
  const totalDrift = (dd.results || []).reduce((n: number, r: any) =>
    n + (r.diff?.added?.length || 0) + (r.diff?.removed?.length || 0), 0);
  log(`  drift findings=${totalDrift}`);

  log("done. summary:");
  console.log(JSON.stringify({
    project_id: PROJECT_ID,
    imports_uploaded: uploaded,
    reverse_engineer: re.processed,
    gaps: ga.gap_count,
    drift: dd.results,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
