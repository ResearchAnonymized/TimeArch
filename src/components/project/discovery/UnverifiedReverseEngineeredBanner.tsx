import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  artifactId: string;
  sourceLabel?: string;
  onConfirmed?: () => void;
}

/**
 * Banner shown on artifacts seeded by the Reverse-Engineering Agent.
 * Detects content._meta.needs_human_confirmation === true.
 */
export default function UnverifiedReverseEngineeredBanner({
  artifactId,
  sourceLabel,
  onConfirmed,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Read current content, flip the flag, write back
      const { data, error } = await supabase
        .from("architecture_artifacts")
        .select("content")
        .eq("id", artifactId)
        .single();
      if (error) throw error;
      const content = (data?.content as any) || {};
      const meta = {
        ...(content._meta || {}),
        needs_human_confirmation: false,
        confirmed_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from("architecture_artifacts")
        .update({ content: { ...content, _meta: meta } })
        .eq("id", artifactId);
      if (upErr) throw upErr;
      toast.success("Marked as confirmed");
      onConfirmed?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 mb-4">
      <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-display font-bold text-blue-700 dark:text-blue-400">
          Reverse-engineered — needs human confirmation
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          This artifact was seeded automatically from
          {sourceLabel ? (
            <>
              {" "}
              <span className="font-mono">{sourceLabel}</span>
            </>
          ) : (
            " an imported source"
          )}
          . Review accuracy before locking the stage.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={loading}
        onClick={handleConfirm}
      >
        <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
      </Button>
    </div>
  );
}
