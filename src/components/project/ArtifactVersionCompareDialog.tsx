/**
 * ArtifactVersionCompareDialog — diff two versions of the same artifact.
 *
 * Given a list of `architecture_artifacts` rows sharing the same (type, title),
 * lets the user pick a "from" and "to" version and renders:
 *   - Unified or side-by-side JSON diff (via the `diff` package)
 *   - Optional side-by-side rendered Mermaid diagrams when both versions
 *     contain a `mermaid` / `diagram` string in their content.
 *
 * Read-only. No writes to the database.
 */
import { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Rows,
  ChevronsLeftRight,
  ImageIcon,
  FileJson,
  Workflow,
  FileText,
  Braces,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import type { ArchitectureArtifact } from "@/services/artifactsService";

type ViewMode = "unified" | "split";
type Panel = "json" | "diagram";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** All versions of a single logical artifact, in any order. */
  versions: ArchitectureArtifact[];
  /** Version number to preselect as "to". Defaults to the highest. */
  initialToVersion?: number;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function stringify(content: unknown): string {
  if (content == null) return "";
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

function extractMermaid(content: any): string | null {
  if (!content || typeof content !== "object") return null;
  const candidates = [
    content.mermaid,
    content.diagram,
    content.mermaid_code,
    Array.isArray(content.diagrams) ? content.diagrams[0]?.code : null,
    Array.isArray(content.mermaid_diagrams) ? content.mermaid_diagrams[0]?.code : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}

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

// -------------------------------------------------------------------------
// Structural diff helpers (nodes/edges, ADR sections, JSON paths)
// -------------------------------------------------------------------------

interface DiagramShape {
  nodes: Set<string>;
  edges: Set<string>;
}

/** Extract node ids and directed edges from a Mermaid flowchart/graph body. */
function parseMermaidShape(code: string | null): DiagramShape {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  if (!code) return { nodes, edges };
  const lines = code.split("\n");
  // Edge regex: <id>[optional label] --arrow-- <id>[optional label]
  const edgeRe =
    /([A-Za-z0-9_]+)(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(?:-{1,3}>|-{2,3}|==>|-\.->|<-{1,3}|<-{2,3})\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/g;
  const nodeDeclRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]+\]|\([^)]+\)|\{[^}]+\})/g;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("%%")) continue;
    if (/^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|C4Context|C4Container|C4Component)\b/i.test(line))
      continue;
    let m: RegExpExecArray | null;
    edgeRe.lastIndex = 0;
    while ((m = edgeRe.exec(line))) {
      nodes.add(m[1]);
      nodes.add(m[2]);
      edges.add(`${m[1]}→${m[2]}`);
    }
    nodeDeclRe.lastIndex = 0;
    while ((m = nodeDeclRe.exec(line))) {
      nodes.add(m[1]);
    }
  }
  return { nodes, edges };
}

function diffSets(before: Set<string>, after: Set<string>) {
  let added = 0;
  let removed = 0;
  after.forEach((v) => {
    if (!before.has(v)) added++;
  });
  before.forEach((v) => {
    if (!after.has(v)) removed++;
  });
  return { added, removed, unchanged: before.size - removed };
}

/** Known MADR/ADR-ish section keys we care about. */
const ADR_SECTION_KEYS = [
  "title",
  "status",
  "context",
  "problem",
  "problem_statement",
  "drivers",
  "decision_drivers",
  "options",
  "considered_options",
  "decision",
  "decision_outcome",
  "outcome",
  "rationale",
  "consequences",
  "positive_consequences",
  "negative_consequences",
  "pros_and_cons",
  "related_requirements",
  "related_decisions",
  "links",
];

function extractAdrSections(content: any): Map<string, string> {
  const map = new Map<string, string>();
  if (!content || typeof content !== "object") return map;
  for (const key of ADR_SECTION_KEYS) {
    if (key in content && content[key] != null) {
      try {
        map.set(key, JSON.stringify(content[key]));
      } catch {
        map.set(key, String(content[key]));
      }
    }
  }
  return map;
}

