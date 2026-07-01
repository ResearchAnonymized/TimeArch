import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Lock, Unlock, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Explicit human approval gate for the full Architecture Package.
 *
 * Until this is sealed (`package_locked: true` on a Stage 15 approval),
 * Stage 16+ (Code Generation / Implementation Review / Evolution) is blocked
 * server-side. Requires every prior architecture stage (1–14) to already be
 * individually locked before the seal becomes available.
 */
const REQUIRED_STAGES = Array.from({ length: 14 }, (_, i) => i + 1); // 1..14

interface ApprovalRow {
  id: string;
  stage: number;
  action: string;
  approved_by: string | null;
  created_at: string;
  comment: string | null;
}

interface Props {
  projectId: string;
}

export default function ArchitecturePackageLockCard({ projectId }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [signoff, setSignoff] = useState("");
  const [unsealReason, setUnsealReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stage_approvals")
      .select("id, stage, action, approved_by, created_at, comment")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setApprovals((data as ApprovalRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Latest action per (stage) — most recent wins (lock/unlock toggle)
  const latestByStage = new Map<number, ApprovalRow>();
  for (const a of approvals) {
    if (!latestByStage.has(a.stage)) latestByStage.set(a.stage, a);
  }
  const missingStages = REQUIRED_STAGES.filter(
    (s) => latestByStage.get(s)?.action !== "locked",
  );

  // Active seal = most recent stage-15 lock with package_locked: true,
  // and no later unlock superseding it.
  const stage15Rows = approvals.filter((a) => a.stage === 15);
  let activeSeal: { row: ApprovalRow; meta: any } | null = null;
  for (const row of stage15Rows) {
    if (row.action !== "locked") {
      if (activeSeal) break; // an unseal happened after the seal we'd otherwise pick
      continue;
    }
    try {
      const meta = row.comment ? JSON.parse(row.comment) : null;
      if (meta?.package_locked === true) {
        activeSeal = { row, meta };
        break;
      }
    } catch { /* legacy comment */ }
  }

  const sealPackage = async () => {
    if (!user) return;
    if (missingStages.length > 0) {
      toast.error(`${missingStages.length} stage(s) still unlocked — lock them first.`);
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const lockedStages = REQUIRED_STAGES.map((s) => ({
        stage: s,
        approval_id: latestByStage.get(s)?.id ?? null,
        locked_at: latestByStage.get(s)?.created_at ?? null,
      }));
      const { data: artifactSnapshot } = await supabase
        .from("architecture_artifacts")
        .select("id, stage, type, title, status")
        .eq("project_id", projectId);

      const { error } = await supabase.from("stage_approvals").insert({
        project_id: projectId,
        stage: 15,
        action: "locked" as any,
        approved_by: user.id,
        comment: JSON.stringify({
          package_locked: true,
          signoff_statement: signoff.trim() || null,
          signed_off_by: user.id,
          signed_off_at: now,
          locked_stages: lockedStages,
          artifact_count: artifactSnapshot?.length ?? 0,
          artifact_snapshot: artifactSnapshot ?? [],
        }),
      });
      if (error) throw error;

      await supabase.from("audit_log").insert({
        project_id: projectId,
        user_id: user.id,
        entity_type: "project",
        entity_id: null,
        action: "architecture_package_locked",
        details: {
          stage: 15,
          locked_at: now,
          locked_stage_count: lockedStages.length,
          artifact_count: artifactSnapshot?.length ?? 0,
          signoff_statement: signoff.trim() || null,
        },
      });

      toast.success("Architecture Package sealed — code generation is now unlocked.");
      setSignoff("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to seal package.");
    } finally {
      setBusy(false);
    }
  };

  const unsealPackage = async () => {
    if (!user || !activeSeal) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("stage_approvals").insert({
        project_id: projectId,
        stage: 15,
        action: "unlocked" as any,
        approved_by: user.id,
        comment: JSON.stringify({
          package_unlocked: true,
          reason: unsealReason.trim() || null,
          unlocked_at: now,
          supersedes_approval_id: activeSeal.row.id,
        }),
      });
      if (error) throw error;
      await supabase.from("audit_log").insert({
        project_id: projectId,
        user_id: user.id,
        entity_type: "project",
        entity_id: null,
        action: "architecture_package_unsealed",
        details: { stage: 15, unlocked_at: now, reason: unsealReason.trim() || null },
      });
      toast.success("Architecture Package unsealed. Code generation is blocked again.");
      setUnsealReason("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to unseal package.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading package approval state…
      </div>
    );
  }

  if (activeSeal) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-display font-semibold">Architecture Package — Sealed</h3>
            <p className="text-[11px] text-muted-foreground">
              Sealed {new Date(activeSeal.meta.signed_off_at ?? activeSeal.row.created_at).toLocaleString()}
              {" · "}{activeSeal.meta.artifact_count ?? 0} artifacts locked
              {" · "}code generation, implementation review and evolution stages are unblocked.
            </p>
            {activeSeal.meta.signoff_statement && (
              <p className="mt-2 text-xs italic text-foreground/80 border-l-2 border-emerald-500/40 pl-2">
                "{activeSeal.meta.signoff_statement}"
              </p>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={busy}>
                <Unlock className="h-3 w-3" /> Unseal
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unseal the architecture package?</AlertDialogTitle>
                <AlertDialogDescription>
                  Code generation, implementation review, and evolution agents will be blocked
                  again until the package is re-sealed. This action is recorded in the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                value={unsealReason}
                onChange={(e) => setUnsealReason(e.target.value)}
                placeholder="Reason (optional, recommended)…"
                className="min-h-20 text-xs"
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={unsealPackage}>Unseal</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  const canSeal = missingStages.length === 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 space-y-3",
        canSeal ? "border-primary/40 bg-primary/5" : "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center",
            canSeal ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
          )}
        >
          {canSeal ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold">
            Architecture Package Approval
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Code generation (Stage 16) and all downstream implementation agents are blocked
            until a human explicitly approves and seals the full architecture package.
          </p>
          {!canSeal && (
            <p className="mt-2 text-[11px] text-warning">
              {missingStages.length} stage{missingStages.length === 1 ? "" : "s"} still unlocked:{" "}
              <span className="font-mono">{missingStages.join(", ")}</span>. Lock them first.
            </p>
          )}
        </div>
      </div>

      {canSeal && (
        <>
          <Textarea
            value={signoff}
            onChange={(e) => setSignoff(e.target.value)}
            placeholder="Sign-off statement (optional) — e.g. 'Architecture approved by Platform Council on 2026-06-26.'"
            className="min-h-20 text-xs"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-[11px]" disabled={busy}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Approve &amp; Lock Architecture Package
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Seal the Architecture Package?</AlertDialogTitle>
                <AlertDialogDescription>
                  This is the explicit human approval that unblocks code generation. The
                  current snapshot of all artifacts (stages 1–14) will be recorded with your
                  signature in the immutable audit log. You can unseal later if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={sealPackage}>Approve &amp; Lock</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
