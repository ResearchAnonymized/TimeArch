/**
 * Professional Development Handoff for a change revision.
 *
 * Part A — Human decision pack: plan, ADRs, risks, clear decisions.
 * Part B — Machine / agent brief: pre-implementation constraints + test suite.
 */
import type { ProposedArchitecture } from "@/lib/proposedArchitecture";
import type { SystemInventory } from "@/lib/systemInventory";

export type GateKey = "requirements" | "architecture" | "delivery";

export interface ReviewGate {
  key: GateKey;
  label: string;
  role: string;
  checks: string;
  approved: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  note?: string | null;
}

/** Quick verdict for review decisions (ADRs + acceptance). */
export type ItemVerdict = "pending" | "go" | "no_go" | "dropped";

export interface AcceptanceCriterion {
  id: string;
  text: string;
  source: "desired" | "ripple" | "api" | "constraint" | "manual";
  /** User go / no-go on this requirement. Default pending until reviewed. */
  verdict?: ItemVerdict;
}

export type TestKind =
  | "functional"
  | "integration"
  | "regression"
  | "smoke"
  | "contract"
  | "manual";

export interface TestCase {
  id: string;
  kind: TestKind;
  title: string;
  steps: string;
  expected: string;
  automatable: boolean;
  /** User go / no-go — include in DoD or exclude. */
  verdict?: ItemVerdict;
}

export interface HandoffAdr {
  id: string;
  title: string;
  status: string;
  context: string;
  decision: string;
  consequences: string;
  alternativesConsidered: string[];
  /** User go / no-go on this decision. */
  verdict?: ItemVerdict;
}

export interface DevHandoff {
  featureChangeId: string;
  projectName: string;
  title: string;
  generatedAt: string;
  status: "draft" | "in_review" | "approved";
  summaryMarkdown: string;
  impactChecklistMarkdown: string;
  adrMarkdown: string;
  planMarkdown: string;
  testPlanMarkdown: string;
  acceptanceCriteria: AcceptanceCriterion[];
  testCases: TestCase[];
  adrs: HandoffAdr[];
  implementationBrief: string;
  humanMarkdown: string;
  machineMarkdown: string;
  machineJson: Record<string, unknown>;
  fullMarkdown: string;
  gates: ReviewGate[];
  filesToTouch: string[];
  proposedFeatures: string[];
  mermaidProposed: string;
  /** As-is architecture diagram (pre-change). */
  mermaidAsIs?: string;
  /** Capabilities recovered from reverse engineering. */
  recoveredFeatures?: string[];
  currentBehavior?: string;
  desiredBehavior?: string;
  /** Human-readable discussion of pre/post diagrams and impact. */
  architectureNarrative?: {
    asIsSummary: string;
    toBeSummary: string;
    diagramDiscussion: string;
    keyFindings: string[];
  };
  impactStats?: {
    new: number;
    modified: number;
    ripple: number;
    unchanged: number;
    discarded: number;
  };
  stats: {
    workItems: number;
    groundedRipples: number;
    discardedRipples: number;
    acceptance: number;
    tests: number;
    adrs: number;
  };
}

type FeatureChange = {
  id: string;
  title: string;
  description?: string | null;
  change_type?: string | null;
  priority?: string | null;
  current_behavior?: string | null;
  desired_behavior?: string | null;
  merit_score?: number | null;
  status?: string | null;
};

type WorkItem = {
  title: string;
  description?: string | null;
  category?: string | null;
  effort?: string | null;
  validation_criteria?: string[] | null;
  ordering?: number | null;
};

type Alternative = {
  title?: string | null;
  summary?: string | null;
  tradeoffs?: string | null;
  is_preferred?: boolean | null;
};

type AdrRecord = {
  title?: string | null;
  decision?: string | null;
  consequences?: string | null;
  status?: string | null;
} | null;

type StoredApprovals = Partial<
  Record<GateKey, { approvedBy?: string; approvedAt?: string; note?: string }>
>;

function defaultGates(stored?: StoredApprovals): ReviewGate[] {
  const defs: Array<Omit<ReviewGate, "approved" | "approvedBy" | "approvedAt">> = [
    {
      key: "requirements",
      label: "Requirements",
      role: "Product / stakeholder",
      checks: "Desired behavior matches the request; scope is not over-expanded",
    },
    {
      key: "architecture",
      label: "Architecture",
      role: "Architect / tech lead",
      checks: "Diagram, ADRs, and files match the real system; ungrounded ripples excluded",
    },
    {
      key: "delivery",
      label: "Delivery readiness",
      role: "Tech lead / senior engineer",
      checks: "Plan, tests, and acceptance criteria are implementable; ready for development",
    },
  ];
  return defs.map((d) => {
    const s = stored?.[d.key];
    return {
      ...d,
      approved: !!s?.approvedAt,
      approvedBy: s?.approvedBy ?? null,
      approvedAt: s?.approvedAt ?? null,
      note: s?.note ?? null,
    };
  });
}

