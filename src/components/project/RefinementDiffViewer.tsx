import { useMemo, useState } from "react";
import { diffLines, Change } from "diff";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitCompare, Sparkles, Plus, Minus, ChevronsLeftRight, Rows } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RefinementRecord {
  item_id: string;
  item_label: string;
  gaps: string[];
  summary: string;
  refined_at: string;
  /** Pretty-printed JSON of the artifact BEFORE the refinement. */
  before?: string;
  /** Pretty-printed JSON of the artifact AFTER the refinement. */
  after?: string;
  /** Pretty-printed JSON of just the patch the AI proposed. */
  patch?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  record: RefinementRecord | null;
}

type ViewMode = "unified" | "split";

function summarize(changes: Change[]) {
  let added = 0;
  let removed = 0;
  changes.forEach((c) => {
    const lines = c.value.split("\n").filter(Boolean).length;
    if (c.added) added += lines;
    else if (c.removed) removed += lines;
  });
  return { added, removed };
}

function UnifiedDiff({ changes }: { changes: Change[] }) {
  return (
    <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
      {changes.map((c, i) => {
        const lines = c.value.split("\n");
        // Drop trailing blank from split
        if (lines.length && lines[lines.length - 1] === "") lines.pop();
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={cn(
              "px-2",
              c.added && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              c.removed && "bg-destructive/10 text-destructive",
              !c.added && !c.removed && "text-muted-foreground/80",
            )}
          >
            <span className="select-none mr-2 opacity-60">
              {c.added ? "+" : c.removed ? "-" : " "}
            </span>
            {line || "\u00A0"}
          </div>
        ));
      })}
    </pre>
  );
}

function SplitDiff({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed">
      <div className="border rounded-md overflow-hidden">
        <div className="px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-semibold border-b">
          Before
        </div>
        <pre className="p-2 whitespace-pre-wrap break-words">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className="text-muted-foreground/80">
              {beforeLines[i] ?? "\u00A0"}
            </div>
          ))}
        </pre>
      </div>
      <div className="border rounded-md overflow-hidden">
        <div className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold border-b">
          After
        </div>
        <pre className="p-2 whitespace-pre-wrap break-words">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className="text-foreground/90">
              {afterLines[i] ?? "\u00A0"}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function RefinementDiffViewer({ open, onOpenChange, record }: Props) {
  const [view, setView] = useState<ViewMode>("unified");
  const [showPatchOnly, setShowPatchOnly] = useState(true);

  const before = record?.before || "";
  const after = record?.after || "";

  const changes = useMemo(() => (before || after ? diffLines(before, after) : []), [before, after]);
  const stats = useMemo(() => summarize(changes), [changes]);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4 text-primary" />
            Refinement diff — "{record.item_label}"
          </DialogTitle>
          <DialogDescription className="text-xs flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-600">
              <Plus className="h-3 w-3" /> {stats.added} lines
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <Minus className="h-3 w-3" /> {stats.removed} lines
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {new Date(record.refined_at).toLocaleString()}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Why it changed */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
            <Sparkles className="h-3 w-3" /> AI summary
          </div>
          <p className="text-xs leading-relaxed">{record.summary}</p>
          {record.gaps?.length ? (
            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                Gaps addressed
              </div>
              <ul className="space-y-0.5">
                {record.gaps.map((g, i) => (
                  <li key={i} className="text-[11px] flex items-start gap-1.5">
                    <Badge variant="outline" className="h-4 text-[9px] mt-0.5">
                      gap
                    </Badge>
                    <span className="leading-snug">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={view === "unified" ? "secondary" : "ghost"}
              className="h-7 px-2 rounded-none text-[10px] gap-1"
              onClick={() => setView("unified")}
            >
              <Rows className="h-3 w-3" /> Unified
            </Button>
            <Button
              size="sm"
              variant={view === "split" ? "secondary" : "ghost"}
              className="h-7 px-2 rounded-none text-[10px] gap-1"
              onClick={() => setView("split")}
            >
              <ChevronsLeftRight className="h-3 w-3" /> Split
            </Button>
          </div>
          {record.patch && (
            <Button
              size="sm"
              variant={showPatchOnly ? "secondary" : "ghost"}
              className="h-7 px-2 text-[10px]"
              onClick={() => setShowPatchOnly((p) => !p)}
            >
              {showPatchOnly ? "Showing patch only" : "Show full diff"}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 border rounded-md bg-background">
          <div className="p-2">
            {showPatchOnly && record.patch ? (
              <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
                {record.patch.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className="px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    <span className="select-none mr-2 opacity-60">+</span>
                    {line || "\u00A0"}
                  </div>
                ))}
              </pre>
            ) : view === "unified" ? (
              <UnifiedDiff changes={changes} />
            ) : (
              <SplitDiff before={before} after={after} />
            )}
            {!before && !after && !record.patch && (
              <div className="text-xs text-muted-foreground italic p-6 text-center">
                No diff data was captured for this refinement.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
