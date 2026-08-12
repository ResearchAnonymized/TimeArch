/**
 * Build a readable as-is system inventory from reverse-engineered DB rows.
 */
export interface ExtractedComponent {
  name: string;
  path: string;
  kind: string;
  language?: string | null;
  exports: string[];
  imports: string[];
}

export interface ExtractedApiRoute {
  method: string;
  path: string;
  handler: string;
}

export interface ExtractedRequirement {
  id: string;
  title: string;
  description: string;
  source: string;
}

export interface AsIsDecision {
  id: string;
  title: string;
  decision: string;
  consequences: string;
  /** Why this pattern exists in the codebase */
  context?: string;
  /** Why we inferred or trust this decision */
  rationale?: string;
  /** What a coding LLM must respect when changing the system */
  llmGuidance?: string;
  status: "inferred" | "documented";
}

export type FeatureCategory =
  | "functional"
  | "non_functional"
  | "interface"
  | "constraint";

export interface CurrentFeature {
  id: string;
  title: string;
  description: string;
  /** Source shape recovered from the codebase / docs */
  kind: "capability" | "api" | "requirement";
  /** Requirement class for humans */
  category: FeatureCategory;
  /** Where / how AI found this */
  evidence: string;
  /** Plain-language note on identification method */
  identifiedHow: string;
}

export const FEATURE_CATEGORY_LABEL: Record<FeatureCategory, string> = {
  functional: "Functional",
  non_functional: "Non-functional",
  interface: "Interface / API",
  constraint: "Constraint",
};

export interface SystemInventory {
  projectName: string;
  sourceRepo?: string | null;
  files: Array<{ path: string; kind: string; status: string }>;
  components: ExtractedComponent[];
  apiRoutes: ExtractedApiRoute[];
  dependencies: string[];
  requirements: ExtractedRequirement[];
  /** Capabilities / behaviors recovered from the as-is system */
  currentFeatures: CurrentFeature[];
  decisions: AsIsDecision[];
  mermaidAsIs: string;
  baselineCodingBrief: string;
}

type ArtifactRow = {
  type: string;
  title: string;
  content: Record<string, unknown> | null;
};

type ImportRow = {
  kind: string;
  source_label: string | null;
  status: string;
};

