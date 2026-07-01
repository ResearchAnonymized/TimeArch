/**
 * Deterministic evidence rules for stage checklist items.
 *
 * For each (stage, checklist item id), we declare a `detect` function that
 * inspects the merged artifact content for the stage and returns an
 * EvidenceResult: { status, found[], missing[] }.
 *
 * Status semantics:
 *   - "green"  : all required signals present
 *   - "amber"  : some signals present, others missing (partial coverage)
 *   - "red"    : no signals present at all
 *   - "unknown": insufficient data to evaluate (e.g. no artifact yet)
 *
 * Rules are intentionally lenient: AI output is unstructured, so we look for
 * keywords/sections rather than exact schema paths. The deterministic layer
 * gives instant feedback; the AI verify layer (verify-checklist-item function)
 * provides semantic confirmation.
 */

import { findPathsForTerms, PathHit } from "@/lib/artifact-path-utils";

export type EvidenceStatus = "green" | "amber" | "red" | "unknown";

export interface EvidenceResult {
  status: EvidenceStatus;
  found: string[];
  missing: string[];
  /** Human pointers such as "concern_diagrams.security" with the matched term. */
  locations?: PathHit[];
  /**
   * The terms used by this detector — exposed so the checklist UI can re-scan
   * the artifact for additional contextual hits when the user opens an item.
   */
  searchTerms?: string[];
}

type Detector = (artifact: any) => EvidenceResult;

// ---------- helpers ----------

const blob = (a: any): string => {
  try {
    return JSON.stringify(a || {}).toLowerCase();
  } catch {
    return "";
  }
};

const hasAny = (text: string, terms: string[]): string[] =>
  terms.filter((t) => text.includes(t.toLowerCase()));

const ratio = (found: number, total: number): EvidenceStatus => {
  if (total === 0) return "unknown";
  if (found === 0) return "red";
  if (found >= total) return "green";
  if (found / total >= 0.5) return "amber";
  return "amber";
};

const result = (
  found: string[],
  missing: string[],
  artifact?: any,
  extraLocations?: PathHit[],
): EvidenceResult => {
  const searchTerms = [...found, ...missing];
  const locations = artifact
    ? [
        ...(extraLocations || []),
        ...findPathsForTerms(artifact, found.length ? found : searchTerms),
      ]
    : extraLocations;
  return {
    status: ratio(found.length, found.length + missing.length),
    found,
    missing,
    locations,
    searchTerms,
  };
};

const partition = (terms: string[], text: string) => {
  const found: string[] = [];
  const missing: string[] = [];
  terms.forEach((t) => (text.includes(t.toLowerCase()) ? found.push(t) : missing.push(t)));
  return { found, missing };
};

// ---------- rules ----------

