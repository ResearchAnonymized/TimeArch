// Stage 8 handler. Per-stage schema/prompt data is stored in
// ../registry.ts (the single source of truth) and exposed through this thin
// Strategy module so future stage-specific logic (custom validation, prompt
// transformations, etc.) lives in one place per stage.
import {
  TOOL_SCHEMAS,
  SYSTEM_PROMPTS,
  AGENT_NAMES,
  ARTIFACT_TYPES,
  API_CHALLENGER_SYSTEM_PROMPT,
} from "../registry.ts";
import type { StageHandler } from "../types.ts";

const STAGE = 8;

export const stage8Handler: StageHandler = {
  stage: STAGE,
  agentName: AGENT_NAMES[STAGE],
  artifactType: ARTIFACT_TYPES[STAGE],
  toolSchema: TOOL_SCHEMAS[STAGE],
  systemPrompt: SYSTEM_PROMPTS[STAGE],
  challengerSystemPrompt: API_CHALLENGER_SYSTEM_PROMPT,
};
