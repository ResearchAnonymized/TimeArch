/**
 * Brownfield Discovery feature hooks.
 *
 * Façade over `discoveryService` exposing the data + side-effects the
 * Discovery workspace needs. UI components stay presentational.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import { createLogger } from "@/lib/logger";
import {
  DEMO_PACK,
  detectKind,
  type ProjectImport,
  type RemotePreset,
  type SeededPreset,
} from "@/features/discovery/types";

const log = createLogger("useDiscovery");

type StepValue = 1 | 2 | 3;

/** Persistent wizard step — survives reloads via localStorage. */
export function useDiscoveryStep(projectId: string) {
  const key = `timearch.discovery.step.${projectId}`;
  const [step, setStepRaw] = useState<StepValue>(() => {
    if (typeof window === "undefined") return 1;
    const saved = window.localStorage.getItem(key);
    const n = saved ? Number(saved) : 1;
    return (n === 2 || n === 3 ? n : 1) as StepValue;
  });
  const setStep = useCallback(
    (n: StepValue) => {
      setStepRaw(n);
      try {
        window.localStorage.setItem(key, String(n));
      } catch {
        /* ignore quota errors */
      }
    },
    [key],
  );
  return { step, setStep } as const;
}

/** Read the preset chosen at project creation, if any. */
export function useSeededPreset(projectId: string): SeededPreset | null {
  const key = `timearch.discovery.preset.${projectId}`;
  const [value] = useState<SeededPreset | null>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as SeededPreset) : null;
    } catch {
      return null;
    }
  });
  return value;
}

