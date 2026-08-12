/**
 * Experiment Ground (Sprint 2 + 3).
 *
 * Admin/dev workspace: pick a proposal → auto-run the full brownfield loop,
 * inspect stage outputs + metrics, score with the rubric, export the report.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { experimentService, type ExperimentRun, type ExperimentStageResult } from "@/services/experimentService";
import { errorOf } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, Trash2, ClipboardCheck, Sparkles, Repeat2, GitPullRequest } from "lucide-react";
import { RubricDrawer } from "@/components/experiment/RubricDrawer";
import { ExperimentReport } from "@/components/experiment/ExperimentReport";
import { SEED_PROPOSALS } from "@/data/seedProposals";

const STAGE_LABELS: Record<string, string> = {
  mapping: "Feature → Architecture",
  ripple: "Ripple analysis",
  quality: "Quality impact",
  alternatives: "Alternatives",
  adr: "ADR record",
  plan: "Implementation plan",
};

function statusVariant(s: string) {
  if (s === "completed") return "default";
  if (s === "running") return "secondary";
  if (s === "partial" || s === "empty") return "outline";
  return "destructive";
}

type Track = "prospective" | "retrospective";

export default function ExperimentGround() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hintsText, setHintsText] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [scoringRun, setScoringRun] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(3);
  const [track, setTrack] = useState<Track>("prospective");
  const [prUrlDrafts, setPrUrlDrafts] = useState<Record<string, string>>({});
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const proposals = useQuery({
    queryKey: ["experiment", "proposals", projectId],
    queryFn: async () => {
      const r = await experimentService.listProposals(projectId!);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    enabled: !!projectId,
  });

  const runs = useQuery({
    queryKey: ["experiment", "runs", projectId],
    queryFn: async () => {
      const r = await experimentService.listRuns(projectId!);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    enabled: !!projectId,
    refetchInterval: 4000,
  });

  const createProposal = useMutation({
    mutationFn: async () => {
      let expected_hints: Record<string, unknown> = {};
      const t = hintsText.trim();
      if (t) {
        try { expected_hints = JSON.parse(t); }
        catch { throw new Error("Expected hints must be valid JSON, e.g. { \"components\": [...], \"files\": [...] }"); }
      }
      const r = await experimentService.createProposal({
        project_id: projectId!,
        title: title.trim(),
        description: description.trim(),
        change_type: "add",
        expected_hints,
      });
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    onSuccess: () => {
      setTitle(""); setDescription(""); setHintsText("");
      qc.invalidateQueries({ queryKey: ["experiment", "proposals", projectId] });
      toast({ title: "Proposal saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const r = await experimentService.deleteProposal(id);
      if (!r.ok) throw new Error(errorOf(r).message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["experiment", "proposals", projectId] }),
  });

  const runOne = useMutation({
    mutationFn: async (proposal_id: string) => {
      const r = await experimentService.runProposal({ project_id: projectId!, proposal_id, track });
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    onSuccess: (v) => {
      toast({ title: `Run ${v.status}`, description: `${v.stage_results.length} stages · ${v.wall_ms}ms` });
      qc.invalidateQueries({ queryKey: ["experiment", "runs", projectId] });
      setExpandedRun(v.run_id);
    },
    onError: (e: Error) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  const linkPr = useMutation({
    mutationFn: async (args: { proposal_id: string; pr_url: string }) => {
      setLinkingId(args.proposal_id);
      const r = await experimentService.linkPr(args);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    onSuccess: (v, args) => {
      toast({ title: "PR linked", description: `${v.file_count} files from ${v.repo}#${v.pr_number} loaded as ground truth` });
      qc.invalidateQueries({ queryKey: ["experiment", "proposals", projectId] });
      setPrUrlDrafts((d) => ({ ...d, [args.proposal_id]: "" }));
      setLinkingId(null);
    },
    onError: (e: Error) => {
      setLinkingId(null);
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    },
  });

  const loadSeed = useMutation({
    mutationFn: async () => {
      const r = await experimentService.loadSeedCorpus(projectId!, SEED_PROPOSALS);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["experiment", "proposals", projectId] });
      toast({ title: "Seed corpus loaded", description: `${v.inserted} inserted · ${v.skipped} skipped` });
    },
    onError: (e: Error) => toast({ title: "Load failed", description: e.message, variant: "destructive" }),
  });

  const runBatch = useMutation({
    mutationFn: async () => {
      const ids = (proposals.data ?? []).map((p) => p.id);
      if (ids.length === 0) throw new Error("No proposals to run");
      setBatchProgress({ done: 0, total: ids.length * repeat });
      const r = await experimentService.runBatch({
        project_id: projectId!,
        proposal_ids: ids,
        repeat,
        track,
        onProgress: (done, total) => setBatchProgress({ done, total }),
      });
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    onSuccess: (v) => {
      toast({ title: "Batch dispatched", description: `${v.started} started · ${v.failed} failed. Runs continue in the background.` });
      qc.invalidateQueries({ queryKey: ["experiment", "runs", projectId] });
      setTimeout(() => setBatchProgress(null), 3000);
    },
    onError: (e: Error) => {
      setBatchProgress(null);
      toast({ title: "Batch failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Experiment Ground</h1>
          <p className="text-sm text-muted-foreground">
            Auto-run the full brownfield loop for a proposal and inspect every stage.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/project/${projectId}`}>Back to project</Link>
        </Button>
      </header>

      <Card>
        <CardHeader><CardTitle>New proposal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Feature title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Describe the requested change…" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Textarea
            placeholder='Optional ground-truth hints (JSON): { "components": ["OwnerController"], "files": ["src/owners/api.ts"], "qualities": [{ "attribute": "performance", "direction": "positive" }] }'
            rows={2}
            value={hintsText}
            onChange={(e) => setHintsText(e.target.value)}
            className="font-mono text-xs"
          />
          <Button disabled={!title.trim() || createProposal.isPending} onClick={() => createProposal.mutate()}>
            {createProposal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save proposal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Proposals</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => loadSeed.mutate()} disabled={loadSeed.isPending}>
              {loadSeed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Load seed corpus
            </Button>
            <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTrack("prospective")}
                className={`rounded px-2 py-1 ${track === "prospective" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Prospective
              </button>
              <button
                type="button"
                onClick={() => setTrack("retrospective")}
                className={`rounded px-2 py-1 ${track === "retrospective" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                Retrospective
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <span className="text-muted-foreground">× </span>
              <Input
                type="number"
                min={1}
                max={10}
                value={repeat}
                onChange={(e) => setRepeat(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="h-6 w-12 border-0 p-0 text-center focus-visible:ring-0"
              />
            </div>
            <Button
              size="sm"
              onClick={() => runBatch.mutate()}
              disabled={runBatch.isPending || (proposals.data?.length ?? 0) === 0}
            >
              {runBatch.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat2 className="mr-2 h-4 w-4" />}
              Run all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batchProgress && (
            <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              Batch progress: {batchProgress.done} / {batchProgress.total}
            </div>
          )}
          {track === "retrospective" && (
            <div className="mb-3 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Retrospective mode: metrics score the loop's output against files touched by the linked merged PR (ground truth), not hand-authored hints.
            </div>
          )}
          {proposals.isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> :
            (proposals.data?.length ?? 0) === 0 ? <div className="text-sm text-muted-foreground">No proposals yet.</div> :
            <div className="divide-y">
              {proposals.data!.map((p) => (
                <div key={p.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.title}</span>
                        {p.pr_number && (
                          <Badge variant="outline" className="text-[10px]">
                            <GitPullRequest className="mr-1 h-3 w-3" />
                            {p.pr_repo ?? "PR"}#{p.pr_number} · {(p.pr_files ?? []).length} files
                          </Badge>
                        )}
                      </div>
                      {p.description && <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>}
                      {Object.keys(p.expected_hints ?? {}).length > 0 && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          hints: {Object.keys(p.expected_hints).join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pl-4">
                      <Button size="sm" onClick={() => runOne.mutate(p.id)} disabled={runOne.isPending}>
                        {runOne.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        Run {track === "retrospective" ? "(retro)" : ""}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteProposal.mutate(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      placeholder="Link merged PR: https://github.com/owner/repo/pull/123"
                      value={prUrlDrafts[p.id] ?? p.pr_url ?? ""}
                      onChange={(e) => setPrUrlDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={linkingId === p.id || !(prUrlDrafts[p.id] ?? p.pr_url)}
                      onClick={() => linkPr.mutate({ proposal_id: p.id, pr_url: (prUrlDrafts[p.id] ?? p.pr_url ?? "").trim() })}
                    >
                      {linkingId === p.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
                      {p.pr_number ? "Refresh PR" : "Link PR"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Runs</CardTitle></CardHeader>
        <CardContent>
          {(runs.data?.length ?? 0) === 0 ? <div className="text-sm text-muted-foreground">No runs yet.</div> :
            <div className="divide-y">
              {runs.data!.map((r) => (
                <RunRow
                  key={r.id}
                  run={r}
                  expanded={expandedRun === r.id}
                  onToggle={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                  onScore={() => setScoringRun(r.id)}
                />
              ))}
            </div>}
        </CardContent>
      </Card>

      <ExperimentReport runs={runs.data ?? []} proposals={proposals.data ?? []} />

      <RubricDrawer runId={scoringRun} open={!!scoringRun} onClose={() => setScoringRun(null)} />
    </div>
  );
}

function RunRow({ run, expanded, onToggle, onScore }: {
  run: ExperimentRun; expanded: boolean; onToggle: () => void; onScore: () => void;
}) {
  const stages = useQuery({
    queryKey: ["experiment", "stages", run.id],
    queryFn: async () => {
      const r = await experimentService.listStageResults(run.id);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    enabled: expanded,
    refetchInterval: expanded && run.status === "running" ? 2500 : false,
  });

  const runMetrics = ((run.summary as { metrics?: Record<string, Record<string, unknown>> })?.metrics) ?? {};

  return (
    <div className="py-3">
      <div className="flex w-full items-center justify-between">
        <button className="flex-1 text-left" onClick={onToggle}>
          <div className="text-sm font-medium">{new Date(run.started_at).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            {run.track} · {run.wall_ms}ms · {(run.summary as { total_rows?: number })?.total_rows ?? 0} rows
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onScore}>
            <ClipboardCheck className="mr-1 h-4 w-4" />Score
          </Button>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 rounded-md border p-3">
          {stages.data?.map((s: ExperimentStageResult) => {
            const m = (runMetrics[s.stage_key] ?? s.metrics ?? {}) as Record<string, unknown>;
            const metricStr = Object.entries(m)
              .filter(([k]) => !["predicted", "truth", "true_positive", "matched", "intersection"].includes(k))
              .map(([k, v]) => `${k}=${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : v}`)
              .join(" · ");
            return (
              <div key={s.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-muted-foreground">{s.stage_order}.</span>
                    <span>{STAGE_LABELS[s.stage_key] ?? s.stage_key}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{s.row_count} rows</span>
                    <span>{s.wall_ms}ms</span>
                    <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                  </div>
                </div>
                {metricStr && <div className="ml-8 mt-0.5 text-xs text-muted-foreground">{metricStr}</div>}
              </div>
            );
          })}
          {(!stages.data || stages.data.length === 0) && (
            <div className="text-xs text-muted-foreground">No stage results yet.</div>
          )}
          {(run.guardrail_events as unknown[]).length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Guardrail events ({(run.guardrail_events as unknown[]).length})</summary>
              <pre className="mt-1 overflow-auto rounded bg-muted p-2">{JSON.stringify(run.guardrail_events, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