export const EVIDENCE_RULES: Record<number, Record<string, Detector>> = {
  // Stage 1 — Requirement Collection
  1: {
    sources_complete: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["interview", "document", "stakeholder", "workshop", "audio", "transcript"],
        t,
      );
      return result(found, missing.slice(0, 2), a);
    },
    stakeholders_identified: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["stakeholder", "user", "operator", "owner", "concern"],
        t,
      );
      return result(found, missing, a);
    },
    scope_defined: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["scope", "boundary", "in scope", "out of scope", "context"],
        t,
      );
      return result(found, missing, a);
    },
  },
  // Stage 2 — Requirement Analysis
  2: {
    reqs_categorized: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["functional", "non_functional", "non-functional", "constraint", "category"],
        t,
      );
      return result(found, missing, a);
    },
    conflicts_resolved: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["conflict", "resolved", "ambiguity", "clarification"],
        t,
      );
      return result(found, missing, a);
    },
    priorities_set: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["critical", "high", "medium", "low", "priority"], t);
      return result(found, missing, a);
    },
    acceptance_criteria: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["acceptance", "given", "when", "then", "criteria"], t);
      return result(found, missing, a);
    },
  },
  // Stage 3 — Architecture Drivers
  3: {
    drivers_traced: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["driver", "source", "trace", "requirement"], t);
      return result(found, missing, a);
    },
    quality_attrs: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["quality attribute", "scenario", "stimulus", "response", "measure"],
        t,
      );
      return result(found, missing, a);
    },
    constraints_valid: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["constraint", "technical", "regulatory", "budget"], t);
      return result(found, missing, a);
    },
  },
  // Stage 4 — Style Selection
  4: {
    style_justified: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["recommended", "rationale", "justification", "selected"],
        t,
      );
      return result(found, missing, a);
    },
    alternatives_evaluated: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["monolith", "microservice", "modular", "layered", "event", "alternative"],
        t,
      );
      return result(found, missing.slice(0, 2), a);
    },
    suitability_reviewed: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["suitability", "matrix", "score", "rating"], t);
      return result(found, missing, a);
    },
  },
  // Stage 5 — Tradeoff Evaluation
  5: {
    tradeoffs_documented: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["tradeoff", "trade-off", "impact", "benefit", "cost"],
        t,
      );
      return result(found, missing, a);
    },
    sensitivity_points: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["sensitivity point", "tradeoff point", "decision point"],
        t,
      );
      return result(found, missing, a);
    },
    risks_acknowledged: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["risk", "mitigation", "acknowledged"], t);
      return result(found, missing, a);
    },
  },
  // Stage 6 — Decomposition
  6: {
    units_cohesive: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["responsibility", "cohesion", "module", "component", "unit"],
        t,
      );
      return result(found, missing, a);
    },
    coupling_minimal: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["coupling", "interface", "contract", "boundary"], t);
      return result(found, missing, a);
    },
    no_circular_deps: (a) => {
      const t = blob(a);
      const found: string[] = [];
      const missing: string[] = [];
      if (t.includes("dependency") || t.includes("depends on"))
        found.push("Dependency declarations present");
      else missing.push("Dependency declarations");
      if (!t.includes("circular")) found.push("No circular dependency mentions");
      else missing.push("Circular dependency cleared");
      return result(found, missing, a);
    },
    views_consistent: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["component view", "module view", "connector", "4+1"],
        t,
      );
      return result(found, missing, a);
    },
  },
  // Stage 7 — Data Architecture
  7: {
    data_model_complete: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["entity", "relationship", "attribute", "er diagram", "schema"],
        t,
      );
      return result(found, missing, a);
    },
    integrity_rules: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["constraint", "primary key", "foreign key", "integrity", "validation"],
        t,
      );
      return result(found, missing, a);
    },
    persistence_strategy: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["database", "storage", "persistence", "sql", "nosql"],
        t,
      );
      return result(found, missing.slice(0, 2), a);
    },
  },
  // Stage 8 — API & Integration
  8: {
    api_contracts: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["endpoint", "request", "response", "schema", "openapi", "graphql"],
        t,
      );
      return result(found, missing.slice(0, 3), a);
    },
    integration_patterns: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["rest", "event", "queue", "sync", "async", "pub/sub", "webhook"],
        t,
      );
      return result(found, missing.slice(0, 2), a);
    },
    error_handling: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["error", "version", "retry", "status code"], t);
      return result(found, missing, a);
    },
  },
  // Stage 9 — Cross-Cutting Concerns (the showcase stage)
  9: {
    security_addressed: (a) => {
      const t = blob(a);
      const required = ["authentication", "authorization", "encryption"];
      const { found, missing } = partition(required, t);
      // Bonus: explicit security concern_diagrams sub-tree
      const hasDiagrams = /concern_diagrams[\s\S]*security/.test(t);
      const extra: PathHit[] = hasDiagrams
        ? [{ path: "concern_diagrams.security", value: undefined, matchedTerm: "security" }]
        : [];
      return result(found, missing, a, extra);
    },
    observability_planned: (a) => {
      const t = blob(a);
      const required = ["logging", "monitoring", "tracing"];
      const { found, missing } = partition(required, t);
      const hasOtel = t.includes("opentelemetry") || t.includes("otel");
      if (hasOtel) found.push("OpenTelemetry");
      return result(found, missing, a);
    },
    resilience_patterns: (a) => {
      const t = blob(a);
      const patterns = ["circuit breaker", "retry", "bulkhead", "timeout", "fallback", "saga"];
      const { found, missing } = partition(patterns, t);
      return result(found, missing.slice(0, 3), a);
    },
  },
  // Stage 10 — Infrastructure & Deployment
  10: {
    infra_feasible: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["topology", "cloud", "region", "cost", "compute"], t);
      return result(found, missing, a);
    },
    cicd_defined: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["ci/cd", "pipeline", "build", "deploy", "quality gate"],
        t,
      );
      return result(found, missing, a);
    },
    env_parity: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["dev", "staging", "production", "parity", "environment"],
        t,
      );
      return result(found, missing, a);
    },
  },
  // Stage 11 — Quality Attributes
  11: {
    qa_scenarios: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["scenario", "stimulus", "response", "measurable", "target"],
        t,
      );
      return result(found, missing, a);
    },
    qa_coverage: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["performance", "security", "availability", "scalability", "modifiability"],
        t,
      );
      return result(found, missing.slice(0, 2), a);
    },
    qa_achievable: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["achievable", "feasible", "evaluation", "verdict"], t);
      return result(found, missing, a);
    },
  },
  // Stage 12 — Risk Assessment
  12: {
    risks_identified: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["risk", "category", "severity", "likelihood"], t);
      return result(found, missing, a);
    },
    mitigations_planned: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["mitigation", "strategy", "action", "control"], t);
      return result(found, missing, a);
    },
    risk_owners: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["owner", "responsible", "review", "timeline"], t);
      return result(found, missing, a);
    },
  },
  // Stage 13 — Validation
  13: {
    validation_complete: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["validated", "driver", "scenario", "evaluation"], t);
      return result(found, missing, a);
    },
    issues_resolved: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["issue", "resolved", "accepted", "open"], t);
      return result(found, missing, a);
    },
    peer_review: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["evaluator", "challenger", "feedback", "review"], t);
      return result(found, missing, a);
    },
  },
  // Stage 14 — Documentation & ADRs
  14: {
    adrs_complete: (a) => {
      const t = blob(a);
      const { found, missing } = partition(
        ["adr", "decision record", "context", "consequence", "status"],
        t,
      );
      return result(found, missing, a);
    },
    diagrams_accurate: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["diagram", "mermaid", "view"], t);
      return result(found, missing, a);
    },
    docs_consistent: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["section", "summary", "overview"], t);
      return result(found, missing, a);
    },
  },
  // Stage 16 — Code Generation
  16: {
    code_matches_arch: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["module", "service", "package", "structure"], t);
      return result(found, missing, a);
    },
    structure_valid: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["folder", "file", "organization"], t);
      return result(found, missing, a);
    },
  },
  // Stage 17 — Implementation Review
  17: {
    impl_reviewed: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["review", "implementation", "alignment"], t);
      return result(found, missing, a);
    },
    gaps_documented: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["gap", "deviation", "documented"], t);
      return result(found, missing, a);
    },
  },
  // Stage 18 — Architecture Evolution
  18: {
    evolution_plan: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["evolution", "roadmap", "future", "phase"], t);
      return result(found, missing, a);
    },
    tech_debt_tracked: (a) => {
      const t = blob(a);
      const { found, missing } = partition(["technical debt", "debt", "priority", "tracked"], t);
      return result(found, missing, a);
    },
  },
};

const FALLBACK_DETECTOR: Detector = (a) => {
  const t = blob(a);
  if (!t || t === "{}") return { status: "unknown", found: [], missing: ["No artifact found"] };
  return { status: "green", found: ["Artifact present"], missing: [] };
};

export function evaluateChecklistItem(
  stage: number,
  itemId: string,
  artifact: any,
): EvidenceResult {
  if (!artifact) return { status: "unknown", found: [], missing: ["No artifact generated yet"] };
  const stageRules = EVIDENCE_RULES[stage];
  const detector = stageRules?.[itemId] || FALLBACK_DETECTOR;
  try {
    return detector(artifact);
  } catch {
    return { status: "unknown", found: [], missing: ["Evaluation error"] };
  }
}

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  green: "Covered",
  amber: "Partial",
  red: "Missing",
  unknown: "Not evaluated",
};

export const STATUS_TONE: Record<EvidenceStatus, string> = {
  green: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  amber: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  red: "text-destructive bg-destructive/10 border-destructive/30",
  unknown: "text-muted-foreground bg-muted/30 border-border",
};
