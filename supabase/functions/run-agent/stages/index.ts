// Strategy dispatcher — resolves a stage number to its handler.
//
// Add a new stage by creating ./handlers/stage-N.ts and registering it here.
// The orchestrator and challenger driver should NEVER reach into registry.ts
// directly; go through getStageHandler() so per-stage overrides take effect.
import type { StageHandler } from "./types.ts";
import { stage2Handler } from "./handlers/stage-2.ts";
import { stage3Handler } from "./handlers/stage-3.ts";
import { stage4Handler } from "./handlers/stage-4.ts";
import { stage5Handler } from "./handlers/stage-5.ts";
import { stage6Handler } from "./handlers/stage-6.ts";
import { stage7Handler } from "./handlers/stage-7.ts";
import { stage8Handler } from "./handlers/stage-8.ts";
import { stage9Handler } from "./handlers/stage-9.ts";
import { stage10Handler } from "./handlers/stage-10.ts";
import { stage11Handler } from "./handlers/stage-11.ts";
import { stage12Handler } from "./handlers/stage-12.ts";
import { stage13Handler } from "./handlers/stage-13.ts";
import { stage14Handler } from "./handlers/stage-14.ts";
import { stage16Handler } from "./handlers/stage-16.ts";
import { stage17Handler } from "./handlers/stage-17.ts";
import { stage18Handler } from "./handlers/stage-18.ts";

const HANDLERS: Map<number, StageHandler> = new Map([
  [2, stage2Handler],
  [3, stage3Handler],
  [4, stage4Handler],
  [5, stage5Handler],
  [6, stage6Handler],
  [7, stage7Handler],
  [8, stage8Handler],
  [9, stage9Handler],
  [10, stage10Handler],
  [11, stage11Handler],
  [12, stage12Handler],
  [13, stage13Handler],
  [14, stage14Handler],
  [16, stage16Handler],
  [17, stage17Handler],
  [18, stage18Handler],
]);

export function getStageHandler(stage: number): StageHandler | null {
  return HANDLERS.get(stage) ?? null;
}

export function isChallengerStage(stage: number): boolean {
  return getStageHandler(stage)?.runsChallenger === true;
}

export type { StageHandler } from "./types.ts";
