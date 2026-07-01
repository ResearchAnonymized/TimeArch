// Per-stage agent configuration. Mirrors the legacy StageHandler but adds
// agentic-runtime knobs: planner/critic prompts, allowed tools, model choice,
// max critic loops. Stage 2 is the pilot; the rest fall back to the legacy
// dispatcher unless `mode: "agentic"` is set here.
import { SYSTEM_PROMPTS, AGENT_NAMES, ARTIFACT_TYPES } from "../../run-agent/stages/registry.ts";

export interface StageAgentConfig {
  stage: number;
  agentName: string;
  artifactType: string;
  /** Subset of tool names available to the executor (omit to allow all). */
  allowedTools?: string[];
  /** Planner system prompt — defaults to a generic strategy prompt. */
  plannerPrompt?: string;
  /** Executor system prompt — defaults to the legacy stage prompt. */
  executorPrompt: string;
  /** Critic rubric prompt. */
  criticPrompt: string;
  /** Pro for hard reasoning stages; Flash for the rest. */
  executorModel?: string;
  criticModel?: string;
  plannerModel?: string;
  maxCriticLoops?: number;   // default 2 (i.e. up to 3 attempts)
  maxToolSteps?: number;     // default 20
}

const GENERIC_PLANNER = `You are the PLANNER for a TimeArch software-architecture agent.
Produce a short, ordered JSON array of 3-7 atomic steps the executor should follow to deliver the stage artifact.
Each step must be specific and reference exact tools when relevant (search_knowledge, read_requirements, propose_artifact_draft, etc.).
Return ONLY a JSON object: {"plan": ["step 1", "step 2", ...]}`;

const GENERIC_CRITIC = `You are the CRITIC for a TimeArch stage artifact.
Score the draft against:
  - completeness (does it answer the stage goal?)
  - traceability (does it cite requirements/drivers/prior artifacts?)
  - rigour (is it consistent with the relevant framework — 29148/ATAM/TOGAF as applicable?)
  - clarity
Return ONLY JSON: {
  "pass": boolean, "score": 0..1,
  "rubric": { "completeness": {"score":0..1,"comment":""}, "traceability": {...}, "rigour": {...}, "clarity": {...} },
  "must_fix": ["..."], "rationale": "..."
}
Set pass=true only when score >= 0.75 AND must_fix is empty.`;

const HARD_STAGES = new Set([3, 7, 12]); // ATAM, tradeoffs, evaluation — use Pro

function configFor(stage: number): StageAgentConfig {
  return {
    stage,
    agentName: AGENT_NAMES[stage] ?? `Stage ${stage} Agent`,
    artifactType: ARTIFACT_TYPES[stage] ?? `stage_${stage}_artifact`,
    plannerPrompt: GENERIC_PLANNER,
    executorPrompt: SYSTEM_PROMPTS[stage] ??
      "You are a TimeArch stage agent. Use tools to gather inputs, then call propose_artifact_draft.",
    criticPrompt: GENERIC_CRITIC,
    executorModel: HARD_STAGES.has(stage) ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
    criticModel: HARD_STAGES.has(stage) ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
    plannerModel: "google/gemini-2.5-flash-lite",
    maxCriticLoops: 2,
    maxToolSteps: 20,
  };
}

/** Stages currently routed through the agentic runtime. */
export const AGENTIC_STAGES = new Set<number>([2, 3, 7]);

export function getAgentConfig(stage: number): StageAgentConfig {
  return configFor(stage);
}
