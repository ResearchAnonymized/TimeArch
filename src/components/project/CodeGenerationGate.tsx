import { useEffect, useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectId: string;
  /** Called when the user clicks "Go to Stage 15" to seal the package. */
  onGoToApproval?: () => void;
  /** @deprecated kept for backwards compatibility with older call sites */
  onGoToStage14?: () => void;
  /** Children render only when the architecture package is sealed. */
  children: React.ReactNode;
}

/**
 * Blocks implementation-ready workspaces (Stage 16+: Code Generation,
 * Implementation Review, Architecture Evolution) until a human has explicitly
 * **sealed the Architecture Package** in Stage 15. The seal is represented as
 * a `stage_approvals` row with `stage=15, action='locked'` and a JSON comment
 * containing `package_locked: true`. The server-side gate in `run-agent` and
 * `run-agent-v2` enforces the same check independently.
 */
export default function CodeGenerationGate({
  projectId,
  onGoToApproval,
  onGoToStage14,
  children,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [packageSealed, setPackageSealed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("stage_approvals")
        .select("id, action, comment, created_at")
        .eq("project_id", projectId)
        .eq("stage", 15)
        .order("created_at", { ascending: false })
        .limit(20);

      let sealed = false;
      for (const row of data ?? []) {
        if (row.action !== "locked") {
          // a later unseal overrides earlier seals — only counts if we
          // haven't already found an active seal above it.
          break;
        }
        try {
          const meta = row.comment ? JSON.parse(row.comment) : null;
          if (meta?.package_locked === true) { sealed = true; break; }
        } catch { /* legacy comment, ignore */ }
      }
      if (!cancelled) {
        setPackageSealed(sealed);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (packageSealed) return <>{children}</>;

  const goToApproval = onGoToApproval ?? onGoToStage14;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-6 text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-warning/15 text-warning flex items-center justify-center mb-3">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        Architecture Package not yet approved
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
        Code generation and all downstream implementation agents are blocked until a human
        explicitly approves and seals the architecture package in Stage 15 (Stakeholder Approval).
        The same gate is enforced server-side, so retrying the agent will fail with a 403 until
        the package is sealed.
      </p>
      {goToApproval && (
        <Button size="sm" variant="outline" onClick={goToApproval} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Go to Stage 15 — Approve &amp; Lock Architecture Package
        </Button>
      )}
    </div>
  );
}
