import { useState } from "react";
import { Download, FileText, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpTip } from "./HelpTip";
import {
  exportStageAsPDF,
  exportStageAsDOCX,
  exportStageAsMarkdown,
} from "@/lib/stage-report-export";

interface Props {
  projectId: string;
  projectName: string;
  currentStage: number;
}

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

export default function StageReportDownloader({ projectId, projectName, currentStage }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: "pdf" | "docx" | "md") => {
    setExporting(format);
    try {
      if (format === "pdf") await exportStageAsPDF(projectId, projectName, currentStage);
      else if (format === "docx") await exportStageAsDOCX(projectId, projectName, currentStage);
      else await exportStageAsMarkdown(projectId, projectName, currentStage);
    } catch (err: any) {
      console.error("Export error:", err);
    } finally {
      setExporting(null);
    }
  };

  const isExporting = exporting !== null;

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Download className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground">
          Stage Report
        </span>
        <HelpTip
          text={`Download a detailed report for "${STAGE_LABELS[currentStage] || `Stage ${currentStage}`}" including all artifacts, agent runs, and governance status.`}
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[10px] h-8 px-2"
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
        >
          {exporting === "pdf" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileDown className="h-3 w-3" />
          )}
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[10px] h-8 px-2"
          onClick={() => handleExport("docx")}
          disabled={isExporting}
        >
          {exporting === "docx" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          DOCX
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[10px] h-8 px-2"
          onClick={() => handleExport("md")}
          disabled={isExporting}
        >
          {exporting === "md" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          MD
        </Button>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed text-center">
        Export current stage artifacts, analysis, and governance data
      </p>
    </div>
  );
}