function buildAcceptanceCriteria(input: {
  fc: FeatureChange;
  proposed: ProposedArchitecture;
  workItems: WorkItem[];
}): AcceptanceCriterion[] {
  const out: AcceptanceCriterion[] = [];
  let n = 1;

  const desired = input.fc.desired_behavior?.trim();
  if (desired) {
    out.push({
      id: `AC-${n++}`,
      text: `System behaves as specified: ${desired}`,
      source: "desired",
    });
  }

  for (const f of input.proposed.proposedFeatures) {
    out.push({
      id: `AC-${n++}`,
      text: `Capability "${f}" is reachable from the UI and reflected in GET /api/state (or the documented route)`,
      source: "desired",
    });
  }

  out.push({
    id: `AC-${n++}`,
    text: "Existing Sauna.snapshot() keys remain; power and target flows still work",
    source: "api",
  });

  for (const r of input.proposed.ripples.filter((x) => x.grounded).slice(0, 4)) {
    out.push({
      id: `AC-${n++}`,
      text: r.action || `Verify ripple: ${r.ref}`,
      source: "ripple",
    });
  }

  out.push({
    id: `AC-${n++}`,
    text: "No unrelated refactors; no invented DB / migrations / event bus unless an ADR explicitly approves them",
    source: "constraint",
  });

  for (const w of input.workItems) {
    for (const c of w.validation_criteria || []) {
      if (!c?.trim()) continue;
      out.push({ id: `AC-${n++}`, text: c.trim(), source: "desired" });
    }
  }

  const seen = new Set<string>();
  return out
    .filter((a) => {
      const k = a.text.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 14);
}

function buildTestPlan(input: {
  fc: FeatureChange;
  proposed: ProposedArchitecture;
  inventory: SystemInventory;
  acceptance: AcceptanceCriterion[];
}): TestCase[] {
  const out: TestCase[] = [];
  let n = 1;
  const add = (t: Omit<TestCase, "id">) => {
    out.push({ id: `T-${String(n++).padStart(2, "0")}`, ...t });
  };

  const features =
    input.proposed.proposedFeatures.length > 0
      ? input.proposed.proposedFeatures
      : [input.fc.title];

  for (const f of features) {
    add({
      kind: "functional",
      title: `New capability: ${f}`,
      steps: `Enable/use "${f}" from the primary UI path. Observe state before and after.`,
      expected: `"${f}" behaves as described in desired behavior; UI feedback is correct.`,
      automatable: true,
    });
  }

  add({
    kind: "functional",
    title: "Power on/off still works",
    steps: "POST /api/power with on and off; poll GET /api/state.",
    expected: "`power` matches request; no crash; temperature simulation still advances when on.",
    automatable: true,
  });

  add({
    kind: "functional",
    title: "Target temperature still works",
    steps: "POST /api/target with a value inside bounds; read GET /api/state.",
    expected: "`target` updates; out-of-bounds values are rejected or clamped per existing rules.",
    automatable: true,
  });

  add({
    kind: "contract",
    title: "API state contract preserved",
    steps: "GET /api/state and inspect JSON keys.",
    expected:
      "All pre-existing snapshot keys remain. New keys are additive only. Types stay JSON-serializable.",
    automatable: true,
  });

  add({
    kind: "integration",
    title: "UI ↔ API round-trip",
    steps: "Load the dial UI, change power/target (and new controls if any), watch network + dial.",
    expected: "UI polls state; controls hit the correct endpoints; dial reflects server state.",
    automatable: false,
  });

  add({
    kind: "integration",
    title: "Domain model ↔ Flask route",
    steps: `Exercise new/changed routes that touch: ${input.proposed.filesToTouch.join(", ") || "sauna.py, app.py"}.`,
    expected: "Handler updates the in-memory model; snapshot() exposes new fields; no double-apply bugs.",
    automatable: true,
  });

  for (const r of input.proposed.ripples.filter((x) => x.grounded).slice(0, 3)) {
    add({
      kind: "regression",
      title: `Ripple check: ${r.ref}`,
      steps: r.action || `Manually verify ${r.ref} after the change.`,
      expected: "No unintended breakage in this area.",
      automatable: /api|smoke|curl/i.test(r.action || "") || /api\//i.test(r.ref),
    });
  }

  add({
    kind: "smoke",
    title: "Cold start smoke",
    steps: "Restart the Flask app; open `/`; call GET /api/state once.",
    expected: "App boots; page loads; state JSON is valid.",
    automatable: true,
  });

  add({
    kind: "regression",
    title: "No scope creep",
    steps: "Diff the change set against the files-to-touch list and ADRs.",
    expected: "Only approved files/layers changed; no new persistence or frameworks.",
    automatable: false,
  });

  add({
    kind: "manual",
    title: "Stakeholder walkthrough",
    steps: "Demo today → target behavior to a reviewer using the acceptance criteria list.",
    expected: "Reviewer confirms the change matches the decision pack.",
    automatable: false,
  });

  // Tie a few tests to acceptance IDs in titles when useful
  const firstAc = input.acceptance[0];
  if (firstAc) {
    add({
      kind: "functional",
      title: `Acceptance gate ${firstAc.id}`,
      steps: firstAc.text,
      expected: "Criterion passes.",
      automatable: /api|GET|POST|state/i.test(firstAc.text),
    });
  }

  return out.slice(0, 16);
}

function buildAdrs(input: {
  fc: FeatureChange;
  proposed: ProposedArchitecture;
  inventory: SystemInventory;
  adr: AdrRecord;
  alternatives: Alternative[];
}): HandoffAdr[] {
  const alts = input.alternatives || [];
  const preferred = alts.find((a) => a.is_preferred);
  const altLines = alts.map((a) => {
    const mark = a.is_preferred ? " (preferred)" : "";
    return `${a.title || "Option"}${mark}: ${a.summary || ""}${a.tradeoffs ? ` — ${a.tradeoffs}` : ""}`;
  });

  const adrs: HandoffAdr[] = [];

  if (input.adr?.decision || input.adr?.title) {
    adrs.push({
      id: "ADR-CHANGE-001",
      title: input.adr.title || `Adopt approach for: ${input.fc.title}`,
      status: input.adr.status || "proposed",
      context: `${input.fc.description || input.fc.title}. Today: ${input.fc.current_behavior || "as-is"}. Target: ${input.fc.desired_behavior || "as proposed"}.`,
      decision: input.adr.decision || preferred?.summary || "Proceed with the preferred alternative grounded in the as-is inventory.",
      consequences: input.adr.consequences || "Touches UI, API, and domain layers only where mapped; additive API fields preferred.",
      alternativesConsidered: altLines,
    });
  } else {
    adrs.push({
      id: "ADR-CHANGE-001",
      title: `Implement "${input.fc.title}" inside the existing Flask + in-memory sauna stack`,
      status: "proposed",
      context: [
        `Change type: ${input.fc.change_type || "modify"} · Priority: ${input.fc.priority || "medium"}.`,
        input.fc.description || "",
        `Today: ${input.fc.current_behavior || "_unspecified_"}.`,
        `Target: ${input.fc.desired_behavior || "_unspecified_"}.`,
      ]
        .filter(Boolean)
        .join(" "),
      decision:
        preferred?.summary ||
        `Extend the existing three-layer path (UI → Flask API → Sauna domain). Add capabilities ${
          input.proposed.proposedFeatures.map((f) => `"${f}"`).join(", ") || "as specified"
        } without introducing a database, new framework, or separate service.`,
      consequences: [
        `Files likely touched: ${input.proposed.filesToTouch.join(", ") || "sauna.py, app.py, UI assets"}.`,
        "API contract stays backward compatible (additive keys only).",
        `${input.proposed.ripples.length} grounded ripple(s) must be verified; ${input.proposed.discardedRipples.length} ungrounded finding(s) ignored.`,
      ].join(" "),
      alternativesConsidered:
        altLines.length > 0
          ? altLines
          : [
              "A) Extend current monolith (preferred for this codebase)",
              "B) Extract a new service / add a database (rejected unless product explicitly expands scope)",
              "C) UI-only mock without domain/API (rejected — state would not survive refresh / API clients)",
            ],
    });
  }

  // Standing constraints as lightweight ADRs from inventory decisions
  for (const [i, d] of input.inventory.decisions.slice(0, 4).entries()) {
    adrs.push({
      id: `ADR-BASE-${String(i + 1).padStart(2, "0")}`,
      title: d.title,
      status: "accepted",
      context: "Standing constraint from reverse-engineered baseline.",
      decision: d.decision,
      consequences: d.llmGuidance || "Coding agents must not violate this constraint.",
      alternativesConsidered: [],
    });
  }

  return adrs;
}

function formatAdrMarkdown(adrs: HandoffAdr[]): string {
  return adrs
    .map(
      (a) => `### ${a.id} — ${a.title}

| Field | |
|---|---|
| **Status** | \`${a.status}\` |

**Context.** ${a.context}

**Decision.** ${a.decision}

**Consequences.** ${a.consequences}

${
  a.alternativesConsidered.length
    ? `**Alternatives considered**\n${a.alternativesConsidered.map((x) => `- ${x}`).join("\n")}`
    : ""
}`,
    )
    .join("\n\n");
}

function formatTestMarkdown(tests: TestCase[]): string {
  const byKind: Record<TestKind, TestCase[]> = {
    functional: [],
    integration: [],
    regression: [],
    smoke: [],
    contract: [],
    manual: [],
  };
  for (const t of tests) byKind[t.kind].push(t);

  const labels: Record<TestKind, string> = {
    functional: "Functional tests",
    integration: "Integration tests",
    contract: "Contract / API tests",
    regression: "Regression tests",
    smoke: "Smoke tests",
    manual: "Manual / review checks",
  };

  return (Object.keys(labels) as TestKind[])
    .filter((k) => byKind[k].length)
    .map((k) => {
      const rows = byKind[k]
        .map(
          (t) =>
            `#### ${t.id} — ${t.title}
- **Automatable:** ${t.automatable ? "yes" : "manual"}
- **Steps:** ${t.steps}
- **Expected:** ${t.expected}`,
        )
        .join("\n\n");
      return `### ${labels[k]}\n\n${rows}`;
    })
    .join("\n\n");
}

export function buildDevHandoff(input: {
  projectName: string;
  featureChange: FeatureChange;
  inventory: SystemInventory;
  proposed: ProposedArchitecture;
  workItems: WorkItem[];
  alternatives?: Alternative[];
  adr?: AdrRecord;
  storedApprovals?: StoredApprovals;
}): DevHandoff {
  const fc = input.featureChange;
  const generatedAt = new Date().toISOString();
  const gates = defaultGates(input.storedApprovals);
  const allApproved = gates.every((g) => g.approved);
  const status: DevHandoff["status"] = allApproved
    ? "approved"
    : gates.some((g) => g.approved)
      ? "in_review"
      : fc.status === "approved"
        ? "approved"
        : "draft";

  const acceptance = buildAcceptanceCriteria({
    fc,
    proposed: input.proposed,
    workItems: input.workItems,
  });
  const testCases = buildTestPlan({
    fc,
    proposed: input.proposed,
    inventory: input.inventory,
    acceptance,
  });
  const adrs = buildAdrs({
    fc,
    proposed: input.proposed,
    inventory: input.inventory,
    adr: input.adr || null,
    alternatives: input.alternatives || [],
  });

  const files = input.proposed.filesToTouch;
  const recoveredFeatures = (input.inventory.currentFeatures || [])
    .map((f) => f.title)
    .filter(Boolean);
  const proposedList =
    input.proposed.proposedFeatures.length > 0
      ? input.proposed.proposedFeatures
      : [fc.title.replace(/^Revision[^:]*:\s*/i, "").trim() || fc.title];

  const architectureNarrative = {
    asIsSummary: [
      `The recovered as-is system exposes ${recoveredFeatures.length} capability(ies)`,
      recoveredFeatures.length
        ? `including ${recoveredFeatures.slice(0, 5).join(", ")}${recoveredFeatures.length > 5 ? ", …" : ""}.`
        : "from reverse-engineered inventory.",
      input.inventory.components?.length
        ? ` Inventory covers ${input.inventory.components.length} component(s) and ${input.inventory.apiRoutes?.length || 0} API route(s).`
        : "",
    ]
      .filter(Boolean)
      .join(""),
    toBeSummary: [
      `This revision proposes ${proposedList.length} change(s): ${proposedList.join("; ")}.`,
      fc.desired_behavior?.trim()
        ? ` Target behavior: ${fc.desired_behavior.trim().replace(/^\s*What should happen\s*:?\s*/i, "")}`
        : "",
      ` Touch set: ${files.join(", ") || "confirm with tech lead"}.`,
    ]
      .filter(Boolean)
      .join(""),
    diagramDiscussion: [
      "The pre-change diagram shows the recovered baseline (as-is layers and flows).",
      "The post-change diagram highlights what this revision adds or modifies:",
      `${input.proposed.stats.new} new, ${input.proposed.stats.modified} modified, ${input.proposed.stats.ripple} ripple, ${input.proposed.stats.unchanged} unchanged node(s).`,
      input.proposed.discardedRipples.length
        ? ` ${input.proposed.discardedRipples.length} ungrounded finding(s) were excluded and must not be implemented.`
        : " All shown ripples are grounded in the as-is inventory.",
      " Reviewers should confirm: (1) new capabilities appear only where intended, (2) existing contracts stay additive, (3) files in scope match the blast radius.",
    ].join(" "),
    keyFindings: [
      `${recoveredFeatures.length} recovered capability(ies) from reverse engineering`,
      `${proposedList.length} newly proposed capability change(s) in this revision`,
      `${input.proposed.stats.new} new / ${input.proposed.stats.modified} modified architecture node(s)`,
      `${input.proposed.ripples.length} grounded ripple(s) to verify; ${input.proposed.discardedRipples.length} discarded`,
      `${files.length} file(s) in the planned touch set`,
      fc.current_behavior?.trim()
        ? `Today: ${fc.current_behavior.trim().slice(0, 160)}${fc.current_behavior.trim().length > 160 ? "…" : ""}`
        : "Today behavior: as recovered in inventory",
    ],
  };

  const tasks = [...input.workItems]
    .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
    .map(
      (w, i) =>
        `${i + 1}. **${w.title}** (${w.category || "work"} / ${w.effort || "M"})${w.description ? ` — ${w.description}` : ""}`,
    )
    .join("\n");

  const decisionsToMake = [
    `- [ ] Approve scope: ship **${fc.title}** as described (no silent scope expansion)`,
    `- [ ] Approve ADR-CHANGE-001 (implementation approach)`,
    `- [ ] Confirm files to touch: ${files.map((f) => `\`${f}\``).join(", ") || "_tech lead to confirm_"}`,
    `- [ ] Accept test plan (${testCases.length} cases) as the definition of done`,
    `- [ ] Complete review gates before implementation starts`,
  ].join("\n");

  const featureList =
    input.proposed.proposedFeatures.length > 0
      ? input.proposed.proposedFeatures
      : [fc.title.replace(/^Revision[^:]*:\s*/i, "").trim() || fc.title];

  const whyHuman = (() => {
    const raw = fc.description?.trim() || "";
    if (raw && !raw.startsWith("{") && !/"kind"\s*:\s*"revision_bundle"/.test(raw)) {
      return raw;
    }
    return `Extend the recovered as-is system with ${featureList.length} proposed capability change(s): ${featureList
      .map((f) => `"${f}"`)
      .join(", ")}.`;
  })();

  const todayHuman =
    fc.current_behavior?.trim() ||
    "Baseline recovered from source — existing power, target, temperature, and status flows.";

  const targetHuman = (() => {
    const desired = fc.desired_behavior?.trim() || "";
    if (desired.includes("###")) {
      return featureList.map((f, i) => `${i + 1}. ${f}`).join("\n");
    }
    return desired || featureList.map((f, i) => `${i + 1}. ${f}`).join("\n");
  })();

  const briefTitle =
    featureList.length <= 3
      ? featureList.join(" · ")
      : `${featureList.slice(0, 2).join(" · ")} (+${featureList.length - 2} more)`;

  const summaryMarkdown = `# Architecture change package — ${briefTitle}

| | |
|---|---|
| **Project** | ${input.projectName} |
| **Change type** | \`${fc.change_type || "modify"}\` |
| **Priority** | \`${fc.priority || "medium"}\` |
| **Handoff status** | \`${status}\` |
| **Generated** | ${generatedAt.slice(0, 19)}Z |

## 1. Context
${whyHuman}

## 2. As-is → To-be
| As-is (today) | To-be (target) |
|---|---|
| ${todayHuman.replace(/\|/g, "/").replace(/\n/g, "<br>")} | ${targetHuman.replace(/\|/g, "/").replace(/\n/g, "<br>")} |

## 3. Scope — proposed capabilities
${featureList.map((f, i) => `${i + 1}. ${f}`).join("\n")}

## 4. Decisions required before coding
${decisionsToMake}

## 5. Risk snapshot
- Grounded ripples to verify: **${input.proposed.ripples.length}**
- Ungrounded findings excluded: **${input.proposed.discardedRipples.length}**
- Files to touch: ${files.map((f) => `\`${f}\``).join(", ") || "_see plan_"}
- Work items: **${input.workItems.length}** · Tests: **${testCases.length}** · ADRs: **${adrs.length}**
`;

  const planMarkdown = `## Implementation plan (human-readable)

