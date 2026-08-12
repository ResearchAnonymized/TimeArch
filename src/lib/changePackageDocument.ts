/**
 * Structured Change Package documents for on-screen reading and PDF / DOCX export.
 * Built from Go / No-go verdicts — not a raw markdown dump.
 */
import {
  normalizeDecisionVerdicts,
  type AcceptanceCriterion,
  type DevHandoff,
  type HandoffAdr,
  type TestCase,
} from "@/lib/devHandoff";

export type PackageDocKind = "proposal" | "plan";

export interface PackageDocMeta {
  /** Internal bundle label (may be "Revision (3): …") — not used as document H1 */
  title: string;
  /** Professional H1, e.g. "Change Proposal for Sauna Demo" */
  documentTitle: string;
  /** Formal doc type, e.g. "Software Change Proposal (SCP)" */
  documentType: string;
  /** Stable document id for traceability */
  documentId: string;
  revisionLabel: string | null;
  revisionSummary: string;
  /** Individual proposed changes — never concatenated into the title */
  changeItems: string[];
  projectName: string;
  status: string;
  featureChangeId: string;
  exportedAt: string;
  gatesApproved: number;
  gatesTotal: number;
  mayImplement: boolean;
}

export interface PackageDocument {
  kind: PackageDocKind;
  meta: PackageDocMeta;
  features: string[];
  recoveredFeatures: string[];
  files: string[];
  mermaidAsIs: string;
  mermaidProposed: string;
  currentBehavior: string;
  desiredBehavior: string;
  architectureNarrative: NonNullable<DevHandoff["architectureNarrative"]> | null;
  impactStats: NonNullable<DevHandoff["impactStats"]> | null;
  adrs: HandoffAdr[];
  acceptance: AcceptanceCriterion[];
  tests: TestCase[];
  pendingAdrs: HandoffAdr[];
  pendingAcceptance: AcceptanceCriterion[];
  pendingTests: TestCase[];
  excludedAdrs: HandoffAdr[];
  excludedAcceptance: AcceptanceCriterion[];
  excludedTests: TestCase[];
  agentRules: string[];
  gates: DevHandoff["gates"];
}

function cleanTitle(handoff: DevHandoff) {
  return handoff.title.replace(/^Development Handoff:\s*/i, "").trim() || "Change";
}

function parseRevisionBundleTitle(raw: string, features: string[]) {
  const m = raw.match(/^Revision\s*\((\d+)\)\s*:?\s*(.*)$/i);
  if (m) {
    const n = m[1];
    const tail = (m[2] || "").trim();
    const fromTitle = tail
      ? tail.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean)
      : [];
    const changeItems = features.length ? features : fromTitle;
    return {
      revisionLabel: `Revision ${n}`,
      revisionSummary:
        changeItems.length > 0
          ? `This document describes ${changeItems.length} proposed change(s) to the recovered system baseline.`
          : `Brownfield change package — revision ${n}.`,
      changeItems: changeItems.length ? changeItems : ["Approved system change"],
    };
  }
  const changeItems = features.length ? features : [raw || "System change"];
  return {
    revisionLabel: null,
    revisionSummary:
      "This document describes an approved change package for the recovered brownfield system.",
    changeItems,
  };
}

function buildDocumentTitle(projectName: string, kind: PackageDocKind): string {
  const system = projectName.trim() || "System";
  return kind === "plan"
    ? `Implementation Build Plan for ${system}`
    : `Change Proposal for ${system}`;
}

function buildDocumentType(kind: PackageDocKind): string {
  return kind === "plan"
    ? "Software Implementation Plan (SIP)"
    : "Software Change Proposal (SCP)";
}

function documentOutline(kind: PackageDocKind): string[] {
  if (kind === "plan") {
    return [
      "1. Purpose and authorization",
      "2. Implementation scope",
      "3. Rules before coding",
      "4. Architecture decisions",
      "5. Requirements to satisfy",
      "6. Mandatory verification",
      "7. Release status",
    ];
  }
  return [
    "1. Introduction and purpose",
    "2. Existing system baseline",
    "3. Proposed changes",
    "4. Current vs target behavior",
    "5. System architecture",
    "6. Approved architecture decisions",
    "7. Functional requirements",
    "8. Verification and definition of done",
    "9. Release approval",
    "Appendix A. Out of scope and pending items",
  ];
}

