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
  message?: string;
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

export interface FetchGithubRepoResponse {
  owner: string;
  repo: string;
  ref: string;
  source_repo: string;
  discovered: number;
  selected: number;
  uploaded: number;
  skipped: number;
  kinds?: Record<string, number>;
  results?: Array<{ path: string; kind?: string; status: string; bytes?: number; error?: string }>;
  error?: string;
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

  /**
   * Ensure the project has at least one draft feature change so mapping → plan
   * (and multi-agent runtime) can unlock after reverse-engineering.
   * Returns the existing or newly created feature_change id.
   */
  async ensureDraftFeatureChange(input: {
    projectId: string;
    userId: string;
    title?: string;
    description?: string;
  }): Promise<Result<{ id: string; created: boolean }>> {
    try {
      const { data: existing, error: exErr } = await supabase
        .from("feature_changes")
        .select("id")
        .eq("project_id", input.projectId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (exErr) return err(toAppError(exErr, "Failed to check feature changes"));
      if (existing?.[0]?.id) return ok({ id: existing[0].id, created: false });

      const { data: created, error: insErr } = await supabase
        .from("feature_changes")
        .insert({
          project_id: input.projectId,
          title: input.title || "Improve discovered architecture",
          description:
            input.description ||
            "Auto-drafted after reverse-engineering. Edit this change, then run Score → Map → Plan (or Multi-agent Run all) to produce work items.",
          change_type: "modify",
          priority: "medium",
          status: "draft",
          is_active: true,
          created_by: input.userId,
        })
        .select("id")
        .single();
      if (insErr || !created) {
        return err(toAppError(insErr ?? new Error("insert failed"), "Failed to seed feature change"));
      }
      return ok({ id: created.id, created: true });
    } catch (e) {
      return err(toAppError(e, "Failed to seed feature change"));
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

  /** Import files from a public GitHub repository URL. */
  fetchGithubRepo(input: {
    project_id: string;
    repo_url: string;
    ref?: string;
    max_files?: number;
  }): Promise<Result<FetchGithubRepoResponse>> {
    return invokeFunction<typeof input, FetchGithubRepoResponse>("fetch-github-repo", input);
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

  assessQuality(input: { project_id: string }): Promise<
    Result<{ characteristics: Array<{ key: string; score: number; gap_count: number; rationale: string }>; overall: number }>
  > {
    return invokeFunction("qa-assessor", input);
  },

  planModernization(input: { project_id: string }): Promise<
    Result<{ items: Array<{ name: string; action: string; effort: number; impact: number; roi: number; rationale: string }> }>
  > {
    return invokeFunction("modernization-planner", input);
  },

  classifyStyle(input: { project_id: string }): Promise<
    Result<{
      primary: string;
      secondary: string | null;
      confidence: "low" | "med" | "high";
      evidence: string[];
      drivers_fit: Array<{ driver: string; fit: string; note: string }>;
    }>
  > {
    return invokeFunction("style-classifier", input);
  },

  mapFeatureToArchitecture(input: {
    feature_change_id: string;
    replace?: boolean;
  }): Promise<Result<{ mapping_count: number; heuristic?: number; llm?: number; error?: string }>> {
    return invokeFunction("map-feature-to-architecture", input);
  },

  analyzeRipple(input: {
    feature_change_id: string;
    replace?: boolean;
  }): Promise<Result<{ impact_count: number; heuristic?: number; llm?: number; error?: string }>> {
    return invokeFunction("analyze-ripple", input);
  },

  generateAlternatives(input: {
    feature_change_id: string;
    replace?: boolean;
  }): Promise<Result<{ alternative_count: number; error?: string }>> {
    return invokeFunction("generate-alternatives", input);
  },

  assessQualityImpact(input: {
    feature_change_id: string;
    replace?: boolean;
  }): Promise<Result<{ assessment_count: number; error?: string }>> {
    return invokeFunction("assess-quality-impact", input);
  },

  planFeatureImplementation(input: {
    feature_change_id: string;
    replace?: boolean;
  }): Promise<Result<{ work_item_count: number; adr_id: string | null; error?: string }>> {
    return invokeFunction("plan-feature-implementation", input);
  },

  /**
   * Multi-agent runtime for a brownfield stage.
   * Planner → Executor (tool loop) → Critic → Persist, with live traces on
   * `agent_runs_v2` / `agent_trace_steps` for the UI trace panel.
   */
  runBrownfieldAgent(input: {
    feature_change_id: string;
    stage_key: "mapping" | "ripple" | "quality" | "alternatives" | "adr" | "plan";
    user_id: string;
    goal?: string;
  }): Promise<Result<{
    runId: string;
    stage_key: string;
    stage_code: number;
    agent_name: string;
    status: "completed" | "failed";
    destination_table?: string;
    inserted_count?: number;
    primary_id?: string | null;
    iterations: number;
    tokens: { in: number; out: number };
    verdict?: { pass: boolean; score: number; must_fix: string[]; rationale: string } | null;
    error?: string;
  }>> {
    return invokeFunction("run-brownfield-agent", input);
  },
} as const;
