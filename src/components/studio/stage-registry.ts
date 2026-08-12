/**
 * Stage registry — one entry per stage of the 18-stage lifecycle.
 * Used by StudioProject to render every stage inside the same clean
 * StageShell surface.
 */

export type ProjectMode = "greenfield" | "brownfield" | "hybrid";

export interface StageMeta {
  n: number;
  phase:
    | "Discovery"
    | "Requirement Definition"
    | "Architecture Design"
    | "Validation & Assurance"
    | "Delivery & Evolution";
  title: string;
  blurb: string;
  /** Classic workspace deep-link that owns the heavy tooling for this stage. */
  classicRoute: (projectId: string) => string;
  /** Optional Studio-native route (Stage 2 has a dedicated review screen). */
  studioRoute?: (projectId: string) => string;
  tone: "primary" | "violet" | "amber" | "emerald";
  /** Which project modes this stage applies to. Undefined = all modes. */
  modes?: ProjectMode[];
}

const DISC = "Discovery" as const;
const P = "Requirement Definition" as const;
const A = "Architecture Design" as const;
const V = "Validation & Assurance" as const;
const D = "Delivery & Evolution" as const;

export const STAGES: StageMeta[] = [
  {
    n: 0,
    phase: DISC,
    title: "Discovery",
    blurb:
      "Understand the existing system before proposing changes. Ingest evidence, reverse-engineer the current architecture, and record its style, gaps, and modernization posture.",
    classicRoute: (id) => `/project/${id}`,
    tone: "amber",
    modes: ["brownfield", "hybrid"],
  },
  { n: 1, phase: P, title: "Project setup", blurb: "Give TimeArch the five essentials of your project.", classicRoute: (id) => `/project/${id}`, tone: "primary" },
  { n: 2, phase: P, title: "Requirements intake", blurb: "TimeArch has read and critiqued your requirements. Decide which are ready to move forward.", classicRoute: (id) => `/project/${id}`, studioRoute: (id) => `/studio/project/${id}/requirements`, tone: "primary" },
  { n: 3, phase: P, title: "Requirements critique", blurb: "Walk through each finding and lock the ones you agree with.", classicRoute: (id) => `/project/${id}`, studioRoute: (id) => `/studio/project/${id}/requirements`, tone: "primary" },
  { n: 4, phase: A, title: "Architecture drivers", blurb: "Identify the non-functional requirements and constraints that will shape every downstream decision.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 5, phase: A, title: "Style selection", blurb: "Choose the architecture style that best fits your drivers — microservices, layered, event-driven, or hybrid.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 6, phase: A, title: "Component design", blurb: "Decompose the system into components with clear responsibilities and boundaries.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 7, phase: A, title: "Data model", blurb: "Design the entities, relationships, and storage boundaries that fit your components.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 8, phase: A, title: "Interfaces & APIs", blurb: "Define contracts between components — REST, GraphQL, messages, and events.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 9, phase: A, title: "Cross-cutting concerns", blurb: "Design shared concerns: authentication, logging, observability, rate limiting, caching.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 10, phase: A, title: "Infrastructure", blurb: "Plan compute, network, storage, and deployment topology.", classicRoute: (id) => `/project/${id}`, tone: "violet" },
  { n: 11, phase: V, title: "ATAM evaluation", blurb: "Run an Architecture Tradeoff Analysis to surface sensitivity points and risks.", classicRoute: (id) => `/project/${id}`, tone: "amber" },
  { n: 12, phase: V, title: "Risk analysis", blurb: "Score technical, delivery, and operational risks with mitigations.", classicRoute: (id) => `/project/${id}`, tone: "amber" },
  { n: 13, phase: V, title: "Trade-off review", blurb: "Document conscious trade-offs and their rationale for future teams.", classicRoute: (id) => `/project/${id}`, tone: "amber" },
  { n: 14, phase: V, title: "Quality checklists", blurb: "Verify each quality attribute against ISO 25010 or your custom scorecard.", classicRoute: (id) => `/project/${id}`, tone: "amber" },
  { n: 15, phase: D, title: "Stakeholder approval", blurb: "Route the architecture package to stakeholders for sign-off.", classicRoute: (id) => `/project/${id}`, tone: "emerald" },
  { n: 16, phase: D, title: "Implementation plan", blurb: "Break the architecture into deliverable increments and owner assignments.", classicRoute: (id) => `/project/${id}`, tone: "emerald" },
  { n: 17, phase: D, title: "Deployment blueprint", blurb: "Publish the deployment topology, runbooks, and cutover plan.", classicRoute: (id) => `/project/${id}`, tone: "emerald" },
  { n: 18, phase: D, title: "Continuous evolution", blurb: "Track drift, decisions, and improvements across the system's life.", classicRoute: (id) => `/project/${id}`, tone: "emerald" },
];

/** Return the numbered lifecycle stages (1–18) that apply to a given project mode. */
export function stagesForMode(mode: ProjectMode | undefined): StageMeta[] {
  const m = mode ?? "greenfield";
  return STAGES.filter((s) => !s.modes || s.modes.includes(m));
}

export function getStage(n: number): StageMeta {
  return STAGES.find((s) => s.n === n) ?? STAGES.find((s) => s.n === 1)!;
}

export function kickerFor(stage: StageMeta): string {
  if (stage.n === 0) return `${stage.phase} · Brownfield entry point`;
  return `${stage.phase} · Stage ${stage.n} of 18`;
}

