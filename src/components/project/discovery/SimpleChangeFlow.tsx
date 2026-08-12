/**
 * Brownfield propose-change path:
 * - Sidebar tracks requirements
 * - Checkboxes pick which ones belong in THIS revision
 * - Analyze runs on the full revision set (not only the last saved item)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Play,
  Sparkles,
  Check,
  GitBranch,
  Scale,
  BookOpen,
  Package,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DiscoveryPanel,
  DiscoveryPanelHeader,
  DiscoveryStat,
} from "./parts/discoveryUi";
import ProposedArchitecturePanel from "./ProposedArchitecturePanel";
import DevelopmentHandoffPanel, { type HandoffSection } from "./DevelopmentHandoffPanel";
import RequirementsSidebar, {
  buildRevisionDescription,
  cleanFeatureTitle,
  isRevisionBundle,
  parseRevisionSourceIds,
  type RequirementItem,
} from "./RequirementsSidebar";
import {
  ANALYSIS_STAGES,
  runChangeAnalysis,
  type AnalysisStageKey,
} from "@/features/discovery/runChangeAnalysis";
import { useProposedArchitecture } from "@/features/discovery/useProposedArchitecture";
import { buildDevHandoff, decisionSummary, normalizeDecisionVerdicts, testSummary, type DevHandoff } from "@/lib/devHandoff";
import {
  loadLatestPipelineArtifact,
  loadStoredHandoff,
  persistInitialHandoffArtifact,
  persistPipelineArtifact,
  readPipelineLocal,
  writePipelineLocal,
  type PipelineSnapshot,
} from "@/lib/discoveryPipeline";
import type { SystemInventory } from "@/lib/systemInventory";
import { errorOf } from "@/lib/result";

interface FeatureChangeRow {
  id: string;
  title: string;
  description: string | null;
  change_type: string;
  priority: string;
  desired_behavior: string | null;
  current_behavior: string | null;
  status?: string;
}

interface Props {
  projectId: string;
  findingsSummary?: string;
  inventory?: SystemInventory | null;
  /** Propose = pick & analyze; Revision = results workspace */
  view?: "propose" | "revision";
  onOpenRevision?: () => void;
  onOpenPropose?: () => void;
}

const emptyForm = {
  title: "",
  description: "",
  current_behavior: "",
  desired_behavior: "",
  change_type: "modify",
  priority: "medium",
};

const REVISION_LS_KEY = (projectId: string) => `timearch.revision.ids.${projectId}`;

