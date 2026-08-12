/**
 * ArtifactDetailView — renders an architecture_artifacts row in a
 * requirements-engineer / architect friendly view.
 *
 * Dispatches on artifact.type to a specialised sub-renderer. Reads
 * `content` (jsonb) defensively so unknown / partial shapes never crash.
 *
 * Standards alignment:
 *   - ISO/IEC/IEEE 42010  : viewpoints, views, rationale in the header
 *   - MADR 3.0           : ADR sections (context, drivers, options, outcome, consequences)
 *   - ATAM               : sensitivity points, tradeoffs, risks in evaluations
 */
import { useMemo, useState } from "react";
import {
  Copy,
  Download,
  Maximize2,
  FileCode2,
  GitBranch,
  Network,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  Lock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import type { ArchitectureArtifact } from "@/services/artifactsService";
import { decisionToMarkdown, downloadText } from "@/lib/adr-export";

// -------------------------------------------------------------------------
// Public component
// -------------------------------------------------------------------------

interface Props {
  artifact: ArchitectureArtifact;
}

export default function ArtifactDetailView({ artifact }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="space-y-3">
      <GovernanceHeader artifact={artifact} onFullscreen={() => setFullscreen(true)} />
      <div className="rounded-lg border bg-background/40 p-3">
        <ArtifactBody artifact={artifact} />
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{artifact.title || artifact.type}</DialogTitle>
          </DialogHeader>
          <ArtifactBody artifact={artifact} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------------------
// Governance header
// -------------------------------------------------------------------------

function GovernanceHeader({
  artifact,
  onFullscreen,
}: {
  artifact: ArchitectureArtifact;
  onFullscreen: () => void;
}) {
  const content = (artifact.content ?? {}) as Record<string, unknown>;
  const relatedReqs = extractRequirementRefs(content);
  const relatedDrivers = extractDriverRefs(content);
  const isDecision = looksLikeDecision(artifact.type, content);
  const isDiagramArtifact = extractDiagrams(content).length > 0;

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(artifact.content, null, 2));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const downloadMd = () => {
    const md = decisionToMarkdown(artifact);
    downloadText(`${slugify(artifact.title || artifact.type)}.md`, md, "text/markdown");
  };

  const downloadMmd = () => {
    const diagrams = extractDiagrams(content);
    const bundle = diagrams
      .map((d, i) => `%% ${d.title || `diagram-${i + 1}`}\n${d.code}`)
      .join("\n\n---\n\n");
    downloadText(`${slugify(artifact.title || artifact.type)}.mmd`, bundle, "text/vnd.mermaid");
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill status={artifact.status as string} />
        {artifact.locked_by && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground border rounded px-1 py-0.5">
          {artifact.type}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">v{artifact.version}</span>
        <span className="text-[10px] text-muted-foreground">
          Updated {new Date(artifact.updated_at).toLocaleString()}
        </span>
      </div>

      {(relatedReqs.length > 0 || relatedDrivers.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          {relatedReqs.slice(0, 8).map((r) => (
            <Badge key={r} variant="outline" className="font-mono text-[10px]">
              REQ {r}
            </Badge>
          ))}
          {relatedReqs.length > 8 && (
            <span className="text-muted-foreground">+{relatedReqs.length - 8} more</span>
          )}
          {relatedDrivers.slice(0, 6).map((d) => (
            <Badge key={d} variant="outline" className="font-mono text-[10px]">
              DRV {d}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={copyJson}>
          <Copy className="h-3 w-3 mr-1" /> Copy JSON
        </Button>
        {isDecision && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={downloadMd}>
            <Download className="h-3 w-3 mr-1" /> Download .md
          </Button>
        )}
        {isDiagramArtifact && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={downloadMmd}>
            <Download className="h-3 w-3 mr-1" /> Download .mmd
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onFullscreen}>
          <Maximize2 className="h-3 w-3 mr-1" /> Full screen
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = (status || "draft").toLowerCase();
  const tone =
    s === "approved" || s === "locked"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : s === "in_review"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
        : s === "rejected"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}

// -------------------------------------------------------------------------
// Body dispatcher
// -------------------------------------------------------------------------

function ArtifactBody({ artifact }: { artifact: ArchitectureArtifact }) {
  const content = (artifact.content ?? {}) as Record<string, unknown>;

  const diagrams = extractDiagrams(content);
  const hasDiagrams = diagrams.length > 0;
  const type = (artifact.type || "").toLowerCase();

  return (
    <div className="space-y-4">
      {hasDiagrams && <DiagramsSection diagrams={diagrams} />}

      {looksLikeDecision(type, content) && <DecisionSection content={content} />}

      {Array.isArray((content as any).components) && (
        <ComponentsSection
          components={(content as any).components}
          deps={(content as any).dependency_graph}
        />
      )}

      {Array.isArray((content as any).apis) && <ApisSection apis={(content as any).apis} />}

      {Array.isArray((content as any).entities) && (
        <EntitiesSection
          entities={(content as any).entities}
          relationships={(content as any).relationships}
        />
      )}

      {Array.isArray((content as any).evaluations) && (
        <EvaluationsSection evaluations={(content as any).evaluations} />
      )}

      {Array.isArray((content as any).risks) && <RisksSection risks={(content as any).risks} />}

      {Array.isArray((content as any).drivers) && (
        <DriversSection drivers={(content as any).drivers} />
      )}

      {Array.isArray((content as any).functional_requirements) && (
        <RequirementsSection
          fnl={(content as any).functional_requirements}
          nfr={(content as any).non_functional_requirements}
        />
      )}

      {/* Always allow raw inspection as last-resort fallback */}
      <RawJson content={artifact.content} />
    </div>
  );
}

// -------------------------------------------------------------------------
// Sections
// -------------------------------------------------------------------------

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h4>
  );
}

function DiagramsSection({
  diagrams,
}: {
  diagrams: Array<{ title?: string; type?: string; code: string }>;
}) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={Network}>Diagrams ({diagrams.length})</SectionTitle>
      <div className="space-y-3">
        {diagrams.map((d, i) => (
          <div key={i} className="rounded-lg border overflow-hidden bg-background">
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
              <div className="text-xs font-medium truncate">
                {d.title || `Diagram ${i + 1}`}
              </div>
              {d.type && (
                <span className="text-[9px] uppercase font-mono text-muted-foreground">
                  {d.type}
                </span>
              )}
            </div>
            <div className="p-2">
              <MermaidDiagram code={d.code} title={d.title} type={d.type} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionSection({ content }: { content: Record<string, any> }) {
  const drivers = content.decision_drivers || content.drivers;
  const options = content.considered_options || content.options;
  const consequences = content.consequences;

  return (
    <section className="space-y-2">
      <SectionTitle icon={FileCode2}>Decision Record</SectionTitle>
      <div className="space-y-3 text-sm">
        {content.context && (
          <SubBlock label="Context & Problem Statement">
            <p className="whitespace-pre-wrap">{String(content.context)}</p>
          </SubBlock>
        )}

        {Array.isArray(drivers) && drivers.length > 0 && (
          <SubBlock label="Decision Drivers">
            <ul className="list-disc pl-5 space-y-1">
              {drivers.map((d: unknown, i: number) => (
                <li key={i}>{String(d)}</li>
              ))}
            </ul>
          </SubBlock>
        )}

        {Array.isArray(options) && options.length > 0 && (
          <SubBlock label="Considered Options">
            <div className="space-y-2">
              {options.map((o: any, i: number) => (
                <div key={i} className="rounded border p-2 bg-muted/20">
                  <div className="font-medium text-sm">{o.title || o.name || `Option ${i + 1}`}</div>
                  {o.description && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {o.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Array.isArray(o.pros) && o.pros.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                          Pros
                        </div>
                        <ul className="text-xs list-disc pl-4 space-y-0.5">
                          {o.pros.map((p: string, k: number) => (
                            <li key={k}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(o.cons) && o.cons.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                          Cons
                        </div>
                        <ul className="text-xs list-disc pl-4 space-y-0.5">
                          {o.cons.map((p: string, k: number) => (
                            <li key={k}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SubBlock>
        )}

        {content.decision && (
          <SubBlock label="Decision Outcome">
            <p className="whitespace-pre-wrap">{String(content.decision)}</p>
          </SubBlock>
        )}

        {content.rationale && (
          <SubBlock label="Rationale">
            <p className="whitespace-pre-wrap">{String(content.rationale)}</p>
          </SubBlock>
        )}

        {consequences && (
          <SubBlock label="Consequences">
            {typeof consequences === "string" ? (
              <p className="whitespace-pre-wrap">{consequences}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {(["positive", "negative", "neutral"] as const).map((k) => {
                  const arr = (consequences as any)[k];
                  if (!Array.isArray(arr) || arr.length === 0) return null;
                  return (
                    <div key={k} className="rounded border p-2 bg-muted/20">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        {k}
                      </div>
                      <ul className="text-xs list-disc pl-4 space-y-0.5">
                        {arr.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </SubBlock>
        )}
      </div>
    </section>
  );
}

function ComponentsSection({
  components,
  deps,
}: {
  components: any[];
  deps?: Array<{ from: string; to: string; type?: string }>;
}) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={GitBranch}>Components ({components.length})</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {components.map((c, i) => (
          <div key={i} className="rounded border p-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{c.name || `Component ${i + 1}`}</span>
              {c.type && (
                <Badge variant="outline" className="text-[10px]">
                  {c.type}
                </Badge>
              )}
            </div>
            {c.responsibility && (
              <p className="text-xs text-muted-foreground mt-1">{c.responsibility}</p>
            )}
            {Array.isArray(c.related_requirements) && c.related_requirements.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {c.related_requirements.map((r: string) => (
                  <span
                    key={r}
                    className="text-[9px] font-mono border rounded px-1 py-0.5 text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {Array.isArray(deps) && deps.length > 0 && (
        <SubBlock label={`Dependencies (${deps.length})`}>
          <ul className="text-xs font-mono space-y-0.5 max-h-40 overflow-y-auto">
            {deps.map((d, i) => (
              <li key={i}>
                {d.from} <span className="text-muted-foreground">→</span> {d.to}
                {d.type && <span className="text-muted-foreground"> ({d.type})</span>}
              </li>
            ))}
          </ul>
        </SubBlock>
      )}
    </section>
  );
}

function ApisSection({ apis }: { apis: any[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={ExternalLink}>APIs ({apis.length})</SectionTitle>
      <div className="space-y-2">
        {apis.map((api, i) => (
          <div key={i} className="rounded border bg-muted/20 overflow-hidden">
            <div className="px-2 py-1.5 border-b bg-background/50 text-sm font-medium">
              {api.name || api.service || `API ${i + 1}`}
              {api.style && (
                <span className="ml-2 text-[10px] font-mono text-muted-foreground uppercase">
                  {api.style}
                </span>
              )}
            </div>
            {Array.isArray(api.endpoints) && api.endpoints.length > 0 && (
              <table className="w-full text-xs">
                <tbody>
                  {api.endpoints.map((ep: any, k: number) => (
                    <tr key={k} className="border-t">
                      <td className="px-2 py-1 font-mono text-[10px] w-14 text-emerald-600 dark:text-emerald-400">
                        {ep.method}
                      </td>
                      <td className="px-2 py-1 font-mono text-[11px]">{ep.path}</td>
                      <td className="px-2 py-1 text-muted-foreground">{ep.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EntitiesSection({
  entities,
  relationships,
}: {
  entities: any[];
  relationships?: any[];
}) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={GitBranch}>Data Model ({entities.length} entities)</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {entities.map((e, i) => (
          <div key={i} className="rounded border p-2 bg-muted/20">
            <div className="font-medium text-sm">{e.name || `Entity ${i + 1}`}</div>
            {Array.isArray(e.attributes) && (
              <ul className="text-xs mt-1 space-y-0.5">
                {e.attributes.slice(0, 8).map((a: any, k: number) => (
                  <li key={k} className="font-mono text-[11px]">
                    {a.name}
                    {a.type && <span className="text-muted-foreground"> : {a.type}</span>}
                  </li>
                ))}
                {e.attributes.length > 8 && (
                  <li className="text-muted-foreground text-[10px]">
                    +{e.attributes.length - 8} more
                  </li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
      {Array.isArray(relationships) && relationships.length > 0 && (
        <SubBlock label={`Relationships (${relationships.length})`}>
          <ul className="text-xs font-mono space-y-0.5">
            {relationships.map((r, i) => (
              <li key={i}>
                {r.from} <span className="text-muted-foreground">— {r.type || "→"} —</span> {r.to}
              </li>
            ))}
          </ul>
        </SubBlock>
      )}
    </section>
  );
}

function EvaluationsSection({ evaluations }: { evaluations: any[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={ShieldCheck}>Quality Attribute Evaluations</SectionTitle>
      <div className="space-y-2">
        {evaluations.map((e, i) => (
          <div key={i} className="rounded border p-2 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{e.attribute || `Attribute ${i + 1}`}</span>
              <div className="flex items-center gap-2">
                {e.rating && (
                  <Badge
                    variant="outline"
                    className={
                      e.rating === "strong"
                        ? "text-emerald-600 border-emerald-500/40"
                        : e.rating === "weak"
                          ? "text-rose-600 border-rose-500/40"
                          : "text-amber-600 border-amber-500/40"
                    }
                  >
                    {e.rating}
                  </Badge>
                )}
                {e.score != null && (
                  <span className="text-xs font-mono text-muted-foreground">{e.score}/10</span>
                )}
              </div>
            </div>
            {e.rationale && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                {e.rationale}
              </p>
            )}
            {Array.isArray(e.sensitivity_points) && e.sensitivity_points.length > 0 && (
              <div className="text-[10px] mt-1 text-muted-foreground">
                Sensitivity: {e.sensitivity_points.join(", ")}
              </div>
            )}
            {Array.isArray(e.tradeoffs) && e.tradeoffs.length > 0 && (
              <div className="text-[10px] mt-0.5 text-muted-foreground">
                Tradeoffs: {e.tradeoffs.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RisksSection({ risks }: { risks: any[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={AlertTriangle}>Risk Register ({risks.length})</SectionTitle>
      <div className="space-y-1.5">
        {risks.map((r, i) => (
          <div key={i} className="rounded border p-2 bg-muted/20">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{r.title || `Risk ${i + 1}`}</span>
              {r.severity && (
                <Badge
                  variant="outline"
                  className={
                    r.severity === "critical" || r.severity === "high"
                      ? "text-rose-600 border-rose-500/40"
                      : r.severity === "medium"
                        ? "text-amber-600 border-amber-500/40"
                        : "text-emerald-600 border-emerald-500/40"
                  }
                >
                  {r.severity}
                </Badge>
              )}
            </div>
            {r.description && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                {r.description}
              </p>
            )}
            {r.mitigation_strategy && (
              <p className="text-xs mt-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Mitigation:{" "}
                </span>
                {r.mitigation_strategy}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DriversSection({ drivers }: { drivers: any[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle icon={ClipboardList}>Architecture Drivers ({drivers.length})</SectionTitle>
      <div className="space-y-1.5">
        {drivers.map((d, i) => (
          <div key={i} className="rounded border p-2 bg-muted/20 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{d.title || d.name || `Driver ${i + 1}`}</span>
              {d.priority && <Badge variant="outline">{d.priority}</Badge>}
              {d.quality_attribute && (
                <Badge variant="outline">{d.quality_attribute}</Badge>
              )}
            </div>
            {d.stimulus && (
              <p className="mt-1">
                <span className="text-muted-foreground">Stimulus: </span>
                {d.stimulus}
              </p>
            )}
            {d.response_measure && (
              <p>
                <span className="text-muted-foreground">Response: </span>
                {d.response_measure}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function RequirementsSection({ fnl, nfr }: { fnl: any[]; nfr?: any[] }) {
  const rows = [
    ...(fnl || []).map((r) => ({ ...r, kind: "F" })),
    ...(nfr || []).map((r) => ({ ...r, kind: "NF" })),
  ];
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <SectionTitle icon={ClipboardList}>Requirements ({rows.length})</SectionTitle>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1">ID</th>
              <th className="text-left px-2 py-1">Title</th>
              <th className="text-left px-2 py-1 w-14">Kind</th>
              <th className="text-left px-2 py-1 w-20">Priority</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 font-mono text-[10px]">{r.id}</td>
                <td className="px-2 py-1">{r.title}</td>
                <td className="px-2 py-1">{r.kind}</td>
                <td className="px-2 py-1 text-muted-foreground">{r.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 30 && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground border-t bg-muted/20">
            +{rows.length - 30} more
          </div>
        )}
      </div>
    </section>
  );
}

function RawJson({ content }: { content: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded border bg-muted/10"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        Raw JSON
      </summary>
      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto text-muted-foreground p-3 border-t">
        {JSON.stringify(content, null, 2)}
      </pre>
    </details>
  );
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function SubBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function extractDiagrams(
  content: Record<string, unknown>,
): Array<{ title?: string; type?: string; code: string }> {
  const list = (content.mermaid_diagrams || content.diagrams) as unknown;
  if (!Array.isArray(list)) return [];
  const out: Array<{ title?: string; type?: string; code: string }> = [];
  for (const d of list as any[]) {
    if (typeof d === "string" && d.trim().length > 0) {
      out.push({ code: d });
      continue;
    }
    const code = d?.code || d?.mermaid || d?.source;
    if (typeof code === "string" && code.trim().length > 0) {
      out.push({ title: d?.title, type: d?.type, code });
    }
  }
  return out;
}

function extractRequirementRefs(content: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v === "string") refs.add(v);
  };
  const walk = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj.related_requirements)) obj.related_requirements.forEach(push);
    if (Array.isArray(obj.requirement_ids)) obj.requirement_ids.forEach(push);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") walk(v);
    }
  };
  walk(content);
  return Array.from(refs);
}

function extractDriverRefs(content: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v === "string") refs.add(v);
  };
  const walk = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj.related_drivers)) obj.related_drivers.forEach(push);
    if (Array.isArray(obj.driver_ids)) obj.driver_ids.forEach(push);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === "object") walk(v);
    }
  };
  walk(content);
  return Array.from(refs);
}

function looksLikeDecision(type: string, content: Record<string, unknown>): boolean {
  const t = (type || "").toLowerCase();
  if (
    t.includes("decision") ||
    t.includes("adr") ||
    t.includes("style") ||
    t.includes("decomposition")
  )
    return true;
  return Boolean(
    content.decision ||
      content.considered_options ||
      content.options ||
      content.decision_drivers,
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "artifact";
}
