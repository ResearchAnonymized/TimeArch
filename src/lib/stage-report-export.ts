import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { recoverArtifactContent } from "./artifact-utils";

// ─── Stage metadata ─────────────────────────────────────────────────
const STAGE_LABELS: Record<number, string> = {
  1: "Requirement Collection",
  2: "Requirement Analysis",
  3: "Architecture Drivers",
  4: "Style Selection",
  5: "Tradeoff Evaluation",
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
  9: "Cross-Cutting Concerns",
  10: "Infrastructure & Deployment",
  11: "Quality Attributes",
  12: "Risk Assessment",
  13: "Architecture Validation",
  14: "Documentation & ADRs",
  15: "Stakeholder Approval",
  16: "Code Generation",
  17: "Implementation Review",
  18: "Architecture Evolution",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Requirement Definition",
  2: "Requirement Definition",
  3: "Requirement Definition",
  4: "Architecture Design",
  5: "Architecture Design",
  6: "Architecture Design",
  7: "Architecture Design",
  8: "Architecture Design",
  9: "Architecture Design",
  10: "Architecture Design",
  11: "Validation & Assurance",
  12: "Validation & Assurance",
  13: "Validation & Assurance",
  14: "Validation & Assurance",
  15: "Delivery & Evolution",
  16: "Delivery & Evolution",
  17: "Delivery & Evolution",
  18: "Delivery & Evolution",
};

function safeName(name: string) {
  return (name || "report").replace(/[^a-zA-Z0-9]/g, "_");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Fetch stage data ───────────────────────────────────────────────
interface StageData {
  artifacts: any[];
  agentRuns: any[];
  approval: any | null;
  requirements: any[];
  drivers: any[];
  qualityScores: any[];
  modernizationItems: any[];
  systemStyle: any | null;
  imports: any[];
  provenanceLinks: { artifactTitle: string; importLabels: string[] }[];
}

async function fetchStageData(projectId: string, stage: number): Promise<StageData> {
  const [
    artifactsRes,
    runsRes,
    approvalsRes,
    reqsRes,
    driversRes,
    qsRes,
    miRes,
    ssRes,
    impRes,
    allArtRes,
  ] = await Promise.all([
    supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at"),
    supabase
      .from("agent_runs")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at"),
    supabase
      .from("stage_approvals")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .eq("action", "locked")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("requirements").select("*").eq("project_id", projectId).order("created_at"),
    supabase
      .from("architecture_drivers")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase.from("quality_scores").select("*").eq("project_id", projectId),
    supabase
      .from("modernization_items")
      .select("*")
      .eq("project_id", projectId)
      .order("roi", { ascending: false }),
    supabase.from("system_style").select("*").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("project_imports")
      .select("id,source_label,kind,status")
      .eq("project_id", projectId),
    supabase
      .from("architecture_artifacts")
      .select("title,content")
      .eq("project_id", projectId)
      .eq("stage", stage),
  ]);

  const impMap = new Map<string, string>();
  (impRes.data || []).forEach((i: any) => impMap.set(i.id, i.source_label));
  const provenanceLinks: { artifactTitle: string; importLabels: string[] }[] = [];
  (allArtRes.data || []).forEach((a: any) => {
    const ids = (a.content as any)?._meta?.source_import_ids as string[] | undefined;
    if (ids && ids.length) {
      provenanceLinks.push({
        artifactTitle: a.title,
        importLabels: ids.map((id) => impMap.get(id) || id).filter(Boolean),
      });
    }
  });

  return {
    artifacts: artifactsRes.data || [],
    agentRuns: runsRes.data || [],
    approval: approvalsRes.data?.[0] || null,
    requirements: reqsRes.data || [],
    drivers: driversRes.data || [],
    qualityScores: qsRes.data || [],
    modernizationItems: miRes.data || [],
    systemStyle: ssRes.data || null,
    imports: impRes.data || [],
    provenanceLinks,
  };
}

// ─── Content extraction helpers ─────────────────────────────────────
function flattenContent(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  const recovered = recoverArtifactContent(content);
  if (!recovered) return JSON.stringify(content, null, 2);
  return formatContentObject(recovered);
}

function formatContentObject(obj: any, depth = 0): string {
  if (!obj || typeof obj !== "object") return String(obj ?? "");
  if (Array.isArray(obj)) {
    return obj
      .map((item, i) => {
        if (typeof item === "string") return `${" ".repeat(depth)}- ${item}`;
        if (typeof item === "object") return formatContentObject(item, depth + 1);
        return `${" ".repeat(depth)}- ${item}`;
      })
      .join("\n");
  }
  return Object.entries(obj)
    .map(([key, val]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        return `**${label}:** ${val}`;
      }
      if (Array.isArray(val) && val.every((v) => typeof v === "string")) {
        return `**${label}:**\n${val.map((v) => `  - ${v}`).join("\n")}`;
      }
      return `**${label}:**\n${formatContentObject(val, depth + 1)}`;
    })
    .join("\n\n");
}

