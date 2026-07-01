/**
 * Architecture artifacts repository.
 *
 * Centralises all `architecture_artifacts` reads used by the stage workspaces.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { type Result, err, ok } from "@/lib/result";
import { fromPostgrest } from "@/services/base";

export type ArchitectureArtifact = Database["public"]["Tables"]["architecture_artifacts"]["Row"];

export const artifactsService = {
  async listForProject(projectId: string): Promise<Result<ArchitectureArtifact[]>> {
    const { data, error } = await supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) return err(fromPostgrest(error));
    return ok(data ?? []);
  },

  async listForStage(projectId: string, stage: number): Promise<Result<ArchitectureArtifact[]>> {
    const { data, error } = await supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("created_at", { ascending: true });
    if (error) return err(fromPostgrest(error));
    return ok(data ?? []);
  },
} as const;
