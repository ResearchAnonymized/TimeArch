// Stage 18 handler. Per-stage schema/prompt data is stored in
// ../registry.ts (the single source of truth) and exposed through this thin
// Strategy module so future stage-specific logic (custom validation, prompt
// transformations, etc.) lives in one place per stage.
import {
  TOOL_SCHEMAS,
  SYSTEM_PROMPTS,
  AGENT_NAMES,
  ARTIFACT_TYPES,
} from "../registry.ts";
import type { StageHandler } from "../types.ts";

const STAGE = 18;

export const stage18Handler: StageHandler = {
  stage: STAGE,
  agentName: AGENT_NAMES[STAGE],
  artifactType: ARTIFACT_TYPES[STAGE],
  toolSchema: TOOL_SCHEMAS[STAGE],
  systemPrompt: SYSTEM_PROMPTS[STAGE],
};
