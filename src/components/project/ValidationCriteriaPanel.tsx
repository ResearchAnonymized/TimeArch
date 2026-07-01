import { useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldCheck,
  GitBranch,
  Layers,
  Database,
  Network,
  Code2,
  Server,
  Gauge,
  Target,
  AlertTriangle,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  /** Stage this panel is rendered for. Currently only Stage 13 is supported. */
  stage?: number;
}

interface CheckSource {
  stage: number;
  label: string;
  icon: LucideIcon;
}

interface ValidationCheck {
  id: string;
  title: string;
  question: string;
  rationale: string;
  sources: CheckSource[];
}

const CHECKS: ValidationCheck[] = [
  {
    id: "requirements-coverage",
    title: "Requirements coverage",
    question:
      "Does every locked functional requirement and architectural driver map to at least one component, interface, or quality scenario?",
    rationale:
      "Flags requirements that have no architectural answer — a common cause of late-stage rework.",
    sources: [
      { stage: 1, label: "Requirements", icon: FileText },
      { stage: 2, label: "Drivers", icon: Target },
      { stage: 6, label: "Decomposition", icon: Layers },
    ],
  },
  {
    id: "style-consistency",
    title: "Style consistency",
    question:
      "Are decomposition, data, API, and infrastructure choices consistent with the selected architecture style and its trade-offs?",
    rationale:
      "Catches drift between the chosen style (Stage 4) and what the rest of the design actually implements.",
    sources: [
      { stage: 4, label: "Style recommendation", icon: GitBranch },
      { stage: 5, label: "Trade-off analysis", icon: GitBranch },
      { stage: 6, label: "Decomposition", icon: Layers },
      { stage: 10, label: "Infrastructure", icon: Server },
    ],
  },
  {
    id: "data-api-alignment",
    title: "Data ↔ API alignment",
    question:
      "Do the entities, ownership boundaries, and contracts described in the data and API designs agree with each other and with the decomposition?",
    rationale:
      "Detects shared-database anti-patterns, missing ownership, or APIs that bypass declared boundaries.",
    sources: [
      { stage: 6, label: "Decomposition", icon: Layers },
      { stage: 7, label: "Data architecture", icon: Database },
      { stage: 8, label: "API design", icon: Network },
    ],
  },
  {
    id: "cross-cutting",
    title: "Cross-cutting coverage",
    question:
      "Are security, observability, resilience, and caching concerns addressed for every unit that needs them?",
    rationale: "Surfaces components missing auth, telemetry, retry/timeout, or cache strategy.",
    sources: [
      { stage: 6, label: "Decomposition", icon: Layers },
      { stage: 9, label: "Cross-cutting concerns", icon: Code2 },
    ],
  },
  {
    id: "infra-feasibility",
    title: "Infrastructure feasibility",
    question:
      "Does the deployment topology, environment, and CI/CD plan support the declared scale, availability, and operational requirements?",
    rationale:
      "Checks that the infrastructure plan can actually deliver the quality attributes promised.",
    sources: [
      { stage: 10, label: "Infrastructure", icon: Server },
      { stage: 11, label: "Quality attributes", icon: Gauge },
    ],
  },
  {
    id: "quality-scenarios",
    title: "Quality attribute scenarios",
    question:
      "Are the prioritized quality attributes (Stage 11) traced to concrete scenarios and verifiable architectural responses?",
    rationale:
      "Prevents quality attributes from being left as adjectives ('fast', 'secure') without measurable scenarios.",
    sources: [
      { stage: 11, label: "Quality attributes", icon: Gauge },
      { stage: 6, label: "Decomposition", icon: Layers },
    ],
  },
  {
    id: "risk-mitigations",
    title: "Risk mitigation closure",
    question:
      "Does every high/critical risk from Stage 12 have a documented mitigation reflected in the design or accepted with rationale?",
    rationale: "Stops the project from advancing with unaddressed critical risks.",
    sources: [
      { stage: 12, label: "Risk analysis", icon: AlertTriangle },
      { stage: 9, label: "Cross-cutting concerns", icon: Code2 },
      { stage: 10, label: "Infrastructure", icon: Server },
    ],
  },
  {
    id: "decision-traceability",
    title: "Decision traceability",
    question:
      "Are validation findings traceable to the specific locked artifacts and ADRs they verify or contradict?",
    rationale: "Ensures the validation report cites real decisions rather than restating opinions.",
    sources: [
      { stage: 4, label: "Style decisions", icon: GitBranch },
      { stage: 6, label: "Decomposition", icon: Layers },
      { stage: 9, label: "Cross-cutting concerns", icon: Code2 },
      { stage: 10, label: "Infrastructure", icon: Server },
    ],
  },
];

/**
 * Stage 13 — Validation Criteria panel.
 *
 * Lists the explicit checks the Challenger Architect performs during
 * Architecture Validation, and maps each check to the upstream artifacts
 * it consumes. Helps users predict what the Challenger will flag and why.
 */
export default function ValidationCriteriaPanel({ stage = 13 }: Props) {
  const [open, setOpen] = useState(false);

  if (stage !== 13) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <section className="rounded-md border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
          aria-expanded={open}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Validation Criteria
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/70 hover:text-foreground transition-colors inline-flex"
                aria-label="What is the Validation Criteria panel?"
              >
                <HelpCircle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-[11px] leading-relaxed">
              <p className="font-semibold mb-1">What is this?</p>
              <p>
                The exact checks the Challenger will run during Architecture Validation, and which
                upstream stage artifacts each check draws from.
              </p>
              <p className="font-semibold mt-2 mb-1">Why it matters</p>
              <p>
                You can preview what will be inspected before running the Challenger — and trace any
                concern back to the locked decision it came from.
              </p>
            </TooltipContent>
          </Tooltip>
          <Badge variant="outline" className="text-[10px] gap-1 ml-1">
            <CheckSquare className="h-3 w-3" />
            {CHECKS.length} checks
          </Badge>
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            {open ? (
              <>
                Hide <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show details <ChevronDown className="h-3 w-3" />
              </>
            )}
          </span>
        </button>

        {open && (
          <div className="border-t px-3 py-3 space-y-2 bg-background/40">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              For each check below, the Challenger Architect inspects the listed upstream artifacts
              and reports any inconsistencies, gaps, or contradictions it finds in the Stage 13
              validation report.
            </p>

            <ul className="space-y-2">
              {CHECKS.map((check, idx) => (
                <li key={check.id} className="rounded border bg-card px-3 py-2">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-foreground">{check.title}</div>
                      <p className="text-[11px] text-foreground/80 mt-0.5 leading-relaxed">
                        {check.question}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground mt-1 leading-relaxed">
                        {check.rationale}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mr-0.5 flex items-center gap-1">
                          <GitBranch className="h-3 w-3" /> Sources:
                        </span>
                        {check.sources.map((s) => {
                          const Icon = s.icon;
                          return (
                            <Badge
                              key={`${check.id}-${s.stage}-${s.label}`}
                              variant="outline"
                              className={cn("text-[10px] gap-1 font-normal bg-muted/40")}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="font-mono text-muted-foreground">S{s.stage}</span>
                              <span>{s.label}</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t pt-2 flex items-start gap-2 text-[10.5px] text-muted-foreground leading-relaxed">
              <Layers className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                The actual artifacts loaded for the most recent run are shown in the{" "}
                <strong className="text-foreground/80">Context Trace</strong> panel above. Use both
                together to verify the Challenger had the right inputs.
              </span>
            </div>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
