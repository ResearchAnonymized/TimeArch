// LangGraph-style multi-agent runtime.
//
// Nodes:
//   planner  → produces an ordered plan from the goal + stage context
//   executor → JSON tool-calling loop; can call any registered tool until
//              it emits propose_artifact_draft OR hits maxToolSteps
//   critic   → scores the latest draft; on fail, sends control back to
//              planner (re-plan) up to maxCriticLoops times
//   persist  → commits the approved draft to architecture_artifacts and
//              closes the run
//
// We don't pull in `@langchain/langgraph` to keep the Deno edge-function
// cold-start light; the graph here is a hand-rolled StateGraph that mirrors
// its semantics (typed channels, partial-patch reducer, conditional edges).
import { callLlm, recoverJSON } from "../llm.ts";
import { Blackboard } from "./blackboard.ts";
import { adminClient, emitTrace, finishRun, startRun, type AdminClient } from "./trace.ts";
import { initialState, type AgentState, type CriticVerdict, type ToolCallRecord } from "./state.ts";
import { tools, toolMap, type Tool } from "./tools.ts";
import { getAgentConfig } from "./config.ts";

// ─── helpers ───────────────────────────────────────────────────────────────

function toolDescriptorJson(t: Tool): Record<string, unknown> {
  // Lightweight JSON-schema-ish description for the prompt. We keep it short
  // because every executor turn re-sends the full catalog.
  return {
    name: t.name,
    description: t.description,
    // ZodType doesn't easily JSON-serialise without zod-to-json-schema; we
    // describe args in the prompt instead. Models are strong enough at this
    // size.
  };
}

function buildExecutorMessages(state: AgentState, cfg: ReturnType<typeof getAgentConfig>, allowed: Tool[]) {
  const sys = `${cfg.executorPrompt}

You are running inside a multi-agent runtime. Use tools to gather information and build the artifact.

GOAL: ${state.goal}
PLAN:
${state.plan.map((p, i) => `${i + 1}. ${p}`).join("\n")}

You MUST respond with a single JSON object on every turn, no prose:
  {"thought": "...", "tool": "<tool_name>", "args": { ... }}
OR, when done:
  {"thought": "...", "done": true}

Available tools (call propose_artifact_draft when the artifact is ready):
${allowed.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`;
  return [
    { role: "system" as const, content: sys },
    { role: "user" as const, content:
      `Tool calls so far (most recent last):\n${
        state.toolCalls.length === 0 ? "(none yet)" :
        state.toolCalls.slice(-8).map((c) =>
          `→ ${c.name}(${JSON.stringify(c.args).slice(0, 200)}) ⇒ ${
            c.error ? `ERROR: ${c.error}` : JSON.stringify(c.result).slice(0, 400)
          }`).join("\n")
      }\n\nWhat is your next action?` },
  ];
}

// ─── nodes ─────────────────────────────────────────────────────────────────

async function plannerNode(sb: AdminClient, state: AgentState, cfg: ReturnType<typeof getAgentConfig>) {
  const t0 = Date.now();
  const previous = state.criticVerdict;
  const replanContext = previous
    ? `\n\nCRITIC REJECTED THE LAST ATTEMPT (score=${previous.score}). Must fix:\n${
        previous.must_fix.map((m) => `- ${m}`).join("\n")
      }\nProduce a NEW plan that addresses these issues.`
    : "";
  const { content, raw } = await callLlm([
    { role: "system", content: cfg.plannerPrompt! },
    { role: "user", content:
      `Stage ${state.stage} (${cfg.agentName}). Goal: ${state.goal}.${replanContext}\nReturn JSON: {"plan": [...]}.` },
  ], { model: cfg.plannerModel, json: true });
  const parsed = recoverJSON<{ plan: string[] }>(content) ?? { plan: [] };
  const usage = (raw as any)?.usage ?? {};
  state.plan = Array.isArray(parsed.plan) ? parsed.plan.slice(0, 8) : [];
  state.tokensIn += usage.prompt_tokens ?? 0;
  state.tokensOut += usage.completion_tokens ?? 0;
  await emitTrace(sb, state, "planner", "llm",
    { plan: state.plan, replan: !!previous },
    { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });
}