### Recommended sequence
1. Confirm ADRs and review gates (no code yet).
2. Update domain model (\`sauna.py\` / equivalent) — additive state only.
3. Expose via Flask routes (\`app.py\`) — keep existing contracts.
4. Wire UI controls and polling.
5. Run the test plan (functional → integration → regression → smoke).
6. Demo against acceptance criteria; freeze handoff as approved.

### Delivery tasks
${tasks || "_No generated work items — tech lead should break the change into tasks before coding._"}

### Layers affected
${input.proposed.nodes
  .filter((n) => n.impact === "modified" || n.impact === "new")
  .map((n) => `- **${n.impact.toUpperCase()}** ${n.label}${n.detail ? ` — ${n.detail}` : ""}`)
  .join("\n") || "- _Confirm with architect_"}
`;

  const impactChecklistMarkdown = `## Impact checklist (grounded)

### Files to modify
${files.map((f) => `- [ ] \`${f}\``).join("\n") || "- [ ] _Confirm file list with tech lead_"}

### Ripples to verify
${input.proposed.ripples.map((r) => `- [ ] ${r.ref}${r.action ? ` — ${r.action}` : ""}`).join("\n") || "- [ ] Smoke-test API + UI"}

${
  input.proposed.discardedRipples.length
    ? `### Excluded (not in as-is inventory — do not implement)\n${input.proposed.discardedRipples
        .slice(0, 8)
        .map((r) => `- ~~${r.ref}~~`)
        .join("\n")}`
    : ""
}
`;

  const adrMarkdown = `## Architecture Decision Records (ADRs)

