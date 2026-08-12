/**
 * Experiment Ground service (Sprint 1/2).
 *
 * Client façade over the `experiment-run` edge function and the
 * `experiment_proposals` / `experiment_runs` / `experiment_stage_results`
 * tables. Components under `src/pages/ExperimentGround.tsx` and its panels
 * MUST go through this service rather than touching Supabase directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { err, errorOf, ok, toAppError, type Result } from "@/lib/result";

export interface ExperimentProposal {
  id: string;
  project_id: string;
  title: string;
  description: string;
  change_type: string;
  source: string;
  pr_number: number | null;
  pr_url: string | null;
  pr_repo: string | null;
  pr_source: string;
  pr_files: string[];
  pr_fetched_at: string | null;
  pr_merged_at: string | null;
  pr_title: string | null;
  expected_hints: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExperimentRun {
  id: string;
  project_id: string;
  proposal_id: string | null;
  feature_change_id: string | null;
  track: string;
  status: string;
  wall_ms: number;
  tokens_in: number;
  tokens_out: number;
  guardrail_events: unknown[];
  summary: Record<string, unknown>;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
}

export interface ExperimentStageResult {
  id: string;
  run_id: string;
  stage_key: string;
  stage_order: number;
  status: string;
  row_count: number;
  wall_ms: number;
  raw: unknown;
  metrics: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

interface RunResponse {
  run_id: string;
  status: string;
  wall_ms: number;
  stage_results: Array<{ stage: string; status: string; row_count: number; wall_ms: number; error?: string | null }>;
  guardrail_events: unknown[];
}

export const experimentService = {
  async listProposals(projectId: string): Promise<Result<ExperimentProposal[]>> {
    try {
      const { data, error } = await supabase
        .from("experiment_proposals")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) return err(toAppError(error, "Failed to load proposals"));
      return ok((data as ExperimentProposal[]) ?? []);
    } catch (e) {
      return err(toAppError(e, "Failed to load proposals"));
    }
  },

  async createProposal(args: {
    project_id: string;
    title: string;
    description: string;
    change_type: string;
    expected_hints?: Record<string, unknown>;
  }): Promise<Result<ExperimentProposal>> {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return err({ code: "auth", message: "not signed in" });
      const { data, error } = await supabase
        .from("experiment_proposals")
        .insert({
          project_id: args.project_id,
          title: args.title,
          description: args.description,
          change_type: args.change_type,
          expected_hints: (args.expected_hints ?? {}) as never,
          source: "manual",
          created_by: userRes.user.id,
        })
        .select("*")
        .single();
      if (error || !data) return err(toAppError(error, "Failed to create proposal"));
      return ok(data as ExperimentProposal);
    } catch (e) {
      return err(toAppError(e, "Failed to create proposal"));
    }
  },

  async deleteProposal(id: string): Promise<Result<void>> {
    const { error } = await supabase.from("experiment_proposals").delete().eq("id", id);
    if (error) return err(toAppError(error, "Delete failed"));
    return ok(undefined);
  },

  /**
   * Retrospective track: fetch a merged GitHub PR's file list and merge it
   * into the proposal's expected_hints.files. Existing scoring code picks it
   * up unchanged.
   */
  linkPr(input: { proposal_id: string; pr_url: string }): Promise<Result<{
    ok: true; files: string[]; file_count: number;
    pr_number: number; repo: string; merged_at: string; title: string | null;
  }>> {
    return invokeFunction("experiment-link-pr", input);
  },

  async listRuns(projectId: string): Promise<Result<ExperimentRun[]>> {
    try {
      const { data, error } = await supabase
        .from("experiment_runs")
        .select("*")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) return err(toAppError(error, "Failed to load runs"));
      return ok((data as ExperimentRun[]) ?? []);
    } catch (e) {
      return err(toAppError(e, "Failed to load runs"));
    }
  },

  async listStageResults(runId: string): Promise<Result<ExperimentStageResult[]>> {
    try {
      const { data, error } = await supabase
        .from("experiment_stage_results")
        .select("*")
        .eq("run_id", runId)
        .order("stage_order", { ascending: true });
      if (error) return err(toAppError(error, "Failed to load stage results"));
      return ok((data as ExperimentStageResult[]) ?? []);
    } catch (e) {
      return err(toAppError(e, "Failed to load stage results"));
    }
  },

  runProposal(input: {
    project_id: string;
    proposal_id?: string;
    feature_change_id?: string;
    track?: "prospective" | "retrospective";
  }): Promise<Result<RunResponse>> {
    return invokeFunction<typeof input, RunResponse>("experiment-run", input);
  },

  /**
   * Sprint 4: batch runner. Sequentially kicks off `repeat` runs for every
   * proposal in `proposalIds`. Runs are fire-and-forget on the edge side
   * (waitUntil), so we only need to space the invocations by a short delay
   * to avoid overwhelming the function invoker; the UI polls for results.
   */
  async runBatch(input: {
    project_id: string;
    proposal_ids: string[];
    repeat: number;
    track?: "prospective" | "retrospective";
    onProgress?: (done: number, total: number) => void;
  }): Promise<Result<{ started: number; failed: number }>> {
    const total = input.proposal_ids.length * input.repeat;
    let started = 0;
    let failed = 0;
    for (let i = 0; i < input.repeat; i++) {
      for (const pid of input.proposal_ids) {
        const r = await experimentService.runProposal({
          project_id: input.project_id,
          proposal_id: pid,
          track: input.track ?? "prospective",
        });
        if (r.ok) started++; else failed++;
        input.onProgress?.(started + failed, total);
        // Small breather so we don't burst-invoke the runner.
        await new Promise((res) => setTimeout(res, 400));
      }
    }
    return ok({ started, failed });
  },

  /**
   * Sprint 4: load the canonical seed corpus (docs/experiments/seed-proposals.json)
   * into this project. Skips proposals whose titles already exist to keep the
   * button idempotent.
   */
  async loadSeedCorpus(projectId: string, corpus: Array<{
    title: string; description: string; change_type: string;
    expected_hints?: Record<string, unknown>;
  }>): Promise<Result<{ inserted: number; skipped: number }>> {
    const existing = await experimentService.listProposals(projectId);
    if (!existing.ok) return err(errorOf(existing));
    const known = new Set(existing.value.map((p) => p.title.toLowerCase()));
    let inserted = 0, skipped = 0;
    for (const seed of corpus) {
      if (known.has(seed.title.toLowerCase())) { skipped++; continue; }
      const r = await experimentService.createProposal({
        project_id: projectId,
        title: seed.title,
        description: seed.description,
        change_type: seed.change_type,
        expected_hints: seed.expected_hints ?? {},
      });
      if (r.ok) inserted++; else skipped++;
    }
    return ok({ inserted, skipped });
  },

  // ── Sprint 3: rubric + report ────────────────────────────────────────

  async listRubricScores(runId: string): Promise<Result<ExperimentRubricScore[]>> {
    const { data, error } = await supabase
      .from("experiment_rubric_scores")
      .select("*")
      .eq("run_id", runId);
    if (error) return err(toAppError(error, "Failed to load rubric scores"));
    return ok((data as ExperimentRubricScore[]) ?? []);
  },

  async upsertRubricScore(args: {
    run_id: string;
    dimension: string;
    score: number;
    comment?: string;
  }): Promise<Result<void>> {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return err({ code: "auth", message: "not signed in" });
    const { error } = await supabase.from("experiment_rubric_scores").upsert({
      run_id: args.run_id,
      rater_user_id: userRes.user.id,
      dimension: args.dimension,
      score: args.score,
      comment: args.comment ?? "",
    }, { onConflict: "run_id,rater_user_id,dimension" });
    if (error) return err(toAppError(error, "Failed to save score"));
    return ok(undefined);
  },
} as const;

