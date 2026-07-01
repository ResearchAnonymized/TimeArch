import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Layers,
  Users,
  Eye,
  Download,
  FileDown,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import RunStageCTA from "./RunStageCTA";
import {
  exportAsJSON,
  exportAsMarkdown,
  exportAsPDF,
  exportAsDOCX,
} from "@/lib/documentation-export";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { toast } from "sonner";
import React from "react";

/** Safely render a value that might be an object instead of a string */
function renderSafeValue(value: any): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    return value.map((item, i) => (
      <div key={i} className="mb-1">
        {renderSafeValue(item)}
      </div>
    ));
  }
  if (typeof value === "object") {
    return Object.entries(value).map(([k, v]) => (
      <div key={k} className="mb-2">
        <span className="font-semibold text-foreground capitalize">{k.replace(/_/g, " ")}: </span>
        {typeof v === "string" || typeof v === "number" ? (
          String(v)
        ) : (
          <div className="pl-3 mt-1">{renderSafeValue(v)}</div>
        )}
      </div>
    ));
  }
  return String(value);
}

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: () => void;
  stageRunning?: boolean;
}

function isPrimaryDocumentationArtifact(artifact: any) {
  let content = artifact?.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;
  return (
    Array.isArray(content?.adrs) ||
    typeof content?.executive_summary === "string" ||
    typeof content?.architecture_overview === "string" ||
    Array.isArray(content?.review_notes) ||
    Array.isArray(content?.handoff_notes)
  );
}

const adrStatusConfig: Record<string, { bg: string; border: string; dot: string }> = {
  accepted: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  proposed: { bg: "bg-primary/5", border: "border-primary/20", dot: "bg-primary" },
  deprecated: { bg: "bg-muted/50", border: "border-border", dot: "bg-muted-foreground" },
  superseded: { bg: "bg-warning/5", border: "border-warning/20", dot: "bg-warning" },
};