${formatAdrMarkdown(adrs)}
`;

  const testPlanMarkdown = `## Test plan (definition of done)

Agents and engineers must not claim "done" until these pass (or are explicitly waived in a gate note).

${formatTestMarkdown(testCases)}
`;

  const acMarkdown = acceptance.map((a) => `- [ ] **${a.id}:** ${a.text}`).join("\n");

  const humanMarkdown = `${summaryMarkdown}

---

${planMarkdown}

---

${adrMarkdown}

---

${impactChecklistMarkdown}

---

## Acceptance criteria
${acMarkdown}

---

${testPlanMarkdown}

---

## Review gates
${gates
  .map(
    (g) =>
      `- **${g.label}** (${g.role}): ${g.approved ? `Approved by ${g.approvedBy || "reviewer"} at ${g.approvedAt}` : "Pending"} — ${g.checks}`,
  )
  .join("\n")}

## Proposed architecture (reference)
\`\`\`mermaid
${input.proposed.mermaidProposed}
\`\`\`
`;

  const constraints = input.inventory.decisions
    .map((d) => `- **${d.title}:** ${d.llmGuidance || d.decision}`)
    .join("\n");

  const machineMarkdown = `# Agent implementation brief — ${fc.title}

> Read this **before writing any code**. You are implementing an approved (or pending) change revision against a reverse-engineered brownfield system. Prefer minimal, additive diffs.

## 0. Gate check
${gates.map((g) => `- ${g.key}: ${g.approved ? "approved" : "PENDING"}`).join("\n")}
${!allApproved ? "\n**STOP:** Do not implement until all gates are approved, unless a human explicitly overrides in writing.\n" : "\nAll gates approved — you may implement.\n"}

## 1. Goal (exactly)
- Title: ${fc.title}
- Desired: ${fc.desired_behavior || "_see human pack_"}
- Capabilities: ${input.proposed.proposedFeatures.map((f) => `\`${f}\``).join(", ") || fc.title}

