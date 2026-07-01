import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectId: string;
  currentStage: number;
  onJumpToStage?: (stage: number) => void;
  refreshKey?: number;
}

/**
 * Governance gate notice shown on every Stage 4+ workspace.
 *
 * The platform enforces a hard rule that only requirements with status
 * `locked` or `approved` flow into downstream agents. This banner makes
 * that rule visible to the architect: it counts how many requirements
 * the Stage 3 gate is currently excluding, and offers a one-click jump
 * back to Stage 3 to lock them.
 *
 * Renders nothing for Stages 1–3 (where drafts are still in scope) and
 * nothing when there is no draft to flag.
 */
export default function UnlockedRequirementsBanner({
  projectId,
  currentStage,
  onJumpToStage,
  refreshKey,
}: Props) {
  const [counts, setCounts] = useState({ locked: 0, draft: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentStage < 4) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("requirements")
        .select("status")
        .eq("project_id", projectId);
      if (cancelled) return;
      const rows = data || [];
      const locked = rows.filter((r) => r.status === "locked" || r.status === "approved").length;
      setCounts({ locked, draft: rows.length - locked, total: rows.length });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, currentStage, refreshKey]);

  if (currentStage < 4 || loading) return null;

  // Hard-block scenario: nothing locked at all
  if (counts.total > 0 && counts.locked === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3"
      >
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-semibold text-destructive">
            No locked requirements available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Architecture stages can only consume requirements that have been formally locked or
            approved. All {counts.total} requirement(s) are still in draft and were excluded by the
            governance gate. Agents on this stage will return a warning until you lock them in Stage
            3.
          </p>
          {onJumpToStage && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-2 h-8"
              onClick={() => onJumpToStage(3)}
            >
              <Lock className="h-3.5 w-3.5" />
              Go to Stage 3 to lock requirements
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // Soft warning: some drafts still excluded
  if (counts.draft > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-3"
      >
        <Lock className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-xs">
          <span className="font-semibold text-foreground">Governance gate active:</span>{" "}
          <span className="text-muted-foreground">
            {counts.locked} of {counts.total} requirements are locked and visible to this
            stage.{" "}
          </span>
          <span className="text-warning font-medium">
            {counts.draft} draft requirement(s) excluded.
          </span>
          {onJumpToStage && (
            <button
              onClick={() => onJumpToStage(3)}
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              Review in Stage 3
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return null;
}
