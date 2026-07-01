import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Zap,
  FileText,
  Pencil,
  Eye,
  Download,
  Loader2,
  Plus,
  Image,
  Save,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DocumentSectionEditor from "@/components/document-editor/DocumentSectionEditor";
import DocumentFigureManager from "@/components/document-editor/DocumentFigureManager";
import DocumentPreview from "@/components/document-editor/DocumentPreview";
import DocumentExportBar from "@/components/document-editor/DocumentExportBar";
import {
  DocumentDraft,
  DocumentSection,
  generateId,
  rawDocumentToDraft,
} from "@/lib/document-editor-types";
import { getRequiredAccessToken } from "@/lib/authenticated-functions";
import mermaid from "mermaid";

// Re-use the existing export rendering logic
import {
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
  PageBreak,
  ImageRun,
} from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STEPS = [
  { id: "generate", label: "Generate Draft", icon: FileText },
  { id: "edit", label: "Preview & Edit", icon: Pencil },
  { id: "export", label: "Export", icon: Download },
];

export default function DocumentEditorPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [projectName, setProjectName] = useState("");
  const [currentStage, setCurrentStage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"generate" | "edit" | "export">("generate");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const typeFromUrl = searchParams.get("type");
  const validTypes = ["srs", "sad", "assessment", "full_package"];
  const [selectedType, setSelectedType] = useState(
    typeFromUrl && validTypes.includes(typeFromUrl) ? typeFromUrl : "full_package",
  );

  // Draft state
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [editTab, setEditTab] = useState("sections");
  const [saving, setSaving] = useState(false);

  // Load project and check for an existing draft of the SAME document type
  useEffect(() => {
    if (!projectId || !user) return;
    setLoading(true);
    setDraft(null);
    setStep("generate");
    const load = async () => {
      const [projRes, draftRes] = await Promise.all([
        supabase.from("projects").select("name, current_stage").eq("id", projectId).single(),
        supabase
          .from("architecture_artifacts")
          .select("*")
          .eq("project_id", projectId)
          .eq("type", "executive_summary")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (projRes.data) {
        setProjectName(projRes.data.name);
        setCurrentStage(projRes.data.current_stage);
      }

      // Find an existing draft that matches the currently selected document type
      const existingDraft = (draftRes.data || []).find((d: any) => {
        const c = d?.content;
        return c && c.sections && c.figures && c.document_type === selectedType;
      });
      if (existingDraft?.content) {
        setDraft(existingDraft.content as unknown as DocumentDraft);
        setStep("edit");
      }

      setLoading(false);
    };
    load();
  }, [projectId, user, selectedType]);

  // Generate document (with automatic retries on transient failures)
  const generateDocument = async () => {
    if (!user || !projectId) return;
    setGenerating(true);
    setProgress(10);
    setProgressLabel("Collecting project data...");

    const MAX_ATTEMPTS = 3;
    const TIMEOUT_MS = 180_000; // 3 min per attempt
    const isTransientStatus = (s: number) =>
      s === 408 || s === 425 || s === 429 || s === 500 || s === 502 || s === 503 || s === 504;

    const attemptOnce = async (): Promise<any> => {
      const token = await getRequiredAccessToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              project_id: projectId,
              document_type: selectedType,
              user_id: user.id,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          let errMsg = `Document generation failed (${response.status})`;
          try {
            const err = await response.json();
            if (err?.error) errMsg = err.error;
          } catch {
            /* non-JSON body */
          }
          const e: any = new Error(errMsg);
          e.status = response.status;
          e.transient = isTransientStatus(response.status);
          throw e;
        }
        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      setProgress(25);
      setProgressLabel("Sending to AI for synthesis...");

      let data: any;
      let lastErr: any;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          data = await attemptOnce();
          lastErr = null;
          break;
        } catch (err: any) {
          lastErr = err;
          const isAbort = err?.name === "AbortError";
          const isNetwork = err instanceof TypeError; // fetch network failure
          const retriable = isAbort || isNetwork || err?.transient === true;
          if (!retriable || attempt === MAX_ATTEMPTS) throw err;
          const backoff = 1500 * Math.pow(2, attempt - 1); // 1.5s, 3s
          const reason = isAbort ? "timeout" : isNetwork ? "network error" : `HTTP ${err?.status}`;
          console.warn(
            `[generate-document] attempt ${attempt} failed (${reason}); retrying in ${backoff}ms`,
          );
          setProgressLabel(`Retrying after ${reason}… (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
          setProgress(25 + attempt * 10);
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
      if (!data) throw lastErr || new Error("Document generation failed");

      setProgress(70);
      setProgressLabel("Processing AI response...");

      const rawDoc = data.document;

      // Convert to editable draft and pin the document_type to the user-selected one
      const newDraft = rawDocumentToDraft(generateId(), rawDoc, projectName);
      newDraft.document_type = selectedType;

      // Save draft to database
      setProgress(85);
      setProgressLabel("Saving draft...");

      const { error } = await supabase.from("architecture_artifacts").insert({
        project_id: projectId,
        type: "executive_summary" as any,
        title: `[${selectedType.toUpperCase()}] ${newDraft.document_title} (Draft)`,
        content: newDraft as any,
        status: "draft" as any,
        stage: 14,
        created_by: user.id,
        generated_by: "document-editor",
      });

      if (error) console.error("Failed to save draft:", error);

      setDraft(newDraft);
      setStep("edit");
      setProgress(100);
      setProgressLabel("Draft ready!");
      toast.success("Document draft generated! Review and edit before exporting.");
    } catch (err: any) {
      console.error("Generation error:", err);
      const msg =
        err?.name === "AbortError"
          ? "Document generation timed out after multiple retries. Please try again."
          : err?.message || "Failed to generate document";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!draft || !projectId || !user) return;
    setSaving(true);
    const updatedDraft = {
      ...draft,
      metadata: { ...draft.metadata, lastEditedAt: new Date().toISOString() },
    };

    await supabase
      .from("architecture_artifacts")
      .update({ content: updatedDraft as any, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("type", "executive_summary")
      .eq("generated_by", "document-editor")
      .eq("status", "draft");

    setDraft(updatedDraft);
    setSaving(false);
    toast.success("Draft saved");
  }, [draft, projectId, user]);

  // Section operations
  const updateSection = (index: number, updated: DocumentSection) => {
    if (!draft) return;
    const newSections = [...draft.sections];
    newSections[index] = updated;
    setDraft({ ...draft, sections: newSections });
  };

  const deleteSection = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== index) });
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    if (!draft) return;
    const newSections = [...draft.sections];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newSections.length) return;
    [newSections[index], newSections[target]] = [newSections[target], newSections[index]];
    setDraft({ ...draft, sections: newSections });
  };

  const addSection = (afterIndex: number) => {
    if (!draft) return;
    const newSection: DocumentSection = {
      id: generateId(),
      number: `${draft.sections.length + 1}`,
      title: "New Section",
      content: "",
      order: afterIndex + 1,
    };
    const newSections = [...draft.sections];
    newSections.splice(afterIndex + 1, 0, newSection);
    setDraft({ ...draft, sections: newSections });
  };

  // Mermaid rendering helper
  const getSvgExportBounds = (svgMarkup: string) => {
    const mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "0";
    mount.style.visibility = "hidden";
    mount.style.pointerEvents = "none";
    mount.style.opacity = "0";
    mount.innerHTML = svgMarkup;
    document.body.appendChild(mount);

    try {
      const svgEl = mount.querySelector("svg") as SVGSVGElement | null;
      if (!svgEl) return null;

      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgEl.setAttribute("overflow", "visible");
      svgEl.style.overflow = "visible";

      const graphics = Array.from(
        svgEl.querySelectorAll(
          "g, path, rect, circle, ellipse, polygon, polyline, line, text, foreignObject",
        ),
      ) as SVGGraphicsElement[];

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of graphics) {
        if (typeof node.getBBox !== "function") continue;
        try {
          const box = node.getBBox();
          if (!Number.isFinite(box.x) || !Number.isFinite(box.y)) continue;
          if (box.width === 0 && box.height === 0) continue;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        } catch {
          // Ignore elements that cannot report a bbox.
        }
      }

      const viewBox = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
      const fallbackWidth =
        Number(svgEl.getAttribute("width")?.replace("px", "")) || (viewBox?.[2] ?? 800);
      const fallbackHeight =
        Number(svgEl.getAttribute("height")?.replace("px", "")) || (viewBox?.[3] ?? 600);

      if (
        !Number.isFinite(minX) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(maxY)
      ) {
        return { x: 0, y: 0, width: fallbackWidth, height: fallbackHeight };
      }

      return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      };
    } finally {
      document.body.removeChild(mount);
    }
  };

  const renderMermaidToImage = async (
    code: string,
    id: string,
  ): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    try {
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
      const { svg } = await mermaid.render(`export-diagram-${id}-${Date.now()}`, code);
      const bounds = getSvgExportBounds(svg);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, "image/svg+xml");
      const svgEl = svgDoc.querySelector("svg");
      if (!svgEl) return null;

      const padding = 24;
      const width = Math.max(1, Math.ceil((bounds?.width ?? 800) + padding * 2));
      const height = Math.max(1, Math.ceil((bounds?.height ?? 600) + padding * 2));
      const minX = Math.floor((bounds?.x ?? 0) - padding);
      const minY = Math.floor((bounds?.y ?? 0) - padding);

      svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgEl.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      svgEl.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
      svgEl.setAttribute("width", `${width}`);
      svgEl.setAttribute("height", `${height}`);
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgEl.setAttribute("overflow", "visible");
      svgEl.style.overflow = "visible";
      svgEl.style.maxWidth = "none";
      svgEl.style.background = "#ffffff";

      const normalizedSvg = new XMLSerializer().serializeToString(svgEl);

      return new Promise((resolve) => {
        const img = new window.Image();
        const svgBase64 = btoa(unescape(encodeURIComponent(normalizedSvg)));
        const dataUrlSrc = `data:image/svg+xml;base64,${svgBase64}`;
        img.onload = () => {
          const scale = 3;
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/png");
          resolve({ dataUrl, width, height });
        };
        img.onerror = () => {
          resolve(null);
        };
        img.src = dataUrlSrc;
      });
    } catch {
      return null;
    }
  };

  // Helper: strip markdown for plain text
  const stripMarkdown = (text: string) =>
    text
      .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");

  // Helper: parse markdown into segments for PDF rendering
  type TextSegment = { text: string; bold?: boolean; italic?: boolean };
  const parseMarkdownSegments = (text: string): TextSegment[] => {
    const segments: TextSegment[] = [];
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[2]) segments.push({ text: match[2], bold: true, italic: true });
      else if (match[3]) segments.push({ text: match[3], bold: true });
      else if (match[4]) segments.push({ text: match[4], italic: true });
      else if (match[5]) segments.push({ text: match[5] });
      else if (match[6]) segments.push({ text: match[6] });
    }
    return segments.length ? segments : [{ text }];
  };

  // Export PDF from draft
  const exportPDF = async () => {
    if (!draft) {
      toast.error("No draft to export");
      return;
    }
    try {
      console.log("[Export PDF] Starting export for", draft.document_title);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      // Render text with markdown formatting in PDF
      const addPdfFormattedText = (content: string, baseX: number, maxWidth: number) => {
        const paragraphs = content.split("\n");
        for (const para of paragraphs) {
          const trimmed = para.trim();
          if (!trimmed) {
            y += 2;
            continue;
          }
          const isList = trimmed.startsWith("- ");
          const textContent = isList ? trimmed.substring(2) : trimmed;
          const indent = isList ? 4 : 0;
          const plainText = (isList ? "•  " : "") + stripMarkdown(textContent);
          const wrappedLines = pdf.splitTextToSize(plainText, maxWidth - indent);
          for (let li = 0; li < wrappedLines.length; li++) {
            checkPage(5);
            if (li === 0 && isList) {
              pdf.setFont("helvetica", "normal");
              pdf.text("•  ", baseX + indent - 4, y);
            }
            const segs = parseMarkdownSegments(
              li === 0 ? textContent : stripMarkdown(wrappedLines[li]),
            );
            if (segs.some((s) => s.bold || s.italic)) {
              let xPos = baseX + indent;
              for (const seg of segs) {
                const fontStyle =
                  seg.bold && seg.italic
                    ? "bolditalic"
                    : seg.bold
                      ? "bold"
                      : seg.italic
                        ? "italic"
                        : "normal";
                pdf.setFont("helvetica", fontStyle);
                pdf.text(seg.text, xPos, y);
                xPos += pdf.getTextWidth(seg.text);
              }
              pdf.setFont("helvetica", "normal");
            } else {
              pdf.setFont("helvetica", "normal");
              pdf.text(wrappedLines[li], baseX + indent, y);
            }
            y += 4.5;
          }
        }
      };

      // Title page
      pdf.setFillColor(30, 58, 95);
      pdf.rect(0, 0, pageWidth, 80, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      const titleLines = pdf.splitTextToSize(draft.document_title, contentWidth);
      pdf.text(titleLines, pageWidth / 2, 35, { align: "center" });
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "normal");
      pdf.text(draft.project_name, pageWidth / 2, 55, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(
        `${draft.standard_reference} | v${draft.version} | ${draft.date}`,
        pageWidth / 2,
        68,
        { align: "center" },
      );

      // Executive Summary
      pdf.addPage();
      y = margin;
      pdf.setTextColor(30, 58, 95);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("Executive Summary", margin, y);
      y += 10;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      addPdfFormattedText(draft.executive_summary || "", margin, contentWidth);
      y += 5;

      // Render included figures
      const figureImages = new Map<string, { dataUrl: string; width: number; height: number }>();
      for (const fig of draft.figures.filter((f) => f.included)) {
        const img = await renderMermaidToImage(fig.mermaidCode, fig.id);
        if (img) figureImages.set(fig.id, img);
      }

      // Sections
      const addPdfSections = (sections: DocumentSection[], level: number) => {
        for (const section of sections) {
          const fontSize = level === 0 ? 16 : level === 1 ? 13 : 11;
          checkPage(20);
          if (level === 0) {
            y += 4;
            pdf.setDrawColor(30, 58, 95);
            pdf.setLineWidth(0.3);
            pdf.line(margin, y, pageWidth - margin, y);
            y += 6;
          }
          pdf.setTextColor(30, 58, 95);
          pdf.setFontSize(fontSize);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${section.number} ${section.title}`, margin + level * 5, y);
          y += fontSize * 0.5 + 4;

          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(10);
          addPdfFormattedText(section.content || "", margin + level * 5, contentWidth - level * 5);
          y += 4;

          // Table
          if (section.table?.headers?.length) {
            checkPage(20);
            autoTable(pdf, {
              startY: y,
              head: [section.table.headers],
              body: section.table.rows || [],
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255] },
            });
            y = (pdf as any).lastAutoTable.finalY + 6;
          }

          // Figures for this section
          const sectionFigs = draft.figures.filter((f) => f.sectionId === section.id && f.included);
          for (const fig of sectionFigs) {
            const imgData = figureImages.get(fig.id);
            if (imgData) {
              const caption = `Figure: ${fig.caption}`;
              const captionLines = pdf.splitTextToSize(caption, contentWidth - 10);
              const captionHeight = captionLines.length * 4 + 4;
              const pxToMm = 0.264583;
              let imgW = imgData.width * pxToMm;
              let imgH = imgData.height * pxToMm;
              const maxImgH = pageHeight - 2 * margin - captionHeight - 8;
              if (imgW > contentWidth) {
                const r = contentWidth / imgW;
                imgW = contentWidth;
                imgH *= r;
              }
              if (imgH > maxImgH) {
                const r = maxImgH / imgH;
                imgH = maxImgH;
                imgW *= r;
              }
              if (y + imgH + captionHeight + 6 > pageHeight - margin) {
                pdf.addPage();
                y = margin;
              }
              pdf.addImage(
                imgData.dataUrl,
                "PNG",
                margin + (contentWidth - imgW) / 2,
                y,
                imgW,
                imgH,
              );
              y += imgH + 4;
              pdf.setTextColor(100, 100, 100);
              pdf.setFontSize(8);
              pdf.setFont("helvetica", "italic");
              for (const line of captionLines) {
                pdf.text(line, pageWidth / 2, y, { align: "center" });
                y += 4;
              }
              y += 4;
            }
          }

          if (section.subsections?.length) addPdfSections(section.subsections, level + 1);
        }
      };

      addPdfSections(draft.sections, 0);

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${totalPages} | ${draft.document_title} | TimeArch`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" },
        );
      }

      // Use blob + window.open for better download compatibility
      const pdfBlob = pdf.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.project_name.replace(/[^a-zA-Z0-9]/g, "_")}_${draft.document_type}_v${draft.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      console.log("[Export PDF] Done");
    } catch (err: any) {
      console.error("[Export PDF] Failed:", err);
      throw new Error(err?.message || "PDF export failed");
    }
  };

  // Export DOCX from draft
  const exportDOCX = async () => {
    if (!draft) {
      toast.error("No draft to export");
      return;
    }
    try {
      console.log("[Export DOCX] Starting export for", draft.document_title);
      const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
      const cellBorders = {
        top: cellBorder,
        bottom: cellBorder,
        left: cellBorder,
        right: cellBorder,
      };
      const children: any[] = [];

      // Helper: convert markdown text to TextRun array for DOCX
      const markdownToRuns = (text: string, fontSize = 22): any[] => {
        const runs: any[] = [];
        const segs = parseMarkdownSegments(text);
        for (const seg of segs) {
          runs.push(
            new TextRun({
              text: seg.text,
              size: fontSize,
              font: "Arial",
              bold: seg.bold || false,
              italics: seg.italic || false,
            }),
          );
        }
        return runs;
      };

      // Helper: convert markdown content to Paragraph array (handles lists, paragraphs)
      const markdownToParagraphs = (content: string, fontSize = 22): any[] => {
        const paras: any[] = [];
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("- ")) {
            paras.push(
              new Paragraph({
                spacing: { after: 60 },
                indent: { left: 360, hanging: 180 },
                children: [
                  new TextRun({ text: "•  ", size: fontSize, font: "Arial" }),
                  ...markdownToRuns(trimmed.substring(2), fontSize),
                ],
              }),
            );
          } else {
            paras.push(
              new Paragraph({
                spacing: { after: 100 },
                children: markdownToRuns(trimmed, fontSize),
              }),
            );
          }
        }
        return paras;
      };

      // Title page
      children.push(
        new Paragraph({ spacing: { before: 4000 }, alignment: AlignmentType.CENTER, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: draft.document_title,
              bold: true,
              size: 56,
              font: "Arial",
              color: "1E3A5F",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: draft.project_name, size: 36, font: "Arial", color: "4A6FA5" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: `${draft.standard_reference} | v${draft.version} | ${draft.date}`,
              size: 22,
              font: "Arial",
              color: "888888",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Generated by TimeArch",
              size: 20,
              font: "Arial",
              color: "999999",
              italics: true,
            }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      );

      // Executive Summary
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text: "Executive Summary",
              bold: true,
              size: 32,
              font: "Arial",
              color: "1E3A5F",
            }),
          ],
        }),
      );
      children.push(...markdownToParagraphs(draft.executive_summary || "", 24));
      children.push(new Paragraph({ children: [new PageBreak()] }));

      // Render figures
      const figureImages = new Map<string, Uint8Array>();
      const figSizes = new Map<string, { w: number; h: number }>();
      for (const fig of draft.figures.filter((f) => f.included)) {
        const img = await renderMermaidToImage(fig.mermaidCode, fig.id);
        if (img) {
          const base64Data = img.dataUrl.split(",")[1];
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          figureImages.set(fig.id, bytes);

          const maxW = 600;
          const maxH = 760;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            const r = maxW / w;
            w = maxW;
            h = Math.round(h * r);
          }
          if (h > maxH) {
            const r = maxH / h;
            h = maxH;
            w = Math.round(w * r);
          }
          figSizes.set(fig.id, { w, h });
        }
      }

      // Sections
      const addSections = (sections: DocumentSection[], level: number) => {
        for (const section of sections) {
          const heading =
            level === 0
              ? HeadingLevel.HEADING_1
              : level === 1
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3;
          const fontSize = level === 0 ? 32 : level === 1 ? 28 : 24;

          children.push(
            new Paragraph({
              heading,
              spacing: { before: level === 0 ? 360 : 240, after: 120 },
              children: [
                new TextRun({
                  text: `${section.number} ${section.title}`,
                  bold: true,
                  size: fontSize,
                  font: "Arial",
                  color: "1E3A5F",
                }),
              ],
            }),
          );

          children.push(...markdownToParagraphs(section.content || ""));

          // Table
          if (section.table?.headers?.length) {
            const colW = Math.floor(9360 / section.table.headers.length);
            children.push(
              new Paragraph({ spacing: { before: 120 }, children: [] }),
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: section.table.headers.map(() => colW),
                rows: [
                  new TableRow({
                    children: section.table.headers.map(
                      (h) =>
                        new TableCell({
                          borders: cellBorders,
                          width: { size: colW, type: WidthType.DXA },
                          shading: { fill: "1E3A5F", type: ShadingType.CLEAR },
                          margins: { top: 60, bottom: 60, left: 80, right: 80 },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: h,
                                  bold: true,
                                  size: 20,
                                  font: "Arial",
                                  color: "FFFFFF",
                                }),
                              ],
                            }),
                          ],
                        }),
                    ),
                  }),
                  ...(section.table.rows || []).map(
                    (row) =>
                      new TableRow({
                        children: row.map(
                          (cell) =>
                            new TableCell({
                              borders: cellBorders,
                              width: { size: colW, type: WidthType.DXA },
                              margins: { top: 40, bottom: 40, left: 80, right: 80 },
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({ text: cell || "", size: 20, font: "Arial" }),
                                  ],
                                }),
                              ],
                            }),
                        ),
                      }),
                  ),
                ],
              }),
              new Paragraph({ spacing: { after: 120 }, children: [] }),
            );
          }

          // Figures
          const sectionFigs = draft.figures.filter((f) => f.sectionId === section.id && f.included);
          for (const fig of sectionFigs) {
            const imgBytes = figureImages.get(fig.id);
            const size = figSizes.get(fig.id);
            if (imgBytes && size) {
              children.push(
                new Paragraph({ spacing: { before: 120 }, children: [] }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  keepLines: true,
                  keepNext: true,
                  children: [
                    new ImageRun({
                      type: "png",
                      data: imgBytes,
                      transformation: { width: size.w, height: size.h },
                      altText: {
                        title: fig.caption,
                        description: fig.caption,
                        name: `figure-${fig.id}`,
                      },
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  keepLines: true,
                  spacing: { after: 180 },
                  children: [
                    new TextRun({
                      text: `Figure: ${fig.caption}`,
                      size: 18,
                      font: "Arial",
                      italics: true,
                      color: "666666",
                    }),
                  ],
                }),
              );
            }
          }

          if (section.subsections?.length) addSections(section.subsections, level + 1);
        }
      };

      addSections(draft.sections, 0);

      const docx = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 24 } } },
          paragraphStyles: [
            {
              id: "Heading1",
              name: "Heading 1",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 32, bold: true, font: "Arial", color: "1E3A5F" },
              paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
            },
            {
              id: "Heading2",
              name: "Heading 2",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 28, bold: true, font: "Arial", color: "2E5A8F" },
              paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
            },
            {
              id: "Heading3",
              name: "Heading 3",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 24, bold: true, font: "Arial", color: "3E6A9F" },
              paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 },
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
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: `${draft.document_title}`,
                        size: 16,
                        font: "Arial",
                        color: "999999",
                        italics: true,
                      }),
                    ],
                  }),
                ],
              }),
            },
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: "Page ", size: 16, font: "Arial", color: "999999" }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 16,
                        font: "Arial",
                        color: "999999",
                      }),
                      new TextRun({
                        text: " | Generated by TimeArch",
                        size: 16,
                        font: "Arial",
                        color: "999999",
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

      const blob = await Packer.toBlob(docx);
      saveAs(
        blob,
        `${draft.project_name.replace(/[^a-zA-Z0-9]/g, "_")}_${draft.document_type}_v${draft.version}.docx`,
      );
      console.log("[Export DOCX] Done");
    } catch (err: any) {
      console.error("[Export DOCX] Failed:", err);
      throw new Error(err?.message || "DOCX export failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card flex-shrink-0">
        <div className="flex h-12 items-center px-4 gap-3">
          <button
            onClick={() => navigate(`/project/${projectId}`)}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <Zap className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-bold">TimeArch</span>
          </div>
          <div className="h-4 w-px bg-border" />

          {/* Breadcrumb navigation */}
          <nav className="hidden sm:flex items-center gap-1 text-xs min-w-0">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Dashboard
            </button>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            <button
              onClick={() => navigate(`/project/${projectId}`)}
              className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px]"
              title={projectName}
            >
              {projectName}
            </button>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            <span className="text-primary font-medium flex items-center gap-1">
              <FileText className="h-3 w-3" /> Document Editor
            </span>
          </nav>
          {/* Mobile fallback */}
          <span className="sm:hidden text-xs text-muted-foreground truncate">
            <FileText className="h-3.5 w-3.5 inline mr-1" />
            {projectName}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {draft && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={saveDraft}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save Draft
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b bg-card/50 px-4 py-3">
        <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCurrent = s.id === step;
            const isDone = (step === "edit" && i === 0) || (step === "export" && i < 2);
            return (
              <div key={s.id} className="flex items-center gap-3">
                {i > 0 && <div className={`w-12 h-0.5 ${isDone ? "bg-primary" : "bg-border"}`} />}
                <button
                  onClick={() => {
                    if (isDone || isCurrent) setStep(s.id as any);
                  }}
                  disabled={!isDone && !isCurrent && !(s.id === "export" && draft)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isDone
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {s.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Step 1: Generate */}
          {step === "generate" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-display font-bold">Generate Document Draft</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  AI will synthesize your project data into a structured document that you can
                  review, edit, and export.
                </p>
              </div>

              {/* Document type selection */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: "srs",
                    label: "SRS",
                    full: "Software Requirements Specification",
                    standard: "IEEE 830",
                    minStage: 3,
                  },
                  {
                    id: "sad",
                    label: "SAD",
                    full: "Software Architecture Document",
                    standard: "ISO 42010",
                    minStage: 10,
                  },
                  {
                    id: "assessment",
                    label: "AAR",
                    full: "Architecture Assessment Report",
                    standard: "ATAM",
                    minStage: 14,
                  },
                  {
                    id: "full_package",
                    label: "FAP",
                    full: "Full Architecture Package",
                    standard: "Enterprise",
                    minStage: 14,
                  },
                ].map((doc) => {
                  const available = currentStage >= doc.minStage;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => available && setSelectedType(doc.id)}
                      disabled={!available}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedType === doc.id
                          ? "border-primary bg-primary/5"
                          : available
                            ? "border-border hover:border-primary/40"
                            : "border-border/30 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-display font-bold text-sm">{doc.label}</span>
                        {selectedType === doc.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs font-medium">{doc.full}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {doc.standard}
                      </p>
                      {!available && (
                        <p className="text-[10px] text-amber-500 mt-1">
                          Requires Stage {doc.minStage}+
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress */}
              {generating && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <span className="text-sm font-bold block">{progressLabel}</span>
                      <span className="text-[10px] text-muted-foreground">{progress}%</span>
                    </div>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button
                className="w-full h-11 gap-2 font-display font-bold"
                onClick={generateDocument}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {generating ? "Generating Draft..." : "Generate Document Draft"}
              </Button>

              {draft && (
                <Button variant="outline" className="w-full gap-2" onClick={() => setStep("edit")}>
                  <Pencil className="h-4 w-4" />
                  Continue Editing Existing Draft
                </Button>
              )}
            </div>
          )}

          {/* Step 2: Edit */}
          {step === "edit" && draft && (
            <div className="space-y-4">
              <Tabs value={editTab} onValueChange={setEditTab} className="w-full">
                <div className="flex items-center justify-between mb-4">
                  <TabsList className="h-9">
                    <TabsTrigger value="sections" className="text-xs gap-1.5">
                      <Pencil className="h-3 w-3" />
                      Sections ({draft.sections.length})
                    </TabsTrigger>
                    <TabsTrigger value="figures" className="text-xs gap-1.5">
                      <Image className="h-3 w-3" />
                      Figures ({draft.figures.length})
                    </TabsTrigger>
                    <TabsTrigger value="metadata" className="text-xs gap-1.5">
                      <FileText className="h-3 w-3" />
                      Metadata
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-xs gap-1.5">
                      <Eye className="h-3 w-3" />
                      Full Preview
                    </TabsTrigger>
                  </TabsList>

                  <Button onClick={() => setStep("export")} className="gap-1.5 h-9 text-xs">
                    <Download className="h-3 w-3" />
                    Proceed to Export
                  </Button>
                </div>

                <TabsContent value="sections" className="space-y-2">
                  {draft.sections.map((section, index) => (
                    <DocumentSectionEditor
                      key={section.id}
                      section={section}
                      index={index}
                      total={draft.sections.length}
                      onUpdate={(updated) => updateSection(index, updated)}
                      onDelete={() => deleteSection(index)}
                      onMoveUp={() => moveSection(index, "up")}
                      onMoveDown={() => moveSection(index, "down")}
                      onAddBelow={() => addSection(index)}
                    />
                  ))}

                  <button
                    onClick={() => addSection(draft.sections.length - 1)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Section
                  </button>
                </TabsContent>

                <TabsContent value="figures">
                  <DocumentFigureManager
                    figures={draft.figures}
                    sections={draft.sections}
                    onUpdateFigures={(figures) => setDraft({ ...draft, figures })}
                  />
                </TabsContent>

                <TabsContent value="metadata" className="max-w-xl space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Document Title
                      </label>
                      <Input
                        value={draft.document_title}
                        onChange={(e) => setDraft({ ...draft, document_title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                          Version
                        </label>
                        <Input
                          value={draft.version}
                          onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                          Date
                        </label>
                        <Input
                          value={draft.date}
                          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Standard Reference
                      </label>
                      <Input
                        value={draft.standard_reference}
                        onChange={(e) => setDraft({ ...draft, standard_reference: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                        Executive Summary
                      </label>
                      <Textarea
                        value={draft.executive_summary}
                        onChange={(e) => setDraft({ ...draft, executive_summary: e.target.value })}
                        rows={6}
                        className="resize-y"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview">
                  <DocumentPreview draft={draft} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 3: Export */}
          {step === "export" && draft && (
            <div className="max-w-2xl mx-auto space-y-6">
              <DocumentPreview draft={draft} />
              <DocumentExportBar draft={draft} onExportPDF={exportPDF} onExportDOCX={exportDOCX} />
              <div className="text-center">
                <Button variant="ghost" className="gap-1.5 text-xs" onClick={() => setStep("edit")}>
                  <RotateCcw className="h-3 w-3" />
                  Back to Editing
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
