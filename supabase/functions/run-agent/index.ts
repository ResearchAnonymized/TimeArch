/**
 * run-agent — thin orchestrator.
 *
 * Per-stage configuration (schemas, prompts, agent names, artifact types,
 * challenger gates) is registered in `./stages/registry.ts` (Strategy pattern).
 * LLM access, JSON recovery, deterministic checks and the challenger-only
 * mode live in `./lib/`. This file only owns auth, project-context gathering,
 * RAG, refinement, persistence and the streaming response envelope.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { corsHeaders, jsonHeaders } from "./lib/http.ts";
import { getStageHandler, isChallengerStage } from "./stages/index.ts";
import { CHALLENGER_SCHEMA, CHALLENGER_SYSTEM_PROMPT } from "./stages/registry.ts";
import { runDeterministicChecks } from "./lib/checks.ts";
import { createLangChainLLM, invokeLangChainAgent } from "./lib/llm.ts";
import { runChallengeOnly } from "./lib/challenger.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_id, stage, user_id, options } = await req.json();

    if (!project_id || !stage || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing project_id, stage, or user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LLM_API_KEY = Deno.env.get("LLM_API_KEY");
    if (!LLM_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LLM_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ─── AUTH: verify JWT, identity, and project membership ────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: userErr } = await authedClient.auth.getClaims(token);
    const authedUserId = claimsData?.claims?.sub;
    if (userErr || !authedUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (authedUserId !== user_id) {
      return new Response(JSON.stringify({ error: "Forbidden: user_id mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isMember } = await authedClient.rpc("is_project_member", {
      _user_id: authedUserId, _project_id: project_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: not a project member" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── ARCHITECTURE PACKAGE GATE ─────────────────────────────────
    // Implementation-ready stages (16+) require an explicit human-sealed
    // architecture package recorded against Stage 15. This protects
    // automatic code generation, implementation review, and evolution from
    // running before stakeholders have signed off.
    if (stage >= 16) {
      const { getPackageLock, packageGateBlockedResponse, PACKAGE_GATE_STAGE_THRESHOLD } =
        await import("../_shared/package-lock.ts");
      if (stage >= PACKAGE_GATE_STAGE_THRESHOLD) {
        const lock = await getPackageLock(supabase, project_id);
        if (!lock.locked) return packageGateBlockedResponse(corsHeaders, stage);
      }
    }

    // ─── CHALLENGE-ONLY MODE ─────────────────────────────────────────
    // Architect explicitly asks the Challenger Architect to scientifically
    // evaluate the latest primary recommendation for this stage. Does NOT
    // regenerate the primary recommendation.
    if (options?.challenge_only === true) {
      return await runChallengeOnly({ supabase, project_id, stage, user_id, LLM_API_KEY });
    }

    const handler = getStageHandler(stage);
    if (!handler) {
      return new Response(
        JSON.stringify({ error: `No agent configured for stage ${stage}. Stages 1, 15 are manual.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const toolSchema = handler.toolSchema;
    // Admin overrides for stage system prompts (managed in /prompts).
    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPrompt = await resolvePrompt(
      supabase,
      `stage.${stage}.system`,
      handler.systemPrompt,
    );
    const agentName = handler.agentName;
    const artifactType = handler.artifactType;
    const startTime = Date.now();

    // Create agent run record
    const { data: agentRun, error: runError } = await supabase
      .from("agent_runs")
      .insert({
        project_id,
        stage,
        agent_name: agentName,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: user_id,
      })
      .select("id")
      .single();

    if (runError) {
      console.error("Failed to create agent run:", runError);
      return new Response(
        JSON.stringify({ error: "Failed to create agent run record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const executeRun = async () => {
      try {
    // Gather project context + RAG knowledge
    const [reqRes, driverRes, artifactRes, projectRes] = await Promise.all([
      supabase.from("requirements").select("*").eq("project_id", project_id).order("requirement_id"),
      supabase.from("architecture_drivers").select("*").eq("project_id", project_id).order("created_at"),
      supabase.from("architecture_artifacts").select("*").eq("project_id", project_id).order("stage, created_at"),
      supabase.from("projects").select("name, description").eq("id", project_id).single(),
    ]);

    const contextParts: string[] = [];

    if (projectRes.data) {
      contextParts.push(`PROJECT: ${projectRes.data.name}\nDescription: ${projectRes.data.description || "No description"}`);
    }

    // ─── Lock-gate enforcement ─────────────────────────────────────
    // For all stages from Architecture Design onward (Stage >= 4), only
    // requirements that have been formally locked or approved by a
    // reviewer are allowed to flow downstream. Drafts are intentionally
    // excluded so unverified work cannot influence architecture decisions.
    // Stages 1–3 (Requirement Definition phase) still see drafts so
    // analysts can refine them.
    const allRequirements = reqRes.data || [];
    const lockedRequirements = allRequirements.filter(
      (r: any) => r.status === "locked" || r.status === "approved"
    );
    const requirementsForContext = stage >= 4 ? lockedRequirements : allRequirements;
    const excludedRequirementCount = stage >= 4
      ? allRequirements.length - lockedRequirements.length
      : 0;

    if (requirementsForContext.length > 0) {
      const headerNote = stage >= 4
        ? ` — locked/approved only${excludedRequirementCount > 0 ? `; ${excludedRequirementCount} draft requirement(s) excluded by governance gate` : ""}`
        : "";
      contextParts.push(`REQUIREMENTS (${requirementsForContext.length}${headerNote}):\n${JSON.stringify(requirementsForContext.map(r => ({
        id: r.requirement_id, title: r.title, type: r.type, priority: r.priority,
        description: r.description, status: r.status
      })), null, 2)}`);
    } else if (stage >= 4 && allRequirements.length > 0) {
      contextParts.push(`REQUIREMENTS: 0 locked/approved requirements available. ${allRequirements.length} draft requirement(s) were excluded by the Stage 3 lock gate. The architecture cannot be grounded in unverified requirements — return an explicit warning in your output asking the user to lock requirements in Stage 3.`);
    }

    if (driverRes.data && driverRes.data.length > 0) {
      contextParts.push(`ARCHITECTURE DRIVERS (${driverRes.data.length}):\n${JSON.stringify(driverRes.data.map(d => ({
        label: d.label, category: d.category, priority: d.priority, description: d.description
      })), null, 2)}`);
    }

    if (artifactRes.data && artifactRes.data.length > 0) {
      let previousArtifacts = artifactRes.data.filter(a => a.stage < stage);
      previousArtifacts = previousArtifacts.filter(a => {
        const c = a.content as any;
        return !c?._meta?.type?.includes("evaluator") && !a.title?.startsWith("Evaluator Review:");
      });
      
      // For stages 6+, slim down context to prevent bloated prompts and malformed outputs
      if (stage >= 6 && previousArtifacts.length > 0) {
        const keyStages = stage >= 16
          ? [4, 5, 6, 7, 8, 13, 14]
          : Array.from({ length: stage - 1 }, (_, i) => i + 2);
        previousArtifacts = previousArtifacts.filter(a => keyStages.includes(a.stage));
        const latestPerStage = new Map<number, any>();
        for (const a of previousArtifacts) {
          if (!latestPerStage.has(a.stage) || a.created_at > latestPerStage.get(a.stage).created_at) {
            latestPerStage.set(a.stage, a);
          }
        }
        previousArtifacts = [...latestPerStage.values()].sort((a, b) => a.stage - b.stage);
        
        contextParts.push(`PREVIOUS STAGE ARTIFACTS (summary):\n${JSON.stringify(previousArtifacts.map(a => {
          const content = a.content as any;
          const slim: any = { stage: a.stage, type: a.type, title: a.title, status: a.status };
          if (content?.summary) slim.summary = content.summary;
          if (content?.recommended_style) slim.recommended_style = content.recommended_style;
          if (content?.chosen_architecture) slim.chosen_architecture = content.chosen_architecture;
          if (content?.components) slim.components = (content.components || []).map((c: any) => ({ name: c.name, type: c.type, responsibility: c.responsibility }));
          if (content?.entities) slim.entities = (content.entities || []).map((e: any) => ({ name: e.name, owner_component: e.owner_component, attributes: (e.attributes || []).map((attr: any) => `${attr.name}: ${attr.type}`) }));
          if (content?.apis) slim.apis = (content.apis || []).map((api: any) => ({ name: api.name, endpoints: (api.endpoints || []).map((ep: any) => `${ep.method} ${ep.path}`) }));
          if (content?.drivers) slim.drivers = (content.drivers || []).slice(0, 10).map((d: any) => ({ label: d.label, category: d.category, priority: d.priority }));
          if (content?.adrs) slim.adrs = (content.adrs || []).map((adr: any) => ({ id: adr.id, title: adr.title, decision: adr.decision }));
          return slim;
        }), null, 2)}`);
      } else if (previousArtifacts.length > 0) {
        contextParts.push(`PREVIOUS STAGE ARTIFACTS:\n${JSON.stringify(previousArtifacts.map(a => ({
          stage: a.stage, type: a.type, title: a.title, content: a.content, status: a.status
        })), null, 2)}`);
      }
    }

    // ─── RAG: Retrieve relevant knowledge chunks ──────────────────────
    let ragContext = "";
    let ragSources: any[] = [];
    try {
      const stageKeywordMap: Record<number, string> = {
        2: "requirements analysis risk",
        3: "architecture drivers quality attributes",
        4: "architecture style microservices monolith modular",
        5: "tradeoff evaluation quality",
        6: "decomposition modularity components",
        7: "data architecture database persistence entity relationship",
        8: "API design integration REST",
        9: "security observability resilience caching cross-cutting",
        10: "deployment infrastructure CI/CD scaling cloud",
        11: "quality attributes performance reliability security",
        12: "risk analysis mitigation threat",
        13: "validation governance compliance",
        14: "documentation ADR architecture decision",
      };
      const stageTerms = stageKeywordMap[stage] || "architecture design";
      const domainTerms = (reqRes.data || []).slice(0, 3).map((r: any) => r.title).join(" ");
      const searchTerms = `${stageTerms} ${domainTerms}`.substring(0, 200);

      let { data: knowledgeChunks } = await supabase.rpc("search_knowledge", {
        query_text: searchTerms,
        stage_filter: stage,
        max_results: 5,
      });

      if (!knowledgeChunks || knowledgeChunks.length === 0) {
        const fallback = await supabase.rpc("search_knowledge", {
          query_text: stageTerms,
          max_results: 5,
        });
        knowledgeChunks = fallback.data;
      }

      if (knowledgeChunks && knowledgeChunks.length > 0) {
        ragSources = knowledgeChunks.map((chunk: any, i: number) => ({
          ref: `REF-${i + 1}`,
          id: chunk.id,
          framework: chunk.framework,
          category: chunk.category,
          title: chunk.title,
          relevance: chunk.relevance,
          tags: chunk.tags,
        }));
        ragContext = `\n\n--- REFERENCE MATERIAL (Industry Standards) ---
You MUST ground your recommendations in these authoritative sources. Cite them where applicable.

${knowledgeChunks.map((chunk: any, i: number) => 
  `[REF-${i + 1}] ${chunk.framework.toUpperCase()} — ${chunk.title}\n${chunk.content}`
).join("\n\n---\n\n")}

--- END REFERENCE MATERIAL ---
IMPORTANT: Base your analysis on the reference material above. Cite specific frameworks when making recommendations.`;
        console.log(`[Stage ${stage}] RAG: Retrieved ${knowledgeChunks.length} knowledge chunks`);
      } else {
        console.log(`[Stage ${stage}] RAG: No matching knowledge chunks found`);
      }
    } catch (ragErr) {
      console.error(`[Stage ${stage}] RAG retrieval error (non-fatal):`, ragErr);
    }

    // Inject user preferences into the prompt for specific stages
    let preferencesContext = "";
    if (stage === 10 && options?.cloud_platform) {
      const platformMap: Record<string, string> = {
        aws: "Amazon Web Services (AWS)",
        azure: "Microsoft Azure",
        gcp: "Google Cloud Platform (GCP)",
        "multi-cloud": "Multi-Cloud (design for portability across AWS, Azure, and GCP)",
        "on-premise": "On-Premise / Hybrid Cloud",
      };
      const platformLabel = platformMap[options.cloud_platform] || options.cloud_platform;
      preferencesContext = `\n\n--- USER PREFERENCES ---\nThe user has specified their target cloud platform: ${platformLabel}.\nYou MUST design the infrastructure architecture specifically for ${platformLabel}. Use platform-specific services, naming conventions, and best practices.\n--- END USER PREFERENCES ---`;
    }

    // ─── Refinement (Cycle 2) — Human-in-the-loop critique feedback ─────
    // Architects accepted/modified Challenger concerns. Re-run the Generator with
    // explicit guidance, tagging the new artifact with _cycle and _changelog.
    let refinementContext = "";
    let refinementCycle: number | null = null;
    let previousRecommendation: any = null;
    const refinement: any = options?.refinement;
    if (refinement && Array.isArray(refinement.accepted_critiques)) {
      refinementCycle = Math.min(2, Math.max(2, Number(refinement.cycle) || 2));
      // Look up previous primary artifact to provide as baseline
      if (refinement.previous_artifact_id) {
        const { data: prev } = await supabase
          .from("architecture_artifacts")
          .select("content, title")
          .eq("id", refinement.previous_artifact_id)
          .maybeSingle();
        if (prev) {
          const slim: any = { title: prev.title };
          const c: any = prev.content || {};
          if (c.recommended_style) slim.recommended_style = c.recommended_style;
          if (c.alternatives_considered) slim.alternatives_considered = c.alternatives_considered;
          if (c.style_comparison_matrix) slim.style_comparison_matrix = c.style_comparison_matrix;
          if (c.summary) slim.summary = c.summary;
          previousRecommendation = slim;
        }
      }
      refinementContext = `\n\n--- REFINEMENT MODE (CYCLE ${refinementCycle} of 2) ---
You produced a previous recommendation. The architect reviewed Challenger concerns and decided which to apply.

PREVIOUS RECOMMENDATION (baseline to revise):
${JSON.stringify(previousRecommendation, null, 2)}

ACCEPTED CHALLENGER CONCERNS (you MUST address each):
${JSON.stringify(refinement.accepted_critiques, null, 2)}

MODIFIED CHALLENGER CONCERNS (apply with the architect's modification, not the original alternative):
${JSON.stringify(refinement.modified_critiques || [], null, 2)}

REJECTED CHALLENGER CONCERNS (do NOT change these — architect rejected them):
${JSON.stringify(refinement.rejected_critiques || [], null, 2)}

INSTRUCTIONS:
1. Produce a revised recommendation that incorporates the accepted and modified concerns.
2. Preserve everything the architect did NOT change.
3. Add a "_changelog" array to your output listing each change as: { "concern": "...", "change": "...", "reason": "..." }.
4. If a concern requires changing the recommended style, do so and update alternatives accordingly.
5. Be conservative — change only what is required by accepted/modified concerns.
--- END REFINEMENT MODE ---`;
    }

    // ─── Corrective hint (one-click "Fix" from rules-engine findings) ──
    let correctiveHintContext = "";
    const correctiveHint = typeof options?.corrective_hint === "string" ? options.corrective_hint.trim() : "";
    if (correctiveHint) {
      correctiveHintContext = `\n\n--- CORRECTIVE FIX REQUEST (HIGH PRIORITY) ---
A deterministic rules-engine check flagged an issue with the previous output for this stage. Re-run the stage and produce a NEW artifact that explicitly resolves the following finding while preserving everything else that was already valid:

${correctiveHint}

Requirements:
1. Directly address the finding above — do not ignore it.
2. Briefly explain in your output (key_findings or rationale) HOW you addressed it.
3. Keep all other valid components, dependencies, decisions, and structure unchanged unless they conflict with the fix.
4. Do not introduce unrelated changes.
--- END CORRECTIVE FIX REQUEST ---`;
    }

    const userPrompt = `Analyze the following project context and produce your output for Stage ${stage}.\n\n${contextParts.join("\n\n---\n\n")}${ragContext}${preferencesContext}${refinementContext}${correctiveHintContext}`;

    // ─── LangChain Agent Execution ────────────────────────────────────
    try {
      console.log(`[Stage ${stage}] Initializing LangChain agent: ${agentName} (prompt: ${userPrompt.length} chars)`);

      // Use appropriate token limits per stage complexity
      const maxTokens = stage === 16 ? 12000 : stage >= 17 ? 8000 : stage === 6 ? 8000 : undefined;
      const llm = createLangChainLLM(LLM_API_KEY, undefined, maxTokens);

      const { parsed: parsedContent, toolCallingUsed } = await invokeLangChainAgent(
        llm,
        systemPrompt,
        userPrompt,
        toolSchema,
      );

      const processingTime = Date.now() - startTime;
      console.log(`[Stage ${stage}] LangChain agent completed — tool_calling: ${toolCallingUsed}, time: ${processingTime}ms`);

      // Check for parse errors — retry once with explicit JSON instruction
      if (parsedContent?.parse_error || parsedContent?._recovered_from_text) {
        console.warn(`[Stage ${stage}] First attempt produced ${parsedContent?.parse_error ? "unparseable" : "text-recovered"} output — retrying with reinforced prompt`);
        
        try {
          const retryLLM = createLangChainLLM(LLM_API_KEY, "google/gemini-2.5-flash", maxTokens);
          const reinforcedPrompt = `CRITICAL: You MUST respond by calling the "${toolSchema.name}" function with valid JSON arguments. Do NOT respond with plain text. Do NOT wrap your response in markdown code fences. Use the tool/function provided.\n\n${userPrompt}`;
          
          const { parsed: retryParsed, toolCallingUsed: retryToolUsed } = await invokeLangChainAgent(
            retryLLM,
            systemPrompt + "\n\nIMPORTANT: You MUST use the provided tool/function to structure your response. Never respond with plain text.",
            reinforcedPrompt,
            toolSchema,
          );
          
          const retryTime = Date.now() - startTime;
          console.log(`[Stage ${stage}] Retry completed — tool_calling: ${retryToolUsed}, time: ${retryTime}ms`);
          
          if (!retryParsed?.parse_error && !retryParsed?._recovered_from_text) {
            // Retry succeeded — use this result instead
            Object.assign(parsedContent, retryParsed);
            console.log(`[Stage ${stage}] Retry produced valid structured output`);
          } else if (parsedContent?.parse_error && retryParsed?._recovered_from_text) {
            // Retry at least recovered text — use that over hard failure
            Object.assign(parsedContent, retryParsed);
            delete parsedContent.parse_error;
            console.log(`[Stage ${stage}] Retry recovered text output (better than hard failure)`);
          }
        } catch (retryErr) {
          console.error(`[Stage ${stage}] Retry failed:`, retryErr);
        }
      }

      // If still a hard parse error after retry, fail gracefully
      if (parsedContent?.parse_error) {
        console.error(`[Stage ${stage}] Agent output could not be parsed even after retry`);
        await supabase.from("agent_runs").update({
          status: "failed",
          error: "Failed to parse agent output. The AI response was malformed. Please retry.",
          output: { raw_output_preview: (parsedContent.raw_output || "").substring(0, 500), processing_time_ms: Date.now() - startTime },
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);

        return new Response(
          JSON.stringify({ error: "Failed to parse agent output. Please retry.", processing_time_ms: Date.now() - startTime }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Deterministic validation ─────────────────────────────────
      // Use the gated requirement set so coverage checks reflect what
      // actually flowed into the agent (Stage >= 4 sees only locked/approved).
      const validationResult = runDeterministicChecks(stage, parsedContent, {
        requirements: requirementsForContext,
      });

      parsedContent._validation = {
        tool_calling_used: toolCallingUsed,
        schema_name: toolSchema.name,
        deterministic_checks: validationResult,
        timestamp: new Date().toISOString(),
        framework: "langchain",
        processing_time_ms: processingTime,
      };

      if (ragSources.length > 0) {
        parsedContent._rag_sources = ragSources;
      }

      const artifactTitle = parsedContent.title || `${agentName} Output`;

      // ─── Challenger Architect Agent (per-stage opt-in via handler) ────
      let challengerResult: any = null;
      if (isChallengerStage(stage)) {
        try {
          console.log(`[Stage ${stage}] Running Challenger Architect Agent...`);

          // Slim down the primary output for challenger context to avoid token bloat
          const primarySummary: any = { title: parsedContent.title, summary: parsedContent.summary };
          if (parsedContent.recommended_style) primarySummary.recommended_style = parsedContent.recommended_style;
          if (parsedContent.chosen_architecture) primarySummary.chosen_architecture = parsedContent.chosen_architecture;
          if (parsedContent.architect_verdict) primarySummary.architect_verdict = parsedContent.architect_verdict;
          if (parsedContent.risks) primarySummary.risks = parsedContent.risks.slice(0, 5);
          if (parsedContent.strengths) primarySummary.strengths = parsedContent.strengths;
          if (parsedContent.weaknesses) primarySummary.weaknesses = parsedContent.weaknesses;
          if (parsedContent.evaluations) primarySummary.evaluations = parsedContent.evaluations.map((e: any) => ({ attribute: e.attribute, score: e.score, rating: e.rating }));

          const challengerPrompt = `You are reviewing the following architectural output from Stage ${stage} (${agentName}).

PRIMARY AGENT OUTPUT (summary):
${JSON.stringify(primarySummary, null, 2)}

PROJECT: ${projectRes.data?.name || "Unknown"}
REQUIREMENTS COUNT: ${(reqRes.data || []).length}

Now critically evaluate this recommendation. Find weaknesses, blind spots, and alternative approaches.`;

          const challengerLLM = createLangChainLLM(LLM_API_KEY);
          const { parsed: chalParsed } = await invokeLangChainAgent(
            challengerLLM,
            handler.challengerSystemPrompt ?? CHALLENGER_SYSTEM_PROMPT,
            challengerPrompt,
            CHALLENGER_SCHEMA,
          );
          challengerResult = chalParsed;
          console.log(`[Stage ${stage}] Challenger Architect completed — verdict: ${challengerResult?.verdict}`);
        } catch (chalErr) {
          console.error(`[Stage ${stage}] Challenger Architect error (non-fatal):`, chalErr);
        }
      }

      // ─── Store primary artifact (tag cycle for refinement loops) ──
      if (refinementCycle) {
        parsedContent._cycle = refinementCycle;
        parsedContent._refined_from = refinement?.previous_artifact_id || null;
      } else {
        parsedContent._cycle = 1;
      }
      const cycleSuffix = refinementCycle && refinementCycle > 1 ? ` (Refined v${refinementCycle})` : "";
      // Stamp the artifact's `version` column to match the cycle so downstream
      // UI (Challenger CycleTimeline "New version" badge, version pickers,
      // diff viewers) can clearly distinguish v1 vs v2 of the same stage.
      const artifactVersion = refinementCycle && refinementCycle > 1 ? refinementCycle : 1;
      const { error: artifactError } = await supabase.from("architecture_artifacts").insert({
        project_id,
        stage,
        type: artifactType,
        title: `${artifactTitle}${cycleSuffix}`,
        content: parsedContent,
        status: "generated",
        version: artifactVersion,
        created_by: user_id,
        generated_by: `${agentName} (LangChain Agent)${refinementCycle && refinementCycle > 1 ? " — Cycle 2 Refinement" : ""}`,
      });

      if (artifactError) {
        console.error("Failed to store artifact:", artifactError);
      }

      // ─── Store challenger artifact (if exists) ────────────────────
      if (challengerResult && !challengerResult.parse_error) {
        const { error: chalArtifactError } = await supabase.from("architecture_artifacts").insert({
          project_id,
          stage,
          type: artifactType,
          title: `Challenger Review: ${artifactTitle}`,
          content: {
            ...challengerResult,
            _meta: { type: "challenger_review", primary_artifact_title: artifactTitle, stage },
          },
          status: "generated",
          created_by: user_id,
          generated_by: "Challenger Architect Agent (LangChain Agent)",
        });

        if (chalArtifactError) {
          console.error("Failed to store challenger artifact:", chalArtifactError);
        }
      }

      // ─── Log token usage ──────────────────────────────────────────
      // Note: actual token counts from LLM API aren't exposed yet,
      // so we estimate based on prompt/response lengths as a rough proxy
      const estimatedPromptTokens = Math.ceil(userPrompt.length / 4);
      const estimatedCompletionTokens = Math.ceil(JSON.stringify(parsedContent).length / 4);
      const estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens;
      // Rough cost: ~$0.15/1M input, ~$0.60/1M output for gemini-2.5-flash
      const estimatedCost = (estimatedPromptTokens * 0.00000015) + (estimatedCompletionTokens * 0.0000006);

      try {
        await supabase.from("token_usage").insert({
          user_id,
          project_id,
          agent_run_id: agentRun.id,
          model: "google/gemini-2.5-flash",
          prompt_tokens: estimatedPromptTokens,
          completion_tokens: estimatedCompletionTokens,
          total_tokens: estimatedTotalTokens,
          cost_estimate: estimatedCost,
          stage,
          agent_name: agentName,
        });
        console.log(`[Stage ${stage}] Token usage logged: ~${estimatedTotalTokens} tokens, ~$${estimatedCost.toFixed(6)}`);
      } catch (tokenErr) {
        console.error(`[Stage ${stage}] Token usage logging error (non-fatal):`, tokenErr);
      }

      // If challenger ran, log its tokens too
      if (challengerResult && !challengerResult.parse_error) {
        try {
          const chalPromptTokens = Math.ceil(1500 / 4); // challenger prompt is shorter
          const chalCompletionTokens = Math.ceil(JSON.stringify(challengerResult).length / 4);
          await supabase.from("token_usage").insert({
            user_id,
            project_id,
            agent_run_id: agentRun.id,
            model: "google/gemini-2.5-flash",
            prompt_tokens: chalPromptTokens,
            completion_tokens: chalCompletionTokens,
            total_tokens: chalPromptTokens + chalCompletionTokens,
            cost_estimate: (chalPromptTokens * 0.00000015) + (chalCompletionTokens * 0.0000006),
            stage,
            agent_name: "Challenger Architect Agent",
          });
        } catch {}
      }

      // ─── Update agent run ─────────────────────────────────────────
      await supabase.from("agent_runs").update({
        status: "completed",
        output: {
          artifact_title: artifactTitle,
          tool_calling: toolCallingUsed,
          schema_used: toolSchema.name,
          challenger_ran: !!challengerResult,
          challenger_verdict: challengerResult?.verdict || null,
          validation: validationResult,
          framework: "langchain",
          processing_time_ms: processingTime,
          estimated_tokens: estimatedTotalTokens,
        },
        completed_at: new Date().toISOString(),
      }).eq("id", agentRun.id);

      // Log to audit
      await supabase.from("audit_log").insert({
        project_id,
        user_id,
        entity_type: "agent_run",
        entity_id: agentRun.id,
        action: "agent_completed",
        details: {
          agent: agentName,
          stage,
          artifact_title: artifactTitle,
          tool_calling: toolCallingUsed,
          challenger_verdict: challengerResult?.verdict || null,
          validation: validationResult,
          framework: "langchain",
          processing_time_ms: processingTime,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          agent: agentName,
          artifact_title: artifactTitle,
          tool_calling: toolCallingUsed,
          framework: "langchain",
          validation: validationResult,
          processing_time_ms: processingTime,
          estimated_tokens: estimatedTotalTokens,
          challenger: challengerResult ? {
            verdict: challengerResult.verdict,
            confidence: challengerResult.confidence,
            summary: challengerResult.summary,
          } : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (aiErr: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[Stage ${stage}] LangChain agent error after ${processingTime}ms:`, aiErr);

      const errMsg = aiErr?.message || String(aiErr);
      
      // Handle rate limiting and payment errors
      if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Rate limit")) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error: "Rate limited. Please wait a moment and try again.",
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again.", processing_time_ms: processingTime }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (errMsg.includes("402") || errMsg.includes("payment") || errMsg.includes("Payment")) {
        await supabase.from("agent_runs").update({
          status: "failed",
          error: "Credits exhausted. Please add funds to continue.",
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds.", processing_time_ms: processingTime }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Timeout detection
      const isTimeout = errMsg.includes("timeout") || errMsg.includes("Timeout") || errMsg.includes("DEADLINE") || processingTime > 55000;
      const friendlyError = isTimeout
        ? `Agent timed out after ${Math.round(processingTime / 1000)}s. This stage may require too much context. Please retry — the system will use optimized context.`
        : `Agent execution failed: ${errMsg.substring(0, 200)}`;

      await supabase.from("agent_runs").update({
        status: "failed",
        error: friendlyError,
        completed_at: new Date().toISOString(),
      }).eq("id", agentRun.id);

      // Return 200 with error in body so client can always read it
      return new Response(
        JSON.stringify({ error: friendlyError, processing_time_ms: processingTime }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
      } catch (e) {
        console.error(`[Stage ${stage}] Background execution error:`, e);
        await supabase.from("agent_runs").update({
          status: "failed",
          error: e instanceof Error ? e.message : "Unknown error",
          completed_at: new Date().toISOString(),
        }).eq("id", agentRun.id);
      }
    };

    (globalThis as any).EdgeRuntime.waitUntil(executeRun());

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        run_id: agentRun.id,
        agent: agentName,
        status: "running",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("run-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
