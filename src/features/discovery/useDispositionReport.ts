import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";

export interface DispositionReport {
  id: string;
  project_id: string;
  created_at: string;
  overall_verdict: string;
  confidence: number;
  dimension_scores: Record<string, { score: number; evidence: string }>;
  component_dispositions: Array<{
    name: string;
    disposition: string;
    business_value: number;
    technical_risk: number;
    effort: string;
    rationale?: string;
  }>;
  risk_value_matrix: Array<{
    name: string;
    x: number;
    y: number;
    disposition: string;
    effort: string;
  }>;
  effort_estimate: Record<string, number>;
  rationale: string | null;
}

export function useDispositionReport(projectId: string) {
  const [report, setReport] = useState<DispositionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("system_disposition_reports" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e) setError(e.message);
    setReport((data as any) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await invokeFunction<{ project_id: string }, { report?: DispositionReport; error?: string }>(
        "system-disposition-analyzer",
        { project_id: projectId },
      );
      if (res.ok === false) {
        setError((res as any).error?.message ?? "Failed");
      } else {
        const value = res.value;
        if (value?.error) setError(value.error);
        if (value?.report) setReport(value.report);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to run analyzer");
    } finally {
      setRunning(false);
    }
  }, [projectId]);

  return { report, loading, running, error, run, reload: load };
}
