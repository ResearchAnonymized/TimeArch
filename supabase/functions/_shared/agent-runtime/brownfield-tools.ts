// Brownfield-specific tools for the multi-agent runtime.
//
// Each of the 6 brownfield stages (mapping, ripple, quality, alternatives, adr,
// plan) has one dedicated `propose_<stage>_draft` tool. All stages share the
// read-side tools below (feature change, prior mappings/ripples/etc, knowledge
// search) so the Executor can gather evidence before proposing a draft that
// the Critic will score.
import { z } from "https://esm.sh/zod@3.23.8";
import type { AdminClient } from "./trace.ts";
import { Blackboard } from "./blackboard.ts";

export interface BrownfieldToolContext {
  sb: AdminClient;
  bb: Blackboard;
  projectId: string;
  featureChangeId: string;
  stageKey: BrownfieldStageKey;
}

export type BrownfieldStageKey =
  | "mapping" | "ripple" | "quality" | "alternatives" | "adr" | "plan";

export interface BrownfieldTool<Args = unknown, Result = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<Args>;
  execute: (args: Args, ctx: BrownfieldToolContext) => Promise<Result>;
}

// ── read tools ─────────────────────────────────────────────────────────────

const readFeatureChange: BrownfieldTool = {
  name: "read_feature_change",
  description: "Fetch the feature-change request (title, change_type, motivation, desired_behavior, acceptance_criteria).",
  schema: z.object({}),
  async execute(_a, { sb, featureChangeId }) {
    const { data } = await sb.from("feature_changes").select("*").eq("id", featureChangeId).maybeSingle();
    return data ?? { error: "not found" };
  },
};

const listMappings: BrownfieldTool = {
  name: "list_feature_mappings",
  description: "List architecture elements already mapped to this feature change (element_type, element_ref, relationship, confidence).",
  schema: z.object({}),
  async execute(_a, { sb, featureChangeId }) {
    const { data } = await sb.from("feature_mappings")
      .select("id, element_type, element_ref, element_label, relationship, confidence, rationale")
      .eq("feature_change_id", featureChangeId);
    return { mappings: data ?? [] };
  },
};

const listImpacts: BrownfieldTool = {
  name: "list_impact_findings",
  description: "List ripple impacts already recorded for this feature change.",
  schema: z.object({}),
  async execute(_a, { sb, featureChangeId }) {
    const { data } = await sb.from("impact_findings")
      .select("id, impacted_element_type, impacted_element_ref, classification, severity, reason, recommended_action")
      .eq("feature_change_id", featureChangeId);
    return { impacts: data ?? [] };
  },
};

const listQualityImpacts: BrownfieldTool = {
  name: "list_quality_impacts",
  description: "List per-attribute quality impact rows already recorded for this feature change.",
  schema: z.object({}),
  async execute(_a, { sb, featureChangeId }) {
    const { data } = await sb.from("quality_impact_assessments")
      .select("id, attribute, direction, severity, rationale, mitigations")
      .eq("feature_change_id", featureChangeId);
    return { quality_impacts: data ?? [] };
  },
};

const listAlternatives: BrownfieldTool = {
  name: "list_alternatives",
  description: "List architecture alternatives already generated for this feature change.",
  schema: z.object({}),
  async execute(_a, { sb, featureChangeId }) {
    const { data } = await sb.from("architecture_alternatives")
      .select("id, name, description, pros, cons, quality_scores, effort, risk, recommended")
      .eq("feature_change_id", featureChangeId);
    return { alternatives: data ?? [] };
  },
};

const listComponents: BrownfieldTool = {
  name: "list_system_components",
  description: "List the current-system components discovered by reverse-engineering (Stage 6 architecture artifact).",
  schema: z.object({}),
  async execute(_a, { sb, projectId }) {
    const { data } = await sb.from("architecture_artifacts")
      .select("content").eq("project_id", projectId).eq("stage", 6).order("created_at", { ascending: false }).limit(1);
    const components = (data?.[0]?.content as any)?.components ?? [];
    return { components };
  },
};