## 2. Carefully consider before coding
1. **Stay inside the as-is stack** — Flask + in-memory domain + existing UI. Do not invent services, ORMs, queues, auth systems, or databases.
2. **Additive API only** — never rename/remove existing \`snapshot()\` / JSON keys.
3. **Touch only mapped files** — ${files.map((f) => `\`${f}\``).join(", ") || "confirm with human"}. No drive-by refactors or formatting-only churn in unrelated files.
4. **Honor ADRs** — especially ADR-CHANGE-001 and standing baseline ADRs below.
5. **Ignore ungrounded ripples** — do not build features for discarded inventory misses: ${
    input.proposed.discardedRipples
      .slice(0, 6)
      .map((r) => r.ref)
      .join(", ") || "_none_"
  }.
6. **Match existing style** — same patterns as neighboring handlers/components.
7. **Tests are part of done** — implement or run the test plan; do not skip contract/regression checks.

## 3. Standing constraints (from inventory)
${constraints || "- Preserve backward-compatible HTTP JSON API."}

## 4. File plan
${files.map((f, i) => `${i + 1}. \`${f}\``).join("\n") || "1. Confirm file list with tech lead"}

## 5. Implementation sketch
${input.proposed.changeCodingBrief}

## 6. Work items
${tasks || "_None generated — ask human for task breakdown._"}

## 7. Acceptance criteria (must satisfy)
${acMarkdown}

## 8. Mandatory test suite
After code changes, execute (or automate) every case below. Report pass/fail per \`T-xx\`.

${formatTestMarkdown(testCases)}

### Suggested automation commands (adapt to repo)
\`\`\`bash
# smoke
curl -s http://127.0.0.1:5000/api/state | jq .
# power
curl -s -X POST http://127.0.0.1:5000/api/power -H 'Content-Type: application/json' -d '{"on":true}'
# target
curl -s -X POST http://127.0.0.1:5000/api/target -H 'Content-Type: application/json' -d '{"target":80}'
\`\`\`

## 9. Definition of done (agent)
- [ ] Diff limited to approved files/layers
- [ ] All acceptance criteria checked
- [ ] Functional + integration + contract + smoke tests reported
- [ ] No new dependencies unless ADR says so
- [ ] Short summary of what changed and how to verify
`;

  const machineJson = {
    kind: "dev_handoff",
    version: 3,
    feature_change_id: fc.id,
    project: input.projectName,
    title: fc.title,
    status,
    generated_at: generatedAt,
    proposed_features: input.proposed.proposedFeatures,
    files_to_touch: files,
    layers_modified: input.proposed.nodes
      .filter((n) => n.impact === "modified")
      .map((n) => ({ id: n.id, label: n.label, detail: n.detail })),
    new_capabilities: input.proposed.nodes
      .filter((n) => n.impact === "new")
      .map((n) => n.label),
    grounded_ripples: input.proposed.ripples,
    discarded_ripples: input.proposed.discardedRipples.map((r) => r.ref),
    acceptance_criteria: acceptance,
    test_cases: testCases,
    adrs,
    work_items: input.workItems.map((w) => ({
      title: w.title,
      category: w.category,
      effort: w.effort,
      validation_criteria: w.validation_criteria || [],
    })),
    constraints: input.inventory.decisions.map((d) => ({
      id: d.id,
      title: d.title,
      llm_must: d.llmGuidance || d.decision,
    })),
    gates: gates.map((g) => ({
      key: g.key,
      approved: g.approved,
      approved_by: g.approvedBy,
      approved_at: g.approvedAt,
    })),
    agent_rules: [
      "Do not implement until gates approved unless human override",
      "Additive API only",
      "No invented DB/services/frameworks",
      "Touch only files_to_touch",
      "Run test_cases before claiming done",
      "Ignore discarded_ripples",
    ],
    mermaid_proposed: input.proposed.mermaidProposed,
  };

  const fullMarkdown = `# Development Handoff: ${fc.title}

> Professional change package for **decision-makers** and **implementation agents**.
> Approve all gates before coding.

---

## Part A — Human decision pack

${humanMarkdown}

---

## Part B — Machine / agentic AI brief

${machineMarkdown}

---

## Machine-readable

\`\`\`json
${JSON.stringify(machineJson, null, 2)}
\`\`\`

_End of Development Handoff · feature_change_id=\`${fc.id}\`_
`;

  const draft: DevHandoff = {
    featureChangeId: fc.id,
    projectName: input.projectName,
    title: `Development Handoff: ${fc.title}`,
    generatedAt,
    status,
    summaryMarkdown,
    impactChecklistMarkdown,
    adrMarkdown,
    planMarkdown,
    testPlanMarkdown,
    acceptanceCriteria: acceptance,
    testCases,
    adrs,
    implementationBrief: machineMarkdown,
    humanMarkdown,
    machineMarkdown,
    machineJson,
    fullMarkdown,
    gates,
    filesToTouch: files,
    proposedFeatures: input.proposed.proposedFeatures,
    mermaidProposed: input.proposed.mermaidProposed,
    mermaidAsIs: input.inventory.mermaidAsIs || "",
    recoveredFeatures,
    currentBehavior: fc.current_behavior || "",
    desiredBehavior: fc.desired_behavior || "",
    architectureNarrative,
    impactStats: { ...input.proposed.stats },
    stats: {
      workItems: input.workItems.length,
      groundedRipples: input.proposed.ripples.length,
      discardedRipples: input.proposed.discardedRipples.length,
      acceptance: acceptance.length,
      tests: testCases.length,
      adrs: adrs.length,
    },
  };

  // Always emit ready-to-use packs (human / agent / machine) from structured fields.
  return rebuildHandoffExports(draft);
}

/** Stable contract for shared DB / downstream coding systems. */
export const HANDOFF_SCHEMA_VERSION = 4;

function verdictOf(item: { verdict?: ItemVerdict }): ItemVerdict {
  return item.verdict || "pending";
}

function partitionByVerdict<T extends { verdict?: ItemVerdict }>(items: T[]) {
  const go: T[] = [];
  const pending: T[] = [];
  const noGo: T[] = [];
  const dropped: T[] = [];
  for (const item of items) {
    const v = verdictOf(item);
    if (v === "go") go.push(item);
    else if (v === "no_go") noGo.push(item);
    else if (v === "dropped") dropped.push(item);
    else pending.push(item);
  }
  return { go, pending, noGo, dropped };
}

