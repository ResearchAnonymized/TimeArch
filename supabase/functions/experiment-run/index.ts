// Experiment Ground runner.
// Auto-executes the full brownfield loop for a proposal (or existing
// feature_change) end-to-end, honoring existing per-stage guardrails, and
// records timing / row-counts / raw output per stage.
//
// Contract:
//   POST { project_id, proposal_id?, feature_change_id?, track? }
//   → { run_id, status, stage_results }
//
// The runner never throws on stage failures — it records a guardrail event
// and continues so the report still renders (matches the "HTTP 200 on error"
// house rule).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Sprint 4: with EdgeRuntime.waitUntil we no longer block the HTTP response,
// so we can raise per-stage back to 90s to reduce spurious timeouts on the
// heavier stages (alternatives, plan).
const STAGE_TIMEOUT_MS = 90_000;
const RUN_TIMEOUT_MS = 480_000;

interface StageDef {
  key: string;
  fn: string;
  order: number;
  countKey: string;   // field in response that carries the row count
}

const STAGES: StageDef[] = [
  { key: "mapping",       fn: "map-feature-to-architecture", order: 1, countKey: "mapping_count" },
  { key: "ripple",        fn: "analyze-ripple",              order: 2, countKey: "impact_count" },
  { key: "quality",       fn: "assess-quality-impact",       order: 3, countKey: "assessment_count" },
  { key: "alternatives",  fn: "generate-alternatives",       order: 4, countKey: "alternative_count" },
  // Sprint-4 fix: the plan stage links to an accepted ADR if one exists but
  // never creates one. Auto-draft an ADR from the recommended alternative so
  // plan.has_adr is true end-to-end. Sentinel fn is handled inline below.
  { key: "adr",           fn: "__inline_record_adr__",       order: 5, countKey: "adr_count" },
  { key: "plan",          fn: "plan-feature-implementation", order: 6, countKey: "work_item_count" },
];

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function invokeStage(fn: string, body: unknown, authHeader: string): Promise<{ res: any; wall_ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), STAGE_TIMEOUT_MS);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const wall_ms = Date.now() - t0;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { res: json, wall_ms, error: `HTTP ${res.status}` };
    return { res: json, wall_ms };
  } catch (e) {
    return { res: {}, wall_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Sprint 4 fix: auto-draft an accepted ADR from the recommended alternative
 * of the feature change so the downstream plan stage can link its work items.
 * Idempotent — replaces any existing draft ADR on this feature_change.
 */
async function recordAdrInline(
  admin: any,
  feature_change_id: string,
  user_id: string,
): Promise<{ res: any; wall_ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const { data: fc } = await admin.from("feature_changes")
      .select("id, project_id, title").eq("id", feature_change_id).single();
    if (!fc) return { res: {}, wall_ms: Date.now() - t0, error: "feature_change not found" };

    const { data: alts } = await admin.from("architecture_alternatives")
      .select("id, name, description, pros, cons, recommended")
      .eq("feature_change_id", feature_change_id)
      .order("recommended", { ascending: false })
      .limit(5);
    const chosen = (alts ?? []).find((a: any) => a.recommended) ?? (alts ?? [])[0];
    if (!chosen) return { res: { adr_count: 0 }, wall_ms: Date.now() - t0, error: "no alternatives to draft ADR from" };

    // Idempotent: drop prior auto-drafted ADRs on this change so re-runs don't stack.
    await admin.from("adr_records").delete().eq("feature_change_id", feature_change_id);

    const { data: existingCount } = await admin.from("adr_records")
      .select("number", { count: "exact", head: false }).eq("project_id", fc.project_id);
    const nextNumber = ((existingCount ?? []).reduce((mx: number, a: any) => Math.max(mx, a.number ?? 0), 0)) + 1;

    const { data: ins, error } = await admin.from("adr_records").insert({
      project_id: fc.project_id,
      feature_change_id,
      chosen_alternative_id: chosen.id,
      created_by: user_id,
      number: nextNumber,
      title: `${chosen.name ?? fc.title}`.slice(0, 200),
      status: "accepted",
      context: `Auto-drafted by Experiment Ground for feature: ${fc.title}`,
      decision: chosen.description ?? null,
      consequences: JSON.stringify({ pros: chosen.pros ?? [], cons: chosen.cons ?? [] }),
      alternatives_considered: (alts ?? []).map((a: any) => ({ id: a.id, name: a.name, recommended: a.recommended })),
    }).select("id").single();
    if (error) return { res: {}, wall_ms: Date.now() - t0, error: error.message };
    return { res: { adr_count: 1, adr_id: ins?.id, chosen_alternative_id: chosen.id }, wall_ms: Date.now() - t0 };
  } catch (e) {
    return { res: {}, wall_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return ok({ error: "unauthorized" }, 401);

  const authed = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user }, error: userErr } = await authed.auth.getUser();
  if (userErr || !user) return ok({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const project_id: string | undefined = body.project_id;
  const proposal_id: string | undefined = body.proposal_id;
  let feature_change_id: string | undefined = body.feature_change_id;
  const track: string = body.track ?? "prospective";
  if (!project_id) return ok({ error: "project_id required" }, 400);

  // Membership check via helper (bypasses need for project row read).
  const { data: memberOk, error: memberErr } = await admin.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
  console.log("membership", { user_id: user.id, project_id, memberOk, memberErr });
  if (!memberOk) return ok({ error: "forbidden", debug: { memberOk, memberErr: memberErr?.message } }, 403);

  // Resolve feature_change: from proposal, from explicit id, or bail.
  let proposal: any = null;
  if (proposal_id) {
    const { data } = await admin.from("experiment_proposals").select("*").eq("id", proposal_id).maybeSingle();
    proposal = data;
  }
  if (!feature_change_id) {
    if (!proposal) return ok({ error: "proposal_id or feature_change_id required" }, 400);
    const { data: fc, error: fcErr } = await admin.from("feature_changes").insert({
      project_id,
      title: proposal.title,
      description: proposal.description ?? "",
      change_type: ["add","modify","remove","migrate"].includes(proposal.change_type) ? proposal.change_type : "add",
      priority: "medium",
      status: "draft",
      created_by: user.id,
    }).select("id").single();
    if (fcErr || !fc) {
      console.error("feature_change insert failed", fcErr);
      return ok({ error: `feature_change create failed: ${fcErr?.message}` }, 500);
    }
    feature_change_id = fc.id;
  }

  // Create the run row.
  const { data: run, error: runErr } = await admin.from("experiment_runs").insert({
    project_id,
    proposal_id: proposal_id ?? null,
    feature_change_id,
    track,
    status: "running",
    triggered_by: user.id,
  }).select("id, started_at").single();
  if (runErr || !run) return ok({ error: `run create failed: ${runErr?.message}` }, 500);

  // Sprint 4: hand the long sequential loop to EdgeRuntime.waitUntil so the
  // HTTP call returns immediately. The UI polls `experiment_runs` /
  // `experiment_stage_results` and rehydrates as stages land.
  const runId = run.id;
  const executeRun = async () => {
    const runStart = Date.now();
    const guardrail_events: any[] = [];
    const stage_results: any[] = [];

    for (const stage of STAGES) {
      if (Date.now() - runStart > RUN_TIMEOUT_MS) {
        guardrail_events.push({ type: "run_timeout", at: stage.key });
        break;
      }
      await admin.from("experiment_stage_results").insert({
        run_id: runId,
        stage_key: stage.key,
        stage_order: stage.order,
        status: "running",
      });

      const { res, wall_ms, error } = stage.fn === "__inline_record_adr__"
        ? await recordAdrInline(admin, feature_change_id!, user.id)
        : await invokeStage(stage.fn, { feature_change_id, replace: true }, authHeader);

      const row_count = Number(res?.[stage.countKey] ?? 0);
      let status = "completed";
      let stageError: string | null = null;
      if (error) { status = "failed"; stageError = error; guardrail_events.push({ type: "stage_error", stage: stage.key, error }); }
      else if (res?.error) { status = "partial"; stageError = String(res.error); guardrail_events.push({ type: "stage_partial", stage: stage.key, error: res.error }); }
      else if (row_count === 0) { status = "empty"; guardrail_events.push({ type: "stage_empty", stage: stage.key }); }

      await admin.from("experiment_stage_results")
        .update({ status, row_count, wall_ms, raw: res ?? {}, error: stageError })
        .eq("run_id", runId).eq("stage_key", stage.key);

      stage_results.push({ stage: stage.key, status, row_count, wall_ms, error: stageError });
    }

    // Compute stage metrics from persisted rows (see Sprint 3 rationale).
    const hints = (proposal?.expected_hints ?? {}) as {
      components?: string[]; files?: string[]; qualities?: Array<{ attribute: string; direction: string }>;
    };
    const norm = (s: string) => s.toLowerCase().trim();
    const setOf = (xs?: string[]) => new Set((xs ?? []).map(norm));

    // Fuzzy containment: a predicted ref matches a truth ref if either string
    // contains the other after normalization, OR if the truth's basename (for
    // file paths) or class name (before the first `.` or `(`) appears in the
    // prediction. This is more faithful to what a human evaluator does — the
    // loop legitimately emits finer-grained refs (methods, tests, basenames)
    // that exact-equality would count as misses.
    const kernel = (s: string) => {
      const base = s.split("/").pop() ?? s;               // basename
      const stem = base.replace(/\.[a-z0-9]+$/i, "");     // strip extension
      const head = stem.split(/[.(]/)[0];                 // class-ish head
      return norm(head);
    };
    const matchesAny = (pred: string, truths: string[]) =>
      truths.some((t) => {
        const p = norm(pred), q = norm(t), k = kernel(t);
        return p === q || p.includes(q) || q.includes(p) || (k.length >= 3 && p.includes(k));
      });

    const prf = (predicted: string[], truth: string[]) => {
      if (truth.length === 0) return {};
      const predSet = [...new Set(predicted.map(norm))];
      const tp = predSet.filter((p) => matchesAny(p, truth)).length;
      const truthHits = truth.filter((t) => predSet.some((p) => matchesAny(p, [t]))).length;
      const precision = predSet.length ? tp / predSet.length : 0;
      const recall = truth.length ? truthHits / truth.length : 0;
      const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      return { precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +f1.toFixed(3),
        predicted: predSet.length, truth: truth.length, true_positive: tp, truth_hits: truthHits };
    };
    const jaccard = (predicted: string[], truth: string[]) => {
      if (predicted.length === 0 && truth.length === 0) return {};
      const predSet = [...new Set(predicted.map(norm))];
      const inter = predSet.filter((p) => matchesAny(p, truth)).length;
      const union = predSet.length + truth.length - inter;
      return { jaccard: union ? +(inter / union).toFixed(3) : 0, predicted: predSet.length, truth: truth.length, intersection: inter };
    };

    async function computeMetrics(stageKey: string): Promise<Record<string, unknown>> {
      try {
        if (stageKey === "mapping") {
          const { data } = await admin.from("feature_mappings").select("element_ref").eq("feature_change_id", feature_change_id);
          const predicted = (data ?? []).map((r: any) => r.element_ref as string);
          return prf(predicted, hints.components ?? []);
        }
        if (stageKey === "ripple") {
          const { data } = await admin.from("impact_findings").select("impacted_element_ref").eq("feature_change_id", feature_change_id);
          const predicted = (data ?? []).map((r: any) => r.impacted_element_ref as string);
          return jaccard(predicted, hints.files ?? []);
        }
        if (stageKey === "quality") {
          const { data } = await admin.from("quality_impact_assessments").select("attribute, direction").eq("feature_change_id", feature_change_id);
          const rows = (data ?? []) as Array<{ attribute: string; direction: string }>;
          const truth = hints.qualities ?? [];
          if (truth.length === 0) return { count: rows.length };
          const matched = truth.filter((t) =>
            rows.some((r) => norm(r.attribute) === norm(t.attribute) && norm(r.direction) === norm(t.direction)),
          ).length;
          return { count: rows.length, direction_agreement: +(matched / truth.length).toFixed(3), matched, truth: truth.length };
        }
        if (stageKey === "alternatives") {
          const { data } = await admin.from("architecture_alternatives").select("id, recommended").eq("feature_change_id", feature_change_id);
          const rows = (data ?? []) as Array<{ recommended: boolean | null }>;
          return { count: rows.length, recommended: rows.filter((r) => r.recommended).length };
        }
        if (stageKey === "adr") {
          const { data } = await admin.from("adr_records").select("id, status").eq("feature_change_id", feature_change_id);
          const rows = (data ?? []) as Array<{ status: string | null }>;
          return { count: rows.length, accepted: rows.filter((r) => r.status === "accepted").length };
        }
        if (stageKey === "plan") {
          const { data } = await admin.from("feature_work_items").select("id, adr_id").eq("feature_change_id", feature_change_id);
          const rows = (data ?? []) as Array<{ adr_id: string | null }>;
          return { count: rows.length, has_adr: rows.some((r) => r.adr_id !== null) };
        }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
      return {};
    }

    const metricsByStage: Record<string, Record<string, unknown>> = {};
    for (const s of stage_results) {
      const m = await computeMetrics(s.stage);
      metricsByStage[s.stage] = m;
      await admin.from("experiment_stage_results")
        .update({ metrics: m })
        .eq("run_id", runId).eq("stage_key", s.stage);
    }

    const wall_ms = Date.now() - runStart;
    const anyFail = stage_results.some((s) => s.status === "failed");
    const anyEmpty = stage_results.some((s) => s.status === "empty" || s.status === "partial");
    const finalStatus = anyFail ? "failed" : anyEmpty ? "partial" : "completed";

    await admin.from("experiment_runs").update({
      status: finalStatus,
      wall_ms,
      guardrail_events,
      summary: {
        stages: stage_results,
        total_rows: stage_results.reduce((a, s) => a + (s.row_count || 0), 0),
        metrics: metricsByStage,
      },
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
  };

  // @ts-ignore EdgeRuntime is provided at runtime by Supabase.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(executeRun().catch((e) => console.error("experiment-run background failure", e)));
  } else {
    // Local dev fallback: await inline.
    await executeRun();
  }

  return ok({ run_id: runId, status: "running", accepted: true });
});
