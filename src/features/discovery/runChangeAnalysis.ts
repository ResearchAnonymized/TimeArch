/**
 * One-shot brownfield analysis: runs the heavy stages behind the scenes,
 * then builds a stakeholder + LLM Change Package.
 */
import { supabase } from "@/integrations/supabase/client";
import { discoveryService } from "@/services/discoveryService";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf, type Result, ok, err } from "@/lib/result";
import { buildChangePackage, type ChangePackage } from "@/lib/changePackage";
import { buildProposedArchitecture } from "@/lib/proposedArchitecture";
import { persistProposedArchitectureArtifact } from "@/lib/discoveryPipeline";
import type { SystemInventory } from "@/lib/systemInventory";

export type AnalysisStageKey =
  | "score"
  | "mapping"
  | "ripple"
  | "quality"
  | "alternatives"
  | "plan"
  | "package";

export const ANALYSIS_STAGES: Array<{ key: AnalysisStageKey; label: string }> = [
  { key: "score", label: "Scoring the change" },
  { key: "mapping", label: "Mapping to architecture" },
  { key: "ripple", label: "Tracing blast radius" },
  { key: "quality", label: "Assessing quality impact" },
  { key: "alternatives", label: "Comparing options" },
  { key: "plan", label: "Building delivery plan" },
  { key: "package", label: "Assembling Change Package" },
];

export interface RunChangeAnalysisArgs {
  projectId: string;
  featureChangeId: string;
  inventory?: SystemInventory | null;
  onStage?: (key: AnalysisStageKey, status: "running" | "done" | "failed", detail?: string) => void;
}

async function loadPackageData(projectId: string, featureChangeId: string) {
  const [
    projectRes,
    fcRes,
    importsRes,
    mappingsRes,
    ripplesRes,
    qualityRes,
    altsRes,
    workRes,
    adrRes,
  ] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).single(),
    supabase.from("feature_changes").select("*").eq("id", featureChangeId).single(),
    supabase
      .from("project_imports")
      .select("kind,source_label,status,parsed_summary")
      .eq("project_id", projectId),
    supabase
      .from("feature_mappings")
      .select("element_type,element_ref,relationship,confidence")
      .eq("feature_change_id", featureChangeId),
    supabase
      .from("impact_findings")
      .select("impacted_element_type,impacted_element_ref,classification,severity,recommended_action")
      .eq("feature_change_id", featureChangeId),
    supabase
      .from("quality_impact_assessments")
      .select("attribute,direction,severity,rationale")
      .eq("feature_change_id", featureChangeId),
    supabase
      .from("architecture_alternatives")
      .select("name,description,pros,cons,risk,recommended")
      .eq("feature_change_id", featureChangeId),
    supabase
      .from("feature_work_items")
      .select("title,description,category,priority,effort,validation_criteria,dependencies,ordering")
      .eq("feature_change_id", featureChangeId)
      .order("ordering", { ascending: true }),
    supabase
      .from("adr_records")
      .select("title,decision,consequences,status")
      .eq("feature_change_id", featureChangeId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (!fcRes.data) throw new Error("Feature change not found");

  const asStringList = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    return [];
  };

  return {
    projectName: projectRes.data?.name || "Project",
    featureChange: fcRes.data,
    imports: (importsRes.data || []).map((i) => ({
      kind: i.kind,
      source_label: i.source_label,
      status: i.status,
      parsed_summary:
        i.parsed_summary && typeof i.parsed_summary === "object" && !Array.isArray(i.parsed_summary)
          ? (i.parsed_summary as Record<string, unknown>)
          : null,
    })),
    mappings: mappingsRes.data || [],
    ripples: ripplesRes.data || [],
    quality: qualityRes.data || [],
    alternatives: (altsRes.data || []).map((a) => ({
      title: a.name,
      summary: a.description,
      tradeoffs: [a.risk ? `Risk: ${a.risk}` : null, Array.isArray(a.pros) ? `Pros: ${(a.pros as string[]).join("; ")}` : null, Array.isArray(a.cons) ? `Cons: ${(a.cons as string[]).join("; ")}` : null]
        .filter(Boolean)
        .join(" · "),
      is_preferred: !!a.recommended,
    })),
    workItems: (workRes.data || []).map((w) => ({
      title: w.title,
      description: w.description,
      category: w.category,
      priority: w.priority,
      effort: w.effort,
      validation_criteria: asStringList(w.validation_criteria),
      dependencies: asStringList(w.dependencies),
      ordering: w.ordering,
    })),
    adr: adrRes.data?.[0] || null,
  };
}

