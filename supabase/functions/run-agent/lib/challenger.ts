// Challenger-only mode: re-run the Scientific Challenger against the latest
// primary artifact for a stage without regenerating the primary.
import { corsHeaders } from "./http.ts";
import { createLangChainLLM, invokeLangChainAgent } from "./llm.ts";
import {
  ARTIFACT_TYPES,
  SCIENTIFIC_CHALLENGER_SCHEMA,
  SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT,
} from "../stages/registry.ts";
import { getStageHandler } from "../stages/index.ts";

// ─── Challenge-Only Mode ────────────────────────────────────────────────────
// Runs the Scientific Challenger Architect against the latest primary
// recommendation for a stage, without regenerating that recommendation.
export async function runChallengeOnly(args: {
  supabase: any;
  project_id: string;
  stage: number;
  user_id: string;
  LLM_API_KEY: string;
}) {
  const { supabase, project_id, stage, user_id, LLM_API_KEY } = args;
  const startTime = Date.now();

  // 1. Find latest primary artifact for this stage (skip prior challenger reviews)
  const { data: artifacts } = await supabase
    .from("architecture_artifacts")
    .select("*")
    .eq("project_id", project_id)
    .eq("stage", stage)
    .order("created_at", { ascending: false });

  const primary = (artifacts || []).find(
    (a: any) =>
      !a.generated_by?.includes("Challenger") &&
      !a.generated_by?.includes("Evaluator") &&
      !a.title?.startsWith("Challenger Review:") &&
      !a.title?.startsWith("Evaluator Review:"),
  );

  if (!primary) {
    return new Response(
      JSON.stringify({
        error: "No primary recommendation found for this stage. Run the stage agent first, then trigger the Challenger.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Create agent_run record for the challenger
  const { data: agentRun } = await supabase
    .from("agent_runs")
    .insert({
      project_id,
      stage,
      agent_name: "Challenger Architect Agent (Scientific Evaluation)",
      status: "running",
      started_at: new Date().toISOString(),
      triggered_by: user_id,
      input: { mode: "challenge_only", primary_artifact_id: primary.id },
    })
    .select("id")
    .single();

  // Run the heavy LLM evaluation in the background to avoid the 150s edge idle timeout.
  const executeChallenge = async () => {
    try {
      // 3. Build slimmed-down primary context (stage-aware)
      const c: any = primary.content || {};
      const isDecomposition = stage === 6;
      const isApiDesign = stage === 8;
      const primarySlim: any = isDecomposition
        ? {
            title: primary.title,
            decomposition_approach: c.decomposition_approach,
            components: c.components,
            dependency_graph: c.dependency_graph,
            communication_patterns: c.communication_patterns,
            circular_dependency_check: c.circular_dependency_check,
            architectural_viewpoints: c.architectural_viewpoints,
            summary: c.summary || c.architecture_structure_summary,
          }
        : isApiDesign
        ? {
            title: primary.title,
            summary: c.summary,
            apis: c.apis,
            communication_patterns: c.communication_patterns,
            event_contracts: c.event_contracts,
            integration_points: c.integration_points,
            warnings: c.warnings,
          }
        : {
            title: primary.title,
            summary: c.summary,
            recommended_style: c.recommended_style,
            alternatives_considered: c.alternatives_considered,
            style_comparison_matrix: c.style_comparison_matrix,
            warnings: c.warnings,
            key_considerations: c.key_considerations,
            requirement_alignment: c.requirement_alignment,
          };

      // Pull requirements + drivers for evidence-based scoring.
      // Stage >= 4 challengers must score against the same locked-only
      // requirement set the architect agent saw, so verdicts are consistent
      // with the governance gate.
      const [reqResAll, drvRes, projRes] = await Promise.all([
        supabase.from("requirements").select("requirement_id, title, type, priority, description, status").eq("project_id", project_id).order("requirement_id"),
        supabase.from("architecture_drivers").select("label, category, priority, description").eq("project_id", project_id),
        supabase.from("projects").select("name, description").eq("id", project_id).single(),
      ]);
      const reqRes = {
        data: stage >= 4
          ? (reqResAll.data || []).filter((r: any) => r.status === "locked" || r.status === "approved")
          : (reqResAll.data || []),
      };

      // For Architecture Validation (Stage 13), load locked upstream design
      // decisions (Stages 4-12) so the challenger can verify cross-stage
      // consistency, not just the validation report in isolation.
      const isValidation = stage === 13;
      let upstreamArtifacts: any[] = [];
      let upstreamSummaries: Array<{ stage: number; agent: string; title: string; locked: boolean; summary: string }> = [];
      if (isValidation) {
        const { data: ups } = await supabase
          .from("architecture_artifacts")
          .select("id, stage, title, status, locked_at, generated_by, content, created_at")
          .eq("project_id", project_id)
          .in("stage", [4, 5, 6, 7, 8, 9, 10, 11, 12])
          .order("created_at", { ascending: false });
        // Pick the latest non-challenger artifact per stage; prefer locked ones
        const byStage = new Map<number, any>();
        for (const a of (ups || [])) {
          if (a.generated_by?.includes("Challenger") || a.title?.startsWith("Challenger Review:")) continue;
          const existing = byStage.get(a.stage);
          if (!existing) { byStage.set(a.stage, a); continue; }
          if (!existing.locked_at && a.locked_at) byStage.set(a.stage, a);
        }
        upstreamArtifacts = [...byStage.values()].sort((a, b) => a.stage - b.stage);
        upstreamSummaries = upstreamArtifacts.map((a) => {
          const c = a.content || {};
          const summary = c.summary || c.recommended_style?.name || c.decomposition_approach || c.title || a.title;
          return {
            stage: a.stage,
            agent: a.generated_by || `Stage ${a.stage} Agent`,
            title: a.title,
            locked: !!a.locked_at,
            summary: typeof summary === "string" ? summary.slice(0, 280) : JSON.stringify(summary).slice(0, 280),
          };
        });
      }

      const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const reqsTrimmed = (reqRes.data || [])
        .slice()
        .sort((a: any, b: any) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9))
        .slice(0, 40)
        .map((r: any) => ({
          id: r.requirement_id,
          title: r.title,
          type: r.type,
          priority: r.priority,
          description: r.description ? String(r.description).slice(0, 240) : undefined,
        }));
      const drvTrimmed = (drvRes.data || []).slice(0, 20).map((d: any) => ({
        label: d.label,
        category: d.category,
        priority: d.priority,
        description: d.description ? String(d.description).slice(0, 200) : undefined,
      }));

      const subjectLabel = isDecomposition
        ? "SYSTEM DECOMPOSITION"
        : isApiDesign
        ? "API & INTEGRATION DESIGN"
        : "recommendation";
      const primaryLabel = isDecomposition
        ? "PRIMARY DECOMPOSITION (subject of evaluation):"
        : isApiDesign
        ? "PRIMARY API & INTEGRATION DESIGN (subject of evaluation):"
        : "PRIMARY RECOMMENDATION (subject of evaluation):";
      const closingInstruction = isDecomposition
        ? "Evaluate this DECOMPOSITION against the decomposition heuristics in your system prompt (boundaries, coupling, cohesion, dependency direction, data ownership, communication patterns, deployability, 4+1 consistency, style alignment, anti-patterns). Score all 10 evaluation_dimensions, identify ATAM sensitivity/tradeoff points around module boundaries, and produce a structured scientific review. Cite specific component names, dependency edges, or communication patterns in your evidence."
        : isApiDesign
        ? "Evaluate this API & INTEGRATION DESIGN against the API heuristics in your system prompt (purpose alignment, style fitness, contract design, versioning, idempotency, security, coupling/ownership, async/event contracts, integration points, anti-patterns). Score all 10 evaluation_dimensions, identify ATAM sensitivity/tradeoff points around API/integration decisions, and produce a structured scientific review. Cite specific API names, endpoints (METHOD + path), event names, communication patterns, or integration points in your evidence."
        : "Now evaluate this recommendation across ALL 10 dimensions, perform ATAM analysis (sensitivity points, tradeoff points, risks, non-risks), and produce a structured scientific review. Cite specific requirement IDs and architectural decisions in your evidence.";

      const upstreamBlock = isValidation && upstreamSummaries.length > 0
        ? `\n\nUPSTREAM LOCKED DECISIONS (Stages 4–12) — verify the validation report is consistent with these:\n${JSON.stringify(upstreamSummaries, null, 2)}\n`
        : "";

      const challengerPrompt = `Perform a SCIENTIFIC architecture evaluation of the following Stage ${stage} ${subjectLabel}.

PROJECT: ${projRes.data?.name || "Unknown"}
${projRes.data?.description ? `Description: ${projRes.data.description}` : ""}

${primaryLabel}
${JSON.stringify(primarySlim, null, 2)}

REQUIREMENTS (top ${reqsTrimmed.length} by priority of ${(reqRes.data || []).length} total):
${JSON.stringify(reqsTrimmed, null, 2)}

ARCHITECTURE DRIVERS (${drvTrimmed.length}):
${JSON.stringify(drvTrimmed, null, 2)}
${upstreamBlock}
${closingInstruction}${isValidation ? " For Architecture Validation, also flag any inconsistency between the validation report and the upstream locked decisions (e.g., risks not addressed in the validation plan, missing quality-attribute coverage, scenario gaps for the chosen style)." : ""}`;

      const llm = createLangChainLLM(LLM_API_KEY);
      const stageChallengerDefault =
        getStageHandler(stage)?.challengerSystemPrompt ?? SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT;
      const challengerKey =
        stage === 6
          ? "challenger.decomposition.system"
          : stage === 8
            ? "challenger.api.system"
            : "challenger.scientific.system";
      const { resolvePrompt } = await import("../../_shared/prompts.ts");
      const stageChallengerPrompt = await resolvePrompt(
        supabase,
        challengerKey,
        stageChallengerDefault,
      );
      const { parsed } = await invokeLangChainAgent(
        llm,
        stageChallengerPrompt,
        challengerPrompt,
        SCIENTIFIC_CHALLENGER_SCHEMA,
      );

      if (parsed?.parse_error) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error: "Challenger output could not be parsed.",
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
        return;
      }

      // Build a transparent trace of what the challenger actually consumed
      const contextTrace = {
        primary_artifact: {
          id: primary.id,
          title: primary.title,
          stage: primary.stage,
          status: primary.status,
          locked_at: primary.locked_at || null,
          generated_by: primary.generated_by || null,
          version: primary.version,
          created_at: primary.created_at,
        },
        requirements: {
          total_count: (reqRes.data || []).length,
          included_count: reqsTrimmed.length,
          included: reqsTrimmed.map((r: any) => ({
            id: r.id, title: r.title, type: r.type, priority: r.priority,
          })),
        },
        drivers: {
          total_count: (drvRes.data || []).length,
          included_count: drvTrimmed.length,
          included: drvTrimmed.map((d: any) => ({
            label: d.label, category: d.category, priority: d.priority,
          })),
        },
        project: { name: projRes.data?.name || null },
        upstream_decisions: isValidation ? upstreamSummaries.map((u) => ({
          stage: u.stage, agent: u.agent, title: u.title, locked: u.locked, summary: u.summary,
        })) : [],
        notes: isValidation
          ? "For Architecture Validation, the Challenger also inspects locked design decisions from Stages 4–12 (style, decomposition, data, API, cross-cutting, infrastructure, quality, risks) so it can flag inconsistencies between the validation report and what was actually decided upstream."
          : "Challenger evaluates the primary artifact for this stage against requirements and architectural drivers. Upstream locked decisions from prior stages are not directly inspected by the challenge_only path; they influence this stage's primary artifact, which is the subject of evaluation.",
        captured_at: new Date().toISOString(),
      };

      parsed._meta = {
        type: "scientific_challenger_review",
        primary_artifact_id: primary.id,
        primary_artifact_title: primary.title,
        stage,
        evaluated_at: new Date().toISOString(),
        context_trace: contextTrace,
      };

      // Mirror trace onto the agent_run input so it's visible in run history
      try {
        await supabase.from("agent_runs").update({
          input: { mode: "challenge_only", primary_artifact_id: primary.id, context_trace: contextTrace },
        }).eq("id", agentRun.id);
      } catch (_e) { /* non-fatal */ }

      await supabase.from("architecture_artifacts").insert({
        project_id,
        stage,
        type: ARTIFACT_TYPES[stage] || "validation_report",
        title: `Challenger Review: ${primary.title}`,
        content: parsed,
        status: "generated",
        created_by: user_id,
        generated_by: "Challenger Architect Agent (Scientific Evaluation)",
      });

      const processingTime = Date.now() - startTime;
      await supabase.from("agent_runs").update({
        status: "completed",
        output: {
          verdict: parsed.verdict,
          overall_score: parsed.overall_score,
          confidence: parsed.confidence,
          dimensions_evaluated: (parsed.evaluation_dimensions || []).length,
          concerns: (parsed.concerns || []).length,
          processing_time_ms: processingTime,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", agentRun.id);

      try {
        const promptTokens = Math.ceil(challengerPrompt.length / 4);
        const completionTokens = Math.ceil(JSON.stringify(parsed).length / 4);
        await supabase.from("token_usage").insert({
          user_id,
          project_id,
          agent_run_id: agentRun.id,
          model: "google/gemini-2.5-flash",
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          cost_estimate: (promptTokens * 0.00000015) + (completionTokens * 0.0000006),
          stage,
          agent_name: "Challenger Architect Agent (Scientific Evaluation)",
        });
      } catch {}
    } catch (err: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[Stage ${stage}] Challenge-only background error after ${processingTime}ms:`, err);
      await supabase.from("agent_runs").update({
        status: "failed",
        error: `Challenger evaluation failed: ${(err?.message || String(err)).substring(0, 200)}`,
        completed_at: new Date().toISOString(),
      }).eq("id", agentRun.id);
    }
  };

  (globalThis as any).EdgeRuntime.waitUntil(executeChallenge());

  // Return immediately so the edge function does not hit the 150s idle timeout.
  // The client polls `agent_runs` (and `architecture_artifacts`) for completion.
  return new Response(
    JSON.stringify({
      success: true,
      queued: true,
      run_id: agentRun.id,
      agent: "Challenger Architect Agent (Scientific Evaluation)",
      status: "running",
      primary_artifact_id: primary.id,
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