function changeItemsOf(doc: PackageDocument): string[] {
  return doc.meta.changeItems.length
    ? doc.meta.changeItems
    : doc.features.length
      ? doc.features
      : ["System change"];
}

function partition<T extends { verdict?: string }>(items: T[]) {
  const go: T[] = [];
  const pending: T[] = [];
  const excluded: T[] = [];
  for (const item of items) {
    const v = item.verdict || "pending";
    if (v === "go") go.push(item);
    else if (v === "pending") pending.push(item);
    else excluded.push(item);
  }
  return { go, pending, excluded };
}

export function buildPackageDocument(
  handoff: DevHandoff,
  kind: PackageDocKind,
): PackageDocument {
  const base = normalizeDecisionVerdicts(handoff);
  const adrP = partition(base.adrs || []);
  const acP = partition(base.acceptanceCriteria || []);
  const testP = partition(base.testCases || []);
  const gatesApproved = (base.gates || []).filter((g) => g.approved).length;
  const gatesTotal = (base.gates || []).length;
  const rawTitle = cleanTitle(base);
  const parsed = parseRevisionBundleTitle(rawTitle, base.proposedFeatures || []);
  const projectName = base.projectName || "System";

  return {
    kind,
    meta: {
      title: rawTitle,
      documentTitle: buildDocumentTitle(projectName, kind),
      documentType: buildDocumentType(kind),
      documentId: `TA-${kind === "plan" ? "SIP" : "SCP"}-${base.featureChangeId.slice(0, 8).toUpperCase()}`,
      revisionLabel: parsed.revisionLabel,
      revisionSummary: parsed.revisionSummary,
      changeItems: parsed.changeItems,
      projectName,
      status: base.status,
      featureChangeId: base.featureChangeId,
      exportedAt: new Date().toISOString(),
      gatesApproved,
      gatesTotal,
      mayImplement: gatesTotal > 0 && gatesApproved === gatesTotal,
    },
    features: base.proposedFeatures || [],
    recoveredFeatures: base.recoveredFeatures || [],
    files: base.filesToTouch || [],
    mermaidAsIs: base.mermaidAsIs || "",
    mermaidProposed: base.mermaidProposed || "",
    currentBehavior: (base.currentBehavior || "").replace(/^\s*What should happen\s*:?\s*/i, ""),
    desiredBehavior: (base.desiredBehavior || "").replace(/^\s*What should happen\s*:?\s*/i, ""),
    architectureNarrative: base.architectureNarrative || null,
    impactStats: base.impactStats || null,
    adrs: adrP.go,
    acceptance: acP.go,
    tests: testP.go,
    pendingAdrs: adrP.pending,
    pendingAcceptance: acP.pending,
    pendingTests: testP.pending,
    excludedAdrs: adrP.excluded,
    excludedAcceptance: acP.excluded,
    excludedTests: testP.excluded,
    agentRules: [
      "Implement only Go-scoped decisions, requirements, and tests.",
      "Do not implement No-go or Dropped items.",
      "Do not invent solutions for Pending items without a human.",
      "Additive API only — keep existing JSON keys.",
      "Touch only the listed files.",
      "Report every Go test id before claiming done.",
    ],
    gates: base.gates || [],
  };
}

