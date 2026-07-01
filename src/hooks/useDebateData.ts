import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recoverArtifactContent } from "@/lib/artifact-utils";

/**
 * Fetches challenger review artifact and validation metadata for a given stage.
 * Returns { challengerData, validationData, loading }.
 */
export function useDebateData(projectId: string, stage: number, refreshKey?: number) {
  const [challengerData, setChallengerData] = useState<any>(null);
  const [validationData, setValidationData] = useState<any>(null);
  const [ragSources, setRagSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: artifacts } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", stage)
        .order("created_at", { ascending: false });

      if (artifacts && artifacts.length > 0) {
        // Find challenger artifact
        const chalArtifact = artifacts.find(
          (a) =>
            a.generated_by?.includes("Challenger") ||
            a.generated_by?.includes("Evaluator") ||
            a.title?.startsWith("Challenger Review:") ||
            a.title?.startsWith("Evaluator Review:"),
        );
        if (chalArtifact) {
          const content = recoverArtifactContent(chalArtifact.content);
          if (content) {
            // Strip _meta for display
            const { _meta, ...rest } = content;
            setChallengerData(rest);
          }
        } else {
          setChallengerData(null);
        }

        // Find primary artifact and extract validation metadata
        const primaryArtifact = artifacts.find(
          (a) =>
            !a.generated_by?.includes("Challenger") &&
            !a.generated_by?.includes("Evaluator") &&
            !a.title?.startsWith("Challenger Review:") &&
            !a.title?.startsWith("Evaluator Review:"),
        );
        if (primaryArtifact) {
          const content = recoverArtifactContent(primaryArtifact.content);
          if (content?._validation) {
            setValidationData(content._validation);
          } else {
            setValidationData(null);
          }
          if (content?._rag_sources) {
            setRagSources(content._rag_sources);
          } else {
            setRagSources([]);
          }
        } else {
          setValidationData(null);
          setRagSources([]);
        }
      } else {
        setChallengerData(null);
        setValidationData(null);
        setRagSources([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [projectId, stage, refreshKey]);

  return { challengerData, validationData, ragSources, loading };
}