const REVISION_STEPS: {
  id: "impact" | HandoffSection;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[] = [
  { id: "impact", label: "See changes", hint: "Diagram & files", Icon: GitBranch },
  { id: "decide", label: "Review decisions", hint: "Go / no-go · edit", Icon: Scale },
  { id: "implement", label: "Build guide", hint: "Go / no-go · tests", Icon: BookOpen },
  { id: "package", label: "Change package", hint: "Proposal · plan · release", Icon: Package },
];

function readRevisionIds(projectId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(REVISION_LS_KEY(projectId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeRevisionIds(projectId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(REVISION_LS_KEY(projectId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

export default function SimpleChangeFlow({
  projectId,
  findingsSummary,
  inventory,
  view = "propose",
  onOpenRevision,
  onOpenPropose,
}: Props) {
  const { user } = useAuth();
  const [allRows, setAllRows] = useState<FeatureChangeRow[]>([]);
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revisionIds, setRevisionIds] = useState<Set<string>>(() => readRevisionIds(projectId));
  const [revisionAnalysisId, setRevisionAnalysisId] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stageStatus, setStageStatus] = useState<
    Partial<Record<AnalysisStageKey, "pending" | "running" | "done" | "failed">>
  >({});
  const [stageDetail, setStageDetail] = useState<Partial<Record<AnalysisStageKey, string>>>({});
  const [analysisDone, setAnalysisDone] = useState(false);
  const [handoff, setHandoff] = useState<DevHandoff | null>(null);
  const [restoredLabel, setRestoredLabel] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [resultTab, setResultTab] = useState<"impact" | HandoffSection>("impact");

  /** User-facing requirements only (hide internal revision bundles). */
  const changes = useMemo(
    () => allRows.filter((r) => !isRevisionBundle(r.description)),
    [allRows],
  );

  const revisionReqs = useMemo(
    () => changes.filter((c) => revisionIds.has(c.id)),
    [changes, revisionIds],
  );

  const updateRevisionIds = useCallback(
    (next: Set<string>) => {
      setRevisionIds(next);
      writeRevisionIds(projectId, next);
    },
    [projectId],
  );

  const loadAnalyzed = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setAnalyzedIds(new Set());
      return;
    }
    const { data } = await supabase
      .from("feature_mappings")
      .select("feature_change_id")
      .in("feature_change_id", ids);
    setAnalyzedIds(new Set((data || []).map((r) => r.feature_change_id)));
  }, []);

  const load = useCallback(async (opts?: { restorePipeline?: boolean }) => {
    const restorePipeline = opts?.restorePipeline === true;
    setLoading(true);
    const { data } = await supabase
      .from("feature_changes")
      .select("id,title,description,change_type,priority,desired_behavior,current_behavior,status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const rows = (data || []) as FeatureChangeRow[];
    setAllRows(rows);

    const visible = rows.filter((r) => !isRevisionBundle(r.description));
    const bundles = rows.filter((r) => isRevisionBundle(r.description));
    await loadAnalyzed([
      ...visible.map((r) => r.id),
      ...bundles.map((r) => r.id),
    ]);

    // Prune revision ids that no longer exist
    setRevisionIds((prev) => {
      const valid = new Set(visible.map((v) => v.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      writeRevisionIds(projectId, next);
      return next;
    });

    setSelectedId((prev) => {
      if (prev && visible.some((v) => v.id === prev)) return prev;
      return visible[0]?.id || null;
    });
    if (visible.length > 0) setComposing(false);

    if (!restorePipeline) {
      setLoading(false);
      return;
    }

    // --- Restore previous analysis pipeline (do not force re-analyze) ---
    let restored: { id: string; sources: string[]; title: string } | null = null;

    const tryId = (
      id: string,
      sources: string[],
      title: string,
    ): { id: string; sources: string[]; title: string } | null => {
      if (!rows.some((r) => r.id === id)) return null;
      return { id, sources, title };
    };

    // 1) DB pipeline artifact (survives browser/localStorage clear)
    const dbSnap = await loadLatestPipelineArtifact(projectId);
    if (dbSnap?.revisionAnalysisId && dbSnap.analysisDone) {
      const row = rows.find((r) => r.id === dbSnap.revisionAnalysisId);
      if (row) {
        restored = tryId(
          dbSnap.revisionAnalysisId,
          dbSnap.revisionIds.length
            ? dbSnap.revisionIds
            : parseRevisionSourceIds(row.description),
          row.title,
        );
      }
    }

    // 2) localStorage snapshot
    if (!restored) {
      const snap = readPipelineLocal(projectId);
      if (snap?.revisionAnalysisId && snap.analysisDone) {
        const row = rows.find((r) => r.id === snap.revisionAnalysisId);
        if (row) {
          restored = tryId(
            snap.revisionAnalysisId,
            snap.revisionIds?.length
              ? snap.revisionIds
              : parseRevisionSourceIds(row.description),
            row.title,
          );
        }
      }
    }

    // 3) Newest revision bundle that already has mappings
    if (!restored && bundles.length) {
      const { data: mapRows } = await supabase
        .from("feature_mappings")
        .select("feature_change_id")
        .in(
          "feature_change_id",
          bundles.map((b) => b.id),
        );
      const analyzedBundleIds = new Set((mapRows || []).map((m) => m.feature_change_id));
      const candidate = bundles.find((b) => analyzedBundleIds.has(b.id)) || null;
      if (candidate) {
        restored = {
          id: candidate.id,
          sources: parseRevisionSourceIds(candidate.description),
          title: candidate.title,
        };
      }
    }

    // 4) Proposed-architecture artifact for any feature change
    if (!restored) {
      const { data: arts } = await supabase
        .from("architecture_artifacts")
        .select("content,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(40);
      for (const a of arts || []) {
        const content = a.content as Record<string, unknown> | null;
        const meta = content?._meta as Record<string, unknown> | undefined;
        if (meta?.kind !== "proposed_architecture") continue;
        const fcId = meta.feature_change_id;
        if (typeof fcId !== "string") continue;
        const row = rows.find((r) => r.id === fcId);
        if (!row) continue;
        restored = {
          id: fcId,
          sources: isRevisionBundle(row.description)
            ? parseRevisionSourceIds(row.description)
            : [row.id],
          title: row.title,
        };
        break;
      }
    }

    if (restored) {
      const validSources = restored.sources.filter((id) => visible.some((v) => v.id === id));
      if (validSources.length) {
        updateRevisionIds(new Set(validSources));
      } else if (restored.sources.length) {
        updateRevisionIds(new Set(restored.sources));
      }
      setRevisionAnalysisId(restored.id);
      setAnalysisDone(true);
      setStageStatus(
        Object.fromEntries(ANALYSIS_STAGES.map((s) => [s.key, "done"])) as Partial<
          Record<AnalysisStageKey, "pending" | "running" | "done" | "failed">
        >,
      );
      setStageDetail(
        Object.fromEntries(ANALYSIS_STAGES.map((s) => [s.key, "Restored"])) as Partial<
          Record<AnalysisStageKey, string>
        >,
      );
      setRestoredLabel(restored.title);
      writePipelineLocal(projectId, {
        revisionAnalysisId: restored.id,
        revisionIds: restored.sources,
        analysisDone: true,
        savedAt: new Date().toISOString(),
      });
    }

    setLoading(false);
  }, [projectId, loadAnalyzed, updateRevisionIds]);

  useEffect(() => {
    void load({ restorePipeline: true });
  }, [load]);

  /**
   * Create or reuse a revision bundle feature_change that merges every
   * checked requirement so analysis sees the FULL set.
   */
  const ensureRevisionBundle = async (reqs: FeatureChangeRow[]): Promise<string> => {
    if (!user) throw new Error("Sign in required");
    if (!reqs.length) throw new Error("Include at least one requirement in this revision");

    const sourceIds = reqs.map((r) => r.id);
    const cleanTitles = reqs.map((r) =>
      r.title
        .replace(/\s*What should happen\s*:?\s*/i, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80),
    );
    const title =
      reqs.length === 1
        ? cleanTitles[0]
        : `Revision (${reqs.length}): ${cleanTitles.join(" · ")}`.slice(0, 180);

    const desired_behavior = reqs
      .map((r, i) => {
        const heading = cleanTitles[i] || r.title;
        const body = r.desired_behavior?.trim() || r.description?.trim() || "(no detail)";
        return `### ${i + 1}. ${heading}\n${body}`;
      })
      .join("\n\n");

    const current_behavior =
      reqs
        .map((r) => r.current_behavior?.trim())
        .filter(Boolean)
        .join("\n\n") || null;

    const description = buildRevisionDescription(sourceIds, findingsSummary);

    // Reuse an existing bundle with the same source set
    const existing = allRows.find((r) => {
      if (!isRevisionBundle(r.description)) return false;
      return sameIdSet(parseRevisionSourceIds(r.description), sourceIds);
    });

    if (existing) {
      await supabase
        .from("feature_changes")
        .update({
          title,
          desired_behavior,
          current_behavior,
          description,
          status: "draft",
          is_active: true,
        })
        .eq("id", existing.id);
      return existing.id;
    }

    const { data, error } = await supabase
      .from("feature_changes")
      .insert({
        project_id: projectId,
        title,
        description,
        desired_behavior,
        current_behavior,
        change_type: "modify",
        priority: "medium",
        status: "draft",
        is_active: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Could not create revision bundle");
    return data.id;
  };

  const selectRequirement = (id: string) => {
    setSelectedId(id);
    setComposing(false);
  };

  const toggleRevision = (id: string, included: boolean) => {
    const next = new Set(revisionIds);
    if (included) next.add(id);
    else next.delete(id);
    updateRevisionIds(next);
    if (included) {
      setSelectedId(id);
      setComposing(false);
    }
    setAnalysisDone(false);
    setHandoff(null);
    setRevisionAnalysisId(null);
    setRestoredLabel(null);
    setStageStatus({});
  };

  const includeAll = () => {
    updateRevisionIds(new Set(changes.map((c) => c.id)));
    setAnalysisDone(false);
    setHandoff(null);
    setRevisionAnalysisId(null);
    setRestoredLabel(null);
  };

  const clearRevision = () => {
    updateRevisionIds(new Set());
    setAnalysisDone(false);
    setHandoff(null);
    setRevisionAnalysisId(null);
    setRestoredLabel(null);
  };

  const startNew = () => {
    setComposing(true);
    setForm(emptyForm);
  };

  const saveChange = async () => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Give the requirement a short title");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("feature_changes")
      .insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim() || findingsSummary || null,
        current_behavior: form.current_behavior.trim() || null,
        desired_behavior: form.desired_behavior.trim() || null,
        change_type: form.change_type,
        priority: form.priority,
        status: "draft",
        is_active: true,
        created_by: user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message || "Could not save requirement");
      return;
    }
    // Auto-include newly saved requirement in this revision
    const next = new Set(revisionIds);
    next.add(data.id);
    updateRevisionIds(next);
    toast.success("Requirement saved and added to this revision");
    setForm(emptyForm);
    setSelectedId(data.id);
    setComposing(false);
    setAnalysisDone(false);
    setHandoff(null);
    setRevisionAnalysisId(null);
    await load();
  };

  const deleteRequirement = async (id: string) => {
    if (!confirm("Delete this requirement?")) return;
    const { error } = await supabase.from("feature_changes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement deleted");
    const next = new Set(revisionIds);
    next.delete(id);
    updateRevisionIds(next);
    if (selectedId === id) {
      setSelectedId(null);
      setComposing(true);
    }
    setAnalysisDone(false);
    setHandoff(null);
    await load();
  };

  const analyze = async () => {
    if (!revisionReqs.length) {
      toast.error("Check at least one requirement to include in this revision");
      return;
    }
    setAnalyzing(true);
    setHandoff(null);
    setAnalysisDone(false);
    const initial: Partial<Record<AnalysisStageKey, "pending" | "running" | "done" | "failed">> = {};
    for (const s of ANALYSIS_STAGES) initial[s.key] = "pending";
    setStageStatus(initial);
    setStageDetail({});

    try {
      const bundleId = await ensureRevisionBundle(revisionReqs);
      setRevisionAnalysisId(bundleId);
      // Refresh rows without restoring an older pipeline over this run
      await load({ restorePipeline: false });
      setRevisionAnalysisId(bundleId);

      const res = await runChangeAnalysis({
        projectId,
        featureChangeId: bundleId,
        inventory: inventory ?? null,
        onStage: (key, status, detail) => {
          setStageStatus((prev) => ({ ...prev, [key]: status }));
          if (detail) setStageDetail((prev) => ({ ...prev, [key]: detail }));
        },
      });

      if (!res.ok) {
        toast.error(errorOf(res).message || "Analysis failed");
        setAnalyzing(false);
        return;
      }

      // Mark source requirements as analyzed in UI
      setAnalyzedIds((prev) => {
        const next = new Set(prev);
        for (const r of revisionReqs) next.add(r.id);
        next.add(bundleId);
        return next;
      });

      setRevisionAnalysisId(bundleId);
      setAnalysisDone(true);
      setResultTab("impact");
      setRestoredLabel(null);
      onOpenRevision?.();
      const snap: PipelineSnapshot = {
        revisionAnalysisId: bundleId,
        revisionIds: revisionReqs.map((r) => r.id),
        analysisDone: true,
        savedAt: new Date().toISOString(),
      };
      await persistPipelineArtifact(projectId, snap, user?.id);
      toast.success(
        revisionReqs.length === 1
          ? "Analysis ready for this requirement"
          : `Analysis ready for revision (${revisionReqs.length} requirements)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build revision");
    } finally {
      setAnalyzing(false);
    }
  };

  const { proposed, loading: proposedLoading, reload: reloadProposed } = useProposedArchitecture(
    projectId,
    analysisDone ? revisionAnalysisId : null,
    inventory ?? null,
    user?.id,
  );

  useEffect(() => {
    if (analysisDone && revisionAnalysisId) void reloadProposed();
  }, [analysisDone, revisionAnalysisId, reloadProposed]);

  useEffect(() => {
    if (!revisionAnalysisId || !analysisDone) {
      setHandoff(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      // Prefer frozen handoff artifact
      const projRes = await supabase.from("projects").select("name").eq("id", projectId).single();
      const projectName = projRes.data?.name || "Project";
      const stored = await loadStoredHandoff(projectId, revisionAnalysisId, projectName);
      if (cancelled) return;
      // Prefer v2 professional packs; rebuild older frozen drafts once
      const storedVersion = (stored?.machineJson as { version?: number } | undefined)?.version;
      if (stored && storedVersion === 3) {
        setHandoff(stored);
        return;
      }

      if (!proposed || !inventory) {
        // Keep any existing handoff while proposed/inventory catch up
        return;
      }

      const [fcRes, workRes, altsRes, adrRes] = await Promise.all([
        supabase.from("feature_changes").select("*").eq("id", revisionAnalysisId).single(),
        supabase
          .from("feature_work_items")
          .select("title,description,category,effort,validation_criteria,ordering")
          .eq("feature_change_id", revisionAnalysisId)
          .order("ordering", { ascending: true }),
        supabase
          .from("architecture_alternatives")
          .select("name,description,pros,cons,risk,recommended")
          .eq("feature_change_id", revisionAnalysisId),
        supabase
          .from("adr_records")
          .select("title,decision,consequences,status")
          .eq("feature_change_id", revisionAnalysisId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (cancelled || !fcRes.data) return;

      const asStringList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

      const next = buildDevHandoff({
        projectName,
        featureChange: fcRes.data,
        inventory,
        proposed,
        workItems: (workRes.data || []).map((w) => ({
          title: w.title,
          description: w.description,
          category: w.category,
          effort: w.effort,
          validation_criteria: asStringList(w.validation_criteria),
          ordering: w.ordering,
        })),
        alternatives: (altsRes.data || []).map((a) => ({
          title: a.name,
          summary: a.description,
          tradeoffs: [
            a.risk ? `Risk: ${a.risk}` : null,
            Array.isArray(a.pros) ? `Pros: ${(a.pros as string[]).join("; ")}` : null,
            Array.isArray(a.cons) ? `Cons: ${(a.cons as string[]).join("; ")}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          is_preferred: !!a.recommended,
        })),
        adr: adrRes.data?.[0] || null,
        storedApprovals: {},
      });

      if (!cancelled) {
        setHandoff(next);
        // Freeze so reopen works even before any gate click
        void persistInitialHandoffArtifact(projectId, next, user?.id);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [proposed, inventory, revisionAnalysisId, analysisDone, projectId, user?.id]);

  const selected = changes.find((c) => c.id === selectedId) || null;

  const sidebarItems: RequirementItem[] = changes.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    desired_behavior: c.desired_behavior,
    current_behavior: c.current_behavior,
    status: c.status,
    analyzed: analyzedIds.has(c.id) || c.status === "approved" || c.status === "in_review",
  }));

  const capabilityCount = (proposed?.proposedFeatures.length || revisionReqs.length) || 0;
  const activeStepIndex = REVISION_STEPS.findIndex((s) => s.id === resultTab);

  /** Fill gaps on older stored packages from live inventory / proposed. */
  const displayHandoff = useMemo(() => {
    if (!handoff) return null;
    const recovered =
      handoff.recoveredFeatures?.length
        ? handoff.recoveredFeatures
        : (inventory?.currentFeatures || []).map((f) => f.title);
    const narrative =
      handoff.architectureNarrative ||
      (inventory || proposed
        ? {
            asIsSummary: `Recovered as-is system with ${recovered.length} capability(ies)${
              recovered.length ? `: ${recovered.slice(0, 5).join(", ")}` : ""
            }.`,
            toBeSummary: `This revision proposes ${(handoff.proposedFeatures || []).join("; ") || handoff.title}.`,
            diagramDiscussion:
              "Compare the pre-change (as-is) diagram with the post-change (to-be) diagram. Confirm new nodes match proposed capabilities and that unchanged contracts stay additive.",
            keyFindings: [
              `${recovered.length} recovered capability(ies)`,
              `${(handoff.proposedFeatures || []).length || 1} newly proposed change(s)`,
              `${handoff.filesToTouch?.length || 0} file(s) in touch set`,
              `${handoff.stats?.groundedRipples ?? 0} grounded ripple(s)`,
            ],
          }
        : undefined);
    return {
      ...handoff,
      mermaidAsIs: handoff.mermaidAsIs || inventory?.mermaidAsIs || "",
      mermaidProposed: handoff.mermaidProposed || proposed?.mermaidProposed || "",
      recoveredFeatures: recovered,
      proposedFeatures: handoff.proposedFeatures?.length
        ? handoff.proposedFeatures
        : proposed?.proposedFeatures || [],
      impactStats: handoff.impactStats || proposed?.stats,
      architectureNarrative: narrative,
      currentBehavior: handoff.currentBehavior || "",
      desiredBehavior: handoff.desiredBehavior || "",
    };
  }, [handoff, inventory, proposed]);

  return (
    <div className="space-y-5">
      {view === "propose" && (
        <DiscoveryPanel className="overflow-hidden">
          <DiscoveryPanelHeader
            title="Propose changes"
            meta={
              <DiscoveryStat
                label="Selected"
                value={`${revisionReqs.length}/${changes.length || 0}`}
                tone="emerald"
              />
            }
            actions={
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={startNew}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  New
                </Button>
                {analysisDone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => onOpenRevision?.()}
                  >
                    Open Review
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => void analyze()}
                  disabled={revisionReqs.length === 0 || analyzing}
                  className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analyzing…
                    </>
                  ) : analysisDone ? (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Re-analyze · {revisionReqs.length}
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Analyze · {revisionReqs.length}
                    </>
                  )}
                </Button>
              </>
            }
          />

          {(analyzing || (Object.keys(stageStatus).length > 0 && !analysisDone)) && (
            <div className="px-4 py-2 border-b border-border/80 bg-muted/20 space-y-1">
              {ANALYSIS_STAGES.map((s) => {
                const st = stageStatus[s.key] || "pending";
                if (st === "pending" && !analyzing) return null;
                return (
                  <div key={s.key} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span
                      className={
                        st === "done"
                          ? "text-emerald-600"
                          : st === "failed"
                            ? "text-destructive"
                            : "text-primary"
                      }
                    >
                      {st === "running"
                        ? "…"
                        : st === "done"
                          ? "Done"
                          : st === "failed"
                            ? "Failed"
                            : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {analysisDone && restoredLabel && !analyzing && (
            <p className="px-4 py-1.5 text-[11px] text-muted-foreground border-b border-border/80">
              Analysis restored — re-analyze after changing the selection.
            </p>
          )}

          <div className="grid lg:grid-cols-[minmax(240px,280px)_1fr] min-h-[28rem] items-stretch">
            <RequirementsSidebar
              items={sidebarItems}
              selectedId={composing ? null : selectedId}
              revisionIds={revisionIds}
              loading={loading}
              onSelect={selectRequirement}
              onToggleRevision={toggleRevision}
              onIncludeAll={includeAll}
              onClearRevision={clearRevision}
              onDelete={(id) => void deleteRequirement(id)}
              embedded
              hideNew
            />

            <div className="min-w-0 p-4 space-y-4 bg-card">
              {composing ? (
                <div className="space-y-3 max-w-xl">
                  <div>
                    <h3 className="text-sm font-semibold">New feature</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Describe what you want to add — separate from current features.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fc-title" className="text-[12px]">
                      Title
                    </Label>
                    <Input
                      id="fc-title"
                      placeholder="e.g. Session timer"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fc-desired" className="text-[12px]">
                      Desired behavior
                    </Label>
                    <Textarea
                      id="fc-desired"
                      rows={4}
                      placeholder="What should the system do after this change?"
                      value={form.desired_behavior}
                      onChange={(e) => setForm((f) => ({ ...f, desired_behavior: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fc-current" className="text-[12px]">
                      Current behavior{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="fc-current"
                      rows={2}
                      placeholder="What happens today?"
                      value={form.current_behavior}
                      onChange={(e) => setForm((f) => ({ ...f, current_behavior: e.target.value }))}
                    />
                  </div>
                  <Button
                    onClick={() => void saveChange()}
                    disabled={saving}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Save feature
                  </Button>
                </div>
              ) : selected ? (
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                      {cleanFeatureTitle(selected.title)}
                    </h3>
                    {selected.desired_behavior && (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                          Desired behavior
                        </p>
                        <p className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
                          {selected.desired_behavior.replace(
                            /^\s*What should happen\s*:?\s*/i,
                            "",
                          )}
                        </p>
                      </div>
                    )}
                    {selected.current_behavior && (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                          Today
                        </p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {selected.current_behavior}
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={revisionIds.has(selected.id) ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => toggleRevision(selected.id, !revisionIds.has(selected.id))}
                  >
                    {revisionIds.has(selected.id) ? "In revision" : "Add to revision"}
                  </Button>
                </div>
              ) : (
                <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
                  Select a feature on the left, or create a new one.
                </div>
              )}
            </div>
          </div>
        </DiscoveryPanel>
      )}

      {view === "revision" && !analysisDone && (
        <DiscoveryPanel className="px-4 py-8 text-center space-y-3">
          <h3 className="text-sm font-semibold">No revision yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Select features under Propose changes, run Analyze, then review the package here.
          </p>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onOpenPropose?.()}
          >
            Go to Propose changes
          </Button>
        </DiscoveryPanel>
      )}

      {view === "revision" && analysisDone && (
        <DiscoveryPanel>
          <DiscoveryPanelHeader
            title="This revision"
            meta={
              <>
                {handoff && (
                  <Badge
                    variant="outline"
                    className={
                      handoff.status === "approved"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : handoff.status === "in_review"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "border-primary/25 bg-primary/5 text-primary"
                    }
                  >
                    {handoff.status.replace("_", " ")}
                  </Badge>
                )}
                <DiscoveryStat label="Capabilities" value={capabilityCount} tone="emerald" />
                {proposed && (
                  <DiscoveryStat label="Files" value={proposed.filesToTouch.length} tone="sky" />
                )}
                {handoff && (
                  <>
                    <DiscoveryStat label="ADRs" value={handoff.stats.adrs ?? 0} tone="violet" />
                    <DiscoveryStat label="Tests" value={handoff.stats.tests ?? 0} tone="amber" />
                  </>
                )}
              </>
            }
          />

          {/* Revision steps — same scale as Import / Recover / Change */}
          <div className="border-b px-4 py-2.5">
            <nav aria-label="Revision steps">
              <ol className="flex items-center gap-2 w-full">
                {REVISION_STEPS.map((step, index) => {
                  const active = resultTab === step.id;
                  const done = index < activeStepIndex;
                  const Icon = step.Icon;
                  return (
                    <li key={step.id} className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        type="button"
                        title={step.hint}
                        aria-current={active ? "step" : undefined}
                        onClick={() => setResultTab(step.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active && "border-primary/35 bg-primary/10 shadow-sm",
                          done && !active && "border-emerald-500/30 bg-emerald-500/5",
                          !active && !done && "border-border hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                            active && "bg-primary text-primary-foreground",
                            done && !active && "bg-emerald-500 text-white",
                            !active && !done && "bg-muted text-muted-foreground",
                          )}
                        >
                          {done && !active ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          ) : (
                            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                        </span>
                        <span className="min-w-0 hidden sm:block">
                          <span
                            className={cn(
                              "block text-xs font-medium truncate",
                              active && "text-primary",
                              done && !active && "text-emerald-700 dark:text-emerald-300",
                              !active && !done && "text-foreground",
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="block text-[10px] text-muted-foreground truncate leading-tight">
                            {step.hint}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "sm:hidden text-[10px] font-medium truncate",
                            active ? "text-primary" : "text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </span>
                      </button>
                      {index < REVISION_STEPS.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0 hidden md:block" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          <div className="bg-card">
            {resultTab === "impact" && (
              <>
                {(proposed || proposedLoading) && (
                  <ProposedArchitecturePanel
                    proposed={proposed}
                    loading={proposedLoading}
                    embedded
                  />
                )}
                {!proposed && !proposedLoading && (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Diagram missing — click Re-analyze once.
                  </div>
                )}
              </>
            )}

            {resultTab !== "impact" && displayHandoff && user && (
              <DevelopmentHandoffPanel
                handoff={displayHandoff}
                projectId={projectId}
                userId={user.id}
                userName={user.email}
                onHandoffChange={setHandoff}
                embedded
                section={resultTab}
                hideActions
              />
            )}

            {resultTab !== "impact" && !displayHandoff && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Package still building… if this stays empty, re-analyze.
              </div>
            )}
          </div>

          {/* Sticky step footer — always-visible Back / Next */}
          <div className="sticky bottom-0 z-10 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                disabled={activeStepIndex <= 0}
                onClick={() => {
                  const prev = REVISION_STEPS[activeStepIndex - 1];
                  if (prev) setResultTab(prev.id);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back
                {activeStepIndex > 0 && (
                  <span className="hidden sm:inline text-muted-foreground font-normal ml-1">
                    · {REVISION_STEPS[activeStepIndex - 1]?.label}
                  </span>
                )}
              </Button>

              <p className="text-[11px] text-muted-foreground order-last sm:order-none w-full sm:w-auto text-center">
                Step {activeStepIndex + 1} of {REVISION_STEPS.length}
              </p>

              {activeStepIndex < REVISION_STEPS.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    const next = REVISION_STEPS[activeStepIndex + 1];
                    if (!next) return;
                    if (resultTab === "decide" && handoff) {
                      const s = decisionSummary(normalizeDecisionVerdicts(handoff));
                      const pending = s.adr.pending + s.ac.pending;
                      if (pending > 0) {
                        toast.message(`${pending} item${pending === 1 ? "" : "s"} still pending`, {
                          description: "You can still continue — clear them later if needed.",
                        });
                      }
                    }
                    if (resultTab === "implement" && handoff) {
                      const pending = testSummary(normalizeDecisionVerdicts(handoff)).pending;
                      if (pending > 0) {
                        toast.message(`${pending} test${pending === 1 ? "" : "s"} still pending`, {
                          description: "Go tests become the definition of done in Change package.",
                        });
                      }
                    }
                    setResultTab(next.id);
                  }}
                >
                  Next
                  <span className="hidden sm:inline font-normal opacity-90 ml-1">
                    · {REVISION_STEPS[activeStepIndex + 1]?.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground px-2">
                  {handoff?.status === "approved"
                    ? "Released for build"
                    : "View proposal · plan · then Release"}
                </span>
              )}
            </div>
          </div>
        </DiscoveryPanel>
      )}
    </div>
  );
}
