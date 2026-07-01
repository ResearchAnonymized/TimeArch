# Real Agentic System — LangGraph.js across all 18 stages

Goal: replace the current `run-agent` dispatcher with a true LangGraph.js multi-agent runtime. Every stage becomes a graph of planner → executor (tool-calling loop) → critic → challenger, sharing a Postgres-backed blackboard, with a live trace UI in the workspace.

## 1. Runtime foundation (`supabase/functions/_shared/agent-runtime/`)

- `graph.ts` — LangGraph.js `StateGraph` builder. Node types: `planner`, `executor`, `critic`, `challenger`, `verifier`, `persist`.
- `state.ts` — shared `AgentState` (Zod): `projectId`, `stage`, `goal`, `plan[]`, `scratchpad[]`, `toolCalls[]`, `artifactDraft`, `criticVerdict`, `iterations`, `traceId`.
- `llm.ts` — wraps existing `callLlm` as an AI SDK `LanguageModelV2` so LangGraph + AI SDK `tool()` calls work over Lovable AI Gateway (Gemini 2.5 Flash/Pro routing preserved).
- `blackboard.ts` — Postgres read/write for shared working memory (new `agent_blackboard` table, keyed by `run_id`).
- `trace.ts` — emits step rows to new `agent_trace_steps` table (planner thoughts, tool calls, tool results, token usage). Streams via Supabase Realtime.

## 2. Tool catalog (`agent-runtime/tools/`)

AI SDK `tool()` definitions with Zod input schemas + `stopWhen: stepCountIs(50)`:
- `search_knowledge` (RAG over `knowledge_chunks`)
- `read_artifact` / `list_artifacts`
- `write_artifact_draft`
- `read_requirements` / `read_drivers` / `read_gaps`
- `read_blackboard` / `write_blackboard`
- `run_deterministic_check` (existing per-stage checks)
- `call_critic` (delegates to critic node)
- `web_search` (optional, behind flag)

Tool deferral via `tool_search` / `tool_invoke` meta-tools per `ai-sdk-tool-deferral` since 10+ tools.

## 3. Agent roles (per stage)

```text
            ┌──────────┐
   goal ──▶ │ Planner  │── plan ──▶ ┌──────────┐
            └──────────┘            │ Executor │──tool loop──▶ draft
                                    └──────────┘
                                          │
                                          ▼
                              ┌────────┐      ┌────────────┐
                              │ Critic │─fail─│ Re-plan(≤3)│
                              └────────┘      └────────────┘
                                  │pass
                                  ▼
                          ┌─────────────┐
                          │ Challenger  │ (existing)
                          └─────────────┘
                                  │
                                  ▼
                              persist + trace
```

Per-stage config (`stages/<n>.agent.ts`) declares: goal template, allowed tools subset, critic rubric, max iterations, target model.

## 4. Stage migration

- Keep current `StageHandler` interface as a fallback adapter.
- Add `stages/registry.ts` flag `mode: "agentic" | "legacy"`. Migrate stages incrementally; ship all 18 flipped to `agentic` once the runtime is green on stages 2, 3, 7.
- Reuse existing prompts from `prompt_overrides` as planner/critic seed prompts; no prompt loss.

## 5. Database (one migration)

```sql
create table public.agent_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  stage int not null,
  status text not null default 'running',
  goal text, final_artifact_id uuid,
  iterations int default 0,
  tokens_in int default 0, tokens_out int default 0,
  started_at timestamptz default now(), completed_at timestamptz,
  user_id uuid not null
);
create table public.agent_trace_steps (
  id bigserial primary key,
  run_id uuid not null references public.agent_runs_v2(id) on delete cascade,
  step_index int not null,
  node text not null,        -- planner|executor|critic|...
  kind text not null,        -- thought|tool_call|tool_result|llm|error
  payload jsonb not null,
  tokens_in int, tokens_out int,
  created_at timestamptz default now()
);
create table public.agent_blackboard (
  run_id uuid references public.agent_runs_v2(id) on delete cascade,
  key text not null, value jsonb not null,
  updated_at timestamptz default now(),
  primary key (run_id, key)
);
```
With GRANTs + RLS scoped via `is_project_member`.

## 6. Edge function

- New `supabase/functions/run-agent-v2/index.ts` — wraps the LangGraph compiled graph; same request contract as `run-agent` so `useRunStage` is unchanged.
- Cassette layer (`llm.ts`) preserved for ECSA AE reproducibility.
- Audit log row per run + per critic verdict.

## 7. Live trace UI

- `src/components/agent-trace/AgentTracePanel.tsx` — timeline of nodes, expandable tool calls, token counters, current plan, blackboard viewer.
- `src/hooks/useAgentTrace.ts` — Supabase Realtime subscription to `agent_trace_steps` filtered by `run_id`.
- Mount inside `ProjectWorkspace` stage drawer, replacing the current static "monitoring" message.
- LangSmith-lite: per-step duration, status badge, model id, retry count.

## 8. Autonomy & governance

- Full autonomy inside a run (planner can re-plan up to 3×, executor up to 50 tool steps via `stopWhen`).
- Audit trail = `agent_trace_steps` + existing `audit_log`. No HITL gates inside a run; existing stage_approval still required between stages.
- Hard ceilings: max 50 tool calls, max 3 critic loops, 8-min wall clock, token budget per run logged to `token_usage`.

## 9. Dependencies

`bun add @langchain/langgraph @langchain/core ai zod` (AI SDK already partial). Imported via `npm:` in Deno edge function.

## 10. Rollout / verification

1. Migration + runtime scaffold.
2. Pilot: stage 2 (Requirements) end-to-end with trace UI.
3. Stage 3 (Drivers/ATAM) and stage 7 (Tradeoffs) — exercises critic + RAG tools.
4. Flip remaining 15 stages.
5. Run ShopFlow demo end-to-end on `run-agent-v2`; compare artifacts vs legacy.
6. Update `docs/ARCHITECTURE.md` + paper memory (`mem://architecture/multi-agent-system`).

## Out of scope (this round)

- Cross-stage supervisor agent (Phase-level).
- Replacing `critic-agent` / `challenger` external functions — they get called as tools from the new graph instead.
- Migrating brownfield (`reverse-engineer`, `drift-detect`) — they keep their current shape and become tools.

## Risks

- LangGraph.js + Deno `npm:` imports — verify graph compile in edge runtime before wider migration.
- Token cost rises with planner/critic loops — mitigated by Flash-Lite for planner, Pro only for critic on stages 3/7/12.
- Trace volume — `agent_trace_steps` partitioned by month + retention cleanup job.
