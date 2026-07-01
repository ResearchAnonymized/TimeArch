// Prompt catalog + runtime resolver.
//
// Defaults live in code (each edge function imports its constant; we re-export
// them here as the single, authoritative catalog). Admin edits are stored in
// `prompt_overrides` and override the default at resolve time. Resolution is
// cached in-memory per worker for 60s to keep the hot path cheap.
//
// To register a NEW prompt:
//   1. export the constant from its module,
//   2. add a CATALOG entry below,
//   3. swap the call site to `await resolvePrompt(supabase, key, defaultText)`.
//
// The list-prompts / update-prompt edge functions use this catalog as the
// authoritative key set; the admin UI cannot edit any key that is not listed.

import { SYSTEM_PROMPTS } from "./prompt-defaults/stage-prompts.ts";
import {
  SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT,
  DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT,
  API_CHALLENGER_SYSTEM_PROMPT,
  CHALLENGER_SYSTEM_PROMPT,
} from "./prompt-defaults/challenger-prompts.ts";
import { EXTRACTION_PROMPT } from "./prompt-defaults/extraction.ts";
import { AUDIO_EXTRACTION_PROMPT } from "./prompt-defaults/audio-extraction.ts";
import { SYSTEM_PROMPT_REQUIREMENTS } from "./prompt-defaults/critic-requirements.ts";
import { SYSTEM_PROMPT_DRIVERS } from "./prompt-defaults/critic-drivers.ts";
import { REFINE_ARTIFACT_SECTION_PROMPT } from "./prompt-defaults/refine.ts";
import { VERIFY_CHECKLIST_ITEM_PROMPT } from "./prompt-defaults/verify.ts";
import { GENERATE_DOCUMENT_PROMPT } from "./prompt-defaults/generate-document.ts";
import {
  DISPOSITION_SCORECARD_PROMPT,
  DISPOSITION_COMPONENT_MAP_PROMPT,
  DISPOSITION_RATIONALE_PROMPT,
} from "./prompt-defaults/disposition.ts";

// Inline copies for prompts that live inside non-exported function-local
// constants. Keep these in sync with the source string in each edge function;
// the resolver always falls back to the runtime constant passed at the call
// site, so a drift here only affects the "Default" view in the admin UI.

const STAGE_LABELS: Record<number, string> = {
  2: "Stage 2 — Requirements Extraction & Quality Audit",
  3: "Stage 3 — Architecture Drivers & Quality Scenarios",
  4: "Stage 4 — Architecture Style Suitability",
  5: "Stage 5 — Reference Architecture Selection",
  6: "Stage 6 — System Decomposition",
  7: "Stage 7 — Architecture Design",
  8: "Stage 8 — API & Integration Design",
  9: "Stage 9 — Data Architecture",
  10: "Stage 10 — Security & Compliance",
  11: "Stage 11 — Deployment & Infrastructure",
  12: "Stage 12 — Observability & Operations",
  13: "Stage 13 — Cost & FinOps",
  14: "Stage 14 — Architecture Validation",
  16: "Stage 16 — Implementation Handoff",
  17: "Stage 17 — Verification & Acceptance",
  18: "Stage 18 — Evolution & Continuous Architecture",
};

// Phase grouping mirrors the 18-stage lifecycle (4 phases).
function phaseForStage(stage: number): string {
  if (stage <= 3) return "Phase 1 — Requirements Engineering";
  if (stage <= 9) return "Phase 2 — Architecture Design";
  if (stage <= 14) return "Phase 3 — Quality & Validation";
  return "Phase 4 — Delivery & Evolution";
}

export interface PromptCatalogEntry {
  key: string;
  title: string;
  category: string;
  description: string;
  source: string;          // file path of the runtime default
  defaultContent: string;  // current default at build time
  tags: string[];          // feature tags for filtering (phase + capability + standard)
}

// Phase tag derived from category — used as one of the chips.
function phaseTagForStage(stage: number): string {
  if (stage <= 3) return "requirements";
  if (stage <= 9) return "design";
  if (stage <= 14) return "validation";
  return "delivery";
}

// Per-stage extra capability tags (frameworks/standards/topics each stage touches).
const STAGE_EXTRA_TAGS: Record<number, string[]> = {
  2: ["extraction", "iso-29148", "incose"],
  3: ["atam", "quality-scenarios", "drivers"],
  4: ["style", "suitability"],
  5: ["reference-architecture"],
  6: ["decomposition", "ddd"],
  7: ["design", "c4"],
  8: ["api", "integration"],
  9: ["data"],
  10: ["security", "compliance", "iso-27001"],
  11: ["deployment", "infrastructure", "iac"],
  12: ["observability", "operations", "sre"],
  13: ["finops", "cost"],
  14: ["validation", "atam", "checklist"],
  16: ["handoff", "implementation"],
  17: ["verification", "acceptance"],
  18: ["evolution", "continuous-architecture"],
};