type ReqRow = {
  requirement_id: string;
  title: string;
  description: string | null;
  source: string | null;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function inferApiRoutes(components: ExtractedComponent[]): ExtractedApiRoute[] {
  const routes: ExtractedApiRoute[] = [];
  for (const c of components) {
    if (!/app\.py$/i.test(c.path)) continue;
    for (const fn of c.exports) {
      if (fn === "index") routes.push({ method: "GET", path: "/", handler: fn });
      else if (fn.startsWith("api_")) {
        const segment = fn.replace(/^api_/, "");
        if (segment === "state") routes.push({ method: "GET", path: "/api/state", handler: fn });
        else if (segment === "power") routes.push({ method: "POST", path: "/api/power", handler: fn });
        else if (segment === "target") routes.push({ method: "POST", path: "/api/target", handler: fn });
        else routes.push({ method: "POST", path: `/api/${segment}`, handler: fn });
      }
    }
  }
  return routes;
}

function buildMermaidAsIs(components: ExtractedComponent[], apis: ExtractedApiRoute[]): string {
  const hasUi = components.some((c) => /index\.html|app\.js$/i.test(c.path));
  const hasApi = components.some((c) => /app\.py$/i.test(c.path));
  const hasDomain = components.some((c) => /sauna\.py$/i.test(c.path));

  const lines = ["flowchart TB"];
  if (hasUi) lines.push('    UI["Browser UI<br/>index.html + app.js"]');
  if (hasApi) lines.push('    API["Flask app.py<br/>REST endpoints"]');
  if (hasDomain) lines.push('    Domain["sauna.py<br/>class Sauna"]');

  if (hasUi && hasApi) {
    const apiPaths = apis.filter((a) => a.path.startsWith("/api"));
    if (apiPaths.length) {
      for (const r of apiPaths.slice(0, 3)) {
        lines.push(`    UI -->|"${r.method} ${r.path}"| API`);
      }
    } else {
      lines.push('    UI -->|"GET /api/state"| API');
    }
  }
  if (hasApi && hasDomain) lines.push("    API --> Domain");

  if (lines.length === 1) {
    for (const c of components.slice(0, 6)) {
      const id = c.name.replace(/[^a-zA-Z0-9_]/g, "_") || "mod";
      lines.push(`    ${id}["${c.path}"]`);
    }
  }
  return lines.join("\n");
}

function buildDecisions(
  components: ExtractedComponent[],
  requirements: ExtractedRequirement[],
  dependencies: string[],
): AsIsDecision[] {
  const decisions: AsIsDecision[] = [];
  const addingFeatures = requirements.find((r) => /adding features/i.test(r.title));

  if (components.some((c) => /sauna\.py$/i.test(c.path))) {
    decisions.push({
      id: "ASIS-001",
      title: "In-memory domain model",
      context: "The sauna controller keeps all runtime state in a single Python object.",
      decision: "Single Sauna instance in Flask memory; state resets on server restart.",
      rationale: "No database or ORM detected in imports; snapshot() returns a plain dict.",
      consequences: "No persistence; demo-only unless extended.",
      llmGuidance: "Do NOT add migrations or external DB unless explicitly requested. Extend Sauna fields in memory.",
      status: "inferred",
    });
    decisions.push({
      id: "ASIS-002",
      title: "Lazy thermal simulation",
      context: "Temperature changes when the client polls state, not on a timer thread.",
      decision: "Temperature advances on read via _advance(); no background heater thread.",
      rationale: "_advance() pattern in sauna.py; polling from /api/state in app.js.",
      consequences: "Sim speed via HARVIA_SIM_SPEED env var.",
      llmGuidance: "New timed features should hook into snapshot()/poll cycle — avoid background threads unless necessary.",
      status: "inferred",
    });
  }
  if (components.some((c) => /app\.py$/i.test(c.path))) {
    decisions.push({
      id: "ASIS-003",
      title: "Flask monolith",
      context: "One process serves both the HTML UI and JSON API for the demo.",
      decision: "One Flask app serves HTML and JSON API.",
      rationale: "app.py defines routes and imports Sauna; templates/ and static/ co-located.",
      consequences: "Every feature touches sauna.py, app.py, templates/, static/js/.",
      llmGuidance: "Follow the three-layer touch pattern: domain → route → UI. Keep routes thin.",
      status: "inferred",
    });
  }
  if (addingFeatures) {
    decisions.push({
      id: "ASIS-004",
      title: "Feature extension pattern",
      context: "Documented in README as the official way to add capabilities.",
      decision: addingFeatures.description.slice(0, 400) || addingFeatures.title,
      rationale: "Extracted from reverse-engineered requirements in the repo README.",
      consequences: "Add domain field, API route, UI widget — three places, in that order.",
      llmGuidance: "1) Extend Sauna + snapshot()  2) Add/extend app.py route  3) Update index.html + app.js",
      status: "documented",
    });
  }
  if (dependencies.length) {
    decisions.push({
      id: "ASIS-005",
      title: "Dependency stack",
      context: "Runtime libraries declared in requirements.txt / package manifests.",
      decision: `Dependencies: ${dependencies.join(", ")}.`,
      rationale: "Parsed from project manifest during reverse-engineering.",
      consequences: "Prefer minimal deps; match existing Flask + vanilla JS patterns.",
      llmGuidance: "Do not introduce new frameworks (React, SQLAlchemy, etc.) unless the change explicitly requires it.",
      status: "inferred",
    });
  }
  return decisions;
}

function buildBaselineCodingBrief(input: {
  projectName: string;
  sourceRepo?: string | null;
  components: ExtractedComponent[];
  apiRoutes: ExtractedApiRoute[];
  dependencies: string[];
  decisions: AsIsDecision[];
}): string {
  const fileMap = input.components
    .map(
      (c) =>
        `- \`${c.path}\` (${c.language || "source"}) — ${c.exports.slice(0, 8).join(", ") || "see file"}`,
    )
    .join("\n");

  const apiLines = input.apiRoutes.length
    ? input.apiRoutes.map((r) => `- \`${r.method} ${r.path}\` → \`${r.handler}()\``).join("\n")
    : "- _No API routes inferred._";

  const decisionLines = input.decisions
    .map(
      (d) =>
        `### ${d.id}: ${d.title}\n` +
        (d.context ? `**Context:** ${d.context}\n` : "") +
        `**Decision:** ${d.decision}\n` +
        (d.rationale ? `**Why:** ${d.rationale}\n` : "") +
        `**Consequences:** ${d.consequences}\n` +
        (d.llmGuidance ? `**LLM must:** ${d.llmGuidance}` : ""),
    )
    .join("\n\n");

  return `# Coding brief — as-is baseline: ${input.projectName}

> Paste this **before** any change request. It describes the system you must not break.
> Source: ${input.sourceRepo || "brownfield import"}

## What this system is
A brownfield codebase reverse-engineered into components, API routes, and architectural decisions below.
Use this as the **baseline**; pair it with a **change brief** after ripple analysis.

## Architectural decisions (do not violate)
${decisionLines}

## Layered file map
| Layer | Path | Role |
|-------|------|------|
${input.components
  .map((c) => {
    const layer = /sauna\.py/.test(c.path)
      ? "Domain"
      : /app\.py/.test(c.path)
        ? "API"
        : /index\.html|app\.js/.test(c.path)
          ? "UI"
          : "Other";
    return `| ${layer} | \`${c.path}\` | ${c.exports.slice(0, 4).join(", ") || "see file"} |`;
  })
  .join("\n")}

