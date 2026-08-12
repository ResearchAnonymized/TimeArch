/**
 * PackageLockStatus — shared banner that confirms whether the Stage 15
 * "Architecture Package" is sealed. Used on:
 *   - Stage 15 (to confirm the seal was written correctly)
 *   - Stages 16–18 (to show why Run-agent buttons are enabled/disabled)
 *
 * The gate that unlocks Stages 16–18 (server + client) is a `stage_approvals`
 * row for stage 15 whose `comment` is JSON containing `package_locked: true`.
 * We surface exactly that fact here — no guessing.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  /** Which stage this banner is rendered on — tailors the copy. */
  onStage: 15 | 16 | 17 | 18;
  /** Optional refresh trigger — bump to force re-check after user actions. */
  refreshKey?: number;
}

interface LockInfo {
  locked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  artifactCount?: number;
  docsVersion?: number;
}

export default function PackageLockStatus({ projectId, onStage, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<LockInfo>({ locked: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Grab the latest Stage 15 approval row — the seal is JSON in `comment`.
      const { data } = await supabase
        .from("stage_approvals")
        .select("approved_by, created_at, comment, action")
        .eq("project_id", projectId)
        .eq("stage", 15)
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled) return;
      let found: LockInfo = { locked: false };
      for (const row of data ?? []) {
        try {
          const parsed = typeof row.comment === "string" ? JSON.parse(row.comment) : null;
          if (parsed && parsed.package_locked === true) {
            found = {
              locked: true,
              lockedAt: parsed.signed_off_at ?? row.created_at,
              lockedBy: parsed.signed_off_by ?? row.approved_by,
              artifactCount: typeof parsed.artifact_count === "number" ? parsed.artifact_count : undefined,
              docsVersion: typeof parsed.docs_version === "number" ? parsed.docs_version : undefined,
            };
            break;
          }
        } catch {
          // plain-text comment → not a valid seal
        }
      }
      setInfo(found);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Architecture Package status…
      </div>
    );
  }

  if (info.locked) {
    const when = info.lockedAt ? new Date(info.lockedAt).toLocaleString() : "—";
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 flex items-start gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs leading-relaxed">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">
            Architecture Package sealed — Stages 16–18 Run-agent buttons are unlocked.
          </div>
          <div className="text-muted-foreground mt-0.5">
            Locked {when}
            {info.artifactCount !== undefined ? ` · ${info.artifactCount} artifact(s) snapshot` : ""}
            {info.docsVersion ? ` · docs v${info.docsVersion}` : ""}
          </div>
        </div>
      </div>
    );
  }

  // Not locked → tell the user *exactly* what needs to happen.
  const stageSpecific =
    onStage === 15
      ? "Complete the sign-off register below, then click Record approval & advance to seal the package."
      : `Open Stage 15 (Stakeholder Approval), complete the checklist, and click Record approval & advance. Only then will the Run-agent button on Stage ${onStage} light up.`;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2.5">
      <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="text-xs leading-relaxed">
        <div className="font-semibold text-amber-700 dark:text-amber-300">
          Architecture Package is not sealed yet.
        </div>
        <div className="text-muted-foreground mt-0.5">
          <span className="inline-flex items-center gap-1 mr-1"><AlertTriangle className="h-3 w-3" />Prerequisite:</span>
          {stageSpecific}
        </div>
      </div>
    </div>
  );
}
