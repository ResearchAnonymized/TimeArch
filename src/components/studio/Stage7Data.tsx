/**
 * Stage 7 — Data model (Studio native).
 *
 * Clean StageShell surface for designing the data architecture:
 *   - Load the latest `data_architecture` artifact (if the Data Architecture
 *     agent has already run) and hydrate the editable entity + relationship
 *     lists.
 *   - Load the latest `decomposition` artifact from Stage 6 so entities can
 *     be mapped to their owning component.
 *   - Add / edit / remove entities inline (name, description, attributes,
 *     owner component, aggregate root).
 *   - Add / edit / remove relationships (from → to, type, cardinality).
 *   - Trigger the Data Architecture agent via `useRunStage(7)` to
 *     auto-populate.
 *   - Persist the edited model as a new artifact version.
 *
 * Readiness gates to advance to Stage 8 (Interfaces & APIs):
 *   - Component decomposition exists (Stage 6 locked).
 *   - ≥3 entities with ≥1 attribute each.
 *   - Every entity maps to a known component from Stage 6.
 *   - Every relationship references known entities.
 *   - Latest saved artifact matches the current in-memory model.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  Database,
  Link2,
  AlertTriangle,
  Save,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import { matchComponent } from "@/lib/component-match";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES = [
  "one_to_one",
  "one_to_many",
  "many_to_many",
  "aggregation",
  "composition",
  "reference",
] as const;
type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

const ATTR_TYPES = [
  "uuid",
  "string",
  "text",
  "integer",
  "bigint",
  "numeric",
  "boolean",
  "timestamp",
  "date",
  "jsonb",
  "enum",
] as const;

interface Attribute {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
}

interface Entity {
  name: string;
  description: string;
  attributes: Attribute[];
  owner_component: string;
  aggregate_root: boolean;
}

interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  cardinality: string;
  description: string;
}

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function Stage7Data({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(7);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [savedHash, setSavedHash] = useState<string>("");
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [componentNames, setComponentNames] = useState<string[]>([]);
  const [decompositionVersion, setDecompositionVersion] = useState<number>(0);

  // Draft entity
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftOwner, setDraftOwner] = useState<string>("");

  // Draft relationship
  const [relFrom, setRelFrom] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relType, setRelType] = useState<RelationshipType>("one_to_many");
  const [relCard, setRelCard] = useState("1..*");
  const [relDesc, setRelDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, decomp] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 7)
        .eq("type", "data_architecture")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 6)
        .eq("type", "decomposition")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const rawComponents =
      (decomp.data?.content as { components?: unknown } | null)?.components;
    const names = Array.isArray(rawComponents)
      ? rawComponents
          .map((c: any) => (c && typeof c.name === "string" ? c.name : null))
          .filter((n): n is string => !!n)
      : [];
    setComponentNames(names);
    setDecompositionVersion(decomp.data?.version ?? 0);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const content = artifact.data.content as {
        entities?: unknown;
        relationships?: unknown;
        tables?: unknown;
      };
      let ents = normalizeEntities(content?.entities);
      let rels = normalizeRelationships(content?.relationships);
      // Adapter: reverse-engineered artifacts store `tables[]` (schema-style)
      // instead of `entities[]/relationships[]`. Map them so the UI renders
      // without requiring a re-run of the agent.
      if (ents.length === 0 && Array.isArray((content as any)?.tables)) {
        const adapted = adaptTablesToEntities((content as any).tables, names);
        ents = adapted.entities;
        if (rels.length === 0) rels = adapted.relationships;
      }
      // Auto-remap owner_component to canonical Stage 6 name when the agent
      // (or reverse-engineer) used a drifted label. Falls back to the first
      // known component so the model isn't blocked on an unresolvable name.
      if (names.length > 0) {
        const fallback = names[0];
        ents = ents.map((e) => {
          if (!e.owner_component) return { ...e, owner_component: fallback };
          if (names.some((n) => n.toLowerCase() === e.owner_component.toLowerCase())) return e;
          return { ...e, owner_component: matchComponent(e.owner_component, names) ?? fallback };
        });
      }
      setEntities(ents);
      setRelationships(rels);
      setSavedHash(hashOf(ents, rels));
    } else {
      setEntities([]);
      setRelationships([]);
      setSavedHash(hashOf([], []));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { runStage, running, polling } = useRunStage(projectId, 7, load);

  // ── Derived validations ─────────────────────────────────────────────────
  const entityNames = useMemo(
    () => new Set(entities.map((e) => e.name.toLowerCase())),
    [entities],
  );
  const componentSet = useMemo(
    () => new Set(componentNames.map((n) => n.toLowerCase())),
    [componentNames],
  );

  const validation = useMemo(() => {
    const issues: string[] = [];
    for (const e of entities) {
      if (!e.description.trim()) issues.push(`${e.name}: description is empty.`);
      if (e.attributes.length === 0) issues.push(`${e.name}: needs at least one attribute.`);
      if (!e.owner_component.trim()) {
        issues.push(`${e.name}: no owner component assigned.`);
      } else if (componentSet.size > 0 && !componentSet.has(e.owner_component.toLowerCase())) {
        issues.push(`${e.name}: owner "${e.owner_component}" is not a known component.`);
      }
      for (const a of e.attributes) {
        if (!a.name.trim()) issues.push(`${e.name}: attribute name is empty.`);
        if (!a.type.trim()) issues.push(`${e.name}.${a.name || "?"}: type is empty.`);
      }
    }
    for (const r of relationships) {
      if (!entityNames.has(r.from.toLowerCase())) {
        issues.push(`Relationship references unknown entity "${r.from}".`);
      }
      if (!entityNames.has(r.to.toLowerCase())) {
        issues.push(`Relationship references unknown entity "${r.to}".`);
      }
      if (r.from.toLowerCase() === r.to.toLowerCase() && r.type !== "reference") {
        issues.push(`${r.from} → ${r.to}: self-relationship must be of type "reference".`);
      }
    }
    return issues;
  }, [entities, relationships, entityNames, componentSet]);

  const dirty = hashOf(entities, relationships) !== savedHash;
  const hasComponents = componentNames.length > 0;
  const ready =
    hasComponents &&
    entities.length >= 3 &&
    entities.every((e) => e.attributes.length > 0) &&
    validation.length === 0 &&
    !dirty;

  // ── Mutations ───────────────────────────────────────────────────────────
  function addEntity() {
    const name = draftName.trim();
    if (!name) {
      toast.error("Give the entity a name.");
      return;
    }
    if (entityNames.has(name.toLowerCase())) {
      toast.error("An entity with that name already exists.");
      return;
    }
    setEntities((prev) => [
      ...prev,
      {
        name,
        description: draftDesc.trim(),
        attributes: [
          { name: "id", type: "uuid", nullable: false, description: "Primary key" },
        ],
        owner_component: draftOwner || componentNames[0] || "",
        aggregate_root: false,
      },
    ]);
    setDraftName("");
    setDraftDesc("");
    setDraftOwner("");
  }

  function updateEntity(idx: number, patch: Partial<Entity>) {
    setEntities((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function removeEntity(idx: number) {
    const e = entities[idx];
    setEntities((prev) => prev.filter((_, i) => i !== idx));
    // Drop any relationships that referenced this entity
    setRelationships((prev) =>
      prev.filter(
        (r) =>
          r.from.toLowerCase() !== e.name.toLowerCase() &&
          r.to.toLowerCase() !== e.name.toLowerCase(),
      ),
    );
  }

  function addAttribute(entityIdx: number) {
    updateEntity(entityIdx, {
      attributes: [
        ...entities[entityIdx].attributes,
        { name: "", type: "string", nullable: true },
      ],
    });
  }

  function updateAttribute(entityIdx: number, attrIdx: number, patch: Partial<Attribute>) {
    const attrs = entities[entityIdx].attributes.map((a, i) =>
      i === attrIdx ? { ...a, ...patch } : a,
    );
    updateEntity(entityIdx, { attributes: attrs });
  }

  function removeAttribute(entityIdx: number, attrIdx: number) {
    const attrs = entities[entityIdx].attributes.filter((_, i) => i !== attrIdx);
    updateEntity(entityIdx, { attributes: attrs });
  }

  function addRelationship() {
    if (!relFrom || !relTo) {
      toast.error("Pick both endpoints for the relationship.");
      return;
    }
    setRelationships((prev) => [
      ...prev,
      { from: relFrom, to: relTo, type: relType, cardinality: relCard.trim() || "1..*", description: relDesc.trim() },
    ]);
    setRelDesc("");
  }

  function removeRelationship(idx: number) {
    setRelationships((prev) => prev.filter((_, i) => i !== idx));
  }

  async function persist() {
    if (entities.length === 0) {
      toast.error("Add at least one entity before saving.");
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
    const mermaid = buildErdMermaid(entities, relationships);
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId,
      stage: 7,
      type: "data_architecture",
      title: `Data Architecture (v${nextVersion})`,
      version: nextVersion,
      status: "draft",
      created_by: uid,
      generated_by: "studio_manual",
      content: {
        title: `Data Architecture (v${nextVersion})`,
        summary: `${entities.length} entities, ${relationships.length} relationships.`,
        key_findings: [
          `${entities.filter((e) => e.aggregate_root).length} aggregate root(s) identified.`,
          `${new Set(entities.map((e) => e.owner_component)).size} owning component(s).`,
        ],
        entities,
        relationships,
        mermaid_diagrams: [{ title: "ERD", diagram: mermaid }],
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

  const missingHint = !hasComponents
    ? "Lock a component decomposition in Stage 6 first."
    : entities.length < 3
      ? `Add at least ${3 - entities.length} more entit${3 - entities.length === 1 ? "y" : "ies"}.`
      : validation.length > 0
        ? `Fix ${validation.length} validation issue${validation.length === 1 ? "" : "s"}.`
        : dirty
          ? "Save your changes first."
          : undefined;

  const aggregateRoots = entities.filter((e) => e.aggregate_root).length;
  const ownersCovered = new Set(entities.map((e) => e.owner_component).filter(Boolean)).size;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 7 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : entities.length > 0 ? "In progress" : "Not started",
        tone: ready ? "emerald" : entities.length > 0 ? "primary" : "neutral",
      }}
      stats={[
        {
          label: "Entities",
          value: loading ? "—" : entities.length,
          sub: entities.length >= 3 ? "healthy count" : "≥3 needed",
          tone: entities.length >= 3 ? "emerald" : "amber",
        },
        {
          label: "Relationships",
          value: loading ? "—" : relationships.length,
          sub: "edges in ERD",
          tone: "primary",
        },
        {
          label: "Aggregate roots",
          value: loading ? "—" : aggregateRoots,
          sub: aggregateRoots > 0 ? "DDD boundaries" : "optional",
          tone: aggregateRoots > 0 ? "primary" : "neutral",
        },
        {
          label: "Owners covered",
          value: `${ownersCovered}/${componentNames.length || "—"}`,
          sub: hasComponents ? "components with data" : "Stage 6 missing",
          tone: hasComponents ? "primary" : "amber",
        },
      ]}
      checks={[
        {
          key: "decomp",
          label: `Component decomposition locked (Stage 6${decompositionVersion ? ` v${decompositionVersion}` : ""})`,
          ok: hasComponents,
        },
        { key: "count", label: "At least 3 entities defined", ok: entities.length >= 3 },
        {
          key: "attrs",
          label: "Every entity has at least one attribute",
          ok: entities.length > 0 && entities.every((e) => e.attributes.length > 0),
        },
        {
          key: "owner",
          label: "Every entity maps to a known component",
          ok:
            entities.length > 0 &&
            entities.every(
              (e) => e.owner_component && componentSet.has(e.owner_component.toLowerCase()),
            ),
        },
        {
          key: "rels",
          label: "Relationships reference known entities",
          ok:
            relationships.every(
              (r) =>
                entityNames.has(r.from.toLowerCase()) && entityNames.has(r.to.toLowerCase()),
            ),
        },
        { key: "saved", label: "Latest edits saved as an artifact version", ok: !dirty && entities.length > 0 },
      ]}
      checklistTitle="Ready to lock the data model?"
      checklistBlurb="Downstream stages (APIs, cross-cutting concerns, infrastructure) reference these entities and their owners."
      advance={{
        label: ready ? "Data model is locked — advance to Stage 8" : "Complete the data model to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Interfaces & APIs",
        missingHint,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-generate */}
      <SectionCard
        title="Auto-generate data model"
        subtitle={
          !hasComponents
            ? "Lock a component decomposition in Stage 6 first — the agent maps entities to components."
            : `Runs the Data Architecture agent against your ${componentNames.length} component${componentNames.length === 1 ? "" : "s"}.`
        }
        right={
          <RunAgentButton
            onRun={runStage}
            running={running || polling}
            hasArtifact={artifactVersion > 0}
            disabledReason={!hasComponents ? "Define components in Stage 6 first." : undefined}
          />
        }
      >
        <div className="text-xs text-muted-foreground">
          {artifactVersion > 0 ? (
            <>
              Latest artifact: <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span>. Editing below creates a new version when saved.
            </>
          ) : (
            <>No data-architecture artifact yet. Run the agent or add entities manually below.</>
          )}
        </div>
      </SectionCard>

      {/* Add-entity row */}
      <SectionCard
        title="Add an entity"
        subtitle="Every entity starts with an `id` uuid primary key — add domain attributes below."
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input
            placeholder="Name (e.g. Order)"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="md:col-span-3"
          />
          <Input
            placeholder="Description (one sentence)"
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            className="md:col-span-5"
          />
          <Select value={draftOwner} onValueChange={setDraftOwner}>
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder={hasComponents ? "Owner component" : "No components"} />
            </SelectTrigger>
            <SelectContent>
              {componentNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addEntity} className="md:col-span-1 gap-1" disabled={!hasComponents}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </SectionCard>

      {/* Entities list */}
      <SectionCard
        title={`Entities (${entities.length})`}
        subtitle="Edit inline. Owner must reference a component from Stage 6."
        right={
          <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Save version" : "Saved"}
          </Button>
        }
      >
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : entities.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Database className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No entities yet. Add one above or run the agent.
          </div>
        ) : (
          <ul className="space-y-3">
            {entities.map((e, i) => {
              const ownerOk = !e.owner_component || componentSet.has(e.owner_component.toLowerCase());
              return (
                <li key={`${e.name}-${i}`} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                    <Input
                      value={e.name}
                      onChange={(ev) => updateEntity(i, { name: ev.target.value })}
                      className="md:col-span-3 font-mono text-sm font-semibold"
                    />
                    <Textarea
                      value={e.description}
                      onChange={(ev) => updateEntity(i, { description: ev.target.value })}
                      className="md:col-span-5 min-h-[38px] text-sm"
                      rows={1}
                      placeholder="Description"
                    />
                    <Select
                      value={e.owner_component || undefined}
                      onValueChange={(v) => updateEntity(i, { owner_component: v })}
                    >
                      <SelectTrigger
                        className={cn(
                          "md:col-span-3 text-sm",
                          !ownerOk && "border-rose-500/40 text-rose-600 dark:text-rose-300",
                        )}
                      >
                        <SelectValue placeholder="Owner component" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentNames.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeEntity(i)}
                      className="md:col-span-1 justify-self-end"
                      aria-label={`Remove ${e.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 pl-1">
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={e.aggregate_root}
                        onCheckedChange={(v) => updateEntity(i, { aggregate_root: !!v })}
                      />
                      <KeyRound className="h-3 w-3" />
                      Aggregate root
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {e.attributes.length} attribute{e.attributes.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Attributes */}
                  <div className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
                    {e.attributes.map((a, ai) => (
                      <div key={ai} className="grid grid-cols-12 gap-1.5 items-center">
                        <Input
                          value={a.name}
                          onChange={(ev) => updateAttribute(i, ai, { name: ev.target.value })}
                          placeholder="attr_name"
                          className="col-span-3 h-8 text-xs font-mono"
                        />
                        <Select
                          value={a.type}
                          onValueChange={(v) => updateAttribute(i, ai, { type: v })}
                        >
                          <SelectTrigger className="col-span-2 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTR_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={a.description ?? ""}
                          onChange={(ev) => updateAttribute(i, ai, { description: ev.target.value })}
                          placeholder="description"
                          className="col-span-5 h-8 text-xs"
                        />
                        <label className="col-span-1 flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={a.nullable}
                            onCheckedChange={(v) => updateAttribute(i, ai, { nullable: !!v })}
                          />
                          null
                        </label>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeAttribute(i, ai)}
                          className="col-span-1 h-7 w-7 justify-self-end"
                          aria-label="Remove attribute"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addAttribute(i)}
                      className="h-7 gap-1 text-[11px]"
                    >
                      <Plus className="h-3 w-3" /> Add attribute
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Relationships */}
      <SectionCard
        title={`Relationships (${relationships.length})`}
        subtitle="Wire entities together — cardinality uses UML notation (1..1, 1..*, *..*)."
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3">
          <Select value={relFrom} onValueChange={setRelFrom}>
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="From entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.name} value={e.name}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={relTo} onValueChange={setRelTo}>
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder="To entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.name} value={e.name}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={relType} onValueChange={(v) => setRelType(v as RelationshipType)}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={relCard}
            onChange={(e) => setRelCard(e.target.value)}
            placeholder="1..*"
            className="md:col-span-1 text-xs font-mono"
          />
          <Input
            value={relDesc}
            onChange={(e) => setRelDesc(e.target.value)}
            placeholder="Notes (optional)"
            className="md:col-span-2 text-xs"
          />
          <Button onClick={addRelationship} className="md:col-span-1 gap-1" disabled={entities.length < 2}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {relationships.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">
            <Link2 className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
            No relationships yet.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {relationships.map((r, i) => {
              const fromOk = entityNames.has(r.from.toLowerCase());
              const toOk = entityNames.has(r.to.toLowerCase());
              const bad = !fromOk || !toOk;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                    bad ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background",
                  )}
                >
                  <span className={cn("font-mono font-semibold", !fromOk && "text-rose-500")}>
                    {r.from}
                  </span>
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <span className={cn("font-mono font-semibold", !toOk && "text-rose-500")}>
                    {r.to}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{r.type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-mono">{r.cardinality}</span>
                  {r.description && (
                    <span className="text-muted-foreground truncate">— {r.description}</span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-6 w-6"
                    onClick={() => removeRelationship(i)}
                    aria-label="Remove relationship"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
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

function normalizeEntities(raw: unknown): Entity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e: any) => {
      if (!e || typeof e !== "object" || typeof e.name !== "string") return null;
      return {
        name: e.name,
        description: typeof e.description === "string" ? e.description : "",
        attributes: Array.isArray(e.attributes)
          ? e.attributes
              .map((a: any) =>
                a && typeof a.name === "string"
                  ? {
                      name: a.name,
                      type: typeof a.type === "string" ? a.type : "string",
                      nullable: !!a.nullable,
                      description: typeof a.description === "string" ? a.description : "",
                    }
                  : null,
              )
              .filter((a: Attribute | null): a is Attribute => !!a)
          : [],
        owner_component: typeof e.owner_component === "string" ? e.owner_component : "",
        aggregate_root: !!e.aggregate_root,
      } as Entity;
    })
    .filter((e): e is Entity => !!e);
}

function normalizeRelationships(raw: unknown): Relationship[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => {
      if (!r || typeof r !== "object" || typeof r.from !== "string" || typeof r.to !== "string") {
        return null;
      }
      const t = RELATIONSHIP_TYPES.includes(r.type) ? (r.type as RelationshipType) : "reference";
      return {
        from: r.from,
        to: r.to,
        type: t,
        cardinality: typeof r.cardinality === "string" ? r.cardinality : "",
        description: typeof r.description === "string" ? r.description : "",
      } as Relationship;
    })
    .filter((r): r is Relationship => !!r);
}

function hashOf(ents: Entity[], rels: Relationship[]): string {
  return JSON.stringify({
    e: ents.map((e) => [
      e.name,
      e.description,
      e.owner_component,
      e.aggregate_root,
      e.attributes.map((a) => [a.name, a.type, a.nullable, a.description ?? ""]),
    ]),
    r: rels.map((r) => [r.from, r.to, r.type, r.cardinality, r.description]),
  });
}

function buildErdMermaid(entities: Entity[], relationships: Relationship[]): string {
  const cardMap: Record<RelationshipType, string> = {
    one_to_one: "||--||",
    one_to_many: "||--o{",
    many_to_many: "}o--o{",
    aggregation: "}o--||",
    composition: "||--|{",
    reference: "}o..o{",
  };
  const lines = ["erDiagram"];
  for (const e of entities) {
    lines.push(`  ${sanitizeId(e.name)} {`);
    for (const a of e.attributes) {
      lines.push(`    ${sanitizeId(a.type || "string")} ${sanitizeId(a.name || "field")}`);
    }
    lines.push("  }");
  }
  for (const r of relationships) {
    const arrow = cardMap[r.type] ?? "||--o{";
    lines.push(
      `  ${sanitizeId(r.from)} ${arrow} ${sanitizeId(r.to)} : "${(r.description || r.type).replace(/"/g, "'")}"`,
    );
  }
  return lines.join("\n");
}

function sanitizeId(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, "_");
}

