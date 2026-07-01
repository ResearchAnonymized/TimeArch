import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Layers,
  Activity,
  Eye,
  ChevronDown,
  ChevronRight,
  Network,
  GitBranch,
  Target,
  Lock,
  Sparkles,
  RefreshCw,
  Cpu,
  Scale,
  CircleDot,
  ArrowLeftRight,
  Workflow,
  Search,
  Wrench,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ArchitecturalViewpointsPanel from "./ArchitecturalViewpointsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import DebatePanel from "./DebatePanel";
import { useDebateData } from "@/hooks/useDebateData";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { DensityText } from "./DensityControls";
import RunStageCTA from "./RunStageCTA";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import LockAdvanceBar from "./LockAdvanceBar";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

// ── Shared helpers ──────────────────────────────────
function RatingBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    strong: "bg-success/20 text-success border-success/30",
    high: "bg-success/20 text-success border-success/30",
    passed: "bg-success/20 text-success border-success/30",
    adequate: "bg-primary/20 text-primary border-primary/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    weak: "bg-destructive/20 text-destructive border-destructive/30",
    low: "bg-secondary text-muted-foreground border-border",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
    critical: "bg-destructive/20 text-destructive border-destructive/30",
    approved: "bg-success/20 text-success border-success/30",
    rejected: "bg-destructive/20 text-destructive border-destructive/30",
    needs_revision: "bg-warning/20 text-warning border-warning/30",
    approved_with_reservations: "bg-warning/20 text-warning border-warning/30",
  };
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${colors[value] || "bg-secondary text-muted-foreground border-border"}`}
    >
      {value?.replace(/_/g, " ")}
    </span>
  );
}

function ConfidenceIndicator({ level }: { level: string }) {
  const pct = level === "high" ? 90 : level === "medium" ? 60 : 30;
  const color =
    level === "high" ? "bg-success" : level === "medium" ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{level}</span>
    </div>
  );
}

// ── Component List Panel ────────────────────────────
function ComponentListPanel({ components }: { components: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!components?.length) return null;

  const typeIcons: Record<string, typeof Boxes> = {
    module: Boxes,
    service: Network,
    subsystem: Layers,
    bounded_context: CircleDot,
  };

  return (
    <div className="space-y-2">
      {components.map((c: any, i: number) => {
        const isOpen = expanded === c.name;
        const Icon = typeIcons[c.type] || Boxes;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-lg border bg-card overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : c.name)}
              className="flex items-center gap-2.5 p-3 w-full text-left hover:bg-accent/30 transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <Icon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-display font-semibold text-sm flex-1">{c.name}</span>
              <Badge variant="outline" className="text-[9px]">
                {c.type}
              </Badge>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t"
                >
                  <div className="p-3 space-y-2 text-xs">
                    {c.responsibility && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Responsibility:</span>{" "}
                        {c.responsibility}
                      </p>
                    )}
                    {c.boundaries && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Boundaries:</span>{" "}
                        {c.boundaries}
                      </p>
                    )}
                    {c.does_not_own && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Excludes:</span>{" "}
                        {c.does_not_own}
                      </p>
                    )}
                    {c.data_owned?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] text-muted-foreground mr-1">Data:</span>
                        {c.data_owned.map((d: string, j: number) => (
                          <span
                            key={j}
                            className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.dependencies?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] text-muted-foreground mr-1">Deps:</span>
                        {c.dependencies.map((d: string, j: number) => (
                          <span
                            key={j}
                            className="text-[9px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.interfaces_provided?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] text-muted-foreground mr-1">APIs:</span>
                        {c.interfaces_provided.map((iface: string, j: number) => (
                          <span
                            key={j}
                            className="text-[9px] font-mono bg-success/10 text-success px-1.5 py-0.5 rounded"
                          >
                            {iface}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.related_requirements?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[9px] text-muted-foreground mr-1">Reqs:</span>
                        {c.related_requirements.map((r: string, j: number) => (
                          <span
                            key={j}
                            className="text-[9px] font-mono bg-warning/10 text-warning px-1.5 py-0.5 rounded"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Dependency Map Panel ────────────────────────────
function DependencyMapPanel({ graph, components }: { graph: any[]; components: any[] }) {
  if (!graph?.length)
    return <p className="text-xs text-muted-foreground italic">No dependency data available.</p>;

  return (
    <div className="space-y-3">
      {/* Compact flow visualization */}
      <div className="rounded-lg border bg-card p-3 space-y-1.5">
        {graph.map((dep: any, i: number) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs py-1 hover:bg-secondary/20 rounded px-2 transition-colors"
          >
            <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded min-w-[80px] text-center">
              {dep.from}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="font-mono text-[10px] text-foreground bg-secondary px-1.5 py-0.5 rounded min-w-[80px] text-center">
              {dep.to}
            </span>
            <Badge variant="outline" className="text-[8px] ml-auto">
              {dep.type || dep.communication_pattern || "sync"}
            </Badge>
            {dep.description && (
              <span className="text-[10px] text-muted-foreground/60 hidden md:inline truncate max-w-[150px]">
                {dep.description}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Boundary Validation Panel ───────────────────────
function FixButton({
  hint,
  onFix,
  running,
}: {
  hint: string;
  onFix?: (hint: string) => void;
  running?: boolean;
}) {
  if (!onFix) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-2 text-[10px] gap-1 ml-auto"
      disabled={running}
      onClick={() => onFix(hint)}
      title="Re-run this stage with a corrective hint to address this finding"
    >
      {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
      Fix
    </Button>
  );
}

function BoundaryValidationPanel({
  content,
  onFix,
  fixing,
}: {
  content: any;
  onFix?: (hint: string) => void;
  fixing?: boolean;
}) {
  const circularCheck = content.circular_dependency_check;
  const couplingIssues = content.coupling_issues || [];
  const overlapIssues = content.overlap_issues || [];
  const missingComponents = content.missing_components || [];
  const boundaryFindings = content.boundary_validation_findings || [];

  const allIssues = [
    ...couplingIssues,
    ...overlapIssues,
    ...missingComponents,
    ...boundaryFindings,
  ];
  const hasIssues = allIssues.length > 0 || (circularCheck && !circularCheck.passed);

  const buildHint = (kind: string, issue: any, extra?: string) => {
    const label =
      typeof issue === "string"
        ? issue
        : issue.issue || issue.finding || issue.name || issue.expected || "issue";
    const components = issue.affected_components?.length
      ? ` (components: ${issue.affected_components.join(", ")})`
      : "";
    const reco = issue.recommendation ? ` Recommendation: ${issue.recommendation}.` : "";
    return `Rules-engine finding (${kind}): ${label}${components}.${reco}${extra ? " " + extra : ""} Please regenerate the decomposition specifically eliminating this issue while preserving all other valid components and dependencies.`;
  };

  return (
    <div className="space-y-4">
      {/* Circular Dependency Check */}
      {circularCheck && (
        <div
          className={`rounded-lg border p-3 ${circularCheck.passed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            {circularCheck.passed ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="font-display font-semibold text-sm">
              {circularCheck.passed ? "No Circular Dependencies" : "Circular Dependencies Detected"}
            </span>
            {!circularCheck.passed && (
              <FixButton
                running={fixing}
                onFix={onFix}
                hint={buildHint(
                  "circular_dependency",
                  {
                    issue:
                      (circularCheck.issues || []).join("; ") ||
                      "circular dependency between components",
                  },
                  "Break the cycle by introducing an interface/abstraction, splitting a component, or moving a shared responsibility into a new lower-level component.",
                )}
              />
            )}
          </div>
          {circularCheck.issues?.length > 0 && (
            <div className="mt-2 space-y-1">
              {circularCheck.issues.map((issue: string, i: number) => (
                <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {issue}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cohesion & Coupling */}
      <div className="grid grid-cols-2 gap-3">
        {content.cohesion_assessment && (
          <div className="rounded-lg border bg-card p-3">
            <h5 className="font-display font-semibold text-xs mb-1 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary" /> Cohesion
            </h5>
            <p className="text-[11px] text-muted-foreground">{content.cohesion_assessment}</p>
          </div>
        )}
        {content.coupling_assessment && (
          <div className="rounded-lg border bg-card p-3">
            <h5 className="font-display font-semibold text-xs mb-1 flex items-center gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-primary" /> Coupling
            </h5>
            <p className="text-[11px] text-muted-foreground">{content.coupling_assessment}</p>
          </div>
        )}
      </div>

      {/* Issues */}
      {hasIssues ? (
        <div className="space-y-2">
          {[...couplingIssues, ...overlapIssues, ...boundaryFindings].map(
            (issue: any, i: number) => (
              <div key={i} className="p-2.5 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                  <span className="font-display font-semibold text-xs">
                    {typeof issue === "string" ? issue : issue.issue || issue.finding}
                  </span>
                  {issue.severity && <RatingBadge value={issue.severity} />}
                  <FixButton
                    running={fixing}
                    onFix={onFix}
                    hint={buildHint("boundary_finding", issue)}
                  />
                </div>
                {issue.recommendation && (
                  <p className="text-[11px] text-muted-foreground ml-5">{issue.recommendation}</p>
                )}
                {issue.affected_components?.length > 0 && (
                  <div className="flex gap-1 mt-1 ml-5">
                    {issue.affected_components.map((c: string, j: number) => (
                      <span
                        key={j}
                        className="text-[9px] font-mono bg-warning/10 text-warning px-1.5 py-0.5 rounded"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          {missingComponents.map((mc: any, i: number) => (
            <div
              key={`mc-${i}`}
              className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/5"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <span className="font-display font-semibold text-xs">
                  {typeof mc === "string" ? mc : mc.name || mc.expected}
                </span>
                <FixButton
                  running={fixing}
                  onFix={onFix}
                  hint={buildHint(
                    "missing_component",
                    mc,
                    "Add this missing component (or equivalent) to the decomposition with a clear responsibility, owner, and dependencies.",
                  )}
                />
              </div>
              {mc.reason && <p className="text-[11px] text-muted-foreground ml-5">{mc.reason}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-display font-semibold">
            All boundary validations passed
          </span>
        </div>
      )}
    </div>
  );
}

// ── Synthetic Architect Panel ───────────────────────
function SyntheticArchitectPanel({ content }: { content: any }) {
  const review = content.synthetic_architect_review;
  if (!review) return null;

  const verdict = review.verdict || review.architect_verdict || "pending";
  const verdictColors: Record<string, string> = {
    approved: "border-success/40 bg-success/5",
    approved_with_reservations: "border-warning/40 bg-warning/5",
    rejected: "border-destructive/40 bg-destructive/5",
    needs_revision: "border-warning/40 bg-warning/5",
  };

  const verdictIcons: Record<string, typeof CheckCircle2> = {
    approved: CheckCircle2,
    approved_with_reservations: AlertTriangle,
    rejected: XCircle,
    needs_revision: RefreshCw,
  };

  const VerdictIcon = verdictIcons[verdict] || Eye;

  return (
    <div className="space-y-4">
      {/* Verdict Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border-2 p-5 ${verdictColors[verdict] || "border-border bg-card"}`}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-card border flex items-center justify-center flex-shrink-0">
            <VerdictIcon
              className={`h-5 w-5 ${verdict === "approved" ? "text-success" : verdict === "rejected" ? "text-destructive" : "text-warning"}`}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Synthetic Architect — Review Status
              </p>
            </div>
            <h3 className="font-display text-xl font-bold capitalize">
              {verdict.replace(/_/g, " ")}
            </h3>
            {review.confidence && (
              <div className="mt-2 max-w-[200px]">
                <ConfidenceIndicator level={review.confidence} />
              </div>
            )}
          </div>
        </div>
        {review.summary && <p className="text-sm text-muted-foreground mt-3">{review.summary}</p>}
      </motion.div>

      {/* Decomposition Quality */}
      {review.decomposition_quality && (
        <div className="rounded-lg border bg-card p-4">
          <h5 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" /> Decomposition Quality Assessment
          </h5>
          <p className="text-xs text-muted-foreground">{review.decomposition_quality}</p>
        </div>
      )}

      {/* Style Alignment */}
      {review.style_alignment && (
        <div className="rounded-lg border bg-card p-4">
          <h5 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Architecture Style Alignment
          </h5>
          <p className="text-xs text-muted-foreground">{review.style_alignment}</p>
        </div>
      )}

      {/* Overengineering / Underengineering */}
      <div className="grid grid-cols-2 gap-3">
        {review.overengineering_check && (
          <div
            className={`rounded-lg border p-3 ${review.overengineering_check.detected ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {review.overengineering_check.detected ? (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              )}
              <span className="font-display font-semibold text-xs">
                {review.overengineering_check.detected
                  ? "Overengineering Detected"
                  : "Not Overengineered"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {review.overengineering_check.details}
            </p>
          </div>
        )}
        {review.underengineering_check && (
          <div
            className={`rounded-lg border p-3 ${review.underengineering_check.detected ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {review.underengineering_check.detected ? (
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              )}
              <span className="font-display font-semibold text-xs">
                {review.underengineering_check.detected
                  ? "Underengineering Detected"
                  : "Not Underengineered"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {review.underengineering_check.details}
            </p>
          </div>
        )}
      </div>

      {/* Architectural Concerns */}
      {review.concerns?.length > 0 && (
        <div>
          <h5 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Architectural Concerns
          </h5>
          <div className="space-y-1.5">
            {review.concerns.map((c: any, i: number) => (
              <div key={i} className="p-2.5 rounded border bg-card">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">
                    {typeof c === "string" ? c : c.concern || c.issue}
                  </span>
                  {c.severity && <RatingBadge value={c.severity} />}
                </div>
                {c.recommendation && (
                  <p className="text-[11px] text-muted-foreground">{c.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      {review.strengths?.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h5 className="font-display font-semibold text-sm mb-2 text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Strengths
          </h5>
          {review.strengths.map((s: string, i: number) => (
            <p key={i} className="text-[11px] text-muted-foreground mb-1 flex items-start gap-1.5">
              <span className="text-success mt-0.5">✓</span>
              {s}
            </p>
          ))}
        </div>
      )}

      {/* Refinement Suggestions */}
      {review.refinement_suggestions?.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <h5 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Refinement Suggestions
          </h5>
          {review.refinement_suggestions.map((s: string, i: number) => (
            <p key={i} className="text-[11px] text-muted-foreground mb-1">
              • {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Communication & Design Patterns Panel ───────────
function CommunicationPatternsPanel({ content }: { content: any }) {
  const patterns = content.communication_patterns || [];
  const summary = content.communication_pattern_summary;
  const components = content.components || [];

  // Extract design patterns from component data
  const designPatterns: { name: string; usedBy: string[]; description: string }[] = [];
  const patternMap = new Map<string, string[]>();

  components.forEach((c: any) => {
    // Infer patterns from component types and interfaces
    if (c.type === "bounded_context") {
      const existing = patternMap.get("Domain-Driven Design (Bounded Context)") || [];
      existing.push(c.name);
      patternMap.set("Domain-Driven Design (Bounded Context)", existing);
    }
    if (c.interfaces_provided?.length > 0) {
      const existing = patternMap.get("Interface Segregation") || [];
      existing.push(c.name);
      patternMap.set("Interface Segregation", existing);
    }
    if (c.type === "service" || c.type === "module") {
      const existing =
        patternMap.get(c.type === "service" ? "Service-Oriented" : "Modular Architecture") || [];
      existing.push(c.name);
      patternMap.set(c.type === "service" ? "Service-Oriented" : "Modular Architecture", existing);
    }
  });

  // Check for async patterns
  const asyncPatterns = patterns.filter((p: any) => {
    const t = (p.pattern || p.type || "").toLowerCase();
    return t.includes("async") || t.includes("event") || t.includes("pub") || t.includes("queue");
  });
  if (asyncPatterns.length > 0) {
    patternMap.set(
      "Event-Driven / Pub-Sub",
      asyncPatterns.map((p: any) => `${p.from} → ${p.to}`),
    );
  }

  // Check for API gateway pattern
  const gatewayComponents = components.filter(
    (c: any) => c.name?.toLowerCase().includes("gateway") || c.name?.toLowerCase().includes("api"),
  );
  if (gatewayComponents.length > 0) {
    patternMap.set(
      "API Gateway",
      gatewayComponents.map((c: any) => c.name),
    );
  }

  patternMap.forEach((usedBy, name) => {
    designPatterns.push({ name, usedBy, description: getPatternDescription(name) });
  });

  if (!patterns.length && !summary && designPatterns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No communication patterns defined. Run the agent to generate patterns.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Design Patterns Detected */}
      {designPatterns.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-display font-semibold text-sm flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" /> Design Patterns Detected
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {designPatterns.map((dp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-display font-semibold text-xs text-foreground">
                    {dp.name}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{dp.description}</p>
                <div className="flex flex-wrap gap-1">
                  {dp.usedBy.slice(0, 4).map((u, j) => (
                    <span
                      key={j}
                      className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                    >
                      {u}
                    </span>
                  ))}
                  {dp.usedBy.length > 4 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{dp.usedBy.length - 4} more
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Communication Pattern Summary */}
      {summary && (
        <div className="bg-primary/5 rounded-lg p-3">
          <h5 className="font-display font-semibold text-xs mb-1">Communication Overview</h5>
          <p className="text-xs text-foreground">{summary}</p>
        </div>
      )}

      {/* Individual Communication Patterns */}
      {patterns.length > 0 && (
        <div className="space-y-2">
          <h5 className="font-display font-semibold text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" /> Inter-Component Communication
          </h5>
          {patterns.map((p: any, i: number) => (
            <div key={i} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {p.from}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] text-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {p.to}
                </span>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {p.pattern || p.type || "sync"}
                </Badge>
              </div>
              {p.description && (
                <p className="text-[11px] text-muted-foreground">{p.description}</p>
              )}
              {p.protocol && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Protocol: {p.protocol}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPatternDescription(name: string): string {
  const descriptions: Record<string, string> = {
    "Domain-Driven Design (Bounded Context)":
      "Isolates domain models within explicit boundaries, ensuring each context has its own ubiquitous language and data ownership.",
    "Interface Segregation":
      "Components expose fine-grained interfaces specific to each client, reducing coupling and unnecessary dependencies.",
    "Service-Oriented":
      "System decomposed into autonomous services with well-defined contracts and independent deployment capabilities.",
    "Modular Architecture":
      "Organized into cohesive modules with clear boundaries, internal encapsulation, and explicit public APIs.",
    "Event-Driven / Pub-Sub":
      "Components communicate through asynchronous events, enabling loose coupling and temporal decoupling.",
    "API Gateway":
      "Single entry point that routes, authenticates, and rate-limits requests to backend services.",
  };
  return (
    descriptions[name] ||
    "Architectural pattern applied to improve system structure and quality attributes."
  );
}

// ── Main Decomposition Workspace ────────────────────
function isReviewArtifact(artifact: any) {
  return (
    artifact?.generated_by?.includes("Evaluator") ||
    artifact?.generated_by?.includes("Challenger") ||
    artifact?.title?.startsWith("Evaluator Review:") ||
    artifact?.title?.startsWith("Challenger Review:")
  );
}

function isPrimaryDecompositionPayload(content: any) {
  return Boolean(
    content &&
    (Array.isArray(content.components) ||
      Array.isArray(content.dependency_graph) ||
      Array.isArray(content.communication_patterns) ||
      content.decomposition_approach ||
      content.architectural_viewpoints ||
      content.architecture_structure_summary ||
      content.summary),
  );
}

export default function DecompositionWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("components");
  const [loading, setLoading] = useState(true);

  const fetchArtifacts = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      const { data, error } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 6)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("DecompositionWorkspace fetch error:", error);
        if (!silent) setLoading(false);
        return;
      }

      setArtifacts(data || []);
      if (!silent) setLoading(false);
    },
    [projectId],
  );

  useEffect(() => {
    void fetchArtifacts();
  }, [fetchArtifacts, refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchArtifacts(true);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [fetchArtifacts]);

  const parsedArtifacts = artifacts.map((artifact) => ({
    ...artifact,
    parsedContent: recoverArtifactContent(artifact.content),
  }));

  const primaryArtifact =
    parsedArtifacts.find(
      (artifact) =>
        !isReviewArtifact(artifact) && isPrimaryDecompositionPayload(artifact.parsedContent),
    ) ||
    parsedArtifacts.find((artifact) => !isReviewArtifact(artifact) && artifact.parsedContent) ||
    parsedArtifacts.find((artifact) => isPrimaryDecompositionPayload(artifact.parsedContent)) ||
    parsedArtifacts[0];

  const content = primaryArtifact?.parsedContent;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading decomposition data…</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-12 rounded-lg border border-dashed">
        <Boxes className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-1">
          {artifacts.length > 0
            ? "A decomposition result exists, but it could not be resolved for display."
            : "No system decomposition generated yet."}
        </p>
        {artifacts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            The workspace will keep checking for the latest valid Stage 6 artifact automatically.
          </p>
        ) : (
          <RunStageCTA stageLabel="Decomposition" onRun={onRunStage} running={stageRunning} />
        )}
      </div>
    );
  }

  const components = content.components || [];
  const graph = content.dependency_graph || [];
  const hasArchitectReview = !!content.synthetic_architect_review;
  const architectVerdict =
    content.synthetic_architect_review?.verdict ||
    content.synthetic_architect_review?.architect_verdict;
  const diagrams = extractMermaidDiagrams(content);
  const hasDiagrams = diagrams.length > 0;

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[6]} title="System Decomposition" />
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-secondary/50">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-primary" />
          <span className="text-sm font-display font-semibold">{components.length} Components</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{graph.length} Dependencies</span>
        </div>
        {hasDiagrams && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">{diagrams.length} Diagrams</span>
            </div>
          </>
        )}
        {hasArchitectReview && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Architect Review:</span>
              <RatingBadge value={architectVerdict || "pending"} />
            </div>
          </>
        )}
      </div>

      {content.summary && (
        <div className="bg-primary/5 rounded-lg p-3">
          <p className="text-xs text-foreground">
            <DensityText compactLength={200}>{content.summary}</DensityText>
          </p>
        </div>
      )}

      {content.decomposition_approach && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-display font-semibold text-sm mb-1 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Decomposition Approach
          </h4>
          <p className="text-xs text-muted-foreground">{content.decomposition_approach}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full h-9 ${hasDiagrams ? "grid-cols-7" : "grid-cols-6"}`}>
          <TabsTrigger value="components" className="text-[10px] gap-1">
            <Boxes className="h-3 w-3" /> Components
          </TabsTrigger>
          {hasDiagrams && (
            <TabsTrigger value="diagrams" className="text-[10px] gap-1">
              <Eye className="h-3 w-3" /> Diagrams
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </TabsTrigger>
          )}
          <TabsTrigger value="dependencies" className="text-[10px] gap-1">
            <Network className="h-3 w-3" /> Dependencies
          </TabsTrigger>
          <TabsTrigger value="communication" className="text-[10px] gap-1">
            <Workflow className="h-3 w-3" /> Patterns
          </TabsTrigger>
          <TabsTrigger value="viewpoints" className="text-[10px] gap-1">
            <Eye className="h-3 w-3" /> Viewpoints
            {components.length > 0 && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </TabsTrigger>
          <TabsTrigger value="validation" className="text-[10px] gap-1">
            <Search className="h-3 w-3" /> Validation
          </TabsTrigger>
          <TabsTrigger
            value="architect"
            className="text-[10px] gap-1"
            disabled={!hasArchitectReview}
          >
            <Shield className="h-3 w-3" /> Architect
            {hasArchitectReview && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="mt-4">
          <ComponentListPanel components={components} />
        </TabsContent>

        {hasDiagrams && (
          <TabsContent value="diagrams" className="mt-4">
            <div className="space-y-4">
              {diagrams.map((d, i) => (
                <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="dependencies" className="mt-4">
          <DependencyMapPanel graph={graph} components={components} />
        </TabsContent>

        <TabsContent value="communication" className="mt-4">
          <CommunicationPatternsPanel content={content} />
        </TabsContent>

        <TabsContent value="validation" className="mt-4">
          <BoundaryValidationPanel
            content={content}
            fixing={stageRunning}
            onFix={onRunStage ? (hint) => onRunStage({ corrective_hint: hint }) : undefined}
          />
        </TabsContent>

        <TabsContent value="architect" className="mt-4">
          <SyntheticArchitectPanel content={content} />
        </TabsContent>

        <TabsContent value="viewpoints" className="mt-4">
          <ArchitecturalViewpointsPanel
            components={components}
            dependencyGraph={graph}
            communicationPatterns={content.communication_patterns || []}
            projectName={content.title || "System"}
            viewpointData={content.architectural_viewpoints}
          />
        </TabsContent>
      </Tabs>

      {content.architecture_structure_summary && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-display font-semibold text-sm mb-1">
            Architecture Structure Summary
          </h4>
          <p className="text-xs text-muted-foreground">{content.architecture_structure_summary}</p>
        </div>
      )}

      <DecompositionDebateWrapper projectId={projectId} refreshKey={refreshKey} />

      <CollapsibleChallengerSection
        projectId={projectId}
        stage={6}
        refreshKey={refreshKey}
        onRunStage={onRunStage}
        stageRunning={stageRunning}
        onAdvance={onAdvance}
      />

      <LockAdvanceBar
        projectId={projectId}
        stage={6}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}

function DecompositionDebateWrapper({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey?: number;
}) {
  const { challengerData, validationData, ragSources } = useDebateData(projectId, 6, refreshKey);
  if (!challengerData && !validationData) return null;
  return (
    <DebatePanel
      challengerData={challengerData}
      validationData={validationData}
      ragSources={ragSources}
      stageName="Decomposition"
    />
  );
}
