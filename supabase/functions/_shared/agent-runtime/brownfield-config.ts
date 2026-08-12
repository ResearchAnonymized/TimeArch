// Per-stage configuration + persistence for the brownfield multi-agent runtime.
//
// The Planner/Executor/Critic prompts are stage-tailored so each agent has a
// crisp rubric. Persistence writes the reviewed draft into the correct
// destination table (feature_mappings, impact_findings, ...) — a brownfield
// stage does NOT produce a generic architecture_artifacts row.
import type { AdminClient } from "./trace.ts";
import type { BrownfieldStageKey } from "./brownfield-tools.ts";

export interface BrownfieldStageConfig {
  key: BrownfieldStageKey;
  /** Numeric stage code stored on agent_runs_v2.stage. Keeps brownfield runs
   *  distinct from the 1..18 greenfield lifecycle in the trace UI. */
  stageCode: number;
  agentName: string;
  destinationTable: string;
  plannerPrompt: string;
  executorPrompt: string;
  criticPrompt: string;
  proposeToolName: string;
  executorModel?: string;
  criticModel?: string;
  plannerModel?: string;
  maxCriticLoops?: number;
  maxToolSteps?: number;
}

const PLANNER = (goal: string) => `You are the PLANNER agent for a TimeArch brownfield stage.
Produce a 3-6 step JSON plan of atomic actions the Executor should follow to deliver: ${goal}.
Each step should name a concrete tool from the catalog when applicable
(read_feature_change, list_feature_mappings, list_impact_findings,
list_system_components, list_architecture_gaps, list_architecture_drivers,
search_knowledge, write_blackboard, then the stage's propose_..._draft).
Return ONLY: {"plan": ["step 1", ...]}`;

const CRITIC_BASE = `You are the CRITIC agent. Score the draft on:
  - completeness (does it fully answer the stage goal?)
  - traceability (does it cite the feature change, mappings, ripples, gaps, or drivers?)
  - rigour (is it consistent with ISO/IEC 25010 / ATAM / MADR where relevant?)
  - actionability (can an architect act on it as-is?)
Return ONLY JSON:
{"pass": boolean, "score": 0..1,
 "rubric": {"completeness":{"score":0..1,"comment":""}, "traceability":{...}, "rigour":{...}, "actionability":{...}},
 "must_fix": ["..."], "rationale": "..."}
Set pass=true only when score >= 0.75 AND must_fix is empty.`;

// ── configs ────────────────────────────────────────────────────────────────