Full detail:
${fileMap || "_No components extracted._"}

## HTTP API contract (current)
${apiLines}

## Dependencies
${input.dependencies.length ? input.dependencies.map((d) => `- ${d}`).join("\n") : "- none recorded"}

## Extension rules (ordered)
1. **Domain** — extend \`sauna.py\` (Sauna class + \`snapshot()\`).
2. **API** — add routes in \`app.py\`; return updated \`snapshot()\` JSON.
3. **UI** — update \`templates/index.html\` + \`static/js/app.js\`.
4. **Verify** — \`curl /api/state\` shows new fields; existing keys unchanged.
5. **Scope** — no unrelated refactors, no invented microservices or databases.

## State shape (\`Sauna.snapshot()\`)
Keys: \`name\`, \`power\`, \`temperature\`, \`target\`, \`ready\`, \`status\`, \`ambient\`, \`min_target\`, \`max_target\`.
Add new keys for new features; never remove or rename existing keys without explicit migration work item.
`;
}

function classifyRequirementText(title: string, description: string): FeatureCategory {
  const t = `${title} ${description}`.toLowerCase();
  if (
    /\b(performance|latency|throughput|scalab|availab|reliab|security|privacy|maintainab|usability|portability|compatib|observability|sla|uptime|response time)\b/.test(
      t,
    )
  ) {
    return "non_functional";
  }
  if (
    /\b(must not|shall not|constraint|no database|in-memory only|do not introduce|forbidden|never add)\b/.test(
      t,
    )
  ) {
    return "constraint";
  }
  if (/\b(api|endpoint|http|rest|json|contract|route)\b/.test(t)) {
    return "interface";
  }
  return "functional";
}

