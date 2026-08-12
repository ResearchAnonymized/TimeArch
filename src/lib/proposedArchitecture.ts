/**
 * Ground proposed architecture in the as-is inventory.
 * Drops hallucinated ripples, merges alias nodes (app → API), and forces
 * the three-layer touch pattern when new capabilities are proposed.
 */
import type { SystemInventory } from "@/lib/systemInventory";

export type ImpactClass = "new" | "modified" | "ripple" | "unchanged";

export interface ArchitectureNode {
  id: string;
  label: string;
  impact: ImpactClass;
  layer: "ui" | "api" | "domain" | "data" | "infra" | "test" | "feature" | "other";
  detail?: string;
  source?: string;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface RippleImpact {
  ref: string;
  type: string;
  classification: string;
  severity: string;
  action?: string;
  reason?: string;
  grounded: boolean;
}

export interface ProposedArchitecture {
  featureTitle: string;
  featureId: string;
  proposedFeatures: string[];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  ripples: RippleImpact[];
  discardedRipples: RippleImpact[];
  filesToTouch: string[];
  mermaidProposed: string;
  impactSummaryMarkdown: string;
  changeCodingBrief: string;
  stats: {
    new: number;
    modified: number;
    ripple: number;
    unchanged: number;
    discarded: number;
  };
}

type MappingRow = {
  element_type?: string | null;
  element_ref?: string | null;
  relationship?: string | null;
  confidence?: number | null;
};

type RippleRow = {
  impacted_element_type?: string | null;
  impacted_element_ref?: string | null;
  classification?: string | null;
  severity?: string | null;
  recommended_action?: string | null;
  reason?: string | null;
};

type FeatureChangeRow = {
  id: string;
  title: string;
  description?: string | null;
  change_type?: string | null;
  priority?: string | null;
  current_behavior?: string | null;
  desired_behavior?: string | null;
};

type WorkItemRow = {
  title: string;
  description?: string | null;
  category?: string | null;
  effort?: string | null;
  validation_criteria?: string[] | null;
  ordering?: number | null;
};

const IMPACT_LEGEND: Record<ImpactClass, { color: string; label: string; meaning: string }> = {
  new: {
    color: "#10b981",
    label: "New",
    meaning: "New capability or component introduced by this change",
  },
  modified: {
    color: "#f59e0b",
    label: "Modified",
    meaning: "Existing element touched — API, domain, or UI must change",
  },
  ripple: {
    color: "#ef4444",
    label: "Ripple",
    meaning: "Secondary impact grounded in this repo — verify before merge",
  },
  unchanged: {
    color: "#9ca3af",
    label: "Unchanged",
    meaning: "Baseline element not directly touched",
  },
};

const HALLUCINATION_PATTERNS =
  /security_protocol|data_security|performance_metric|application_performance|alert_event|moisture_data|moisture_display|_display\.html|migration\(|TimerService|microservice|message.?bus|event.?bus|kafka|schema.?migration/i;

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 40) || "node";
}

function inventoryPaths(inventory: SystemInventory): string[] {
  const fromFiles = inventory.files.map((f) => f.path.toLowerCase());
  const fromComponents = inventory.components.map((c) => c.path.toLowerCase());
  return [...new Set([...fromFiles, ...fromComponents])];
}