export interface ExperimentRubricScore {
  id: string;
  run_id: string;
  rater_user_id: string;
  dimension: string;
  score: number;
  comment: string;
  created_at: string;
}

/** Aggregate metrics across a list of runs → per-proposal + per-stage means. */
export interface ProposalAggregate {
  proposal_id: string | null;
  proposal_title: string;
  run_count: number;
  completed: number;
  partial: number;
  failed: number;
  mean_wall_ms: number;
  guardrail_trip_rate: number;
  mapping_f1: number | null;
  ripple_jaccard: number | null;
  quality_direction: number | null;
  plan_task_mean: number | null;
}

export function aggregateByProposal(
  runs: ExperimentRun[],
  proposals: ExperimentProposal[],
): ProposalAggregate[] {
  const proposalMap = new Map(proposals.map((p) => [p.id, p.title]));
  const groups = new Map<string, ExperimentRun[]>();
  for (const r of runs) {
    const key = r.proposal_id ?? "__no_proposal__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const pluck = (rs: ExperimentRun[], stage: string, key: string): number[] => {
    const out: number[] = [];
    for (const r of rs) {
      const m = ((r.summary as any)?.metrics?.[stage] ?? {}) as Record<string, unknown>;
      const v = m[key];
      if (typeof v === "number") out.push(v);
    }
    return out;
  };
  const results: ProposalAggregate[] = [];
  for (const [key, rs] of groups) {
    const trips = rs.reduce((a, r) => a + (Array.isArray(r.guardrail_events) ? r.guardrail_events.length : 0), 0);
    results.push({
      proposal_id: key === "__no_proposal__" ? null : key,
      proposal_title: key === "__no_proposal__" ? "(ad-hoc runs)" : (proposalMap.get(key) ?? "(deleted)"),
      run_count: rs.length,
      completed: rs.filter((r) => r.status === "completed").length,
      partial: rs.filter((r) => r.status === "partial").length,
      failed: rs.filter((r) => r.status === "failed").length,
      mean_wall_ms: Math.round(rs.reduce((a, r) => a + r.wall_ms, 0) / rs.length),
      guardrail_trip_rate: +(trips / rs.length).toFixed(2),
      mapping_f1: mean(pluck(rs, "mapping", "f1")),
      ripple_jaccard: mean(pluck(rs, "ripple", "jaccard")),
      quality_direction: mean(pluck(rs, "quality", "direction_agreement")),
      plan_task_mean: mean(pluck(rs, "plan", "count")),
    });
  }
  return results.sort((a, b) => a.proposal_title.localeCompare(b.proposal_title));
}

