import { useEffect, useState } from "react";
import {
  Lock,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldQuestion,
  ShieldCheck,
  Hand,
  Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLockStage } from "@/hooks/useLockStage";
import { useChallengerDecisions } from "@/hooks/useChallengerDecisions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  onAdvance?: (nextStage: number) => void;
  /** "top" (default): sticky top banner. "bottom": inline non-sticky bottom bar. */
  position?: "top" | "bottom";
}

type ChallengerOrigin = "manual" | "automatic" | "unknown";

/**
 * Sticky banner shown at the top of the stage workspace as soon as a primary
 * recommendation artifact exists. Lets the architect lock the stage and
 * auto-advance — with a confirmation listing undecided Challenger concerns.
 */
export default function LockAdvanceBar({
  projectId,
  stage,
  refreshKey,
  onAdvance,
  position = "top",
}: Props) {
  const { hasArtifact, isLocked, locking, lockAndAdvance, isManualStage } = useLockStage({
    projectId,
    stage,
    refreshKey,
    onAdvance,
  });
  const { concerns, decisions, decidedCount, challengerArtifactId } = useChallengerDecisions(
    projectId,
    stage,
    refreshKey,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [challengerOrigin, setChallengerOrigin] = useState<ChallengerOrigin>("unknown");

  // Detect whether the latest Challenger/Evaluator run was manually triggered.
  useEffect(() => {
    let cancelled = false;
    if (!challengerArtifactId) {
      setChallengerOrigin("unknown");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("agent_runs")
        .select("agent_name, input, created_at")
        .eq("project_id", projectId)
        .eq("stage", stage)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const latestChallenger = (data || []).find(
        (r) =>
          (r.agent_name || "").toLowerCase().includes("challenger") ||
          (r.agent_name || "").toLowerCase().includes("evaluator"),
      );
      if (!latestChallenger) {
        setChallengerOrigin("unknown");
        return;
      }
      const input = latestChallenger.input as any;
      const mode = input?.mode || input?.trigger;
      // Manual runs are dispatched via the "Challenge this recommendation" button
      // with mode === "challenge_only".
      setChallengerOrigin(mode === "challenge_only" ? "manual" : "automatic");
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, stage, challengerArtifactId, refreshKey]);

  if (isManualStage || !hasArtifact || isLocked) return null;

  const undecided = Math.max(0, concerns.length - decidedCount);
  const hasOpenConcerns = undecided > 0;

  // Build a compact list of undecided concerns for the confirmation dialog.
  const undecidedList = concerns
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => !decisions[i])
    .slice(0, 8);

  const undecidedSummaries = undecidedList.map(({ c }) =>
    String(c?.issue || c?.title || c?.summary || "Untitled concern").slice(0, 200),
  );

  const triggerLock = () =>
    lockAndAdvance(undefined, {
      undecided_concerns: undecided,
      total_concerns: concerns.length,
      undecided_summaries: undecidedSummaries,
    });

  const handleClick = () => {
    if (hasOpenConcerns) setConfirmOpen(true);
    else triggerLock();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === "bottom" ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === "bottom" ? 8 : -8 }}
        className={cn(
          position === "top"
            ? "sticky top-0 z-20 -mx-6 px-6 py-2.5 mb-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
            : "mt-4 rounded-lg border bg-card/95 px-4 py-2.5 shadow-sm",
        )}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
              hasOpenConcerns ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
            )}
          >
            {hasOpenConcerns ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground leading-tight flex items-center gap-2 flex-wrap">
              <span>
                {hasOpenConcerns
                  ? `Recommendation ready — ${undecided} challenger concern${undecided === 1 ? "" : "s"} still open`
                  : "Recommendation ready to lock"}
              </span>
              <ChallengerStatusBadge artifactId={challengerArtifactId} origin={challengerOrigin} />
              {concerns.length > 0 && (
                <div className="flex items-center gap-1">
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-medium"
                    title="Total challenger concerns raised"
                  >
                    Total: {concerns.length}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-medium text-success border-success/40"
                    title="Concerns you have reviewed (accept / modify / reject)"
                  >
                    Decided: {decidedCount}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 text-[10px] font-medium",
                      undecided > 0 ? "text-warning border-warning/40" : "text-muted-foreground",
                    )}
                    title="Concerns still awaiting a decision"
                  >
                    Undecided: {undecided}
                  </Badge>
                </div>
              )}
            </div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              {concerns.length > 0
                ? `Review coverage: ${decidedCount} of ${concerns.length} concern${concerns.length === 1 ? "" : "s"} decided${hasOpenConcerns ? " — open concerns will be saved with the lock record." : "."}`
                : "Lock this stage to finalize the artifact and auto-advance to the next stage."}
            </div>
          </div>

          <Button
            size="sm"
            variant={hasOpenConcerns ? "outline" : "default"}
            onClick={handleClick}
            disabled={locking}
            className="h-8 flex-shrink-0"
          >
            {locking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            Lock & Advance
          </Button>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Lock with open concerns?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You have <span className="font-semibold text-foreground">{undecided}</span>{" "}
                    challenger concern{undecided === 1 ? "" : "s"} that{" "}
                    {undecided === 1 ? "hasn't" : "haven't"} been reviewed yet. Locking now will
                    finalize the recommendation as-is and advance to the next stage.
                  </p>

                  {undecidedList.length > 0 && (
                    <div className="rounded-md border bg-muted/40 p-2.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                        Undecided concerns
                      </div>
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {undecidedList.map(({ c, i }) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="leading-snug line-clamp-2">
                                {String(c?.issue || c?.title || c?.summary || "Untitled concern")}
                              </div>
                              {c?.severity && (
                                <Badge
                                  variant="outline"
                                  className="mt-0.5 h-4 px-1 text-[9px] uppercase"
                                >
                                  {String(c.severity)}
                                </Badge>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {undecided > undecidedList.length && (
                        <div className="mt-1.5 text-[10.5px] text-muted-foreground">
                          + {undecided - undecidedList.length} more not shown
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    A record of these open concerns will be attached to the lock entry in the audit
                    log.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmOpen(false);
                  triggerLock();
                }}
              >
                Lock anyway & advance
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  );
}

function ChallengerStatusBadge({
  artifactId,
  origin,
}: {
  artifactId: string | null;
  origin: ChallengerOrigin;
}) {
  if (!artifactId) {
    return (
      <Badge
        variant="outline"
        className="h-5 px-1.5 gap-1 text-[10px] font-medium text-muted-foreground"
        title="No challenger review has been generated for this stage."
      >
        <ShieldQuestion className="h-3 w-3" />
        No challenger review
      </Badge>
    );
  }
  const isManual = origin === "manual";
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 gap-1 text-[10px] font-medium",
        isManual ? "text-primary border-primary/40" : "text-muted-foreground",
      )}
      title={
        isManual
          ? "Challenger review was generated manually by an architect."
          : origin === "automatic"
            ? "Challenger review was generated automatically."
            : "Challenger review exists (origin unknown)."
      }
    >
      <ShieldCheck className="h-3 w-3" />
      Challenger:
      {isManual ? <Hand className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
      {isManual ? "manual" : origin === "automatic" ? "auto" : "exists"}
    </Badge>
  );
}
