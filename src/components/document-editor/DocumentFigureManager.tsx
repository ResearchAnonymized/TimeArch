import { useState } from "react";
import { Image, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import type { DocumentFigure, DocumentSection } from "@/lib/document-editor-types";

interface Props {
  figures: DocumentFigure[];
  sections: DocumentSection[];
  onUpdateFigures: (figures: DocumentFigure[]) => void;
}

export default function DocumentFigureManager({ figures, sections, onUpdateFigures }: Props) {
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const flatSections = (): { id: string; label: string }[] => {
    const result: { id: string; label: string }[] = [];
    const collect = (secs: DocumentSection[]) => {
      for (const s of secs) {
        result.push({ id: s.id, label: `${s.number} ${s.title}` });
        if (s.subsections) collect(s.subsections);
      }
    };
    collect(sections);
    return result;
  };

  const allSections = flatSections();

  const updateFigure = (id: string, updates: Partial<DocumentFigure>) => {
    onUpdateFigures(figures.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const moveFigure = (index: number, direction: "up" | "down") => {
    const newFigures = [...figures];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newFigures.length) return;
    [newFigures[index], newFigures[target]] = [newFigures[target], newFigures[index]];
    newFigures.forEach((f, i) => (f.order = i));
    onUpdateFigures(newFigures);
  };

  const startEditCaption = (fig: DocumentFigure) => {
    setEditingCaption(fig.id);
    setCaptionValue(fig.caption);
  };

  const saveCaption = (id: string) => {
    updateFigure(id, { caption: captionValue });
    setEditingCaption(null);
  };

  const includedCount = figures.filter((f) => f.included).length;

  if (figures.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-lg">
        <Image className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No figures in this document.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Figures are extracted from Mermaid diagrams in sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-bold">Figures & Diagrams</h3>
          <p className="text-xs text-muted-foreground">
            {includedCount} of {figures.length} included in export
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => onUpdateFigures(figures.map((f) => ({ ...f, included: true })))}
          >
            Include All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => onUpdateFigures(figures.map((f) => ({ ...f, included: false })))}
          >
            Exclude All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {figures.map((fig, index) => {
          const assignedSection = allSections.find((s) => s.id === fig.sectionId);

          return (
            <div
              key={fig.id}
              className={`rounded-lg border p-3 transition-all ${fig.included ? "bg-card" : "bg-muted/30 opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveFigure(index, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveFigure(index, "down")}
                    disabled={index === figures.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] flex-shrink-0">
                      Figure {index + 1}
                    </Badge>

                    {editingCaption === fig.id ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          value={captionValue}
                          onChange={(e) => setCaptionValue(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveCaption(fig.id)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => saveCaption(fig.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingCaption(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{fig.caption}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => startEditCaption(fig)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Section assignment */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Assigned to:</span>
                    <Select
                      value={fig.sectionId}
                      onValueChange={(val) => updateFigure(fig.id, { sectionId: val })}
                    >
                      <SelectTrigger className="h-7 text-xs w-auto min-w-[180px]">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSections.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview toggle */}
                  {previewId === fig.id && (
                    <div className="mt-2 rounded-lg border bg-background p-2">
                      <MermaidDiagram code={fig.mermaidCode} title={fig.caption} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={fig.included}
                    onCheckedChange={(val) => updateFigure(fig.id, { included: val })}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {fig.included ? "Included" : "Excluded"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewId(previewId === fig.id ? null : fig.id)}
                  >
                    {previewId === fig.id ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
