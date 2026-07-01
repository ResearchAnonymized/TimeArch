// Stage 6 handler. Per-stage schema/prompt data is stored in
// ../registry.ts (the single source of truth) and exposed through this thin
// Strategy module so future stage-specific logic (custom validation, prompt
// transformations, etc.) lives in one place per stage.
import {
  TOOL_SCHEMAS,
  SYSTEM_PROMPTS,
  AGENT_NAMES,
  ARTIFACT_TYPES,
  DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT,
} from "../registry.ts";
import type { StageHandler } from "../types.ts";

const STAGE = 6;

export const stage6Handler: StageHandler = {
  stage: STAGE,
  agentName: AGENT_NAMES[STAGE],
  artifactType: ARTIFACT_TYPES[STAGE],
  toolSchema: TOOL_SCHEMAS[STAGE],
  systemPrompt: SYSTEM_PROMPTS[STAGE],
  challengerSystemPrompt: DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT,
};
