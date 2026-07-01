import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  FileCheck,
  ClipboardCheck,
  Link2,
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

function isPrimaryValidationArtifact(artifact: any) {
  let content = artifact?.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  return (
    Array.isArray(content?.validation_checks) ||
    Array.isArray(content?.requirement_traceability) ||
    !!content?.governance_assessment ||
    typeof content?.overall_status === "string"
  );
}

const statusIcon: Record<string, typeof CheckCircle2> = {
  passed: CheckCircle2,
  warning: AlertTriangle,
  failed: XCircle,
};
const statusColor: Record<string, string> = {
  passed: "text-emerald-500",
  warning: "text-warning",
  failed: "text-destructive",
};
const statusBg: Record<string, string> = {
  passed: "bg-emerald-500/10 border-emerald-500/30",
  warning: "bg-warning/10 border-warning/30",
  failed: "bg-destructive/10 border-destructive/30",
};

function CheckCard({ check, index }: { check: any; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = statusIcon[check.status] || AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`rounded-lg border overflow-hidden ${statusBg[check.status] || "bg-card"}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-3 w-full text-left hover:bg-accent/20 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Icon className={`h-4 w-4 flex-shrink-0 ${statusColor[check.status] || ""}`} />
        <span className="font-semibold text-sm flex-1 capitalize">
          {(check.check || "").replace(/_/g, " ")}
        </span>
        <Badge variant="outline" className={`text-[9px] ${statusColor[check.status] || ""}`}>
          {check.status}
        </Badge>
      </button>
      {open && (
        <div className="p-3 border-t space-y-2.5 text-xs">
          <p className="text-muted-foreground">
            <DensityText compactLength={120}>{check.details}</DensityText>
          </p>
          {check.issues?.length > 0 && (
            <div>
              <p className="font-semibold text-destructive mb-1 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Issues
              </p>
              {check.issues.map((issue: string, i: number) => (
                <p key={i} className="text-muted-foreground ml-4">
                  • {issue}
                </p>
              ))}
            </div>
          )}
          {check.recommendations?.length > 0 && (
            <div>
              <p className="font-semibold text-primary mb-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Recommendations
              </p>
              {check.recommendations.map((r: string, i: number) => (
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

function TraceabilityTable({ traceability }: { traceability: any[] }) {
  if (!traceability?.length)
    return <p className="text-xs text-muted-foreground italic">No traceability data.</p>;
  const coverageColor: Record<string, string> = {
    full: "bg-emerald-500/10 text-emerald-500",
    partial: "bg-warning/10 text-warning",
    missing: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/50">
            <th className="text-left p-2.5 font-semibold">Requirement</th>
            <th className="text-left p-2.5 font-semibold">Covered By</th>
            <th className="text-center p-2.5 font-semibold">Coverage</th>
            <th className="text-left p-2.5 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {traceability.map((t: any, i: number) => (
            <tr key={i} className="border-t hover:bg-secondary/20 transition-colors">
              <td className="p-2.5 font-mono text-primary">{t.requirement_id}</td>
              <td className="p-2.5">
                <div className="flex flex-wrap gap-1">
                  {(t.covered_by || []).map((c: string, j: number) => (
                    <span
                      key={j}
                      className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </td>
              <td className="p-2.5 text-center">
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded ${coverageColor[t.coverage_status] || "bg-secondary"}`}
                >
                  {t.coverage_status}
                </span>
              </td>
              <td className="p-2.5 text-muted-foreground">{t.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ValidationWorkspace({
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
        .eq("stage", 13)
        .order("created_at", { ascending: false });

      const selectedArtifact =
        (data || []).find(isPrimaryValidationArtifact) ??
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
        <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No validation report generated yet.</p>
        <RunStageCTA stageLabel="Validation" onRun={onRunStage} running={stageRunning} />
      </div>
    );

  let content = artifact.content;
  if (content?.parse_error) content = recoverArtifactContent(content) || content;

  const checks = content.validation_checks || [];
  const traceability = content.requirement_traceability || [];
  const governance = content.governance_assessment || {};
  const corrections = content.corrections_needed || [];
  const overallStatus = content.overall_status || "unknown";
  const diagrams = extractMermaidDiagrams(content);

  const passedCount = checks.filter((c: any) => c.status === "passed").length;
  const warningCount = checks.filter((c: any) => c.status === "warning").length;
  const failedCount = checks.filter((c: any) => c.status === "failed").length;

  const overallColors: Record<string, string> = {
    passed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
    passed_with_warnings: "bg-warning/10 border-warning/30 text-warning",
    failed: "bg-destructive/10 border-destructive/30 text-destructive",
  };

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[13]} title="Architecture Validation" />
      {/* Overall Status Banner */}
      <div
        className={`rounded-xl border-2 p-5 flex items-center gap-4 ${overallColors[overallStatus] || "bg-card"}`}
      >
        <FileCheck className="h-10 w-10 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-mono uppercase tracking-widest opacity-70">
            Validation Status
          </p>
          <p className="text-xl font-bold capitalize">{overallStatus.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-emerald-500">{passedCount}</p>
            <p className="text-[9px] opacity-70">Passed</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-warning">{warningCount}</p>
            <p className="text-[9px] opacity-70">Warnings</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-destructive">{failedCount}</p>
            <p className="text-[9px] opacity-70">Failed</p>
          </div>
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

      <Tabs defaultValue="checks" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="checks" className="text-xs gap-1.5">
            <Shield className="h-3 w-3" />
            Checks ({checks.length})
          </TabsTrigger>
          <TabsTrigger value="traceability" className="text-xs gap-1.5">
            <Link2 className="h-3 w-3" />
            Traceability
          </TabsTrigger>
          <TabsTrigger value="governance" className="text-xs gap-1.5">
            <FileCheck className="h-3 w-3" />
            Governance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checks" className="mt-4 space-y-2">
          {checks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No validation checks.</p>
          ) : (
            <DensityList
              items={checks}
              label="Checks"
              standardLimit={5}
              renderItem={(c: any, i: number) => <CheckCard key={i} check={c} index={i} />}
            />
          )}
        </TabsContent>

        <TabsContent value="traceability" className="mt-4">
          <TraceabilityTable traceability={traceability} />
        </TabsContent>

        <TabsContent value="governance" className="mt-4 space-y-4">
          {/* Readiness */}
          <div
            className={`rounded-xl border-2 p-4 flex items-center gap-3 ${governance.ready_for_approval ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"}`}
          >
            {governance.ready_for_approval ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
            <div>
              <p className="font-bold text-sm">
                {governance.ready_for_approval ? "Ready for Approval" : "Not Ready for Approval"}
              </p>
              <p className="text-xs text-muted-foreground">Architecture governance assessment</p>
            </div>
          </div>

          {governance.blocking_issues?.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive" />
                Blocking Issues
              </h5>
              {governance.blocking_issues.map((issue: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded border border-destructive/30 bg-destructive/5 text-xs text-muted-foreground mb-1.5"
                >
                  <XCircle className="h-3 w-3 text-destructive inline mr-1.5" />
                  {issue}
                </div>
              ))}
            </div>
          )}

          {governance.advisory_notes?.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Advisory Notes
              </h5>
              {governance.advisory_notes.map((note: string, i: number) => (
                <div key={i} className="p-2 rounded border text-xs text-muted-foreground mb-1.5">
                  • {note}
                </div>
              ))}
            </div>
          )}

          {corrections.length > 0 && (
            <div>
              <h5 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                Corrections Needed
              </h5>
              {corrections.map((c: string, i: number) => (
                <div
                  key={i}
                  className="p-2.5 rounded border border-primary/30 bg-primary/5 text-xs text-muted-foreground mb-1.5"
                >
                  {c}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
