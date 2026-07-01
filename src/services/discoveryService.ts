/**
 * Discovery / brownfield service.
 *
 * Façade over the `reverse-engineer`, `gap-analyzer`, `drift-detect` and
 * `fetch-demo-source` edge functions plus the `project_imports` table.
 * Components in `src/components/project/discovery/` should call this
 * instead of touching Supabase directly.
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { err, ok, toAppError, type Result } from "@/lib/result";
import type {
  ImportKind,
  ProjectImport,
  RemotePreset,
} from "@/features/discovery/types";

interface ReverseEngineerInput {
  project_id: string;
  reprocess?: boolean;
}
export interface ReverseEngineerResultItem {
  filename?: string;
  status: "parsed" | "failed" | string;
  error?: string;
}
export interface ReverseEngineerResponse {
  processed: number;
  results: ReverseEngineerResultItem[];
}

interface GapAnalyzerInput {
  project_id: string;
  replace?: boolean;
}
interface DriftDetectInput {
  project_id: string;
}

export interface FetchDemoResponse {
  uploaded: number;
  total: number;
  preset_title?: string;
  results?: Array<{ filename: string; status: string; error?: string }>;
}

interface UploadImportArgs {
  projectId: string;
  userId: string;
  kind: ImportKind;
  sourceLabel: string;
  file: Blob;
  filename: string;
  contentType?: string;
}

export const discoveryService = {
  /** List `project_imports` rows for a project, newest first. */
  async listImports(projectId: string): Promise<Result<ProjectImport[]>> {
    try {
      const { data, error } = await supabase
        .from("project_imports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) return err(toAppError(error, "Failed to load imports"));
      return ok((data as ProjectImport[]) || []);
    } catch (e) {
      return err(toAppError(e, "Failed to load imports"));
    }
  },

  /** Upload a single file to storage and create the matching import row. */
  async uploadImport(args: UploadImportArgs): Promise<Result<void>> {
    const { projectId, userId, kind, sourceLabel, file, filename, contentType } = args;
    try {
      const path = `${projectId}/${Date.now()}-${filename}`;
      const { error: upErr } = await supabase.storage
        .from("project-imports")
        .upload(path, file, { upsert: false, contentType });
      if (upErr) return err(toAppError(upErr, `Upload failed: ${filename}`));

      const { error: insErr } = await supabase.from("project_imports").insert({
        project_id: projectId,
        kind,
        source_label: sourceLabel,
        storage_path: path,
        created_by: userId,
      });
      if (insErr) return err(toAppError(insErr, `Insert failed: ${filename}`));
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, "Failed to upload import"));
    }
  },

  /** Delete an import row + its storage object. */
  async deleteImport(imp: ProjectImport): Promise<Result<void>> {
    try {
      if (imp.storage_path) {
        await supabase.storage.from("project-imports").remove([imp.storage_path]);
      }
      const { error } = await supabase.from("project_imports").delete().eq("id", imp.id);
      if (error) return err(toAppError(error, "Delete failed"));
      return ok(undefined);
    } catch (e) {
      return err(toAppError(e, "Delete failed"));
    }
  },

  /** Public catalog of remote demo presets (GET endpoint, no auth). */
  async fetchPresetCatalog(): Promise<Result<RemotePreset[]>> {
    try {
      const base = import.meta.env.VITE_SUPABASE_URL;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${base}/functions/v1/fetch-demo-source?list=true`, {
        headers: { apikey },
      });
      if (!res.ok) return err({ code: "network", message: `Catalog HTTP ${res.status}` });
      const json = (await res.json()) as { presets?: RemotePreset[] };
      return ok(json?.presets ?? []);
    } catch (e) {
      return err(toAppError(e, "Failed to fetch preset catalog"));
    }
  },

  /** Server-side fetch + seed of a remote preset into project_imports. */
  fetchPresetIntoProject(input: {
    project_id: string;
    preset_id: string;
  }): Promise<Result<FetchDemoResponse>> {
    return invokeFunction<typeof input, FetchDemoResponse>("fetch-demo-source", input);
  },

  /** Run the reverse-engineer agent over uploaded imports. */
  reverseEngineer(input: ReverseEngineerInput): Promise<Result<ReverseEngineerResponse>> {
    return invokeFunction<ReverseEngineerInput, ReverseEngineerResponse>(
      "reverse-engineer",
      input,
    );
  },

  analyzeGaps(input: GapAnalyzerInput): Promise<Result<{ gaps_created: number }>> {
    return invokeFunction("gap-analyzer", input);
  },

  detectDrift(input: DriftDetectInput): Promise<Result<{ findings_created: number }>> {
    return invokeFunction("drift-detect", input);
  },
} as const;
