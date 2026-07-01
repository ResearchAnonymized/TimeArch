/**
 * Bundle a set of Mermaid diagrams into a single paginated PDF.
 * Each diagram gets its own page with a title header and project metadata footer.
 *
 * Used by the Style Recommender (and reusable elsewhere) to produce
 * report-ready, high-resolution diagram packs.
 */
import mermaid from "mermaid";

let mermaidReady = false;

function initMermaid() {
  if (mermaidReady) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    themeVariables: {
      primaryColor: "#3b82f6",
      primaryTextColor: "#1e293b",
      primaryBorderColor: "#bfdbfe",
      lineColor: "#94a3b8",
      background: "#ffffff",
      mainBkg: "#f8fafc",
      nodeBorder: "#cbd5e1",
      clusterBkg: "#f1f5f9",
    },
  });
  mermaidReady = true;
}

export interface DiagramInput {
  code: string;
  title?: string;
  type?: string;
}

interface BundleOptions {
  projectName: string;
  reportTitle?: string;
  /** Pixel scale used when rasterizing each SVG (higher = sharper). */
  scale?: number;
  /** When true, page background stays white but each diagram raster has a transparent backdrop. */
  transparent?: boolean;
}

/** Render a single Mermaid source string into a PNG dataURL. */
async function renderDiagramToPng(
  diagram: DiagramInput,
  index: number,
  scale: number,
  transparent: boolean,
): Promise<{ dataUrl: string; width: number; height: number }> {
  initMermaid();
  const id = `diagrampdf-${Date.now()}-${index}`;
  const { svg } = await mermaid.render(id, diagram.code);

  // Ensure xmlns for standalone rasterization
  let svgString = svg;
  if (!/xmlns=/.test(svgString)) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.documentElement as unknown as SVGSVGElement;
  const viewBox = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const baseW = Number(svgEl.getAttribute("width")) || (viewBox?.[2] ?? 1200);
  const baseH = Number(svgEl.getAttribute("height")) || (viewBox?.[3] ?? 800);

  const width = Math.max(1, Math.round(baseW * scale));
  const height = Math.max(1, Math.round(baseH * scale));

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      if (!transparent) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to render diagram #${index + 1}`));
    };
    img.src = url;
  });

  return { dataUrl, width, height };
}

export async function exportDiagramsAsPdf(
  diagrams: DiagramInput[],
  opts: BundleOptions,
): Promise<void> {
  if (!diagrams.length) {
    throw new Error("No diagrams to export");
  }

  const { default: jsPDF } = await import("jspdf");
  const scale = opts.scale ?? 2;
  const transparent = opts.transparent ?? false;

  // Landscape A4 for wide architecture diagrams
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const headerH = 56;
  const footerH = 28;
  const contentTop = margin + headerH;
  const contentH = pageH - contentTop - margin - footerH;
  const contentW = pageW - margin * 2;

  // ── Cover page ──────────────────────────────────────────────────
  const reportTitle = opts.reportTitle ?? "Architecture Diagrams";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.setTextColor(15, 23, 42);
  pdf.text(reportTitle, margin, margin + 60);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(71, 85, 105);
  pdf.text(opts.projectName, margin, margin + 90);

  pdf.setFontSize(11);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`${diagrams.length} diagram${diagrams.length === 1 ? "" : "s"}`, margin, margin + 112);
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, margin + 128);

  // Table of contents
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Contents", margin, margin + 170);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(51, 65, 85);
  diagrams.forEach((d, i) => {
    const label = `${i + 1}. ${d.title || `Diagram ${i + 1}`}${d.type ? ` (${d.type.replace(/_/g, " ")})` : ""}`;
    pdf.text(label, margin + 12, margin + 192 + i * 16);
  });

  // ── One page per diagram ────────────────────────────────────────
  const failures: string[] = [];

  for (let i = 0; i < diagrams.length; i++) {
    const d = diagrams[i];
    pdf.addPage();

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text(d.title || `Diagram ${i + 1}`, margin, margin + 20);

    if (d.type) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(d.type.replace(/_/g, " ").toUpperCase(), margin, margin + 36);
    }

    // Divider
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin, margin + headerH - 8, pageW - margin, margin + headerH - 8);

    try {
      const { dataUrl, width, height } = await renderDiagramToPng(d, i, scale, transparent);

      // Fit the rasterized PNG into the content box, preserving aspect ratio
      const ratio = Math.min(contentW / width, contentH / height);
      const drawW = width * ratio;
      const drawH = height * ratio;
      const drawX = margin + (contentW - drawW) / 2;
      const drawY = contentTop + (contentH - drawH) / 2;

      pdf.addImage(dataUrl, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST");
    } catch (err: any) {
      failures.push(d.title || `Diagram ${i + 1}`);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(220, 38, 38);
      pdf.text(
        `This diagram could not be rendered: ${err?.message ?? "unknown error"}`,
        margin,
        contentTop + 24,
      );

      // Fallback: include the source code so the page is still useful
      pdf.setFont("courier", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(d.code, contentW);
      pdf.text(lines.slice(0, 40), margin, contentTop + 48);
    }

    // Footer
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(opts.projectName, margin, pageH - margin);
    pdf.text(`Page ${i + 2} of ${diagrams.length + 1}`, pageW - margin, pageH - margin, {
      align: "right",
    });
  }

  const safeName = opts.projectName.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  pdf.save(`${safeName}_diagrams.pdf`);

  if (failures.length) {
    throw new Error(
      `PDF generated, but ${failures.length} diagram${failures.length === 1 ? "" : "s"} failed to render: ${failures.join(", ")}`,
    );
  }
}
