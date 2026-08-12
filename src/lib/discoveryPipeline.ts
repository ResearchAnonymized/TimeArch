/**
 * Persist / restore brownfield discovery pipeline state (revision + proposed architecture)
 * so reopening a project does not force re-analysis.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProposedArchitecture } from "@/lib/proposedArchitecture";
import type { DevHandoff, GateKey } from "@/lib/devHandoff";
import { rebuildHandoffExports } from "@/lib/devHandoff";

export type PipelineSnapshot = {
  revisionAnalysisId: string;
  revisionIds: string[];
  analysisDone: boolean;
  savedAt: string;
};

const LS_PIPELINE = (projectId: string) => `timearch.pipeline.${projectId}`;

export function readPipelineLocal(projectId: string): PipelineSnapshot | null {
  try {
    const raw = window.localStorage.getItem(LS_PIPELINE(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as PipelineSnapshot;
  } catch {
    return null;
  }
}

export function writePipelineLocal(projectId: string, snap: PipelineSnapshot) {
  try {
    window.localStorage.setItem(LS_PIPELINE(projectId), JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export async function persistPipelineArtifact(
  projectId: string,
  snap: PipelineSnapshot,
  createdBy?: string | null,
) {
  writePipelineLocal(projectId, snap);
  if (!createdBy) return;
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 14,
    type: "executive_summary",
    title: "Discovery pipeline state",
    content: {
      _meta: {
        kind: "discovery_pipeline",
        generated_at: snap.savedAt,
      },
      ...snap,
    },
    status: "draft",
    generated_by: "Discovery Pipeline",
    created_by: createdBy,
  });
}

export async function loadLatestPipelineArtifact(
  projectId: string,
): Promise<PipelineSnapshot | null> {
  const { data } = await supabase
    .from("architecture_artifacts")
    .select("content,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of data || []) {
    const content = row.content as Record<string, unknown> | null;
    const meta = content?._meta as Record<string, unknown> | undefined;
    if (meta?.kind !== "discovery_pipeline") continue;
    const id = content?.revisionAnalysisId;
    if (typeof id !== "string" || !id) continue;
    return {
      revisionAnalysisId: id,
      revisionIds: Array.isArray(content.revisionIds)
        ? content.revisionIds.map(String)
        : [],
      analysisDone: Boolean(content.analysisDone),
      savedAt: String(content.savedAt || row.created_at || new Date().toISOString()),
    };
  }
  return null;
}

export async function persistProposedArchitectureArtifact(
  projectId: string,
  featureChangeId: string,
  proposed: ProposedArchitecture,
  createdBy?: string | null,
) {
  if (!createdBy) return;
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 14,
    type: "system_context",
    title: `Proposed architecture: ${proposed.featureTitle}`,
    content: {
      _meta: {
        kind: "proposed_architecture",
        feature_change_id: featureChangeId,
        generated_at: new Date().toISOString(),
      },
      proposed,
    },
    status: "draft",
    generated_by: "Proposed Architecture",
    created_by: createdBy,
  });
}

export async function loadProposedArchitectureArtifact(
  projectId: string,
  featureChangeId: string,
): Promise<ProposedArchitecture | null> {
  const { data } = await supabase
    .from("architecture_artifacts")
    .select("content,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of data || []) {
    const content = row.content as Record<string, unknown> | null;
    const meta = content?._meta as Record<string, unknown> | undefined;
    if (meta?.kind !== "proposed_architecture") continue;
    if (meta.feature_change_id !== featureChangeId) continue;
    const proposed = content?.proposed as ProposedArchitecture | undefined;
    if (proposed?.mermaidProposed) return proposed;
  }
  return null;
}

type StoredHandoffContent = {
  _meta?: {
    kind?: string;
    feature_change_id?: string;
    generated_at?: string;
    status?: string;
    approvals?: Partial<
      Record<GateKey, { approvedBy?: string; approvedAt?: string; note?: string }>
    >;
  };
  human_markdown?: string;
  machine_markdown?: string;
  full_markdown?: string;
  machine_json?: DevHandoff["machineJson"];
  acceptance_criteria?: DevHandoff["acceptanceCriteria"];
  test_cases?: DevHandoff["testCases"];
  adrs?: DevHandoff["adrs"];
  files_to_touch?: string[];
  mermaid_proposed?: string;
  mermaid_as_is?: string;
  recovered_features?: string[];
  current_behavior?: string;
  desired_behavior?: string;
  architecture_narrative?: DevHandoff["architectureNarrative"];
  impact_stats?: DevHandoff["impactStats"];
  stats?: DevHandoff["stats"];
  summary_markdown?: string;
  impact_checklist_markdown?: string;
  plan_markdown?: string;
  adr_markdown?: string;
  test_plan_markdown?: string;
  implementation_brief?: string;
  proposed_features?: string[];
};

export async function loadStoredHandoff(
  projectId: string,
  featureChangeId: string,
  projectName: string,
): Promise<DevHandoff | null> {
  const { data } = await supabase
    .from("architecture_artifacts")
    .select("content,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of data || []) {
    const content = row.content as StoredHandoffContent | null;
    const meta = content?._meta;
    if (meta?.kind !== "dev_handoff") continue;
    if (meta.feature_change_id !== featureChangeId) continue;
    if (!content?.full_markdown && !content?.human_markdown) continue;

    const approvals = meta.approvals || {};
    const gateDefs: Array<{ key: GateKey; label: string; role: string; checks: string }> = [
      {
        key: "requirements",
        label: "Requirements",
        role: "Product / stakeholder",
        checks: "Desired behavior matches the request; scope is not over-expanded",
      },
      {
        key: "architecture",
        label: "Architecture",
        role: "Architect / tech lead",
        checks: "Diagram, ADRs, and files match the real system; ungrounded ripples excluded",
      },
      {
        key: "delivery",
        label: "Delivery readiness",
        role: "Tech lead / senior engineer",
        checks: "Plan, tests, and acceptance criteria are implementable; ready for development",
      },
    ];
    const gates = gateDefs.map((g) => {
      const a = approvals[g.key];
      return {
        key: g.key,
        label: g.label,
        role: g.role,
        checks: g.checks,
        approved: Boolean(a?.approvedAt),
        approvedBy: a?.approvedBy,
        approvedAt: a?.approvedAt,
        note: a?.note,
      };
    });
    const allApproved = gates.every((g) => g.approved);
    const status =
      (meta.status as DevHandoff["status"]) ||
      (allApproved ? "approved" : gates.some((g) => g.approved) ? "in_review" : "draft");

    const mj = content.machine_json || {};
    const testCases = content.test_cases || [];
    const adrs = content.adrs || [];
    return rebuildHandoffExports({
      featureChangeId,
      projectName,
      title: `Development Handoff: ${(mj as { title?: string }).title || "Change"}`,
      generatedAt: String(meta.generated_at || row.created_at),
      status,
      summaryMarkdown:
        content.summary_markdown ||
        (content.human_markdown || "").split("\n\n").slice(0, 3).join("\n\n"),
      impactChecklistMarkdown: content.impact_checklist_markdown || "",
      adrMarkdown: content.adr_markdown || "",
      planMarkdown: content.plan_markdown || "",
      testPlanMarkdown: content.test_plan_markdown || "",
      acceptanceCriteria: content.acceptance_criteria || [],
      testCases,
      adrs,
      implementationBrief:
        content.implementation_brief || content.machine_markdown || "",
      humanMarkdown: content.human_markdown || "",
      machineMarkdown: content.machine_markdown || "",
      machineJson: (content.machine_json || { kind: "dev_handoff" }) as DevHandoff["machineJson"],
      fullMarkdown: content.full_markdown || content.human_markdown || "",
      gates,
      filesToTouch: content.files_to_touch || [],
      proposedFeatures: content.proposed_features || [],
      mermaidProposed: content.mermaid_proposed || "",
      mermaidAsIs: content.mermaid_as_is || (mj as { mermaid_as_is?: string }).mermaid_as_is || "",
      recoveredFeatures:
        content.recovered_features ||
        (mj as { recovered_features?: string[] }).recovered_features ||
        [],
      currentBehavior:
        content.current_behavior ||
        (mj as { current_behavior?: string }).current_behavior ||
        "",
      desiredBehavior:
        content.desired_behavior ||
        (mj as { desired_behavior?: string }).desired_behavior ||
        "",
      architectureNarrative:
        content.architecture_narrative ||
        (mj as { architecture_narrative?: DevHandoff["architectureNarrative"] })
          .architecture_narrative ||
        undefined,
      impactStats:
        content.impact_stats ||
        (mj as { impact_stats?: DevHandoff["impactStats"] }).impact_stats ||
        undefined,
      stats: {
        workItems: content.stats?.workItems ?? 0,
        groundedRipples: content.stats?.groundedRipples ?? 0,
        discardedRipples: content.stats?.discardedRipples ?? 0,
        acceptance: content.stats?.acceptance ?? (content.acceptance_criteria || []).length,
        tests: content.stats?.tests ?? testCases.length,
        adrs: content.stats?.adrs ?? adrs.length,
      },
    });
  }
  return null;
}

export async function persistInitialHandoffArtifact(
  projectId: string,
  handoff: DevHandoff,
  createdBy?: string | null,
) {
  if (!createdBy) return;
  await supabase.from("architecture_artifacts").insert({
    project_id: projectId,
    stage: 15,
    type: "executive_summary",
    title: handoff.title,
    content: {
      _meta: {
        kind: "dev_handoff",
        feature_change_id: handoff.featureChangeId,
        generated_at: handoff.generatedAt,
        status: handoff.status,
        approvals: {},
      },
      human_markdown: handoff.humanMarkdown,
      machine_markdown: handoff.machineMarkdown,
      full_markdown: handoff.fullMarkdown,
      machine_json: handoff.machineJson,
      acceptance_criteria: handoff.acceptanceCriteria,
      test_cases: handoff.testCases,
      adrs: handoff.adrs,
      files_to_touch: handoff.filesToTouch,
      mermaid_proposed: handoff.mermaidProposed,
      mermaid_as_is: handoff.mermaidAsIs || "",
      recovered_features: handoff.recoveredFeatures || [],
      current_behavior: handoff.currentBehavior || "",
      desired_behavior: handoff.desiredBehavior || "",
      architecture_narrative: handoff.architectureNarrative || null,
      impact_stats: handoff.impactStats || null,
      stats: handoff.stats,
      summary_markdown: handoff.summaryMarkdown,
      impact_checklist_markdown: handoff.impactChecklistMarkdown,
      plan_markdown: handoff.planMarkdown,
      adr_markdown: handoff.adrMarkdown,
      test_plan_markdown: handoff.testPlanMarkdown,
      implementation_brief: handoff.implementationBrief,
      proposed_features: handoff.proposedFeatures,
    },
    status: "draft",
    generated_by: "Development Handoff",
    created_by: createdBy,
  });
}
