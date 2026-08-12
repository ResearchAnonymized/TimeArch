/** Shared import-kind detection for brownfield discovery (edge functions). */
export type ImportKind = "repo" | "openapi" | "db_schema" | "adr" | "srs" | "diagram" | "other";

const SOURCE_EXTENSIONS = new Set([
  "py", "js", "jsx", "ts", "tsx", "java", "kt", "kts", "go", "rs", "rb", "php",
  "cs", "cpp", "c", "h", "hpp", "swift", "vue", "svelte", "html", "htm", "css", "scss",
  "sql", "yaml", "yml", "json", "toml", "xml", "md", "prisma", "graphql",
  "tf", "sh", "bash", "csproj", "sln", "gradle", "mod", "dockerfile",
]);

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "tar", "gz", "7z",
  "woff", "woff2", "ttf", "eot", "mp4", "mp3", "exe", "dll", "so", "dylib",
  "lock", "min", "map", "pyc", "class", "jar", "whl", "bin", "dat",
]);

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv",
  "vendor", "target", ".next", "coverage", ".pytest_cache", ".mypy_cache",
  "bin", "obj", ".idea", ".vscode", ".gradle", ".terraform", ".nuget",
  "site-packages", ".tox", ".eggs", "*.egg-info",
]);

/** True when this repo path should be skipped during GitHub tree import. */
export function shouldSkipRepoPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const lower = norm.toLowerCase();
  const segments = lower.split("/");
  for (const seg of segments) {
    if (SKIP_DIR_SEGMENTS.has(seg)) return true;
    if (seg.endsWith(".egg-info")) return true;
  }
  const base = segments[segments.length - 1] || "";
  if (base.startsWith(".")) return true;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  if (ext && BINARY_EXTENSIONS.has(ext)) return true;
  if (/\.min\.(js|css)$/.test(lower)) return true;
  if (lower.endsWith(".lock") && !lower.endsWith("package-lock.json")) return true;
  return false;
}

/** Score paths so we import the most architecturally relevant files first. */
export function scoreRepoPath(path: string): number {
  const lower = path.toLowerCase();
  const base = lower.split("/").pop() || lower;
  let score = 10;
  if (base === "readme.md") score = 100;
  else if (/^(app|main|server|index)\.(py|js|ts|go|java|cs)$/.test(base)) score = 95;
  else if (/openapi|swagger/.test(lower)) score = 92;
  else if (/package\.json$|requirements\.txt$|pyproject\.toml$|go\.mod$|pom\.xml$/.test(lower)) score = 88;
  else if (/dockerfile|docker-compose/.test(lower)) score = 85;
  else if (/\.(sql|prisma)$/.test(lower) || /schema|migration/.test(lower)) score = 82;
  else if (/^docs\//.test(lower) && lower.endsWith(".md")) score = 70;
  else if (/\.(py|ts|tsx|js|jsx|java|go|cs|rb)$/.test(lower)) score = 65;
  else if (/templates\/|static\//.test(lower)) score = 55;
  else if (/test|spec|__tests__|\.test\.|\.spec\./.test(lower)) score = 25;
  else if (SOURCE_EXTENSIONS.has(base.split(".").pop() || "")) score = 40;
  return score;
}

/** Classify an imported file path (and optional content sniff) into a discovery kind. */
export function detectImportKind(path: string, contentPreview?: string): ImportKind {
  const n = path.replace(/\\/g, "/").toLowerCase();
  const base = n.split("/").pop() || n;
  const preview = (contentPreview || "").slice(0, 4000).toLowerCase();

  if (/\.(zip|tar|gz|tgz)$/.test(n)) return "repo";
  if (/openapi|swagger/.test(n) && /\.(ya?ml|json)$/.test(n)) return "openapi";
  if (/\.(ya?ml|json)$/.test(n) && /"(openapi|swagger)"/.test(preview)) return "openapi";
  if (/\.(sql|ddl)$/.test(n) || /schema\.prisma$/.test(n) || /\/migrations\/.+\.sql$/.test(n)) {
    return "db_schema";
  }
  if (/adr|decision/.test(n) && /\.md$/.test(n)) return "adr";
  if (/^readme\.md$/.test(base) || /\/(srs|brd|prd|requirements?)\./.test(n)) return "srs";
  if (/\.(png|jpe?g|svg|drawio|puml|mmd)$/.test(n)) return "diagram";
  if (/\.(md|txt)$/.test(n) && /docs\//.test(n)) return "srs";
  if (/package\.json$|requirements\.txt$|pyproject\.toml$|\.csproj$|pom\.xml$|go\.mod$|cargo\.toml$/.test(n)) {
    return "other";
  }

  const ext = base.includes(".") ? base.split(".").pop()! : "";
  if (ext === "txt") return "other";
  if (SOURCE_EXTENSIONS.has(ext) || base === "dockerfile") return "repo";
  if (/\.(html|css|js|jsx|ts|tsx|py|java|go|cs|rb|php|vue|svelte)$/.test(n)) return "repo";
  return "other";
}

export function contentTypeForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    md: "text/markdown", json: "application/json", yaml: "application/yaml",
    yml: "application/yaml", html: "text/html", css: "text/css", js: "text/javascript",
    ts: "text/plain", py: "text/plain", sql: "text/plain", xml: "text/xml",
  };
  return map[ext] || "text/plain";
}
