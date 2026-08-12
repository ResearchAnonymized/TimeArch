/**
 * Deterministic Change Package builder.
 * Assembles stakeholder + LLM coding sections from DB rows — no extra LLM call required.
 */
export interface ChangePackageInput {
  projectName: string;
  featureChange: {
    id: string;
    title: string;
    description?: string | null;
    change_type?: string | null;
    priority?: string | null;
    current_behavior?: string | null;
    desired_behavior?: string | null;
    merit_score?: number | null;
    merit_justification?: string | null;
  };
  imports: Array<{ kind: string; source_label?: string | null; status: string; parsed_summary?: Record<string, unknown> | null }>;
  mappings: Array<{ element_type?: string | null; element_ref?: string | null; relationship?: string | null; confidence?: number | null }>;
  ripples: Array<{
    impacted_element_type?: string | null;
    impacted_element_ref?: string | null;
    classification?: string | null;
    severity?: string | null;
    recommended_action?: string | null;
  }>;
  quality: Array<{ attribute?: string | null; direction?: string | null; severity?: string | null; rationale?: string | null }>;
  alternatives: Array<{ title?: string | null; summary?: string | null; tradeoffs?: string | null; is_preferred?: boolean | null }>;
  workItems: Array<{
    title: string;
    description?: string | null;
    category?: string | null;
    priority?: string | null;
    effort?: string | null;
    validation_criteria?: string[] | null;
    dependencies?: string[] | null;
    ordering?: number | null;
  }>;
  adr?: { title?: string | null; decision?: string | null; consequences?: string | null; status?: string | null } | null;
  /** Color-coded proposed architecture from ripple + mapping analysis */
  proposedArchitecture?: {
    mermaidProposed: string;
    impactSummaryMarkdown: string;
    changeCodingBrief: string;
    proposedFeatures: string[];
    stats: { new: number; modified: number; ripple: number; unchanged: number };
  } | null;
  baselineBrief?: string | null;
  asIsMermaid?: string | null;
}

export interface ChangePackage {
  title: string;
  markdown: string;
  generatedAt: string;
  featureChangeId: string;
  stats: {
    mappings: number;
    ripples: number;
    quality: number;
    alternatives: number;
    workItems: number;
  };
}

function bullet(items: string[], empty = "_None recorded._"): string {
  if (!items.length) return empty;
  return items.map((i) => `- ${i}`).join("\n");
}