function ADRCard({ adr, index }: { adr: any; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = adrStatusConfig[adr.status] || adrStatusConfig.proposed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-4 w-full text-left hover:bg-accent/10 transition-colors"
      >
        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
          {adr.id}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm block truncate">{adr.title}</span>
          {!open && adr.context && (
            <span className="text-[11px] text-muted-foreground line-clamp-1">{adr.context}</span>
          )}
        </div>
        <Badge variant="outline" className="text-[9px] capitalize">
          {adr.status}
        </Badge>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-inherit space-y-3 text-xs">
          {/* Context */}
          <div className="pt-3">
            <p className="font-semibold text-foreground mb-1 text-[11px]">Context</p>
            <div className="text-muted-foreground leading-relaxed">
              {renderSafeValue(adr.context)}
            </div>
          </div>

          {/* Decision */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="font-semibold text-primary mb-1 flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Decision
            </p>
            <div className="text-foreground leading-relaxed">{renderSafeValue(adr.decision)}</div>
          </div>

          {/* Rationale */}
          {adr.rationale && (
            <div>
              <p className="font-semibold text-foreground mb-1 text-[11px]">Rationale</p>
              <div className="text-muted-foreground leading-relaxed">
                {renderSafeValue(adr.rationale)}
              </div>
            </div>
          )}

          {/* Alternatives */}
          {adr.alternatives_considered?.length > 0 && (
            <div>
              <p className="font-semibold text-foreground mb-1.5 text-[11px]">
                Alternatives Considered
              </p>
              <div className="space-y-1.5">
                {adr.alternatives_considered.map((alt: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-muted-foreground rounded-md border bg-card p-2"
                  >
                    <XCircle className="h-3 w-3 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                    <span>
                      {typeof alt === "string" ? alt : `${alt.name}: ${alt.reason || ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consequences */}
          {adr.consequences && (
            <div className="grid grid-cols-2 gap-2">
              {adr.consequences.positive?.length > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 text-[10px] uppercase tracking-wider">
                    Positive
                  </p>
                  {adr.consequences.positive.map((p: string, i: number) => (
                    <p
                      key={i}
                      className="text-muted-foreground text-[11px] flex items-start gap-1 mb-0.5"
                    >
                      <span className="text-emerald-500">+</span> {p}
                    </p>
                  ))}
                </div>
              )}
              {adr.consequences.negative?.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="font-semibold text-destructive mb-1.5 text-[10px] uppercase tracking-wider">
                    Negative
                  </p>
                  {adr.consequences.negative.map((n: string, i: number) => (
                    <p
                      key={i}
                      className="text-muted-foreground text-[11px] flex items-start gap-1 mb-0.5"
                    >
                      <span className="text-destructive">−</span> {n}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function DiagramRecommendation({ rec, index }: { rec: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-semibold text-sm capitalize">
          {(rec.type || "").replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{rec.purpose}</p>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {rec.target_audience && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            {rec.target_audience}
          </span>
        )}
        {rec.lifecycle_relevance && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            {rec.lifecycle_relevance}
          </span>
        )}
      </div>
      {rec.included_elements?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {rec.included_elements.map((el: string, j: number) => (
            <span
              key={j}
              className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded-md border"
            >
              {el}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Export functions moved to @/lib/documentation-export.ts

export default function DocumentationWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: Props) {
  const navigate = useNavigate();
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    const load = async () => {
      const [artRes, projRes] = await Promise.all([
        supabase
          .from("architecture_artifacts")
          .select("*")
          .eq("project_id", projectId)
          .eq("stage", 14)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("name").eq("id", projectId).single(),
      ]);

      if (projRes.data) setProjectName(projRes.data.name);

      const data = artRes.data || [];
      const selectedArtifact =
        data.find(isPrimaryDocumentationArtifact) ??
        data.find((item) => !/^ADR-\d+/i.test(item.title || "")) ??
        data[0] ??
        null;

      setArtifact(selectedArtifact);
      setLoading(false);
    };
    load();
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
        <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No documentation generated yet.</p>
        <RunStageCTA stageLabel="Documentation" onRun={onRunStage} running={stageRunning} />
      </div>
    );

  let content = artifact.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  const adrs = content.adrs || [];
  const diagramRecs = content.diagram_recommendations || [];
  const reviewNotes = content.review_notes || [];
  const handoffNotes = content.handoff_notes || [];
  const diagrams = extractMermaidDiagrams(content);

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[14]} title="Documentation & ADRs" />

      {/* Executive Summary */}
      {content.executive_summary && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary/70 mb-2">
            Executive Summary
          </p>
          <div className="text-sm text-foreground leading-relaxed">
            {renderSafeValue(content.executive_summary)}
          </div>
        </div>
      )}

      {content.architecture_overview && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold mb-1.5 text-foreground">Architecture Overview</p>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {renderSafeValue(content.architecture_overview)}
          </div>
        </div>
      )}

      {content.summary && (
        <div className="bg-secondary/30 rounded-lg p-4 border">
          <div className="text-sm text-foreground leading-relaxed">
            {renderSafeValue(content.summary)}
          </div>
        </div>
      )}

      {/* Document Editor CTA */}
      <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pencil className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-display font-bold">Document Editor</h4>
            <p className="text-[10px] text-muted-foreground">
              Generate, review, edit, and export architecture documents
            </p>
          </div>
          <Button
            className="gap-1.5"
            size="sm"
            onClick={() => navigate(`/project/${projectId}/document`)}
          >
            <Pencil className="h-3 w-3" />
            Open Editor
          </Button>
        </div>
      </div>

      {/* Quick Export Bar */}
      <div className="flex items-center gap-2 rounded-lg border bg-card p-3 flex-wrap">
        <FileDown className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">Quick export (raw, no editing)</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => exportAsPDF(content, projectName)}
        >
          <Download className="h-3 w-3" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => exportAsDOCX(content, projectName)}
        >
          <Download className="h-3 w-3" />
          DOCX
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => exportAsMarkdown(content, projectName)}
        >
          <Download className="h-3 w-3" />
          Markdown
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => exportAsJSON(content, projectName)}
        >
          <Download className="h-3 w-3" />
          JSON
        </Button>
      </div>

      {diagrams.length > 0 && (
        <div className="space-y-3">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      <Tabs defaultValue="adrs" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="adrs" className="text-xs gap-1.5">
            <FileText className="h-3 w-3" />
            ADRs ({adrs.length})
          </TabsTrigger>
          <TabsTrigger value="diagrams" className="text-xs gap-1.5">
            <Layers className="h-3 w-3" />
            Diagrams ({diagramRecs.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1.5">
            <Eye className="h-3 w-3" />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adrs" className="mt-4 space-y-2">
          {adrs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No ADRs generated.</p>
          ) : (
            adrs.map((adr: any, i: number) => <ADRCard key={i} adr={adr} index={i} />)
          )}
        </TabsContent>

        <TabsContent value="diagrams" className="mt-4 space-y-2">
          {diagramRecs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No diagram recommendations.</p>
          ) : (
            diagramRecs.map((rec: any, i: number) => (
              <DiagramRecommendation key={i} rec={rec} index={i} />
            ))
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          {reviewNotes.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                Review Notes
              </h5>
              <div className="space-y-1.5">
                {reviewNotes.map((note: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border bg-primary/5 text-xs text-foreground"
                  >
                    • {typeof note === "string" ? note : JSON.stringify(note)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {handoffNotes.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-emerald-500" />
                Handoff Notes
              </h5>
              <div className="space-y-1.5">
                {handoffNotes.map((note: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-foreground flex items-start gap-2"
                  >
                    <ArrowRight className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{typeof note === "string" ? note : JSON.stringify(note)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewNotes.length === 0 && handoffNotes.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No review or handoff notes recorded.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
