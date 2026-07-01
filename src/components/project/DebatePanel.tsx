import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Swords,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "./HelpTip";
import { cn } from "@/lib/utils";
import RagSourcesPanel from "./RagSourcesPanel";

interface ChallengerConcern {
  issue: string;
  severity: string;
  evidence: string;
  alternative_approach?: string;
}

interface CounterArgument {
  claim: string;
  counter: string;
  supporting_evidence?: string;
}

interface ChallengerData {
  verdict: string;
  confidence: number;
  summary: string;
  strengths_acknowledged?: string[];
  concerns: ChallengerConcern[];
  counter_arguments: CounterArgument[];
  alternative_recommendation?: string;
  risk_blindspots?: string[];
  final_assessment: string;
  _meta?: { type: string; primary_artifact_title: string; stage: number };
}

interface ValidationData {
  tool_calling_used: boolean;
  schema_name: string;
  deterministic_checks: {
    passed: boolean;
    warnings: string[];
    errors: string[];
  };
  timestamp: string;
}

interface Props {
  challengerData: ChallengerData | null;
  validationData: ValidationData | null;
  ragSources?: any[];
  stageName: string;
}

const verdictConfig: Record<
  string,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  agree: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Agrees" },
  partially_disagree: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    label: "Partially Disagrees",
  },
  strongly_disagree: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Strongly Disagrees",
  },
};

const severityColors: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive",
  high: "bg-warning/20 text-warning",
  medium: "bg-primary/20 text-primary",
  low: "bg-secondary text-muted-foreground",
};

