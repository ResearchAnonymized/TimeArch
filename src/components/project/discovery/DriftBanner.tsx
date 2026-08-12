/**
 * DriftBanner — shows "As-Is changed since last review" when drift_findings
 * has open rows referencing confirmed/locked artifacts.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  onRescanned?: () => void;
}

interface DriftRow {
  id: string;
  stage: number;
  category: string;
  severity: string;
  source_label: string | null;
  detected_at: string;
}

export default function DriftBanner({ projectId, onRescanned }: Props) {
  const [rows, setRows] = useState<DriftRow[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("drift_findings")
      .select("id,stage,category,severity,source_label,detected_at")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("detected_at", { ascending: false })
      .limit(25);
    setRows((data as DriftRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const rescan = async () => {
    setRescanning(true);
    try {
      const { error } = await supabase.functions.invoke("drift-detect", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      toast.success("Drift re-scan complete");
      await load();
      onRescanned?.();
    } catch (e: any) {
      toast.error(e.message || "Drift scan failed");
    } finally {
      setRescanning(false);
    }
  };

  if (dismissed || rows.length === 0) return null;

  const highest = rows.some((r) => r.severity === "critical" || r.severity === "high")
    ? "high"
    : "medium";

  return (
    <div
      className={
        "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 mb-4 " +
        (highest === "high"
          ? "border-red-500 bg-red-500/10 text-red-900 dark:text-red-100"
          : "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-100")
      }
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">
          As-Is changed since last review — {rows.length} open drift finding{rows.length === 1 ? "" : "s"}
        </p>
        <p className="text-[11px] opacity-80 mt-0.5 truncate">
          Latest: {rows[0].category} · stage {rows[0].stage}
          {rows[0].source_label ? ` · ${rows[0].source_label}` : ""} ·{" "}
          {new Date(rows[0].detected_at).toLocaleString()}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={rescan}
        disabled={rescanning}
        className="h-7 text-[11px] gap-1.5"
      >
        <RefreshCw className={"h-3 w-3 " + (rescanning ? "animate-spin" : "")} />
        Re-scan
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDismissed(true)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
