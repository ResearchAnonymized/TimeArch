import type { ConcernCategory } from "./challengerHelpers";
import { normalizeCategory } from "./challengerHelpers";

/**
 * Reviewer-friendly translation layer for Challenger concerns.
 * Goal: every concern is understandable in <5 seconds.
 */

const CATEGORY_PLAIN: Record<ConcernCategory, { what: string; why: string }> = {
  scalability: {
    what: "the design may not scale cleanly as usage grows",
    why: "traffic spikes or growth could expose bottlenecks later",
  },
  performance: {
    what: "the design may respond more slowly than expected",
    why: "slow response times hurt user experience and service targets",
  },
  security: {
    what: "the design may leave a security gap",
    why: "that can increase breach, compliance, or data-loss risk",
  },
  cost: {
    what: "the design may cost more to run than needed",
    why: "higher infrastructure cost reduces efficiency and ROI",
  },
  complexity: {
    what: "the design may be more complex than it needs to be",
    why: "extra complexity slows delivery and makes mistakes more likely",
  },
  maintainability: {
    what: "the design may be harder to change later",
    why: "future work will take longer and create more technical debt",
  },
  reliability: {
    what: "the design may fail more easily under faults or pressure",
    why: "reliability issues damage uptime and trust",
  },
  operability: {
    what: "the design may be harder to run and support in production",
    why: "incidents could be slower to detect, diagnose, and recover from",
  },
  team_fit: {
    what: "the design may not fit the team's current skills or capacity",
    why: "delivery speed and implementation quality could suffer",
  },
  data: {
    what: "the data design may have an important gap",
    why: "that can create inconsistency, migration pain, or data issues",
  },
  compliance: {
    what: "the design may not fully meet policy or regulatory needs",
    why: "that can delay approval or create legal and audit risk",
  },
  other: {
    what: "something important may be missing or understated in the design",
    why: "it is worth checking before the recommendation is locked",
  },
};

export interface PlainLanguage {
  what: string;
  why: string;
  action: string;
  recommendation: "accept" | "modify" | "reject" | "review";
  recommendationReason: string;
  priorityScore: number;
}

const SEV_WEIGHT: Record<string, number> = { critical: 100, high: 70, medium: 40, low: 15 };

function evidenceStrength(evidence?: string): number {
  if (!evidence) return 0.3;
  const len = Math.min(evidence.length / 400, 1);
  const hasNumbers = /\d/.test(evidence) ? 0.15 : 0;
  const hasRefs = /(ISO|ATAM|RFC|AWS|NIST|GDPR|HIPAA|SOC ?2|PCI)/i.test(evidence) ? 0.15 : 0;
  return Math.min(1, 0.4 + len * 0.4 + hasNumbers + hasRefs);
}

/** Build a concern-specific "what this means" line by combining the
 *  category framing with a short, readable subject from the issue title. */
function buildSpecificWhat(concern: any, base: { what: string }): string {
  const issue: string = (concern?.issue || "").trim();
  if (!issue) return base.what;
  // Use first clause / first ~14 words of the issue as a subject hook.
  const firstClause = issue.split(/[.;:\u2014\u2013-]| - /)[0]!.trim();
  const words = firstClause.split(/\s+/);
  const subject = (words.length > 14 ? words.slice(0, 14).join(" ") + "…" : firstClause).replace(
    /\.$/,
    "",
  );
  // Lowercase first letter to flow inside the sentence (unless it's an acronym).
  const flow = /^[A-Z]{2,}/.test(subject)
    ? subject
    : subject.charAt(0).toLowerCase() + subject.slice(1);
  return `${base.what} — specifically, ${flow}.`;
}

export function derivePlainLanguage(concern: any): PlainLanguage {
  const cat = normalizeCategory(concern?.category);
  const sev = (concern?.severity || "medium").toLowerCase();
  const base = CATEGORY_PLAIN[cat];
  const evStrength = evidenceStrength(concern?.evidence);
  const hasAlt = !!concern?.alternative_approach;
  const specificWhat = buildSpecificWhat(concern, base);

  let recommendation: PlainLanguage["recommendation"] = "review";
  let recommendationReason = "";
  let action = "";

  if ((sev === "critical" || sev === "high") && evStrength >= 0.6) {
    if (hasAlt) {
      recommendation = "modify";
      recommendationReason = `${cap(sev)} severity with strong support and a clear alternative.`;
      action = "Revise the recommendation using the suggested alternative.";
    } else {
      recommendation = "accept";
      recommendationReason = `${cap(sev)} severity with strong support.`;
      action = "Keep this concern and send it forward for refinement.";
    }
  } else if (sev === "low" && evStrength < 0.5) {
    recommendation = "reject";
    recommendationReason = "Low severity and limited support.";
    action = "Dismiss this unless you know project context the AI missed.";
  } else if (sev === "medium") {
    recommendation = hasAlt ? "modify" : "review";
    recommendationReason = hasAlt
      ? "Medium importance with a usable alternative."
      : "Worth checking against project context.";
    action = hasAlt
      ? "Review the suggested alternative and adjust it if needed."
      : "Use your project context to decide whether this matters now.";
  } else {
    recommendation = "review";
    recommendationReason = "Mixed signals — reviewer judgment needed.";
    action = "Review the evidence and choose the most practical path.";
  }

  const priorityScore = (SEV_WEIGHT[sev] ?? 40) + evStrength * 20 + (hasAlt ? 5 : 0);

  return {
    what: specificWhat,
    why: base.why,
    action,
    recommendation,
    recommendationReason,
    priorityScore,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const RECOMMENDATION_META: Record<
  PlainLanguage["recommendation"],
  { label: string; tone: string; bg: string }
> = {
  accept: {
    label: "Best next step: Keep",
    tone: "text-success",
    bg: "bg-success/10 border-success/30",
  },
  modify: {
    label: "Best next step: Revise",
    tone: "text-primary",
    bg: "bg-primary/10 border-primary/30",
  },
  reject: {
    label: "Best next step: Dismiss",
    tone: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
  review: {
    label: "Best next step: Review",
    tone: "text-warning",
    bg: "bg-warning/10 border-warning/30",
  },
};
