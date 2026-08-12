import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gauge,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import RunStageCTA from "./RunStageCTA";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import DebatePanel from "./DebatePanel";
import { useDebateData } from "@/hooks/useDebateData";
import { DensityText } from "./DensityControls";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import ArtifactVersionHistory from "./ArtifactVersionHistory";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: () => void;
  stageRunning?: boolean;
}

function isPrimaryQualityArtifact(artifact: any) {
  let content = artifact?.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  return (
    Array.isArray(content?.evaluations) ||
    typeof content?.overall_score === "string" ||
    Array.isArray(content?.critical_gaps) ||
    Array.isArray(content?.improvement_priorities)
  );
}

const ratingToScore: Record<string, number> = { strong: 9, adequate: 6, weak: 3 };
const ratingColor: Record<string, string> = {
  strong: "text-emerald-500",
  adequate: "text-primary",
  weak: "text-destructive",
};
const ratingBg: Record<string, string> = {
  strong: "bg-emerald-500/10 border-emerald-500/30",
  adequate: "bg-primary/10 border-primary/30",
  weak: "bg-destructive/10 border-destructive/30",
};

function ScoreCard({ label, rating, score }: { label: string; rating: string; score: number }) {
  return (
    <div className={`rounded-lg border p-3 ${ratingBg[rating] || "bg-card"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold capitalize">{label.replace(/_/g, " ")}</span>
        <Badge variant="outline" className={`text-[9px] ${ratingColor[rating] || ""}`}>
          {rating}
        </Badge>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-bold tabular-nums ${ratingColor[rating] || ""}`}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground mb-1">/10</span>
      </div>
      <div className="w-full h-1.5 bg-secondary rounded-full mt-1.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`h-full rounded-full ${rating === "strong" ? "bg-emerald-500" : rating === "adequate" ? "bg-primary" : "bg-destructive"}`}
        />
      </div>
    </div>
  );
}

