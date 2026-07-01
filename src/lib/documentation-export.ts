import { toast } from "sonner";

// ─── Shared helpers ─────────────────────────────────────────────────
function safeName(name: string) {
  return (name || "documentation").replace(/[^a-zA-Z0-9]/g, "_");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatAdrAlternative(alt: any): string {
  return typeof alt === "string" ? alt : `${alt.name}: ${alt.reason || ""}`;
}

// ─── JSON ───────────────────────────────────────────────────────────
export function exportAsJSON(content: any, projectName: string) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(projectName)}_documentation.json`);
  toast.success("Documentation exported as JSON");
}

// ─── Markdown ───────────────────────────────────────────────────────
export function exportAsMarkdown(content: any, projectName: string) {
  let md = `# ${projectName || "Architecture"} — Documentation & ADRs\n\n`;

  if (content.executive_summary) md += `## Executive Summary\n\n${content.executive_summary}\n\n`;
  if (content.architecture_overview)
    md += `## Architecture Overview\n\n${content.architecture_overview}\n\n`;

  const adrs = content.adrs || [];
  if (adrs.length > 0) {
    md += `## Architecture Decision Records\n\n`;
    for (const adr of adrs) {
      md += `### ${adr.id}: ${adr.title}\n\n`;
      md += `**Status:** ${adr.status}\n\n`;
      if (adr.context) md += `**Context:** ${adr.context}\n\n`;
      if (adr.decision) md += `**Decision:** ${adr.decision}\n\n`;
      if (adr.rationale) md += `**Rationale:** ${adr.rationale}\n\n`;
      if (adr.alternatives_considered?.length > 0) {
        md += `**Alternatives Considered:**\n`;
        for (const alt of adr.alternatives_considered) md += `- ${formatAdrAlternative(alt)}\n`;
        md += `\n`;
      }
      if (adr.consequences?.positive?.length) {
        md += `**Positive Consequences:**\n`;
        adr.consequences.positive.forEach((p: string) => {
          md += `- ${p}\n`;
        });
        md += `\n`;
      }
      if (adr.consequences?.negative?.length) {
        md += `**Negative Consequences:**\n`;
        adr.consequences.negative.forEach((n: string) => {
          md += `- ${n}\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    }
  }

  const handoffNotes = content.handoff_notes || [];
  if (handoffNotes.length > 0) {
    md += `## Handoff Notes\n\n`;
    handoffNotes.forEach((n: string) => {
      md += `- ${n}\n`;
    });
  }

  downloadBlob(
    new Blob([md], { type: "text/markdown" }),
    `${safeName(projectName)}_documentation.md`,
  );
  toast.success("Documentation exported as Markdown");
}

// ─── PDF ────────────────────────────────────────────────────────────
export async function exportAsPDF(content: any, projectName: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const COLORS = {
    primary: [37, 99, 235] as [number, number, number], // blue-600
    dark: [30, 41, 59] as [number, number, number], // slate-800
    muted: [100, 116, 139] as [number, number, number], // slate-500
    light: [241, 245, 249] as [number, number, number], // slate-100
    accent: [219, 234, 254] as [number, number, number], // blue-100
    positive: [22, 163, 74] as [number, number, number], // green-600
    negative: [220, 38, 38] as [number, number, number], // red-600
  };

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function addWrappedText(
    text: string,
    fontSize: number,
    color: [number, number, number],
    maxWidth: number,
    lineHeight = 1.4,
  ) {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      checkPage(fontSize * 0.35 * lineHeight + 1);
      doc.text(line, margin, y);
      y += fontSize * 0.35 * lineHeight;
    }
  }

  // ── Cover / Title ──
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(projectName || "Architecture Documentation", margin, 28);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Documentation & Architecture Decision Records", margin, 38);
  doc.setFontSize(8);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    pageWidth - margin - 50,
    38,
  );
  y = 60;

  // ── Executive Summary ──
  if (content.executive_summary) {
    doc.setFillColor(...COLORS.accent);
    const summaryLines = doc.splitTextToSize(content.executive_summary, contentWidth - 10);
    const blockHeight = summaryLines.length * 5 + 16;
    checkPage(blockHeight);
    doc.roundedRect(margin, y, contentWidth, blockHeight, 2, 2, "F");
    y += 8;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE SUMMARY", margin + 5, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.dark);
    doc.setFont("helvetica", "normal");
    for (const line of summaryLines) {
      doc.text(line, margin + 5, y);
      y += 5;
    }
    y += 8;
  }

  // ── Architecture Overview ──
  if (content.architecture_overview) {
    checkPage(12);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Architecture Overview", margin, y);
    y += 3;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 40, y);
    y += 6;
    addWrappedText(content.architecture_overview, 9, COLORS.muted, contentWidth);
    y += 8;
  }

  // ── ADRs ──
  const adrs = content.adrs || [];
  if (adrs.length > 0) {
    checkPage(14);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Architecture Decision Records", margin, y);
    y += 3;
    doc.setDrawColor(...COLORS.primary);
    doc.line(margin, y, margin + 50, y);
    y += 8;

    // ADR summary table
    const tableBody = adrs.map((adr: any) => [
      adr.id || "",
      adr.title || "",
      (adr.status || "").toUpperCase(),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["ID", "Title", "Status"]],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3, textColor: COLORS.dark },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: COLORS.light },
      columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 22, halign: "center" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Individual ADRs
    for (const adr of adrs) {
      checkPage(40);
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.primary);
      doc.text(`${adr.id}`, margin + 3, y + 5.5);
      doc.setTextColor(...COLORS.dark);
      doc.text(adr.title || "", margin + 22, y + 5.5);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text((adr.status || "").toUpperCase(), pageWidth - margin - 3, y + 5.5, {
        align: "right",
      });
      y += 12;

      if (adr.context) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.dark);
        doc.text("Context", margin, y);
        y += 4;
        addWrappedText(adr.context, 8, COLORS.muted, contentWidth);
        y += 4;
      }

      if (adr.decision) {
        checkPage(12);
        doc.setFillColor(219, 234, 254);
        const decLines = doc.splitTextToSize(adr.decision, contentWidth - 10);
        const decH = decLines.length * 4 + 10;
        doc.roundedRect(margin, y, contentWidth, decH, 1, 1, "F");
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.primary);
        doc.text("Decision", margin + 4, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.dark);
        for (const line of decLines) {
          doc.text(line, margin + 4, y);
          y += 4;
        }
        y += 4;
      }

      if (adr.rationale) {
        checkPage(10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.dark);
        doc.text("Rationale", margin, y);
        y += 4;
        addWrappedText(adr.rationale, 8, COLORS.muted, contentWidth);
        y += 4;
      }

      if (adr.alternatives_considered?.length > 0) {
        checkPage(10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.dark);
        doc.text("Alternatives Considered", margin, y);
        y += 4;
        for (const alt of adr.alternatives_considered) {
          checkPage(6);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...COLORS.muted);
          doc.text(`•  ${formatAdrAlternative(alt)}`, margin + 3, y);
          y += 4;
        }
        y += 2;
      }

      if (adr.consequences?.positive?.length || adr.consequences?.negative?.length) {
        checkPage(10);
        const halfWidth = (contentWidth - 4) / 2;
        if (adr.consequences.positive?.length) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.positive);
          doc.text("POSITIVE", margin, y);
          let py = y + 4;
          for (const p of adr.consequences.positive) {
            checkPage(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            const pLines = doc.splitTextToSize(`+ ${p}`, halfWidth);
            for (const pl of pLines) {
              doc.text(pl, margin + 2, py);
              py += 3.5;
            }
          }
        }
        if (adr.consequences.negative?.length) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.negative);
          doc.text("NEGATIVE", margin + halfWidth + 4, y);
          let ny = y + 4;
          for (const n of adr.consequences.negative) {
            checkPage(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.muted);
            const nLines = doc.splitTextToSize(`− ${n}`, halfWidth);
            for (const nl of nLines) {
              doc.text(nl, margin + halfWidth + 6, ny);
              ny += 3.5;
            }
          }
        }
        y +=
          Math.max(
            (adr.consequences.positive?.length || 0) * 5,
            (adr.consequences.negative?.length || 0) * 5,
          ) + 6;
      }

      // separator
      checkPage(4);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    }
  }

  // ── Handoff Notes ──
  const handoffNotes = content.handoff_notes || [];
  if (handoffNotes.length > 0) {
    checkPage(14);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Handoff Notes", margin, y);
    y += 3;
    doc.setDrawColor(...COLORS.positive);
    doc.line(margin, y, margin + 30, y);
    y += 6;
    for (const note of handoffNotes) {
      checkPage(8);
      addWrappedText(`→  ${note}`, 8, COLORS.muted, contentWidth - 6);
      y += 3;
    }
  }

  // ── Review Notes ──
  const reviewNotes = content.review_notes || [];
  if (reviewNotes.length > 0) {
    checkPage(14);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Review Notes", margin, y);
    y += 3;
    doc.setDrawColor(...COLORS.primary);
    doc.line(margin, y, margin + 30, y);
    y += 6;
    for (const note of reviewNotes) {
      checkPage(8);
      addWrappedText(`•  ${note}`, 8, COLORS.muted, contentWidth - 6);
      y += 3;
    }
  }

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `${projectName || "Architecture"} — Documentation & ADRs`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  doc.save(`${safeName(projectName)}_documentation.pdf`);
  toast.success("Documentation exported as PDF");
}