export const BROWNFIELD_CONFIGS: Record<BrownfieldStageKey, BrownfieldStageConfig> = {
  mapping: {
    key: "mapping",
    stageCode: 101,
    agentName: "Feature Mapping Agent",
    destinationTable: "feature_mappings",
    proposeToolName: "propose_mappings_draft",
    plannerPrompt: PLANNER("map this feature change to the core architecture elements it directly touches"),
    executorPrompt:
`You are the EXECUTOR of the Feature Mapping stage. Your job:
1. read_feature_change → understand what is changing.
2. list_system_components → know what elements exist.
3. Optionally search_knowledge for mapping heuristics.
4. Call propose_mappings_draft with 3-8 CLASS/MODULE-level mappings ranked by confidence.
Prefer precision over recall. Do not include method-level refs — those belong in ripple.`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for mapping: reject drafts that include methods instead of classes/modules, or that duplicate rows, or exceed 12 items.`,
  },
  ripple: {
    key: "ripple",
    stageCode: 102,
    agentName: "Ripple Analysis Agent",
    destinationTable: "impact_findings",
    proposeToolName: "propose_ripple_draft",
    plannerPrompt: PLANNER("identify secondary ripple effects that follow from the direct mappings"),
    executorPrompt:
`You are the EXECUTOR of the Ripple Analysis stage.
1. read_feature_change and list_feature_mappings.
2. list_system_components and list_architecture_gaps to see neighbouring elements.
3. Call propose_ripple_draft with SECONDARY impacts (test suites, deploy/migration, downstream components, quality gaps) — do NOT repeat the direct mappings.
Classify each impact honestly (confirmed / probable / possible / unlikely / unknown).`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for ripple: reject if a draft item exactly duplicates a mapping row, or if all items are classified "confirmed" without evidence, or if severity is uniformly the same.`,
  },
  quality: {
    key: "quality",
    stageCode: 103,
    agentName: "Quality Impact Agent",
    destinationTable: "quality_impact_assessments",
    proposeToolName: "propose_quality_draft",
    plannerPrompt: PLANNER("assess the impact of the change on all 8 ISO 25010 quality attributes"),
    executorPrompt:
`You are the EXECUTOR of the Quality Impact stage (ISO/IEC 25010 + ATAM lens).
1. read_feature_change, list_feature_mappings, list_impact_findings, list_architecture_drivers.
2. Optionally search_knowledge with framework="iso_25010" or "atam".
3. Call propose_quality_draft covering ALL 8 attributes: performance, security, availability, reliability, modifiability, testability, usability, cost.
For each: direction (improves/degrades/neutral), severity, 1-2 sentence rationale, and mitigations if degrading.`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for quality: reject if fewer than 8 attributes are covered, if any severity=critical lacks mitigations, or if rationales are generic.`,
    executorModel: "google/gemini-2.5-pro",
  },
  alternatives: {
    key: "alternatives",
    stageCode: 104,
    agentName: "Alternatives Agent",
    destinationTable: "architecture_alternatives",
    proposeToolName: "propose_alternatives_draft",
    plannerPrompt: PLANNER("generate 2-4 distinct architecture alternatives covering a real trade-off spectrum"),
    executorPrompt:
`You are the EXECUTOR of the Alternatives stage.
1. read_feature_change, list_feature_mappings, list_impact_findings, list_quality_impacts, list_architecture_drivers.
2. Call propose_alternatives_draft with 2-4 GENUINELY distinct options (e.g. in-place refactor vs new service vs event-driven vs SaaS buy).
Score each on the 6 quality attributes (performance, security, availability, modifiability, cost, time_to_market) 1..5.
Mark exactly ONE as recommended=true — the best balance for the stated drivers.`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for alternatives: reject if fewer than 2 alternatives, if two are essentially the same architectural style, if quality_scores are all identical, or if the recommendation isn't justified in the description.`,
    executorModel: "google/gemini-2.5-pro",
  },
  adr: {
    key: "adr",
    stageCode: 105,
    agentName: "ADR Author Agent",
    destinationTable: "adr_records",
    proposeToolName: "propose_adr_draft",
    plannerPrompt: PLANNER("author an Architecture Decision Record that codifies the recommended alternative"),
    executorPrompt:
`You are the EXECUTOR of the ADR stage. Follow MADR / Nygard.
1. read_feature_change, list_feature_mappings, list_impact_findings, list_quality_impacts, list_alternatives.
2. Identify the recommended alternative — that is the "decision".
3. Call propose_adr_draft with title, status="proposed", context (why the change is needed + system constraints), decision (what we're choosing), consequences (positive, negative, neutral), and alternatives_considered with reason_rejected for each non-chosen option.
The context and decision fields must reference concrete elements from the mappings and ripples.`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for ADR: reject if context/decision are generic, if consequences lack negatives, if alternatives_considered is empty when list_alternatives returned >1 rows, or if the ADR doesn't cite at least one mapping element_ref.`,
    executorModel: "google/gemini-2.5-pro",
    criticModel: "google/gemini-2.5-pro",
  },
  plan: {
    key: "plan",
    stageCode: 106,
    agentName: "Implementation Planner Agent",
    destinationTable: "feature_work_items",
    proposeToolName: "propose_plan_draft",
    plannerPrompt: PLANNER("produce an ordered, testable work-item plan grounded in the ADR"),
    executorPrompt:
`You are the EXECUTOR of the Implementation Plan stage.
1. read_feature_change, list_feature_mappings, list_impact_findings, list_alternatives.
2. Call propose_plan_draft with 5-12 ordered items across categories: design, implementation, test, migration (if data changes), rollout, observability, rollback.
Every item MUST include at least one validation_criterion. Reference concrete element_refs where possible.`,
    criticPrompt: `${CRITIC_BASE}
Additional rules for plan: reject if any item lacks validation_criteria, if rollback and observability categories are missing, or if migration items are absent despite a "data" mapping row.`,
  },
};

// ── persistence ────────────────────────────────────────────────────────────

export interface PersistArgs {
  sb: AdminClient;
  projectId: string;
  featureChangeId: string;
  userId: string;
  runId: string;
  criticScore: number;
  iterations: number;
}

/** Commit the approved draft to its destination table. Returns a summary row
 *  ({ table, inserted_count, primary_id }) that the runtime records on the run. */
