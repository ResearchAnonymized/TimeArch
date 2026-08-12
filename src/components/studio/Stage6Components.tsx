/**
 * Stage 6 — Component design (Studio native).
 *
 * Clean StageShell surface for capturing the decomposition:
 *   - Load the latest `decomposition` artifact (if the Decomposition agent
 *     has already run) and hydrate the editable component list.
 *   - Add / edit / remove components inline (name, type, responsibility,
 *     dependencies, related requirements).
 *   - Trigger the Decomposition agent via `useRunStage(6)` to auto-populate.
 *   - Persist the edited list as a new artifact version.
 *
 * Readiness gates to advance to Stage 7 (Data model):
 *   - Primary architecture style locked (Stage 5).
 *   - ≥3 components with responsibility.
 *   - No self-dependencies and no dependencies on undefined components.
 *   - Latest saved artifact matches the current in-memory list.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  Boxes,
  GitBranch,
  AlertTriangle,
  Save,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,

} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

const COMPONENT_TYPES = [
  "service",
  "module",
  "gateway",
  "worker",
  "datastore",
  "frontend",
  "shared_library",
  "external",
] as const;
type ComponentType = (typeof COMPONENT_TYPES)[number];

interface DesignComponent {
  name: string;
  type: ComponentType;
  responsibility: string;
  dependencies: string[];
  related_requirements: string[];
}

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function Stage6Components({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(6);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [components, setComponents] = useState<DesignComponent[]>([]);
  const [savedHash, setSavedHash] = useState<string>("");
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [primaryStyle, setPrimaryStyle] = useState<string | null>(null);
  const [driversCount, setDriversCount] = useState<number>(0);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState<Record<number, boolean>>({});
  const toggleExpand = (i: number) => setExpanded((p) => ({ ...p, [i]: !p[i] }));
  const toggleEdit = (i: number) => setEditing((p) => ({ ...p, [i]: !p[i] }));
  const allExpanded = components.length > 0 && components.every((_, i) => expanded[i]);
  const setAllExpanded = (v: boolean) =>
    setExpanded(v ? Object.fromEntries(components.map((_, i) => [i, true])) : {});

  // Draft row
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<ComponentType>("service");
  const [draftResp, setDraftResp] = useState("");
  const [draftDeps, setDraftDeps] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, style, drivers] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 6)
        .eq("type", "decomposition")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("system_style")
        .select("primary_style")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("architecture_drivers")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);

    setPrimaryStyle(style.data?.primary_style ?? null);
    setDriversCount(drivers.count ?? 0);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const raw = (artifact.data.content as { components?: unknown })?.components;
      const parsed = normalizeComponents(raw);
      setComponents(parsed);
      setSavedHash(hashOf(parsed));
    } else {
      setComponents([]);
      setSavedHash(hashOf([]));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { runStage, running, polling } = useRunStage(projectId, 6, load);

  // ── Derived validations ─────────────────────────────────────────────────
  const names = useMemo(() => new Set(components.map((c) => c.name.toLowerCase())), [components]);
  const validation = useMemo(() => {
    const issues: string[] = [];
    for (const c of components) {
      if (!c.responsibility.trim()) issues.push(`${c.name}: responsibility is empty.`);
      for (const d of c.dependencies) {
        if (d.toLowerCase() === c.name.toLowerCase()) {
          issues.push(`${c.name} depends on itself.`);
        } else if (!names.has(d.toLowerCase())) {
          issues.push(`${c.name} depends on unknown component "${d}".`);
        }
      }
    }
    return issues;
  }, [components, names]);

  const dirty = hashOf(components) !== savedHash;
  const ready =
    !!primaryStyle &&
    components.length >= 3 &&
    validation.length === 0 &&
    !dirty;

  // ── Mutations ───────────────────────────────────────────────────────────
  function addComponent() {
    const name = draftName.trim();
    if (!name) {
      toast.error("Give the component a name.");
      return;
    }
    if (names.has(name.toLowerCase())) {
      toast.error("A component with that name already exists.");
      return;
    }
    const deps = draftDeps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setComponents((prev) => [
      ...prev,
      { name, type: draftType, responsibility: draftResp.trim(), dependencies: deps, related_requirements: [] },
    ]);
    setDraftName("");
    setDraftResp("");
    setDraftDeps("");
  }

  function updateComponent(idx: number, patch: Partial<DesignComponent>) {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeComponent(idx: number) {
    setComponents((prev) => prev.filter((_, i) => i !== idx));
  }

  async function persist() {
    if (components.length === 0) {
      toast.error("Add at least one component before saving.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      toast.error("You need to be signed in.");
      return;
    }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId,
      stage: 6,
      type: "decomposition",
      title: `Component Decomposition (v${nextVersion})`,
      version: nextVersion,
      status: "draft",
      created_by: uid,
      generated_by: "studio_manual",
      content: {
        title: `Component Decomposition (v${nextVersion})`,
        summary: `${components.length} components, ${components.reduce((a, c) => a + c.dependencies.length, 0)} dependencies.`,
        components,
        dependency_graph: components.flatMap((c) =>
          c.dependencies.map((d) => ({ from: c.name, to: d, type: "uses" })),
        ),
        decomposition_approach: primaryStyle ? `Aligned with ${primaryStyle} style.` : "Manual decomposition.",
      } as unknown as never,
    });
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save: ${error.message}`);
      return;
    }
    toast.success(`Saved as v${nextVersion}`);
    await load();
  }

  const missingHint = !primaryStyle
    ? "Lock a primary style in Stage 5 first."
    : components.length < 3
      ? `Add at least ${3 - components.length} more component${3 - components.length === 1 ? "" : "s"}.`
      : validation.length > 0
        ? `Fix ${validation.length} validation issue${validation.length === 1 ? "" : "s"}.`
        : dirty
          ? "Save your changes first."
          : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 6 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : components.length > 0 ? "In progress" : "Not started",
        tone: ready ? "emerald" : components.length > 0 ? "primary" : "neutral",
      }}
      stats={[
        {
          label: "Components",
          value: loading ? "—" : components.length,
          sub: components.length >= 3 ? "healthy count" : "≥3 needed",
          tone: components.length >= 3 ? "emerald" : "amber",
        },
        {
          label: "Dependencies",
          value: loading ? "—" : components.reduce((a, c) => a + c.dependencies.length, 0),
          sub: "edges in graph",
          tone: "primary",
        },
        {
          label: "Style",
          value: primaryStyle ? formatStyle(primaryStyle) : "—",
          sub: primaryStyle ? "from Stage 5" : "pick a style",
          tone: primaryStyle ? "primary" : "amber",
        },
        {
          label: "Issues",
          value: validation.length,
          sub: validation.length === 0 ? "clean" : "needs attention",
          tone: validation.length === 0 ? "emerald" : "rose",
        },
      ]}
      checks={[
        { key: "style", label: "Primary architecture style locked (Stage 5)", ok: !!primaryStyle },
        { key: "count", label: "At least 3 components defined", ok: components.length >= 3 },
        { key: "resp", label: "Every component has a responsibility", ok: components.every((c) => c.responsibility.trim().length > 0) && components.length > 0 },
        { key: "deps", label: "No self- or unknown dependencies", ok: validation.length === 0 && components.length > 0 },
        { key: "saved", label: "Latest edits saved as an artifact version", ok: !dirty && components.length > 0 },
      ]}
      checklistTitle="Ready to lock the component decomposition?"
      checklistBlurb="Downstream stages (data model, APIs, cross-cutting concerns) reference these components by name."
      advance={{
        label: ready ? "Decomposition is locked — advance to Stage 7" : "Complete the decomposition to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Data model",
        missingHint,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-generate */}
      <SectionCard
        title="Auto-generate decomposition"
        subtitle={
          driversCount === 0
            ? "Add drivers in Stage 4 and lock a style in Stage 5 for the best results."
            : `Runs the Decomposition agent against your ${driversCount} driver${driversCount === 1 ? "" : "s"} and the ${primaryStyle ? formatStyle(primaryStyle) : "chosen"} style.`
        }
        right={
          <RunAgentButton
            onRun={runStage}
            running={running || polling}
            hasArtifact={artifactVersion > 0}
            disabledReason={!primaryStyle ? "Lock a primary style in Stage 5 first." : undefined}
          />
        }
      >
        <div className="text-xs text-muted-foreground">
          {artifactVersion > 0 ? (
            <>Latest artifact: <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span>. Editing below creates a new version when saved.</>
          ) : (
            <>No decomposition artifact yet. You can run the agent or add components manually below.</>
          )}
        </div>
      </SectionCard>

      {/* Add-component row */}
      <SectionCard title="Add a component" subtitle="Keep names short and use lowercase-kebab or PascalCase consistently.">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input
            placeholder="Name (e.g. auth-service)"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="md:col-span-3"
          />
          <Select value={draftType} onValueChange={(v) => setDraftType(v as ComponentType)}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPONENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Responsibility (one sentence)"
            value={draftResp}
            onChange={(e) => setDraftResp(e.target.value)}
            className="md:col-span-4"
          />
          <Input
            placeholder="Depends on (comma-separated)"
            value={draftDeps}
            onChange={(e) => setDraftDeps(e.target.value)}
            className="md:col-span-2"
          />
          <Button onClick={addComponent} className="md:col-span-1 gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </SectionCard>

      {/* Components list */}
      <SectionCard
        title={`Components (${components.length})`}
        subtitle="Expand a row to edit its responsibility and dependencies."
        right={
          <div className="flex items-center gap-2">
            {components.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAllExpanded(!allExpanded)}
                className="text-xs"
              >
                {allExpanded ? "Collapse all" : "Expand all"}
              </Button>
            )}
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : components.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Boxes className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No components yet. Add one above or run the agent.
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-background overflow-hidden">
            {components.map((c, i) => {
              const isOpen = !!expanded[i];
              const respPreview = c.responsibility.trim() || "No responsibility set";
              const typeTone = typeToneFor(c.type);
              return (
                <li key={`${c.name}-${i}`} className={cn("group transition-colors", isOpen ? "bg-muted/30" : "hover:bg-muted/20")}>
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(i)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border bg-background text-muted-foreground shrink-0">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 text-primary shrink-0">
                        <Boxes className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-foreground truncate">{c.name}</span>
                          <span className={cn("text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border", typeTone)}>
                            {c.type}
                          </span>
                        </div>
                        {!isOpen && (
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {respPreview}
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0 pl-2">
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          <span className="font-mono tabular-nums">{c.dependencies.length}</span>
                          <span className="opacity-70">dep{c.dependencies.length === 1 ? "" : "s"}</span>
                        </span>
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeComponent(i)}
                      className="shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>


                  {/* Expanded body */}
                  {isOpen && (
                    <div className="border-t bg-background px-4 py-4">
                      {!editing[i] ? (
                        // ── READ MODE: focused, decision-oriented ──
                        <div className="space-y-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              Responsibility
                            </div>
                            <p className="text-sm leading-relaxed text-foreground">
                              {c.responsibility.trim() || (
                                <span className="italic text-muted-foreground">No responsibility set yet.</span>
                              )}
                            </p>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                              Dependencies
                            </div>
                            {c.dependencies.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No dependencies.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {c.dependencies.map((d) => {
                                  const unknown =
                                    !names.has(d.toLowerCase()) ||
                                    d.toLowerCase() === c.name.toLowerCase();
                                  return (
                                    <span
                                      key={d}
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono",
                                        unknown
                                          ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
                                          : "border-border bg-muted/40 text-foreground",
                                      )}
                                    >
                                      <GitBranch className="h-2.5 w-2.5 opacity-60" />
                                      {d}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleEdit(i)}
                              className="gap-1.5 h-7 text-xs"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // ── EDIT MODE: form appears only on demand ──
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Name
                              </label>
                              <Input
                                value={c.name}
                                onChange={(e) => updateComponent(i, { name: e.target.value })}
                                className="mt-1 font-mono text-sm"
                                placeholder="Name"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Type
                              </label>
                              <Select
                                value={c.type}
                                onValueChange={(v) => updateComponent(i, { type: v as ComponentType })}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMPONENT_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Responsibility
                            </label>
                            <Textarea
                              value={c.responsibility}
                              onChange={(e) => updateComponent(i, { responsibility: e.target.value })}
                              className="mt-1 text-sm leading-relaxed min-h-[80px] resize-y"
                              rows={3}
                              placeholder="What this component is responsible for…"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Dependencies
                              <span className="ml-1 normal-case tracking-normal opacity-60 font-normal">
                                comma-separated component names
                              </span>
                            </label>
                            <Input
                              value={c.dependencies.join(", ")}
                              onChange={(e) =>
                                updateComponent(i, {
                                  dependencies: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="e.g. auth-service, user-repo"
                              className="mt-1 text-sm font-mono"
                            />
                          </div>

                          <div className="flex justify-end pt-1">
                            <Button
                              size="sm"
                              onClick={() => toggleEdit(i)}
                              className="gap-1.5 h-7 text-xs"
                            >
                              <Check className="h-3 w-3" />
                              Done
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Validation */}
      {validation.length > 0 && (
        <SectionCard title="Validation issues" subtitle="Resolve these before advancing.">
          <ul className="space-y-1.5">
            {validation.map((v, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </StageShell>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeComponents(raw: unknown): DesignComponent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => {
      if (!c || typeof c !== "object" || typeof c.name !== "string") return null;
      const t = COMPONENT_TYPES.includes(c.type) ? (c.type as ComponentType) : "service";
      return {
        name: c.name,
        type: t,
        responsibility: typeof c.responsibility === "string" ? c.responsibility : "",
        dependencies: Array.isArray(c.dependencies) ? c.dependencies.filter((d: unknown) => typeof d === "string") : [],
        related_requirements: Array.isArray(c.related_requirements)
          ? c.related_requirements.filter((d: unknown) => typeof d === "string")
          : [],
      } as DesignComponent;
    })
    .filter((c): c is DesignComponent => !!c);
}

function hashOf(cs: DesignComponent[]): string {
  return JSON.stringify(
    cs.map((c) => [c.name, c.type, c.responsibility, [...c.dependencies].sort()]),
  );
}

function formatStyle(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function typeToneFor(t: string): string {
  switch (t) {
    case "service":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "module":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "gateway":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "worker":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "datastore":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "frontend":
      return "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300";
    case "shared_library":
      return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    case "external":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}