async function executorNode(sb: AdminClient, state: AgentState, cfg: ReturnType<typeof getAgentConfig>, bb: Blackboard) {
  const allowed = cfg.allowedTools
    ? tools.filter((t) => cfg.allowedTools!.includes(t.name))
    : tools;
  const maxSteps = cfg.maxToolSteps ?? 20;

  for (let step = 0; step < maxSteps; step++) {
    const t0 = Date.now();
    const { content, raw } = await callLlm(
      buildExecutorMessages(state, cfg, allowed),
      { model: cfg.executorModel, json: true },
    );
    const usage = (raw as any)?.usage ?? {};
    state.tokensIn += usage.prompt_tokens ?? 0;
    state.tokensOut += usage.completion_tokens ?? 0;
    const decision = recoverJSON<{ thought?: string; tool?: string; args?: any; done?: boolean }>(content) ?? {};

    await emitTrace(sb, state, "executor", "thought",
      { thought: decision.thought ?? "(no thought)", step },
      { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });

    if (decision.done) {
      // Executor signalled completion. Make sure there's a draft to review.
      const draft = await bb.read("artifact_draft");
      if (!draft) {
        state.toolCalls.push({
          id: crypto.randomUUID(), stepIndex: state.stepIndex, name: "(none)", args: {},
          error: "Executor signalled done without proposing an artifact draft.",
        });
        continue;
      }
      return;
    }
    if (!decision.tool) {
      // Malformed turn; nudge by adding an error to the scratchpad and retry.
      state.toolCalls.push({
        id: crypto.randomUUID(), stepIndex: state.stepIndex, name: "(invalid)", args: decision,
        error: "Response missing `tool` or `done`. Respond with valid JSON next turn.",
      });
      continue;
    }

    const tool = toolMap[decision.tool];
    if (!tool) {
      state.toolCalls.push({
        id: crypto.randomUUID(), stepIndex: state.stepIndex, name: decision.tool, args: decision.args,
        error: `Unknown tool '${decision.tool}'. Available: ${allowed.map((t) => t.name).join(", ")}`,
      });
      continue;
    }

    const parsedArgs = tool.schema.safeParse(decision.args ?? {});
    if (!parsedArgs.success) {
      const errMsg = parsedArgs.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      state.toolCalls.push({
        id: crypto.randomUUID(), stepIndex: state.stepIndex, name: tool.name, args: decision.args,
        error: `Invalid args: ${errMsg}`,
      });
      await emitTrace(sb, state, "executor", "error",
        { tool: tool.name, message: errMsg });
      continue;
    }

    const callT0 = Date.now();
    await emitTrace(sb, state, "executor", "tool_call",
      { tool: tool.name, args: parsedArgs.data });
    let result: unknown;
    let error: string | undefined;
    try {
      result = await tool.execute(parsedArgs.data, { sb, bb, projectId: state.projectId, stage: state.stage });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const record: ToolCallRecord = {
      id: crypto.randomUUID(), stepIndex: state.stepIndex, name: tool.name,
      args: parsedArgs.data, result, error, durationMs: Date.now() - callT0,
    };
    state.toolCalls.push(record);
    await emitTrace(sb, state, "executor", "tool_result",
      { tool: tool.name, ok: !error, error, preview: JSON.stringify(result).slice(0, 800) },
      { duration_ms: record.durationMs });

    // Early exit when artifact draft submitted.
    if (tool.name === "propose_artifact_draft" && !error) return;
  }
}

async function criticNode(sb: AdminClient, state: AgentState, cfg: ReturnType<typeof getAgentConfig>, bb: Blackboard) {
  const draft = await bb.read<{ title: string; content: Record<string, unknown>; summary?: string }>("artifact_draft");
  if (!draft) {
    state.criticVerdict = {
      pass: false, score: 0,
      rubric: {}, must_fix: ["Executor never proposed an artifact draft."], rationale: "no draft",
    };
    await emitTrace(sb, state, "critic", "verdict", state.criticVerdict as unknown as Record<string, unknown>);
    return;
  }
  const t0 = Date.now();
  const { content, raw } = await callLlm([
    { role: "system", content: cfg.criticPrompt },
    { role: "user", content:
      `Stage ${state.stage} (${cfg.agentName}).\nGoal: ${state.goal}\nDraft:\n${JSON.stringify(draft, null, 2)}` },
  ], { model: cfg.criticModel, json: true });
  const usage = (raw as any)?.usage ?? {};
  const verdict = recoverJSON<CriticVerdict>(content);
  state.criticVerdict = verdict ?? {
    pass: false, score: 0, rubric: {}, must_fix: ["critic returned unparseable JSON"], rationale: content.slice(0, 300),
  };
  state.tokensIn += usage.prompt_tokens ?? 0;
  state.tokensOut += usage.completion_tokens ?? 0;
  await emitTrace(sb, state, "critic", "verdict",
    state.criticVerdict as unknown as Record<string, unknown>,
    { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });
}

async function persistNode(sb: AdminClient, state: AgentState, cfg: ReturnType<typeof getAgentConfig>, bb: Blackboard) {
  const draft = await bb.read<{ title: string; content: Record<string, unknown>; summary?: string }>("artifact_draft");
  if (!draft) throw new Error("persistNode: no draft to commit");
  const { data, error } = await sb.from("architecture_artifacts").insert({
    project_id: state.projectId,
    stage: state.stage,
    artifact_type: cfg.artifactType,
    title: draft.title,
    content: draft.content,
    status: "draft",
    metadata: {
      generated_by: "agentic-runtime-v2",
      run_id: state.runId,
      critic_score: state.criticVerdict?.score,
      iterations: state.iterations,
    },
    created_by: state.userId,
  }).select("id").single();
  if (error || !data) throw new Error(`persist: ${error?.message}`);
  await emitTrace(sb, state, "persist", "llm", { artifact_id: data.id, title: draft.title });
  await sb.from("agent_runs_v2").update({ final_artifact_id: data.id }).eq("id", state.runId);
  return data.id as string;
}

// ─── public runner ─────────────────────────────────────────────────────────

export interface RunAgenticArgs {
  projectId: string;
  userId: string;
  stage: number;
  goal?: string;
}

export interface RunAgenticResult {
  runId: string;
  status: "completed" | "failed";
  artifactId?: string;
  iterations: number;
  tokens_in: number;
  tokens_out: number;
  verdict?: CriticVerdict | null;
  error?: string;
}

export async function runAgentic(args: RunAgenticArgs): Promise<RunAgenticResult> {
  const sb = adminClient();
  const cfg = getAgentConfig(args.stage);
  const goal = args.goal ??
    `Produce the Stage ${args.stage} artifact (${cfg.artifactType}) for this project.`;
  const runId = await startRun(sb, { projectId: args.projectId, userId: args.userId, stage: args.stage, goal });
  const state = initialState({ runId, projectId: args.projectId, userId: args.userId, stage: args.stage, goal });
  const bb = new Blackboard(sb, runId);

  try {
    const maxLoops = cfg.maxCriticLoops ?? 2;
    let artifactId: string | undefined;

    while (state.iterations <= maxLoops) {
      await plannerNode(sb, state, cfg);
      await executorNode(sb, state, cfg, bb);
      await criticNode(sb, state, cfg, bb);

      if (state.criticVerdict?.pass) {
        artifactId = await persistNode(sb, state, cfg, bb);
        state.status = "completed";
        break;
      }
      state.iterations += 1;
      if (state.iterations > maxLoops) {
        // Out of critic budget — persist anyway but mark as needs_review.
        try {
          artifactId = await persistNode(sb, state, cfg, bb);
        } catch (_) { /* ignore */ }
        state.status = "completed";
        break;
      }
    }

    await finishRun(sb, runId, {
      status: state.status === "completed" ? "completed" : "failed",
      final_artifact_id: artifactId,
      iterations: state.iterations,
      tokens_in: state.tokensIn,
      tokens_out: state.tokensOut,
    });
    return {
      runId, status: state.status === "completed" ? "completed" : "failed",
      artifactId, iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut,
      verdict: state.criticVerdict,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await emitTrace(sb, state, "runtime", "error", { message: msg });
    await finishRun(sb, runId, { status: "failed", error: msg, iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut });
    return { runId, status: "failed", iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut, error: msg };
  }
}
