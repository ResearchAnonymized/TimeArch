// Fetch real-world brownfield demo packs from public open-source repos and
// seed them into project_imports + storage. URLs are server-side allowlisted
// to prevent SSRF — only the curated presets below are reachable.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_BYTES_PER_FILE = 12 * 1024 * 1024; // 12 MB
const FETCH_TIMEOUT_MS = 30_000;

type Kind = "repo" | "openapi" | "db_schema" | "adr" | "srs" | "diagram" | "other";

interface PresetItem {
  url: string;
  kind: Kind;
  source_label: string;
  filename: string;
  content_type?: string;
}

interface Preset {
  id: string;
  title: string;
  blurb: string;
  source_repo: string;
  license: string;
  scale: "small" | "medium" | "large";
  expected_runtime: string;
  items: PresetItem[];
}

const PRESETS: Preset[] = [
  {
    id: "petstore-api",
    title: "Swagger Petstore (OpenAPI sample pack)",
    blurb: "Canonical OpenAPI 3.0 reference specs from OAI/OpenAPI-Specification — petstore plus 5 sibling specs.",
    source_repo: "https://github.com/OAI/OpenAPI-Specification",
    license: "Apache-2.0",
    scale: "small",
    expected_runtime: "~15 s",
    items: [
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/petstore.yaml",          kind: "openapi", source_label: "Petstore OpenAPI 3.0",            filename: "petstore.yaml",          content_type: "application/yaml" },
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/petstore-expanded.yaml", kind: "openapi", source_label: "Petstore expanded OpenAPI",      filename: "petstore-expanded.yaml", content_type: "application/yaml" },
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/api-with-examples.yaml", kind: "openapi", source_label: "API-with-examples OpenAPI",      filename: "api-with-examples.yaml", content_type: "application/yaml" },
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/callback-example.yaml",  kind: "openapi", source_label: "Callback example OpenAPI",       filename: "callback-example.yaml",  content_type: "application/yaml" },
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/link-example.yaml",      kind: "openapi", source_label: "Link example OpenAPI",           filename: "link-example.yaml",      content_type: "application/yaml" },
      { url: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/_archive_/schemas/v3.0/pass/uspto.yaml",             kind: "openapi", source_label: "USPTO OpenAPI",                  filename: "uspto.yaml",             content_type: "application/yaml" },
    ],
  },
  {
    id: "sakila-db",
    title: "Sakila sample database (multi-dialect)",
    blurb: "MySQL Sakila DVD-rental schema plus PostgreSQL and SQLite ports — 16 tables, real-world relationships.",
    source_repo: "https://github.com/jOOQ/sakila",
    license: "BSD-3-Clause",
    scale: "small",
    expected_runtime: "~20 s",
    items: [
      { url: "https://raw.githubusercontent.com/jOOQ/sakila/main/mysql-sakila-db/mysql-sakila-schema.sql",        kind: "db_schema", source_label: "Sakila MySQL schema",        filename: "mysql-sakila-schema.sql",        content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/jOOQ/sakila/main/mysql-sakila-db/mysql-sakila-insert-data.sql",   kind: "db_schema", source_label: "Sakila MySQL seed data",     filename: "mysql-sakila-insert-data.sql",   content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/jOOQ/sakila/main/postgres-sakila-db/postgres-sakila-schema.sql",  kind: "db_schema", source_label: "Sakila PostgreSQL schema",   filename: "postgres-sakila-schema.sql",     content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/jOOQ/sakila/main/sqlite-sakila-db/sqlite-sakila-schema.sql",      kind: "db_schema", source_label: "Sakila SQLite schema",       filename: "sqlite-sakila-schema.sql",       content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/jOOQ/sakila/main/mysql-sakila-db/mysql-sakila-drop-objects.sql",  kind: "db_schema", source_label: "Sakila MySQL drop script",   filename: "mysql-sakila-drop-objects.sql",  content_type: "text/plain" },
    ],
  },
  {
    id: "chinook-db",
    title: "Chinook sample database (multi-dialect)",
    blurb: "Music-store schema across 11 tables, in 5 dialects — perfect for data-modeling reverse-engineering.",
    source_repo: "https://github.com/lerocha/chinook-database",
    license: "MIT",
    scale: "small",
    expected_runtime: "~20 s",
    items: [
      { url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_PostgreSql.sql", kind: "db_schema", source_label: "Chinook PostgreSQL", filename: "chinook-postgres.sql",  content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_MySql.sql",      kind: "db_schema", source_label: "Chinook MySQL",      filename: "chinook-mysql.sql",     content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sql",     kind: "db_schema", source_label: "Chinook SQLite",     filename: "chinook-sqlite.sql",    content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_SqlServer.sql",  kind: "db_schema", source_label: "Chinook SQL Server", filename: "chinook-sqlserver.sql", content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Oracle.sql",     kind: "db_schema", source_label: "Chinook Oracle",     filename: "chinook-oracle.sql",    content_type: "text/plain" },
    ],
  },
  {
    id: "realworld-fullstack",
    title: "RealWorld Conduit (Node + Express backend)",
    blurb: "The 'Medium clone' reference backend — real TypeScript controllers, services, models, and the Prisma migration. Great for full reverse-engineering.",
    source_repo: "https://github.com/gothinkster/node-express-realworld-example-app",
    license: "MIT",
    scale: "medium",
    expected_runtime: "~30 s",
    items: [
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/README.md",                                                              kind: "srs",       source_label: "RealWorld README (project brief)",     filename: "README.md",                  content_type: "text/markdown" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/package.json",                                                           kind: "other",     source_label: "RealWorld package.json (deps)",        filename: "package.json",               content_type: "application/json" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/prisma/schema.prisma",                                              kind: "db_schema", source_label: "RealWorld Prisma schema",              filename: "schema.prisma",              content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/prisma/migrations/20210924225358_initial/migration.sql",             kind: "db_schema", source_label: "RealWorld initial Prisma migration",   filename: "migration.sql",              content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/routes.ts",                                               kind: "repo",      source_label: "RealWorld routes registry",            filename: "routes.ts",                  content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/auth/auth.controller.ts",                                 kind: "repo",      source_label: "RealWorld auth controller",            filename: "auth.controller.ts",         content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/auth/auth.service.ts",                                    kind: "repo",      source_label: "RealWorld auth service",               filename: "auth.service.ts",            content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/article/article.controller.ts",                           kind: "repo",      source_label: "RealWorld article controller",         filename: "article.controller.ts",      content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/article/article.service.ts",                              kind: "repo",      source_label: "RealWorld article service",            filename: "article.service.ts",         content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/profile/profile.controller.ts",                           kind: "repo",      source_label: "RealWorld profile controller",         filename: "profile.controller.ts",      content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/master/src/app/routes/tag/tag.controller.ts",                                   kind: "repo",      source_label: "RealWorld tag controller",             filename: "tag.controller.ts",          content_type: "text/plain" },
    ],
  },
  {
    id: "spring-petclinic",
    title: "Spring PetClinic (schemas + README)",
    blurb: "Spring Framework's canonical reference app — README plus H2/MySQL/Postgres schemas and seed data. Lightweight slice for fast reverse-engineering.",
    source_repo: "https://github.com/spring-projects/spring-petclinic",
    license: "Apache-2.0",
    scale: "small",
    expected_runtime: "~20 s",
    items: [
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/README.md",                                  kind: "srs",       source_label: "PetClinic README (project brief)", filename: "README.md",        content_type: "text/markdown" },
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/src/main/resources/db/h2/schema.sql",        kind: "db_schema", source_label: "PetClinic H2 schema",              filename: "h2-schema.sql",    content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/src/main/resources/db/h2/data.sql",          kind: "db_schema", source_label: "PetClinic H2 seed data",           filename: "h2-data.sql",      content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/src/main/resources/db/mysql/schema.sql",     kind: "db_schema", source_label: "PetClinic MySQL schema",           filename: "mysql-schema.sql", content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/src/main/resources/db/postgres/schema.sql",  kind: "db_schema", source_label: "PetClinic Postgres schema",        filename: "postgres-schema.sql", content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/spring-projects/spring-petclinic/main/src/main/resources/db/postgres/data.sql",    kind: "db_schema", source_label: "PetClinic Postgres seed data",     filename: "postgres-data.sql",   content_type: "text/plain" },
    ],
  },
  {
    id: "northwind-pg",
    title: "Northwind (PostgreSQL port)",
    blurb: "Microsoft's classic Northwind Traders sample — 13 tables, orders/customers/products relationships, ~350 KB single-file SQL. Perfect stress test for schema reverse-engineering and gap analysis.",
    source_repo: "https://github.com/pthom/northwind_psql",
    license: "MIT",
    scale: "small",
    expected_runtime: "~15 s",
    items: [
      { url: "https://raw.githubusercontent.com/pthom/northwind_psql/master/northwind.sql", kind: "db_schema", source_label: "Northwind PostgreSQL schema + data", filename: "northwind-postgres.sql", content_type: "text/plain" },
    ],
  },
  {
    id: "django-realworld",
    title: "RealWorld Conduit (Django REST Framework backend)",
    blurb: "The 'Medium clone' reference in Python — Django settings, URL router, DRF viewsets, ORM models and serializers across articles, profiles and auth. Great counterpart to the Node RealWorld preset for cross-stack comparison.",
    source_repo: "https://github.com/gothinkster/django-realworld-example-app",
    license: "MIT",
    scale: "medium",
    expected_runtime: "~25 s",
    items: [
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/README.md",                                     kind: "srs",   source_label: "Django RealWorld README",             filename: "README.md",              content_type: "text/markdown" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/requirements.txt",                             kind: "other", source_label: "Django RealWorld requirements.txt",   filename: "requirements.txt",       content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/settings.py",                          kind: "repo",  source_label: "Django settings",                     filename: "settings.py",            content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/urls.py",                              kind: "repo",  source_label: "Django URL router",                   filename: "urls.py",                content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/authentication/models.py",        kind: "repo",  source_label: "Authentication models",               filename: "authentication_models.py",   content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/authentication/views.py",         kind: "repo",  source_label: "Authentication views",                filename: "authentication_views.py",    content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/articles/models.py",              kind: "repo",  source_label: "Article models",                      filename: "articles_models.py",         content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/articles/views.py",               kind: "repo",  source_label: "Article viewsets",                    filename: "articles_views.py",          content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/articles/serializers.py",         kind: "repo",  source_label: "Article serializers",                 filename: "articles_serializers.py",    content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/gothinkster/django-realworld-example-app/master/conduit/apps/profiles/models.py",              kind: "repo",  source_label: "Profile models",                      filename: "profiles_models.py",         content_type: "text/plain" },
    ],
  },
  {
    id: "sauna-demo-app",
    title: "Sauna controller demo (Flask)",
    blurb:
      "Small Flask sauna-control UI — domain model (sauna.py), routes/API (app.py), frontend dial (static/js), and README. Ideal team test app for brownfield feature addition.",
    source_repo: "https://github.com/anse-proj/sauna-demo-app",
    license: "Demo / internal",
    scale: "small",
    expected_runtime: "~10 s",
    items: [
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/README.md",              kind: "srs",  source_label: "Sauna demo README",           filename: "README.md",              content_type: "text/markdown" },
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/sauna.py",                kind: "repo", source_label: "Sauna domain model",          filename: "sauna.py",               content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/app.py",                   kind: "repo", source_label: "Flask routes + JSON API",     filename: "app.py",                 content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/requirements.txt",         kind: "other", source_label: "Python dependencies",      filename: "requirements.txt",       content_type: "text/plain" },
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/static/js/app.js",         kind: "repo", source_label: "Frontend dial + polling",     filename: "static/js/app.js",       content_type: "text/javascript" },
      { url: "https://raw.githubusercontent.com/anse-proj/sauna-demo-app/main/templates/index.html",    kind: "repo", source_label: "Single-screen UI template",   filename: "templates/index.html",   content_type: "text/html" },
    ],
  },
  {
    id: "eshop-microservices",
    title: "eShopOnContainers (.NET microservices reference)",
    blurb: "Microsoft's canonical microservices reference architecture — Catalog, Ordering, Basket and Identity service manifests plus README. Ideal for exercising the style-classifier's microservices verdict and the 7R modernization planner.",
    source_repo: "https://github.com/dotnet-architecture/eShopOnContainers",
    license: "MIT",
    scale: "medium",
    expected_runtime: "~25 s",
    items: [
      { url: "https://raw.githubusercontent.com/dotnet-architecture/eShopOnContainers/dev/README.md",                                                  kind: "srs",  source_label: "eShopOnContainers README",           filename: "README.md",              content_type: "text/markdown" },
      { url: "https://raw.githubusercontent.com/dotnet-architecture/eShopOnContainers/dev/src/Services/Catalog/Catalog.API/Catalog.API.csproj",       kind: "repo", source_label: "Catalog service manifest",           filename: "Catalog.API.csproj",     content_type: "text/xml" },
      { url: "https://raw.githubusercontent.com/dotnet-architecture/eShopOnContainers/dev/src/Services/Ordering/Ordering.API/Ordering.API.csproj",   kind: "repo", source_label: "Ordering service manifest",          filename: "Ordering.API.csproj",    content_type: "text/xml" },
      { url: "https://raw.githubusercontent.com/dotnet-architecture/eShopOnContainers/dev/src/Services/Basket/Basket.API/Basket.API.csproj",         kind: "repo", source_label: "Basket service manifest",            filename: "Basket.API.csproj",      content_type: "text/xml" },
      { url: "https://raw.githubusercontent.com/dotnet-architecture/eShopOnContainers/dev/src/Services/Identity/Identity.API/Identity.API.csproj",   kind: "repo", source_label: "Identity service manifest",          filename: "Identity.API.csproj",    content_type: "text/xml" },
    ],
  },
];

// Public summary (no URLs) returned to clients listing presets
function publicCatalog() {
  return PRESETS.map((p) => ({
    id: p.id,
    title: p.title,
    blurb: p.blurb,
    source_repo: p.source_repo,
    license: p.license,
    scale: p.scale,
    expected_runtime: p.expected_runtime,
    file_count: p.items.length,
    kinds: [...new Set(p.items.map((i) => i.kind))],
  }));
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithLimit(url: string): Promise<Uint8Array> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES_PER_FILE) {
      throw new Error(`File too large (${buf.byteLength} bytes, max ${MAX_BYTES_PER_FILE})`);
    }
    return buf;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Public list endpoint — no auth needed for catalog metadata
    if (req.method === "GET" || url.searchParams.get("list") === "true") {
      return ok({ presets: publicCatalog() });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) return ok({ error: "Missing authorization" }, 401);
    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user) return ok({ error: "Unauthorized" }, 401);

    const { project_id, preset_id } = await req.json();
    if (!project_id || !preset_id) return ok({ error: "project_id and preset_id required" }, 400);

    const preset = PRESETS.find((p) => p.id === preset_id);
    if (!preset) return ok({ error: `Unknown preset: ${preset_id}` }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id, _project_id: project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const results: any[] = [];
    let uploaded = 0;
    const stamp = Date.now();

    for (const item of preset.items) {
      try {
        const bytes = await fetchWithLimit(item.url);
        const path = `${project_id}/demo/${preset.id}/${stamp}-${item.filename}`;
        const { error: upErr } = await supabase.storage.from("project-imports").upload(
          path, bytes, { contentType: item.content_type || "application/octet-stream", upsert: false },
        );
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("project_imports").insert({
          project_id, kind: item.kind, source_label: item.source_label,
          storage_path: path, source_url: item.url, created_by: user.id,
        });
        if (insErr) throw insErr;
        uploaded++;
        results.push({ filename: item.filename, kind: item.kind, status: "uploaded", bytes: bytes.byteLength });
      } catch (e: any) {
        results.push({ filename: item.filename, kind: item.kind, status: "failed", error: e?.message?.slice(0, 300) });
      }
    }

    return ok({
      preset_id: preset.id,
      preset_title: preset.title,
      source_repo: preset.source_repo,
      license: preset.license,
      uploaded,
      total: preset.items.length,
      results,
    });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