const listGaps: BrownfieldTool = {
  name: "list_architecture_gaps",
  description: "List open architecture gaps for this project (from gap-analyzer).",
  schema: z.object({}),
  async execute(_a, { sb, projectId }) {
    const { data } = await sb.from("architecture_gaps")
      .select("id, title, category, framework, severity, status, recommendation")
      .eq("project_id", projectId).eq("status", "open");
    return { gaps: data ?? [] };
  },
};

const listDrivers: BrownfieldTool = {
  name: "list_architecture_drivers",
  description: "List architectural drivers / quality-attribute scenarios for this project.",
  schema: z.object({}),
  async execute(_a, { sb, projectId }) {
    const { data } = await sb.from("architecture_drivers")
      .select("id, kind, priority, title, description, scenario, rationale")
      .eq("project_id", projectId);
    return { drivers: data ?? [] };
  },
};

const searchKnowledge: BrownfieldTool = {
  name: "search_knowledge",
  description: "Lexical RAG over TimeArch's curated knowledge base (ISO 25010, ATAM, ADR templates, etc.). Returns up to 5 chunks.",
  schema: z.object({
    query: z.string().min(2),
    framework: z.string().optional(),
    max_results: z.number().int().min(1).max(10).default(5),
  }),
  async execute({ query, framework, max_results }, { sb }) {
    const { data, error } = await sb.rpc("search_knowledge", {
      query_text: query,
      stage_filter: null,
      framework_filter: framework ?? null,
      max_results,
    });
    if (error) return { error: error.message, results: [] };
    return { results: data ?? [] };
  },
};

const writeBlackboard: BrownfieldTool = {
  name: "write_blackboard",
  description: "Persist an intermediate finding/note under a key for later reference in this run.",
  schema: z.object({ key: z.string().min(1).max(120), value: z.any() }),
  async execute({ key, value }, { bb }) {
    await bb.write(key, value);
    return { ok: true };
  },
};

// ── stage-specific draft tools ─────────────────────────────────────────────

const proposeMappingsDraft: BrownfieldTool = {
  name: "propose_mappings_draft",
  description: "Submit the mapping proposal. items[]: {element_type, element_ref, element_label?, relationship, confidence 0..1, rationale, evidence_refs?}. Call when done.",
  schema: z.object({
    summary: z.string().min(3),
    items: z.array(z.object({
      element_type: z.enum(["ui","api","service","domain","data","event","external","test","deploy","component"]),
      element_ref: z.string().min(1),
      element_label: z.string().optional(),
      relationship: z.enum(["touches","modifies","reads","writes","replaces","extends","removes"]),
      confidence: z.number().min(0).max(1),
      rationale: z.string().optional(),
      evidence_refs: z.array(z.any()).optional(),
    })).min(1).max(12),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true, accepted_for_review: true, count: draft.items.length };
  },
};

const proposeRippleDraft: BrownfieldTool = {
  name: "propose_ripple_draft",
  description: "Submit ripple impacts (secondary effects beyond direct mappings). items[]: {impacted_element_type, impacted_element_ref, classification, severity, reason, recommended_action, dependency_path?, evidence_refs?}.",
  schema: z.object({
    summary: z.string().min(3),
    items: z.array(z.object({
      impacted_element_type: z.string().min(1),
      impacted_element_ref: z.string().min(1),
      impacted_element_label: z.string().optional(),
      classification: z.enum(["confirmed","probable","possible","unlikely","unknown"]),
      severity: z.enum(["low","medium","high","critical"]),
      reason: z.string().optional(),
      recommended_action: z.string().optional(),
      dependency_path: z.array(z.any()).optional(),
      evidence_refs: z.array(z.any()).optional(),
    })).min(1).max(20),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true, count: draft.items.length };
  },
};