export function buildChangePackage(input: ChangePackageInput): ChangePackage {
  const fc = input.featureChange;
  const generatedAt = new Date().toISOString();
  const preferred =
    input.alternatives.find((a) => a.is_preferred) || input.alternatives[0] || null;

  const importLines = input.imports.map((i) => {
    const s = i.parsed_summary || {};
    const bits = Object.entries(s)
      .filter(([, v]) => typeof v === "number" && (v as number) > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    return `${i.kind}: ${i.source_label || "file"} (${i.status}${bits ? `; ${bits}` : ""})`;
  });

  const mappingLines = input.mappings.map(
    (m) =>
      `${m.relationship || "touches"} **${m.element_type || "element"}** \`${m.element_ref || "?"}\`${
        m.confidence != null ? ` (confidence ${Math.round(Number(m.confidence) * 100)}%)` : ""
      }`,
  );

  const rippleLines = input.ripples.map(
    (r) =>
      `[${r.severity || r.classification || "impact"}] ${r.impacted_element_type || "element"} \`${r.impacted_element_ref || "?"}\`${
        r.recommended_action ? ` — ${r.recommended_action}` : ""
      }`,
  );

  const qualityLines = input.quality.map(
    (q) =>
      `${q.attribute || "attribute"}: ${q.direction || "unknown"}${q.severity ? ` (${q.severity})` : ""}${
        q.rationale ? ` — ${q.rationale}` : ""
      }`,
  );

  const altLines = input.alternatives.map(
    (a) =>
      `**${a.title || "Option"}**${a.is_preferred ? " _(preferred)_" : ""}${a.summary ? `: ${a.summary}` : ""}${
        a.tradeoffs ? `\n  Trade-offs: ${a.tradeoffs}` : ""
      }`,
  );

  const workLines = [...input.workItems]
    .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
    .map((w, idx) => {
      const criteria = (w.validation_criteria || []).filter(Boolean);
      const deps = (w.dependencies || []).filter(Boolean);
      return [
        `### ${idx + 1}. ${w.title}`,
        `- Category: ${w.category || "implementation"} · Priority: ${w.priority || "medium"} · Effort: ${w.effort || "M"}`,
        w.description ? `- Description: ${w.description}` : null,
        deps.length ? `- Depends on: ${deps.join(", ")}` : null,
        criteria.length ? `- Acceptance criteria:\n${criteria.map((c) => `  - [ ] ${c}`).join("\n")}` : `- Acceptance criteria: _define during implementation_`,
      ]
        .filter(Boolean)
        .join("\n");
    });

  const markdown = `# Change Package: ${fc.title}

> Project: **${input.projectName}** · Generated: ${generatedAt.slice(0, 19)}Z  
> Change type: \`${fc.change_type || "modify"}\` · Priority: \`${fc.priority || "medium"}\`${
    fc.merit_score != null ? ` · Merit score: **${fc.merit_score}**/5` : ""
  }

---

## Part A — For stakeholders

### 1. Executive summary
We analyzed the existing system and the requested change **"${fc.title}"**. This package summarizes business impact, architectural blast radius, quality effects, and a delivery plan that engineering (or an AI coding agent) can execute against the live codebase.

${fc.description ? fc.description : "_No additional description provided._"}

${fc.merit_justification ? `**Merit rationale:** ${fc.merit_justification}` : ""}

### 2. Current vs desired behavior
| | |
|---|---|
| **Today** | ${fc.current_behavior || "_Not specified_"} |
| **Target** | ${fc.desired_behavior || "_Not specified_"} |

### 3. Impact at a glance
| Signal | Count |
|---|---|
| Touched architecture elements | ${input.mappings.length} |
| Secondary ripple findings | ${input.ripples.length} |
| Quality attributes assessed | ${input.quality.length} |
| Solution alternatives | ${input.alternatives.length} |
| Delivery work items | ${input.workItems.length} |

### 4. Quality & risk highlights
${bullet(qualityLines)}

### 5. Recommended approach
${
  preferred
    ? `**Preferred option:** ${preferred.title || "Selected alternative"}\n\n${preferred.summary || ""}\n\n${preferred.tradeoffs ? `Trade-offs: ${preferred.tradeoffs}` : ""}`
    : "_No preferred alternative recorded — review Part B alternatives or re-run analysis._"
}

${input.adr ? `### 6. Decision record\n**${input.adr.title || "ADR"}** (${input.adr.status || "draft"})\n\n${input.adr.decision || ""}\n\nConsequences: ${input.adr.consequences || "_n/a_"}` : "### 6. Decision record\n_No ADR drafted yet — treat the preferred alternative as the working decision._"}

### 7. Delivery roadmap (plain language)
${
  input.workItems.length
    ? input.workItems
        .slice()
        .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
        .map((w, i) => `${i + 1}. **${w.title}** (${w.category || "work"}, ${w.effort || "M"})`)
        .join("\n")
    : "_No work items yet._"
}

---

## Part B — For engineers & coding LLMs

> **How to use this section:** Paste Part B into your coding agent together with the relevant source files. Treat work items as an ordered checklist. Do not expand scope beyond the desired behavior.

### System baseline (what we reverse-engineered)
${bullet(importLines)}

### As-is architecture (Mermaid)
\`\`\`mermaid
${input.asIsMermaid || `flowchart TB
  UI[Browser / UI layer] --> API[Application / API layer]
  API --> Domain[Domain / data layer]`}
\`\`\`
${input.proposedArchitecture ? "_Compare with the proposed diagram below (color-coded impact)._" : "_See **Extracted system inventory** for project-specific as-is detail._"}

### Proposed architecture & impact
${
  input.proposedArchitecture
    ? `**New capabilities:** ${input.proposedArchitecture.proposedFeatures.map((f) => `\`${f}\``).join(", ") || "_none_"}

| Impact | Count |
|---|---|
| New | ${input.proposedArchitecture.stats.new} |
| Modified | ${input.proposedArchitecture.stats.modified} |
| Ripple | ${input.proposedArchitecture.stats.ripple} |
| Unchanged | ${input.proposedArchitecture.stats.unchanged} |

${input.proposedArchitecture.impactSummaryMarkdown}

#### Proposed diagram (Mermaid)
\`\`\`mermaid
${input.proposedArchitecture.mermaidProposed}
\`\`\`

#### Change-specific coding brief
${input.proposedArchitecture.changeCodingBrief}`
    : "_Run Analyze to generate proposed architecture with color-coded impact._"
}

### Baseline coding brief (as-is — do not break)
${input.baselineBrief || "_Open **Extracted system inventory → LLM coding brief** for the full baseline._"}

### Affected architecture elements
${bullet(mappingLines)}

### Blast radius (must verify)
${bullet(rippleLines)}

### Alternatives considered
${bullet(altLines)}

### Ordered implementation tasks
${workLines.length ? workLines.join("\n\n") : "_No work items generated._"}

### Verification checklist for the agent
- [ ] Each work item acceptance criterion is satisfied or explicitly deferred with rationale
- [ ] Contract / API / schema tests updated for touched surfaces
- [ ] No unrelated refactors
- [ ] Short PR description references this Change Package title and feature_change_id \`${fc.id}\`

---

## Machine-readable impact (for agents)

\`\`\`json
${JSON.stringify(
  {
    feature_change_id: fc.id,
    title: fc.title,
    change_type: fc.change_type,
    proposed_features: input.proposedArchitecture?.proposedFeatures ?? [],
    impact_stats: input.proposedArchitecture?.stats ?? null,
    mappings: input.mappings,
    ripples: input.ripples,
    work_item_count: input.workItems.length,
  },
  null,
  2,
)}
\`\`\`

_End of Change Package · feature_change_id=\`${fc.id}\`_
`;

  return {
    title: `Change Package: ${fc.title}`,
    markdown,
    generatedAt,
    featureChangeId: fc.id,
    stats: {
      mappings: input.mappings.length,
      ripples: input.ripples.length,
      quality: input.quality.length,
      alternatives: input.alternatives.length,
      workItems: input.workItems.length,
    },
  };
}