function EvalDetail({ evaluation, index }: { evaluation: any; index: number }) {
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
        <span className="font-semibold text-sm flex-1 capitalize">
          {(evaluation.attribute || "").replace(/_/g, " ")}
        </span>
        <Badge variant="outline" className={`text-[9px] ${ratingColor[evaluation.rating] || ""}`}>
          {evaluation.rating}
        </Badge>
        <span className={`text-sm font-bold tabular-nums ${ratingColor[evaluation.rating] || ""}`}>
          {evaluation.score}/10
        </span>
      </button>
      {open && (
        <div className="p-3 border-t space-y-3 text-xs">
          <p className="text-muted-foreground">{evaluation.assessment}</p>
          {evaluation.strengths?.length > 0 && (
            <div>
              <p className="font-semibold text-emerald-500 mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Strengths
              </p>
              {evaluation.strengths.map((s: string, i: number) => (
                <p key={i} className="text-muted-foreground ml-4">
                  • {s}
                </p>
              ))}
            </div>
          )}
          {evaluation.concerns?.length > 0 && (
            <div>
              <p className="font-semibold text-warning mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Concerns
              </p>
              {evaluation.concerns.map((c: string, i: number) => (
                <p key={i} className="text-muted-foreground ml-4">
                  • {c}
                </p>
              ))}
            </div>
          )}
          {evaluation.recommendations?.length > 0 && (
            <div>
              <p className="font-semibold text-primary mb-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Recommendations
              </p>
              {evaluation.recommendations.map((r: string, i: number) => (
                <p key={i} className="text-muted-foreground ml-4">
                  • {r}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function QualityAttributesWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: Props) {
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 11)
        .order("created_at", { ascending: false });

      const selectedArtifact =
        (data || []).find(isPrimaryQualityArtifact) ??
        (data || []).find(
          (item) =>
            !item.generated_by?.includes("Evaluator") &&
            !item.title?.startsWith("Evaluator Review:"),
        ) ??
        data?.[0] ??
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
        <Gauge className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No quality evaluation generated yet.</p>
        <RunStageCTA stageLabel="Quality Evaluation" onRun={onRunStage} running={stageRunning} />
      </div>
    );

  let content = artifact.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  const evaluations = content.evaluations || [];
  const criticalGaps = content.critical_gaps || [];
  const priorities = content.improvement_priorities || [];
  const overallScore = content.overall_score || "unknown";
  const diagrams = extractMermaidDiagrams(content);

  const radarData = evaluations.map((e: any) => ({
    attribute: (e.attribute || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase()),
    score: e.score || ratingToScore[e.rating] || 5,
    fullMark: 10,
  }));

  const overallColors: Record<string, string> = {
    strong: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    adequate: "bg-primary/10 text-primary border-primary/30",
    needs_improvement: "bg-warning/10 text-warning border-warning/30",
    weak: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[11]} title="Quality Attributes" />
      <div className="flex justify-end">
        <ArtifactVersionHistory
          projectId={projectId}
          stage={11}
          titleFilter={(t) => !t?.startsWith("Evaluator Review:")}
          onRestored={() => window.location.reload()}
        />
      </div>
      {/* Overall Score Banner */}
      <div
        className={`rounded-xl border-2 p-5 flex items-center gap-4 ${overallColors[overallScore] || "bg-card"}`}
      >
        <Gauge className="h-10 w-10 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-mono uppercase tracking-widest opacity-70">
            Overall Quality Score
          </p>
          <p className="text-xl font-bold capitalize">{overallScore.replace(/_/g, " ")}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums">
            {evaluations.length > 0
              ? (
                  evaluations.reduce(
                    (sum: number, e: any) => sum + (e.score || ratingToScore[e.rating] || 5),
                    0,
                  ) / evaluations.length
                ).toFixed(1)
              : "—"}
          </p>
          <p className="text-[10px] opacity-70">avg / 10</p>
        </div>
      </div>

      {content.summary && (
        <div className="bg-primary/5 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <DensityText compactLength={200}>{content.summary}</DensityText>
          </p>
        </div>
      )}

      {diagrams.length > 0 && (
        <div className="space-y-3">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      <Tabs defaultValue="radar" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="radar" className="text-xs gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Radar
          </TabsTrigger>
          <TabsTrigger value="details" className="text-xs gap-1.5">
            <Shield className="h-3 w-3" />
            Details ({evaluations.length})
          </TabsTrigger>
          <TabsTrigger value="priorities" className="text-xs gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Priorities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="mt-4 space-y-4">
          {radarData.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="attribute"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 9 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 8,
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Score cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {evaluations.map((e: any, i: number) => (
              <ScoreCard
                key={i}
                label={e.attribute}
                rating={e.rating}
                score={e.score || ratingToScore[e.rating] || 5}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4 space-y-2">
          {evaluations.map((e: any, i: number) => (
            <EvalDetail key={i} evaluation={e} index={i} />
          ))}
        </TabsContent>

        <TabsContent value="priorities" className="mt-4 space-y-4">
          {criticalGaps.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                Critical Gaps
              </h5>
              {criticalGaps.map((g: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded border border-destructive/30 bg-destructive/5 text-xs text-muted-foreground mb-1.5"
                >
                  <XCircle className="h-3 w-3 text-destructive inline mr-1.5" />
                  {g}
                </div>
              ))}
            </div>
          )}

          {priorities.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                Improvement Priorities
              </h5>
              {priorities.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border bg-card text-xs mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold capitalize">
                      {(p.attribute || "").replace(/_/g, " ")}
                    </span>
                    <Badge
                      variant={
                        p.priority === "high"
                          ? "destructive"
                          : p.priority === "medium"
                            ? "default"
                            : "secondary"
                      }
                      className="text-[9px]"
                    >
                      {p.priority}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{p.action}</p>
                </div>
              ))}
            </div>
          )}

          {content.influence_on_architecture && (
            <div className="bg-primary/5 rounded-lg p-3">
              <h5 className="font-semibold text-xs mb-1">Influence on Architecture</h5>
              <p className="text-xs text-muted-foreground">{content.influence_on_architecture}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Debate Panel (Challenger Agent) */}
      <QualityDebateWrapper projectId={projectId} refreshKey={refreshKey} />
    </div>
  );
}

function QualityDebateWrapper({
  projectId,
  refreshKey,
}: {
  projectId: string;
  refreshKey?: number;
}) {
  const { challengerData, validationData, ragSources } = useDebateData(projectId, 11, refreshKey);
  if (!challengerData && !validationData) return null;
  return (
    <DebatePanel
      challengerData={challengerData}
      validationData={validationData}
      ragSources={ragSources}
      stageName="Quality Attributes"
    />
  );
}
