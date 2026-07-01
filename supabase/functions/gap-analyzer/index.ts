// Gap Analyzer Agent (Brownfield) — compares as-is reverse-engineered artifacts
import { getLlmApiKey, getLlmChatCompletionsUrl } from "../_shared/llm-config.ts";
// against ISO 25010 / AWS Well-Architected pillars and persists deficits to
// public.architecture_gaps for the Evolution Plan workspace to consume.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ─── Heuristic baseline (always run, cheap, deterministic) ─────────────────
function heuristicGaps(artifacts: any[], reqs: any[]): any[] {
  const gaps: any[] = [];
  const summarize = (a: any) => `${a.title} (Stage ${a.stage})`;
  const repoArt = artifacts.find((a) => a.stage === 6 && a.content?._meta?.provenance === "reverse-engineered");
  const dataArt = artifacts.find((a) => a.stage === 7 && a.content?._meta?.provenance === "reverse-engineered");
  const apiArt = artifacts.find((a) => a.stage === 8 && a.content?._meta?.provenance === "reverse-engineered");
  const infraArt = artifacts.find((a) => a.stage === 10 && a.content?._meta?.provenance === "reverse-engineered");
  const adrArts = artifacts.filter((a) => a.stage === 14 && a.content?._meta?.provenance === "reverse-engineered");

  if (!apiArt) gaps.push({
    category: "Interoperability", framework: "iso_25010",
    title: "No API contract on file",
    current_state: "No OpenAPI / API spec was imported.",
    target_state: "Versioned OpenAPI 3.x contract under source control.",
    severity: "high", effort: "medium",
    recommendation: "Generate an OpenAPI spec from the live system (e.g. swagger-jsdoc, FastAPI export) and re-import.",
  });
  if (!dataArt) gaps.push({
    category: "Maintainability", framework: "iso_25010",
    title: "No persisted database schema",
    current_state: "No SQL DDL or schema export was imported.",
    target_state: "Versioned schema (DDL or migration history) under source control.",
    severity: "high", effort: "low",
    recommendation: "Export DDL from the database (`pg_dump --schema-only`) and re-import.",
  });
  if (!infraArt || !infraArt.content?.signals) gaps.push({
    category: "Reliability (Operability)", framework: "aws_wa",
    title: "Infrastructure-as-code not detected",
    current_state: "No Dockerfile / Kubernetes / Terraform signals found in the repo import.",
    target_state: "Infrastructure described as code with reproducible deployments.",
    severity: "high", effort: "high",
    recommendation: "Introduce IaC (Terraform/Pulumi) and container manifests for every deployable unit.",
  });
  if (infraArt?.content?.signals && !infraArt.content.signals.github_actions) gaps.push({
    category: "Operational Excellence", framework: "aws_wa",
    title: "No CI/CD pipeline detected",
    current_state: "No `.github/workflows/` or equivalent CI configuration present.",
    target_state: "Automated build, test and deploy pipeline on every change.",
    severity: "medium", effort: "medium",
    recommendation: "Add a pipeline (GitHub Actions / GitLab CI) covering lint, test, build and deploy.",
  });
  if (repoArt?.content?.components?.length > 8) gaps.push({
    category: "Modularity", framework: "iso_25010",
    title: "High component count without documented boundaries",
    current_state: `${repoArt.content.components.length} top-level components inferred; no decomposition rationale captured.`,
    target_state: "Each component has a clear responsibility, public contract and ownership.",
    severity: "medium", effort: "medium",
    recommendation: "Hold an event-storming or domain-modelling workshop and reify boundaries with ADRs.",
    source_artifact_ids: [repoArt.id],
  });
  if (adrArts.length === 0) gaps.push({
    category: "Maintainability (Analysability)", framework: "iso_25010",
    title: "No Architecture Decision Records",
    current_state: "No ADRs imported or authored.",
    target_state: "ADRs (MADR format) for every significant decision.",
    severity: "medium", effort: "low",
    recommendation: "Adopt the MADR template and back-fill ADRs for the top 5 historical decisions.",
  });
  if (reqs.length === 0) gaps.push({
    category: "Functional Suitability", framework: "iso_29148",
    title: "No requirements captured",
    current_state: "No SRS / BRD imported and no requirements authored.",
    target_state: "Requirements baseline aligned to ISO/IEC/IEEE 29148.",
    severity: "high", effort: "medium",
    recommendation: "Run Stage 1 (Requirement Collection) on the existing system to capture as-is + to-be requirements.",
  });
  if (reqs.length > 0 && !reqs.some((r) => r.type === "non_functional")) gaps.push({
    category: "Performance Efficiency / Reliability", framework: "iso_25010",
    title: "No non-functional requirements (NFRs)",
    current_state: "Imported requirements contain only functional items.",
    target_state: "Quantified NFRs for performance, availability, security and operability.",
    severity: "high", effort: "medium",
    recommendation: "Author NFRs with measurable targets (P95 latency, RTO/RPO, availability SLO).",
  });

  return gaps.map((g) => ({
    ...g,
    description: g.description || `${g.current_state} → ${g.target_state}`,
    source_artifact_ids: g.source_artifact_ids || [
      repoArt?.id, dataArt?.id, apiArt?.id, infraArt?.id,
    ].filter(Boolean),
  }));
}

