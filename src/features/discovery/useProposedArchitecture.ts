import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildProposedArchitecture,
  parseProposedFeatures,
  type ProposedArchitecture,
} from "@/lib/proposedArchitecture";
import {
  loadProposedArchitectureArtifact,
  persistProposedArchitectureArtifact,
} from "@/lib/discoveryPipeline";
import type { SystemInventory } from "@/lib/systemInventory";

export function useProposedArchitecture(
  projectId: string,
  featureChangeId: string | null,
  inventory: SystemInventory | null,
  createdBy?: string | null,
) {
  const [proposed, setProposed] = useState<ProposedArchitecture | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!featureChangeId) {
      setProposed(null);
      return;
    }
    setLoading(true);
    try {
      if (!inventory) {
        const storedOnly = await loadProposedArchitectureArtifact(projectId, featureChangeId);
        setProposed(storedOnly);
        return;
      }

      const [fcRes, mapRes, rippleRes, workRes] = await Promise.all([
        supabase.from("feature_changes").select("*").eq("id", featureChangeId).single(),
        supabase
          .from("feature_mappings")
          .select("element_type,element_ref,relationship,confidence")
          .eq("feature_change_id", featureChangeId),
        supabase
          .from("impact_findings")
          .select(
            "impacted_element_type,impacted_element_ref,classification,severity,recommended_action,reason",
          )
          .eq("feature_change_id", featureChangeId),
        supabase
          .from("feature_work_items")
          .select("title,description,category,effort,validation_criteria,ordering")
          .eq("feature_change_id", featureChangeId)
          .order("ordering", { ascending: true }),
      ]);

      if (!fcRes.data) {
        setProposed(null);
        return;
      }

      const liveFeatures = parseProposedFeatures(fcRes.data);
      const stored = await loadProposedArchitectureArtifact(projectId, featureChangeId);
      // Reuse snapshot only when it still matches every feature in the revision
      if (
        stored &&
        stored.proposedFeatures.length === liveFeatures.length &&
        liveFeatures.every((f, i) => stored.proposedFeatures[i]?.toLowerCase() === f.toLowerCase())
      ) {
        setProposed(stored);
        return;
      }

      const asStringList = (v: unknown): string[] =>
        Array.isArray(v) ? v.map(String) : [];

      const built = buildProposedArchitecture({
        inventory,
        featureChange: fcRes.data,
        mappings: mapRes.data || [],
        ripples: rippleRes.data || [],
        workItems: (workRes.data || []).map((w) => ({
          title: w.title,
          description: w.description,
          category: w.category,
          effort: w.effort,
          validation_criteria: asStringList(w.validation_criteria),
          ordering: w.ordering,
        })),
      });
      setProposed(built);
      void persistProposedArchitectureArtifact(
        projectId,
        featureChangeId,
        built,
        createdBy,
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, featureChangeId, inventory, createdBy]);

  useEffect(() => {
    void load();
  }, [load]);

  return { proposed, loading, reload: load };
}
