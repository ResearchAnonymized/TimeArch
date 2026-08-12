// Brownfield multi-agent runtime (Planner → Executor → Critic → Persist).
//
// Same node semantics as the greenfield agent-runtime (graph.ts) but with:
//   - a brownfield-tailored tool catalog per stage (brownfield-tools.ts)
//   - context that includes the feature_change_id, not just project_id
//   - a per-stage persist function that writes to the correct destination
//     table (feature_mappings, impact_findings, quality_impact_assessments,
//     architecture_alternatives, adr_records, feature_work_items) rather than
//     the generic architecture_artifacts table.
//
// Traces land on `agent_trace_steps` and runs on `agent_runs_v2` so the
// existing AgentTracePanel renders them without changes.
import { callLlm, recoverJSON } from "../llm.ts";
import { Blackboard } from "./blackboard.ts";
import { adminClient, emitTrace, finishRun, startRun, type AdminClient } from "./trace.ts";
import { initialState, type AgentState, type CriticVerdict, type ToolCallRecord } from "./state.ts";
import { BROWNFIELD_TOOLS, toolMapFor, type BrownfieldStageKey, type BrownfieldTool } from "./brownfield-tools.ts";
import { BROWNFIELD_CONFIGS, persistBrownfieldDraft, type BrownfieldStageConfig } from "./brownfield-config.ts";

// ─── helpers ───────────────────────────────────────────────────────────────

