#!/usr/bin/env node
/**
 * End-to-end: GitHub import → reverse-engineer → feature change → Change Package
 * Usage: node scripts/sauna-feature-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(name) {
  const p = resolve(root, name);
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const FEATURE = {
  title: "Session timer + steamer humidity",
  description:
    "Extend the sauna controller with a countdown session timer (default 30 min) and a steamer subsystem that tracks humidity level and exposes it on the UI dial.",
  current_behavior:
    "Sauna heats to target temperature with power toggle. State API returns temperature, target, power, ready/heating/cooling status. No session duration or humidity.",
  desired_behavior:
    "User can start a timed session (default 30 min, configurable). UI shows remaining time. Steamer can be toggled; humidity (0–100%) appears on dial and in /api/state. Thermal sim continues to work.",
  change_type: "modify",
  priority: "high",
};

async function invoke(client, fn, body) {
  const { data, error } = await client.functions.invoke(fn, { body });
  if (error) throw new Error(`${fn}: ${error.message}`);
  if (data?.error) throw new Error(`${fn}: ${data.error}`);
  return data;
}

async function main() {
  if (!ANON || !SERVICE) {
    console.error("Missing Supabase keys. Run npm run db:env");
    process.exit(1);
  }

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const user = createClient(URL, ANON, { auth: { persistSession: false } });

  const { error: authErr } = await user.auth.signInWithPassword({
    email: process.env.E2E_EMAIL || "admin@timearch.local",
    password: process.env.E2E_PASSWORD || "timearch-admin-123",
  });
  if (authErr) throw authErr;
  const uid = (await user.auth.getUser()).data.user.id;
  console.log("✓ Signed in as admin");

  const { data: proj, error: pErr } = await admin
    .from("projects")
    .insert({
      name: "Sauna — session timer & steamer",
      description: "Brownfield demo: anse-proj/sauna-demo-app with feature addition",
      owner_id: uid,
      mode: "brownfield",
      current_stage: 0,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;
  await admin.from("project_members").insert({ project_id: proj.id, user_id: uid, role: "architect" });
  console.log(`✓ Project created: ${proj.id}`);

  const gh = await invoke(user, "fetch-github-repo", {
    project_id: proj.id,
    repo_url: "https://github.com/anse-proj/sauna-demo-app",
  });
  console.log(`✓ GitHub import: ${gh.uploaded}/${gh.discovered} files (${JSON.stringify(gh.kinds)})`);

  const rev = await invoke(user, "reverse-engineer", { project_id: proj.id });
  const parsed = rev.results?.filter((r) => r.status === "parsed").length ?? 0;
  console.log(`✓ Reverse-engineered: ${parsed} files`);

  const { data: fc, error: fcErr } = await admin
    .from("feature_changes")
    .insert({
      project_id: proj.id,
      ...FEATURE,
      status: "draft",
      is_active: true,
      created_by: uid,
    })
    .select("id")
    .single();
  if (fcErr) throw fcErr;
  console.log(`✓ Feature change: ${fc.id}`);

  const stages = [
    ["score-feature-changes", { project_id: proj.id, feature_change_ids: [fc.id] }, "scored"],
    ["map-feature-to-architecture", { feature_change_id: fc.id, replace: true }, "mapping_count"],
    ["analyze-ripple", { feature_change_id: fc.id, replace: true }, "impact_count"],
    ["assess-quality-impact", { feature_change_id: fc.id, replace: true }, "assessment_count"],
    ["generate-alternatives", { feature_change_id: fc.id, replace: true }, "alternative_count"],
    ["plan-feature-implementation", { feature_change_id: fc.id, replace: true }, "work_item_count"],
  ];

  for (const [fn, body, key] of stages) {
    process.stdout.write(`  → ${fn}… `);
    const res = await invoke(user, fn, body);
    console.log(`${key}=${res[key] ?? "ok"}`);
  }

  const { data: workItems } = await admin
    .from("feature_work_items")
    .select("ordering,title,category,priority,effort,description")
    .eq("feature_change_id", fc.id)
    .order("ordering");

  const { data: mappings } = await admin
    .from("feature_mappings")
    .select("element_type,element_ref,relationship,confidence")
    .eq("feature_change_id", fc.id);

  const { data: ripples } = await admin
    .from("impact_findings")
    .select("impacted_element_ref,severity,classification")
    .eq("feature_change_id", fc.id);

  console.log("\n══════════════════════════════════════════");
  console.log("CHANGE PACKAGE SUMMARY");
  console.log("══════════════════════════════════════════");
  console.log(`Project:  ${proj.id}`);
  console.log(`Open UI:  http://localhost:8082/project/${proj.id}`);
  console.log(`Feature:  ${FEATURE.title}`);
  console.log(`Mappings: ${mappings?.length ?? 0}`);
  console.log(`Ripples:  ${ripples?.length ?? 0}`);
  console.log(`Tasks:    ${workItems?.length ?? 0}`);
  console.log("\n── Work items ──");
  for (const w of workItems || []) {
    console.log(`${w.ordering}. [${w.category}/${w.effort}] ${w.title}`);
  }
  console.log("\n── Architecture mappings ──");
  for (const m of mappings || []) {
    console.log(`  ${m.relationship} ${m.element_type}: ${m.element_ref} (${Math.round((m.confidence || 0) * 100)}%)`);
  }
  console.log("\nDone. Open Discovery → Step 3 to view the Change Package in the UI.");
}

main().catch((e) => {
  console.error("FAILED:", e.message || e);
  process.exit(1);
});