function safeName(s: string) {
  return s.replace(/[^\w.-]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "change_package";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Plain markdown for clipboard — SRS-style sections and numbered figures. */
export function packageDocumentToMarkdown(doc: PackageDocument): string {
  const isPlan = doc.kind === "plan";
  const items = changeItemsOf(doc);
  const lines: string[] = [];

  lines.push(`# ${doc.meta.documentTitle}`);
  lines.push("");
  lines.push(`**Document type:** ${doc.meta.documentType}`);
  lines.push(`**Document ID:** ${doc.meta.documentId}`);
  if (doc.meta.revisionLabel) lines.push(`**Revision:** ${doc.meta.revisionLabel}`);
  lines.push(`**Project:** ${doc.meta.projectName}`);
  lines.push(`**Status:** ${doc.meta.status}`);
  lines.push(`**Release:** ${doc.meta.gatesApproved}/${doc.meta.gatesTotal} checks`);
  lines.push(`**Date:** ${formatDate(doc.meta.exportedAt)}`);
  lines.push(`**Package reference:** ${doc.meta.featureChangeId}`);
  lines.push("");
  lines.push(`> ${doc.meta.revisionSummary}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Table of contents");
  lines.push("");
  documentOutline(doc.kind).forEach((entry) => lines.push(`- ${entry}`));
  lines.push("");
  lines.push("---");
  lines.push("");

  if (!isPlan) {
    lines.push("## 1. Introduction and purpose");
    lines.push("");
    lines.push(
      `This ${doc.meta.documentType} defines the approved change scope for **${doc.meta.projectName}**. It is derived from reverse-engineered baseline analysis and human review (Go / No-go decisions).`,
    );
    lines.push("");
    lines.push("## 2. Existing system baseline");
    lines.push("");
    if (doc.recoveredFeatures.length) {
      doc.recoveredFeatures.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    } else {
      lines.push("_No recovered capabilities recorded — re-run Recover if needed._");
    }
    lines.push("");
    lines.push("## 3. Proposed changes");
    lines.push("");
    items.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push("");
    lines.push("### 3.1 Files in scope");
    lines.push("");
    if (doc.files.length) doc.files.forEach((f) => lines.push(`- \`${f}\``));
    else lines.push("- _Confirm with tech lead._");
    lines.push("");
    lines.push("## 4. Current vs target behavior");
    lines.push("");
    lines.push(`**Current (as-is).** ${doc.currentBehavior || "_As recovered in inventory._"}`);
    lines.push("");
    lines.push(`**Target (to-be).** ${doc.desiredBehavior || "_As proposed in this revision._"}`);
    lines.push("");
    lines.push("## 5. System architecture");
    lines.push("");
    if (doc.architectureNarrative) {
      lines.push(`**Pre-change summary.** ${doc.architectureNarrative.asIsSummary}`);
      lines.push("");
      lines.push(`**Post-change summary.** ${doc.architectureNarrative.toBeSummary}`);
      lines.push("");
      lines.push(`**Discussion.** ${doc.architectureNarrative.diagramDiscussion}`);
      lines.push("");
    }
    if (doc.mermaidAsIs) {
      lines.push("**Figure 1 — As-is system architecture**");
      lines.push("");
      lines.push("```mermaid");
      lines.push(doc.mermaidAsIs);
      lines.push("```");
      lines.push("");
      lines.push("_Figure 1: Recovered architecture before this change package._");
      lines.push("");
    }
    if (doc.mermaidProposed) {
      lines.push("**Figure 2 — To-be system architecture**");
      lines.push("");
      lines.push("```mermaid");
      lines.push(doc.mermaidProposed);
      lines.push("```");
      lines.push("");
      lines.push("_Figure 2: Proposed architecture after approved changes._");
      lines.push("");
    }
    lines.push("## 6. Approved architecture decisions");
  } else {
    lines.push("## 1. Purpose and authorization");
    lines.push("");
    lines.push(
      `This build plan authorizes implementation work for **${doc.meta.projectName}** when release gates are approved.`,
    );
    lines.push("");
    lines.push("## 2. Implementation scope");
    lines.push("");
    items.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push("");
    lines.push("## 3. Rules before coding");
    lines.push("");
    doc.agentRules.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
    lines.push("## 4. Architecture decisions");
  }
  lines.push("");
  if (doc.adrs.length) {
    for (const a of doc.adrs) {
      lines.push(`### ${a.id} — ${a.title}`);
      lines.push("");
      lines.push(`**Decision.** ${a.decision || "—"}`);
      lines.push("");
      lines.push(`**Consequences.** ${a.consequences || "—"}`);
      lines.push("");
    }
  } else {
    lines.push("_None marked Go yet._");
    lines.push("");
  }

  if (!isPlan) {
    lines.push("## 7. Functional requirements");
  } else {
    lines.push("## 5. Requirements to satisfy");
  }
  lines.push("");
  if (doc.acceptance.length) {
    doc.acceptance.forEach((a) => lines.push(`- [ ] **${a.id}:** ${a.text}`));
  } else {
    lines.push("_None marked Go yet._");
  }
  lines.push("");

  if (!isPlan) {
    lines.push("## 8. Verification and definition of done");
  } else {
    lines.push("## 6. Mandatory verification");
  }
  lines.push("");
  if (doc.tests.length) {
    for (const t of doc.tests) {
      lines.push(`### ${t.id} — ${t.title}`);
      lines.push("");
      lines.push(`- Kind: ${t.kind}`);
      lines.push(`- Steps: ${t.steps || "—"}`);
      lines.push(`- Expected: ${t.expected || "—"}`);
      lines.push("");
    }
  } else {
    lines.push("_None marked Go yet._");
    lines.push("");
  }

  lines.push(isPlan ? "## 7. Release status" : "## 9. Release approval");
  lines.push("");
  for (const g of doc.gates) {
    lines.push(
      `- **${g.label}** (${g.role}): ${g.approved ? "Released" : "Pending"} — ${g.checks}`,
    );
  }
  lines.push("");

  const hasExcluded =
    doc.excludedAdrs.length +
      doc.excludedAcceptance.length +
      doc.excludedTests.length >
    0;
  const hasPending =
    doc.pendingAdrs.length + doc.pendingAcceptance.length + doc.pendingTests.length > 0;

  if (hasExcluded || hasPending) {
    lines.push(isPlan ? "## Appendix" : "## Appendix A. Out of scope and pending items");
    lines.push("");
    if (hasExcluded) {
      lines.push("### Out of scope (No-go / Dropped)");
      lines.push("");
      doc.excludedAdrs.forEach((a) => lines.push(`- ADR ${a.id}: ${a.title}`));
      doc.excludedAcceptance.forEach((a) => lines.push(`- AC ${a.id}: ${a.text}`));
      doc.excludedTests.forEach((t) => lines.push(`- Test ${t.id}: ${t.title}`));
      lines.push("");
    }
    if (hasPending) {
      lines.push("### Pending review");
      lines.push("");
      doc.pendingAdrs.forEach((a) => lines.push(`- ADR ${a.id}: ${a.title}`));
      doc.pendingAcceptance.forEach((a) => lines.push(`- AC ${a.id}: ${a.text}`));
      doc.pendingTests.forEach((t) => lines.push(`- Test ${t.id}: ${t.title}`));
      lines.push("");
    }
  }

  return lines.join("\n");
}