function buildExecutorMessages(
  state: AgentState,
  cfg: BrownfieldStageConfig,
  allowed: BrownfieldTool[],
  featureChangeId: string,
) {
  const sys = `${cfg.executorPrompt}

You are running inside a multi-agent brownfield runtime for TimeArch.
FEATURE_CHANGE_ID: ${featureChangeId}
GOAL: ${state.goal}
PLAN:
${state.plan.map((p, i) => `${i + 1}. ${p}`).join("\n")}

You MUST respond with a single JSON object on every turn, no prose:
  {"thought": "...", "tool": "<tool_name>", "args": { ... }}
OR, when done:
  {"thought": "...", "done": true}

Available tools (call ${cfg.proposeToolName} when the draft is ready):
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

async function plannerNode(
  sb: AdminClient, state: AgentState, cfg: BrownfieldStageConfig,
) {
  const t0 = Date.now();
  const previous = state.criticVerdict;
  const replan = previous
    ? `\n\nCRITIC REJECTED THE LAST DRAFT (score=${previous.score}). Must fix:\n${
        previous.must_fix.map((m) => `- ${m}`).join("\n")
      }\nProduce a NEW plan that addresses these issues.`
    : "";
  const { content, raw } = await callLlm([
    { role: "system", content: cfg.plannerPrompt },
    { role: "user", content: `Stage: ${cfg.agentName}. Goal: ${state.goal}.${replan}\nReturn JSON: {"plan": [...]}.` },
  ], { model: cfg.plannerModel ?? "google/gemini-2.5-flash-lite", json: true });

  const parsed = recoverJSON<{ plan: string[] }>(content) ?? { plan: [] };
  const usage = (raw as any)?.usage ?? {};
  state.plan = Array.isArray(parsed.plan) ? parsed.plan.slice(0, 8) : [];
  state.tokensIn += usage.prompt_tokens ?? 0;
  state.tokensOut += usage.completion_tokens ?? 0;
  await emitTrace(sb, state, "planner", "llm",
    { plan: state.plan, replan: !!previous },
    { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });
}

async function executorNode(
  sb: AdminClient, state: AgentState, cfg: BrownfieldStageConfig, bb: Blackboard,
  featureChangeId: string,
) {
  const allowed = BROWNFIELD_TOOLS[cfg.key];
  const tmap = toolMapFor(cfg.key);
  const maxSteps = cfg.maxToolSteps ?? 20;

  for (let step = 0; step < maxSteps; step++) {
    const t0 = Date.now();
    const { content, raw } = await callLlm(
      buildExecutorMessages(state, cfg, allowed, featureChangeId),
      { model: cfg.executorModel ?? "google/gemini-2.5-flash", json: true },
    );
    const usage = (raw as any)?.usage ?? {};
    state.tokensIn += usage.prompt_tokens ?? 0;
    state.tokensOut += usage.completion_tokens ?? 0;
    const decision = recoverJSON<{ thought?: string; tool?: string; args?: any; done?: boolean }>(content) ?? {};

    await emitTrace(sb, state, "executor", "thought",
      { thought: decision.thought ?? "(no thought)", step },
      { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });

    if (decision.done) {
      const draft = await bb.read("artifact_draft");
      if (!draft) {
        state.toolCalls.push({
          id: crypto.randomUUID(), stepIndex: state.stepIndex, name: "(none)", args: {},
          error: `Executor signalled done without calling ${cfg.proposeToolName}.`,
        });
        continue;
      }
      return;
    }
    if (!decision.tool) {
      state.toolCalls.push({
        id: crypto.randomUUID(), stepIndex: state.stepIndex, name: "(invalid)", args: decision,
        error: "Response missing `tool` or `done`. Respond with valid JSON next turn.",
      });
      continue;
    }

    const tool = tmap[decision.tool];
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
      await emitTrace(sb, state, "executor", "error", { tool: tool.name, message: errMsg });
      continue;
    }

    const callT0 = Date.now();
    await emitTrace(sb, state, "executor", "tool_call", { tool: tool.name, args: parsedArgs.data });
    let result: unknown, error: string | undefined;
    try {
      result = await tool.execute(parsedArgs.data, {
        sb, bb, projectId: state.projectId, featureChangeId, stageKey: cfg.key,
      });
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

    if (tool.name === cfg.proposeToolName && !error) return;
  }
}

async function criticNode(
  sb: AdminClient, state: AgentState, cfg: BrownfieldStageConfig, bb: Blackboard,
) {
  const draft = await bb.read<Record<string, unknown>>("artifact_draft");
  if (!draft) {
    state.criticVerdict = {
      pass: false, score: 0, rubric: {},
      must_fix: ["Executor never called the propose tool."], rationale: "no draft",
    };
    await emitTrace(sb, state, "critic", "verdict", state.criticVerdict as unknown as Record<string, unknown>);
    return;
  }
  const t0 = Date.now();
  const { content, raw } = await callLlm([
    { role: "system", content: cfg.criticPrompt },
    { role: "user", content: `Stage: ${cfg.agentName}\nGoal: ${state.goal}\nDraft:\n${JSON.stringify(draft, null, 2).slice(0, 12000)}` },
  ], { model: cfg.criticModel ?? "google/gemini-2.5-flash", json: true });
  const usage = (raw as any)?.usage ?? {};
  const verdict = recoverJSON<CriticVerdict>(content);
  state.criticVerdict = verdict ?? {
    pass: false, score: 0, rubric: {},
    must_fix: ["critic returned unparseable JSON"], rationale: content.slice(0, 300),
  };
  state.tokensIn += usage.prompt_tokens ?? 0;
  state.tokensOut += usage.completion_tokens ?? 0;
  await emitTrace(sb, state, "critic", "verdict",
    state.criticVerdict as unknown as Record<string, unknown>,
    { tokens_in: usage.prompt_tokens, tokens_out: usage.completion_tokens, duration_ms: Date.now() - t0 });
}

async function persistNode(
  sb: AdminClient, state: AgentState, cfg: BrownfieldStageConfig, bb: Blackboard,
  featureChangeId: string,
): Promise<{ table: string; inserted_count: number; primary_id: string | null }> {
  const draft = await bb.read<Record<string, unknown>>("artifact_draft");
  if (!draft) throw new Error("persistNode: no draft to commit");
  const result = await persistBrownfieldDraft(cfg, draft, {
    sb, projectId: state.projectId, featureChangeId, userId: state.userId,
    runId: state.runId, criticScore: state.criticVerdict?.score ?? 0, iterations: state.iterations,
  });
  await emitTrace(sb, state, "persist", "llm", {
    table: result.table, inserted_count: result.inserted_count, primary_id: result.primary_id,
  });
  return result;
}

// ─── public runner ─────────────────────────────────────────────────────────

export interface RunBrownfieldArgs {
  projectId: string;
  userId: string;
  featureChangeId: string;
  stageKey: BrownfieldStageKey;
  goal?: string;
}

export interface RunBrownfieldResult {
  runId: string;
  stageKey: BrownfieldStageKey;
  status: "completed" | "failed";
  destinationTable?: string;
  insertedCount?: number;
  primaryId?: string | null;
  iterations: number;
  tokens_in: number;
  tokens_out: number;
  verdict?: CriticVerdict | null;
  error?: string;
}

export async function runBrownfieldAgent(args: RunBrownfieldArgs): Promise<RunBrownfieldResult> {
  const sb = adminClient();
  const cfg = BROWNFIELD_CONFIGS[args.stageKey];
  const goal = args.goal ??
    `Produce the ${cfg.agentName} artifact for feature_change_id=${args.featureChangeId}.`;
  const runId = await startRun(sb, {
    projectId: args.projectId, userId: args.userId, stage: cfg.stageCode, goal,
  });
  const state = initialState({
    runId, projectId: args.projectId, userId: args.userId, stage: cfg.stageCode, goal,
  });
  const bb = new Blackboard(sb, runId);

  try {
    const maxLoops = cfg.maxCriticLoops ?? 2;
    let persistResult: Awaited<ReturnType<typeof persistNode>> | undefined;

    while (state.iterations <= maxLoops) {
      await plannerNode(sb, state, cfg);
      await executorNode(sb, state, cfg, bb, args.featureChangeId);
      await criticNode(sb, state, cfg, bb);

      if (state.criticVerdict?.pass) {
        persistResult = await persistNode(sb, state, cfg, bb, args.featureChangeId);
        state.status = "completed";
        break;
      }
      state.iterations += 1;
      if (state.iterations > maxLoops) {
        // Out of critic budget — persist anyway, flagged via evidence_refs meta.
        try {
          persistResult = await persistNode(sb, state, cfg, bb, args.featureChangeId);
        } catch (_) { /* draft may not exist */ }
        state.status = "completed";
        break;
      }
      // Clear draft so the next executor pass generates a fresh one.
      await bb.write("artifact_draft", null);
    }

    await finishRun(sb, runId, {
      status: state.status === "completed" ? "completed" : "failed",
      final_artifact_id: persistResult?.primary_id ?? undefined,
      iterations: state.iterations,
      tokens_in: state.tokensIn,
      tokens_out: state.tokensOut,
    });

    return {
      runId, stageKey: cfg.key,
      status: state.status === "completed" ? "completed" : "failed",
      destinationTable: persistResult?.table,
      insertedCount: persistResult?.inserted_count,
      primaryId: persistResult?.primary_id ?? null,
      iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut,
      verdict: state.criticVerdict,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await emitTrace(sb, state, "runtime", "error", { message: msg });
    await finishRun(sb, runId, {
      status: "failed", error: msg, iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut,
    });
    return {
      runId, stageKey: cfg.key, status: "failed", iterations: state.iterations,
      tokens_in: state.tokensIn, tokens_out: state.tokensOut, error: msg,
    };
  }
}
