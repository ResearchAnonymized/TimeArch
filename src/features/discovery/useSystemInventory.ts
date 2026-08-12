import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildSystemInventory, type SystemInventory } from "@/lib/systemInventory";

export function useSystemInventory(projectId: string, enabled: boolean) {
  const [inventory, setInventory] = useState<SystemInventory | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [projRes, impRes, reqRes, artRes] = await Promise.all([
        supabase.from("projects").select("name, source_repo_url").eq("id", projectId).single(),
        supabase
          .from("project_imports")
          .select("kind, source_label, status")
          .eq("project_id", projectId)
          .order("source_label"),
        supabase
          .from("requirements")
          .select("requirement_id, title, description, source")
          .eq("project_id", projectId)
          .order("requirement_id"),
        supabase
          .from("architecture_artifacts")
          .select("type, title, content, stage")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);

      const reArts = (artRes.data || []).filter((a) => {
        const meta = (a.content as Record<string, unknown> | null)?._meta as
          | Record<string, unknown>
          | undefined;
        return meta?.provenance === "reverse-engineered";
      });

      setInventory(
        buildSystemInventory({
          projectName: projRes.data?.name || "Project",
          sourceRepo: projRes.data?.source_repo_url,
          imports: impRes.data || [],
          requirements: reqRes.data || [],
          artifacts: reArts.map((a) => ({
            type: a.type,
            title: a.title,
            content: a.content as Record<string, unknown> | null,
          })),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { inventory, loading, reload: load };
}
