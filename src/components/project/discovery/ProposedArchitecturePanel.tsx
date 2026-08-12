import { useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import { IMPACT_LEGEND, type ProposedArchitecture } from "@/lib/proposedArchitecture";

interface Props {
  proposed: ProposedArchitecture | null;
  loading?: boolean;
  /** When true, omit outer chrome — parent already shows revision summary */
  embedded?: boolean;
}

/** Impact view only: diagram + layers + files. Scope lives in the parent summary. */
export default function ProposedArchitecturePanel({ proposed, loading, embedded }: Props) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Building proposed architecture…
      </div>
    );
  }

  if (!proposed) return null;

  const copyBrief = async () => {
    await navigator.clipboard.writeText(proposed.changeCodingBrief);
    setCopied(true);
    toast.success("Change brief copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBrief = () => {
    const blob = new Blob([proposed.changeCodingBrief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proposed.featureTitle.replace(/[^\w.-]+/g, "_")}_change.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modified = proposed.nodes.filter((n) => n.impact === "modified");

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(["new", "modified", "ripple"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: IMPACT_LEGEND[k].color }} />
              {IMPACT_LEGEND[k].label}
              <span className="tabular-nums text-foreground/70">{proposed.stats[k]}</span>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void copyBrief()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={downloadBrief}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <MermaidDiagram
        code={proposed.mermaidProposed}
        title="To-be architecture"
        type="system_context"
      />

      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border p-3 space-y-1.5">
          <p className="font-medium text-foreground/80">Layers to change</p>
          {modified.length === 0 ? (
            <p className="text-muted-foreground">None flagged</p>
          ) : (
            <ul className="space-y-1 text-muted-foreground">
              {modified.map((n) => (
                <li key={n.id}>
                  {n.label}
                  {n.detail ? ` — ${n.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border p-3 space-y-1.5">
          <p className="font-medium text-foreground/80">Files to touch</p>
          {proposed.filesToTouch.length === 0 ? (
            <p className="text-muted-foreground">Confirm with tech lead</p>
          ) : (
            <ul className="space-y-1 font-mono text-muted-foreground">
              {proposed.filesToTouch.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) return <div className="p-4">{body}</div>;

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Proposed architecture</h3>
      </div>
      <div className="p-4">{body}</div>
    </section>
  );
}
