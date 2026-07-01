/**
 * Requirements repository.
 *
 * Read-side helpers used by the Stage 1/2 workspaces and the brownfield
 * discovery view. Writes still happen via edge functions (process-requirements,
 * reverse-engineer) for validation + provenance.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { type Result, err, ok } from "@/lib/result";
import { fromPostgrest } from "@/services/base";

export type Requirement = Database["public"]["Tables"]["requirements"]["Row"];

export const requirementsService = {
  async listForProject(projectId: string): Promise<Result<Requirement[]>> {
    const { data, error } = await supabase
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) return err(fromPostgrest(error));
    return ok(data ?? []);
  },

  async listReverseEngineered(projectId: string): Promise<Result<Requirement[]>> {
    const { data, error } = await supabase
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .like("source", "reverse-engineered:%")
      .order("created_at", { ascending: true });
    if (error) return err(fromPostgrest(error));
    return ok(data ?? []);
  },
} as const;