export async function persistBrownfieldDraft(
  cfg: BrownfieldStageConfig,
  draft: Record<string, unknown>,
  args: PersistArgs,
): Promise<{ table: string; inserted_count: number; primary_id: string | null }> {
  const { sb, projectId, featureChangeId, userId, runId, criticScore, iterations } = args;
  const meta = { generated_by: "brownfield-multi-agent", run_id: runId, critic_score: criticScore, iterations };

  switch (cfg.key) {
    case "mapping": {
      const items = (draft.items as any[]) ?? [];
      const rows = items.map((i) => ({
        project_id: projectId, feature_change_id: featureChangeId,
        element_type: i.element_type, element_ref: String(i.element_ref).slice(0, 500),
        element_label: i.element_label ?? null,
        relationship: i.relationship, confidence: i.confidence,
        rationale: i.rationale ?? null,
        // stamp run provenance into evidence_refs since feature_mappings has no metadata column
        evidence_refs: [...(i.evidence_refs ?? []), { source: "multi-agent", ...meta }],
        source: "multi-agent",
        created_by: userId,
      }));
      const { data, error } = await sb.from("feature_mappings").insert(rows).select("id");
      if (error) throw new Error(`persist mappings: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: data?.length ?? 0, primary_id: data?.[0]?.id ?? null };
    }
    case "ripple": {
      const items = (draft.items as any[]) ?? [];
      const rows = items.map((i) => ({
        project_id: projectId, feature_change_id: featureChangeId,
        impacted_element_type: i.impacted_element_type,
        impacted_element_ref: String(i.impacted_element_ref).slice(0, 500),
        impacted_element_label: i.impacted_element_label ?? null,
        classification: i.classification, severity: i.severity,
        reason: i.reason ?? null,
        dependency_path: i.dependency_path ?? [],
        recommended_action: i.recommended_action ?? null,
        evidence_refs: i.evidence_refs ?? [],
      }));
      const { data, error } = await sb.from("impact_findings").insert(rows).select("id");
      if (error) throw new Error(`persist impacts: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: data?.length ?? 0, primary_id: data?.[0]?.id ?? null };
    }
    case "quality": {
      const items = (draft.items as any[]) ?? [];
      const rows = items.map((i) => ({
        project_id: projectId, feature_change_id: featureChangeId,
        attribute: i.attribute, direction: i.direction, severity: i.severity,
        rationale: i.rationale,
        mitigations: i.mitigations ?? [],
        evidence_refs: i.evidence_refs ?? [],
      }));
      const { data, error } = await sb.from("quality_impact_assessments").insert(rows).select("id");
      if (error) throw new Error(`persist quality: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: data?.length ?? 0, primary_id: data?.[0]?.id ?? null };
    }
    case "alternatives": {
      const items = (draft.items as any[]) ?? [];
      const rows = items.map((i) => ({
        project_id: projectId, feature_change_id: featureChangeId,
        name: i.name, description: i.description,
        pros: i.pros ?? [], cons: i.cons ?? [],
        quality_scores: i.quality_scores ?? {},
        effort: i.effort, risk: i.risk,
        recommended: !!i.recommended,
        evidence_refs: i.evidence_refs ?? [],
      }));
      const { data, error } = await sb.from("architecture_alternatives").insert(rows).select("id");
      if (error) throw new Error(`persist alternatives: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: data?.length ?? 0, primary_id: data?.[0]?.id ?? null };
    }
    case "adr": {
      const d = draft as any;
      // adr_records.consequences is a plain text column — stringify structured shape.
      const consequencesText = typeof d.consequences === "string"
        ? d.consequences
        : [
            "Positive:\n" + (d.consequences?.positive ?? []).map((s: string) => `- ${s}`).join("\n"),
            "\nNegative:\n" + (d.consequences?.negative ?? []).map((s: string) => `- ${s}`).join("\n"),
            d.consequences?.neutral?.length
              ? "\nNeutral:\n" + d.consequences.neutral.map((s: string) => `- ${s}`).join("\n")
              : "",
          ].join("\n");
      const { data, error } = await sb.from("adr_records").insert({
        project_id: projectId, feature_change_id: featureChangeId,
        title: d.title, status: d.status ?? "proposed",
        context: d.context, decision: d.decision,
        consequences: consequencesText,
        alternatives_considered: d.alternatives_considered ?? [],
        evidence_refs: [...(d.evidence_refs ?? []), { source: "multi-agent", ...meta }],
        created_by: userId,
      }).select("id").single();
      if (error) throw new Error(`persist adr: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: 1, primary_id: data?.id ?? null };
    }
    case "plan": {
      const items = (draft.items as any[]) ?? [];
      const rows = items.map((i, idx) => ({
        project_id: projectId, feature_change_id: featureChangeId,
        title: i.title, description: i.description,
        category: i.category, priority: i.priority, effort: i.effort,
        validation_criteria: i.validation_criteria ?? [],
        dependencies: i.dependencies ?? [],
        evidence_refs: i.evidence_refs ?? [],
        ordering: idx + 1,
        status: "todo",
        created_by: userId,
      }));
      const { data, error } = await sb.from("feature_work_items").insert(rows).select("id");
      if (error) throw new Error(`persist plan: ${error.message}`);
      return { table: cfg.destinationTable, inserted_count: data?.length ?? 0, primary_id: data?.[0]?.id ?? null };
    }
  }
}
