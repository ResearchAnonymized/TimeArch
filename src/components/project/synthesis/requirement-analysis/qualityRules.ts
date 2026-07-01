// ISO/IEC/IEEE 29148 + INCOSE Guide for Writing Requirements
// Lightweight, deterministic linter that runs on each requirement.

export type QualityDimension =
  | "necessary"
  | "unambiguous"
  | "complete"
  | "consistent"
  | "verifiable"
  | "traceable"
  | "feasible"
  | "singular";

export interface QualityFinding {
  dimension: QualityDimension;
  rule: string; // Short rule name
  standard: "ISO 29148" | "INCOSE";
  severity: "error" | "warning" | "info";
  message: string;
}

export interface RequirementLike {
  id?: string;
  requirement_id?: string;
  title?: string;
  description?: string;
  priority?: string;
  acceptance_criteria?: string[] | null;
  source?: string;
  source_reference?: string;
  type?: string;
  category?: string;
}

const AMBIGUOUS_TERMS = [
  "etc",
  "and/or",
  "tbd",
  "tba",
  "as appropriate",
  "as needed",
  "user-friendly",
  "easy to use",
  "fast",
  "quick",
  "robust",
  "flexible",
  "efficient",
  "minimal",
  "maximum",
  "various",
  "several",
  "some",
  "many",
  "appropriate",
  "reasonable",
  "approximately",
  "about",
  "roughly",
];

const PASSIVE_HINTS = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/i;
const COMPOUND_HINTS = /\b(and|or)\b/i;
const MEASURABLE_HINTS =
  /\b(\d+(\.\d+)?\s*(ms|s|sec|seconds|min|minutes|hours|h|%|percent|gb|mb|kb|tps|rps|qps|users|req\/s|requests))\b/i;

export function lintRequirement(r: RequirementLike): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const text = `${r.title || ""} ${r.description || ""}`.trim();
  const desc = (r.description || "").trim();
  const lower = text.toLowerCase();

  // INCOSE R1 — Use "shall" for binding requirements
  if (desc && !/\bshall\b/i.test(desc)) {
    findings.push({
      dimension: "unambiguous",
      rule: "Use 'shall'",
      standard: "INCOSE",
      severity: "warning",
      message: "Binding requirement statements should use 'shall' (e.g. 'The system shall...').",
    });
  }

  // INCOSE R3 — Avoid ambiguous terms
  const found = AMBIGUOUS_TERMS.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(lower));
  if (found.length > 0) {
    findings.push({
      dimension: "unambiguous",
      rule: "No vague terms",
      standard: "INCOSE",
      severity: "warning",
      message: `Ambiguous wording detected: ${found.join(", ")}.`,
    });
  }

  // INCOSE R7 — Avoid passive voice
  if (desc && PASSIVE_HINTS.test(desc)) {
    findings.push({
      dimension: "unambiguous",
      rule: "Active voice",
      standard: "INCOSE",
      severity: "info",
      message: "Statement appears passive. Prefer active voice with a clear subject.",
    });
  }

  // INCOSE R18 — Singular requirement (one 'shall')
  const shallCount = (desc.match(/\bshall\b/gi) || []).length;
  if (shallCount > 1) {
    findings.push({
      dimension: "singular",
      rule: "Singular statement",
      standard: "INCOSE",
      severity: "warning",
      message: "Requirement expresses multiple obligations. Split into separate requirements.",
    });
  }

  // ISO 29148 — Verifiable: NFRs need measurable criteria
  const isNFR =
    (r.type || "").toLowerCase().includes("non") ||
    /performance|security|scalab|reliab|availab/i.test(r.category || "");
  const hasMeasure =
    MEASURABLE_HINTS.test(text) ||
    (r.acceptance_criteria && r.acceptance_criteria.some((c) => MEASURABLE_HINTS.test(c)));
  if (isNFR && !hasMeasure) {
    findings.push({
      dimension: "verifiable",
      rule: "Measurable criteria",
      standard: "ISO 29148",
      severity: "error",
      message: "Non-functional requirement lacks a quantitative, verifiable acceptance criterion.",
    });
  }

  // ISO 29148 — Complete: must have description
  if (!desc || desc.length < 20) {
    findings.push({
      dimension: "complete",
      rule: "Sufficient detail",
      standard: "ISO 29148",
      severity: "error",
      message: "Description is missing or too short to be implementable.",
    });
  }

  // ISO 29148 — Traceable: needs a stable ID
  if (!(r.requirement_id || r.id)) {
    findings.push({
      dimension: "traceable",
      rule: "Unique identifier",
      standard: "ISO 29148",
      severity: "error",
      message: "Requirement has no stable identifier for traceability.",
    });
  }

  // ISO 29148 — Necessary: source should be explicit
  if (!r.source && !r.source_reference) {
    findings.push({
      dimension: "necessary",
      rule: "Sourced",
      standard: "ISO 29148",
      severity: "info",
      message: "No source/origin recorded. Mark as explicit or inferred and reference its origin.",
    });
  }

  return findings;
}

export interface QualityScore {
  total: number;
  passing: number; // 0 errors
  warnings: number; // has warnings, no errors
  failing: number; // has at least one error
  score: number; // 0-100
  byDimension: Record<QualityDimension, { violations: number }>;
}

export function scoreRequirements(reqs: RequirementLike[]): {
  perReqFindings: Map<string, QualityFinding[]>;
  summary: QualityScore;
} {
  const perReqFindings = new Map<string, QualityFinding[]>();
  const dims: QualityDimension[] = [
    "necessary",
    "unambiguous",
    "complete",
    "consistent",
    "verifiable",
    "traceable",
    "feasible",
    "singular",
  ];
  const byDimension = Object.fromEntries(dims.map((d) => [d, { violations: 0 }])) as Record<
    QualityDimension,
    { violations: number }
  >;

  let passing = 0,
    warnings = 0,
    failing = 0;
  reqs.forEach((r) => {
    const key = r.requirement_id || r.id || `${r.title}`;
    const findings = lintRequirement(r);
    perReqFindings.set(key, findings);
    findings.forEach((f) => byDimension[f.dimension].violations++);

    const hasError = findings.some((f) => f.severity === "error");
    const hasWarn = findings.some((f) => f.severity === "warning");
    if (hasError) failing++;
    else if (hasWarn) warnings++;
    else passing++;
  });

  const total = reqs.length || 0;
  const score = total === 0 ? 0 : Math.round(((passing + warnings * 0.5) / total) * 100);

  return {
    perReqFindings,
    summary: { total, passing, warnings, failing, score, byDimension },
  };
}