/**
 * Adapter: convert reverse-engineered `tables[]` (schema-style, from the
 * reverse-engineer function or brownfield imports) into the `entities[]` /
 * `relationships[]` shape the Studio expects.
 *
 * Table shape (best-effort):
 *   { name, description?, columns: [{ name, type, nullable?, primary_key?,
 *     foreign_key?: { table, column } | string, references?: string }] }
 */
function adaptTablesToEntities(
  tables: unknown,
  componentNames: string[],
): { entities: Entity[]; relationships: Relationship[] } {
  if (!Array.isArray(tables)) return { entities: [], relationships: [] };
  const fallbackOwner = componentNames[0] || "";
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];

  for (const t of tables) {
    if (!t || typeof t !== "object") continue;
    const name = typeof (t as any).name === "string" ? (t as any).name : null;
    if (!name) continue;
    const rawCols = Array.isArray((t as any).columns) ? (t as any).columns : [];
    const attributes: Attribute[] = rawCols
      .map((c: any): Attribute | null => {
        // Column can be a bare string (reverse-engineered) or an object.
        if (typeof c === "string") {
          const isId = /_id$|^id$/i.test(c);
          return {
            name: c,
            type: isId ? "uuid" : "string",
            nullable: false,
            description: isId ? (c.toLowerCase() === `${name.toLowerCase()}_id` ? "PK" : "FK-like") : "",
          };
        }
        if (!c || typeof c.name !== "string") return null;
        const desc: string[] = [];
        if (c.primary_key) desc.push("PK");
        const fk = c.foreign_key ?? c.references;
        if (fk) {
          const fkTable = typeof fk === "string" ? fk : fk.table;
          if (fkTable) desc.push(`FK → ${fkTable}`);
        }
        if (typeof c.description === "string" && c.description) desc.push(c.description);
        return {
          name: c.name,
          type: typeof c.type === "string" ? c.type : "string",
          nullable: !!c.nullable,
          description: desc.join(" · "),
        };
      })
      .filter((a: Attribute | null): a is Attribute => !!a);

    entities.push({
      name,
      description:
        typeof (t as any).description === "string" && (t as any).description
          ? (t as any).description
          : `Imported from source schema (${attributes.length} columns).`,
      attributes,
      owner_component:
        typeof (t as any).owner_component === "string"
          ? (t as any).owner_component
          : fallbackOwner,
      aggregate_root: !!(t as any).aggregate_root,
    });


    // Derive relationships from foreign keys, or infer from `<table>_id` cols
    const tableNames = new Set(
      (tables as any[]).map((x) => (x && typeof x.name === "string" ? x.name : "")).filter(Boolean),
    );
    for (const c of rawCols) {
      const colName = typeof c === "string" ? c : c?.name;
      const fk = typeof c === "string" ? null : (c?.foreign_key ?? c?.references);
      let toTable: string | null = null;
      let via = colName;
      if (fk) {
        toTable = typeof fk === "string" ? fk : fk.table;
      } else if (typeof colName === "string" && /_id$/i.test(colName)) {
        // Infer: `customer_id` → `customers` or `customer`
        const base = colName.replace(/_id$/i, "");
        if (base && base.toLowerCase() !== name.toLowerCase()) {
          if (tableNames.has(base)) toTable = base;
          else if (tableNames.has(`${base}s`)) toTable = `${base}s`;
        }
      }
      if (!toTable) continue;
      relationships.push({
        from: name,
        to: toTable,
        type: "reference",
        cardinality: "*..1",
        description: `${via} → ${toTable}`,
      });
    }

  }

  // Deduplicate relationships
  const seen = new Set<string>();
  const uniqRels = relationships.filter((r) => {
    const k = `${r.from}|${r.to}|${r.description}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { entities, relationships: uniqRels };
}