/** Section outline for on-screen table of contents. */
export function getPackageDocumentOutline(kind: PackageDocKind): string[] {
  return documentOutline(kind);
}

export async function exportPackageDocumentPDF(doc: PackageDocument) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const COLORS = {
    primary: [37, 99, 235] as [number, number, number],
    dark: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    light: [248, 250, 252] as [number, number, number],
  };

  const isPlan = doc.kind === "plan";
  const items = changeItemsOf(doc);

  function checkPage(needed: number) {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function addHeading(text: string) {
    checkPage(14);
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...COLORS.dark);
    pdf.text(text, margin, y);
    y += 3;
    pdf.setDrawColor(...COLORS.primary);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, margin + 28, y);
    y += 6;
  }

  function addBody(text: string, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...COLORS.dark);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPage(5);
      pdf.text(line, margin, y);
      y += 4.4;
    }
  }

  function addMuted(text: string) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.muted);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPage(4.5);
      pdf.text(line, margin, y);
      y += 4;
    }
  }

  // Cover band — professional title, not raw revision bundle string
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(doc.meta.documentType.toUpperCase(), margin, 14);
  pdf.setFontSize(15);
  const h1Lines = pdf.splitTextToSize(doc.meta.documentTitle, contentWidth);
  pdf.text(h1Lines.slice(0, 2), margin, 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(doc.meta.revisionSummary, margin, 38, { maxWidth: contentWidth });
  pdf.setFontSize(8);
  pdf.text(
    `${doc.meta.documentId}  ·  ${formatDate(doc.meta.exportedAt)}  ·  ${doc.meta.status}`,
    margin,
    44,
  );
  y = 56;

  addHeading("Document control");
  addBody(`Document: ${doc.meta.documentTitle}`);
  addBody(`Type: ${doc.meta.documentType}`);
  addBody(`Document ID: ${doc.meta.documentId}`);
  if (doc.meta.revisionLabel) addBody(`Revision: ${doc.meta.revisionLabel}`);
  addBody(`Project: ${doc.meta.projectName}`);
  addBody(`Status: ${doc.meta.status}`);
  addBody(`Release checks: ${doc.meta.gatesApproved}/${doc.meta.gatesTotal}`);
  addBody(`Package reference: ${doc.meta.featureChangeId}`);

  pdf.addPage();
  y = margin;

  addHeading("Table of contents");
  documentOutline(doc.kind).forEach((entry) => addBody(`• ${entry}`));

  pdf.addPage();
  y = margin;

  if (!isPlan) {
    addHeading("1. Introduction and purpose");
    addBody(doc.meta.revisionSummary);
    addHeading("2. Existing system baseline");
    if (doc.recoveredFeatures.length) {
      doc.recoveredFeatures.forEach((f, i) => addBody(`${i + 1}. ${f}`));
    } else addMuted("None recorded.");
    addHeading("3. Proposed changes");
    items.forEach((f, i) => addBody(`${i + 1}. ${f}`));
    addBody("Files in scope:", true);
    if (doc.files.length) doc.files.forEach((f) => addBody(`• ${f}`));
    else addMuted("Confirm with tech lead.");
    addHeading("4. Current vs target behavior");
    addMuted(`Current: ${doc.currentBehavior || "as recovered"}`);
    addMuted(`Target: ${doc.desiredBehavior || "as proposed"}`);
    addHeading("5. System architecture");
  } else {
    addHeading("1. Purpose and authorization");
    addBody(doc.meta.revisionSummary);
    addHeading("2. Implementation scope");
    items.forEach((f, i) => addBody(`${i + 1}. ${f}`));
    addHeading("3. Rules before coding");
    doc.agentRules.forEach((r) => addBody(`• ${r}`));
    addHeading("4. Architecture decisions");
  }

  const findings =
    doc.architectureNarrative?.keyFindings?.length
      ? doc.architectureNarrative.keyFindings
      : [
          `${doc.recoveredFeatures.length} recovered capability(ies)`,
          `${items.length} proposed change(s)`,
        ];
  if (!isPlan) findings.forEach((f) => addBody(`• ${f}`));

  if (doc.architectureNarrative) {
    if (!isPlan) {
      addBody(`Pre-change: ${doc.architectureNarrative.asIsSummary}`);
      y += 1;
      addBody(`Post-change: ${doc.architectureNarrative.toBeSummary}`);
      y += 1;
      addBody(doc.architectureNarrative.diagramDiscussion);
    }
  }

  if (doc.mermaidAsIs) {
    addHeading(isPlan ? "Figure — As-is reference" : "Figure 1 — As-is system architecture");
    addMuted("Recovered architecture before this change package.");
    addMuted("Render at https://mermaid.live using the source below:");
    y += 2;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    const asIsLines = doc.mermaidAsIs.split("\n").slice(0, 40);
    for (const line of asIsLines) {
      checkPage(4);
      pdf.text(line, margin, y);
      y += 3.8;
    }
    if (doc.mermaidAsIs.split("\n").length > 40) {
      addMuted("… (truncated — see interactive view or agent_pack.json for full source)");
    }
    y += 2;
  }

  if (doc.mermaidProposed) {
    addHeading(isPlan ? "Figure — To-be reference" : "Figure 2 — To-be system architecture");
    addMuted("Proposed architecture after approved changes.");
    addMuted("Render at https://mermaid.live using the source below:");
    y += 2;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.muted);
    const toBeLines = doc.mermaidProposed.split("\n").slice(0, 40);
    for (const line of toBeLines) {
      checkPage(4);
      pdf.text(line, margin, y);
      y += 3.8;
    }
    if (doc.mermaidProposed.split("\n").length > 40) {
      addMuted("… (truncated — see interactive view or agent_pack.json for full source)");
    }
    y += 2;
  }

  if (!isPlan) addHeading("6. Approved architecture decisions");
  else addHeading("5. Architecture decisions (detail)");

  if (doc.adrs.length) {
    for (const a of doc.adrs) {
      checkPage(18);
      addBody(`${a.id} — ${a.title}`, true);
      addMuted(`Decision: ${a.decision || "—"}`);
      addMuted(`Consequences: ${a.consequences || "—"}`);
      y += 2;
    }
  } else {
    addMuted("None marked Go yet.");
  }

  addHeading(isPlan ? "6. Requirements to satisfy" : "7. Functional requirements");
  if (doc.acceptance.length) {
    autoTable(pdf, {
      startY: y,
      head: [["ID", "Requirement"]],
      body: doc.acceptance.map((a) => [a.id, a.text]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: COLORS.light },
    });
    y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 6;
  } else {
    addMuted("None marked Go yet.");
  }

  addHeading(isPlan ? "7. Mandatory verification" : "8. Verification and definition of done");
  if (doc.tests.length) {
    autoTable(pdf, {
      startY: y,
      head: [["ID", "Title", "Kind", "Expected"]],
      body: doc.tests.map((t) => [t.id, t.title, t.kind, t.expected || "—"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 22 } },
    });
    y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 6;
  } else {
    addMuted("None marked Go yet.");
  }

  addHeading(isPlan ? "8. Release status" : "9. Release approval");
  autoTable(pdf, {
    startY: y,
    head: [["Check", "Role", "Status"]],
    body: doc.gates.map((g) => [g.label, g.role, g.approved ? "Released" : "Pending"]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2, textColor: COLORS.dark },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
  });

  const name = `${safeName(doc.meta.projectName)}_${doc.kind}.pdf`;
  pdf.save(name);
}

