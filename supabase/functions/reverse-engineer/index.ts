// Reverse-Engineering Agent (Brownfield Stage 0 → seed Stages 1, 6, 7, 8, 10)
// Parses uploaded project_imports and creates as-is architecture_artifacts
// (and Stage-1 requirements) marked needs_human_confirmation=true.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import yaml from "npm:js-yaml@4.1.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ImportKind = "repo" | "openapi" | "db_schema" | "adr" | "srs" | "diagram" | "other";

interface ImportRow {
  id: string;
  project_id: string;
  kind: ImportKind;
  source_label: string;
  storage_path: string | null;
  source_url: string | null;
  status: string;
}

type Confidence = "low" | "med" | "high";

const PROVENANCE_META = (
  kind: string,
  sourceLabel: string,
  extra: { confidence?: Confidence; extractor?: string; source_import_ids?: string[] } = {},
) => ({
  provenance: "reverse-engineered" as const,
  needs_human_confirmation: true,
  source_kind: kind,
  source_label: sourceLabel,
  generated_at: new Date().toISOString(),
  confidence: extra.confidence ?? "med",
  extractor: extra.extractor ?? "heuristic",
  source_import_ids: extra.source_import_ids ?? [],
});

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function downloadImport(supabase: any, imp: ImportRow): Promise<{ bytes: Uint8Array; text: string } | null> {
  if (!imp.storage_path) return null;
  const { data, error } = await supabase.storage.from("project-imports").download(imp.storage_path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  let text = "";
  try { text = new TextDecoder("utf-8", { fatal: false }).decode(buf); } catch { /* binary */ }
  return { bytes: buf, text };
}

// ---------- OpenAPI parser ----------
function parseOpenAPI(text: string) {
  let spec: any;
  try { spec = JSON.parse(text); } catch {
    try { spec = yaml.load(text); } catch { return null; }
  }
  if (!spec || typeof spec !== "object") return null;
  const endpoints: any[] = [];
  const paths = spec.paths || {};
  for (const [p, methods] of Object.entries<any>(paths)) {
    for (const [m, op] of Object.entries<any>(methods || {})) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      endpoints.push({
        path: p,
        method: m.toUpperCase(),
        summary: op?.summary || op?.operationId || "",
        tags: op?.tags || [],
      });
    }
  }
  return {
    title: spec.info?.title || "API",
    version: spec.info?.version || "",
    endpoints,
    schemas: Object.keys(spec.components?.schemas || spec.definitions || {}),
  };
}

// ---------- SQL DDL parser ----------
function parseSqlDdl(text: string) {
  const tables: { name: string; columns: string[] }[] = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([\w.]+)["`]?\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].split(".").pop()!;
    const body = m[2];
    const columns = body
      .split(/,(?![^()]*\))/g)
      .map((c) => c.trim().split(/\s+/)[0].replace(/["`]/g, ""))
      .filter((c) => c && !/^(primary|foreign|unique|constraint|check|key|index)$/i.test(c));
    tables.push({ name, columns });
  }
  return { tables };
}

// ---------- Repo parsers ----------
function isZipBytes(b: Uint8Array): boolean {
  // PK\x03\x04 (or PK\x05\x06 empty / PK\x07\x08 spanned)
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);
}

function inferComponentKind(path: string): string {
  return /api|server|backend/i.test(path) ? "service"
    : /web|client|ui|frontend/i.test(path) ? "frontend"
    : /lib|shared|core/i.test(path) ? "library"
    : "module";
}

function inferLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
    cs: "C#", php: "PHP", swift: "Swift", c: "C", cpp: "C++", h: "C/C++ header",
  };
  return map[ext] ?? null;
}

