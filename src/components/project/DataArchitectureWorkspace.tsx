import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Table2,
  Link2,
  Shield,
  Eye,
  Lock,
  ChevronDown,
  ChevronRight,
  Layers,
  Box,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  GitBranch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import RunStageCTA from "./RunStageCTA";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { useDensity } from "@/contexts/DensityContext";
import { DensityText, DensityList, DensitySection } from "./DensityControls";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import LockAdvanceBar from "./LockAdvanceBar";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

/**
 * Auto-generate a Mermaid erDiagram from entities and relationships data
 * when the AI agent doesn't provide one in mermaid_diagrams.
 */
function generateErDiagram(entities: any[], relationships: any[]): string {
  const lines: string[] = ["erDiagram"];

  for (const entity of entities) {
    if (!entity.name) continue;
    const safeName = entity.name.replace(/[^A-Za-z0-9_]/g, "_");
    lines.push(`    ${safeName} {`);
    if (entity.attributes?.length) {
      for (const attr of entity.attributes) {
        const type = (attr.type || "string").replace(/[^A-Za-z0-9_]/g, "_");
        const name = (attr.name || "field").replace(/[^A-Za-z0-9_]/g, "_");
        lines.push(`        ${type} ${name}`);
      }
    }
    lines.push("    }");
  }

  const cardinalityMap: Record<string, string> = {
    "one-to-one": "||--||",
    "one-to-many": "||--o{",
    "many-to-one": "}o--||",
    "many-to-many": "}o--o{",
  };

  for (const rel of relationships) {
    if (!rel.from || !rel.to) continue;
    const from = rel.from.replace(/[^A-Za-z0-9_]/g, "_");
    const to = rel.to.replace(/[^A-Za-z0-9_]/g, "_");
    const op = cardinalityMap[rel.type] || cardinalityMap[rel.cardinality] || "||--o{";
    const label = (rel.description || rel.type || "relates").replace(/"/g, "'").substring(0, 40);
    lines.push(`    ${from} ${op} ${to} : "${label}"`);
  }

  return lines.join("\n");
}

/**
 * Adapter: convert reverse-engineered `tables[]` (schema-style) into the
 * `entities[]`/`relationships[]` shape this workspace expects.
 */
function adaptTablesToEntities(tables: any[]): { entities: any[]; relationships: any[] } {
  const entities: any[] = [];
  const relationships: any[] = [];
  const tableNames = new Set(
    tables.map((x) => (x && typeof x.name === "string" ? x.name : "")).filter(Boolean),
  );
  for (const t of tables) {
    if (!t || typeof t !== "object" || typeof t.name !== "string") continue;
    const cols = Array.isArray(t.columns) ? t.columns : [];
    const attributes = cols
      .map((c: any) => {
        if (typeof c === "string") {
          const isPk = c.toLowerCase() === `${t.name.toLowerCase()}_id` || c.toLowerCase() === "id";
          return {
            name: c,
            type: /_id$|^id$/i.test(c) ? "uuid" : "string",
            nullable: false,
            description: isPk ? "PK" : "",
          };
        }
        if (!c || typeof c.name !== "string") return null;
        const desc: string[] = [];
        if (c.primary_key) desc.push("PK");
        const fk = c.foreign_key ?? c.references;
        const fkTable = typeof fk === "string" ? fk : fk?.table;
        if (fkTable) desc.push(`FK → ${fkTable}`);
        if (typeof c.description === "string" && c.description) desc.push(c.description);
        return {
          name: c.name,
          type: typeof c.type === "string" ? c.type : "string",
          nullable: !!c.nullable,
          description: desc.join(" · "),
        };
      })
      .filter(Boolean);
    entities.push({
      name: t.name,
      description:
        typeof t.description === "string" && t.description
          ? t.description
          : `Imported from source schema (${attributes.length} columns).`,
      attributes,
      owner_component: typeof t.owner_component === "string" ? t.owner_component : "",
      aggregate_root: !!t.aggregate_root,
    });
    for (const c of cols) {
      const colName = typeof c === "string" ? c : c?.name;
      const fk = typeof c === "string" ? null : (c?.foreign_key ?? c?.references);
      let toTable: string | null = null;
      if (fk) {
        toTable = typeof fk === "string" ? fk : fk?.table;
      } else if (typeof colName === "string" && /_id$/i.test(colName)) {
        const base = colName.replace(/_id$/i, "");
        if (base && base.toLowerCase() !== t.name.toLowerCase()) {
          if (tableNames.has(base)) toTable = base;
          else if (tableNames.has(`${base}s`)) toTable = `${base}s`;
        }
      }
      if (typeof toTable === "string" && toTable) {
        relationships.push({
          from: t.name,
          to: toTable,
          type: "many-to-one",
          description: `${colName} → ${toTable}`,
        });
      }
    }
  }
  return { entities, relationships };
}



function EntityCard({ entity, index }: { entity: any; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-3 w-full text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Table2 className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-display font-semibold text-sm flex-1">{entity.name}</span>
        {entity.aggregate_root && (
          <Badge variant="default" className="text-[9px]">
            Root
          </Badge>
        )}
        {entity.owner_component && (
          <Badge variant="outline" className="text-[9px]">
            {entity.owner_component}
          </Badge>
        )}
        {entity.attributes?.length > 0 && (
          <span className="text-[9px] text-muted-foreground">{entity.attributes.length} attrs</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 space-y-2 text-xs">
              {entity.description && <p className="text-muted-foreground">{entity.description}</p>}
              {entity.attributes?.length > 0 && (
                <div className="space-y-1">
                  {entity.attributes.map((attr: any, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="font-mono text-foreground min-w-[100px]">{attr.name}</span>
                      <Badge variant="outline" className="text-[8px] h-4">
                        {attr.type}
                      </Badge>
                      {attr.nullable && (
                        <span className="text-muted-foreground/50 text-[9px]">nullable</span>
                      )}
                      {attr.description && (
                        <span className="text-muted-foreground/60 truncate">
                          {attr.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RelationshipTable({ relationships }: { relationships: any[] }) {
  if (!relationships?.length)
    return <p className="text-xs text-muted-foreground italic">No relationships defined.</p>;
  const typeColors: Record<string, string> = {
    "one-to-many": "bg-primary/10 text-primary",
    "many-to-many": "bg-warning/10 text-warning",
    "one-to-one": "bg-success/10 text-success",
  };
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/50">
            <th className="text-left p-2.5 font-display font-semibold">From</th>
            <th className="text-center p-2.5 font-display font-semibold">Type</th>
            <th className="text-left p-2.5 font-display font-semibold">To</th>
            <th className="text-left p-2.5 font-display font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((r: any, i: number) => (
            <tr key={i} className="border-t hover:bg-secondary/20 transition-colors">
              <td className="p-2.5 font-semibold">{r.from}</td>
              <td className="p-2.5 text-center">
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded ${typeColors[r.type] || "bg-secondary text-muted-foreground"}`}
                >
                  {r.type}
                </span>
              </td>
              <td className="p-2.5 font-semibold">{r.to}</td>
              <td className="p-2.5 text-muted-foreground">{r.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataArchitectureWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 7)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) setArtifact(data[0]);
      setLoading(false);
    };
    fetch();
  }, [projectId, refreshKey]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );

  if (!artifact)
    return (
      <div className="text-center py-12 rounded-lg border border-dashed">
        <Database className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No data architecture generated yet.</p>
        <RunStageCTA stageLabel="Data Architecture" onRun={onRunStage} running={stageRunning} />
      </div>
    );

  let content = artifact.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  const rawEntities = content.entities || [];
  const rawRelationships = content.relationships || [];
  const rawTables = content.tables;
  // Adapter: reverse-engineered artifacts store schema-style `tables[]`
  // instead of `entities[]`/`relationships[]`. Map them so the UI renders.
  let entities = rawEntities;
  let relationships = rawRelationships;
  if (entities.length === 0 && Array.isArray(rawTables)) {
    const adapted = adaptTablesToEntities(rawTables);
    entities = adapted.entities;
    if (relationships.length === 0) relationships = adapted.relationships;
  }
  const rawAggregates = content.aggregates || [];
  // Filter out empty/malformed aggregates and fall back to deriving from entities
  let aggregates = rawAggregates.filter(
    (a: any) => a && (a.name || a.root) && (a.members?.length || a.root),
  );
  if (aggregates.length === 0 && entities.length > 0) {
    // Derive: group entities by owner_component, use aggregate_root entity as root
    const byOwner: Record<string, any[]> = {};
    for (const e of entities) {
      const owner = e.owner_component || "Unassigned";
      (byOwner[owner] ||= []).push(e);
    }
    aggregates = Object.entries(byOwner).map(([owner, ents]) => {
      const root = ents.find((e) => e.aggregate_root) || ents[0];
      return {
        name: `${owner} Aggregate`,
        root: root?.name || owner,
        members: ents.map((e) => e.name).filter(Boolean),
        _derived: true,
      };
    });
  }
  const ownership = content.data_ownership || [];
  const consistency = content.consistency_requirements || [];
  const privacy = content.privacy_considerations || [];
  const security = content.security_considerations || [];
  const sharedRisks = content.shared_data_risks || [];

  // Extract AI-provided diagrams
  const aiDiagrams = extractMermaidDiagrams(content);

  // Check if there's already an ER diagram from the AI
  const hasErDiagram = aiDiagrams.some(
    (d) => d.type === "erDiagram" || d.code?.trim().startsWith("erDiagram"),
  );

  // Auto-generate ER diagram if AI didn't provide one and we have entity data
  const allDiagrams = [...aiDiagrams];
  if (!hasErDiagram && entities.length > 0 && relationships.length > 0) {
    allDiagrams.unshift({
      title: "Entity-Relationship Diagram (auto-generated)",
      type: "erDiagram",
      code: generateErDiagram(entities, relationships),
    });
  }

  // Separate ER diagrams from other diagrams for prominent display
  const erDiagrams = allDiagrams.filter(
    (d) => d.type === "erDiagram" || d.code?.trim().startsWith("erDiagram"),
  );
  const otherDiagrams = allDiagrams.filter(
    (d) => d.type !== "erDiagram" && !d.code?.trim().startsWith("erDiagram"),
  );

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[7]} title="Data Architecture" />
      {content.summary && (
        <div className="bg-primary/5 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <DensityText compactLength={200}>{content.summary}</DensityText>
          </p>
        </div>
      )}

      {/* ER Diagram — prominent display */}
      {erDiagrams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Entity-Relationship Diagram</h3>
            <Badge variant="outline" className="text-[9px]">
              {entities.length} entities · {relationships.length} relationships
            </Badge>
          </div>
          {erDiagrams.map((d, i) => (
            <MermaidDiagram key={`er-${i}`} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      {/* Other diagrams */}
      {otherDiagrams.length > 0 && (
        <div className="space-y-3">
          {otherDiagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="entities" className="text-xs gap-1.5">
            <Table2 className="h-3 w-3" />
            Entities ({entities.length})
          </TabsTrigger>
          <TabsTrigger value="relationships" className="text-xs gap-1.5">
            <Link2 className="h-3 w-3" />
            Relations ({relationships.length})
          </TabsTrigger>
          <TabsTrigger value="aggregates" className="text-xs gap-1.5">
            <Layers className="h-3 w-3" />
            Aggregates
          </TabsTrigger>
          <TabsTrigger value="governance" className="text-xs gap-1.5">
            <Shield className="h-3 w-3" />
            Governance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-2 mt-4">
          {entities.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No entities.</p>
          ) : (
            <DensityList
              items={entities}
              label="Entities"
              standardLimit={5}
              renderItem={(e: any, i: number) => <EntityCard key={i} entity={e} index={i} />}
            />
          )}
        </TabsContent>

        <TabsContent value="relationships" className="mt-4">
          <RelationshipTable relationships={relationships} />
        </TabsContent>

        <TabsContent value="aggregates" className="space-y-4 mt-4">
          {aggregates.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No aggregates defined.</p>
          ) : (
            aggregates.map((agg: any, i: number) => (
              <div key={i} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="h-4 w-4 text-primary" />
                  <span className="font-display font-semibold text-sm">{agg.name}</span>
                  <Badge variant="outline" className="text-[9px]">
                    Root: {agg.root}
                  </Badge>
                  {agg._derived && (
                    <Badge variant="secondary" className="text-[9px]">
                      auto-derived
                    </Badge>
                  )}
                </div>
                {agg.members?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agg.members.map((m: string, j: number) => (
                      <span
                        key={j}
                        className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {ownership.length > 0 && (
            <div>
              <h5 className="font-display font-semibold text-xs mb-2 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-primary" />
                Data Ownership
              </h5>
              <div className="space-y-1.5">
                {ownership.map((o: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-2 rounded border">
                    <span className="font-semibold min-w-[100px]">{o.component}</span>
                    <div className="flex flex-wrap gap-1">
                      {o.entities?.map((e: string, j: number) => (
                        <span
                          key={j}
                          className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="governance" className="space-y-4 mt-4">
          {consistency.length > 0 && (
            <div>
              <DensitySection label="Consistency Requirements" count={consistency.length}>
                <div className="mt-2">
                  <DensityList
                    items={consistency}
                    label="Consistency"
                    standardLimit={3}
                    renderItem={(c: any, i: number) => (
                      <div key={i} className="p-2.5 rounded border text-xs mb-1.5">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge
                            variant={c.type === "strong" ? "default" : "secondary"}
                            className="text-[9px]"
                          >
                            {c.type}
                          </Badge>
                          {c.scope && <span className="text-muted-foreground">{c.scope}</span>}
                        </div>
                        <p className="text-muted-foreground">
                          <DensityText compactLength={100}>{c.description}</DensityText>
                        </p>
                      </div>
                    )}
                  />
                </div>
              </DensitySection>
            </div>
          )}

          {(privacy.length > 0 || security.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {privacy.length > 0 && (
                <div className="rounded-lg border bg-card p-3">
                  <h5 className="font-display font-semibold text-xs mb-2 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-warning" />
                    Privacy
                  </h5>
                  {privacy.map((p: string, i: number) => (
                    <p key={i} className="text-[11px] text-muted-foreground mb-1">
                      • {p}
                    </p>
                  ))}
                </div>
              )}
              {security.length > 0 && (
                <div className="rounded-lg border bg-card p-3">
                  <h5 className="font-display font-semibold text-xs mb-2 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-destructive" />
                    Security
                  </h5>
                  {security.map((s: string, i: number) => (
                    <p key={i} className="text-[11px] text-muted-foreground mb-1">
                      • {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {sharedRisks.length > 0 && (
            <div>
              <h5 className="font-display font-semibold text-xs mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Shared Data Risks
              </h5>
              {sharedRisks.map((r: string, i: number) => (
                <div
                  key={i}
                  className="p-2 rounded border border-warning/30 bg-warning/5 text-xs text-muted-foreground mb-1.5"
                >
                  <AlertTriangle className="h-3 w-3 text-warning inline mr-1.5" />
                  {r}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CollapsibleChallengerSection
        projectId={projectId}
        stage={7}
        refreshKey={refreshKey}
        onRunStage={onRunStage}
        stageRunning={stageRunning}
        onAdvance={onAdvance}
      />

      <LockAdvanceBar
        projectId={projectId}
        stage={7}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}