// ─── Markdown Export ────────────────────────────────────────────────
export async function exportStageAsMarkdown(projectId: string, projectName: string, stage: number) {
  const data = await fetchStageData(projectId, stage);
  const stageLabel = STAGE_LABELS[stage] || `Stage ${stage}`;
  const phase = PHASE_LABELS[stage] || "Unknown Phase";

  let md = `# ${projectName} — Stage ${stage}: ${stageLabel}\n\n`;
  md += `**Phase:** ${phase}  \n`;
  md += `**Generated:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  \n`;
  md += `**Status:** ${data.approval ? "🔒 Locked" : "🔓 Unlocked"}\n\n`;
  md += `---\n\n`;

  // Stage-specific context
  if (stage <= 3 && data.requirements.length > 0) {
    md += `## Requirements (${data.requirements.length})\n\n`;
    for (const req of data.requirements) {
      md += `### ${req.requirement_id}: ${req.title}\n`;
      md += `- **Type:** ${req.type} | **Priority:** ${req.priority} | **Status:** ${req.status}\n`;
      if (req.description) md += `- **Description:** ${req.description}\n`;
      md += `\n`;
    }
  }

  if (stage >= 3 && data.drivers.length > 0) {
    md += `## Architecture Drivers (${data.drivers.length})\n\n`;
    for (const drv of data.drivers) {
      md += `- **${drv.label}** (${drv.priority}): ${drv.description || "No description"}\n`;
    }
    md += `\n`;
  }

  // Brownfield: architectural style verdict (Stage 5)
  if (stage === 5 && data.systemStyle) {
    const s = data.systemStyle;
    md += `## Architectural Style Verdict\n\n`;
    md += `- **Primary:** ${s.primary_style || "—"} (confidence ${((s.confidence ?? 0) * 100).toFixed(0)}%)\n`;
    if (s.secondary_style) md += `- **Secondary:** ${s.secondary_style}\n`;
    if (Array.isArray(s.evidence) && s.evidence.length)
      md += `- **Evidence:** ${s.evidence.join("; ")}\n`;
    if (Array.isArray(s.driver_fit) && s.driver_fit.length)
      md += `- **Driver fit:** ${s.driver_fit.map((d: any) => `${d.driver || d.label} → ${d.fit || d.verdict || "?"}`).join(", ")}\n`;
    md += `\n`;
  }

  // Brownfield: ISO 25010 scorecard (Stage 11)
  if (stage === 11 && data.qualityScores.length > 0) {
    md += `## ISO 25010 Quality Scorecard\n\n`;
    md += `| Characteristic | As-Is | Target | Gap | Rationale |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const q of data.qualityScores) {
      md += `| ${q.characteristic} | ${q.as_is_score ?? "—"} | ${q.target_score ?? "—"} | ${q.gap ?? "—"} | ${(q.rationale || "").replace(/\|/g, "\\|")} |\n`;
    }
    md += `\n`;
  }

  // Brownfield: 7R Modernization roadmap (Stage 16)
  if (stage === 16 && data.modernizationItems.length > 0) {
    md += `## 7R Modernization Roadmap\n\n`;
    md += `| Component | Action | Effort | Impact | ROI | Rationale |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const m of data.modernizationItems) {
      md += `| ${m.component || "—"} | ${m.action} | ${m.effort} | ${m.impact} | ${m.roi ?? "—"} | ${(m.rationale || "").replace(/\|/g, "\\|")} |\n`;
    }
    md += `\n`;
  }

  // Brownfield: evidence-graph snapshot
  if (data.provenanceLinks.length > 0) {
    md += `## Evidence Graph (this stage)\n\n`;
    for (const p of data.provenanceLinks) {
      md += `- **${p.artifactTitle}** ← ${p.importLabels.join(", ")}\n`;
    }
    md += `\n`;
  }

  if (data.artifacts.length > 0) {
    md += `## Artifacts\n\n`;
    for (const artifact of data.artifacts) {
      md += `### ${artifact.title}\n`;
      md += `**Type:** ${artifact.type} | **Status:** ${artifact.status} | **Version:** ${artifact.version}\n\n`;
      md += flattenContent(artifact.content);
      md += `\n\n---\n\n`;
    }
  }

  // Agent runs
  if (data.agentRuns.length > 0) {
    md += `## Agent Execution History\n\n`;
    md += `| Agent | Status | Started | Completed |\n`;
    md += `|-------|--------|---------|----------|\n`;
    for (const run of data.agentRuns) {
      md += `| ${run.agent_name} | ${run.status} | ${run.started_at ? new Date(run.started_at).toLocaleString() : "—"} | ${run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"} |\n`;
    }
    md += `\n`;
  }

  // Approval
  if (data.approval) {
    md += `## Governance\n\n`;
    md += `- **Locked at:** ${new Date(data.approval.created_at).toLocaleString()}\n`;
    if (data.approval.comment) md += `- **Comment:** ${data.approval.comment}\n`;
    md += `\n`;
  }

  downloadBlob(
    new Blob([md], { type: "text/markdown" }),
    `${safeName(projectName)}_Stage${stage}_${safeName(stageLabel)}.md`,
  );
  toast.success(`Stage ${stage} report exported as Markdown`);
}