function diffAdrSections(before: any, after: any) {
  const b = extractAdrSections(before);
  const a = extractAdrSections(after);
  let added = 0;
  let removed = 0;
  let modified = 0;
  const keys = new Set<string>([...b.keys(), ...a.keys()]);
  keys.forEach((k) => {
    const hasB = b.has(k);
    const hasA = a.has(k);
    if (hasA && !hasB) added++;
    else if (hasB && !hasA) removed++;
    else if (hasB && hasA && b.get(k) !== a.get(k)) modified++;
  });
  return { added, removed, modified, total: keys.size };
}

/** Flatten a JSON tree to a map of dot/bracket-path → stringified leaf value. */
function flattenPaths(node: unknown, path = "", out = new Map<string, string>(), depth = 0): Map<string, string> {
  if (depth > 12) return out;
  if (node == null || typeof node !== "object") {
    out.set(path || "(root)", JSON.stringify(node));
    return out;
  }
  if (Array.isArray(node)) {
    if (node.length === 0) out.set(path || "(root)", "[]");
    node.forEach((v, i) => flattenPaths(v, `${path}[${i}]`, out, depth + 1));
    return out;
  }
  const keys = Object.keys(node as Record<string, unknown>);
  if (keys.length === 0) out.set(path || "(root)", "{}");
  keys.forEach((k) => {
    const child = (node as Record<string, unknown>)[k];
    flattenPaths(child, path ? `${path}.${k}` : k, out, depth + 1);
  });
  return out;
}

function diffJsonPaths(before: unknown, after: unknown) {
  const b = flattenPaths(before);
  const a = flattenPaths(after);
  let added = 0;
  let removed = 0;
  let modified = 0;
  const keys = new Set<string>([...b.keys(), ...a.keys()]);
  keys.forEach((k) => {
    const hasB = b.has(k);
    const hasA = a.has(k);
    if (hasA && !hasB) added++;
    else if (hasB && !hasA) removed++;
    else if (b.get(k) !== a.get(k)) modified++;
  });
  return { added, removed, modified, total: keys.size };
}

// -------------------------------------------------------------------------
// Diff renderers
// -------------------------------------------------------------------------