function formatExcludedLines(
  label: string,
  items: { id: string; title?: string; text?: string }[],
): string {
  if (!items.length) return "";
  return `\n### ${label}\n${items
    .map((i) => `- \`${i.id}\` ${i.title || i.text || ""}`.trim())
    .join("\n")}\n`;
}

/**
 * Rebuild scannable human + agent markdown and machine JSON from current
 * structured fields and Go / No-go verdicts. Call after any review edit
 * and before copy / download / persist to a shared store.
 */
export function rebuildHandoffExports(handoff: DevHandoff): DevHandoff {
  const base = normalizeDecisionVerdicts(handoff);
  const exportedAt = new Date().toISOString();
  const adrP = partitionByVerdict(base.adrs || []);
  const acP = partitionByVerdict(base.acceptanceCriteria || []);
  const testP = partitionByVerdict(base.testCases || []);
  const gatesApproved = (base.gates || []).filter((g) => g.approved).length;
  const gatesTotal = (base.gates || []).length;
  const allGatesOk = gatesTotal > 0 && gatesApproved === gatesTotal;
  const changeTitle = base.title.replace(/^Development Handoff:\s*/i, "");

  const humanMarkdown = `# Human decision pack — ${changeTitle}

> **Audience:** product, architect, delivery leads.  
> **Read time:** ~5 minutes. Only **Go** items are in scope.

| | |
|---|---|
| **Project** | ${base.projectName} |
| **Status** | \`${base.status}\` |
| **Gates** | ${gatesApproved}/${gatesTotal} approved |
| **Package id** | \`${base.featureChangeId}\` |
| **Exported** | ${exportedAt.slice(0, 19)}Z |

## Snapshot
| Bucket | Go | Pending | No-go | Dropped |
|---|---:|---:|---:|---:|
| Decisions (ADRs) | ${adrP.go.length} | ${adrP.pending.length} | ${adrP.noGo.length} | ${adrP.dropped.length} |
| Requirements (AC) | ${acP.go.length} | ${acP.pending.length} | ${acP.noGo.length} | ${acP.dropped.length} |
| Tests (DoD) | ${testP.go.length} | ${testP.pending.length} | ${testP.noGo.length} | ${testP.dropped.length} |

## 1. What we are building
${(base.proposedFeatures || []).map((f, i) => `${i + 1}. ${f}`).join("\n") || "1. " + changeTitle}

## 2. Approved decisions (Go)
${
  adrP.go.length
    ? adrP.go
        .map(
          (a) => `### ${a.id} — ${a.title}
- **Decision:** ${a.decision || "—"}
- **Consequences:** ${a.consequences || "—"}`,
        )
        .join("\n\n")
    : "_No Go decisions yet — finish Review decisions._"
}
${formatExcludedLines("No-go decisions (out of scope)", adrP.noGo.map((a) => ({ id: a.id, title: a.title })))}
${formatExcludedLines("Dropped decisions", adrP.dropped.map((a) => ({ id: a.id, title: a.title })))}
${adrP.pending.length ? `\n### Still pending review\n${adrP.pending.map((a) => `- \`${a.id}\` ${a.title}`).join("\n")}\n` : ""}

## 3. Approved requirements (Go)
${
  acP.go.length
    ? acP.go.map((a) => `- [ ] **${a.id}:** ${a.text}`).join("\n")
    : "_No Go requirements yet — finish Review decisions._"
}
${formatExcludedLines("No-go requirements", acP.noGo.map((a) => ({ id: a.id, text: a.text })))}
${formatExcludedLines("Dropped requirements", acP.dropped.map((a) => ({ id: a.id, text: a.text })))}
${acP.pending.length ? `\n### Still pending review\n${acP.pending.map((a) => `- \`${a.id}\` ${a.text}`).join("\n")}\n` : ""}

## 4. Definition of done — Go tests only
Agents and engineers claim done only when these **Go** tests pass (or are waived in a gate note).

${
  testP.go.length
    ? formatTestMarkdown(testP.go)
    : "_No Go tests yet — finish Build guide._"
}
${formatExcludedLines("No-go / waived tests", testP.noGo.map((t) => ({ id: t.id, title: t.title })))}
${formatExcludedLines("Dropped tests", testP.dropped.map((t) => ({ id: t.id, title: t.title })))}
${testP.pending.length ? `\n### Still pending review\n${testP.pending.map((t) => `- \`${t.id}\` ${t.title}`).join("\n")}\n` : ""}

## 5. Files in scope
${(base.filesToTouch || []).map((f) => `- \`${f}\``).join("\n") || "- _Confirm with tech lead_"}

## 6. Review gates
${(base.gates || [])
  .map(
    (g) =>
      `- **${g.label}** (${g.role}): ${g.approved ? `Approved by ${g.approvedBy || "reviewer"}` : "Pending"} — ${g.checks}`,
  )
  .join("\n")}

## How to use
1. Humans: open **Change package**, read Proposal + Build plan, then Release for build.
2. Coding systems / LLMs: use **Build plan** or \`machine.json\` — not this whole UI.
3. Shared database: store \`machine.json\` (\`schema_version: ${HANDOFF_SCHEMA_VERSION}\`) as the system of record.
`;

  const machineMarkdown = `# Agent / coding-system brief — ${changeTitle}

> **Audience:** LLM coding agents and automated builders.  
> **Rule:** Implement **only Go** scope. Ignore No-go and Dropped. Resolve Pending with a human before expanding scope.

## 0. Authorization
${(base.gates || []).map((g) => `- ${g.key}: ${g.approved ? "APPROVED" : "PENDING"}`).join("\n")}
${
  allGatesOk
    ? "\nAll gates approved — you may implement the Go scope below.\n"
    : "\n**STOP:** Do not write production code until gates are approved, unless a human override is written in the gate note.\n"
}

## 1. Goal
- Change: ${changeTitle}
- Capabilities: ${(base.proposedFeatures || []).map((f) => `\`${f}\``).join(", ") || changeTitle}
- Package id: \`${base.featureChangeId}\`

## 2. Hard constraints
1. Stay inside the existing brownfield stack — no invented services, ORMs, queues, or databases unless a Go ADR says so.
2. Additive API only — do not rename/remove existing JSON keys.
3. Touch only these files: ${(base.filesToTouch || []).map((f) => `\`${f}\``).join(", ") || "_confirm with human_"}.
4. Honor **Go ADRs** below; do not implement No-go / Dropped items.
5. Definition of done = **Go tests** only. Report pass/fail per test id.

