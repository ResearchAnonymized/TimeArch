import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck, Lock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StageIntro from "../StageIntro";
import { STAGE_INTROS } from "../stageIntroData";
import { supabase } from "@/integrations/supabase/client";
import { getStageChecklist } from "../stageChecklists";
import { cn } from "@/lib/utils";
import PostApprovalAuditNotes from "./PostApprovalAuditNotes";
import ArchitecturePackageLockCard from "./ArchitecturePackageLockCard";

const STAGE_LABELS: Record<number, string> = {
  1: "Requirement Collection",
  2: "Requirement Analysis",
  3: "Architecture Drivers",
  4: "Style Selection",
  5: "Tradeoff Evaluation",
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
  9: "Cross-Cutting Concerns",
  10: "Infrastructure & Deployment",
  11: "Quality Attributes",
  12: "Risk Assessment",
  13: "Architecture Validation",
  14: "Documentation & ADRs",
  15: "Stakeholder Approval",
  16: "Code Generation",
  17: "Implementation Review",
  18: "Architecture Evolution",
};

export default function ApprovalWorkspace({ projectId }: { projectId: string }) {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [appRes, artRes] = await Promise.all([
        supabase
          .from("stage_approvals")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("architecture_artifacts")
          .select("id, title, type, stage, status")
          .eq("project_id", projectId)
          .order("stage"),
      ]);
      if (appRes.data) setApprovals(appRes.data);
      if (artRes.data) setArtifacts(artRes.data);
    };
    fetchData();
  }, [projectId]);

  const lockedStages = new Set(approvals.filter((a) => a.action === "locked").map((a) => a.stage));
  const lockedCount = artifacts.filter((a) => a.status === "locked").length;
  const totalProgress =
    artifacts.length > 0 ? Math.round((lockedCount / artifacts.length) * 100) : 0;
  const stageNumbers = Array.from({ length: 18 }, (_, i) => i + 1);

  const parseChecklist = (comment: string | null) => {
    if (!comment) return null;
    try {
      const parsed = JSON.parse(comment);
      if (parsed.checklist) return parsed;
    } catch {
      /* not JSON */
    }
    return null;
  };

  const actionStyles: Record<string, string> = {
    locked: "bg-primary/10 text-primary border-primary/30",
    approved: "bg-success/10 text-success border-success/30",
    rejected: "bg-destructive/10 text-destructive border-destructive/30",
    revision_requested: "bg-warning/10 text-warning border-warning/30",
    unlocked: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[15]} title="Stakeholder Approval" />

      {/* Post-approval audit notes — formal evidence for code-gen handoff */}
      <PostApprovalAuditNotes projectId={projectId} />

      {/* Readiness bar */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-display font-semibold">Architecture Readiness</span>
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {totalProgress}%
          </span>
        </div>
        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${totalProgress === 100 ? "bg-success" : totalProgress >= 50 ? "bg-primary" : "bg-warning"}`}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {lockedStages.size} of 18 stages locked with validated checklists.
        </p>
      </div>

      {/* Explicit human approval to unlock code-generation stages */}
      <ArchitecturePackageLockCard projectId={projectId} />



      {/* Stage-by-stage summary */}
      <div>
        <h4 className="text-xs font-display font-semibold mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          Stage Approval Status
        </h4>

        <div className="space-y-1">
          {stageNumbers.map((stage) => {
            const isLocked = lockedStages.has(stage);
            const stageApproval = approvals.find((a) => a.action === "locked" && a.stage === stage);
            const checklistData = stageApproval ? parseChecklist(stageApproval.comment) : null;
            const checklist = getStageChecklist(stage);

            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: stage * 0.02 }}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border text-xs transition-colors",
                  isLocked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border/50",
                )}
              >
                {isLocked ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                )}

                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {String(stage).padStart(2, "0")}
                </span>

                <span
                  className={cn(
                    "font-display font-semibold flex-1 truncate",
                    isLocked ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>

                {isLocked && checklistData ? (
                  <Badge className="text-[9px] border bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1">
                    <ClipboardCheck className="h-3 w-3" />
                    {checklistData.checklist.length} verified
                  </Badge>
                ) : isLocked ? (
                  <Badge className="text-[9px] border bg-primary/10 text-primary border-primary/30 gap-1">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                ) : (
                  <span className="text-[9px] text-muted-foreground/50">
                    {checklist.length} items pending
                  </span>
                )}

                {stageApproval && (
                  <span className="text-[9px] text-muted-foreground/50 tabular-nums font-mono">
                    {new Date(stageApproval.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Approval History */}
      <div>
        <h4 className="text-xs font-display font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
          Approval History
        </h4>
        {approvals.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed border-border/60 bg-card/30">
            <p className="text-xs text-muted-foreground">No approvals recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {approvals.map((a, i) => {
              const checklistData = parseChecklist(a.comment);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors text-xs"
                >
                  <Badge
                    className={`text-[9px] border ${actionStyles[a.action] || actionStyles.locked}`}
                  >
                    {a.action.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-display font-semibold">Stage {a.stage}</span>
                  {checklistData?.justification && (
                    <span className="text-muted-foreground truncate flex-1">
                      — {checklistData.justification}
                    </span>
                  )}
                  {!checklistData && a.comment && (
                    <span className="text-muted-foreground truncate flex-1">— {a.comment}</span>
                  )}
                  <span className="text-muted-foreground tabular-nums ml-auto">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
