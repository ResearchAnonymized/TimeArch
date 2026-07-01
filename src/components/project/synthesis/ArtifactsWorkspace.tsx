import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, FileCode, Star, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import StageIntro from "../StageIntro";
import { STAGE_INTROS } from "../stageIntroData";
import { supabase } from "@/integrations/supabase/client";
import ArtifactContent, { type DensityLevel } from "./ArtifactContent";
import UnverifiedReverseEngineeredBanner from "../discovery/UnverifiedReverseEngineeredBanner";
import RunStageCTA from "../RunStageCTA";

const DENSITY_OPTIONS: { value: DensityLevel; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "Key findings only" },
  { value: "standard", label: "Standard", description: "Summary + sections" },
  { value: "detailed", label: "Detailed", description: "Full output" },
];

export default function ArtifactsWorkspace({
  projectId,
  currentStage,
  stageLabel,
  refreshKey,
  onRunStage,
  stageRunning,
}: {
  projectId: string;
  currentStage: number;
  stageLabel: string;
  refreshKey?: number;
  onRunStage?: () => void;
  stageRunning?: boolean;
}) {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null);
  const [density, setDensity] = useState<DensityLevel>("standard");

  useEffect(() => {
    const fetchArtifacts = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", currentStage)
        .order("created_at", { ascending: false });
      if (data) {
        setArtifacts(data);
        if (data.length > 0 && !expandedArtifact) setExpandedArtifact(data[0].id);
      }
    };
    fetchArtifacts();
  }, [projectId, currentStage, refreshKey]);

  const statusColors: Record<string, string> = {
    generated: "bg-primary/10 text-primary border-primary/30",
    locked: "bg-success/10 text-success border-success/30",
    approved: "bg-success/10 text-success border-success/30",
    draft: "bg-muted text-muted-foreground border-border",
    reviewed: "bg-warning/10 text-warning border-warning/30",
  };

  return (
    <div className="space-y-6">
      {STAGE_INTROS[currentStage] && (
        <StageIntro {...STAGE_INTROS[currentStage]} title={stageLabel} />
      )}

      {artifacts.length > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/40 border border-border/40 flex-wrap">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-semibold">
              {artifacts.length} Artifact{artifacts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" />
              {
                artifacts.filter((a) => a.status === "locked" || a.status === "approved").length
              }{" "}
              Locked
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {artifacts.filter((a) => a.status === "generated").length} Generated
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              {artifacts.filter((a) => a.status === "draft").length} Draft
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex rounded-lg border border-border overflow-hidden">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDensity(opt.value)}
                  title={opt.description}
                  className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    density === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {artifacts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-card/30"
        >
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileCode className="h-8 w-8 text-primary/40" />
          </div>
          <p className="text-muted-foreground text-sm font-medium mb-1.5">
            No artifacts generated yet
          </p>
          <RunStageCTA stageLabel={stageLabel} onRun={onRunStage} running={stageRunning} />
        </motion.div>
      ) : (
        <div className="space-y-3">
          {artifacts.map((artifact, i) => {
            const isExpanded = expandedArtifact === artifact.id;
            const statusStyle = statusColors[artifact.status] || statusColors.draft;
            return (
              <motion.div
                key={artifact.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border bg-card overflow-hidden hover:shadow-sm transition-shadow"
              >
                <button
                  onClick={() => setExpandedArtifact(isExpanded ? null : artifact.id)}
                  className="flex items-center gap-3 p-4 w-full text-left hover:bg-accent/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {artifact.type.replace(/_/g, " ")}
                  </Badge>
                  <h4 className="font-display font-semibold text-sm flex-1">{artifact.title}</h4>
                  <Badge className={`text-[9px] border ${statusStyle}`}>{artifact.status}</Badge>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    v{artifact.version}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t">
                    {artifact.generated_by && (
                      <div className="flex items-center gap-2 py-2.5 text-[11px] text-muted-foreground border-b border-border/40 mb-3">
                        <Star className="h-3 w-3 text-primary/60" />
                        <span>
                          Generated by{" "}
                          <span className="font-semibold text-foreground">
                            {artifact.generated_by}
                          </span>
                        </span>
                        <span className="ml-auto tabular-nums">
                          {new Date(artifact.created_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {(artifact.content as any)?._meta?.needs_human_confirmation && (
                      <UnverifiedReverseEngineeredBanner
                        artifactId={artifact.id}
                        sourceLabel={(artifact.content as any)?._meta?.source_label}
                      />
                    )}
                    <ArtifactContent content={artifact.content} density={density} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