// ─── PDF Export ─────────────────────────────────────────────────────
export async function exportStageAsPDF(projectId: string, projectName: string, stage: number) {
  const data = await fetchStageData(projectId, stage);
  const stageLabel = STAGE_LABELS[stage] || `Stage ${stage}`;
  const phase = PHASE_LABELS[stage] || "Unknown Phase";

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const COLORS = {
    primary: [37, 99, 235] as [number, number, number],
    dark: [30, 41, 59] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    light: [241, 245, 249] as [number, number, number],
    accent: [219, 234, 254] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
  };

  function checkPage(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function addText(
    text: string,
    fontSize: number,
    color: [number, number, number],
    bold = false,
    maxWidth = contentWidth,
  ) {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      checkPage(fontSize * 0.35 * 1.4 + 1);
      doc.text(line, margin, y);
      y += fontSize * 0.35 * 1.4;
    }
  }

  // ── Cover ──
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 55, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`Stage ${stage}: ${stageLabel}`, margin, 22);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(projectName || "Architecture Project", margin, 32);
  doc.setFontSize(9);
  doc.text(
    `${phase} · Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    42,
  );

  // Status badge
  const statusText = data.approval ? "LOCKED" : "IN PROGRESS";
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - margin - statusWidth - 2, 18, statusWidth + 4, 8, 2, 2, "F");
  doc.setTextColor(...(data.approval ? COLORS.success : COLORS.primary));
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth - margin - statusWidth + 1, 23.5);

  y = 65;

  // ── Requirements (stages 1-3) ──
  if (stage <= 3 && data.requirements.length > 0) {
    checkPage(14);
    addText("Requirements", 14, COLORS.dark, true);
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 35, y);
    y += 6;

    const reqRows = data.requirements.map((r) => [
      r.requirement_id,
      r.title,
      r.type,
      r.priority,
      r.status,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["ID", "Title", "Type", "Priority", "Status"]],
      body: reqRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: {
        0: { cellWidth: 20 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Drivers (stage 3+) ──
  if (stage >= 3 && data.drivers.length > 0) {
    checkPage(14);
    addText("Architecture Drivers", 14, COLORS.dark, true);
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 40, y);
    y += 6;

    const drvRows = data.drivers.map((d) => [
      d.label,
      d.priority,
      d.category || "—",
      d.description || "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Label", "Priority", "Category", "Description"]],
      body: drvRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Brownfield: Style verdict (stage 5) ──
  if (stage === 5 && data.systemStyle) {
    const s = data.systemStyle;
    checkPage(30);
    addText("Architectural Style Verdict", 14, COLORS.dark, true);
    y += 4;
    addText(
      `Primary: ${s.primary_style || "—"}  (confidence ${((s.confidence ?? 0) * 100).toFixed(0)}%)`,
      9,
      COLORS.dark,
      true,
    );
    if (s.secondary_style) addText(`Secondary: ${s.secondary_style}`, 8, COLORS.muted);
    if (Array.isArray(s.evidence) && s.evidence.length)
      addText(`Evidence: ${s.evidence.join("; ")}`, 8, COLORS.muted);
    y += 6;
  }

  // ── Brownfield: ISO 25010 scorecard (stage 11) ──
  if (stage === 11 && data.qualityScores.length > 0) {
    checkPage(14);
    addText("ISO 25010 Quality Scorecard", 14, COLORS.dark, true);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Characteristic", "As-Is", "Target", "Gap", "Rationale"]],
      body: data.qualityScores.map((q: any) => [
        q.characteristic,
        q.as_is_score ?? "—",
        q.target_score ?? "—",
        q.gap ?? "—",
        q.rationale || "",
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Brownfield: 7R Modernization roadmap (stage 16) ──
  if (stage === 16 && data.modernizationItems.length > 0) {
    checkPage(14);
    addText("7R Modernization Roadmap", 14, COLORS.dark, true);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Component", "Action", "Effort", "Impact", "ROI", "Rationale"]],
      body: data.modernizationItems.map((m: any) => [
        m.component || "—",
        m.action,
        m.effort,
        m.impact,
        m.roi ?? "—",
        m.rationale || "",
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Brownfield: Evidence graph ──
  if (data.provenanceLinks.length > 0) {
    checkPage(14);
    addText("Evidence Graph (this stage)", 14, COLORS.dark, true);
    y += 4;
    for (const p of data.provenanceLinks) {
      addText(`• ${p.artifactTitle}  ←  ${p.importLabels.join(", ")}`, 8, COLORS.muted);
    }
    y += 6;
  }

  // ── Artifacts ──
  if (data.artifacts.length > 0) {
    checkPage(14);
    addText("Artifacts", 14, COLORS.dark, true);
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 25, y);
    y += 6;

    for (const artifact of data.artifacts) {
      checkPage(20);
      // Artifact header
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(margin, y, contentWidth, 9, 1, 1, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text(artifact.title, margin + 3, y + 6);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `${artifact.type} · v${artifact.version} · ${artifact.status}`,
        pageWidth - margin - 3,
        y + 6,
        { align: "right" },
      );
      y += 13;

      // Content
      const contentText = flattenContent(artifact.content);
      if (contentText) {
        // Strip markdown bold markers for PDF
        const cleanText = contentText.replace(/\*\*/g, "");
        addText(cleanText, 8, COLORS.muted);
        y += 6;
      }

      // Separator
      checkPage(4);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }
  }

  // ── Agent Runs ──
  if (data.agentRuns.length > 0) {
    checkPage(14);
    addText("Agent Execution History", 14, COLORS.dark, true);
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 45, y);
    y += 6;

    const runRows = data.agentRuns.map((r) => [
      r.agent_name,
      r.status,
      r.started_at ? new Date(r.started_at).toLocaleString() : "—",
      r.completed_at ? new Date(r.completed_at).toLocaleString() : "—",
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Agent", "Status", "Started", "Completed"]],
      body: runRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Governance ──
  if (data.approval) {
    checkPage(20);
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "F");
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.success);
    doc.text("✓ STAGE LOCKED", margin + 5, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(8);
    doc.text(`Locked at: ${new Date(data.approval.created_at).toLocaleString()}`, margin + 5, y);
    y += 10;
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${projectName} — Stage ${stage}: ${stageLabel}`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  doc.save(`${safeName(projectName)}_Stage${stage}_${safeName(stageLabel)}.pdf`);
  toast.success(`Stage ${stage} report exported as PDF`);
}

