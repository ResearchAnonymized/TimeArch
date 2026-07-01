// Shared agent state. Mirrors a LangGraph `StateGraph` channel set: every
// node reads the full state and returns a partial patch that the reducer
// merges back. Keeping the shape small + JSON-serialisable so the trace
// layer can persist every transition.

export type TraceKind = "thought" | "tool_call" | "tool_result" | "llm" | "error" | "verdict";

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
  stepIndex: number;
}

export interface CriticVerdict {
  pass: boolean;
  score: number;        // 0..1
  rubric: Record<string, { score: number; comment: string }>;
  must_fix: string[];
  rationale: string;
}

export interface AgentState {
  runId: string;
  projectId: string;
  userId: string;
  stage: number;
  goal: string;
  plan: string[];
  scratchpad: string[];
  toolCalls: ToolCallRecord[];
  artifactDraft: Record<string, unknown> | null;
  criticVerdict: CriticVerdict | null;
  iterations: number;          // critic re-plan loops
  stepIndex: number;
  tokensIn: number;
  tokensOut: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

export function initialState(args: {
  runId: string; projectId: string; userId: string; stage: number; goal: string;
}): AgentState {
  return {
    ...args,
    plan: [],
    scratchpad: [],
    toolCalls: [],
    artifactDraft: null,
    criticVerdict: null,
    iterations: 0,
    stepIndex: 0,
    tokensIn: 0,
    tokensOut: 0,
    status: "running",
  };
}
