import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  Target,
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import RunStageCTA from "./RunStageCTA";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { DensityText, DensityList } from "./DensityControls";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: () => void;
  stageRunning?: boolean;
}

function isPrimaryRiskArtifact(artifact: any) {
  let content = artifact?.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;
  return (
    Array.isArray(content?.risks) ||
    !!content?.risk_matrix ||
    typeof content?.risk_summary === "string" ||
    Array.isArray(content?.open_issues)
  );
}

const severityConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
    dot: "bg-destructive",
  },
  high: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
  },
  medium: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30",
    dot: "bg-warning",
  },
  low: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; color: string }> = {
  mitigated: { icon: CheckCircle2, label: "Mitigated", color: "text-emerald-500" },
  accepted: { icon: Shield, label: "Accepted", color: "text-primary" },
  monitoring: { icon: Activity, label: "Monitoring", color: "text-warning" },
  identified: { icon: AlertTriangle, label: "Identified", color: "text-destructive" },
};

function RiskCard({ risk, index }: { risk: any; index: number }) {
  const [open, setOpen] = useState(false);
  const sev = severityConfig[risk.severity] || severityConfig.medium;
  const status = statusConfig[risk.status] || statusConfig.identified;
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-lg border ${sev.border} ${sev.bg} overflow-hidden`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-4 w-full text-left hover:bg-accent/10 transition-colors"
      >
        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${sev.dot}`} />
        <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
          {risk.id}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm block truncate">{risk.title}</span>
          {!open && risk.description && (
            <span className="text-[11px] text-muted-foreground line-clamp-1">
              {risk.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={`text-[9px] ${sev.text} border-current`}>
            {risk.severity}
          </Badge>
          <div className={`flex items-center gap-1 text-[10px] ${status.color}`}>
            <StatusIcon className="h-3 w-3" />
            <span className="hidden sm:inline">{status.label}</span>
          </div>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs border-t border-inherit">
          <div className="pt-3">
            <p className="text-muted-foreground leading-relaxed">{risk.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border bg-card p-2.5 text-center">
              <p className="text-[9px] font-mono uppercase text-muted-foreground mb-0.5">
                Probability
              </p>
              <p className="font-semibold text-sm capitalize">{risk.probability}</p>
            </div>
            <div className="rounded-md border bg-card p-2.5 text-center">
              <p className="text-[9px] font-mono uppercase text-muted-foreground mb-0.5">Impact</p>
              <p className="font-semibold text-sm capitalize">{risk.impact}</p>
            </div>
            <div className="rounded-md border bg-card p-2.5 text-center">
              <p className="text-[9px] font-mono uppercase text-muted-foreground mb-0.5">
                Category
              </p>
              <p className="font-semibold text-sm capitalize">{risk.category}</p>
            </div>
          </div>
          {risk.affected_components?.length > 0 && (
            <div>
              <p className="font-semibold mb-1.5 text-foreground flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-muted-foreground" />
                Affected Components
              </p>
              <div className="flex flex-wrap gap-1.5">
                {risk.affected_components.map((c: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded-md border"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {risk.mitigation_strategy && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5 text-[11px]">
                <Shield className="h-3.5 w-3.5" />
                Mitigation Strategy
              </p>
              <p className="text-muted-foreground leading-relaxed">{risk.mitigation_strategy}</p>
            </div>
          )}
          {risk.contingency_plan && (
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <p className="font-semibold text-warning mb-1 flex items-center gap-1.5 text-[11px]">
                <Target className="h-3.5 w-3.5" />
                Contingency Plan
              </p>
              <p className="text-muted-foreground leading-relaxed">{risk.contingency_plan}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function RiskSummaryCards({ risks }: { risks: any[] }) {
  const categories = [...new Set(risks.map((r: any) => r.category).filter(Boolean))];
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  risks.forEach((r: any) => {
    if (bySeverity[r.severity as keyof typeof bySeverity] !== undefined)
      bySeverity[r.severity as keyof typeof bySeverity]++;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {(["critical", "high", "medium", "low"] as const).map((sev) => {
        const cfg = severityConfig[sev];
        return (
          <div key={sev} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3 text-center`}>
            <div className={`h-2 w-2 rounded-full ${cfg.dot} mx-auto mb-1.5`} />
            <p className={`text-2xl font-bold tabular-nums ${cfg.text}`}>{bySeverity[sev]}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground capitalize">
              {sev}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function RiskAnalysisWorkspace({
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
        .eq("stage", 12)
        .order("created_at", { ascending: false });

      const selectedArtifact =
        (data || []).find(isPrimaryRiskArtifact) ??
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
        <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No risk analysis generated yet.</p>
        <RunStageCTA stageLabel="Risk Analysis" onRun={onRunStage} running={stageRunning} />
      </div>
    );

  let content = artifact.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  const risks = content.risks || [];
  const matrix = content.risk_matrix || {};
  const topRisks = content.top_risks || [];
  const openIssues = content.open_issues || [];
  const assumptions = content.assumptions || [];
  const diagrams = extractMermaidDiagrams(content);

  const criticalCount =
    matrix.critical ?? risks.filter((r: any) => r.severity === "critical").length;
  const highCount = matrix.high ?? risks.filter((r: any) => r.severity === "high").length;

  // Group risks by category
  const categories = [...new Set(risks.map((r: any) => r.category).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[12]} title="Risk Assessment" />

      {/* Executive Risk Posture Banner */}
      <div
        className={`rounded-xl border-2 p-5 ${
          criticalCount > 0
            ? "bg-destructive/5 border-destructive/20"
            : highCount > 0
              ? "bg-orange-500/5 border-orange-500/20"
              : "bg-emerald-500/5 border-emerald-500/20"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              criticalCount > 0
                ? "bg-destructive/10 text-destructive"
                : highCount > 0
                  ? "bg-orange-500/10 text-orange-500"
                  : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Risk Posture
            </p>
            <p className="text-base font-semibold text-foreground leading-snug">
              {content.risk_summary ||
                `${risks.length} risks identified across ${categories.length} categories`}
            </p>
          </div>
        </div>
      </div>

      {/* Severity Distribution */}
      <RiskSummaryCards risks={risks} />

      {content.summary && (
        <div className="bg-secondary/30 rounded-lg p-4 border">
          <p className="text-sm text-foreground leading-relaxed">
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

      {/* Top Risks Highlight */}
      {topRisks.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h5 className="font-semibold text-xs mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-destructive" />
            Priority Risks
          </h5>
          <div className="flex flex-wrap gap-2">
            {topRisks.map((id: string, i: number) => {
              const risk = risks.find((r: any) => r.id === id);
              const sev = severityConfig[risk?.severity] || severityConfig.medium;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-[11px] border rounded-lg px-3 py-1.5 ${sev.bg} ${sev.border}`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                  <span className="font-mono text-primary font-semibold">{id}</span>
                  {risk && <span className="text-foreground">{risk.title}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Tabs defaultValue="risks" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="risks" className="text-xs gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Risk Register ({risks.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-xs gap-1.5">
            <XCircle className="h-3 w-3" />
            Issues & Assumptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="risks" className="mt-4 space-y-2">
          {risks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No risks identified.</p>
          ) : (
            <>
              {categories.length > 1
                ? categories.map((cat) => {
                    const catRisks = risks.filter((r: any) => r.category === cat);
                    return (
                      <div key={cat} className="space-y-2">
                        <h6 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-3 mb-1 flex items-center gap-2">
                          <div className="h-px flex-1 bg-border" />
                          <span>{cat}</span>
                          <Badge variant="secondary" className="text-[9px]">
                            {catRisks.length}
                          </Badge>
                          <div className="h-px flex-1 bg-border" />
                        </h6>
                        {catRisks.map((r: any, i: number) => (
                          <RiskCard key={r.id || i} risk={r} index={i} />
                        ))}
                      </div>
                    );
                  })
                : risks.map((r: any, i: number) => <RiskCard key={r.id || i} risk={r} index={i} />)}
            </>
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-4 space-y-4">
          {openIssues.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                Open Issues ({openIssues.length})
              </h5>
              <div className="space-y-1.5">
                {openIssues.map((issue: string, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-foreground flex items-start gap-2"
                  >
                    <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assumptions.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Assumptions ({assumptions.length})
              </h5>
              <div className="space-y-1.5">
                {assumptions.map((a: string, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border text-xs text-foreground flex items-start gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openIssues.length === 0 && assumptions.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              No open issues or assumptions recorded.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
