/**
 * Render a set of Mermaid diagrams to PNG and trigger downloads.
 * Single diagram → one PNG file. Multiple diagrams → one PNG per diagram
 * (named with index + slugified title).
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
  });
  mermaidReady = true;
}

export interface PngDiagramInput {
  code: string;
  title?: string;
  type?: string;
}

async function renderToPngBlob(
  diagram: PngDiagramInput,
  index: number,
  scale: number,
  transparent: boolean,
): Promise<Blob> {
  initMermaid();
  const id = `diagrampng-${Date.now()}-${index}`;
  const { svg } = await mermaid.render(id, diagram.code);

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

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
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
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
        "image/png",
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to render diagram #${index + 1}`));
    };
    img.src = url;
  });
}

function slugify(s: string) {
  return (
    s
      .replace(/[^a-z0-9]+/gi, "_")
      .toLowerCase()
      .replace(/^_+|_+$/g, "") || "diagram"
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportDiagramsAsPng(
  diagrams: PngDiagramInput[],
  opts: { projectName: string; scale?: number; transparent?: boolean },
): Promise<void> {
  if (!diagrams.length) throw new Error("No diagrams to export");
  const scale = opts.scale ?? 2;
  const transparent = opts.transparent ?? false;
  const projectSlug = slugify(opts.projectName);

  const failures: string[] = [];
  for (let i = 0; i < diagrams.length; i++) {
    const d = diagrams[i];
    try {
      const blob = await renderToPngBlob(d, i, scale, transparent);
      const titleSlug = slugify(d.title || `diagram_${i + 1}`);
      const name =
        diagrams.length === 1
          ? `${projectSlug}_${titleSlug}.png`
          : `${projectSlug}_${String(i + 1).padStart(2, "0")}_${titleSlug}.png`;
      downloadBlob(blob, name);
    } catch (err: any) {
      failures.push(d.title || `Diagram ${i + 1}`);
    }
  }
  if (failures.length) {
    throw new Error(`Exported with errors. Failed: ${failures.join(", ")}`);
  }
}