export function aggregatesToCsv(rows: ProposalAggregate[]): string {
  const cols: (keyof ProposalAggregate)[] = [
    "proposal_title", "run_count", "completed", "partial", "failed",
    "mean_wall_ms", "guardrail_trip_rate",
    "mapping_f1", "ripple_jaccard", "quality_direction", "plan_task_mean",
  ];
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => {
    const v = r[c];
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
    return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

/**
 * Per-run CSV: one row per experiment run with track + stage metrics inlined.
 * Consumed by `scripts/plot-experiments.mjs` to produce paper figures with
 * prospective vs retrospective splits.
 */
export function runsToCsv(runs: ExperimentRun[], proposals: ExperimentProposal[]): string {
  const proposalMap = new Map(proposals.map((p) => [p.id, p]));
  const header = [
    "run_id", "proposal_id", "proposal_title", "track", "status",
    "wall_ms", "guardrail_trips",
    "mapping_precision", "mapping_recall", "mapping_f1",
    "ripple_jaccard", "quality_direction",
    "alternatives_count", "adr_accepted", "plan_task_count",
    "pr_repo", "pr_number", "pr_file_count",
  ].join(",");
  const num = (v: unknown) => typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : "";
  const esc = (s: string) => s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  const body = runs.map((r) => {
    const p = r.proposal_id ? proposalMap.get(r.proposal_id) : null;
    const m = ((r.summary as { metrics?: Record<string, Record<string, unknown>> })?.metrics ?? {});
    const g = m.mapping ?? {}, ri = m.ripple ?? {}, q = m.quality ?? {},
          a = m.alternatives ?? {}, ad = m.adr ?? {}, pl = m.plan ?? {};
    return [
      r.id, r.proposal_id ?? "", esc(p?.title ?? ""), r.track, r.status,
      String(r.wall_ms), String(Array.isArray(r.guardrail_events) ? r.guardrail_events.length : 0),
      num(g.precision), num(g.recall), num(g.f1),
      num(ri.jaccard), num(q.direction_agreement),
      num(a.count), num(ad.accepted), num(pl.count),
      esc(p?.pr_repo ?? ""), p?.pr_number ? String(p.pr_number) : "",
      String((p?.pr_files ?? []).length),
    ].join(",");
  }).join("\n");
  return `${header}\n${body}\n`;
}

/**
 * Cohen's κ for a single dimension across raters, computed as a pairwise
 * mean over all rater pairs (matching runs). Returns null if fewer than 2
 * raters have overlapping scored runs.
 */
export function cohenKappa(scores: ExperimentRubricScore[], dimension: string): number | null {
  const filtered = scores.filter((s) => s.dimension === dimension);
  // Group by run → rater → score
  const byRun = new Map<string, Map<string, number>>();
  for (const s of filtered) {
    if (!byRun.has(s.run_id)) byRun.set(s.run_id, new Map());
    byRun.get(s.run_id)!.set(s.rater_user_id, s.score);
  }
  const raters = Array.from(new Set(filtered.map((s) => s.rater_user_id)));
  if (raters.length < 2) return null;
  const kappas: number[] = [];
  for (let i = 0; i < raters.length; i++) {
    for (let j = i + 1; j < raters.length; j++) {
      const a: number[] = [], b: number[] = [];
      for (const [, m] of byRun) {
        const va = m.get(raters[i]); const vb = m.get(raters[j]);
        if (va !== undefined && vb !== undefined) { a.push(va); b.push(vb); }
      }
      if (a.length < 2) continue;
      const cats = Array.from(new Set([...a, ...b])).sort();
      const n = a.length;
      const po = a.reduce((acc, v, k) => acc + (v === b[k] ? 1 : 0), 0) / n;
      let pe = 0;
      for (const c of cats) {
        const pa = a.filter((v) => v === c).length / n;
        const pb = b.filter((v) => v === c).length / n;
        pe += pa * pb;
      }
      const k = pe === 1 ? 1 : (po - pe) / (1 - pe);
      kappas.push(k);
    }
  }
  if (kappas.length === 0) return null;
  return kappas.reduce((x, y) => x + y, 0) / kappas.length;
}