/**
 * Agent-ready JSON pack — the full machineJson enriched with diagram sources,
 * human-readable names for every field, and agent rules.
 * Consumers (LLM agents, CI pipelines) key off `kind === "agent_pack"` and
 * `schema_version` to know the shape.
 */
export function buildAgentPack(handoff: DevHandoff): Record<string, unknown> {
  const mj = handoff.machineJson as Record<string, unknown>;
  const title = handoff.title.replace(/^Development Handoff:\s*/i, "").trim();
  const authorization =
    (mj.authorization as Record<string, unknown> | undefined) ?? {
      may_implement: handoff.gates.every((g) => g.approved),
      gates_approved: handoff.gates.filter((g) => g.approved).length,
      gates_total: handoff.gates.length,
    };
  const scope =
    (mj.scope as Record<string, unknown> | undefined) ?? {
      proposed_features: handoff.proposedFeatures,
      files_to_touch: handoff.filesToTouch,
      go_adrs: handoff.adrs,
      go_acceptance: handoff.acceptanceCriteria,
      go_tests: handoff.testCases,
    };
  const filesToTouch = Array.isArray(scope.files_to_touch)
    ? scope.files_to_touch.map(String)
    : handoff.filesToTouch || [];
  const goAdrs = Array.isArray(scope.go_adrs) ? scope.go_adrs : handoff.adrs;
  const goAcceptance = Array.isArray(scope.go_acceptance)
    ? scope.go_acceptance
    : handoff.acceptanceCriteria;
  const goTests = Array.isArray(scope.go_tests) ? scope.go_tests : handoff.testCases;

  return {
    kind: "agent_pack",
    schema_version: (mj.schema_version as number | undefined) ?? 4,
    feature_change_id: handoff.featureChangeId,
    project: handoff.projectName,
    title,
    status: handoff.status,
    generated_at: handoff.generatedAt,
    exported_at: new Date().toISOString(),

    summary: {
      one_line_goal: title,
      today_system: handoff.currentBehavior || "See recovered baseline below.",
      target_system: handoff.desiredBehavior || "See required changes below.",
      package_id: handoff.featureChangeId,
    },

    // Top-level answer to: "am I allowed to write code yet?"
    authorization,

    // Minimal instructions for simple agents that do not reason well over nested documents.
    implement_now: {
      allowed: Boolean(authorization.may_implement),
      stop_reason: authorization.may_implement
        ? null
        : "One or more human release gates are still pending.",
      target_files: filesToTouch,
      proposed_features: Array.isArray(scope.proposed_features)
        ? scope.proposed_features.map(String)
        : handoff.proposedFeatures || [],
      required_adrs: goAdrs,
      required_acceptance_criteria: goAcceptance,
      required_tests: goTests,
    },

    // Full reviewed scope retained for richer agents and downstream systems.
    scope,

    // ── Context for the agent ────────────────────────────────────────────────
    current_behavior: handoff.currentBehavior,
    desired_behavior: handoff.desiredBehavior,
    recovered_features: handoff.recoveredFeatures,
    impact_stats: handoff.impactStats ?? null,
    architecture_narrative: handoff.architectureNarrative ?? null,

    // ── Diagrams (Mermaid source) ─────────────────────────────────────────────
    diagrams: {
      as_is: handoff.mermaidAsIs || null,
      to_be: handoff.mermaidProposed || null,
      note: "Paste diagram source into https://mermaid.live or render with mermaid.js",
    },

    // ── Agent rules ──────────────────────────────────────────────────────────
    agent_rules: (mj.agent_rules as string[] | undefined) ?? [
      "Implement only scope.go_* items",
      "Do not implement out_of_scope or pending items without human approval",
      "Additive API only — keep existing JSON keys",
      "Touch only files listed in scope.files_to_touch",
      "Report every go_tests id before claiming done",
    ],

    execution_checklist: [
      "1. Read summary, implement_now, and agent_rules first.",
      "2. If implement_now.allowed is false, stop and ask for human approval.",
      "3. Modify only implement_now.target_files.",
      "4. Satisfy every implement_now.required_acceptance_criteria item.",
      "5. Honor every implement_now.required_adrs decision while coding.",
      "6. Run and report every implement_now.required_tests item before claiming done.",
      "7. Do not implement anything listed under scope.out_of_scope or scope.pending.",
    ],

    handoff_for_agent: {
      read_order: [
        "authorization",
        "implement_now",
        "agent_rules",
        "current_behavior",
        "desired_behavior",
        "diagrams",
        "documents.implementation_brief",
      ],
      success_definition: {
        code_only_within_target_files: true,
        acceptance_criteria_must_all_pass: true,
        required_tests_must_all_be_reported: true,
        out_of_scope_items_must_not_be_implemented: true,
      },
    },

    // ── Human-readable docs (for LLM context window) ─────────────────────────
    documents: {
      implementation_brief: handoff.implementationBrief,
      human_markdown: handoff.humanMarkdown,
      agent_markdown: handoff.machineMarkdown,
    },
  };
}