const stageEntries: PromptCatalogEntry[] = Object.entries(SYSTEM_PROMPTS).map(
  ([stageStr, content]) => {
    const stage = Number(stageStr);
    return {
      key: `stage.${stage}.system`,
      title: STAGE_LABELS[stage] ?? `Stage ${stage}`,
      category: phaseForStage(stage),
      description: `Primary agent system prompt for stage ${stage}.`,
      source: `supabase/functions/run-agent/stages/registry.ts → SYSTEM_PROMPTS[${stage}]`,
      defaultContent: content as string,
      tags: [
        phaseTagForStage(stage),
        `stage-${stage}`,
        "lifecycle-agent",
        ...(STAGE_EXTRA_TAGS[stage] ?? []),
      ],
    };
  },
);

export const PROMPT_CATALOG: PromptCatalogEntry[] = [
  ...stageEntries,
  {
    key: "challenger.scientific.system",
    title: "Scientific Challenger Architect",
    category: "Cross-Phase — Challenger Agents",
    description:
      "Independent reviewer running scientific architecture evaluation across stages without a custom challenger.",
    source: "supabase/functions/run-agent/stages/registry.ts → SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT",
    defaultContent: SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT,
    tags: ["challenger", "cross-phase", "scientific", "atam", "review"],
  },
  {
    key: "challenger.decomposition.system",
    title: "Challenger — System Decomposition (Stage 6)",
    category: "Phase 2 — Architecture Design",
    description: "Stage-6 challenger reviewing system decomposition outputs.",
    source: "supabase/functions/run-agent/stages/registry.ts → DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT",
    defaultContent: DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT,
    tags: ["challenger", "design", "stage-6", "decomposition", "review"],
  },
  {
    key: "challenger.api.system",
    title: "Challenger — API & Integration (Stage 8)",
    category: "Phase 2 — Architecture Design",
    description: "Stage-8 challenger reviewing API and integration design.",
    source: "supabase/functions/run-agent/stages/registry.ts → API_CHALLENGER_SYSTEM_PROMPT",
    defaultContent: API_CHALLENGER_SYSTEM_PROMPT,
    tags: ["challenger", "design", "stage-8", "api", "integration", "review"],
  },
  {
    key: "challenger.generic.system",
    title: "Challenger — Generic Fallback",
    category: "Cross-Phase — Challenger Agents",
    description: "Generic skeptical challenger used when no scientific variant is configured.",
    source: "supabase/functions/run-agent/stages/registry.ts → CHALLENGER_SYSTEM_PROMPT",
    defaultContent: CHALLENGER_SYSTEM_PROMPT,
    tags: ["challenger", "cross-phase", "fallback", "review"],
  },
  {
    key: "process-requirements.extraction.system",
    title: "Requirements Extraction Agent",
    category: "Phase 1 — Requirements Engineering",
    description:
      "Extracts functional, non-functional, constraints, ambiguities, etc. from free-text or document input (Stage 2 intake).",
    source: "supabase/functions/process-requirements/index.ts → EXTRACTION_PROMPT",
    defaultContent: EXTRACTION_PROMPT,
    tags: ["requirements", "extraction", "intake", "iso-29148", "incose"],
  },
  {
    key: "critic-agent.requirements.system",
    title: "Requirement Critic — ISO/IEC/IEEE 29148 + INCOSE",
    category: "Phase 1 — Requirements Engineering",
    description:
      "Reviews each extracted requirement against 29148 / INCOSE rules and returns verdicts + suggested rewrites.",
    source: "supabase/functions/critic-agent/index.ts → SYSTEM_PROMPT_REQUIREMENTS",
    defaultContent: SYSTEM_PROMPT_REQUIREMENTS,
    tags: ["requirements", "critic", "iso-29148", "incose", "review"],
  },
  {
    key: "critic-agent.drivers.system",
    title: "Driver Critic — ATAM-style",
    category: "Phase 1 — Requirements Engineering",
    description:
      "Reviews architecture drivers (QASes, constraints, business goals) for ATAM soundness.",
    source: "supabase/functions/critic-agent/index.ts → SYSTEM_PROMPT_DRIVERS",
    defaultContent: SYSTEM_PROMPT_DRIVERS,
    tags: ["requirements", "critic", "atam", "drivers", "quality-scenarios"],
  },
  {
    key: "process-audio-requirements.extraction.system",
    title: "Audio Requirements Extraction Agent",
    category: "Phase 1 — Requirements Engineering",
    description: "Extracts requirements from transcribed stakeholder audio.",
    source: "supabase/functions/process-audio-requirements/index.ts → AUDIO_EXTRACTION_PROMPT",
    defaultContent: AUDIO_EXTRACTION_PROMPT,
    tags: ["requirements", "extraction", "audio", "intake"],
  },
  {
    key: "gap-analyzer.system",
    title: "Brownfield Gap Analyzer",
    category: "Phase 1 — Requirements Engineering",
    description: "Reviews as-is system summary and emits ISO 25010 / AWS WA gaps.",
    source: "supabase/functions/gap-analyzer/index.ts (inline system message)",
    defaultContent:
      'You are an architecture reviewer. Given an as-is system summary, return ISO/IEC 25010 and AWS Well-Architected gaps as STRICT JSON: {"gaps":[{"category":"","framework":"iso_25010|aws_wa","title":"","current_state":"","target_state":"","severity":"low|medium|high|critical","effort":"low|medium|high","recommendation":""}]} — max 8 gaps, no prose.',
    tags: ["requirements", "brownfield", "discovery", "iso-25010", "aws-wa", "gap-analysis"],
  },
  {
    key: "refine-artifact-section.system",
    title: "Artifact Section Refiner",
    category: "Cross-Phase — Editing & Refinement",
    description: "Refines a selected section of an existing architecture artifact in place.",
    source: "supabase/functions/refine-artifact-section/index.ts → systemPrompt",
    defaultContent: REFINE_ARTIFACT_SECTION_PROMPT,
    tags: ["cross-phase", "refinement", "editing", "artifact"],
  },
  {
    key: "verify-checklist-item.system",
    title: "Checklist Item Verifier",
    category: "Phase 3 — Quality & Validation",
    description: "Performs rigorous architecture review for a single checklist item.",
    source: "supabase/functions/verify-checklist-item/index.ts → systemPrompt",
    defaultContent: VERIFY_CHECKLIST_ITEM_PROMPT,
    tags: ["validation", "verification", "checklist", "review"],
  },
  {
    key: "generate-document.system",
    title: "Architecture Document Generator",
    category: "Phase 4 — Delivery & Evolution",
    description: "Composes a formal end-to-end architecture document from locked artifacts.",
    source: "supabase/functions/generate-document/index.ts → systemPrompt",
    defaultContent: GENERATE_DOCUMENT_PROMPT,
    tags: ["delivery", "document", "generation", "handoff"],
  },
  {
    key: "disposition.scorecard.system",
    title: "System Disposition — Dimension Scorecard",
    category: "Phase 0 — Discovery",
    description:
      "Scores a brownfield system on the six TIME/6R dimensions (business fit, technical health, change velocity, operational cost, risk, strategic alignment).",
    source: "supabase/functions/system-disposition-analyzer/index.ts → DISPOSITION_SCORECARD_PROMPT",
    defaultContent: DISPOSITION_SCORECARD_PROMPT,
    tags: ["phase-0", "discovery", "brownfield", "modernization", "6R", "TIME", "scoring"],
  },
  {
    key: "disposition.component-map.system",
    title: "System Disposition — Component 6R Map",
    category: "Phase 0 — Discovery",
    description:
      "Assigns each component a 6R disposition (Retain/Rehost/Replatform/Refactor/Rearchitect/Rebuild/Retire) plus business-value, technical-risk and effort estimates.",
    source: "supabase/functions/system-disposition-analyzer/index.ts → DISPOSITION_COMPONENT_MAP_PROMPT",
    defaultContent: DISPOSITION_COMPONENT_MAP_PROMPT,
    tags: ["phase-0", "discovery", "brownfield", "modernization", "6R", "components"],
  },
  {
    key: "disposition.rationale.system",
    title: "System Disposition — Executive Rationale",
    category: "Phase 0 — Discovery",
    description:
      "Writes the executive summary, top drivers and sequenced roadmap for the modernize-vs-rebuild recommendation.",
    source: "supabase/functions/system-disposition-analyzer/index.ts → DISPOSITION_RATIONALE_PROMPT",
    defaultContent: DISPOSITION_RATIONALE_PROMPT,
    tags: ["phase-0", "discovery", "brownfield", "modernization", "rationale", "roadmap"],
  },
];

export const PROMPT_KEYS: Set<string> = new Set(PROMPT_CATALOG.map((p) => p.key));

// ─── Resolver (with cache) ────────────────────────────────────────────────────
type CacheEntry = { value: string | null; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function invalidatePromptCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Resolve a prompt at call time. Returns the admin override if present,
 * otherwise the provided `fallback` (the runtime default constant from the
 * caller). Cache TTL is 60s per worker.
 */
export async function resolvePrompt(
  supabase: any,
  key: string,
  fallback: string,
): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value ?? fallback;
  }
  try {
    const { data } = await supabase
      .from("prompt_overrides")
      .select("content")
      .eq("key", key)
      .maybeSingle();
    const value = data?.content ?? null;
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    return value ?? fallback;
  } catch {
    // Network/DB blip: serve fallback, don't poison cache.
    return fallback;
  }
}