// ─── DOCX Export ────────────────────────────────────────────────────
export async function exportStageAsDOCX(projectId: string, projectName: string, stage: number) {
  const data = await fetchStageData(projectId, stage);
  const stageLabel = STAGE_LABELS[stage] || `Stage ${stage}`;
  const phase = PHASE_LABELS[stage] || "Unknown Phase";

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    WidthType,
    ShadingType,
    Header,
    Footer,
    PageNumber,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const BRAND = "2563EB";
  const DARK = "1E293B";
  const MUTED = "64748B";
  const LIGHT = "F1F5F9";
  const ACCENT = "DBEAFE";
  const SUCCESS = "16A34A";

  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Stage ${stage}: ${stageLabel}`,
          bold: true,
          size: 44,
          font: "Arial",
          color: BRAND,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: projectName || "Architecture Project",
          size: 24,
          font: "Arial",
          color: DARK,
        }),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${phase} · `, size: 18, font: "Arial", color: MUTED }),
        new TextRun({
          text: data.approval ? "🔒 Locked" : "In Progress",
          size: 18,
          font: "Arial",
          color: data.approval ? SUCCESS : MUTED,
        }),
        new TextRun({
          text: ` · Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          size: 18,
          font: "Arial",
          color: MUTED,
        }),
      ],
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND, space: 8 } },
    }),
  );

  // Requirements (stages 1-3)
  if (stage <= 3 && data.requirements.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({ text: "Requirements", bold: true, size: 28, font: "Arial", color: DARK }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    const headerCells = ["ID", "Title", "Type", "Priority", "Status"].map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 16, font: "Arial", color: "FFFFFF" }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          borders: cellBorders,
          width: { size: h === "ID" ? 1200 : h === "Title" ? 3960 : 1400, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
    );

    const rows = data.requirements.map(
      (r) =>
        new TableRow({
          children: [r.requirement_id, r.title, r.type, r.priority, r.status].map(
            (val, i) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(val || ""),
                        size: 16,
                        font: "Arial",
                        color: DARK,
                      }),
                    ],
                  }),
                ],
                borders: cellBorders,
                width: { size: i === 0 ? 1200 : i === 1 ? 3960 : 1400, type: WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
              }),
          ),
        }),
    );

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1200, 3960, 1400, 1400, 1400],
        rows: [new TableRow({ children: headerCells }), ...rows],
      }),
    );
    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // Drivers (stage 3+)
  if (stage >= 3 && data.drivers.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Architecture Drivers",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    for (const drv of data.drivers) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${drv.label}`,
              bold: true,
              size: 20,
              font: "Arial",
              color: BRAND,
            }),
            new TextRun({ text: ` (${drv.priority})`, size: 18, font: "Arial", color: MUTED }),
          ],
          spacing: { after: 60 },
        }),
      );
      if (drv.description) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: drv.description, size: 18, font: "Arial", color: MUTED }),
            ],
            spacing: { after: 120 },
          }),
        );
      }
    }
  }

  // ── Brownfield: Style verdict (stage 5) ──
  if (stage === 5 && data.systemStyle) {
    const s = data.systemStyle;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Architectural Style Verdict",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 160 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Primary: ${s.primary_style || "—"} (confidence ${((s.confidence ?? 0) * 100).toFixed(0)}%)`,
            bold: true,
            size: 20,
            font: "Arial",
            color: BRAND,
          }),
        ],
        spacing: { after: 80 },
      }),
    );
    if (s.secondary_style)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Secondary: ${s.secondary_style}`,
              size: 18,
              font: "Arial",
              color: MUTED,
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    if (Array.isArray(s.evidence) && s.evidence.length)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Evidence: ${s.evidence.join("; ")}`,
              size: 18,
              font: "Arial",
              color: MUTED,
            }),
          ],
          spacing: { after: 200 },
        }),
      );
  }

  // ── Brownfield: ISO 25010 scorecard (stage 11) ──
  if (stage === 11 && data.qualityScores.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "ISO 25010 Quality Scorecard",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 160 },
      }),
    );
    const headers = ["Characteristic", "As-Is", "Target", "Gap", "Rationale"].map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 16, font: "Arial", color: "FFFFFF" }),
              ],
            }),
          ],
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          borders: cellBorders,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
    );
    const rows = data.qualityScores.map(
      (q: any) =>
        new TableRow({
          children: [
            q.characteristic,
            String(q.as_is_score ?? "—"),
            String(q.target_score ?? "—"),
            String(q.gap ?? "—"),
            q.rationale || "",
          ].map(
            (v) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: String(v), size: 16, font: "Arial", color: DARK }),
                    ],
                  }),
                ],
                borders: cellBorders,
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
              }),
          ),
        }),
    );
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [new TableRow({ children: headers }), ...rows],
      }),
      new Paragraph({ spacing: { after: 300 } }),
    );
  }

  // ── Brownfield: 7R Modernization roadmap (stage 16) ──
  if (stage === 16 && data.modernizationItems.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "7R Modernization Roadmap",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 160 },
      }),
    );
    const headers = ["Component", "Action", "Effort", "Impact", "ROI", "Rationale"].map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 16, font: "Arial", color: "FFFFFF" }),
              ],
            }),
          ],
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          borders: cellBorders,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
    );
    const rows = data.modernizationItems.map(
      (m: any) =>
        new TableRow({
          children: [
            m.component || "—",
            m.action,
            m.effort,
            m.impact,
            String(m.roi ?? "—"),
            m.rationale || "",
          ].map(
            (v) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: String(v), size: 16, font: "Arial", color: DARK }),
                    ],
                  }),
                ],
                borders: cellBorders,
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
              }),
          ),
        }),
    );
    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        rows: [new TableRow({ children: headers }), ...rows],
      }),
      new Paragraph({ spacing: { after: 300 } }),
    );
  }

  // ── Brownfield: Evidence graph ──
  if (data.provenanceLinks.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Evidence Graph (this stage)",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 160 },
      }),
    );
    for (const p of data.provenanceLinks) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• ${p.artifactTitle}`, bold: true, size: 18, font: "Arial", color: DARK }),
            new TextRun({
              text: `  ←  ${p.importLabels.join(", ")}`,
              size: 18,
              font: "Arial",
              color: MUTED,
            }),
          ],
          spacing: { after: 60 },
        }),
      );
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Artifacts
  if (data.artifacts.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({ text: "Artifacts", bold: true, size: 28, font: "Arial", color: DARK }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    for (const artifact of data.artifacts) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: artifact.title, bold: true, size: 22, font: "Arial", color: DARK }),
          ],
          spacing: { before: 160, after: 60 },
          shading: { fill: LIGHT, type: ShadingType.CLEAR },
        }),
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${artifact.type} · v${artifact.version} · ${artifact.status}`,
              size: 16,
              font: "Arial",
              color: MUTED,
              italics: true,
            }),
          ],
          spacing: { after: 120 },
        }),
      );

      const contentText = flattenContent(artifact.content);
      if (contentText) {
        // Split by paragraph breaks and render
        const paragraphs = contentText.split(/\n\n+/).filter(Boolean);
        for (const para of paragraphs) {
          const runs: any[] = [];
          // Parse bold markers
          const parts = para.split(/\*\*(.*?)\*\*/g);
          parts.forEach((part, i) => {
            if (i % 2 === 1) {
              runs.push(
                new TextRun({ text: part, bold: true, size: 18, font: "Arial", color: DARK }),
              );
            } else if (part) {
              // Handle line breaks within paragraphs
              const lines = part.split("\n");
              lines.forEach((line, li) => {
                if (li > 0) runs.push(new TextRun({ text: "", break: 1 }));
                if (line.trim())
                  runs.push(new TextRun({ text: line, size: 18, font: "Arial", color: MUTED }));
              });
            }
          });
          if (runs.length > 0) {
            children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
          }
        }
      }

      // Separator
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0", space: 4 } },
        }),
      );
    }
  }

  // Agent runs table
  if (data.agentRuns.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Agent Execution History",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    const runHeaders = ["Agent", "Status", "Started", "Completed"].map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 16, font: "Arial", color: "FFFFFF" }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          borders: cellBorders,
          width: { size: 2340, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
    );

    const runRows = data.agentRuns.map(
      (r) =>
        new TableRow({
          children: [
            r.agent_name,
            r.status,
            r.started_at ? new Date(r.started_at).toLocaleString() : "—",
            r.completed_at ? new Date(r.completed_at).toLocaleString() : "—",
          ].map(
            (val) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: val, size: 16, font: "Arial", color: DARK })],
                  }),
                ],
                borders: cellBorders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
              }),
          ),
        }),
    );

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 2340, 2340, 2340],
        rows: [new TableRow({ children: runHeaders }), ...runRows],
      }),
    );
  }

  // Governance
  if (data.approval) {
    children.push(new Paragraph({ spacing: { before: 300 } }));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "✓ Stage Locked",
            bold: true,
            size: 22,
            font: "Arial",
            color: SUCCESS,
          }),
        ],
        shading: { fill: ACCENT, type: ShadingType.CLEAR },
        spacing: { after: 60 },
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Locked at: ${new Date(data.approval.created_at).toLocaleString()}`,
            size: 18,
            font: "Arial",
            color: MUTED,
          }),
        ],
        shading: { fill: ACCENT, type: ShadingType.CLEAR },
        spacing: { after: 200 },
      }),
    );
  }

  const docx = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${projectName} — Stage ${stage}: ${stageLabel}`,
                    size: 14,
                    font: "Arial",
                    color: MUTED,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${phase} · `, size: 14, font: "Arial", color: MUTED }),
                  new TextRun({ text: "Page ", size: 14, font: "Arial", color: MUTED }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    font: "Arial",
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBlob(docx);
  saveAs(buffer, `${safeName(projectName)}_Stage${stage}_${safeName(stageLabel)}.docx`);
  toast.success(`Stage ${stage} report exported as DOCX`);
}