function cleanCapabilityLabel(raw: string): string {
  return raw
    .replace(/^Add\s+/i, "")
    .replace(/\s*What should happen\s*:?\s*/i, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * One proposed-feature node per revision section (### N. Title).
 * Exact-title dedupe only — never collapse "session timer" into a
 * longer combined parent title (that was dropping features from the diagram).
 */
export function parseProposedFeatures(fc: FeatureChangeRow): string[] {
  const sectionTitles: string[] = [];
  const desired = fc.desired_behavior || "";
  for (const m of desired.matchAll(/^###\s*\d+\.\s*(.+)$/gm)) {
    const t = cleanCapabilityLabel(m[1]);
    if (t.length > 1) sectionTitles.push(t);
  }
  if (sectionTitles.length) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of sectionTitles) {
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(t);
    }
    return unique.slice(0, 12);
  }

  // Single feature (not a multi-section revision bundle)
  const bareTitle = cleanCapabilityLabel(fc.title.replace(/^Revision:\s*/i, ""));
  if (bareTitle.length > 2 && !/\s+\+\s+/.test(bareTitle)) {
    return [bareTitle];
  }

  // Title like "A + B + C" from a revision bundle without ### sections
  const fromTitle = bareTitle
    .split(/\s+\+\s+/)
    .map((s) => cleanCapabilityLabel(s))
    .filter((s) => s.length > 2);
  if (fromTitle.length > 1) {
    const seen = new Set<string>();
    return fromTitle.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 12);
  }

  const text = `${fc.desired_behavior || ""} ${fc.description || ""}`.toLowerCase();
  const keywords: string[] = [];
  if (/timer|session|countdown/.test(text)) keywords.push("Session timer");
  if (/sensor|humidity|steamer|moisture/.test(text)) keywords.push("Humidity sensor");
  if (/auth|jwt|login/.test(text)) keywords.push("Authentication");
  if (/ready|notify|notification/.test(text)) keywords.push("Ready notification");
  return keywords.length ? keywords : [bareTitle || cleanCapabilityLabel(fc.title)];
}

/** Map any ref/alias onto the canonical UI / API / Domain nodes when possible. */
function mapRefToCanonical(
  ref: string,
  type: string,
): ArchitectureNode | null {
  const lower = ref.toLowerCase().trim();
  const bare = lower.replace(/^.*\//, "");

  // UI
  if (
    type === "ui" ||
    /index\.html|app\.js|frontend|template|browser.?ui|static\/js/.test(lower)
  ) {
    return {
      id: "UI",
      label: "Browser UI",
      impact: "modified",
      layer: "ui",
      detail: "templates/index.html + static/js/app.js",
    };
  }

  // API — include bare "app" so it does not become an orphan MOD: app node
  if (
    type === "api" ||
    /^app(\.py)?$/.test(bare) ||
    /app\.py|flask|api\/|api_state|api_power|api_target|routes?/.test(lower)
  ) {
    return {
      id: "API",
      label: "Flask API",
      impact: "modified",
      layer: "api",
      detail: "app.py",
    };
  }

  // Domain
  if (
    type === "domain" ||
    type === "service" ||
    /sauna\.py|^sauna$|class\s*sauna|domain/.test(lower)
  ) {
    return {
      id: "Domain",
      label: "Sauna domain",
      impact: "modified",
      layer: "domain",
      detail: "sauna.py",
    };
  }

  return null;
}

function isGroundedInInventory(ref: string, type: string, inventory: SystemInventory): boolean {
  const lower = (ref || "").toLowerCase();
  if (!lower || lower === "unknown") return false;
  if (HALLUCINATION_PATTERNS.test(lower)) return false;

  const paths = inventoryPaths(inventory);
  if (paths.some((p) => lower.includes(p) || p.includes(lower) || p.endsWith(lower))) return true;

  if (inventory.apiRoutes.some((a) => lower.includes(a.path.toLowerCase()))) return true;
  if (inventory.components.some((c) => lower.includes(c.name.toLowerCase()))) return true;

  // Canonical stack refs for this brownfield pattern
  if (/\/api\/|snapshot|index\.html|app\.js|sauna\.py|app\.py|contract-test|curl|poll/.test(lower)) {
    return true;
  }

  // Test ripples that name a real file are OK
  if ((type === "test" || type === "quality") && paths.some((p) => /test|spec/.test(p))) return true;

  return false;
}

function buildBaselineNodes(inventory: SystemInventory): ArchitectureNode[] {
  const nodes: ArchitectureNode[] = [];
  if (inventory.components.some((c) => /index\.html|app\.js/.test(c.path)) ||
      inventory.files.some((f) => /index\.html|app\.js/.test(f.path))) {
    nodes.push({
      id: "UI",
      label: "Browser UI",
      impact: "unchanged",
      layer: "ui",
      detail: "templates/index.html + static/js/app.js",
    });
  }
  if (inventory.components.some((c) => /app\.py/.test(c.path)) ||
      inventory.files.some((f) => /app\.py/.test(f.path))) {
    nodes.push({
      id: "API",
      label: "Flask API",
      impact: "unchanged",
      layer: "api",
      detail: "app.py",
    });
  }
  if (inventory.components.some((c) => /sauna\.py/.test(c.path)) ||
      inventory.files.some((f) => /sauna\.py/.test(f.path))) {
    nodes.push({
      id: "Domain",
      label: "Sauna domain",
      impact: "unchanged",
      layer: "domain",
      detail: "sauna.py",
    });
  }
  return nodes;
}

function applyMappings(nodes: Map<string, ArchitectureNode>, mappings: MappingRow[]) {
  for (const m of mappings) {
    const ref = m.element_ref || "";
    const type = m.element_type || "";
    const node = mapRefToCanonical(ref, type);
    if (!node) {
      // Do not invent orphan MOD nodes for ungrounded LLM refs
      continue;
    }

    const existing = nodes.get(node.id);
    if (existing) {
      existing.impact = "modified";
      if (m.relationship && !existing.detail?.includes(m.relationship)) {
        existing.detail = existing.detail
          ? `${existing.detail.split(" · ")[0]}`
          : existing.detail;
      }
    } else {
      nodes.set(node.id, node);
    }
  }
}

function markThreeLayerModified(nodes: Map<string, ArchitectureNode>) {
  for (const id of ["UI", "API", "Domain"] as const) {
    const n = nodes.get(id);
    if (n) n.impact = "modified";
  }
}

function addProposedFeatureNodes(nodes: Map<string, ArchitectureNode>, features: string[]) {
  features.forEach((f, i) => {
    const id = `NEW_${slug(f)}_${i}`;
    nodes.set(id, {
      id,
      label: f,
      impact: "new",
      layer: "feature",
      source: "proposed feature",
    });
  });
}

function synthesizeGroundedRipples(
  inventory: SystemInventory,
  features: string[],
): RippleImpact[] {
  if (!features.length) return [];
  // Do NOT re-list UI / API / Domain here — those already appear as MOD (*) nodes.
  // Only secondary verify steps that are not another copy of the same layer.
  return [
    {
      ref: "Smoke verify (curl + UI)",
      type: "test",
      classification: "confirmed",
      severity: "low",
      action: "curl /api/state for new fields; confirm power/target still work in UI",
      reason: "Acceptance check after implementing the revision",
      grounded: true,
    },
  ];
}

/** True if this ripple is just another name for UI / API / Domain already on the diagram. */
function isDuplicateOfModifiedLayer(ref: string, type: string): boolean {
  if (mapRefToCanonical(ref, type)) return true;
  const lower = ref.toLowerCase();
  return (
    /\/api\/state|snapshot|app\.py|flask|index\.html|app\.js|templates\/|static\/js|sauna\.py|browser.?ui|deploy|versioning|migration|app_deployment/.test(
      lower,
    )
  );
}

function classifyRipples(
  ripples: RippleRow[],
  inventory: SystemInventory,
): { grounded: RippleImpact[]; discarded: RippleImpact[] } {
  const grounded: RippleImpact[] = [];
  const discarded: RippleImpact[] = [];

  for (const r of ripples) {
    const ref = r.impacted_element_ref || "unknown";
    const type = r.impacted_element_type || "other";
    const item: RippleImpact = {
      ref,
      type,
      classification: r.classification || "unknown",
      severity: r.severity || "medium",
      action: r.recommended_action || undefined,
      reason: r.reason || undefined,
      grounded: false,
    };

    // Fold into MOD layers — do not also draw as red ripple (looks like "shown twice")
    if (isDuplicateOfModifiedLayer(ref, type)) {
      item.grounded = true;
      item.reason = (item.reason || "") + " (shown as modified layer, not ripple)";
      continue;
    }

    if (isGroundedInInventory(ref, type, inventory)) {
      item.grounded = true;
      grounded.push(item);
    } else {
      item.grounded = false;
      discarded.push(item);
    }
  }

  return { grounded, discarded };
}

function addRippleNodes(nodes: Map<string, ArchitectureNode>, ripples: RippleImpact[]) {
  for (const r of ripples.slice(0, 6)) {
    const id = `RPL_${slug(r.ref)}`;
    if (nodes.has(id)) continue;
    nodes.set(id, {
      id,
      label: r.ref.slice(0, 40),
      impact: "ripple",
      layer: r.type === "test" || r.type === "quality" ? "test" : r.type === "ui" ? "ui" : "infra",
      detail: r.type,
    });
  }
}

function resolveFilesToTouch(inventory: SystemInventory, nodes: ArchitectureNode[]): string[] {
  const preferred = ["sauna.py", "app.py", "templates/index.html", "static/js/app.js"];
  const paths = inventoryPaths(inventory);
  const fromInventory = preferred.filter((p) => paths.some((x) => x.endsWith(p.toLowerCase()) || x.includes(p.toLowerCase())));
  if (fromInventory.length) return fromInventory;

  // Fall back to component paths for modified layers
  const out: string[] = [];
  for (const n of nodes) {
    if (n.impact !== "modified" || !n.detail) continue;
    for (const part of n.detail.split(/[+·,]/)) {
      const t = part.trim();
      if (/\.\w+$/.test(t) || t.includes("/")) out.push(t);
    }
  }
  return [...new Set(out)];
}

function buildEdges(
  nodes: Map<string, ArchitectureNode>,
  inventory: SystemInventory,
): ArchitectureEdge[] {
  const edges: ArchitectureEdge[] = [];
  const has = (id: string) => nodes.has(id);
  const seen = new Set<string>();
  const add = (from: string, to: string, label?: string, style: "solid" | "dashed" = "solid") => {
    if (!has(from) || !has(to) || from === to) return;
    const key = `${from}->${to}:${label || ""}:${style}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, label, style });
  };

  if (has("UI") && has("API")) {
    const route = inventory.apiRoutes.find((r) => r.path.startsWith("/api")) || inventory.apiRoutes[0];
    add("UI", "API", route ? `${route.method} ${route.path}` : "HTTP");
  }
  if (has("API") && has("Domain")) add("API", "Domain", "calls");

  for (const n of nodes.values()) {
    if (n.impact !== "new") continue;
    if (has("Domain")) add(n.id, "Domain", "extends");
    else if (has("API")) add(n.id, "API", "via API");
    else if (has("UI")) add(n.id, "UI", "via UI");
  }

  for (const n of nodes.values()) {
    if (n.impact !== "ripple") continue;
    if (has("Domain")) add("Domain", n.id, "ripple", "dashed");
    else if (has("API")) add("API", n.id, "ripple", "dashed");
  }

  return edges;
}

const IMPACT_CLASS: Record<ImpactClass, string> = {
  new: "impactNew",
  modified: "impactModified",
  ripple: "impactRipple",
  unchanged: "impactUnchanged",
};

function safeLabel(text: string): string {
  return text
    .replace(/"/g, "'")
    .replace(/\|/g, "/")
    .replace(/[\[\]]/g, "")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 48);
}

function formatEdge(e: ArchitectureEdge): string {
  const label = e.label ? safeLabel(e.label) : "";
  if (e.style === "dashed") {
    return label ? `${e.from} -.->|${label}| ${e.to}` : `${e.from} -.-> ${e.to}`;
  }
  return label ? `${e.from} -->|${label}| ${e.to}` : `${e.from} --> ${e.to}`;
}

function buildMermaidProposed(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  featureTitle: string,
): string {
  const lines = [
    "flowchart TB",
    `    %% Proposed architecture: ${safeLabel(featureTitle)}`,
    "    classDef impactNew fill:#10b981,stroke:#047857,color:#ffffff",
    "    classDef impactModified fill:#f59e0b,stroke:#b45309,color:#111111",
    "    classDef impactRipple fill:#fecaca,stroke:#dc2626,color:#111111",
    "    classDef impactUnchanged fill:#e5e7eb,stroke:#9ca3af,color:#333333",
  ];

  const order: ImpactClass[] = ["unchanged", "modified", "new", "ripple"];
  const sorted = [...nodes].sort(
    (a, b) => order.indexOf(a.impact) - order.indexOf(b.impact) || a.id.localeCompare(b.id),
  );

  for (const n of sorted) {
    const cls = IMPACT_CLASS[n.impact];
    // Keep node text short and professional — no long file paths on NEW nodes
    let text = safeLabel(n.label).slice(0, 36);
    if (n.impact === "modified" && n.detail) {
      const file = n.detail.split(/[+·,]/)[0]?.trim() || "";
      const shortFile = file.replace(/^.*\//, "").slice(0, 18);
      if (shortFile) text = `${safeLabel(n.label).slice(0, 22)} · ${shortFile}`;
    }
    if (n.impact === "new") text = `+ ${text}`;
    else if (n.impact === "ripple") text = `~ ${safeLabel(n.label).slice(0, 34)}`;
    else if (n.impact === "modified") text = `* ${text}`;
    lines.push(`    ${n.id}["${text}"]:::${cls}`);
  }

  for (const e of edges) lines.push(`    ${formatEdge(e)}`);

  for (const impact of order) {
    const ids = sorted.filter((n) => n.impact === impact).map((n) => n.id);
    if (ids.length) lines.push(`    class ${ids.join(",")} ${IMPACT_CLASS[impact]}`);
  }

  return lines.join("\n");
}

function buildImpactSummaryMarkdown(
  nodes: ArchitectureNode[],
  ripples: RippleImpact[],
  discarded: RippleImpact[],
): string {
  const byClass = (c: ImpactClass) => nodes.filter((n) => n.impact === c);
  const sections = (["new", "modified", "ripple", "unchanged"] as ImpactClass[]).map((c) => {
    const items = byClass(c);
    const legend = IMPACT_LEGEND[c];
    if (!items.length && c !== "ripple") return "";
    const list =
      c === "ripple" && ripples.length
        ? ripples
            .map(
              (r) =>
                `- **${r.ref}** (${r.classification}/${r.severity})${r.action ? ` — ${r.action}` : ""}`,
            )
            .join("\n")
        : items.map((n) => `- **${n.label}**${n.detail ? ` — ${n.detail}` : ""}`).join("\n");
    return `### ${legend.label} (${legend.meaning})\n${list || "_None_"}`;
  });

  if (discarded.length) {
    sections.push(
      `### Filtered (not in as-is inventory)\n${discarded
        .slice(0, 8)
        .map((r) => `- ~~${r.ref}~~ — excluded as ungrounded`)
        .join("\n")}`,
    );
  }

  return sections.filter(Boolean).join("\n\n");
}

function buildChangeCodingBrief(input: {
  fc: FeatureChangeRow;
  inventory: SystemInventory;
  proposedFeatures: string[];
  nodes: ArchitectureNode[];
  ripples: RippleImpact[];
  workItems: WorkItemRow[];
  filesToTouch: string[];
}): string {
  const modified = input.nodes.filter((n) => n.impact === "modified");
  const newNodes = input.nodes.filter((n) => n.impact === "new");

  const taskList = input.workItems
    .slice()
    .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
    .map((w, i) => `${i + 1}. [${w.category}/${w.effort}] ${w.title}`)
    .join("\n");

  const rippleList = input.ripples
    .map((r) => `- ${r.ref} (${r.severity}): ${r.action || r.reason || "verify"}`)
    .join("\n");

  return `# Change implementation brief — ${input.fc.title}

## Goal
${input.fc.desired_behavior || input.fc.description || input.fc.title}

## Proposed capabilities (new)
${newNodes.length ? newNodes.map((n) => `- **${n.label}**`).join("\n") : input.proposedFeatures.map((f) => `- ${f}`).join("\n")}

## Files to touch (in order)
${input.filesToTouch.map((f, i) => `${i + 1}. \`${f}\``).join("\n") || "1. `sauna.py`\n2. `app.py`\n3. `templates/index.html` + `static/js/app.js`"}