function UnifiedDiff({ changes }: { changes: Change[] }) {
  return (
    <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
      {changes.map((c, i) => {
        const lines = c.value.split("\n");
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

// -------------------------------------------------------------------------
// Component
// -------------------------------------------------------------------------

export default function ArtifactVersionCompareDialog({
  open,
  onOpenChange,
  versions,
  initialToVersion,
}: Props) {
  const sorted = useMemo(
    () => [...versions].sort((a, b) => (a.version ?? 0) - (b.version ?? 0)),
    [versions],
  );

  const defaultTo = initialToVersion ?? sorted[sorted.length - 1]?.version ?? 0;
  const defaultFrom =
    sorted.length >= 2 ? sorted[sorted.length - 2].version ?? 0 : sorted[0]?.version ?? 0;

  const [fromV, setFromV] = useState<number>(defaultFrom);
  const [toV, setToV] = useState<number>(defaultTo);
  const [view, setView] = useState<ViewMode>("unified");
  const [panel, setPanel] = useState<Panel>("json");

  const from = sorted.find((a) => a.version === fromV) ?? sorted[0];
  const to = sorted.find((a) => a.version === toV) ?? sorted[sorted.length - 1];

  const beforeText = useMemo(() => stringify(from?.content), [from]);
  const afterText = useMemo(() => stringify(to?.content), [to]);
  const changes = useMemo(() => diffLines(beforeText, afterText), [beforeText, afterText]);
  const stats = useMemo(() => summarize(changes), [changes]);

  const beforeMermaid = extractMermaid(from?.content);
  const afterMermaid = extractMermaid(to?.content);
  const hasDiagram = Boolean(beforeMermaid || afterMermaid);

  const diagramDiff = useMemo(() => {
    const b = parseMermaidShape(beforeMermaid);
    const a = parseMermaidShape(afterMermaid);
    return { nodes: diffSets(b.nodes, a.nodes), edges: diffSets(b.edges, a.edges) };
  }, [beforeMermaid, afterMermaid]);
  const adrDiff = useMemo(() => diffAdrSections(from?.content, to?.content), [from, to]);
  const pathDiff = useMemo(() => diffJsonPaths(from?.content, to?.content), [from, to]);
  const hasAdr = adrDiff.total > 0;

  const label = to?.title || to?.type || "Artifact";
  const unchanged = beforeText === afterText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4 text-primary" />
            Compare versions — "{label}"
          </DialogTitle>
          <DialogDescription className="text-xs flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-600">
              <Plus className="h-3 w-3" /> {stats.added} lines
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <Minus className="h-3 w-3" /> {stats.removed} lines
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{sorted.length} versions available</span>
          </DialogDescription>
        </DialogHeader>

        {/* Version pickers */}
        <div className="flex items-center gap-3 flex-wrap rounded-md border bg-muted/30 p-2.5">
          <VersionPicker
            label="From"
            value={fromV}
            versions={sorted}
            disabledVersion={toV}
            onChange={setFromV}
            tone="destructive"
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <VersionPicker
            label="To"
            value={toV}
            versions={sorted}
            disabledVersion={fromV}
            onChange={setToV}
            tone="success"
          />
          <div className="ml-auto flex items-center gap-2">
            {hasDiagram && (
              <div className="flex rounded-md border overflow-hidden">
                <Button
                  size="sm"
                  variant={panel === "json" ? "secondary" : "ghost"}
                  className="h-7 px-2 rounded-none text-[10px] gap-1"
                  onClick={() => setPanel("json")}
                >
                  <FileJson className="h-3 w-3" /> JSON
                </Button>
                <Button
                  size="sm"
                  variant={panel === "diagram" ? "secondary" : "ghost"}
                  className="h-7 px-2 rounded-none text-[10px] gap-1"
                  onClick={() => setPanel("diagram")}
                >
                  <ImageIcon className="h-3 w-3" /> Diagram
                </Button>
              </div>
            )}
            {panel === "json" && (
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
            )}
          </div>
        </div>

        {/* Metadata line */}
        <div className="grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
          <VersionMeta artifact={from} tone="destructive" />
          <VersionMeta artifact={to} tone="success" />
        </div>

        {/* Structural change summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <SummaryCard
            icon={<Workflow className="h-3.5 w-3.5" />}
            title="Diagram"
            disabled={!hasDiagram}
            metrics={[
              { label: "nodes", added: diagramDiff.nodes.added, removed: diagramDiff.nodes.removed },
              { label: "edges", added: diagramDiff.edges.added, removed: diagramDiff.edges.removed },
            ]}
            emptyText="No Mermaid diagram detected."
          />
          <SummaryCard
            icon={<FileText className="h-3.5 w-3.5" />}
            title="ADR sections"
            disabled={!hasAdr}
            metrics={[
              { label: "added", added: adrDiff.added },
              { label: "removed", removed: adrDiff.removed },
              { label: "modified", modified: adrDiff.modified },
            ]}
            footer={`${adrDiff.total} tracked section${adrDiff.total === 1 ? "" : "s"}`}
            emptyText="No ADR/MADR sections found."
          />
          <SummaryCard
            icon={<Braces className="h-3.5 w-3.5" />}
            title="JSON paths"
            metrics={[
              { label: "added", added: pathDiff.added },
              { label: "removed", removed: pathDiff.removed },
              { label: "modified", modified: pathDiff.modified },
            ]}
            footer={`${pathDiff.total} leaf path${pathDiff.total === 1 ? "" : "s"}`}
          />
        </div>



        <ScrollArea className="flex-1 border rounded-md bg-background">
          <div className="p-2">
            {panel === "diagram" && hasDiagram ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md overflow-hidden">
                  <div className="px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-semibold border-b">
                    v{from?.version} diagram
                  </div>
                  <div className="p-2">
                    {beforeMermaid ? (
                      <MermaidDiagram code={beforeMermaid} title={`v${from?.version}`} />
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground p-4 text-center">
                        No diagram in this version.
                      </p>
                    )}
                  </div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <div className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold border-b">
                    v{to?.version} diagram
                  </div>
                  <div className="p-2">
                    {afterMermaid ? (
                      <MermaidDiagram code={afterMermaid} title={`v${to?.version}`} />
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground p-4 text-center">
                        No diagram in this version.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : unchanged ? (
              <div className="text-xs text-muted-foreground italic p-6 text-center">
                No differences between v{from?.version} and v{to?.version}.
              </div>
            ) : view === "unified" ? (
              <UnifiedDiff changes={changes} />
            ) : (
              <SplitDiff before={beforeText} after={afterText} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function VersionPicker({
  label,
  value,
  versions,
  disabledVersion,
  onChange,
  tone,
}: {
  label: string;
  value: number;
  versions: ArchitectureArtifact[];
  disabledVersion: number;
  onChange: (v: number) => void;
  tone: "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/40 text-destructive"
      : "border-emerald-500/40 text-emerald-600";
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className={cn("font-semibold uppercase tracking-wider", toneClass)}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-7 rounded border bg-background px-2 text-[11px] font-mono",
          toneClass,
        )}
      >
        {versions.map((v) => (
          <option
            key={v.id}
            value={v.version ?? 0}
            disabled={v.version === disabledVersion}
          >
            v{v.version} · {new Date(v.updated_at).toLocaleDateString()}{" "}
            {v.status ? `· ${v.status}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function VersionMeta({
  artifact,
  tone,
}: {
  artifact: ArchitectureArtifact | undefined;
  tone: "destructive" | "success";
}) {
  if (!artifact) return <div />;
  const chipClass =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className={cn("text-[10px]", chipClass)}>
        v{artifact.version}
      </Badge>
      {artifact.status && (
        <span className="text-[10px] font-mono uppercase tracking-wider">{artifact.status}</span>
      )}
      <span className="text-[10px]">
        {new Date(artifact.updated_at).toLocaleString()}
      </span>
      {artifact.generated_by && (
        <span className="text-[10px] italic">by {artifact.generated_by}</span>
      )}
    </div>
  );
}

interface SummaryMetric {
  label: string;
  added?: number;
  removed?: number;
  modified?: number;
}

function SummaryCard({
  icon,
  title,
  metrics,
  footer,
  disabled,
  emptyText,
}: {
  icon: React.ReactNode;
  title: string;
  metrics: SummaryMetric[];
  footer?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const totalChanges = metrics.reduce(
    (sum, m) => sum + (m.added ?? 0) + (m.removed ?? 0) + (m.modified ?? 0),
    0,
  );
  return (
    <div
      className={cn(
        "rounded-md border bg-muted/20 px-3 py-2 text-[11px]",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">
          {icon}
          {title}
        </div>
        {!disabled && (
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] px-1.5 py-0",
              totalChanges === 0
                ? "text-muted-foreground"
                : "text-primary border-primary/40 bg-primary/10",
            )}
          >
            {totalChanges === 0 ? "no change" : `${totalChanges} change${totalChanges === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>
      {disabled ? (
        <p className="italic text-muted-foreground text-[10px]">{emptyText ?? "Not applicable."}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-1">
              <span className="text-muted-foreground">{m.label}</span>
              {m.added !== undefined && (
                <span className="flex items-center gap-0.5 text-emerald-600 font-mono">
                  <Plus className="h-2.5 w-2.5" />
                  {m.added}
                </span>
              )}
              {m.removed !== undefined && (
                <span className="flex items-center gap-0.5 text-destructive font-mono">
                  <Minus className="h-2.5 w-2.5" />
                  {m.removed}
                </span>
              )}
              {m.modified !== undefined && (
                <span className="flex items-center gap-0.5 text-amber-600 font-mono">
                  <Pencil className="h-2.5 w-2.5" />
                  {m.modified}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {footer && !disabled && (
        <div className="mt-1 text-[10px] text-muted-foreground/80">{footer}</div>
      )}
    </div>
  );
}
