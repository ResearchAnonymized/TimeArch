import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  FileWarning,
  BookOpen,
  GitMerge,
  Network,
  ListTree,
  Filter as FilterIcon,
  ArrowUpDown,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  scoreRequirements,
  lintRequirement,
  QualityFinding,
  RequirementLike,
} from "./qualityRules";

type AnalysisContent = {
  system_goal?: string;
  business_context?: string;
  stakeholders?: any[];
  functional_requirements?: RequirementLike[];
  non_functional_requirements?: RequirementLike[];
  constraints?: RequirementLike[];
  assumptions?: RequirementLike[];
  integrations?: any[];
  business_rules?: RequirementLike[];
  actors?: any[];
  ambiguities?: any[];
  contradictions?: any[];
  missing_information?: any[];
  duplicates?: any[];
  risks?: any[];
  processing_summary?: any;
};

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

function KPI({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
  hint?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    primary: "text-primary",
  }[tone];
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
        {label}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

function QualityBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-destructive";
  const label = score >= 80 ? "Production-ready" : score >= 60 ? "Needs refinement" : "High risk";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Requirement Quality Score</h4>
          <Badge variant="outline" className="text-[9px] font-mono">
            ISO/IEC/IEEE 29148
          </Badge>
          <Badge variant="outline" className="text-[9px] font-mono">
            INCOSE
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">{label}</p>
    </div>
  );
}

function FindingChip({ f }: { f: QualityFinding }) {
  const severityStyle = {
    error: "bg-destructive/15 text-destructive border-destructive/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    info: "bg-muted text-muted-foreground border-border",
  }[f.severity];
  return (
    <div
      className={`text-[10px] px-2 py-0.5 rounded border inline-flex items-center gap-1 ${severityStyle}`}
    >
      <span className="font-mono">{f.standard}</span>
      <span>·</span>
      <span>{f.rule}</span>
    </div>
  );
}

function StatusIcon({ findings }: { findings: QualityFinding[] }) {
  const hasError = findings.some((f) => f.severity === "error");
  const hasWarn = findings.some((f) => f.severity === "warning");
  if (hasError) return <AlertCircle className="h-4 w-4 text-destructive" aria-label="Failing" />;
  if (hasWarn) return <AlertTriangle className="h-4 w-4 text-warning" aria-label="Warnings" />;
  return <CheckCircle2 className="h-4 w-4 text-success" aria-label="Passing" />;
}

