import { Loader2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLockStage } from "@/hooks/useLockStage";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  onAdvance?: (nextStage: number) => void;
  /** Pass these from the Challenger panel for richer audit metadata. */
  totalConcerns?: number;
  decidedCount?: number;
}

/**
 * Compact Lock & Advance / Unlock controls intended to live inside the
 * Challenger Architect panel header. Hidden on manual stages or before a
 * primary recommendation exists.
 */
export default function ChallengerLockControls({
  projectId,
  stage,
  refreshKey,
  onAdvance,
  totalConcerns,
  decidedCount,
}: Props) {
  const {
    loading,
    hasArtifact,
    isLocked,
    locking,
    unlocking,
    lockAndAdvance,
    unlock,
    isManualStage,
  } = useLockStage({ projectId, stage, refreshKey, onAdvance });

  if (loading || isManualStage || !hasArtifact) return null;

  const undecided = Math.max(0, (totalConcerns ?? 0) - (decidedCount ?? 0));

  if (isLocked) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={unlocking}
            className="h-7 gap-1.5 text-[11px]"
          >
            {unlocking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unlock className="h-3 w-3" />
            )}
            Unlock stage
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this stage?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking allows further changes to this stage's recommendation. The unlock event will
              be recorded in the audit log along with the actor and timestamp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlock()}>Unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          disabled={locking}
          className={cn(
            "h-7 gap-1.5 text-[11px]",
            undecided > 0 && "bg-warning hover:bg-warning/90 text-warning-foreground",
          )}
        >
          {locking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
          Lock & Advance
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lock this stage and advance?</AlertDialogTitle>
          <AlertDialogDescription>
            {undecided > 0 ? (
              <>
                <span className="text-warning font-medium">
                  {undecided} of {totalConcerns} challenger concern{totalConcerns === 1 ? "" : "s"}{" "}
                  are still undecided.
                </span>{" "}
                You can still proceed, but the open concerns will be recorded in the audit log.
              </>
            ) : totalConcerns && totalConcerns > 0 ? (
              <>
                All {totalConcerns} challenger concerns have been decided. The stage will be locked
                and the project will advance to the next stage.
              </>
            ) : (
              <>The stage will be locked and the project will advance to the next stage.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              lockAndAdvance(undefined, {
                undecided_concerns: undecided,
                total_concerns: totalConcerns ?? 0,
              })
            }
          >
            Lock & Advance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