// ─── Optional LLM enrichment (best-effort, never blocks) ──────────────────
async function llmGaps(context: string, supabase: any): Promise<any[]> {
  try {
    const DEFAULT_GAP_PROMPT = "You are an architecture reviewer. Given an as-is system summary, return ISO/IEC 25010 and AWS Well-Architected gaps as STRICT JSON: {\"gaps\":[{\"category\":\"\",\"framework\":\"iso_25010|aws_wa\",\"title\":\"\",\"current_state\":\"\",\"target_state\":\"\",\"severity\":\"low|medium|high|critical\",\"effort\":\"low|medium|high\",\"recommendation\":\"\"}]} — max 8 gaps, no prose.";
    const { resolvePrompt } = await import("../_shared/prompts.ts");
    const systemPrompt = await resolvePrompt(supabase, "gap-analyzer.system", DEFAULT_GAP_PROMPT);
    const res = await fetch(getLlmChatCompletionsUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context.slice(0, 12000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const txt = j.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed.gaps) ? parsed.gaps : [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return ok({ error: "Missing authorization" }, 401);
    const token = auth.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ud } = await userClient.auth.getUser(token);
    const user = ud?.user;
    if (!user) return ok({ error: "Unauthorized" }, 401);

    const { project_id, replace } = await req.json();
    if (!project_id) return ok({ error: "project_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", { _user_id: user.id, _project_id: project_id });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const { data: project } = await supabase.from("projects").select("mode,name").eq("id", project_id).single();
    if (project?.mode !== "brownfield") {
      return ok({ error: "Gap analysis is only available for brownfield projects." }, 200);
    }

    const [{ data: artifacts }, { data: reqs }] = await Promise.all([
      supabase.from("architecture_artifacts").select("id,stage,title,content").eq("project_id", project_id),
      supabase.from("requirements").select("id,type,title").eq("project_id", project_id),
    ]);

    // Track agent_run for traceability
    const { data: run } = await supabase.from("agent_runs").insert({
      project_id, agent_name: "Gap Analyzer Agent", stage: 11,
      status: "running", triggered_by: user.id,
      input: { mode: "brownfield_gap_analysis" }, started_at: new Date().toISOString(),
    }).select().single();

    const heur = heuristicGaps(artifacts || [], reqs || []);
    const ctxSummary = JSON.stringify({
      artifacts: (artifacts || []).map((a: any) => ({ stage: a.stage, title: a.title, summary: a.content?.summary, signals: a.content?.signals })),
      requirement_count: (reqs || []).length,
    });
    const llm = await llmGaps(ctxSummary, supabase);

    // Dedupe by title
    const seen = new Set<string>();
    const merged = [...heur, ...llm].filter((g) => {
      const k = (g.title || "").toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (replace) {
      await supabase.from("architecture_gaps").delete().eq("project_id", project_id).eq("status", "open");
    }

    if (merged.length) {
      await supabase.from("architecture_gaps").insert(merged.map((g: any) => ({
        project_id,
        category: g.category || "General",
        framework: g.framework || "iso_25010",
        title: String(g.title || "Untitled gap").slice(0, 200),
        description: g.description || `${g.current_state || ""} → ${g.target_state || ""}`,
        current_state: g.current_state || null,
        target_state: g.target_state || null,
        severity: ["low", "medium", "high", "critical"].includes(g.severity) ? g.severity : "medium",
        effort: ["low", "medium", "high"].includes(g.effort) ? g.effort : "medium",
        recommendation: g.recommendation || null,
        source_artifact_ids: g.source_artifact_ids || [],
        status: "open",
        agent_run_id: run?.id,
        created_by: user.id,
      })));
    }

    if (run?.id) {
      await supabase.from("agent_runs").update({
        status: "completed",
        output: { gap_count: merged.length, heuristic: heur.length, llm: llm.length },
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }

    return ok({ project_id, gap_count: merged.length, gaps: merged });
  } catch (e: any) {
    return ok({ error: e?.message || "Internal error" }, 200);
  }
});
