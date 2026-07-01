import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Download,
  FileCheck,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Package,
  CheckCircle2,
  Lock as LockIcon,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HelpTip } from "./HelpTip";

interface Props {
  projectId: string;
  projectName: string;
  currentStage: number;
}

const DOC_TYPES = [
  {
    id: "srs",
    label: "Software Requirements Specification",
    short: "SRS",
    standard: "IEEE 830",
    icon: FileText,
    description: "Complete requirements specification following IEEE 830 standard",
    minStage: 3,
    phase: "Requirement Definition",
  },
  {
    id: "sad",
    label: "Software Architecture Document",
    short: "SAD",
    standard: "ISO/IEC/IEEE 42010",
    icon: BookOpen,
    description: "Full architecture document with 4+1 views, decisions, and design rationale",
    minStage: 10,
    phase: "Architecture Design",
  },
  {
    id: "assessment",
    label: "Architecture Assessment Report",
    short: "AAR",
    standard: "ATAM Method",
    icon: ClipboardCheck,
    description: "ATAM-based quality attribute analysis, risks, and tradeoffs evaluation",
    minStage: 14,
    phase: "Validation & Assurance",
  },
  {
    id: "full_package",
    label: "Full Architecture Package",
    short: "FAP",
    standard: "Enterprise Standard",
    icon: Package,
    description:
      "Complete 21-part deliverable with all views, ADRs, traceability, and handoff notes",
    minStage: 14,
    phase: "Validation & Assurance",
  },
];

export default function DocumentGenerator({ projectId, projectName, currentStage }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("srs");

  const selectedDoc = DOC_TYPES.find((d) => d.id === selectedType)!;
  const isAvailable = currentStage >= selectedDoc.minStage;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-all group">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-display font-bold tracking-tight">
                Architecture Reports
              </h4>
              <p className="text-[10px] text-muted-foreground">
                Generate standards-compliant deliverables
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map((doc) => (
              <Badge
                key={doc.id}
                variant={currentStage >= doc.minStage ? "default" : "secondary"}
                className="text-[9px] gap-1"
              >
                {currentStage >= doc.minStage ? (
                  <FileCheck className="h-2.5 w-2.5" />
                ) : (
                  <LockIcon className="h-2.5 w-2.5" />
                )}
                {doc.short}
              </Badge>
            ))}
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl font-display">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="block">Architecture Report Editor</span>
              <span className="text-xs text-muted-foreground font-normal">
                Generate, review, edit, and export documents
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Document Type Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                Select Document Type
              </Label>
              <HelpTip text="Each document follows industry standards (IEEE 830, ISO 42010, ATAM). Documents become available as you complete stages." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPES.map((doc) => {
                const Icon = doc.icon;
                const available = currentStage >= doc.minStage;
                return (
                  <div
                    key={doc.id}
                    onClick={() => available && setSelectedType(doc.id)}
                    className={cn(
                      "relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selectedType === doc.id
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                        : available
                          ? "border-border hover:border-primary/40 hover:shadow-sm"
                          : "border-border/30 opacity-50 cursor-not-allowed bg-muted/20",
                    )}
                  >
                    {selectedType === doc.id && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center",
                          selectedType === doc.id ? "bg-primary/15" : "bg-muted",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            selectedType === doc.id ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div>
                        <span className="text-sm font-display font-bold block leading-tight">
                          {doc.short}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {doc.standard}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-medium mb-1">{doc.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                      {doc.description}
                    </p>
                    <div className="mt-auto pt-2 border-t border-border/50">
                      <Badge
                        variant={available ? "default" : "outline"}
                        className={cn("text-[9px]", available ? "" : "text-muted-foreground")}
                      >
                        {available ? (
                          <>
                            <FileCheck className="h-2.5 w-2.5 mr-1" /> Ready to Generate
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Stage {doc.minStage}+
                            Required
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <Button
            className="w-full gap-2 h-11 text-sm font-display font-bold"
            onClick={() => {
              setOpen(false);
              navigate(`/project/${projectId}/document?type=${selectedType}`);
            }}
            disabled={!isAvailable}
            size="lg"
          >
            <Pencil className="h-4 w-4" />
            Open Document Editor
          </Button>

          {!isAvailable && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/30">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium">Prerequisites not met</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Complete through Stage {selectedDoc.minStage} ({selectedDoc.phase}) to generate
                  this document. Current progress: Stage {currentStage}.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
