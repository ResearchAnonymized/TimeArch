import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import { getStageChecklist } from "@/components/project/stageChecklists";
import {
  evaluateChecklistItem,
  EvidenceResult,
  EvidenceStatus,
} from "@/components/project/checklistEvidenceRules";

/** Returns true if `err` represents an auth failure (missing token / 401 / 403). */
function isAuthError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const status = anyErr?.status ?? anyErr?.context?.status ?? anyErr?.response?.status;
  if (status === 401 || status === 403) return true;
  const msg = String(anyErr?.message ?? anyErr ?? "").toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("session expired") ||
    msg.includes("missing sub claim") ||
    msg.includes("bad_jwt") ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("non-2xx")
  );
}

/**
 * Get a fresh, server-validated access token. If the cached token is stale
 * (e.g. signed by an old key → "missing sub claim" / "bad_jwt"), force a refresh.
 * Returns null if we genuinely have no valid session.
 */
async function getValidAccessToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token ?? null;
  if (!token) return null;

  // Validate the cached token against the auth server. If it rejects, refresh.
  const { error: userErr } = await supabase.auth.getUser(token);
  if (userErr) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session?.access_token) {
      // Token is unrecoverable — clear the bad cached session.
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      return null;
    }
    token = refreshed.session.access_token;
  }
  return token;
}

/** Show a clear sign-in prompt toast with an action that routes to /auth. */
function promptSignIn(action: "verify" | "refine") {
  const verb = action === "verify" ? "verify this item" : "refine this section";
  toast.error("Sign-in required", {
    description: `Your session has expired. Please sign in again to ${verb}.`,
    action: {
      label: "Sign in",
      onClick: () => {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/auth?next=${next}`);
      },
    },
  });
}

export interface ChecklistEvaluation {
  id: string;
  label: string;
  evidence: EvidenceResult;
  /** AI verification result (only present after user clicks Verify). */
  aiVerdict?: AiVerdict;
}

export interface AiVerdict {
  status: EvidenceStatus;
  confidence: number; // 0-1
  evidenceQuotes: string[];
  gaps: string[];
  suggestions: string[];
  verifiedAt: string;
}

export interface RefinementHistoryRecord {
  item_id: string;
  item_label: string;
  gaps: string[];
  summary: string;
  refined_at: string;
  before?: string;
  after?: string;
  patch?: string;
}

/**
 * Loads the merged primary artifact for a stage and evaluates every checklist
 * item deterministically. Provides actions to AI-verify and refine individual
 * items in place.
 */
export function useChecklistEvaluation(projectId: string, stage: number, refreshKey?: number) {
  const checklist = getStageChecklist(stage);
  const [artifact, setArtifact] = useState<any>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<ChecklistEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [refining, setRefining] = useState<Record<string, boolean>>({});
  const [aiVerdicts, setAiVerdicts] = useState<Record<string, AiVerdict>>({});
  const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryRecord[]>([]);
  const [bumpKey, setBumpKey] = useState(0);

  const loadArtifact = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("architecture_artifacts")
      .select("id, content, generated_by, title")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at", { ascending: false });

    const primary = (data || []).find(
      (a) =>
        !a.generated_by?.includes("Challenger") &&
        !a.generated_by?.includes("Evaluator") &&
        !a.title?.startsWith("Challenger Review:") &&
        !a.title?.startsWith("Evaluator Review:"),
    );
    if (primary) {
      const recovered = recoverArtifactContent(primary.content);
      setArtifact(recovered);
      setArtifactId(primary.id);
      // Extract refinement history (new: array; legacy: object keyed by item_id)
      const raw = recovered?._refinements;
      const history: RefinementHistoryRecord[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? Object.entries(raw).map(([item_id, v]: [string, any]) => ({ item_id, ...v }))
          : [];
      setRefinementHistory(history);
    } else {
      setArtifact(null);
      setArtifactId(null);
      setRefinementHistory([]);
    }
    setLoading(false);
  }, [projectId, stage]);

  useEffect(() => {
    loadArtifact();
  }, [loadArtifact, refreshKey, bumpKey]);

  // Re-evaluate whenever artifact or AI verdicts change
  useEffect(() => {
    const evals = checklist.map((item) => ({
      id: item.id,
      label: item.label,
      evidence: evaluateChecklistItem(stage, item.id, artifact),
      aiVerdict: aiVerdicts[item.id],
    }));
    setEvaluations(evals);
  }, [artifact, aiVerdicts, stage, checklist.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyItem = useCallback(
    async (itemId: string, label: string) => {
      if (!artifact || !artifactId) return;
      setVerifying((p) => ({ ...p, [itemId]: true }));

      try {
        const data = await callAuthenticatedFunction<any>("verify-checklist-item", {
          projectId,
          stage,
          itemId,
          itemLabel: label,
          artifactId,
        });

        if (data?.verdict) {
          setAiVerdicts((p) => ({
            ...p,
            [itemId]: { ...data.verdict, verifiedAt: new Date().toISOString() },
          }));
        }
      } catch (err) {
        if (isAuthError(err)) {
          promptSignIn("verify");
        } else {
          toast.error("Verification failed", {
            description: (err as any)?.message ?? "Please try again.",
          });
        }
      } finally {
        setVerifying((p) => ({ ...p, [itemId]: false }));
      }
    },
    [artifact, artifactId, projectId, stage],
  );

  const refineItem = useCallback(
    async (itemId: string, label: string, gaps: string[]) => {
      if (!artifact || !artifactId) return { success: false };
      setRefining((p) => ({ ...p, [itemId]: true }));

      try {
        const data = await callAuthenticatedFunction<any>("refine-artifact-section", {
          projectId,
          stage,
          itemId,
          itemLabel: label,
          artifactId,
          gaps,
        });

        // Reload artifact + clear stale AI verdict so user re-verifies
        setAiVerdicts((p) => {
          const { [itemId]: _, ...rest } = p;
          return rest;
        });
        setBumpKey((k) => k + 1);
        return { success: true, summary: data?.summary };
      } catch (err: any) {
        if (isAuthError(err)) {
          promptSignIn("refine");
          return { success: false, error: "unauthorized" };
        }
        return { success: false, error: err?.message };
      } finally {
        setRefining((p) => ({ ...p, [itemId]: false }));
      }
    },
    [artifact, artifactId, projectId, stage],
  );

  const summary = {
    green: evaluations.filter((e) => (e.aiVerdict?.status || e.evidence.status) === "green").length,
    amber: evaluations.filter((e) => (e.aiVerdict?.status || e.evidence.status) === "amber").length,
    red: evaluations.filter((e) => (e.aiVerdict?.status || e.evidence.status) === "red").length,
    unknown: evaluations.filter((e) => (e.aiVerdict?.status || e.evidence.status) === "unknown")
      .length,
    total: evaluations.length,
  };

  return {
    loading,
    artifact,
    artifactId,
    evaluations,
    summary,
    verifying,
    refining,
    verifyItem,
    refineItem,
    refinementHistory,
    reload: () => setBumpKey((k) => k + 1),
  };
}
