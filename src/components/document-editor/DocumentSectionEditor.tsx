import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Pencil,
  Eye,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentSection } from "@/lib/document-editor-types";

interface Props {
  section: DocumentSection;
  index: number;
  total: number;
  depth?: number;
  onUpdate: (updated: DocumentSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
}

function renderMarkdownPreview(text: string) {
  // Escape HTML special chars first to prevent XSS, then apply markdown transforms
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, '<h4 class="text-sm font-semibold mt-3 mb-1">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
    .replace(/\n\n/g, '<p class="mb-2"></p>')
    .replace(/\n/g, "<br/>");
}

export default function DocumentSectionEditor({
  section,
  index,
  total,
  depth = 0,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddBelow,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState<"preview" | "edit">("preview");
  const [editTitle, setEditTitle] = useState(section.title);
  const [editContent, setEditContent] = useState(section.content);

  const saveEdits = () => {
    onUpdate({
      ...section,
      title: editTitle,
      content: editContent,
    });
    setEditMode("preview");
  };

  const cancelEdits = () => {
    setEditTitle(section.title);
    setEditContent(section.content);
    setEditMode("preview");
  };

  const hasDiagram = !!section.mermaid_code;
  const hasTable = !!(section.table && section.table.headers?.length > 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn("rounded-lg border bg-card overflow-hidden", depth > 0 && "ml-6 border-dashed")}
    >
      {/* Section header */}
      <div className="flex items-center gap-2 p-3 hover:bg-accent/5 transition-colors">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab flex-shrink-0" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
            {section.number}
          </span>
          <span className="font-semibold text-sm truncate">{section.title}</span>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {hasDiagram && (
            <Badge variant="outline" className="text-[9px] h-5">
              Diagram
            </Badge>
          )}
          {hasTable && (
            <Badge variant="outline" className="text-[9px] h-5">
              Table
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/60 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t px-4 py-3 space-y-3">
              {/* Toggle bar */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border p-0.5 bg-muted/30">
                  <button
                    onClick={() => setEditMode("preview")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                      editMode === "preview"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={() => setEditMode("edit")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                      editMode === "edit"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>

                {editMode === "edit" && (
                  <div className="flex gap-1.5 ml-auto">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdits}>
                      Cancel
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={saveEdits}>
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>

              {editMode === "edit" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Section Title
                    </label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Content (Markdown)
                    </label>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={Math.max(6, editContent.split("\n").length + 2)}
                      className="text-sm font-mono leading-relaxed resize-y"
                    />
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div
                    className="text-sm text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownPreview(section.content || "No content yet."),
                    }}
                  />
                </div>
              )}

              {/* Table preview */}
              {hasTable && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {section.table!.headers.map((h, i) => (
                          <th
                            key={i}
                            className="border bg-muted/50 px-2 py-1.5 text-left font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(section.table!.rows || []).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border px-2 py-1 text-muted-foreground">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add section below */}
              <button
                onClick={onAddBelow}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors py-1"
              >
                <Plus className="h-3 w-3" />
                Add section below
              </button>
            </div>

            {/* Subsections */}
            {section.subsections && section.subsections.length > 0 && (
              <div className="px-4 pb-3 space-y-2">
                {section.subsections.map((sub, si) => (
                  <DocumentSectionEditor
                    key={sub.id}
                    section={sub}
                    index={si}
                    total={section.subsections!.length}
                    depth={depth + 1}
                    onUpdate={(updated) => {
                      const newSubs = [...section.subsections!];
                      newSubs[si] = updated;
                      onUpdate({ ...section, subsections: newSubs });
                    }}
                    onDelete={() => {
                      const newSubs = section.subsections!.filter((_, j) => j !== si);
                      onUpdate({ ...section, subsections: newSubs });
                    }}
                    onMoveUp={() => {
                      if (si === 0) return;
                      const newSubs = [...section.subsections!];
                      [newSubs[si - 1], newSubs[si]] = [newSubs[si], newSubs[si - 1]];
                      onUpdate({ ...section, subsections: newSubs });
                    }}
                    onMoveDown={() => {
                      if (si === section.subsections!.length - 1) return;
                      const newSubs = [...section.subsections!];
                      [newSubs[si], newSubs[si + 1]] = [newSubs[si + 1], newSubs[si]];
                      onUpdate({ ...section, subsections: newSubs });
                    }}
                    onAddBelow={() => {
                      const newSub: DocumentSection = {
                        id: crypto.randomUUID(),
                        number: `${section.number}.${section.subsections!.length + 1}`,
                        title: "New Subsection",
                        content: "",
                        order: section.subsections!.length,
                      };
                      const newSubs = [...section.subsections!];
                      newSubs.splice(si + 1, 0, newSub);
                      onUpdate({ ...section, subsections: newSubs });
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
