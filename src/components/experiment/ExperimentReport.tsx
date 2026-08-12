/**
 * Report panel — Sprint 3/4.
 *
 * Aggregates completed runs by proposal and lists mean metrics + CSV export.
 * Sprint 4: adds Cohen's κ across rubric raters for every dimension.
 */
import { useEffect, useMemo, useState } from "react";
import { aggregateByProposal, aggregatesToCsv, cohenKappa, experimentService, runsToCsv, type ExperimentProposal, type ExperimentRubricScore, type ExperimentRun } from "@/services/experimentService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Package } from "lucide-react";
import JSZip from "jszip";
import { RUBRIC_DIMENSIONS } from "./RubricDrawer";

interface Props { runs: ExperimentRun[]; proposals: ExperimentProposal[] }

const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(3));

export function ExperimentReport({ runs, proposals }: Props) {
  const rows = useMemo(() => aggregateByProposal(runs, proposals), [runs, proposals]);

  // Sprint 4: pull rubric scores for the visible runs and compute κ per dim.
  const [scores, setScores] = useState<ExperimentRubricScore[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: ExperimentRubricScore[] = [];
      for (const r of runs.slice(0, 50)) {
        const res = await experimentService.listRubricScores(r.id);
        if (res.ok) all.push(...res.value);
      }
      if (!cancelled) setScores(all);
    })();
    return () => { cancelled = true; };
  }, [runs]);

  const kappaRows = useMemo(
    () => RUBRIC_DIMENSIONS.map((d) => ({ dim: d.label, kappa: cohenKappa(scores, d.key) })),
    [scores],
  );

  const downloadCsv = () => {
    const csv = aggregatesToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRubricCsv = () => {
    const header = "run_id,rater_user_id,dimension,score,comment,created_at";
    const body = scores.map((s) =>
      [s.run_id, s.rater_user_id, s.dimension, s.score,
       `"${(s.comment ?? "").replace(/"/g, '""')}"`, s.created_at].join(",")
    ).join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}\n`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-rubric-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRunsCsv = () => {
    const csv = runsToCsv(runs, proposals);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-runs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Zenodo-ready bundle: one .zip containing the three CSVs + a manifest with
   * counts, generation date, and summary aggregates. Drop the archive into the
   * artifact submission with no additional editing.
   */
  const downloadBundle = async () => {
    const zip = new JSZip();
    const stamp = new Date().toISOString().slice(0, 10);
    zip.file("aggregates.csv", aggregatesToCsv(rows));
    zip.file("runs.csv", runsToCsv(runs, proposals));
    const rubricHeader = "run_id,rater_user_id,dimension,score,comment,created_at";
    const rubricBody = scores.map((s) =>
      [s.run_id, s.rater_user_id, s.dimension, s.score,
       `"${(s.comment ?? "").replace(/"/g, '""')}"`, s.created_at].join(",")
    ).join("\n");
    zip.file("rubric.csv", `${rubricHeader}\n${rubricBody}\n`);
    zip.file("manifest.json", JSON.stringify({
      generated_at: new Date().toISOString(),
      run_count: runs.length,
      proposal_count: proposals.length,
      rubric_score_count: scores.length,
      aggregates: rows,
      kappa: kappaRows,
      tracks: {
        prospective: runs.filter((r) => r.track === "prospective").length,
        retrospective: runs.filter((r) => r.track === "retrospective").length,
      },
    }, null, 2));
    zip.file("README.md",
`# TimeArch Experiment Bundle (${stamp})

Files:
- aggregates.csv — per-proposal means (F1, Jaccard, quality direction, wall time)
- runs.csv       — one row per run, with track (prospective/retrospective) split
- rubric.csv     — raw human rubric scores (drives Cohen's κ)
- manifest.json  — counts + aggregates + κ per dimension, machine-readable

Reproduce figures:
    node scripts/plot-experiments.mjs --runs=runs.csv --out=figures
`);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-bundle-${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const hasKappa = kappaRows.some((k) => k.kappa !== null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Report</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadRubricCsv} disabled={scores.length === 0}>
            <Download className="mr-2 h-4 w-4" />Rubric CSV
          </Button>
          <Button size="sm" variant="outline" onClick={downloadRunsCsv} disabled={runs.length === 0}>
            <Download className="mr-2 h-4 w-4" />Runs CSV
          </Button>
          <Button size="sm" variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />Report CSV
          </Button>
          <Button size="sm" onClick={downloadBundle} disabled={runs.length === 0}>
            <Package className="mr-2 h-4 w-4" />Bundle (.zip)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No runs to aggregate yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Proposal</th>
                  <th className="py-2 pr-3">Runs</th>
                  <th className="py-2 pr-3">Comp/Part/Fail</th>
                  <th className="py-2 pr-3">Mean ms</th>
                  <th className="py-2 pr-3">Trips/run</th>
                  <th className="py-2 pr-3">Map F1</th>
                  <th className="py-2 pr-3">Ripple J</th>
                  <th className="py-2 pr-3">Qual dir</th>
                  <th className="py-2 pr-3">Plan tasks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.proposal_id ?? "adhoc"} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium">{r.proposal_title}</td>
                    <td className="py-2 pr-3">{r.run_count}</td>
                    <td className="py-2 pr-3 text-xs">{r.completed}/{r.partial}/{r.failed}</td>
                    <td className="py-2 pr-3">{r.mean_wall_ms}</td>
                    <td className="py-2 pr-3">{r.guardrail_trip_rate}</td>
                    <td className="py-2 pr-3">{fmt(r.mapping_f1)}</td>
                    <td className="py-2 pr-3">{fmt(r.ripple_jaccard)}</td>
                    <td className="py-2 pr-3">{fmt(r.quality_direction)}</td>
                    <td className="py-2 pr-3">{r.plan_task_mean === null ? "—" : r.plan_task_mean.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasKappa && (
          <div className="mt-6 border-t pt-4">
            <div className="mb-2 text-sm font-medium">Inter-rater reliability (Cohen's κ)</div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {kappaRows.map((k) => (
                <div key={k.dim} className="rounded border px-2 py-1">
                  <div className="text-muted-foreground">{k.dim}</div>
                  <div className="font-mono">{k.kappa === null ? "—" : k.kappa.toFixed(3)}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              κ requires ≥ 2 raters scoring the same runs. Landis &amp; Koch: 0.21–0.40 fair, 0.41–0.60 moderate, 0.61–0.80 substantial.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