function buildCurrentFeatures(
  components: ExtractedComponent[],
  apiRoutes: ExtractedApiRoute[],
  requirements: ExtractedRequirement[],
): CurrentFeature[] {
  const out: CurrentFeature[] = [];
  const seen = new Set<string>();
  const add = (f: CurrentFeature) => {
    const key = f.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f);
  };

  const hasSauna = components.some((c) => /sauna\.py$/i.test(c.path));
  const hasFlask = components.some((c) => /app\.py$/i.test(c.path));
  const hasUi = components.some((c) => /index\.html|app\.js$/i.test(c.path));

  if (hasSauna) {
    add({
      id: "cap-power",
      title: "Power on / off",
      description: "Toggle sauna heater power; state held in the in-memory Sauna model.",
      kind: "capability",
      category: "functional",
      evidence: "sauna.py · POST /api/power",
      identifiedHow:
        "Inferred from domain model symbols and matching Flask route while parsing source files.",
    });
    add({
      id: "cap-target",
      title: "Set target temperature",
      description: "User sets a target; system heats toward it within min/max bounds.",
      kind: "capability",
      category: "functional",
      evidence: "sauna.py · POST /api/target",
      identifiedHow:
        "Inferred from domain model + API handler that mutates target temperature.",
    });
    add({
      id: "cap-temp",
      title: "Live temperature & ready status",
      description: "Exposes temperature, ready flag, and status via snapshot() for the UI dial.",
      kind: "capability",
      category: "functional",
      evidence: "sauna.py · GET /api/state",
      identifiedHow:
        "Recovered from Sauna.snapshot() fields and the state endpoint used by the UI poll.",
    });
    add({
      id: "cap-sim",
      title: "Lazy thermal simulation",
      description: "Temperature advances on read (no background heater thread); speed via env.",
      kind: "capability",
      category: "non_functional",
      evidence: "sauna.py · _advance()",
      identifiedHow:
        "Identified as a performance/runtime characteristic from simulation logic and env-based speed.",
    });
  }

  if (hasUi) {
    add({
      id: "cap-ui",
      title: "Browser dial UI",
      description: "HTML/JS front end polls state and sends power/target commands.",
      kind: "capability",
      category: "functional",
      evidence: "templates/index.html · static/js/app.js",
      identifiedHow: "Detected from UI assets that call the JSON API.",
    });
  }

  if (hasFlask) {
    add({
      id: "cap-monolith",
      title: "Flask HTML + JSON API",
      description: "Single Flask app serves the page and REST endpoints.",
      kind: "capability",
      category: "constraint",
      evidence: "app.py",
      identifiedHow:
        "Architectural constraint inferred from project layout (single Flask process, no separate API service).",
    });
  }

  // API routes that are already cited as capability evidence → keep only uncovered routes
  const coveredPaths = new Set<string>();
  for (const f of out) {
    const m = f.evidence.match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i);
    if (m) coveredPaths.add(`${m[1].toUpperCase()} ${m[2]}`);
    // also catch "· POST /api/power" style
    const m2 = f.evidence.match(/(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w/-]+)/gi);
    if (m2) {
      for (const hit of m2) {
        const parts = hit.split(/\s+/);
        if (parts.length >= 2) coveredPaths.add(`${parts[0].toUpperCase()} ${parts[1]}`);
      }
    }
  }

  for (const r of apiRoutes) {
    if (r.path === "/") continue;
    const key = `${r.method.toUpperCase()} ${r.path}`;
    if (coveredPaths.has(key)) continue; // already represented by a capability row
    add({
      id: `api-${r.method}-${r.path}`,
      title: `${r.method} ${r.path}`,
      description: `Handler \`${r.handler}()\` — part of the public HTTP contract.`,
      kind: "api",
      category: "interface",
      evidence: "app.py",
      identifiedHow: `Extracted from Flask route decorator @app.route("${r.path}") → ${r.handler}().`,
    });
  }

  for (const req of requirements) {
    const title = req.title.trim();
    if (!title) continue;
    if (
      /^(dependency:|persist and manage|maintain |\[as-is\])/i.test(title) ||
      /dependency manifest|component decomposition|infrastructure signals/i.test(title)
    ) {
      continue;
    }
    const cleanTitle = title.replace(/^\[As-Is\]\s*/i, "").slice(0, 120);
    // Skip docs that only restate a capability we already listed
    const titleKey = cleanTitle.toLowerCase();
    const duplicatesCapability = out.some((f) => {
      const a = f.title.toLowerCase();
      return a === titleKey || a.includes(titleKey) || titleKey.includes(a);
    });
    if (duplicatesCapability) continue;

    const description = req.description.slice(0, 400) || "Recovered from imported docs / README.";
    const source = req.source.replace(/^reverse-engineered:/, "") || "reverse-engineered";
    add({
      id: `req-${req.id}`,
      title: cleanTitle,
      description,
      kind: "requirement",
      category: classifyRequirementText(cleanTitle, description),
      evidence: source,
      identifiedHow: source.match(/\.(md|txt|rst)$/i)
        ? `Parsed from imported documentation (${source}) during reverse engineering.`
        : `Recovered as a reverse-engineered requirement (source: ${source}).`,
    });
  }

  const order: Record<FeatureCategory, number> = {
    functional: 0,
    interface: 1,
    non_functional: 2,
    constraint: 3,
  };
  return out.sort((a, b) => order[a.category] - order[b.category] || a.title.localeCompare(b.title));
}