function filenameFromImport(imp: ImportRow): string {
  if (imp.storage_path) {
    const seg = imp.storage_path.split("/").pop() || "";
    const dash = seg.indexOf("-");
    if (dash > 0 && /^\d+$/.test(seg.slice(0, dash))) {
      return seg.slice(dash + 1).replace(/__/g, "/");
    }
    return seg.replace(/__/g, "/");
  }
  return imp.source_label || "file";
}

/** Extract symbols from source in multiple languages. */
function extractSymbols(text: string, filename: string): { exports: string[]; imports: string[] } {
  const lower = filename.toLowerCase();
  let exports: string[] = [];
  let imports: string[] = [];

  if (/\.py$/.test(lower)) {
    exports = (text.match(/^\s*(?:async\s+)?def\s+(\w+)|^\s*class\s+(\w+)/gm) || [])
      .map((s) => s.match(/(?:def|class)\s+(\w+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
    imports = (text.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm) || [])
      .map((s) => s.match(/from\s+([\w.]+)|import\s+([\w.]+)/)?.[1] || s.match(/import\s+([\w.]+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
  } else if (/\.(java|kt)$/.test(lower)) {
    exports = (text.match(/(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum|record)\s+(\w+)/g) || [])
      .map((s) => s.match(/(?:class|interface|enum|record)\s+(\w+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
    imports = (text.match(/^import\s+(?:static\s+)?([\w.]+);/gm) || [])
      .map((s) => s.match(/import\s+(?:static\s+)?([\w.]+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
  } else if (/\.cs$/.test(lower)) {
    exports = (text.match(/(?:public|internal|private)?\s*(?:static\s+)?(?:class|interface|enum|record|struct)\s+(\w+)/g) || [])
      .map((s) => s.match(/(?:class|interface|enum|record|struct)\s+(\w+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
    imports = (text.match(/^using\s+([\w.]+);/gm) || [])
      .map((s) => s.match(/using\s+([\w.]+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
  } else if (/\.go$/.test(lower)) {
    exports = (text.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/gm) || [])
      .map((s) => s.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
    imports = (text.match(/^import\s+(?:\([\s\S]*?\)|"([^"]+)")/gm) || [])
      .flatMap((block) => [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
      .slice(0, 40);
  } else if (/\.html?$/.test(lower)) {
    exports = (text.match(/\bid=["']([^"']+)["']/g) || [])
      .map((s) => s.match(/id=["']([^"']+)["']/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 20);
  } else {
    exports = (text.match(/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm) || [])
      .map((s) => s.match(/(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
    imports = (text.match(/^\s*import\s+[^;]+from\s+["']([^"']+)["']/gm) || [])
      .map((s) => s.match(/from\s+["']([^"']+)["']/)?.[1])
      .filter((x): x is string => !!x)
      .slice(0, 40);
  }
  return { exports, imports };
}

/** Fallback for repo imports that are single source files, not zip archives. */
function parseRepoSingleFile(text: string, filename: string) {
  const lines = text.split(/\r?\n/);
  const { exports, imports } = extractSymbols(text, filename);

  const name = filename.split("/").pop()!.replace(/\.[^.]+$/, "");
  const kind = inferComponentKind(filename);
  const lang = inferLanguage(filename);

  const infra = {
    docker: /dockerfile/i.test(filename),
    kubernetes: false,
    terraform: filename.endsWith(".tf"),
    github_actions: /\.github\/workflows\//.test(filename),
    package_json: /package\.json$/.test(filename),
    requirements_txt: /requirements\.txt$/.test(filename),
  };

  return {
    fileCount: 1,
    topDirs: filename.includes("/") ? [filename.split("/")[0]] : [],
    languages: lang ? { [lang]: 1 } : {},
    components: [{ name, path: filename, kind, language: lang, exports, imports }],
    infra,
    file_summary: { lines: lines.length, exports: exports.length, imports: imports.length },
  };
}

async function parseRepoZip(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const files: string[] = [];
  zip.forEach((p, f) => { if (!f.dir) files.push(p); });
  const topDirs = new Set<string>();
  files.forEach((f) => { const seg = f.split("/"); if (seg.length > 1) topDirs.add(seg[0]); });

  const langs: Record<string, number> = {};
  files.forEach((f) => {
    const ext = f.split(".").pop()?.toLowerCase() || "";
    if (ext) langs[ext] = (langs[ext] || 0) + 1;
  });

  // Heuristic component detection
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
      const kind = inferComponentKind(path);
      components.push({ name, path, kind });
    });

  // Infra signals
  const infra = {
    docker: files.some((f) => /^|\/Dockerfile$/i.test(f) || /docker-compose/i.test(f)),
    kubernetes: files.some((f) => /\.ya?ml$/i.test(f) && /(deployment|service|ingress|kustom)/i.test(f)),
    terraform: files.some((f) => f.endsWith(".tf")),
    github_actions: files.some((f) => f.startsWith(".github/workflows/")),
    package_json: files.some((f) => /(^|\/)package\.json$/.test(f)),
    requirements_txt: files.some((f) => /requirements\.txt$/.test(f)),
  };

  return { fileCount: files.length, topDirs: [...topDirs], languages: langs, components, infra };
}

// ---------- SRS / text doc → requirements ----------
function parseSrsRequirements(text: string) {
  const lines = text.split(/\r?\n/);
  const items: { title: string; description: string }[] = [];
  const seen = new Set<string>();

  const add = (title: string, description: string) => {
    const t = title.trim().slice(0, 120);
    if (t.length < 6 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    items.push({ title: t, description: description.trim().slice(0, 2000) });
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const bullet = ln.match(/^\s*(?:[-*]\s+|\d+[.)]\s+|REQ[-_]?\d+[:.\s]+)(.{8,})$/i);
    if (bullet) {
      add(bullet[1], bullet[1]);
      continue;
    }
    const heading = ln.match(/^#{1,3}\s+(.{6,})$/);
    if (heading) {
      const title = heading[1].replace(/[#*`]/g, "").trim();
      const body: string[] = [];
      for (let j = i + 1; j < lines.length && j < i + 8; j++) {
        if (/^#{1,3}\s+/.test(lines[j])) break;
        const t = lines[j].trim();
        if (t && !/^[-|]/.test(t)) body.push(t);
      }
      add(title, body.join(" ") || title);
    }
    if (items.length >= 50) break;
  }
  return items;
}

function parseManifest(text: string, filename: string) {
  const lower = filename.toLowerCase();
  if (/package\.json$/.test(lower)) {
    try {
      const pkg = JSON.parse(text);
      return {
        type: "npm",
        name: pkg.name,
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: Object.keys(pkg.scripts || {}),
      };
    } catch { return null; }
  }
  if (/requirements\.txt$/.test(lower)) {
    const deps = text.split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/[=<>!\[]/)[0].trim());
    return { type: "pip", dependencies: deps };
  }
  if (/pyproject\.toml$/.test(lower)) {
    const deps = [...text.matchAll(/^[\w-]+(?:\s*=\s*"[^"]+"|\s*=\s*\{)/gm)].map((m) => m[0].split("=")[0].trim());
    return { type: "python-project", hints: deps.slice(0, 30) };
  }
  return null;
}

async function seedManifest(
  supabase: any, projectId: string, userId: string, imp: ImportRow, manifest: any,
) {
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 10,
    type: "diagram",
    title: `[As-Is] Dependency manifest: ${imp.source_label}`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, {
        extractor: "manifest-parser",
        confidence: "high",
        source_import_ids: [imp.id],
      }),
      summary: `Parsed ${manifest.type} manifest from ${imp.source_label}.`,
      manifest,
    },
  });
  const deps = manifest.dependencies || manifest.devDependencies || [];
  const reqRows = (Array.isArray(deps) ? deps : []).slice(0, 15).map((d: string) => ({
    title: `Dependency: ${d}`,
    description: `Third-party package ${d} declared in ${imp.source_label}.`,
    type: "non-functional",
    category: "Dependencies",
    origin: { type: "manifest_dependency", name: d, manifest: manifest.type },
  }));
  return await insertReqs(supabase, projectId, userId, imp, reqRows);
}

// ---------- Seeders ----------
async function nextReqIndex(supabase: any, projectId: string) {
  const { data: existing } = await supabase
    .from("requirements").select("requirement_id").eq("project_id", projectId);
  return (existing?.length || 0) + 1;
}

async function insertReqs(
  supabase: any, projectId: string, userId: string, imp: ImportRow,
  rows: Array<{ title: string; description: string; type?: string; priority?: string; category?: string; origin?: any }>,
) {
  if (!rows.length) return 0;
  let next = await nextReqIndex(supabase, projectId);
  const payload = rows.map((r) => ({
    project_id: projectId,
    requirement_id: `RE-${String(next++).padStart(3, "0")}`,
    title: r.title.slice(0, 200),
    description: r.description,
    type: (r.type as any) || "functional",
    priority: (r.priority as any) || "medium",
    category: r.category || null,
    status: "draft",
    source: `reverse-engineered:${imp.source_label}`,
    created_by: userId,
    acceptance_criteria: {
      _meta: {
        ...PROVENANCE_META(imp.kind, imp.source_label),
        import_id: imp.id,
        origin: r.origin ?? null,
      },
    },
  }));
  const { error } = await supabase.from("requirements").insert(payload);
  if (error) console.error("insertReqs error", error);
  return payload.length;
}

async function seedApi(supabase: any, projectId: string, userId: string, imp: ImportRow, parsed: any) {
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 8,
    type: "api_design",
    title: `[As-Is] ${parsed.title} (reverse-engineered)`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "openapi", confidence: parsed.endpoints.length >= 3 ? "high" : parsed.endpoints.length > 0 ? "med" : "low", source_import_ids: [imp.id] }),
      summary: `Imported from ${imp.source_label}. ${parsed.endpoints.length} endpoints, ${parsed.schemas.length} schemas.`,
      api_version: parsed.version,
      endpoints: parsed.endpoints,
      schemas: parsed.schemas,
    },
  });
  const eps = (parsed.endpoints || []).slice(0, 40);
  const reqRows = eps.map((e: any) => ({
    title: `${e.method} ${e.path}${e.summary ? ` — ${e.summary}` : ""}`,
    description: `API capability derived from ${parsed.title}${e.tags?.length ? ` (tags: ${e.tags.join(", ")})` : ""}. Endpoint: ${e.method} ${e.path}.`,
    type: "functional",
    category: e.tags?.[0] || "API",
    origin: {
      type: "openapi_endpoint",
      method: e.method,
      path: e.path,
      summary: e.summary ?? null,
      tags: e.tags ?? [],
      api_title: parsed.title,
    },
  }));
  return await insertReqs(supabase, projectId, userId, imp, reqRows);
}

async function seedData(supabase: any, projectId: string, userId: string, imp: ImportRow, parsed: any) {
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 7,
    type: "data_architecture",
    title: `[As-Is] Database Schema (reverse-engineered)`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "sql-ddl", confidence: parsed.tables.length >= 3 ? "high" : parsed.tables.length > 0 ? "med" : "low", source_import_ids: [imp.id] }),
      summary: `Imported from ${imp.source_label}. ${parsed.tables.length} tables detected.`,
      tables: parsed.tables,
    },
  });
  const tables = (parsed.tables || []).slice(0, 30);
  const reqRows = tables.map((t: any) => ({
    title: `Persist and manage ${t.name} records`,
    description: `Data capability derived from table ${t.name} (${(t.columns || []).length} columns).`,
    type: "functional",
    category: "Data",
    origin: {
      type: "db_table",
      table: t.name,
      columns: (t.columns || []).map((c: any) => c.name ?? c).slice(0, 50),
      column_count: (t.columns || []).length,
    },
  }));
  return await insertReqs(supabase, projectId, userId, imp, reqRows);
}

async function seedRepo(supabase: any, projectId: string, userId: string, imp: ImportRow, parsed: any) {
  // Stage 6 — decomposition
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 6,
    type: "decomposition",
    title: `[As-Is] Component Decomposition (reverse-engineered)`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "repo-scan", confidence: parsed.components.length >= 5 ? "high" : parsed.components.length >= 2 ? "med" : "low", source_import_ids: [imp.id] }),
      summary: `Imported from ${imp.source_label}. ${parsed.components.length} components inferred from ${parsed.fileCount} files.`,
      components: parsed.components,
      top_level_directories: parsed.topDirs,
      languages: parsed.languages,
    },
  });
  // Stage 10 — infrastructure
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 10,
    type: "diagram",
    title: `[As-Is] Infrastructure Signals (reverse-engineered)`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "infra-signals", confidence: Object.values(parsed.infra).filter(Boolean).length >= 2 ? "high" : "med", source_import_ids: [imp.id] }),
      summary: `Detected build/deploy signals from ${imp.source_label}.`,
      signals: parsed.infra,
    },
  });
  const comps = (parsed.components || []).slice(0, 20);
  const reqRows = comps.map((c: any) => ({
    title: `Maintain ${c.kind} component: ${c.name}`,
    description: `Capability inferred from repository component ${c.path} (${c.kind}).`,
    type: "functional",
    category: c.kind,
    origin: {
      type: "repo_component",
      name: c.name,
      path: c.path,
      kind: c.kind,
      language: c.language ?? null,
    },
  }));
  return await insertReqs(supabase, projectId, userId, imp, reqRows);
}

async function seedSrs(supabase: any, projectId: string, userId: string, imp: ImportRow, items: { title: string; description: string }[]) {
  if (!items.length) return 0;
  // Find next requirement_id index
  const { data: existing } = await supabase
    .from("requirements").select("requirement_id").eq("project_id", projectId);
  let next = (existing?.length || 0) + 1;
  const rows = items.map((it) => ({
    project_id: projectId,
    requirement_id: `RE-${String(next++).padStart(3, "0")}`,
    title: it.title,
    description: it.description,
    type: "functional",
    priority: "medium",
    status: "draft",
    source: `reverse-engineered:${imp.source_label}`,
    created_by: userId,
    acceptance_criteria: { _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "srs-regex", confidence: "low", source_import_ids: [imp.id] }) },
  }));
  await supabase.from("requirements").insert(rows);
  return rows.length;
}

async function seedAdr(supabase: any, projectId: string, userId: string, imp: ImportRow, text: string) {
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 14,
    type: "adr",
    title: `[As-Is] ADR: ${imp.source_label}`,
    status: "draft",
    generated_by: "Reverse-Engineering Agent",
    created_by: userId,
    content: {
      _meta: PROVENANCE_META(imp.kind, imp.source_label, { extractor: "adr-raw", confidence: "med", source_import_ids: [imp.id] }),
      raw_markdown: text.slice(0, 50000),
    },
  });
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

    const { project_id, import_id, reprocess } = await req.json();
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Membership check
    const { data: isMember } = await supabase.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    // If reprocess: wipe prior reverse-engineered artifacts + requirements for this project so we get a clean re-derivation.
    if (reprocess) {
      await supabase.from("requirements").delete()
        .eq("project_id", project_id).like("source", "reverse-engineered:%");
      const { data: oldArts } = await supabase.from("architecture_artifacts")
        .select("id,content").eq("project_id", project_id);
      const reIds = (oldArts || [])
        .filter((a: any) => a.content?._meta?.provenance === "reverse-engineered")
        .map((a: any) => a.id);
      if (reIds.length) await supabase.from("architecture_artifacts").delete().in("id", reIds);
    }

    let q = supabase.from("project_imports").select("*").eq("project_id", project_id);
    if (import_id) q = q.eq("id", import_id);
    else if (!reprocess) q = q.in("status", ["pending", "failed"]);
    const { data: imports, error: impErr } = await q;
    if (impErr) return ok({ error: impErr.message }, 200);
    // Nothing pending: report already-parsed count so the UI does not say "Read 0 files".
    if (!imports?.length) {
      const { data: existing } = await supabase
        .from("project_imports")
        .select("id,kind,status")
        .eq("project_id", project_id);
      const already = (existing || []).filter((i: any) => i.status === "parsed");
      return ok({
        message: "No imports to process",
        processed: 0,
        results: already.map((i: any) => ({
          id: i.id,
          kind: i.kind,
          status: "already_parsed",
        })),
      });
    }

    const results: any[] = [];
    for (const imp of imports as ImportRow[]) {
      try {
        // URL-only (e.g. GitHub link): mark parsed with note, no fetching in M2.
        if (!imp.storage_path && imp.source_url) {
          await supabase.from("project_imports").update({
            status: "parsed",
            parsed_summary: { note: "URL reference recorded; remote fetch not performed in M2." },
          }).eq("id", imp.id);
          results.push({ id: imp.id, kind: imp.kind, status: "skipped_url" });
          continue;
        }

        const dl = await downloadImport(supabase, imp);
        if (!dl) throw new Error("Could not download file");

        let summary: any = {};
        switch (imp.kind) {
          case "openapi": {
            const parsed = parseOpenAPI(dl.text);
            if (!parsed) throw new Error("Could not parse OpenAPI spec");
            const reqN = await seedApi(supabase, project_id, user.id, imp, parsed);
            summary = { endpoints: parsed.endpoints.length, schemas: parsed.schemas.length, requirements: reqN };
            break;
          }
          case "db_schema": {
            const parsed = parseSqlDdl(dl.text);
            const reqN = await seedData(supabase, project_id, user.id, imp, parsed);
            summary = { tables: parsed.tables.length, requirements: reqN };
            break;
          }
          case "repo": {
            const filePath = filenameFromImport(imp);
            const parsed = isZipBytes(dl.bytes)
              ? await parseRepoZip(dl.bytes)
              : parseRepoSingleFile(dl.text, filePath);
            const reqN = await seedRepo(supabase, project_id, user.id, imp, parsed);
            summary = { components: parsed.components.length, files: parsed.fileCount, requirements: reqN };
            break;
          }
          case "srs": {
            const items = parseSrsRequirements(dl.text);
            const n = await seedSrs(supabase, project_id, user.id, imp, items);
            summary = { requirements: n };
            break;
          }
          case "adr": {
            await seedAdr(supabase, project_id, user.id, imp, dl.text);
            summary = { adr: 1 };
            break;
          }
          default: {
            const manifest = parseManifest(dl.text, filenameFromImport(imp));
            if (manifest) {
              const reqN = await seedManifest(supabase, project_id, user.id, imp, manifest);
              summary = {
                manifest: manifest.type,
                dependencies: (manifest.dependencies || []).length,
                requirements: reqN,
              };
            } else {
              summary = { note: "No parser for this kind in M2; file stored only." };
            }
          }
        }

        await supabase.from("project_imports").update({
          status: "parsed",
          parsed_summary: summary,
          error: null,
        }).eq("id", imp.id);
        results.push({ id: imp.id, kind: imp.kind, status: "parsed", summary });
      } catch (e: any) {
        await supabase.from("project_imports").update({
          status: "failed",
          error: e?.message?.slice(0, 500) || "Unknown error",
        }).eq("id", imp.id);
        results.push({ id: imp.id, kind: imp.kind, status: "failed", error: e?.message });
      }
    }

    return ok({ processed: results.length, results });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
