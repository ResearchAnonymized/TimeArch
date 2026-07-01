import { useState } from "react";
import { Download, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DocumentDraft } from "@/lib/document-editor-types";

interface Props {
  draft: DocumentDraft;
  onExportPDF: () => Promise<void>;
  onExportDOCX: () => Promise<void>;
}

export default function DocumentExportBar({ draft, onExportPDF, onExportDOCX }: Props) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingDOCX, setExportingDOCX] = useState(false);

  const handlePDF = async () => {
    setExportingPDF(true);
    try {
      await onExportPDF();
      toast.success("PDF exported successfully");
    } catch (err: any) {
      toast.error(err.message || "PDF export failed");
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDOCX = async () => {
    setExportingDOCX(true);
    try {
      await onExportDOCX();
      toast.success("DOCX exported successfully");
    } catch (err: any) {
      toast.error(err.message || "DOCX export failed");
    } finally {
      setExportingDOCX(false);
    }
  };

  const sectionCount = draft.sections.length;
  const figureCount = draft.figures.filter((f) => f.included).length;

  return (
    <div className="rounded-xl border-2 border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-background to-emerald-500/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm">Ready to Export</h3>
          <p className="text-xs text-muted-foreground">
            {sectionCount} sections · {figureCount} figures included · v{draft.version}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          className="flex-1 gap-2 h-11"
          onClick={handlePDF}
          disabled={exportingPDF || exportingDOCX}
        >
          {exportingPDF ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export as PDF
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 h-11"
          onClick={handleDOCX}
          disabled={exportingPDF || exportingDOCX}
        >
          {exportingDOCX ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Export as DOCX
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Exports reflect all your edits, figure selections, and section ordering.
      </p>
    </div>
  );
}