export function buildSystemInventory(input: {
  projectName: string;
  sourceRepo?: string | null;
  imports: ImportRow[];
  requirements: ReqRow[];
  artifacts: ArtifactRow[];
}): SystemInventory {
  const components: ExtractedComponent[] = [];
  const dependencies: string[] = [];

  for (const a of input.artifacts) {
    const content = a.content || {};
    const meta = (content._meta || {}) as Record<string, unknown>;

    if (a.type === "decomposition" && Array.isArray(content.components)) {
      for (const c of content.components as Array<Record<string, unknown>>) {
        components.push({
          name: safeStr(c.name) || "module",
          path: safeStr(c.path) || safeStr(meta.source_label) || "unknown",
          kind: safeStr(c.kind) || "module",
          language: safeStr(c.language) || null,
          exports: Array.isArray(c.exports) ? c.exports.map(String) : [],
          imports: Array.isArray(c.imports) ? c.imports.map(String) : [],
        });
      }
    }

    const manifest = content.manifest as Record<string, unknown> | undefined;
    if (manifest?.dependencies && Array.isArray(manifest.dependencies)) {
      dependencies.push(...manifest.dependencies.map(String));
    }
  }

  const byPath = new Map<string, ExtractedComponent>();
  for (const c of components) byPath.set(c.path, c);
  const uniqueComponents = [...byPath.values()];
  const apiRoutes = inferApiRoutes(uniqueComponents);
  const requirements: ExtractedRequirement[] = input.requirements
    .filter((r) => r.source?.startsWith("reverse-engineered:"))
    .map((r) => ({
      id: r.requirement_id,
      title: r.title,
      description: r.description || "",
      source: r.source || "",
    }));

  const decisions = buildDecisions(uniqueComponents, requirements, dependencies);
  const currentFeatures = buildCurrentFeatures(uniqueComponents, apiRoutes, requirements);

  return {
    projectName: input.projectName,
    sourceRepo: input.sourceRepo,
    files: input.imports.map((i) => ({
      path: i.source_label || "file",
      kind: i.kind,
      status: i.status,
    })),
    components: uniqueComponents,
    apiRoutes,
    dependencies: [...new Set(dependencies)],
    requirements,
    currentFeatures,
    decisions,
    mermaidAsIs: buildMermaidAsIs(uniqueComponents, apiRoutes),
    baselineCodingBrief: buildBaselineCodingBrief({
      projectName: input.projectName,
      sourceRepo: input.sourceRepo,
      components: uniqueComponents,
      apiRoutes,
      dependencies,
      decisions,
    }),
  };
}
