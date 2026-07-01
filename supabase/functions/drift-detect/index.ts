// Drift Detection Agent (Brownfield Stage 18)
// Re-parses fresh imports for a project and diffs against the locked baseline
// artifacts produced by reverse-engineer (Stages 6, 7, 8, 10). Returns a
// structured diff that the UI lets the user resolve as either:
//   1. "Re-baseline" — overwrite the locked artifact with the new state, OR
//   2. "Save as ADR" — record the change as a new Stage 14 ADR.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import yaml from "npm:js-yaml@4.1.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Parsers (mirror reverse-engineer) ----------
function parseOpenAPI(text: string) {
  let spec: any;
  try { spec = JSON.parse(text); } catch {
    try { spec = yaml.load(text); } catch { return null; }
  }
  if (!spec?.paths) return null;
  const endpoints: { path: string; method: string }[] = [];
  for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
    for (const m of Object.keys(methods || {})) {
      if (["get", "post", "put", "patch", "delete"].includes(m)) {
        endpoints.push({ path: p, method: m.toUpperCase() });
      }
    }
  }
  return {
    title: spec.info?.title || "API",
    version: spec.info?.version || "",
    endpoints,
    schemas: Object.keys(spec.components?.schemas || spec.definitions || {}),
  };
}

function parseSqlDdl(text: string) {
  const tables: { name: string; columns: string[] }[] = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([\w.]+)["`]?\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].split(".").pop()!;
    const columns = m[2].split(/,(?![^()]*\))/g)
      .map((c) => c.trim().split(/\s+/)[0].replace(/["`]/g, ""))
      .filter((c) => c && !/^(primary|foreign|unique|constraint|check|key|index)$/i.test(c));
    tables.push({ name, columns });
  }
  return { tables };
}

async function parseRepoZip(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const files: string[] = [];
  zip.forEach((p, f) => { if (!f.dir) files.push(p); });
  const components: { name: string; path: string; kind: string }[] = [];
  const dirCounts = new Map<string, number>();
  files.forEach((f) => {
    const parts = f.split("/");
    if (parts.length >= 2) {
      const k = parts.slice(0, 2).join("/");
      dirCounts.set(k, (dirCounts.get(k) || 0) + 1);
    }
  });
  Array.from(dirCounts.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([path]) => {
      const name = path.split("/").pop()!;
      const kind = /api|server|backend/i.test(path) ? "service"
        : /web|client|ui|frontend/i.test(path) ? "frontend"
        : /lib|shared|core/i.test(path) ? "library"
        : "module";
      components.push({ name, path, kind });
    });
  const infra = {
    docker: files.some((f) => /(^|\/)Dockerfile$/i.test(f) || /docker-compose/i.test(f)),
    kubernetes: files.some((f) => /\.ya?ml$/i.test(f) && /(deployment|service|ingress|kustom)/i.test(f)),
    terraform: files.some((f) => f.endsWith(".tf")),
    github_actions: files.some((f) => f.startsWith(".github/workflows/")),
  };
  return { components, infra, fileCount: files.length };
}

// ---------- Diff helpers ----------
function diffSets<T>(oldArr: T[], newArr: T[], key: (v: T) => string) {
  const o = new Map(oldArr.map((v) => [key(v), v]));
  const n = new Map(newArr.map((v) => [key(v), v]));
  const added: T[] = [];
  const removed: T[] = [];
  for (const [k, v] of n) if (!o.has(k)) added.push(v);
  for (const [k, v] of o) if (!n.has(k)) removed.push(v);
  return { added, removed };
}

function diffApi(baseline: any, fresh: any) {
  const b = baseline?.endpoints || [];
  const f = fresh.endpoints || [];
  const { added, removed } = diffSets(b, f, (e: any) => `${e.method} ${e.path}`);
  const schemas = diffSets<string>(baseline?.schemas || [], fresh.schemas, (s) => s);
  return { endpoints_added: added, endpoints_removed: removed, schemas_added: schemas.added, schemas_removed: schemas.removed };
}

function diffData(baseline: any, fresh: any) {
  const b = baseline?.tables || [];
  const f = fresh.tables || [];
  const tableDiff = diffSets(b, f, (t: any) => t.name);
  const columnChanges: { table: string; added: string[]; removed: string[] }[] = [];
  const baseByName = new Map(b.map((t: any) => [t.name, t]));
  for (const t of f) {
    const old = baseByName.get(t.name) as any;
    if (!old) continue;
    const c = diffSets<string>(old.columns || [], t.columns || [], (x) => x);
    if (c.added.length || c.removed.length) {
      columnChanges.push({ table: t.name, added: c.added, removed: c.removed });
    }
  }
  return { tables_added: tableDiff.added, tables_removed: tableDiff.removed, column_changes: columnChanges };
}

function diffRepo(baseline: any, fresh: any) {
  const c = diffSets(baseline?.components || [], fresh.components, (x: any) => x.path);
  const infraChanges: Record<string, { from: boolean; to: boolean }> = {};
  const oldInfra = baseline?.signals || baseline?.infra || {};
  for (const k of Object.keys(fresh.infra)) {
    if (!!oldInfra[k] !== !!fresh.infra[k]) {
      infraChanges[k] = { from: !!oldInfra[k], to: !!fresh.infra[k] };
    }
  }
  return { components_added: c.added, components_removed: c.removed, infra_changes: infraChanges };
}

async function downloadImport(supabase: any, storagePath: string) {
  const { data, error } = await supabase.storage.from("project-imports").download(storagePath);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  return { bytes: buf, text: new TextDecoder("utf-8", { fatal: false }).decode(buf) };
}

async function getBaseline(supabase: any, projectId: string, stage: number) {
  const { data } = await supabase
    .from("architecture_artifacts")
    .select("id, content, locked_at, version, title")
    .eq("project_id", projectId)
    .eq("stage", stage)
    .order("locked_at", { ascending: false, nullsFirst: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return ok({ error: "Missing authorization" }, 401);
    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user) return ok({ error: "Unauthorized" }, 401);

    const { project_id, import_ids } = await req.json();
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    let q = supabase.from("project_imports").select("*").eq("project_id", project_id);
    if (Array.isArray(import_ids) && import_ids.length) q = q.in("id", import_ids);
    const { data: imports } = await q;
    if (!imports?.length) return ok({ message: "No imports available", drifts: [], findings_created: 0 });

    const drifts: any[] = [];
    const scanRunId = crypto.randomUUID();
    const findingsToInsert: any[] = [];

    const pushFindings = (d: any) => {
      const x = d.diff || {};
      const base = {
        project_id,
        import_id: d.import_id,
        baseline_artifact_id: d.baseline_artifact_id,
        stage: d.stage,
        kind: d.kind,
        source_label: d.source_label,
        scan_run_id: scanRunId,
        fresh_snapshot: d.fresh,
      };
      const add = (rows: any[]) => rows.forEach((r) => findingsToInsert.push(r));

      add((x.endpoints_added || []).map((e: any) => ({
        ...base, category: "added", entity_type: "endpoint",
        entity_ref: `${e.method} ${e.path}`, severity: "medium", details: e,
      })));
      add((x.endpoints_removed || []).map((e: any) => ({
        ...base, category: "removed", entity_type: "endpoint",
        entity_ref: `${e.method} ${e.path}`, severity: "high", details: e,
      })));
      add((x.schemas_added || []).map((s: string) => ({
        ...base, category: "added", entity_type: "schema", entity_ref: s, severity: "low", details: { name: s },
      })));
      add((x.schemas_removed || []).map((s: string) => ({
        ...base, category: "removed", entity_type: "schema", entity_ref: s, severity: "high", details: { name: s },
      })));
      add((x.tables_added || []).map((t: any) => ({
        ...base, category: "added", entity_type: "table",
        entity_ref: t.name, severity: "medium", details: t,
      })));
      add((x.tables_removed || []).map((t: any) => ({
        ...base, category: "removed", entity_type: "table",
        entity_ref: t.name, severity: "high", details: t,
      })));
      add((x.column_changes || []).map((c: any) => ({
        ...base, category: "changed", entity_type: "table_columns",
        entity_ref: c.table, severity: c.removed?.length ? "high" : "medium", details: c,
      })));
      add((x.components_added || []).map((c: any) => ({
        ...base, category: "added", entity_type: "component",
        entity_ref: c.path || c.name, severity: "low", details: c,
      })));
      add((x.components_removed || []).map((c: any) => ({
        ...base, category: "removed", entity_type: "component",
        entity_ref: c.path || c.name, severity: "medium", details: c,
      })));
      Object.entries(x.infra_changes || {}).forEach(([k, v]: [string, any]) => {
        findingsToInsert.push({
          ...base, category: "changed", entity_type: "infra_signal",
          entity_ref: k, severity: "medium", details: v,
        });
      });
    };

    for (const imp of imports as any[]) {
      if (!imp.storage_path) continue;
      const dl = await downloadImport(supabase, imp.storage_path);
      if (!dl) continue;

      try {
        if (imp.kind === "openapi") {
          const fresh = parseOpenAPI(dl.text);
          if (!fresh) continue;
          const baseline = await getBaseline(supabase, project_id, 8);
          const diff = diffApi(baseline?.content, fresh);
          const hasChanges =
            diff.endpoints_added.length || diff.endpoints_removed.length ||
            diff.schemas_added.length || diff.schemas_removed.length;
          if (hasChanges || !baseline) {
            const d = {
              stage: 8, kind: "api_design", import_id: imp.id, source_label: imp.source_label,
              baseline_artifact_id: baseline?.id || null, baseline_locked_at: baseline?.locked_at || null,
              fresh, diff,
            };
            drifts.push(d);
            pushFindings(d);
          }
        } else if (imp.kind === "db_schema") {
          const fresh = parseSqlDdl(dl.text);
          const baseline = await getBaseline(supabase, project_id, 7);
          const diff = diffData(baseline?.content, fresh);
          const hasChanges =
            diff.tables_added.length || diff.tables_removed.length || diff.column_changes.length;
          if (hasChanges || !baseline) {
            const d = {
              stage: 7, kind: "data_architecture", import_id: imp.id, source_label: imp.source_label,
              baseline_artifact_id: baseline?.id || null, baseline_locked_at: baseline?.locked_at || null,
              fresh, diff,
            };
            drifts.push(d);
            pushFindings(d);
          }
        } else if (imp.kind === "repo") {
          const fresh = await parseRepoZip(dl.bytes);
          const baseline = await getBaseline(supabase, project_id, 6);
          const diff = diffRepo(baseline?.content, fresh);
          const hasChanges =
            diff.components_added.length || diff.components_removed.length ||
            Object.keys(diff.infra_changes).length;
          if (hasChanges || !baseline) {
            const d = {
              stage: 6, kind: "decomposition", import_id: imp.id, source_label: imp.source_label,
              baseline_artifact_id: baseline?.id || null, baseline_locked_at: baseline?.locked_at || null,
              fresh, diff,
            };
            drifts.push(d);
            pushFindings(d);
          }
        }
      } catch (e: any) {
        drifts.push({ import_id: imp.id, source_label: imp.source_label, error: e?.message?.slice(0, 300) });
      }
    }

    // Persist findings: clear prior open findings for this project, insert fresh batch.
    let findingsCreated = 0;
    try {
      await supabase.from("drift_findings").delete()
        .eq("project_id", project_id).eq("status", "open");
      if (findingsToInsert.length) {
        const { error: insErr, data: inserted } = await supabase
          .from("drift_findings").insert(findingsToInsert).select("id");
        if (insErr) console.error("drift_findings insert error", insErr);
        else findingsCreated = inserted?.length ?? findingsToInsert.length;
      }
    } catch (persistErr) {
      console.error("drift persistence failed", persistErr);
    }

    return ok({ drifts, scanned: imports.length, scan_run_id: scanRunId, findings_created: findingsCreated });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