## 3. Decisions to honor (Go)
${
  adrP.go.length
    ? adrP.go.map((a) => `- **${a.id}** ${a.title}: ${a.decision || a.title}`).join("\n")
    : "- _None marked Go — ask human before coding._"
}

## 4. Requirements to satisfy (Go)
${
  acP.go.length
    ? acP.go.map((a) => `- [ ] **${a.id}:** ${a.text}`).join("\n")
    : "- _None marked Go — ask human before coding._"
}

## 5. Mandatory tests (Go)
${
  testP.go.length
    ? formatTestMarkdown(testP.go)
    : "_None marked Go — ask human before coding._"
}

## 6. Explicitly out of scope
${
  [...adrP.noGo, ...adrP.dropped].length ||
  [...acP.noGo, ...acP.dropped].length ||
  [...testP.noGo, ...testP.dropped].length
    ? [
        ...adrP.noGo.map((a) => `- ADR no-go: \`${a.id}\` ${a.title}`),
        ...adrP.dropped.map((a) => `- ADR dropped: \`${a.id}\` ${a.title}`),
        ...acP.noGo.map((a) => `- AC no-go: \`${a.id}\``),
        ...acP.dropped.map((a) => `- AC dropped: \`${a.id}\``),
        ...testP.noGo.map((t) => `- Test no-go: \`${t.id}\` ${t.title}`),
        ...testP.dropped.map((t) => `- Test dropped: \`${t.id}\` ${t.title}`),
      ].join("\n")
    : "- _None_"
}

## 7. Pending (do not invent)
${
  [...adrP.pending, ...acP.pending, ...testP.pending].length
    ? [
        ...adrP.pending.map((a) => `- ADR pending: \`${a.id}\` ${a.title}`),
        ...acP.pending.map((a) => `- AC pending: \`${a.id}\``),
        ...testP.pending.map((t) => `- Test pending: \`${t.id}\` ${t.title}`),
      ].join("\n")
    : "- _None — review complete_"
}

## 8. Done checklist
- [ ] Diff limited to files in scope
- [ ] Every Go AC satisfied
- [ ] Every Go test reported pass (or waived in writing)
- [ ] No No-go / Dropped items implemented
- [ ] Short summary: what changed + how to verify
`;

  const machineJson: Record<string, unknown> = {
    kind: "dev_handoff",
    schema_version: HANDOFF_SCHEMA_VERSION,
    feature_change_id: base.featureChangeId,
    project: base.projectName,
    title: changeTitle,
    status: base.status,
    generated_at: base.generatedAt,
    exported_at: exportedAt,
    consumer_hints: {
      human_doc: "documents.human_markdown",
      agent_doc: "documents.agent_markdown",
      coding_system: "Use scope.go_* arrays only; ignore scope.out_of_scope and scope.pending",
      shared_db: "Persist this entire object; downstream readers key off schema_version",
    },
    authorization: {
      gates_approved: gatesApproved,
      gates_total: gatesTotal,
      may_implement: allGatesOk,
      gates: (base.gates || []).map((g) => ({
        key: g.key,
        label: g.label,
        role: g.role,
        approved: g.approved,
        approved_by: g.approvedBy || null,
        approved_at: g.approvedAt || null,
        note: g.note || null,
      })),
    },
    scope: {
      proposed_features: base.proposedFeatures || [],
      files_to_touch: base.filesToTouch || [],
      go_adrs: adrP.go,
      go_acceptance: acP.go,
      go_tests: testP.go,
      pending: {
        adrs: adrP.pending,
        acceptance: acP.pending,
        tests: testP.pending,
      },
      out_of_scope: {
        no_go_adrs: adrP.noGo,
        no_go_acceptance: acP.noGo,
        no_go_tests: testP.noGo,
        dropped_adrs: adrP.dropped,
        dropped_acceptance: acP.dropped,
        dropped_tests: testP.dropped,
      },
    },
    counts: {
      adrs: {
        go: adrP.go.length,
        pending: adrP.pending.length,
        no_go: adrP.noGo.length,
        dropped: adrP.dropped.length,
      },
      acceptance: {
        go: acP.go.length,
        pending: acP.pending.length,
        no_go: acP.noGo.length,
        dropped: acP.dropped.length,
      },
      tests: {
        go: testP.go.length,
        pending: testP.pending.length,
        no_go: testP.noGo.length,
        dropped: testP.dropped.length,
      },
    },
    // Full lists retained for audit / UI restore
    adrs: base.adrs,
    acceptance_criteria: base.acceptanceCriteria,
    test_cases: base.testCases,
    mermaid_proposed: base.mermaidProposed,
    mermaid_as_is: base.mermaidAsIs || "",
    recovered_features: base.recoveredFeatures || [],
    current_behavior: base.currentBehavior || "",
    desired_behavior: base.desiredBehavior || "",
    architecture_narrative: base.architectureNarrative || null,
    impact_stats: base.impactStats || null,
    agent_rules: [
      "Implement only scope.go_* items",
      "Do not implement out_of_scope",
      "Do not invent solutions for pending without human",
      "Additive API only",
      "Touch only files_to_touch",
      "Report every go_tests id before claiming done",
    ],
    documents: {
      human_markdown: null as string | null, // filled below
      agent_markdown: null as string | null,
    },
  };

  // Attach docs after object exists (avoid circular stringify bloat in nested copy)
  machineJson.documents = {
    human_markdown: humanMarkdown,
    agent_markdown: machineMarkdown,
  };

  const fullMarkdown = `# Change package — ${changeTitle}

