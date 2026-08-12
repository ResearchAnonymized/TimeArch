// Stage 4 handler. The Studio lifecycle labels Stage 4 as Architecture
// Drivers, so this handler intentionally reuses the driver-extraction schema
// and prompt that were originally registered at Stage 3.
import {
  TOOL_SCHEMAS,
  SYSTEM_PROMPTS,
  AGENT_NAMES,
  ARTIFACT_TYPES,
} from "../registry.ts";
import type { StageHandler } from "../types.ts";

const STAGE = 4;
const DRIVER_EXTRACTION_SCHEMA_STAGE = 3;

export const stage4Handler: StageHandler = {
  stage: STAGE,
  agentName: AGENT_NAMES[DRIVER_EXTRACTION_SCHEMA_STAGE],
  artifactType: ARTIFACT_TYPES[DRIVER_EXTRACTION_SCHEMA_STAGE],
  toolSchema: TOOL_SCHEMAS[DRIVER_EXTRACTION_SCHEMA_STAGE],
  systemPrompt: SYSTEM_PROMPTS[DRIVER_EXTRACTION_SCHEMA_STAGE],
};
