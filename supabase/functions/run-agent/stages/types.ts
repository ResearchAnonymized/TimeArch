// Per-stage Strategy interface.
//
// Each handler file under ./handlers/stage-N.ts exports a `StageHandler` that
// captures everything that varies between stages: tool schema, system prompt,
// agent + artifact labels, optional challenger prompt override, and optional
// deterministic-check hook. The orchestrator (`run-agent/index.ts`) and the
// challenger driver (`lib/challenger.ts`) resolve handlers through the
// dispatcher in ./index.ts and stay stage-agnostic.

export interface StageHandler {
  stage: number;
  agentName: string;
  artifactType: string;
  toolSchema: { name: string; description: string; parameters: any };
  systemPrompt: string;
  /** If set, this stage opts in to the inline Challenger pass after generation. */
  runsChallenger?: boolean;
  /** Per-stage Scientific Challenger system prompt (defaults to the generic one). */
  challengerSystemPrompt?: string;
}