// ─── Data grid ──────────────────────────────────────────────────────────
function RequirementGrid({
  rows,
  perReqFindings,
  onSelect,
}: {
  rows: RequirementLike[];
  perReqFindings: Map<string, QualityFinding[]>;
  onSelect: (r: RequirementLike) => void;
}) {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"id" | "priority" | "quality">("id");

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) =>
          (r.requirement_id || "").toLowerCase().includes(q) ||
          (r.title || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q),
      );
    }
    if (priorityFilter !== "all") {
      out = out.filter((r) => (r.priority || "medium").toLowerCase() === priorityFilter);
    }
    if (qualityFilter !== "all") {
      out = out.filter((r) => {
        const f = perReqFindings.get(r.requirement_id || r.id || r.title || "") || [];
        const hasError = f.some((x) => x.severity === "error");
        const hasWarn = f.some((x) => x.severity === "warning");
        if (qualityFilter === "passing") return !hasError && !hasWarn;
        if (qualityFilter === "warning") return !hasError && hasWarn;
        if (qualityFilter === "failing") return hasError;
        return true;
      });
    }
    out.sort((a, b) => {
      if (sortKey === "priority") {
        return (
          (PRIORITY_RANK[(b.priority || "medium").toLowerCase()] || 0) -
          (PRIORITY_RANK[(a.priority || "medium").toLowerCase()] || 0)
        );
      }
      if (sortKey === "quality") {
        const af = perReqFindings.get(a.requirement_id || a.id || a.title || "") || [];
        const bf = perReqFindings.get(b.requirement_id || b.id || b.title || "") || [];
        return bf.length - af.length;
      }
      return (a.requirement_id || "").localeCompare(b.requirement_id || "");
    });
    return out;
  }, [rows, search, priorityFilter, qualityFilter, sortKey, perReqFindings]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <FilterIcon className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={qualityFilter} onValueChange={setQualityFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <ShieldCheck className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All quality</SelectItem>
            <SelectItem value="passing">Passing</SelectItem>
            <SelectItem value="warning">Warnings</SelectItem>
            <SelectItem value="failing">Failing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">Sort by ID</SelectItem>
            <SelectItem value="priority">Sort by priority</SelectItem>
            <SelectItem value="quality">Sort by issues</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_90px_90px_50px_40px] gap-2 px-3 py-2 border-b bg-muted/40 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          <div>ID</div>
          <div>Title / Description</div>
          <div>Priority</div>
          <div>Source</div>
          <div className="text-center">Quality</div>
          <div></div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No requirements match the filters.
          </div>
        ) : (
          filtered.map((r) => {
            const key = r.requirement_id || r.id || r.title || "";
            const findings = perReqFindings.get(key) || [];
            const priority = (r.priority || "medium").toLowerCase();
            return (
              <button
                key={key}
                onClick={() => onSelect(r)}
                className="w-full grid grid-cols-[80px_1fr_90px_90px_50px_40px] gap-2 px-3 py-3 border-b last:border-b-0 hover:bg-accent/30 transition-colors text-left items-center"
              >
                <div className="font-mono text-[11px] text-foreground/80">
                  {r.requirement_id || "—"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {r.title || "Untitled"}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {r.description || ""}
                  </p>
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] uppercase border ${PRIORITY_STYLE[priority] || PRIORITY_STYLE.medium}`}
                  >
                    {priority}
                  </Badge>
                </div>
                <div>
                  <Badge variant="outline" className="text-[9px] capitalize">
                    {r.source || "—"}
                  </Badge>
                </div>
                <div className="flex justify-center">
                  <StatusIcon findings={findings} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────
function RequirementDetailDrawer({
  open,
  onClose,
  req,
  allRequirements,
}: {
  open: boolean;
  onClose: () => void;
  req: RequirementLike | null;
  allRequirements: RequirementLike[];
}) {
  if (!req) return null;
  const findings = lintRequirement(req);
  const linked = allRequirements.filter((r) => {
    const text = (r.description || "") + " " + (r.title || "");
    return req.requirement_id && text.includes(req.requirement_id) && r !== req;
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {req.requirement_id || "—"}
            </Badge>
            <Badge
              className={`text-[9px] border ${PRIORITY_STYLE[(req.priority || "medium").toLowerCase()]}`}
            >
              {(req.priority || "medium").toUpperCase()}
            </Badge>
          </div>
          <SheetTitle className="text-base mt-2">{req.title}</SheetTitle>
          <SheetDescription className="text-xs leading-relaxed">{req.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {req.acceptance_criteria && req.acceptance_criteria.length > 0 && (
            <div>
              <h5 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Acceptance Criteria
              </h5>
              <ul className="space-y-1.5">
                {req.acceptance_criteria.map((c, i) => (
                  <li key={i} className="text-xs flex gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h5 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
              Quality Analysis
            </h5>
            {findings.length === 0 ? (
              <div className="text-xs text-success flex items-center gap-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <CheckCircle2 className="h-4 w-4" /> Passes all ISO/IEC/IEEE 29148 + INCOSE checks.
              </div>
            ) : (
              <div className="space-y-2">
                {findings.map((f, i) => (
                  <div key={i} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <FindingChip f={f} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                Source
              </p>
              <p className="font-medium">{req.source || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                Reference
              </p>
              <p className="font-medium truncate">{req.source_reference || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                Type
              </p>
              <p className="font-medium capitalize">{req.type || "functional"}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                Category
              </p>
              <p className="font-medium capitalize">{req.category || "—"}</p>
            </div>
          </div>

          {linked.length > 0 && (
            <div>
              <h5 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Linked Requirements
              </h5>
              <div className="space-y-1.5">
                {linked.slice(0, 8).map((l) => (
                  <div
                    key={l.requirement_id}
                    className="flex items-center gap-2 text-xs p-2 rounded border bg-card"
                  >
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {l.requirement_id}
                    </Badge>
                    <span className="truncate">{l.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Issues panel ───────────────────────────────────────────────────────
function IssuesPanel({ content }: { content: AnalysisContent }) {
  const groups = [
    {
      key: "ambiguities",
      label: "Ambiguities",
      icon: FileWarning,
      tone: "warning",
      items: content.ambiguities,
    },
    {
      key: "contradictions",
      label: "Contradictions",
      icon: GitMerge,
      tone: "danger",
      items: content.contradictions,
    },
    {
      key: "missing_information",
      label: "Missing Information",
      icon: AlertCircle,
      tone: "danger",
      items: content.missing_information,
    },
    {
      key: "duplicates",
      label: "Duplicates",
      icon: ListTree,
      tone: "warning",
      items: content.duplicates,
    },
  ];
  return (
    <div className="space-y-3">
      {groups.map(({ key, label, icon: Icon, tone, items }) => {
        if (!items || items.length === 0) return null;
        const toneClass = tone === "danger" ? "text-destructive" : "text-warning";
        return (
          <div key={key} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
              <Icon className={`h-4 w-4 ${toneClass}`} />
              <h4 className="text-sm font-semibold">{label}</h4>
              <Badge variant="outline" className="text-[10px] ml-auto">
                {items.length}
              </Badge>
            </div>
            <div className="divide-y">
              {items.map((it: any, i: number) => (
                <div key={i} className="p-3.5">
                  <div className="flex items-start gap-2 mb-1.5">
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                      {it.id || it.ids?.join(", ") || `#${i + 1}`}
                    </Badge>
                    <p className="text-xs font-medium leading-snug">{it.description}</p>
                  </div>
                  {(it.suggested_clarification ||
                    it.suggested_resolution ||
                    it.suggested_action ||
                    it.impact) && (
                    <div className="mt-2 pl-2 border-l-2 border-primary/30 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">Suggested action: </span>
                      {it.suggested_clarification ||
                        it.suggested_resolution ||
                        it.suggested_action ||
                        it.impact}
                    </div>
                  )}
                  {it.affected_requirements && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {it.affected_requirements.map((id: string) => (
                        <Badge key={id} variant="outline" className="font-mono text-[9px]">
                          {id}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {it.between && (
                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                      {it.between.map((id: string, idx: number) => (
                        <span key={id} className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-[9px]">
                            {id}
                          </Badge>
                          {idx < it.between.length - 1 && (
                            <span className="text-muted-foreground text-[10px]">⇄</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Traceability matrix ────────────────────────────────────────────────
function TraceabilityMatrix({ content }: { content: AnalysisContent }) {
  const requirements = [
    ...(content.functional_requirements || []),
    ...(content.non_functional_requirements || []),
  ];
  const stakeholders = content.stakeholders || [];
  const risks = content.risks || [];
  const constraints = content.constraints || [];

  // Build links by simple text reference matching on requirement_id
  const linkedTo = (req: RequirementLike, items: any[]) => {
    if (!req.requirement_id) return [];
    return items.filter((it) => {
      const haystack = JSON.stringify(it).toLowerCase();
      return haystack.includes(req.requirement_id!.toLowerCase());
    });
  };

  if (requirements.length === 0) {
    return (
      <div className="text-center py-12 text-xs text-muted-foreground rounded-xl border border-dashed">
        No requirements available to build a traceability matrix.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Network className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Traceability Matrix</h4>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Mapping of each requirement to stakeholders, constraints, and risks (per ISO/IEC/IEEE
          29148 §5.2.8).
        </p>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left p-3 font-semibold">Req. ID</th>
              <th className="text-left p-3 font-semibold">Title</th>
              <th className="text-center p-3 font-semibold">Stakeholders</th>
              <th className="text-center p-3 font-semibold">Constraints</th>
              <th className="text-center p-3 font-semibold">Risks</th>
              <th className="text-center p-3 font-semibold">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((r) => {
              const stk = stakeholders.filter((s: any) =>
                JSON.stringify(s)
                  .toLowerCase()
                  .includes((r.requirement_id || "").toLowerCase()),
              );
              const cns = linkedTo(r, constraints);
              const rks = linkedTo(r, risks);
              const coverage =
                (stk.length > 0 ? 1 : 0) + (cns.length > 0 ? 1 : 0) + (rks.length > 0 ? 1 : 0);
              const coverageStyle =
                coverage >= 2
                  ? "text-success"
                  : coverage === 1
                    ? "text-warning"
                    : "text-muted-foreground";
              return (
                <tr key={r.requirement_id} className="border-b last:border-b-0 hover:bg-accent/20">
                  <td className="p-3 font-mono text-[11px]">{r.requirement_id}</td>
                  <td className="p-3 text-xs max-w-[260px] truncate">{r.title}</td>
                  <td className="p-3 text-center tabular-nums">{stk.length}</td>
                  <td className="p-3 text-center tabular-nums">{cns.length}</td>
                  <td className="p-3 text-center tabular-nums">{rks.length}</td>
                  <td className={`p-3 text-center font-semibold ${coverageStyle}`}>{coverage}/3</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────────────
export default function EnterpriseRequirementDashboard({ content }: { content: AnalysisContent }) {
  const [selected, setSelected] = useState<RequirementLike | null>(null);

  const fr = content.functional_requirements || [];
  const nfr = content.non_functional_requirements || [];
  const cons = content.constraints || [];
  const asm = content.assumptions || [];
  const allReqs = useMemo(() => [...fr, ...nfr], [fr, nfr]);

  const { perReqFindings, summary } = useMemo(() => scoreRequirements(allReqs), [allReqs]);

  const issuesCount =
    (content.ambiguities?.length || 0) +
    (content.contradictions?.length || 0) +
    (content.missing_information?.length || 0) +
    (content.duplicates?.length || 0);

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Executive header */}
        {content.system_goal && (
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">System Goal</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{content.system_goal}</p>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KPI label="Functional" value={fr.length} tone="primary" />
          <KPI label="Non-functional" value={nfr.length} tone="primary" />
          <KPI label="Constraints" value={cons.length} />
          <KPI label="Assumptions" value={asm.length} />
          <KPI
            label="Open Issues"
            value={issuesCount}
            tone={issuesCount > 0 ? "warning" : "success"}
          />
          <KPI label="Stakeholders" value={content.stakeholders?.length || 0} />
        </div>

        {/* Quality scorecard */}
        <QualityBar score={summary.score} />
        <div className="grid grid-cols-3 gap-3">
          <KPI
            label="Passing"
            value={summary.passing}
            tone="success"
            hint="0 errors / 0 warnings"
          />
          <KPI
            label="With Warnings"
            value={summary.warnings}
            tone="warning"
            hint="Non-blocking issues"
          />
          <KPI
            label="Failing"
            value={summary.failing}
            tone="danger"
            hint="Has 1+ ISO 29148 errors"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="fr" className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="fr" className="text-xs">
              Functional ({fr.length})
            </TabsTrigger>
            <TabsTrigger value="nfr" className="text-xs">
              Non-Functional ({nfr.length})
            </TabsTrigger>
            <TabsTrigger value="constraints" className="text-xs">
              Constraints ({cons.length})
            </TabsTrigger>
            <TabsTrigger value="assumptions" className="text-xs">
              Assumptions ({asm.length})
            </TabsTrigger>
            <TabsTrigger value="issues" className="text-xs">
              Issues ({issuesCount})
            </TabsTrigger>
            <TabsTrigger value="trace" className="text-xs">
              Traceability
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fr" className="mt-4">
            <RequirementGrid rows={fr} perReqFindings={perReqFindings} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="nfr" className="mt-4">
            <RequirementGrid rows={nfr} perReqFindings={perReqFindings} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="constraints" className="mt-4">
            <RequirementGrid rows={cons} perReqFindings={new Map()} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="assumptions" className="mt-4">
            <RequirementGrid rows={asm} perReqFindings={new Map()} onSelect={setSelected} />
          </TabsContent>
          <TabsContent value="issues" className="mt-4">
            <IssuesPanel content={content} />
          </TabsContent>
          <TabsContent value="trace" className="mt-4">
            <TraceabilityMatrix content={content} />
          </TabsContent>
        </Tabs>

        <RequirementDetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          req={selected}
          allRequirements={allReqs}
        />

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground border-t pt-3">
          <BookOpen className="h-3 w-3" />
          <span>
            Quality checks reference <strong>ISO/IEC/IEEE 29148:2018</strong> (Requirements
            characteristics) and the <strong>INCOSE Guide for Writing Requirements (v4)</strong>.
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
