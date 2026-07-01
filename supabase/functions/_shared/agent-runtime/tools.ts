// Tool catalog used by the Executor node. Each tool is a typed function the
// planner can invoke through the AI SDK tool-calling loop. We deliberately
// keep tools narrow + side-effect-aware: writes go to the blackboard, not
// straight to artifact tables (the Persist node owns final commits).
import { z } from "https://esm.sh/zod@3.23.8";
import type { AdminClient } from "./trace.ts";
import { Blackboard } from "./blackboard.ts";

export interface ToolContext {
  sb: AdminClient;
  bb: Blackboard;
  projectId: string;
  stage: number;
}

export interface Tool<Args = any, Result = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<Args>;
  execute: (args: Args, ctx: ToolContext) => Promise<Result>;
}

export const tools: Tool[] = [
  {
    name: "search_knowledge",
    description: "Lexical RAG over the curated TimeArch knowledge base (29148, ATAM, INCOSE, TOGAF). Returns up to 5 ranked chunks.",
    schema: z.object({
      query: z.string().min(2),
      framework: z.string().optional(),
      max_results: z.number().int().min(1).max(10).default(5),
    }),
    async execute({ query, framework, max_results }, { sb, stage }) {
      const { data, error } = await sb.rpc("search_knowledge", {
        query_text: query,
        stage_filter: stage,
        framework_filter: framework ?? null,
        max_results,
      });
      if (error) return { error: error.message, results: [] };
      return { results: data ?? [] };
    },
  },
  {
    name: "list_artifacts",
    description: "List prior approved artifacts for this project (id, type, title, stage).",
    schema: z.object({ stage: z.number().int().optional() }),
    async execute({ stage }, { sb, projectId }) {
      const q = sb.from("architecture_artifacts")
        .select("id, artifact_type, title, stage, status")
        .eq("project_id", projectId)
        .order("stage", { ascending: true });
      const { data } = stage != null ? await q.eq("stage", stage) : await q;
      return { artifacts: data ?? [] };
    },
  },
  {
    name: "read_artifact",
    description: "Read the JSON content of one artifact by id.",
    schema: z.object({ id: z.string().uuid() }),
    async execute({ id }, { sb }) {
      const { data, error } = await sb.from("architecture_artifacts")
        .select("id, artifact_type, title, content").eq("id", id).maybeSingle();
      if (error) return { error: error.message };
      return data ?? { error: "not found" };
    },
  },
  {
    name: "read_requirements",
    description: "Fetch all requirements (FR + NFR) captured for this project.",
    schema: z.object({}),
    async execute(_a, { sb, projectId }) {
      const { data } = await sb.from("requirements")
        .select("id, kind, priority, title, description, acceptance_criteria, tags")
        .eq("project_id", projectId);
      return { requirements: data ?? [] };
    },
  },
  {
    name: "read_drivers",
    description: "Fetch architectural drivers / quality-attribute scenarios captured for this project.",
    schema: z.object({}),
    async execute(_a, { sb, projectId }) {
      const { data } = await sb.from("architecture_drivers")
        .select("id, kind, priority, title, description, scenario, rationale")
        .eq("project_id", projectId);
      return { drivers: data ?? [] };
    },
  },
  {
    name: "write_blackboard",
    description: "Persist an intermediate finding/note to the run's shared working memory.",
    schema: z.object({ key: z.string().min(1).max(120), value: z.any() }),
    async execute({ key, value }, { bb }) {
      await bb.write(key, value);
      return { ok: true };
    },
  },
  {
    name: "read_blackboard",
    description: "Read a previously written blackboard entry, or all entries when no key is given.",
    schema: z.object({ key: z.string().optional() }),
    async execute({ key }, { bb }) {
      return key ? { value: await bb.read(key) } : { entries: await bb.all() };
    },
  },
  {
    name: "propose_artifact_draft",
    description: "Submit a JSON draft of the stage artifact. The Critic will review it; only the Persist node commits to architecture_artifacts. Call this when you believe the artifact is ready.",
    schema: z.object({
      title: z.string().min(3),
      content: z.record(z.string(), z.any()),
      summary: z.string().optional(),
    }),
    async execute(draft, { bb }) {
      await bb.write("artifact_draft", draft);
      return { ok: true, accepted_for_review: true };
    },
  },
];

export const toolMap: Record<string, Tool> = Object.fromEntries(tools.map((t) => [t.name, t]));
