import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "./HelpTip";
import { CheckCircle2, Layers } from "lucide-react";
import { useDensity, type DensityLevel } from "@/contexts/DensityContext";

const DENSITY_OPTIONS: { value: DensityLevel; label: string; tip: string }[] = [
  { value: "compact", label: "Compact", tip: "Key findings only — for quick scanning" },
  { value: "standard", label: "Standard", tip: "Summary + collapsible sections" },
  { value: "detailed", label: "Detailed", tip: "Full AI output expanded" },
];

interface Stage {
  id: number;
  label: string;
  icon: LucideIcon;
  short: string;
}

interface Props {
  stage: Stage;
  completedStages: number;
}

const PHASE_META: Record<string, { label: string; color: string; bg: string }> = {
  discovery: { label: "Discovery", color: "text-cyan-500", bg: "bg-cyan-500/10" },
  definition: { label: "Requirement Definition", color: "text-blue-500", bg: "bg-blue-500/10" },
  design: { label: "Architecture Design", color: "text-violet-500", bg: "bg-violet-500/10" },
  validation: { label: "Validation & Assurance", color: "text-amber-500", bg: "bg-amber-500/10" },
  delivery: { label: "Delivery & Evolution", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

function getPhase(stageId: number) {
  if (stageId === 0) return PHASE_META.discovery;
  if (stageId <= 3) return PHASE_META.definition;
  if (stageId <= 10) return PHASE_META.design;
  if (stageId <= 14) return PHASE_META.validation;
  return PHASE_META.delivery;
}

const STAGE_GUIDANCE: Record<number, { description: string; action: string; tip: string }> = {
  0: {
    description:
      "Brownfield Discovery — upload artifacts from the existing system so TimeArch can reverse-engineer the as-is architecture.",
    action: "Upload code, OpenAPI specs, DB schemas, ADRs, or SRS documents in the Imports tab",
    tip: "Reverse-engineering agents (Milestone 2) will seed Stages 1, 6, 7, 8 and 10 with as-is artifacts marked 'needs human confirmation'.",
  },
  1: {
    description:
      "Capture functional, non-functional requirements, constraints, and assumptions for your system.",
    action: "Add requirements manually, paste documents, or describe your system in plain language",
    tip: "Use the Document tab to paste an SRS/BRD for automatic extraction, or describe your system in plain language via Free Text.",
  },
  2: {
    description: "AI analyzes requirements to identify patterns, conflicts, and gaps.",
    action: "Run the Analysis agent to process requirements",
    tip: "The agent cross-references your requirements to find ambiguities, contradictions, and missing information before design begins.",
  },
  3: {
    description: "Extract key architectural drivers — the forces that shape design decisions.",
    action: "Add drivers manually or run the Drivers agent",
    tip: "Drivers are derived from requirements and represent the primary concerns (scalability, security, compliance) that constrain architecture choices.",
  },
  4: {
    description:
      "Systematically evaluate candidate architectural styles — monolithic, modular monolith, microservices, event-driven, hexagonal — against your identified architecture drivers and constraints.",
    action: "Run the Architectural Style Recommender agent for AI-powered style evaluation",
    tip: "The recommender uses a multi-criteria suitability matrix grounded in AWS Well-Architected Framework and ISO 25010 to score each candidate style. It explicitly detects overengineering risk.",
  },
  5: {
    description:
      "Perform Architecture Tradeoff Analysis Method (ATAM)-inspired evaluation across quality attribute scenarios. Quantify sensitivity points, tradeoff points, and architectural risks.",
    action: "Run the Tradeoff Evaluation agent to generate the architecture decision matrix",
    tip: "Generates a weighted decision matrix comparing architecture alternatives across quality attributes (scalability, maintainability, security, performance). Identifies sensitivity and tradeoff points per ATAM methodology.",
  },
  6: {
    description:
      "Break the system into modules, services, or components aligned with the chosen style.",
    action: "Run Decomposition to generate the system structure",
    tip: "Produces component diagrams, responsibility assignments, and dependency graphs aligned with the selected architectural style.",
  },
  7: {
    description: "Design data models, entities, relationships, and storage strategy.",
    action: "Run Data Architecture to generate ER diagrams and models",
    tip: "Creates entity-relationship diagrams, defines data ownership per component, and recommends storage technologies based on your requirements.",
  },
  8: {
    description: "Define API endpoints, contracts, event schemas, and integration patterns.",
    action: "Run API Design to generate endpoint specifications",
    tip: "Generates REST/GraphQL/event API contracts with authentication, error handling, and pagination aligned to your decomposition.",
  },
  9: {
    description:
      "Design cross-cutting concerns: security, observability, resilience, and caching strategies.",
    action: "Run Cross-Cutting Concerns agent or manually check off items",
    tip: "Addresses system-wide concerns using industry frameworks: NIST SP 800-53 for security, OpenTelemetry for observability, and stability patterns for resilience.",
  },
  10: {
    description:
      "Define deployment topology, CI/CD pipelines, environment strategy, and scaling approach.",
    action: "Run Infrastructure agent to generate deployment architecture",
    tip: "Grounded in 12-Factor App methodology, DORA metrics, and cloud-native best practices for deployment, scaling, and operations.",
  },
  11: {
    description:
      "Evaluate quality attributes: scalability, security, performance, maintainability.",
    action: "Run Quality Attributes to generate scorecards",
    tip: "Produces a radar chart and detailed scorecard rating your architecture against ISO 25010 quality characteristics.",
  },
  12: {
    description: "Identify architectural risks, mitigations, and contingency strategies.",
    action: "Run Risk Analysis to generate the risk heat map",
    tip: "Creates a probability×impact risk matrix with specific mitigation strategies and contingency plans for each identified risk.",
  },
  13: {
    description: "Validate architecture completeness, consistency, and requirement traceability.",
    action: "Run Validation to check all governance criteria",
    tip: "Cross-checks that every requirement is addressed, all components have clear ownership, and no architectural gaps exist.",
  },
  14: {
    description: "Generate Architecture Decision Records, documentation, and executive summaries.",
    action: "Run Documentation to generate ADRs and reports",
    tip: "Produces formal ADRs following the standard template (Context → Decision → Consequences) plus an executive summary for stakeholders.",
  },
  15: {
    description: "Final review of all artifacts. Approve the architecture for code generation.",
    action: "Review all locked stages and approve the architecture",
    tip: "This is a manual governance gate. Review all generated artifacts across stages before authorizing code generation.",
  },
  16: {
    description: "Generate implementation-ready code from the approved architecture.",
    action: "Run Code Generation once architecture is approved",
    tip: "Produces scaffolding code aligned with your chosen style, decomposition, data models, and API contracts.",
  },
  17: {
    description: "Validate generated code against architecture boundaries and contracts.",
    action: "Run Code Validation to check implementation alignment",
    tip: "Checks that generated code respects module boundaries, API contracts, and data ownership rules defined in earlier stages.",
  },
  18: {
    description: "Track architecture evolution, debt, and version changes over time.",
    action: "Monitor architecture drift and plan evolution",
    tip: "Use this stage to document technical debt, plan incremental improvements, and track how the architecture evolves over time.",
  },
};

export default function StageBanner({ stage, completedStages }: Props) {
  const guidance = STAGE_GUIDANCE[stage.id];
  const isCompleted = stage.id <= completedStages;
  const StageIcon = stage.icon;
  const phase = getPhase(stage.id);
  const { density, setDensity } = useDensity();

  return (
    <motion.div
      key={stage.id}
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-xl border p-5 mb-6 relative overflow-hidden",
        isCompleted ? "bg-success/5 border-success/20" : "bg-card border-border/60",
      )}
    >
      {/* Subtle gradient accent */}
      <motion.div
        className={cn(
          "absolute top-0 left-0 w-full h-1 rounded-t-xl",
          isCompleted
            ? "bg-gradient-to-r from-success/60 to-success/20"
            : "bg-gradient-to-r from-primary/60 to-primary/10",
        )}
        initial={{ scaleX: 0, transformOrigin: "left" }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
            isCompleted
              ? "bg-success/15 border border-success/20"
              : "bg-primary/10 border border-primary/15",
          )}
        >
          <StageIcon className={cn("h-6 w-6", isCompleted ? "text-success" : "text-primary")} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <motion.div
            className="flex items-center gap-2 mb-1 flex-wrap"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                phase.bg,
                phase.color,
              )}
            >
              {phase.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Stage {String(stage.id).padStart(2, "0")} / 18
            </span>
            {isCompleted && (
              <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </span>
            )}
            {/* Density toggle */}
            <div className="ml-auto flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <div className="flex rounded-lg border border-border overflow-hidden">
                {DENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDensity(opt.value)}
                    title={opt.tip}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium transition-colors",
                      density === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
          <motion.h2
            className="font-display text-xl font-bold tracking-tight leading-tight flex items-center gap-1.5"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {stage.label}
            {guidance && <HelpTip text={guidance.tip} side="right" />}
          </motion.h2>
          {guidance && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {guidance.description}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider">
                  Action
                </span>
                <span className="text-xs text-foreground/80 font-medium">→ {guidance.action}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
