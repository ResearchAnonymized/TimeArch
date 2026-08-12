/**
 * EvidencePanel — reusable right-rail component that renders evidence_refs
 * gathered from finding-producing tools (gap-analyzer, disposition, modernization,
 * drift, mapping, ripple). Purely presentational.
 */
import { FileText, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface EvidenceRef {
  import_id?: string;
  artifact_id?: string;
  gap_id?: string;
  path?: string;
  line_range?: string;
  method?: string;
  confidence?: number;
  snippet?: string;
}

interface Props {
  title?: string;
  subtitle?: string;
  refs: EvidenceRef[] | null | undefined;
  emptyLabel?: string;
}

function methodIcon(method?: string) {
  const m = (method || "").toLowerCase();
  if (m === "llm" || m === "ai") return <Sparkles className="h-3.5 w-3.5" />;
  if (m === "heuristic" || m === "tool") return <Wrench className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

function confidenceClass(c?: number) {
  if (typeof c !== "number") return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  if (c >= 0.75) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (c >= 0.5) return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
}

export default function EvidencePanel({ title = "Evidence", subtitle, refs, emptyLabel }: Props) {
  const list = Array.isArray(refs) ? refs : [];
  return (
    <aside className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {subtitle && <p className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      {list.length === 0 ? (
        <div className="rounded border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground text-center">
          {emptyLabel || "No evidence recorded."}
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <ul className="space-y-1.5 pr-2">
            {list.map((r, idx) => (
              <li key={idx} className="rounded border border-border/60 bg-background p-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground">{methodIcon(r.method)}</span>
                  <span className="font-mono text-[11px] break-all">{r.path || r.artifact_id || r.import_id || r.gap_id || "unknown"}</span>
                  {r.line_range && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      L{r.line_range}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.method && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {r.method}
                    </Badge>
                  )}
                  {typeof r.confidence === "number" && (
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${confidenceClass(r.confidence)}`}>
                      {(r.confidence * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
                {r.snippet && (
                  <pre className="rounded bg-muted/50 p-1.5 text-[10px] font-mono whitespace-pre-wrap break-all">
                    {r.snippet}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </aside>
  );
}
