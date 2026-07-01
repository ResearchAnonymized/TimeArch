import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { recoverArtifactContent } from "@/lib/artifact-utils";

export type DecisionType = "accept" | "reject" | "modify";

export interface ChallengerDecisionRow {
  id: string;
  artifact_id: string;
  concern_index: number;
  decision: DecisionType;
  modification: string | null;
  architect_rationale: string | null;
  cycle: number;
  decided_by: string;
  decided_at: string;
}

/**
 * Manages architect decisions on Challenger Agent concerns for a given stage.
 * - Loads the latest Challenger artifact + any prior decisions.
 * - Allows architects to accept / reject / modify each concern.
 * - Computes the bundle to send back to the Generator for cycle-2 refinement.
 */
export function useChallengerDecisions(projectId: string, stage: number, refreshKey?: number) {
  const { user } = useAuth();
  const [challengerArtifactId, setChallengerArtifactId] = useState<string | null>(null);
  const [primaryArtifactId, setPrimaryArtifactId] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<any[]>([]);
  const [reviewMeta, setReviewMeta] = useState<any>(null);
  const [decisions, setDecisions] = useState<Record<number, ChallengerDecisionRow>>({});
  const [cycle, setCycle] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [primaryArtifactMeta, setPrimaryArtifactMeta] = useState<{
    title: string | null;
    version: number;
    cycle: number;
    created_at: string | null;
    refined_from: string | null;
  } | null>(null);
  const [challengerArtifactMeta, setChallengerArtifactMeta] = useState<{
    created_at: string | null;
  } | null>(null);
  const [latestRefinedMeta, setLatestRefinedMeta] = useState<{
    title: string | null;
    version: number;
    cycle: number;
    created_at: string | null;
  } | null>(null);
  const [lastDecisionAt, setLastDecisionAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: artifacts } = await supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at", { ascending: false });

    if (!artifacts || artifacts.length === 0) {
      setChallengerArtifactId(null);
      setPrimaryArtifactId(null);
      setConcerns([]);
      setDecisions({});
      setLoading(false);
      return;
    }

    const chal = artifacts.find(
      (a) =>
        a.generated_by?.includes("Challenger") ||
        a.generated_by?.includes("Evaluator") ||
        a.title?.startsWith("Challenger Review:") ||
        a.title?.startsWith("Evaluator Review:"),
    );
    const primary = artifacts.find(
      (a) =>
        !a.generated_by?.includes("Challenger") &&
        !a.generated_by?.includes("Evaluator") &&
        !a.title?.startsWith("Challenger Review:") &&
        !a.title?.startsWith("Evaluator Review:"),
    );

    setChallengerArtifactId(chal?.id ?? null);
    setPrimaryArtifactId(primary?.id ?? null);
    setChallengerArtifactMeta(chal ? { created_at: chal.created_at ?? null } : null);

    if (chal) {
      const content = recoverArtifactContent(chal.content);
      setConcerns(Array.isArray(content?.concerns) ? content.concerns : []);
      setReviewMeta({
        verdict: content?.verdict ?? null,
        confidence: typeof content?.confidence === "number" ? content.confidence : null,
        overall_score: typeof content?.overall_score === "number" ? content.overall_score : null,
        summary: content?.summary ?? content?.executive_summary ?? null,
        executive_summary: content?.executive_summary ?? null,
        final_assessment: content?.final_assessment ?? null,
        alternative_recommendation: content?.alternative_recommendation ?? null,
        strengths_acknowledged: Array.isArray(content?.strengths_acknowledged)
          ? content.strengths_acknowledged
          : [],
        counter_arguments: Array.isArray(content?.counter_arguments)
          ? content.counter_arguments
          : [],
        risk_blindspots: Array.isArray(content?.risk_blindspots) ? content.risk_blindspots : [],
        standards_referenced: Array.isArray(content?.standards_referenced)
          ? content.standards_referenced
          : [],
        evaluation_dimensions: Array.isArray(content?.evaluation_dimensions)
          ? content.evaluation_dimensions
          : [],
        atam_analysis: content?.atam_analysis ?? null,
      });
    } else {
      setConcerns([]);
      setReviewMeta(null);
    }

    // Determine current cycle: if primary has _cycle metadata use it, else 1.
    const primaryContent = primary ? recoverArtifactContent(primary.content) : null;
    const detectedCycle = Number(primaryContent?._cycle) || 1;
    setCycle(detectedCycle);
    setPrimaryArtifactMeta(
      primary
        ? {
            title: primary.title ?? null,
            version: Number(primary.version) || 1,
            cycle: detectedCycle,
            created_at: primary.created_at ?? null,
            refined_from: primaryContent?._refined_from ?? null,
          }
        : null,
    );

    // Find the latest refined (cycle > 1) primary artifact, if any
    const refinedPrimaries = artifacts
      .filter(
        (a) =>
          !a.generated_by?.includes("Challenger") &&
          !a.generated_by?.includes("Evaluator") &&
          !a.title?.startsWith("Challenger Review:") &&
          !a.title?.startsWith("Evaluator Review:"),
      )
      .map((a) => {
        const c = recoverArtifactContent(a.content);
        return { a, cycle: Number(c?._cycle) || 1 };
      })
      .filter((x) => x.cycle > 1)
      .sort((a, b) => b.cycle - a.cycle);
    if (refinedPrimaries.length > 0) {
      const top = refinedPrimaries[0];
      setLatestRefinedMeta({
        title: top.a.title ?? null,
        version: Number(top.a.version) || 1,
        cycle: top.cycle,
        created_at: top.a.created_at ?? null,
      });
    } else {
      setLatestRefinedMeta(null);
    }

    if (chal) {
      const { data: rows } = await supabase
        .from("challenger_decisions")
        .select("*")
        .eq("artifact_id", chal.id)
        .eq("cycle", detectedCycle);
      const map: Record<number, ChallengerDecisionRow> = {};
      let latest: string | null = null;
      for (const r of rows || []) {
        map[r.concern_index] = r as ChallengerDecisionRow;
        if (r.decided_at && (!latest || r.decided_at > latest)) latest = r.decided_at;
      }
      setDecisions(map);
      setLastDecisionAt(latest);
    } else {
      setDecisions({});
      setLastDecisionAt(null);
    }
    setLoading(false);
  }, [projectId, stage]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const setDecision = async (
    concernIndex: number,
    decision: DecisionType,
    modification?: string,
    rationale?: string,
  ) => {
    if (!user || !challengerArtifactId) return;
    const existing = decisions[concernIndex];
    if (existing) {
      const { data, error } = await supabase
        .from("challenger_decisions")
        .update({
          decision,
          modification: modification ?? null,
          architect_rationale: rationale ?? null,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (!error && data) {
        setDecisions((p) => ({ ...p, [concernIndex]: data as ChallengerDecisionRow }));
        setLastDecisionAt((data as ChallengerDecisionRow).decided_at);
      }
    } else {
      const { data, error } = await supabase
        .from("challenger_decisions")
        .insert({
          project_id: projectId,
          stage,
          artifact_id: challengerArtifactId,
          concern_index: concernIndex,
          decision,
          modification: modification ?? null,
          architect_rationale: rationale ?? null,
          cycle,
          decided_by: user.id,
        })
        .select("*")
        .single();
      if (!error && data) {
        setDecisions((p) => ({ ...p, [concernIndex]: data as ChallengerDecisionRow }));
        setLastDecisionAt((data as ChallengerDecisionRow).decided_at);
      }
    }
  };

  const decidedCount = Object.keys(decisions).length;
  const acceptedCount = Object.values(decisions).filter(
    (d) => d.decision === "accept" || d.decision === "modify",
  ).length;
  const allDecided = concerns.length > 0 && decidedCount === concerns.length;

  // A second refinement round is only justified if the Challenger surfaced
  // material problems that the architect agreed are still worth fixing.
  // We count a "kept material problem" as any accepted/modified concern whose
  // severity is critical or high. If only low/medium concerns were kept — or
  // the verdict was already approving — we skip cycle 2 and tell the user
  // the current state is acceptable.
  const keptMaterialCount = concerns.reduce((n, c, i) => {
    const d = decisions[i];
    if (!d) return n;
    if (d.decision !== "accept" && d.decision !== "modify") return n;
    const sev = String(c?.severity || "medium").toLowerCase();
    return sev === "critical" || sev === "high" ? n + 1 : n;
  }, 0);

  const verdict = String(reviewMeta?.verdict || "").toLowerCase();
  const verdictIsApproving =
    verdict === "approved" ||
    verdict === "approve" ||
    verdict === "approve_with_minor_revisions" ||
    verdict === "approve_with_revisions";

  // Refinement is only offered when:
  //  - we haven't already refined,
  //  - the architect has triaged every concern,
  //  - at least one MATERIAL (critical/high) problem was kept, OR
  //    the Challenger's overall verdict is non-approving.
  const hasUnresolvedProblems = keptMaterialCount > 0 || (!verdictIsApproving && acceptedCount > 0);
  const canRefine = cycle < 2 && allDecided && hasUnresolvedProblems;

  // Distinct signal for the UI: architect triaged everything, but nothing
  // material remains → recommend locking instead of running cycle 2.
  const noProblemsRemaining = cycle < 2 && allDecided && !hasUnresolvedProblems;

  /** Build the refinement bundle for the Generator (cycle 2). */
  const buildRefinementBundle = () => {
    const accepted: any[] = [];
    const modified: any[] = [];
    const rejected: any[] = [];
    concerns.forEach((c, i) => {
      const d = decisions[i];
      if (!d) return;
      const item = {
        issue: c.issue,
        severity: c.severity,
        evidence: c.evidence,
        alternative_approach: c.alternative_approach,
        architect_rationale: d.architect_rationale,
        modification: d.modification,
      };
      if (d.decision === "accept") accepted.push(item);
      else if (d.decision === "modify") modified.push(item);
      else rejected.push({ issue: c.issue, architect_rationale: d.architect_rationale });
    });
    return {
      previous_artifact_id: primaryArtifactId,
      accepted_critiques: accepted,
      modified_critiques: modified,
      rejected_critiques: rejected,
      cycle: cycle + 1,
    };
  };

  return {
    loading,
    concerns,
    reviewMeta,
    decisions,
    cycle,
    decidedCount,
    acceptedCount,
    allDecided,
    canRefine,
    noProblemsRemaining,
    keptMaterialCount,
    setDecision,
    buildRefinementBundle,
    reload: load,
    primaryArtifactId,
    challengerArtifactId,
    primaryArtifactMeta,
    challengerArtifactMeta,
    latestRefinedMeta,
    lastDecisionAt,
  };
}