> Ready-to-use package for **humans**, **LLM agents**, and **coding systems**.  
> Schema: \`dev_handoff\` v${HANDOFF_SCHEMA_VERSION} · id \`${base.featureChangeId}\`

---

## Part A — Human decision pack

${humanMarkdown}

---

## Part B — Agent / coding-system brief

${machineMarkdown}

---

## Part C — Machine JSON (shared database / API)

\`\`\`json
${JSON.stringify(
  {
    ...machineJson,
    documents: {
      human_markdown: "[see Part A]",
      agent_markdown: "[see Part B]",
    },
  },
  null,
  2,
)}
\`\`\`

_End of package · exported ${exportedAt}_
`;

  const activeAdrs = [...adrP.go, ...adrP.pending, ...adrP.noGo];
  const activeAcs = [...acP.go, ...acP.pending, ...acP.noGo];
  const activeTests = [...testP.go, ...testP.pending, ...testP.noGo];

  return {
    ...base,
    humanMarkdown,
    machineMarkdown,
    implementationBrief: machineMarkdown,
    fullMarkdown,
    machineJson,
    adrMarkdown: `## Architecture Decision Records (ADRs)\n\n${formatAdrMarkdown(adrP.go.length ? adrP.go : base.adrs)}`,
    testPlanMarkdown: `## Test plan (definition of done)\n\n${formatTestMarkdown(testP.go.length ? testP.go : base.testCases)}`,
    stats: {
      ...base.stats,
      adrs: activeAdrs.length,
      acceptance: activeAcs.length,
      tests: activeTests.length,
    },
  };
}

/** Filenames + payloads for copy / download / DB write. */
export function getHandoffExportBundle(handoff: DevHandoff) {
  const ready = rebuildHandoffExports(handoff);
  const slug =
    ready.title
      .replace(/^Development Handoff:\s*/i, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "change_package";
  return {
    handoff: ready,
    files: {
      humanMd: {
        name: `${slug}.human.md`,
        content: ready.humanMarkdown,
        mime: "text/markdown;charset=utf-8",
      },
      agentMd: {
        name: `${slug}.agent.md`,
        content: ready.machineMarkdown,
        mime: "text/markdown;charset=utf-8",
      },
      machineJson: {
        name: `${slug}.machine.json`,
        content: JSON.stringify(ready.machineJson, null, 2),
        mime: "application/json;charset=utf-8",
      },
      fullMd: {
        name: `${slug}.package.md`,
        content: ready.fullMarkdown,
        mime: "text/markdown;charset=utf-8",
      },
    },
  };
}

export function normalizeDecisionVerdicts(handoff: DevHandoff): DevHandoff {
  return {
    ...handoff,
    adrs: (handoff.adrs || []).map((a) => ({
      ...a,
      verdict:
        a.verdict ||
        (a.status === "accepted" || a.status === "go"
          ? "go"
          : a.status === "rejected" || a.status === "no_go"
            ? "no_go"
            : a.status === "dropped"
              ? "dropped"
              : "pending"),
    })),
    acceptanceCriteria: (handoff.acceptanceCriteria || []).map((c) => ({
      ...c,
      verdict: c.verdict || "pending",
    })),
    testCases: (handoff.testCases || []).map((t) => ({
      ...t,
      verdict: t.verdict || "pending",
    })),
  };
}

export function decisionSummary(handoff: DevHandoff) {
  const adrs = handoff.adrs || [];
  const acs = handoff.acceptanceCriteria || [];
  const count = (items: { verdict?: ItemVerdict }[], v: ItemVerdict) =>
    items.filter((i) => (i.verdict || "pending") === v).length;
  return {
    adr: {
      go: count(adrs, "go"),
      pending: count(adrs, "pending"),
      noGo: count(adrs, "no_go"),
      dropped: count(adrs, "dropped"),
      total: adrs.length,
    },
    ac: {
      go: count(acs, "go"),
      pending: count(acs, "pending"),
      noGo: count(acs, "no_go"),
      dropped: count(acs, "dropped"),
      total: acs.length,
    },
  };
}

export function testSummary(handoff: DevHandoff) {
  const tests = handoff.testCases || [];
  const count = (v: ItemVerdict) =>
    tests.filter((t) => (t.verdict || "pending") === v).length;
  const byKind = {} as Record<TestKind, number>;
  for (const t of tests) {
    if (t.verdict === "dropped") continue;
    byKind[t.kind] = (byKind[t.kind] || 0) + 1;
  }
  return {
    go: count("go"),
    pending: count("pending"),
    noGo: count("no_go"),
    dropped: count("dropped"),
    total: tests.length,
    byKind,
  };
}

/** Persist ADR / acceptance edits and verdicts into the handoff package. */
export function patchHandoffDecisions(
  handoff: DevHandoff,
  patch: {
    adrs?: HandoffAdr[];
    acceptanceCriteria?: AcceptanceCriterion[];
  },
): DevHandoff {
  const base = normalizeDecisionVerdicts(handoff);
  const adrs = (patch.adrs ?? base.adrs).map((a) => ({
    ...a,
    status:
      a.verdict === "go"
        ? "accepted"
        : a.verdict === "no_go"
          ? "rejected"
          : a.verdict === "dropped"
            ? "dropped"
            : a.status === "accepted" || a.status === "rejected" || a.status === "dropped"
              ? "proposed"
              : a.status || "proposed",
  }));
  const acceptanceCriteria = patch.acceptanceCriteria ?? base.acceptanceCriteria;
  const activeAdrs = adrs.filter((a) => a.verdict !== "dropped");
  const activeAcs = acceptanceCriteria.filter((c) => c.verdict !== "dropped");

  return rebuildHandoffExports({
    ...base,
    adrs,
    acceptanceCriteria,
    status: base.status === "approved" ? base.status : "in_review",
    stats: {
      ...base.stats,
      adrs: activeAdrs.length,
      acceptance: activeAcs.length,
    },
  });
}

/** Persist test plan edits and go / no-go into the handoff package. */
export function patchHandoffTests(
  handoff: DevHandoff,
  patch: { testCases: TestCase[] },
): DevHandoff {
  const base = normalizeDecisionVerdicts(handoff);
  const testCases = patch.testCases.map((t) => ({
    ...t,
    verdict: t.verdict || "pending",
  }));
  const active = testCases.filter((t) => t.verdict !== "dropped");

  return rebuildHandoffExports({
    ...base,
    testCases,
    status: base.status === "approved" ? base.status : "in_review",
    stats: {
      ...base.stats,
      tests: active.length,
    },
  });
}

export function applyGateApproval(
  handoff: DevHandoff,
  key: GateKey,
  approver: { id: string; name?: string | null },
  note?: string,
): DevHandoff {
  const approvedAt = new Date().toISOString();
  const gates = handoff.gates.map((g) =>
    g.key === key
      ? {
          ...g,
          approved: true,
          approvedBy: approver.name || approver.id,
          approvedAt,
          note: note || g.note,
        }
      : g,
  );
  const allApproved = gates.every((g) => g.approved);

  return rebuildHandoffExports({
    ...handoff,
    status: allApproved ? "approved" : "in_review",
    gates,
  });
}