const proposeQualityDraft: BrownfieldTool = {
  name: "propose_quality_draft",
  description: "Submit per-quality-attribute impact assessment. Must cover all 8 attributes: performance, security, availability, reliability, modifiability, testability, usability, cost.",
  schema: z.object({
    summary: z.string().min(3),
    items: z.array(z.object({
      attribute: z.enum(["performance","security","availability","reliability","modifiability","testability","usability","cost"]),
      direction: z.enum(["improves","degrades","neutral"]),
      severity: z.enum(["low","medium","high","critical"]),
      rationale: z.string().min(3),
      mitigations: z.array(z.string()).optional(),
      evidence_refs: z.array(z.any()).optional(),
    })).min(8).max(8),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true, count: draft.items.length };
  },
};

const proposeAlternativesDraft: BrownfieldTool = {
  name: "propose_alternatives_draft",
  description: "Submit 2-4 distinct architecture alternatives with pros/cons/quality_scores/effort/risk. Exactly one must have recommended=true.",
  schema: z.object({
    summary: z.string().min(3),
    items: z.array(z.object({
      name: z.string().min(2),
      description: z.string().min(5),
      pros: z.array(z.string()).min(1),
      cons: z.array(z.string()).min(1),
      quality_scores: z.record(z.string(), z.number().min(1).max(5)),
      effort: z.enum(["S","M","L","XL"]),
      risk: z.enum(["low","medium","high"]),
      recommended: z.boolean(),
      evidence_refs: z.array(z.any()).optional(),
    })).min(2).max(4),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true, count: draft.items.length };
  },
};

const proposeAdrDraft: BrownfieldTool = {
  name: "propose_adr_draft",
  description: "Submit the ADR (Architecture Decision Record) for this feature change. Follows Nygard/MADR shape.",
  schema: z.object({
    title: z.string().min(5),
    status: z.enum(["proposed","accepted","superseded","deprecated"]).default("proposed"),
    context: z.string().min(20),
    decision: z.string().min(20),
    consequences: z.object({
      positive: z.array(z.string()).min(1),
      negative: z.array(z.string()).min(1),
      neutral: z.array(z.string()).optional(),
    }),
    alternatives_considered: z.array(z.object({
      name: z.string(), reason_rejected: z.string(),
    })).optional(),
    evidence_refs: z.array(z.any()).optional(),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true };
  },
};

const proposePlanDraft: BrownfieldTool = {
  name: "propose_plan_draft",
  description: "Submit 5-12 ordered work items covering prep, implementation, tests, migrations, rollout, observability, rollback.",
  schema: z.object({
    summary: z.string().min(3),
    items: z.array(z.object({
      title: z.string().min(3),
      description: z.string().min(5),
      category: z.enum(["design","implementation","migration","test","rollout","observability","documentation","rollback"]),
      priority: z.enum(["low","medium","high","critical"]),
      effort: z.enum(["S","M","L","XL"]),
      validation_criteria: z.array(z.string()).min(1),
      dependencies: z.array(z.string()).optional(),
      evidence_refs: z.array(z.any()).optional(),
    })).min(3).max(15),
  }),
  async execute(draft, { bb }) {
    await bb.write("artifact_draft", draft);
    return { ok: true, count: draft.items.length };
  },
};

// ── catalogs per stage ─────────────────────────────────────────────────────

const READ_TOOLS: BrownfieldTool[] = [
  readFeatureChange, listMappings, listImpacts, listQualityImpacts,
  listAlternatives, listComponents, listGaps, listDrivers,
  searchKnowledge, writeBlackboard,
];

export const BROWNFIELD_TOOLS: Record<BrownfieldStageKey, BrownfieldTool[]> = {
  mapping:      [...READ_TOOLS, proposeMappingsDraft],
  ripple:       [...READ_TOOLS, proposeRippleDraft],
  quality:      [...READ_TOOLS, proposeQualityDraft],
  alternatives: [...READ_TOOLS, proposeAlternativesDraft],
  adr:          [...READ_TOOLS, proposeAdrDraft],
  plan:         [...READ_TOOLS, proposePlanDraft],
};

export function toolMapFor(stageKey: BrownfieldStageKey): Record<string, BrownfieldTool> {
  return Object.fromEntries(BROWNFIELD_TOOLS[stageKey].map((t) => [t.name, t]));
}