export function useRemotePresets() {
  const [presets, setPresets] = useState<RemotePreset[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await discoveryService.fetchPresetCatalog();
      if (cancelled) return;
      if (res.ok) setPresets(res.value);
      else log.warn("preset catalog", errorOf(res));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return presets;
}

interface UseDiscoveryImportsArgs {
  projectId: string;
  userId: string | undefined;
  onParsed: () => void;
  onAllUploaded: () => void;
}

/** Imports list + actions (upload / demo / preset / reverse / delete). */
export function useDiscoveryImports({
  projectId,
  userId,
  onParsed,
  onAllUploaded,
}: UseDiscoveryImportsArgs) {
  const [imports, setImports] = useState<ProjectImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const onParsedRef = useRef(onParsed);
  const onAllUploadedRef = useRef(onAllUploaded);
  onParsedRef.current = onParsed;
  onAllUploadedRef.current = onAllUploaded;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await discoveryService.listImports(projectId);
    if (res.ok) setImports(res.value);
    else toast.error(errorOf(res).message);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!userId) return;
      setUploading(true);
      let okCount = 0;
      for (const file of Array.from(files)) {
        const kind = detectKind(file.name);
        const res = await discoveryService.uploadImport({
          projectId,
          userId,
          kind,
          sourceLabel: file.name,
          file,
          filename: file.name,
        });
        if (res.ok) okCount++;
        else toast.error(`${file.name}: ${errorOf(res).message}`);
      }
      if (okCount) toast.success(`Added ${okCount} file${okCount === 1 ? "" : "s"}`);
      setUploading(false);
      await load();
      if (okCount) onAllUploadedRef.current();
    },
    [projectId, userId, load],
  );

  const runReverseEngineer = useCallback(
    async (reprocess = false) => {
      setReversing(true);
      try {
        const res = await discoveryService.reverseEngineer({ project_id: projectId, reprocess });
        if (!res.ok) {
          toast.error(errorOf(res).message || "Reverse-engineering failed");
          return false;
        }

        const results = res.value.results || [];
        const okN = results.filter((r) => r.status === "parsed").length;
        const failedN = results.filter((r) => r.status === "failed").length;
        const alreadyN = results.filter((r) => r.status === "already_parsed").length;
        const skippedUrlN = results.filter((r) => r.status === "skipped_url").length;
        const processed = res.value.processed ?? results.length;

        const finishParsed = async (opts?: { seedChange?: boolean }) => {
          await load();
          onParsedRef.current();
          if (opts?.seedChange === false || !userId) return;
          const seed = await discoveryService.ensureDraftFeatureChange({
            projectId,
            userId,
            title: "Improve discovered architecture",
            description:
              "Auto-drafted after reverse-engineering. Edit title/behavior, Score it, then run Map → Plan (or Multi-agent Run all) to produce work items / tasks.",
          });
          if (seed.ok && seed.value.created) {
            toast.info("Draft feature change created", {
              description: "Open Feature changes → then Auto-run remaining to generate tasks.",
            });
          }
        };

        // Nothing left to parse (all imports already status=parsed, reprocess=false).
        if (processed === 0 || results.length === 0) {
          toast.info("All uploaded files were already analyzed", {
            description:
              'Use “Re-run from scratch” to parse again, or continue to Explore findings.',
          });
          await finishParsed();
          return true;
        }

        if (okN === 0 && alreadyN > 0) {
          toast.info(`${alreadyN} file${alreadyN === 1 ? "" : "s"} already analyzed`);
          await finishParsed();
          return true;
        }

        if (okN === 0 && failedN > 0) {
          toast.error(`Could not parse ${failedN} file${failedN === 1 ? "" : "s"}`, {
            description: results
              .filter((r) => r.status === "failed")
              .slice(0, 3)
              .map((r) => r.error || r.filename || "unknown error")
              .join("\n"),
          });
          await load();
          return false;
        }

        if (okN === 0 && skippedUrlN > 0) {
          toast.info(`Recorded ${skippedUrlN} URL reference${skippedUrlN === 1 ? "" : "s"}`, {
            description: "Remote fetch is not performed for link-only imports.",
          });
          await finishParsed();
          return true;
        }

        if (okN === 0) {
          toast.info(res.value.message || "No new files were parsed", {
            description: 'Use “Re-run from scratch” if you need a fresh pass.',
          });
          await finishParsed();
          return true;
        }

        toast.success(
          `Read ${okN} file${okN === 1 ? "" : "s"}${failedN ? `, ${failedN} failed` : ""}`,
        );
        await finishParsed();
        return true;
      } finally {
        setReversing(false);
      }
    },
    [projectId, userId, load],
  );

  const loadDemoPack = useCallback(
    async (autoRun = true) => {
      if (!userId) return;
      setLoadingDemo("shopflow");
      try {
        let okCount = 0;
        for (const item of DEMO_PACK) {
          const res = await fetch(`/demo/brownfield/${item.file}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          const up = await discoveryService.uploadImport({
            projectId,
            userId,
            kind: item.kind,
            sourceLabel: item.label,
            file: blob,
            filename: item.file,
            contentType: "text/plain",
          });
          if (up.ok) okCount++;
        }
        toast.success(`Loaded ${okCount} ShopFlow artifact${okCount === 1 ? "" : "s"}.`);
        await load();
        if (okCount) onAllUploadedRef.current();
        if (autoRun && okCount > 0) {
          await runReverseEngineer(false);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load demo pack";
        toast.error(msg);
      } finally {
        setLoadingDemo(null);
      }
    },
    [projectId, userId, load, runReverseEngineer],
  );

  const loadRemotePreset = useCallback(
    async (preset: RemotePreset, autoRun = true) => {
      if (!userId) return;
      setLoadingDemo(preset.id);
      try {
        const res = await discoveryService.fetchPresetIntoProject({
          project_id: projectId,
          preset_id: preset.id,
        });
        if (!res.ok) {
          toast.error(errorOf(res).message || `Failed to load ${preset.title}`);
          return;
        }
        const r = res.value;
        const failed = (r.results || []).filter((x) => x.status === "failed");
        if (r.uploaded > 0 && failed.length === 0) {
          toast.success(
            `Pulled ${r.uploaded}/${r.total} files from ${r.preset_title || preset.title}.`,
          );
        } else if (r.uploaded > 0) {
          toast.warning(`Pulled ${r.uploaded}/${r.total} files — ${failed.length} failed`, {
            description: failed
              .slice(0, 3)
              .map((f) => `${f.filename}: ${f.error || "unknown"}`)
              .join("\n"),
          });
        } else {
          toast.error(`Could not pull any files from ${preset.title}`, {
            description: (failed[0]?.error || "All source URLs failed").slice(0, 200),
          });
        }
        await load();
        if (r.uploaded > 0) onAllUploadedRef.current();
        if (autoRun && r.uploaded > 0) {
          await runReverseEngineer(false);
        }
      } finally {
        setLoadingDemo(null);
      }
    },
    [projectId, userId, load, runReverseEngineer],
  );

  const loadGithubRepo = useCallback(
    async (repoUrl: string, ref?: string, autoRun = true) => {
      if (!userId) return;
      const trimmed = repoUrl.trim();
      if (!trimmed) {
        toast.error("Enter a GitHub repository URL");
        return;
      }
      setLoadingDemo("github");
      try {
        toast.info("Fetching from GitHub…", {
          description: "Listing repository files and downloading source. This may take 15–60s.",
        });
        const res = await discoveryService.fetchGithubRepo({
          project_id: projectId,
          repo_url: trimmed,
          ref: ref?.trim() || undefined,
        });
        if (!res.ok) {
          toast.error(errorOf(res).message || "GitHub import failed");
          return;
        }
        const r = res.value;
        if (r.error) {
          toast.error(r.error);
          return;
        }
        const failed = (r.results || []).filter((x) => x.status === "failed");
        const kindSummary = r.kinds
          ? Object.entries(r.kinds)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ")
          : "";
        if (r.uploaded > 0) {
          toast.success(
            `Imported ${r.uploaded} file${r.uploaded === 1 ? "" : "s"} from ${r.owner}/${r.repo}`,
            {
              description: [
                r.discovered > r.selected
                  ? `${r.discovered} found, top ${r.selected} selected`
                  : `${r.discovered} files in repo`,
                kindSummary,
              ]
                .filter(Boolean)
                .join(" · "),
            },
          );
        } else {
          toast.error(`Could not import from ${r.owner}/${r.repo}`, {
            description: failed[0]?.error || "No readable source files found",
          });
        }
        if (failed.length > 0 && r.uploaded > 0) {
          toast.warning(`${failed.length} file${failed.length === 1 ? "" : "s"} skipped`, {
            description: failed
              .slice(0, 2)
              .map((f) => `${f.path}: ${f.error || "failed"}`)
              .join("\n"),
          });
        }
        await load();
        if (r.uploaded > 0) onAllUploadedRef.current();
        if (autoRun && r.uploaded > 0) {
          await runReverseEngineer(false);
        }
      } finally {
        setLoadingDemo(null);
      }
    },
    [projectId, userId, load, runReverseEngineer],
  );

  const deleteImport = useCallback(
    async (imp: ProjectImport) => {
      const res = await discoveryService.deleteImport(imp);
      if (!res.ok) toast.error(errorOf(res).message);
      await load();
    },
    [load],
  );

  const lastActivity = useMemo(() => {
    if (!imports.length) return null;
    const latest = imports.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    return new Date(latest.created_at);
  }, [imports]);

  const parsedCount = imports.filter((i) => i.status === "parsed").length;
  const pendingCount = imports.filter((i) => i.status === "pending" || i.status === "failed").length;
  const findings = imports
    .filter((i) => i.status === "parsed" && i.parsed_summary)
    .reduce(
      (acc, i) => {
        const s = (i.parsed_summary || {}) as Record<string, number>;
        acc.endpoints += s.endpoints || 0;
        acc.schemas += s.schemas || 0;
        acc.tables += s.tables || 0;
        acc.components += s.components || 0;
        acc.requirements += s.requirements || 0;
        acc.adrs += s.adr || 0;
        return acc;
      },
      { endpoints: 0, schemas: 0, tables: 0, components: 0, requirements: 0, adrs: 0 },
    );

  return {
    imports,
    loading,
    uploading,
    reversing,
    loadingDemo,
    lastActivity,
    parsedCount,
    pendingCount,
    findings,
    hasImports: imports.length > 0,
    hasParsed: parsedCount > 0,
    reload: load,
    handleFiles,
    runReverseEngineer,
    loadDemoPack,
    loadRemotePreset,
    loadGithubRepo,
    deleteImport,
  };
}

/** Detect returning user (has prior imports + visited before). */
export function useReturningUser(projectId: string, loading: boolean, importCount: number) {
  const seenKey = `timearch.discovery.seen.${projectId}`;
  const [isReturning, setIsReturning] = useState(false);
  useEffect(() => {
    if (loading) return;
    const seen = typeof window !== "undefined" ? window.localStorage.getItem(seenKey) : null;
    if (seen && importCount > 0) setIsReturning(true);
    try {
      window.localStorage.setItem(seenKey, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, [loading, importCount, seenKey]);
  return { isReturning, dismissReturning: () => setIsReturning(false) } as const;
}