export async function runChangeAnalysis(
  args: RunChangeAnalysisArgs,
): Promise<Result<ChangePackage>> {
  const { projectId, featureChangeId, onStage } = args;
  const notify = onStage ?? (() => undefined);

  const stages: Array<{
    key: AnalysisStageKey;
    run: () => Promise<{ ok: boolean; detail?: string }>;
  }> = [
    {
      key: "score",
      run: async () => {
        const r = await invokeFunction<
          { project_id: string; feature_change_ids?: string[] },
          { scored?: number; error?: string }
        >("score-feature-changes", {
          project_id: projectId,
          feature_change_ids: [featureChangeId],
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        if (r.value.error) return { ok: false, detail: r.value.error };
        return { ok: true, detail: `scored ${r.value.scored ?? 1}` };
      },
    },
    {
      key: "mapping",
      run: async () => {
        const r = await discoveryService.mapFeatureToArchitecture({
          feature_change_id: featureChangeId,
          replace: true,
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        const v = r.value as { mapping_count?: number; error?: string };
        if (v.error) return { ok: false, detail: v.error };
        return { ok: true, detail: `${v.mapping_count ?? 0} mappings` };
      },
    },
    {
      key: "ripple",
      run: async () => {
        const r = await discoveryService.analyzeRipple({
          feature_change_id: featureChangeId,
          replace: true,
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        const v = r.value as { impact_count?: number; error?: string };
        if (v.error) return { ok: false, detail: v.error };
        return { ok: true, detail: `${v.impact_count ?? 0} impacts` };
      },
    },
    {
      key: "quality",
      run: async () => {
        const r = await discoveryService.assessQualityImpact({
          feature_change_id: featureChangeId,
          replace: true,
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        const v = r.value as { assessment_count?: number; error?: string };
        if (v.error) return { ok: false, detail: v.error };
        return { ok: true, detail: `${v.assessment_count ?? 0} attributes` };
      },
    },
    {
      key: "alternatives",
      run: async () => {
        const r = await discoveryService.generateAlternatives({
          feature_change_id: featureChangeId,
          replace: true,
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        const v = r.value as { alternative_count?: number; error?: string };
        if (v.error) return { ok: false, detail: v.error };
        return { ok: true, detail: `${v.alternative_count ?? 0} options` };
      },
    },
    {
      key: "plan",
      run: async () => {
        const r = await discoveryService.planFeatureImplementation({
          feature_change_id: featureChangeId,
          replace: true,
        });
        if (!r.ok) return { ok: false, detail: errorOf(r).message };
        const v = r.value as { work_item_count?: number; error?: string };
        if (v.error) return { ok: false, detail: v.error };
        return { ok: true, detail: `${v.work_item_count ?? 0} tasks` };
      },
    },
  ];

  try {
    for (const stage of stages) {
      notify(stage.key, "running");
      const res = await stage.run();
      if (!res.ok) {
        notify(stage.key, "failed", res.detail);
        return err({ code: "function_error", message: `${stage.key}: ${res.detail || "failed"}` });
      }
      notify(stage.key, "done", res.detail);
    }

    notify("package", "running");
    const data = await loadPackageData(projectId, featureChangeId);
    const createdBy = data.featureChange.created_by as string | null | undefined;

    let proposedArchitecture = null;
    if (args.inventory) {
      proposedArchitecture = buildProposedArchitecture({
        inventory: args.inventory,
        featureChange: data.featureChange,
        mappings: data.mappings,
        ripples: data.ripples.map((r) => ({
          ...r,
          reason: (r as { reason?: string }).reason,
        })),
        workItems: data.workItems,
      });
      await persistProposedArchitectureArtifact(
        projectId,
        featureChangeId,
        proposedArchitecture,
        createdBy,
      );
    }

    const pkg = buildChangePackage({
      projectName: data.projectName,
      featureChange: data.featureChange,
      imports: data.imports,
      mappings: data.mappings,
      ripples: data.ripples,
      quality: data.quality,
      alternatives: data.alternatives,
      workItems: data.workItems,
      adr: data.adr,
      baselineBrief: args.inventory?.baselineCodingBrief ?? null,
      asIsMermaid: args.inventory?.mermaidAsIs ?? null,
      proposedArchitecture: proposedArchitecture
        ? {
            mermaidProposed: proposedArchitecture.mermaidProposed,
            impactSummaryMarkdown: proposedArchitecture.impactSummaryMarkdown,
            changeCodingBrief: proposedArchitecture.changeCodingBrief,
            proposedFeatures: proposedArchitecture.proposedFeatures,
            stats: {
              new: proposedArchitecture.stats.new,
              modified: proposedArchitecture.stats.modified,
              ripple: proposedArchitecture.stats.ripple,
              unchanged: proposedArchitecture.stats.unchanged,
            },
          }
        : null,
    });

    // Persist for later download / document editor (best-effort)
    if (createdBy) {
      await supabase.from("architecture_artifacts").insert({
        project_id: projectId,
        stage: 14,
        type: "executive_summary",
        title: pkg.title,
        content: {
          _meta: {
            kind: "change_package",
            feature_change_id: featureChangeId,
            generated_at: pkg.generatedAt,
          },
          markdown: pkg.markdown,
          stats: pkg.stats,
        },
        status: "draft",
        generated_by: "Change Package Builder",
        created_by: createdBy,
      });
    }

    notify("package", "done", `${pkg.stats.workItems} tasks packaged`);
    return ok(pkg);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    notify("package", "failed", message);
    return err({ code: "unknown", message });
  }
}