## Existing elements being modified
${modified.map((m) => `- **${m.label}** (${m.layer})${m.detail ? `: ${m.detail}` : ""}`).join("\n") || "- Three-layer touch: domain → API → UI"}

## Ripple effects — verify before merge (grounded only)
${rippleList || "- Smoke-test /api/state and UI"}

## Constraints (from as-is decisions)
${input.inventory.decisions.map((d) => `- **${d.title}:** ${d.decision}`).join("\n")}

## Ordered tasks
${taskList || "_Define tasks during review if Analyze produced none._"}

## LLM rules
1. Implement ONLY the proposed capabilities above.
2. Extend \`Sauna.snapshot()\` — do not break existing keys.
3. Match Flask + vanilla JS patterns already in the repo.
4. No database migrations unless this repo has a real DB (it does not).
5. Do not invent new HTML pages, event buses, or security subsystems.
6. After coding: curl \`/api/state\` and confirm new fields appear.
`;
}

export function buildProposedArchitecture(input: {
  inventory: SystemInventory;
  featureChange: FeatureChangeRow;
  mappings: MappingRow[];
  ripples: RippleRow[];
  workItems: WorkItemRow[];
}): ProposedArchitecture {
  const proposedFeatures = parseProposedFeatures(input.featureChange);
  const nodeMap = new Map<string, ArchitectureNode>();

  for (const n of buildBaselineNodes(input.inventory)) nodeMap.set(n.id, { ...n });

  applyMappings(nodeMap, input.mappings);
  addProposedFeatureNodes(nodeMap, proposedFeatures);

  // New features always imply the three-layer extension pattern in this stack
  if (proposedFeatures.length) markThreeLayerModified(nodeMap);

  const classified = classifyRipples(input.ripples, input.inventory);
  const synthesized = synthesizeGroundedRipples(input.inventory, proposedFeatures);

  // Merge synthesized + classified grounded (dedupe; never re-draw MOD layers as ripples)
  const rippleMap = new Map<string, RippleImpact>();
  for (const r of [...synthesized, ...classified.grounded]) {
    if (isDuplicateOfModifiedLayer(r.ref, r.type)) continue;
    const key = r.ref.toLowerCase();
    if (!rippleMap.has(key)) rippleMap.set(key, r);
  }
  const rippleList = [...rippleMap.values()];
  addRippleNodes(nodeMap, rippleList);

  const nodes = [...nodeMap.values()];
  const edges = buildEdges(nodeMap, input.inventory);
  const filesToTouch = resolveFilesToTouch(input.inventory, nodes);
  const mermaidProposed = buildMermaidProposed(nodes, edges, input.featureChange.title);
  const impactSummaryMarkdown = buildImpactSummaryMarkdown(
    nodes,
    rippleList,
    classified.discarded,
  );
  const changeCodingBrief = buildChangeCodingBrief({
    fc: input.featureChange,
    inventory: input.inventory,
    proposedFeatures,
    nodes,
    ripples: rippleList,
    workItems: input.workItems,
    filesToTouch,
  });

  return {
    featureTitle: input.featureChange.title,
    featureId: input.featureChange.id,
    proposedFeatures,
    nodes,
    edges,
    ripples: rippleList,
    discardedRipples: classified.discarded,
    filesToTouch,
    mermaidProposed,
    impactSummaryMarkdown,
    changeCodingBrief,
    stats: {
      new: nodes.filter((n) => n.impact === "new").length,
      modified: nodes.filter((n) => n.impact === "modified").length,
      ripple: rippleList.length,
      unchanged: nodes.filter((n) => n.impact === "unchanged").length,
      discarded: classified.discarded.length,
    },
  };
}

export { IMPACT_LEGEND };