// ─── DOCX ───────────────────────────────────────────────────────────
export async function exportAsDOCX(content: any, projectName: string) {
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
    LevelFormat,
  } = await import("docx");
  const { saveAs } = await import("file-saver");

  const BRAND_COLOR = "2563EB";
  const DARK_COLOR = "1E293B";
  const MUTED_COLOR = "64748B";
  const LIGHT_BG = "F1F5F9";
  const ACCENT_BG = "DBEAFE";

  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const children: any[] = [];

  // ── Title ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: projectName || "Architecture Documentation",
          bold: true,
          size: 48,
          font: "Arial",
          color: BRAND_COLOR,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Documentation & Architecture Decision Records",
          size: 22,
          font: "Arial",
          color: MUTED_COLOR,
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          size: 18,
          font: "Arial",
          color: MUTED_COLOR,
        }),
      ],
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR, space: 8 } },
    }),
  );

  // ── Executive Summary ──
  if (content.executive_summary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "EXECUTIVE SUMMARY",
            bold: true,
            size: 16,
            font: "Arial",
            color: BRAND_COLOR,
          }),
        ],
        spacing: { before: 200, after: 100 },
        shading: { fill: ACCENT_BG, type: ShadingType.CLEAR },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: content.executive_summary,
            size: 20,
            font: "Arial",
            color: DARK_COLOR,
          }),
        ],
        spacing: { after: 300 },
        shading: { fill: ACCENT_BG, type: ShadingType.CLEAR },
      }),
    );
  }

  // ── Architecture Overview ──
  if (content.architecture_overview) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Architecture Overview",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK_COLOR,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: content.architecture_overview,
            size: 20,
            font: "Arial",
            color: MUTED_COLOR,
          }),
        ],
        spacing: { after: 300 },
      }),
    );
  }

  // ── ADRs ──
  const adrs = content.adrs || [];
  if (adrs.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Architecture Decision Records",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK_COLOR,
          }),
        ],
        spacing: { before: 200, after: 200 },
      }),
    );

    // Summary table
    const headerCells = ["ID", "Title", "Status"].map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 18, font: "Arial", color: "FFFFFF" }),
              ],
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: { fill: BRAND_COLOR, type: ShadingType.CLEAR },
          borders: cellBorders,
          width: { size: h === "ID" ? 1400 : h === "Status" ? 1400 : 6560, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
        }),
    );

    const dataRows = adrs.map(
      (adr: any) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: adr.id || "",
                      size: 18,
                      font: "Arial",
                      color: BRAND_COLOR,
                      bold: true,
                    }),
                  ],
                }),
              ],
              borders: cellBorders,
              width: { size: 1400, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: adr.title || "",
                      size: 18,
                      font: "Arial",
                      color: DARK_COLOR,
                    }),
                  ],
                }),
              ],
              borders: cellBorders,
              width: { size: 6560, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: (adr.status || "").toUpperCase(),
                      size: 16,
                      font: "Arial",
                      color: MUTED_COLOR,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              borders: cellBorders,
              width: { size: 1400, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
            }),
          ],
        }),
    );

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1400, 6560, 1400],
        rows: [new TableRow({ children: headerCells }), ...dataRows],
      }),
      new Paragraph({ spacing: { after: 300 }, children: [] }),
    );

    // Individual ADR details
    for (const adr of adrs) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: `${adr.id}: `,
              bold: true,
              size: 24,
              font: "Arial",
              color: BRAND_COLOR,
            }),
            new TextRun({
              text: adr.title || "",
              bold: true,
              size: 24,
              font: "Arial",
              color: DARK_COLOR,
            }),
          ],
          spacing: { before: 300, after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0", space: 4 } },
        }),
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Status: ",
              bold: true,
              size: 18,
              font: "Arial",
              color: MUTED_COLOR,
            }),
            new TextRun({
              text: (adr.status || "").toUpperCase(),
              bold: true,
              size: 18,
              font: "Arial",
              color: BRAND_COLOR,
            }),
          ],
          spacing: { after: 120 },
        }),
      );

      if (adr.context) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Context",
                bold: true,
                size: 20,
                font: "Arial",
                color: DARK_COLOR,
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: adr.context, size: 20, font: "Arial", color: MUTED_COLOR }),
            ],
            spacing: { after: 120 },
          }),
        );
      }

      if (adr.decision) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Decision",
                bold: true,
                size: 20,
                font: "Arial",
                color: BRAND_COLOR,
              }),
            ],
            spacing: { before: 120, after: 60 },
            shading: { fill: ACCENT_BG, type: ShadingType.CLEAR },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: adr.decision, size: 20, font: "Arial", color: DARK_COLOR }),
            ],
            spacing: { after: 120 },
            shading: { fill: ACCENT_BG, type: ShadingType.CLEAR },
          }),
        );
      }

      if (adr.rationale) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Rationale",
                bold: true,
                size: 20,
                font: "Arial",
                color: DARK_COLOR,
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: adr.rationale, size: 20, font: "Arial", color: MUTED_COLOR }),
            ],
            spacing: { after: 120 },
          }),
        );
      }

      if (adr.alternatives_considered?.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Alternatives Considered",
                bold: true,
                size: 20,
                font: "Arial",
                color: DARK_COLOR,
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
        );
        for (const alt of adr.alternatives_considered) {
          children.push(
            new Paragraph({
              numbering: { reference: "bullets", level: 0 },
              children: [
                new TextRun({
                  text: formatAdrAlternative(alt),
                  size: 20,
                  font: "Arial",
                  color: MUTED_COLOR,
                }),
              ],
            }),
          );
        }
      }

      if (adr.consequences?.positive?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Positive Consequences",
                bold: true,
                size: 18,
                font: "Arial",
                color: "16A34A",
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
        );
        for (const p of adr.consequences.positive) {
          children.push(
            new Paragraph({
              numbering: { reference: "bullets", level: 0 },
              children: [new TextRun({ text: p, size: 20, font: "Arial", color: MUTED_COLOR })],
            }),
          );
        }
      }

      if (adr.consequences?.negative?.length) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Negative Consequences",
                bold: true,
                size: 18,
                font: "Arial",
                color: "DC2626",
              }),
            ],
            spacing: { before: 120, after: 60 },
          }),
        );
        for (const n of adr.consequences.negative) {
          children.push(
            new Paragraph({
              numbering: { reference: "bullets", level: 0 },
              children: [new TextRun({ text: n, size: 20, font: "Arial", color: MUTED_COLOR })],
            }),
          );
        }
      }
    }
  }

  // ── Handoff Notes ──
  const handoffNotes = content.handoff_notes || [];
  if (handoffNotes.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Handoff Notes",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK_COLOR,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
    );
    for (const note of handoffNotes) {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun({ text: note, size: 20, font: "Arial", color: MUTED_COLOR })],
        }),
      );
    }
  }

  // ── Review Notes ──
  const reviewNotes = content.review_notes || [];
  if (reviewNotes.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: "Review Notes",
            bold: true,
            size: 28,
            font: "Arial",
            color: DARK_COLOR,
          }),
        ],
        spacing: { before: 300, after: 200 },
      }),
    );
    for (const note of reviewNotes) {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          children: [new TextRun({ text: note, size: 20, font: "Arial", color: MUTED_COLOR })],
        }),
      );
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: DARK_COLOR },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: DARK_COLOR },
          paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 },
        },
      ],
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
                    text: `${projectName || "Architecture"} — Documentation & ADRs`,
                    size: 14,
                    font: "Arial",
                    color: MUTED_COLOR,
                  }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_COLOR, space: 4 },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page ", size: 14, font: "Arial", color: MUTED_COLOR }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    font: "Arial",
                    color: MUTED_COLOR,
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

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${safeName(projectName)}_documentation.docx`);
  toast.success("Documentation exported as DOCX");
}
