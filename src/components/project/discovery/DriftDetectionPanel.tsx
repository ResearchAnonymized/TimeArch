import { useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  FileText,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Drift {
  stage: number;
  kind: string;
  import_id: string;
  source_label: string;
  baseline_artifact_id: string | null;
  baseline_locked_at: string | null;
  fresh: any;
  diff: any;
  error?: string;
}

interface Props {
  projectId: string;
}

const STAGE_LABEL: Record<number, string> = {
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
};

function summarizeDiff(d: Drift) {
  const parts: string[] = [];
  const x = d.diff || {};
  if (x.endpoints_added?.length) parts.push(`+${x.endpoints_added.length} endpoint(s)`);
  if (x.endpoints_removed?.length) parts.push(`−${x.endpoints_removed.length} endpoint(s)`);
  if (x.schemas_added?.length) parts.push(`+${x.schemas_added.length} schema(s)`);
  if (x.schemas_removed?.length) parts.push(`−${x.schemas_removed.length} schema(s)`);
  if (x.tables_added?.length) parts.push(`+${x.tables_added.length} table(s)`);
  if (x.tables_removed?.length) parts.push(`−${x.tables_removed.length} table(s)`);
  if (x.column_changes?.length) parts.push(`${x.column_changes.length} column change(s)`);
  if (x.components_added?.length) parts.push(`+${x.components_added.length} component(s)`);
  if (x.components_removed?.length) parts.push(`−${x.components_removed.length} component(s)`);
  if (x.infra_changes && Object.keys(x.infra_changes).length)
    parts.push(`${Object.keys(x.infra_changes).length} infra change(s)`);
  return parts.join(" · ") || "no structural changes";
}

export default function DriftDetectionPanel({ projectId }: Props) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [drifts, setDrifts] = useState<Drift[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [acting, setActing] = useState<number | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);
  const [persistedCount, setPersistedCount] = useState<number | null>(null);

  // Hydrate from persisted drift_findings on mount so results survive reload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("drift_findings")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "open")
        .order("detected_at", { ascending: false });
      if (cancelled || error || !data?.length) {
        if (!error) setPersistedCount(0);
        return;
      }
      setPersistedCount(data.length);
      // Group findings back into per-import drift cards.
      const byImport = new Map<string, Drift>();
      for (const f of data as any[]) {
        const key = `${f.import_id}|${f.stage}`;
        let d = byImport.get(key);
        if (!d) {
          d = {
            stage: f.stage,
            kind: f.kind,
            import_id: f.import_id,
            source_label: f.source_label || "(unknown source)",
            baseline_artifact_id: f.baseline_artifact_id,
            baseline_locked_at: null,
            fresh: f.fresh_snapshot,
            diff: {
              endpoints_added: [], endpoints_removed: [],
              schemas_added: [], schemas_removed: [],
              tables_added: [], tables_removed: [], column_changes: [],
              components_added: [], components_removed: [],
              infra_changes: {} as Record<string, any>,
            },
          };
          byImport.set(key, d);
        }
        const x = d.diff as any;
        const c = f.category, et = f.entity_type;
        if (et === "endpoint" && c === "added") x.endpoints_added.push(f.details);
        else if (et === "endpoint" && c === "removed") x.endpoints_removed.push(f.details);
        else if (et === "schema" && c === "added") x.schemas_added.push(f.entity_ref);
        else if (et === "schema" && c === "removed") x.schemas_removed.push(f.entity_ref);
        else if (et === "table" && c === "added") x.tables_added.push(f.details);
        else if (et === "table" && c === "removed") x.tables_removed.push(f.details);
        else if (et === "table_columns") x.column_changes.push(f.details);
        else if (et === "component" && c === "added") x.components_added.push(f.details);
        else if (et === "component" && c === "removed") x.components_removed.push(f.details);
        else if (et === "infra_signal") x.infra_changes[f.entity_ref] = f.details;
      }
      setDrifts(Array.from(byImport.values()));
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const markFindingsResolved = async (d: Drift, status: "rebaselined" | "adr_recorded") => {
    if (!user) return;
    await supabase
      .from("drift_findings")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("project_id", projectId)
      .eq("import_id", d.import_id)
      .eq("stage", d.stage)
      .eq("status", "open");
  };

  const runScan = async () => {
    setRunning(true);
    try {
      const res = await callAuthenticatedFunction<{
        drifts: Drift[];
        scanned: number;
        findings_created?: number;
        error?: string;
      }>("drift-detect", { project_id: projectId });
      if (res.error) throw new Error(res.error);
      setDrifts(res.drifts || []);
      setScanned(res.scanned ?? 0);
      setPersistedCount(res.findings_created ?? 0);
      toast.success(
        `Scanned ${res.scanned ?? 0} import(s) — ${res.drifts?.length ?? 0} drift(s), ${res.findings_created ?? 0} finding(s) saved`,
      );
    } catch (e: any) {
      toast.error(e.message || "Drift scan failed");
    } finally {
      setRunning(false);
    }
  };

  const rebaseline = async (idx: number) => {
    const d = drifts[idx];
    if (!user || !d.baseline_artifact_id) {
      toast.error("No locked baseline to overwrite");
      return;
    }
    setActing(idx);
    try {
      const { data: existing } = await supabase
        .from("architecture_artifacts")
        .select("content, version")
        .eq("id", d.baseline_artifact_id)
        .maybeSingle();
      const newContent = {
        ...((existing?.content as any) || {}),
        ...d.fresh,
        _meta: {
          ...((existing?.content as any)?._meta || {}),
          provenance: "reverse-engineered",
          re_baselined_at: new Date().toISOString(),
          source_label: d.source_label,
        },
      };
      const { error } = await supabase
        .from("architecture_artifacts")
        .update({
          content: newContent,
          version: (existing?.version || 1) + 1,
          status: "draft",
          locked_at: null,
          locked_by: null,
        })
        .eq("id", d.baseline_artifact_id);
      if (error) throw error;
      await markFindingsResolved(d, "rebaselined");
      toast.success(`Re-baselined Stage ${d.stage}`);
      setDrifts((prev) => prev.filter((_, i) => i !== idx));
    } catch (e: any) {
      toast.error(e.message || "Re-baseline failed");
    } finally {
      setActing(null);
    }
  };

  const saveAsAdr = async (idx: number) => {
    const d = drifts[idx];
    if (!user) return;
    setActing(idx);
    try {
      const { error } = await supabase.from("architecture_artifacts").insert({
        project_id: projectId,
        stage: 14,
        type: "adr",
        title: `[Drift] ${STAGE_LABEL[d.stage] || `Stage ${d.stage}`} change — ${d.source_label}`,
        status: "draft",
        generated_by: "Drift Detection Agent",
        created_by: user.id,
        content: {
          _meta: {
            provenance: "drift-detection",
            source_stage: d.stage,
            source_label: d.source_label,
            captured_at: new Date().toISOString(),
            baseline_artifact_id: d.baseline_artifact_id,
          },
          summary: `Drift detected against locked baseline: ${summarizeDiff(d)}`,
          diff: d.diff,
          fresh_snapshot: d.fresh,
        },
      });
      if (error) throw error;
      await markFindingsResolved(d, "adr_recorded");
      toast.success("Drift recorded as ADR (Stage 14)");
      setDrifts((prev) => prev.filter((_, i) => i !== idx));
    } catch (e: any) {
      toast.error(e.message || "Failed to record ADR");
    } finally {
      setActing(null);
    }
  };

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">Drift Detection</h3>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Re-parses fresh imports (Discovery) and compares them to the locked baseline for
              Stages 6, 7 and 8. For each change, choose to re-baseline the artifact or record the
              drift as a Stage 14 ADR.
            </p>
          </div>
        </div>
        <Button onClick={runScan} disabled={running} size="sm">
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Scan for drift
            </>
          )}
        </Button>
      </div>

      {scanned !== null && drifts.length === 0 && !running && (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            No drift detected across {scanned} import(s). Baseline is in sync.
          </p>
        </div>
      )}

      {drifts.length > 0 && (
        <div className="space-y-2">
          {drifts.map((d, i) => {
            const isOpen = expanded.has(i);
            return (
              <div key={`${d.import_id}-${i}`} className="rounded-md border bg-background">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => toggle(i)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    Stage {d.stage}
                  </Badge>
                  <span className="text-sm font-medium truncate flex-1">{d.source_label}</span>
                  {d.error ? (
                    <span className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {d.error}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {summarizeDiff(d)}
                    </span>
                  )}
                </button>

                {isOpen && !d.error && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t">
                    <DiffDetail diff={d.diff} />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === i || !d.baseline_artifact_id}
                        onClick={() => rebaseline(i)}
                      >
                        {acting === i ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1.5" />
                        )}
                        Re-baseline Stage {d.stage}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={acting === i}
                        onClick={() => saveAsAdr(i)}
                      >
                        <FileText className="h-3 w-3 mr-1.5" />
                        Save as ADR
                      </Button>
                      {!d.baseline_artifact_id && (
                        <span className="text-[11px] text-muted-foreground self-center">
                          No locked baseline — only ADR available
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffList({ label, items, sign }: { label: string; items: any[]; sign: "+" | "−" }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{label}</div>
      <ul className="space-y-0.5">
        {items.slice(0, 20).map((it, i) => (
          <li
            key={i}
            className={cn(
              "text-[11px] font-mono flex items-start gap-1.5",
              sign === "+" ? "text-emerald-600" : "text-destructive",
            )}
          >
            {sign === "+" ? (
              <Plus className="h-3 w-3 mt-0.5 shrink-0" />
            ) : (
              <Minus className="h-3 w-3 mt-0.5 shrink-0" />
            )}
            <span className="break-all">
              {typeof it === "string"
                ? it
                : it.method
                  ? `${it.method} ${it.path}`
                  : it.name || it.path || JSON.stringify(it)}
            </span>
          </li>
        ))}
        {items.length > 20 && (
          <li className="text-[10px] text-muted-foreground italic">+ {items.length - 20} more</li>
        )}
      </ul>
    </div>
  );
}

function DiffDetail({ diff }: { diff: any }) {
  if (!diff) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md bg-muted/20 p-3">
      <DiffList label="Endpoints added" items={diff.endpoints_added || []} sign="+" />
      <DiffList label="Endpoints removed" items={diff.endpoints_removed || []} sign="−" />
      <DiffList label="Schemas added" items={diff.schemas_added || []} sign="+" />
      <DiffList label="Schemas removed" items={diff.schemas_removed || []} sign="−" />
      <DiffList label="Tables added" items={diff.tables_added || []} sign="+" />
      <DiffList label="Tables removed" items={diff.tables_removed || []} sign="−" />
      <DiffList label="Components added" items={diff.components_added || []} sign="+" />
      <DiffList label="Components removed" items={diff.components_removed || []} sign="−" />
      {diff.column_changes?.length ? (
        <div className="md:col-span-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
            Column changes
          </div>
          <ul className="space-y-1">
            {diff.column_changes.map((c: any, i: number) => (
              <li key={i} className="text-[11px] font-mono">
                <span className="font-semibold">{c.table}</span>:{" "}
                {c.added.map((a: string) => (
                  <span key={a} className="text-emerald-600">
                    +{a}{" "}
                  </span>
                ))}
                {c.removed.map((r: string) => (
                  <span key={r} className="text-destructive">
                    −{r}{" "}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {diff.infra_changes && Object.keys(diff.infra_changes).length ? (
        <div className="md:col-span-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
            Infrastructure signals
          </div>
          <ul className="space-y-0.5">
            {Object.entries<any>(diff.infra_changes).map(([k, v]) => (
              <li key={k} className="text-[11px] font-mono">
                <span className="font-semibold">{k}</span>: {String(v.from)} →{" "}
                <span className={v.to ? "text-emerald-600" : "text-destructive"}>
                  {String(v.to)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