export default function DebatePanel({
  challengerData,
  validationData,
  ragSources,
  stageName,
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    concerns: true,
    counter_arguments: false,
    blindspots: false,
  });

  const CHALLENGER_OPEN_KEY = `debate:challenger:open:${stageName}`;
  // Collapsed by default — the full breakdown (concerns, counter-args, blindspots)
  // is already shown in the Architect Review board below. The header alone gives
  // verdict + confidence at a glance. Users can expand if they want the prose.
  const [challengerOpen, setChallengerOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem(CHALLENGER_OPEN_KEY);
    return v === "1";
  });
  const toggleChallenger = () => {
    setChallengerOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CHALLENGER_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!challengerData && !validationData && (!ragSources || ragSources.length === 0)) return null;

  const verdict = challengerData
    ? verdictConfig[challengerData.verdict] || verdictConfig.partially_disagree
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Verification Status — compact one-line bar. Expands only when there
          are warnings/errors so the workspace isn't dominated by green chips. */}
      {validationData &&
        (() => {
          const errs = validationData.deterministic_checks.errors.length;
          const warns = validationData.deterministic_checks.warnings.length;
          const allGreen =
            validationData.tool_calling_used &&
            validationData.deterministic_checks.passed &&
            errs === 0 &&
            warns === 0;
          if (allGreen) {
            return (
              <div className="flex items-center gap-2 rounded-md border bg-success/5 px-3 py-1.5 text-[11px]">
                <Shield className="h-3.5 w-3.5 text-success" />
                <span className="font-medium text-success">Verified</span>
                <span className="text-muted-foreground">
                  · structured output · {validationData.schema_name} · rules passed
                </span>
                <HelpTip text="Tool Calling produced a structured response, the schema validated, and deterministic rule checks passed." />
              </div>
            );
          }
          return (
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">Verification</span>
                <Badge variant="outline" className="text-[10px]">
                  {validationData.tool_calling_used ? "structured" : "fallback"}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {validationData.schema_name}
                </Badge>
                {errs > 0 && (
                  <Badge className="text-[10px] bg-destructive/20 text-destructive">
                    {errs} errors
                  </Badge>
                )}
                {warns > 0 && (
                  <Badge className="text-[10px] bg-warning/20 text-warning">{warns} warnings</Badge>
                )}
              </div>
              {(errs > 0 || warns > 0) && (
                <div className="space-y-1 pt-1 border-t">
                  {validationData.deterministic_checks.errors.map((err, i) => (
                    <div key={`e-${i}`} className="flex items-start gap-2 text-[11px]">
                      <XCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="text-destructive">{err}</span>
                    </div>
                  ))}
                  {validationData.deterministic_checks.warnings.map((warn, i) => (
                    <div key={`w-${i}`} className="flex items-start gap-2 text-[11px]">
                      <AlertTriangle className="h-3 w-3 text-warning mt-0.5 flex-shrink-0" />
                      <span className="text-warning">{warn}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

      {/* RAG Knowledge Sources */}
      <RagSourcesPanel sources={ragSources || []} />

      {/* Challenger Agent Panel */}
      {challengerData && verdict && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Header (click to collapse/expand) */}
          <button
            type="button"
            onClick={toggleChallenger}
            aria-expanded={challengerOpen}
            aria-controls={`debate-challenger-body-${stageName}`}
            className={cn(
              "w-full px-4 py-3 flex items-center gap-3 text-left hover:brightness-[0.98] transition-colors",
              verdict.bg,
            )}
          >
            <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
              <Swords className="h-4 w-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-display font-semibold flex items-center gap-1">
                  Challenger Architect
                  <HelpTip text="An independent AI agent that critically reviews the primary recommendation. It identifies weaknesses, proposes alternatives, and provides a confidence-scored verdict. Architects accept, reject, or modify each concern below." />
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  {stageName}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Independent critical evaluation of primary recommendation
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1.5 justify-end">
                <verdict.icon className={cn("h-4 w-4", verdict.color)} />
                <span className={cn("text-xs font-semibold", verdict.color)}>{verdict.label}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 justify-end">
                <Progress value={challengerData.confidence} className="h-1 w-16" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {challengerData.confidence}%
                </span>
              </div>
            </div>
            <span className="ml-2 flex-shrink-0 inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
              {challengerOpen ? (
                <>
                  Hide <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {challengerOpen && (
              <motion.div
                id={`debate-challenger-body-${stageName}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden border-t"
              >
                <div className="p-4 space-y-4">
                  {/* Summary */}
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs text-foreground leading-relaxed">
                      {challengerData.summary}
                    </p>
                  </div>

                  {/* Strengths Acknowledged */}
                  {challengerData.strengths_acknowledged &&
                    challengerData.strengths_acknowledged.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="text-[11px] font-display font-semibold">
                            Strengths Acknowledged
                          </span>
                        </div>
                        <div className="space-y-1 pl-4 border-l-2 border-success/30">
                          {challengerData.strengths_acknowledged.map((s, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              • {s}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Concerns */}
                  {(challengerData.concerns?.length ?? 0) > 0 && (
                    <div>
                      <button
                        onClick={() => toggleSection("concerns")}
                        className="flex items-center gap-1.5 mb-2 w-full text-left"
                      >
                        {expandedSections.concerns ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <AlertTriangle className="h-3 w-3 text-warning" />
                        <span className="text-[11px] font-display font-semibold">
                          Concerns ({challengerData.concerns?.length ?? 0})
                        </span>
                      </button>
                      {expandedSections.concerns && (
                        <div className="space-y-2 pl-4 border-l-2 border-warning/30">
                          {(challengerData.concerns ?? []).map((concern, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="rounded-md border p-3 space-y-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={cn("text-[10px]", severityColors[concern.severity])}
                                >
                                  {concern.severity}
                                </Badge>
                                <span className="text-xs font-medium">{concern.issue}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {concern.evidence}
                              </p>
                              {concern.alternative_approach && (
                                <div className="flex items-start gap-1.5 mt-1">
                                  <TrendingUp className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                  <p className="text-[11px] text-primary">
                                    {concern.alternative_approach}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Counter Arguments */}
                  {(challengerData.counter_arguments?.length ?? 0) > 0 && (
                    <div>
                      <button
                        onClick={() => toggleSection("counter_arguments")}
                        className="flex items-center gap-1.5 mb-2 w-full text-left"
                      >
                        {expandedSections.counter_arguments ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <Swords className="h-3 w-3 text-primary" />
                        <span className="text-[11px] font-display font-semibold">
                          Counter Arguments ({challengerData.counter_arguments?.length ?? 0})
                        </span>
                      </button>
                      {expandedSections.counter_arguments && (
                        <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                          {(challengerData.counter_arguments ?? []).map((arg, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="rounded-md border p-3 space-y-2"
                            >
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                                    Primary Claims
                                  </p>
                                  <p className="text-xs">{arg.claim}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-warning uppercase mb-1">
                                    Challenger Counters
                                  </p>
                                  <p className="text-xs">{arg.counter}</p>
                                </div>
                              </div>
                              {arg.supporting_evidence && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  Evidence: {arg.supporting_evidence}
                                </p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Risk Blindspots */}
                  {challengerData.risk_blindspots && challengerData.risk_blindspots.length > 0 && (
                    <div>
                      <button
                        onClick={() => toggleSection("blindspots")}
                        className="flex items-center gap-1.5 mb-2 w-full text-left"
                      >
                        {expandedSections.blindspots ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <Eye className="h-3 w-3 text-destructive" />
                        <span className="text-[11px] font-display font-semibold">
                          Risk Blindspots ({challengerData.risk_blindspots.length})
                        </span>
                      </button>
                      {expandedSections.blindspots && (
                        <div className="space-y-1 pl-4 border-l-2 border-destructive/30">
                          {challengerData.risk_blindspots.map((bs, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              • {bs}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Alternative Recommendation */}
                  {challengerData.alternative_recommendation && (
                    <div className="bg-primary/5 rounded-md p-3 border border-primary/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        <span className="text-[11px] font-display font-semibold text-primary">
                          Alternative Recommendation
                        </span>
                      </div>
                      <p className="text-xs text-foreground">
                        {challengerData.alternative_recommendation}
                      </p>
                    </div>
                  )}

                  {/* Final Assessment */}
                  <div className="bg-muted/30 rounded-md p-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Info className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-display font-semibold text-muted-foreground">
                        Final Assessment
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{challengerData.final_assessment}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
