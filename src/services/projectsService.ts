/**
 * Projects repository — typed access to the `projects` table.
 *
 * UI components must not query `projects` directly; route through here so
 * authorisation, error mapping and logging stay consistent.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { type Result, err, ok } from "@/lib/result";
import { fromPostgrest, toResult } from "@/services/base";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export const projectsService = {
  async get(id: string): Promise<Result<Project>> {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) return err(fromPostgrest(error));
    if (!data) return err({ code: "not_found", message: "Project not found" });
    return ok(data);
  },

  async listForUser(userId: string): Promise<Result<Project[]>> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .or(`owner_id.eq.${userId}`)
      .order("updated_at", { ascending: false });
    return toResult(data ?? [], error);
  },

  async update(id: string, patch: ProjectUpdate): Promise<Result<Project>> {
    const { data, error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return err(fromPostgrest(error));
    if (!data) return err({ code: "not_found", message: "Project not found" });
    return ok(data);
  },
} as const;
