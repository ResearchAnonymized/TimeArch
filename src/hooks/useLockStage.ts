import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MANUAL_STAGES = [0, 1, 15];
const MAX_STAGE = 18;

interface UseLockStageOptions {
  projectId: string;
  stage: number;
  refreshKey?: number;
  /** Called after a successful lock + advance, with the next stage number. */
  onAdvance?: (nextStage: number) => void;
}

/**
 * Lock the current stage and auto-advance the project to the next stage.
 *
 * The hook also reports whether a primary recommendation artifact exists for
 * the stage (so the UI can decide when to show the Lock & Advance affordance)
 * and whether the stage is already locked.
 */
export function useLockStage({ projectId, stage, refreshKey, onAdvance }: UseLockStageOptions) {
  const { user } = useAuth();
  const [hasArtifact, setHasArtifact] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [artifactsRes, approvalsRes] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, generated_by, title")
        .eq("project_id", projectId)
        .eq("stage", stage),
      supabase
        .from("stage_approvals")
        .select("id")
        .eq("project_id", projectId)
        .eq("stage", stage)
        .eq("action", "locked")
        .limit(1),
    ]);

    const primary = (artifactsRes.data || []).some(
      (a) =>
        !a.generated_by?.includes("Challenger") &&
        !a.generated_by?.includes("Evaluator") &&
        !a.title?.startsWith("Challenger Review:") &&
        !a.title?.startsWith("Evaluator Review:"),
    );
    setHasArtifact(primary);
    setIsLocked((approvalsRes.data || []).length > 0);
    setLoading(false);
  }, [projectId, stage]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const lockAndAdvance = useCallback(
    async (
      justification?: string,
      auditMeta?: {
        undecided_concerns?: number;
        total_concerns?: number;
        undecided_summaries?: string[];
      },
    ) => {
      if (!user) return;
      if (isLocked) {
        toast.info("This stage is already locked.");
        return;
      }
      setLocking(true);
      try {
        const approvedAt = new Date().toISOString();
        const { error } = await supabase.from("stage_approvals").insert({
          project_id: projectId,
          stage,
          action: "locked" as any,
          approved_by: user.id,
          comment: JSON.stringify({
            ...(justification?.trim() ? { justification: justification.trim() } : {}),
            approved_at: approvedAt,
            ...(auditMeta ?? {}),
          }),
        });
        if (error) throw error;

        const nextStage = Math.min(stage + 1, MAX_STAGE);
        await supabase.from("projects").update({ current_stage: nextStage }).eq("id", projectId);

        // Audit activity log entry
        await supabase.from("audit_log").insert({
          project_id: projectId,
          user_id: user.id,
          entity_type: "stage",
          entity_id: null,
          action: "lock_and_advance",
          details: {
            stage,
            next_stage: nextStage,
            locked_at: approvedAt,
            undecided_concerns: auditMeta?.undecided_concerns ?? 0,
            total_concerns: auditMeta?.total_concerns ?? 0,
            had_open_concerns: (auditMeta?.undecided_concerns ?? 0) > 0,
          },
        });

        toast.success("Stage locked — advancing to next stage.");
        setIsLocked(true);
        onAdvance?.(nextStage);
      } catch (err: any) {
        toast.error(err?.message || "Failed to lock stage.");
      } finally {
        setLocking(false);
      }
    },
    [user, isLocked, projectId, stage, onAdvance],
  );

  const unlock = useCallback(
    async (reason?: string) => {
      if (!user) return;
      if (!isLocked) {
        toast.info("This stage is not locked.");
        return;
      }
      setUnlocking(true);
      try {
        const unlockedAt = new Date().toISOString();
        const { error } = await supabase.from("stage_approvals").insert({
          project_id: projectId,
          stage,
          action: "unlocked" as any,
          approved_by: user.id,
          comment: JSON.stringify({
            ...(reason?.trim() ? { reason: reason.trim() } : {}),
            unlocked_at: unlockedAt,
          }),
        });
        if (error) throw error;

        await supabase.from("audit_log").insert({
          project_id: projectId,
          user_id: user.id,
          entity_type: "stage",
          entity_id: null,
          action: "unlock_stage",
          details: { stage, unlocked_at: unlockedAt, reason: reason?.trim() || null },
        });

        toast.success("Stage unlocked.");
        setIsLocked(false);
      } catch (err: any) {
        toast.error(err?.message || "Failed to unlock stage.");
      } finally {
        setUnlocking(false);
      }
    },
    [user, isLocked, projectId, stage],
  );

  return {
    loading,
    hasArtifact,
    isLocked,
    locking,
    unlocking,
    lockAndAdvance,
    unlock,
    isManualStage: MANUAL_STAGES.includes(stage),
    reload: load,
  };
}