export function downloadAgentPackJSON(handoff: DevHandoff) {
  const pack = buildAgentPack(handoff);
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = (pack.title as string)
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "change_package";
  a.download = `${slug}_agent_pack.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPackageDocumentDOCX(doc: PackageDocument) {
  const {
    Document,
    Packer,
    PageBreak,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const isPlan = doc.kind === "plan";
  const items = changeItemsOf(doc);
  const children: InstanceType<typeof Paragraph>[] = [];

  const p = (text: string, opts?: { bold?: boolean; size?: number; color?: string }) =>
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text,
          bold: opts?.bold,
          size: opts?.size || 20,
          font: "Calibri",
          color: opts?.color || "0F172A",
        }),
      ],
    });

  const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
    new Paragraph({
      heading: level,
      spacing: { before: 280, after: 140 },
      children: [new TextRun({ text, bold: true, font: "Calibri", color: "0F172A" })],
    });

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: doc.meta.documentType.toUpperCase(),
          bold: true,
          size: 18,
          font: "Calibri",
          color: "2563EB",
        }),
      ],
    }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: doc.meta.documentTitle,
          bold: true,
          size: 32,
          font: "Calibri",
          color: "0F172A",
        }),
      ],
    }),
  );
  children.push(p(doc.meta.revisionSummary, { size: 18, color: "475569" }));
  children.push(
    p(
      `${doc.meta.documentId}  ·  ${doc.meta.projectName}  ·  ${formatDate(doc.meta.exportedAt)}  ·  ${doc.meta.status}`,
      { size: 18, color: "64748B" },
    ),
  );

  children.push(h("Document control", HeadingLevel.HEADING_1));
  children.push(p(`Document ID: ${doc.meta.documentId}`));
  if (doc.meta.revisionLabel) children.push(p(`Revision: ${doc.meta.revisionLabel}`));
  children.push(p(`Release: ${doc.meta.gatesApproved}/${doc.meta.gatesTotal} checks`));

  children.push(h("Table of contents", HeadingLevel.HEADING_1));
  documentOutline(doc.kind).forEach((entry) => children.push(p(`• ${entry}`)));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  if (!isPlan) {
    children.push(h("1. Introduction and purpose", HeadingLevel.HEADING_1));
    children.push(p(doc.meta.revisionSummary));
    children.push(h("2. Existing system baseline", HeadingLevel.HEADING_1));
    if (doc.recoveredFeatures.length) {
      doc.recoveredFeatures.forEach((f, i) => children.push(p(`${i + 1}. ${f}`)));
    } else children.push(p("None recorded.", { color: "64748B" }));
    children.push(h("3. Proposed changes", HeadingLevel.HEADING_1));
    items.forEach((f, i) => children.push(p(`${i + 1}. ${f}`)));
    children.push(h("3.1 Files in scope", HeadingLevel.HEADING_2));
    if (doc.files.length) doc.files.forEach((f) => children.push(p(`• ${f}`)));
    else children.push(p("Confirm with tech lead.", { color: "64748B" }));
    children.push(h("4. Current vs target behavior", HeadingLevel.HEADING_1));
    children.push(p(`Current: ${doc.currentBehavior || "as recovered"}`));
    children.push(p(`Target: ${doc.desiredBehavior || "as proposed"}`));
    children.push(h("5. System architecture", HeadingLevel.HEADING_1));
    if (doc.mermaidAsIs) {
      children.push(h("Figure 1 — As-is system architecture", HeadingLevel.HEADING_2));
      children.push(p(doc.mermaidAsIs.slice(0, 1200), { color: "64748B" }));
    }
    if (doc.mermaidProposed) {
      children.push(h("Figure 2 — To-be system architecture", HeadingLevel.HEADING_2));
      children.push(p(doc.mermaidProposed.slice(0, 1200), { color: "64748B" }));
    }
    children.push(h("6. Approved architecture decisions", HeadingLevel.HEADING_1));
  } else {
    children.push(h("1. Purpose and authorization", HeadingLevel.HEADING_1));
    children.push(p(doc.meta.revisionSummary));
    children.push(h("2. Implementation scope", HeadingLevel.HEADING_1));
    items.forEach((f, i) => children.push(p(`${i + 1}. ${f}`)));
    children.push(h("3. Rules before coding", HeadingLevel.HEADING_1));
    doc.agentRules.forEach((r) => children.push(p(`• ${r}`)));
    children.push(h("4. Architecture decisions", HeadingLevel.HEADING_1));
  }

  if (doc.adrs.length) {
    for (const a of doc.adrs) {
      children.push(h(`${a.id} — ${a.title}`, HeadingLevel.HEADING_2));
      children.push(p(`Decision. ${a.decision || "—"}`));
      children.push(p(`Consequences. ${a.consequences || "—"}`, { color: "475569" }));
    }
  } else {
    children.push(p("None marked Go yet.", { color: "64748B" }));
  }

  children.push(
    h(isPlan ? "5. Requirements to satisfy" : "7. Functional requirements", HeadingLevel.HEADING_1),
  );
  if (doc.acceptance.length) {
    doc.acceptance.forEach((a) => children.push(p(`${a.id}. ${a.text}`)));
  } else {
    children.push(p("None marked Go yet.", { color: "64748B" }));
  }

  children.push(
    h(isPlan ? "6. Mandatory verification" : "8. Verification and definition of done", HeadingLevel.HEADING_1),
  );
  if (doc.tests.length) {
    for (const t of doc.tests) {
      children.push(h(`${t.id} — ${t.title}`, HeadingLevel.HEADING_2));
      children.push(p(`Kind: ${t.kind}`));
      children.push(p(`Steps: ${t.steps || "—"}`));
      children.push(p(`Expected: ${t.expected || "—"}`));
    }
  } else {
    children.push(p("None marked Go yet.", { color: "64748B" }));
  }

  children.push(h(isPlan ? "7. Release status" : "9. Release approval", HeadingLevel.HEADING_1));

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "E2E8F0",
  };
  const cell = (text: string, header = false) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      width: { size: 3000, type: WidthType.DXA },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: header,
              size: 18,
              font: "Calibri",
              color: header ? "FFFFFF" : "0F172A",
            }),
          ],
        }),
      ],
      shading: header ? { fill: "2563EB" } : undefined,
    });

  children.push(
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [cell("Check", true), cell("Role", true), cell("Status", true)],
        }),
        ...doc.gates.map(
          (g) =>
            new TableRow({
              children: [
                cell(g.label),
                cell(g.role),
                cell(g.approved ? "Released" : "Pending"),
              ],
            }),
        ),
      ],
    }) as unknown as InstanceType<typeof Paragraph>,
  );

  const document = new Document({
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBlob(document);
  saveAs(buffer, `${safeName(doc.meta.projectName)}_${doc.kind}.docx`);
}
