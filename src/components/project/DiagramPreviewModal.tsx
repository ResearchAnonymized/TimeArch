import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ImageDown,
  FileDown,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import MermaidDiagram from "./MermaidDiagram";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportDiagramsAsPng } from "@/lib/diagrams-png-export";
import { exportDiagramsAsPdf } from "@/lib/diagrams-pdf-export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PreviewDiagram {
  code: string;
  title?: string;
  type?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagrams: PreviewDiagram[];
  projectName: string;
  reportTitle?: string;
  /** Initial diagram index to show. */
  initialIndex?: number;
}

/**
 * Full-page modal preview for architecture diagrams.
 * - High-resolution Mermaid render with manual zoom controls.
 * - Keyboard navigation (←/→) between diagrams.
 * - Inline PNG / PDF export of the currently visible diagram or all diagrams.
 */
export default function DiagramPreviewModal({
  open,
  onOpenChange,
  diagrams,
  projectName,
  reportTitle,
  initialIndex = 0,
}: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Quality (raster scale) and background controls
  const [quality, setQuality] = useState<"standard" | "high" | "ultra">("high");
  const [transparent, setTransparent] = useState(false);

  const qualityScale = quality === "ultra" ? 4 : quality === "high" ? 3 : 2;

  useEffect(() => {
    if (open) {
      setIndex(Math.min(initialIndex, Math.max(0, diagrams.length - 1)));
      setZoom(1);
    }
  }, [open, initialIndex, diagrams.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, diagrams.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3));
      else if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
      else if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, diagrams.length]);

  const current = diagrams[index];
  const hasMany = diagrams.length > 1;

  const handlePngCurrent = async () => {
    if (!current) return;
    setExportingPng(true);
    try {
      await exportDiagramsAsPng([current], {
        projectName,
        scale: qualityScale,
        transparent,
      });
      toast.success("Exported diagram as PNG");
    } catch (err: any) {
      toast.error(err?.message || "PNG export failed");
    } finally {
      setExportingPng(false);
    }
  };

  const handlePdfAll = async () => {
    setExportingPdf(true);
    try {
      await exportDiagramsAsPdf(diagrams, {
        projectName,
        reportTitle: reportTitle || "Architecture Diagrams",
        scale: qualityScale,
        transparent,
      });
      toast.success(
        `Exported ${diagrams.length} diagram${diagrams.length === 1 ? "" : "s"} to PDF`,
      );
    } catch (err: any) {
      toast.error(err?.message || "PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] w-[98vw] h-[96vh] p-0 flex flex-col gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card/95 backdrop-blur flex-shrink-0">
          <DialogTitle className="text-sm font-display font-semibold flex items-center gap-2 min-w-0 flex-1">
            <span className="truncate">{current.title || `Diagram ${index + 1}`}</span>
            {current.type && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider flex-shrink-0"
              >
                {current.type.replace(/_/g, " ")}
              </Badge>
            )}
            {hasMany && (
              <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
                {index + 1} / {diagrams.length}
              </span>
            )}
          </DialogTitle>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-md bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
              title="Zoom out (−)"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              title="Zoom in (+)"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(1)}
              title="Reset zoom (0)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Quality + background controls */}
          <div className="flex items-center gap-1.5 border rounded-md bg-background px-1.5 py-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
              Quality
            </span>
            <Select value={quality} onValueChange={(v) => setQuality(v as typeof quality)}>
              <SelectTrigger className="h-6 w-[110px] text-[11px] border-0 bg-transparent px-1.5 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard" className="text-xs">
                  Standard (2×)
                </SelectItem>
                <SelectItem value="high" className="text-xs">
                  High (3×)
                </SelectItem>
                <SelectItem value="ultra" className="text-xs">
                  Ultra (4×)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center border rounded-md bg-background overflow-hidden">
            <button
              type="button"
              onClick={() => setTransparent(false)}
              className={cn(
                "h-7 px-2 text-[11px] flex items-center gap-1 transition-colors",
                !transparent
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="White background"
            >
              <span className="h-3 w-3 rounded-sm border bg-white" />
              White
            </button>
            <button
              type="button"
              onClick={() => setTransparent(true)}
              className={cn(
                "h-7 px-2 text-[11px] flex items-center gap-1 transition-colors border-l",
                transparent
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Transparent background (PNG only)"
            >
              <span
                className="h-3 w-3 rounded-sm border"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)",
                  backgroundSize: "6px 6px",
                  backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
                }}
              />
              Transparent
            </button>
          </div>

          {/* Export */}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={handlePngCurrent}
            disabled={exportingPng || exportingPdf}
          >
            {exportingPng ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageDown className="h-3.5 w-3.5" />
            )}
            {exportingPng ? "Exporting…" : "PNG (this)"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={handlePdfAll}
            disabled={exportingPng || exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {exportingPdf ? "Building…" : `PDF (${diagrams.length})`}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-auto bg-muted/30">
          {hasMany && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-md"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full shadow-md"
                onClick={() => setIndex((i) => Math.min(i + 1, diagrams.length - 1))}
                disabled={index === diagrams.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          <div className="min-h-full flex items-center justify-center p-6">
            <div
              className="origin-center transition-transform"
              style={{ transform: `scale(${zoom})` }}
            >
              <div className="bg-background rounded-lg shadow-lg border min-w-[60vw]">
                <MermaidDiagram
                  key={`${index}-${current.code.slice(0, 24)}`}
                  code={current.code}
                  title={current.title}
                  type={current.type}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer thumbnail strip */}
        {hasMany && (
          <div className="border-t bg-card/95 px-4 py-2 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2">
              {diagrams.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-md border text-[11px] whitespace-nowrap transition-colors",
                    i === index
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-foreground/5",
                  )}
                >
                  <span className="font-mono mr-1.5">{i + 1}.</span>
                  {d.title || `Diagram ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
