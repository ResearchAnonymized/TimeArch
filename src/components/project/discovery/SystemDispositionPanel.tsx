import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2, Sparkles, AlertCircle, Compass, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDispositionReport } from "@/features/discovery/useDispositionReport";
import DimensionRadar from "./charts/DimensionRadar";
import ComponentDispositionBar from "./charts/ComponentDispositionBar";
import RiskValueMatrix from "./charts/RiskValueMatrix";
import EffortBar from "./charts/EffortBar";

interface Props {
  projectId: string;
}

const VERDICT_META: Record<string, { label: string; tone: string; tip: string }> = {
  retain: { label: "Retain", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    tip: "Keep the system as-is. Healthy and strategically aligned." },
  rehost: { label: "Rehost", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    tip: "Lift-and-shift to better infrastructure. No code change." },
  replatform: { label: "Replatform", tone: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    tip: "Minor changes to take advantage of a new platform." },
  refactor: { label: "Refactor", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    tip: "Restructure code without behavior change to improve maintainability." },
  rearchitect: { label: "Re-architect", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30",
    tip: "Materially change the architecture (e.g. monolith → services)." },
  rebuild: { label: "Rebuild", tone: "bg-red-500/15 text-red-600 border-red-500/30",
    tip: "Discard and rewrite from scratch on a new stack." },
  retire: { label: "Retire", tone: "bg-slate-500/15 text-slate-600 border-slate-500/30",
    tip: "Remove. No longer needed." },
  hybrid: { label: "Hybrid", tone: "bg-violet-500/15 text-violet-600 border-violet-500/30",
    tip: "Mixed strategy — different dispositions across components." },
};

function parseRationale(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      summary?: string;
      key_drivers?: Array<{ label: string; polarity: string; note: string }>;
      roadmap?: Array<{ step: number; title: string; horizon: string }>;
    };
  } catch { return { summary: raw }; }
}

export default function SystemDispositionPanel({ projectId }: Props) {
  const { report, loading, running, error, run } = useDispositionReport(projectId);
  const [tab, setTab] = useState("verdict");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">System Disposition</h3>
              <Badge variant="outline" className="text-[10px]">Phase 0 · 6R / TIME</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Evidence-based recommendation on whether to <strong>keep, refactor, re-architect or rebuild</strong> the
              system, scored across six dimensions and per-component.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={run} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          {report ? "Re-analyze" : "Analyze system"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive mb-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading latest report…
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <p className="text-sm font-medium mb-1">No disposition report yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Run the analyzer to score the system on six dimensions, map every component to a 6R disposition
            (Retain · Rehost · Replatform · Refactor · Re-architect · Rebuild · Retire), and get a recommendation.
          </p>
        </div>
      ) : (
        <ReportView report={report} tab={tab} setTab={setTab} />
      )}
    </motion.div>
  );
}

function ReportView({ report, tab, setTab }: { report: any; tab: string; setTab: (t: string) => void }) {
  const meta = VERDICT_META[report.overall_verdict] ?? VERDICT_META.refactor;
  const rationale = parseRationale(report.rationale);
  const components = report.component_dispositions || [];
  const matrix = report.risk_value_matrix || [];

  return (
    <>
      <div className={`rounded-xl border p-4 mb-4 ${meta.tone}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-70">Recommendation</p>
            <p className="text-2xl font-bold mt-0.5">{meta.label}</p>
            <p className="text-xs opacity-90 mt-1 max-w-xl">{rationale?.summary || meta.tip}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide opacity-70">Confidence</p>
            <p className="text-2xl font-bold tabular-nums">{Math.round((report.confidence ?? 0) * 100)}%</p>
            <p className="text-[10px] opacity-70">{components.length} components scored</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="verdict">Verdict</TabsTrigger>
          <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="matrix">Risk × Value</TabsTrigger>
          <TabsTrigger value="effort">Effort</TabsTrigger>
        </TabsList>

        <TabsContent value="verdict" className="mt-4 space-y-4">
          {rationale?.key_drivers?.length ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key drivers</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {rationale.key_drivers.map((d, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      {d.polarity === "positive"
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                      <p className="text-xs font-medium">{d.label}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{d.note}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {rationale?.roadmap?.length ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Roadmap</p>
              <ol className="space-y-1.5">
                {rationale.roadmap.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border bg-card p-2.5 text-xs">
                    <span className="rounded bg-primary/10 text-primary font-mono text-[10px] px-1.5 py-0.5">
                      {r.step}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">{r.horizon}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="scorecard" className="mt-4">
          <DimensionRadar scores={report.dimension_scores || {}} />
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {Object.entries(report.dimension_scores || {}).map(([k, v]: any) => (
              <div key={k} className="rounded-md border bg-card p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize">{k.replace(/_/g, " ")}</p>
                  <span className="font-mono tabular-nums text-primary font-semibold">
                    {Number(v?.score ?? 0).toFixed(1)}/5
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{v?.evidence}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="components" className="mt-4">
          <ComponentDispositionBar components={components} />
          <div className="space-y-1.5 mt-3 max-h-80 overflow-auto">
            {components.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md border bg-card p-2.5 text-xs">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.rationale && <p className="text-[11px] text-muted-foreground truncate">{c.rationale}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{c.effort}</Badge>
                  <Badge className={`text-[10px] border ${VERDICT_META[c.disposition]?.tone}`}>
                    {VERDICT_META[c.disposition]?.label ?? c.disposition}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <RiskValueMatrix points={matrix} />
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Components in the <strong>top-right</strong> are high-value/high-risk — prioritize them for rearchitect or rebuild.
            <strong> Bottom-left</strong> components are good candidates to retire.
          </p>
        </TabsContent>

        <TabsContent value="effort" className="mt-4">
          <EffortBar effort={report.effort_estimate || {}} />
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            S = days · M = weeks · L = months · XL = quarter+
          </p>
        </TabsContent>
      </Tabs>
    </>
  );
}
