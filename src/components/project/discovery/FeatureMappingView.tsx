/**
 * FeatureMappingView (Phase 3) — shows which architecture elements a feature
 * change touches. Users can trigger map-feature-to-architecture, review, and
 * approve / correct / remove mappings.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCw, Trash2, Wand2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EvidencePanel, { type EvidenceRef } from "./EvidencePanel";

interface FeatureChange {
  id: string;
  title: string;
  is_active: boolean;
}

interface Mapping {
  id: string;
  element_type: string;
  element_ref: string;
  element_label: string | null;
  relationship: string;
  confidence: number;
  source: string;
  review_status: string;
  rationale: string | null;
  evidence_refs: EvidenceRef[] | null;
  feature_change_id: string;
}

interface Props {
  projectId: string;
}

const relColor: Record<string, string> = {
  modifies: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  reads: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  writes: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  replaces: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  extends: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  removes: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  touches: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

const statusColor: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  corrected: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  removed: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export default function FeatureMappingView({ projectId }: Props) {
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [coverage, setCoverage] = useState<Record<string, { total: number; approved: number; pending: number }>>({});
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<"pending" | "approved" | "removed" | null>(null);

  const loadCoverage = useCallback(async () => {
    const { data } = await supabase
      .from("feature_mappings")
      .select("feature_change_id,review_status")
      .in(
        "feature_change_id",
        (await supabase.from("feature_changes").select("id").eq("project_id", projectId)).data?.map((r: any) => r.id) || [],
      );
    const agg: Record<string, { total: number; approved: number; pending: number }> = {};
    for (const row of (data as any[]) || []) {
      const k = row.feature_change_id as string;
      if (!agg[k]) agg[k] = { total: 0, approved: 0, pending: 0 };
      agg[k].total++;
      if (row.review_status === "approved") agg[k].approved++;
      else if (row.review_status !== "removed") agg[k].pending++;
    }
    setCoverage(agg);
  }, [projectId]);

  const loadChanges = useCallback(async () => {
    const { data } = await supabase
      .from("feature_changes")
      .select("id,title,is_active")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const list = (data as FeatureChange[]) || [];
    setChanges(list);
    const active = list.find((c) => c.is_active) || list[0];
    if (active && !activeId) setActiveId(active.id);
  }, [projectId, activeId]);

  const loadMappings = useCallback(
    async (fcId: string) => {
      setLoading(true);
      let query = supabase
        .from("feature_mappings")
        .select("*")
        .order("confidence", { ascending: false });
      if (fcId === "__all__") {
        const ids = changes.map((c) => c.id);
        if (ids.length === 0) {
          setMappings([]);
          setLoading(false);
          return;
        }
        query = query.in("feature_change_id", ids);
      } else {
        query = query.eq("feature_change_id", fcId);
      }
      const { data } = await query;
      setMappings((data as Mapping[]) || []);
      setLoading(false);
    },
    [changes],
  );

  useEffect(() => {
    void loadChanges();
    void loadCoverage();
  }, [loadChanges, loadCoverage]);

  useEffect(() => {
    if (activeId) {
      void loadMappings(activeId);
      void loadCoverage();
    }
  }, [activeId, loadMappings]);

  const runMap = async (replace = false) => {
    if (!activeId) return;
    setRunning(true);
    const res = await invokeFunction<
      { feature_change_id: string; replace?: boolean },
      { mapping_count: number; error?: string }
    >("map-feature-to-architecture", { feature_change_id: activeId, replace });
    setRunning(false);
    if (!res.ok) {
      toast.error(errorOf(res).message);
      return;
    }
    if (res.value.error) {
      toast.error(res.value.error);
      return;
    }
    toast.success(`Mapped ${res.value.mapping_count} element(s)`);
    void loadMappings(activeId); void loadCoverage();
  };

  const runMapAllActive = async (replace = false) => {
    const targets = changes.filter((c) => c.is_active);
    if (targets.length === 0) {
      toast.error("Star at least one feature change first");
      return;
    }
    setRunning(true);
    let total = 0;
    let failed = 0;
    for (const c of targets) {
      const res = await invokeFunction<
        { feature_change_id: string; replace?: boolean },
        { mapping_count: number; error?: string }
      >("map-feature-to-architecture", { feature_change_id: c.id, replace });
      if (!res.ok || res.value?.error) {
        failed++;
        toast.error(`"${c.title.slice(0, 40)}" failed`);
      } else {
        total += res.value.mapping_count || 0;
      }
    }
    setRunning(false);
    toast.success(`Batch done · ${targets.length - failed}/${targets.length} proposals · ${total} mappings`);
    if (activeId) void loadMappings(activeId); void loadCoverage();
  };

  const setStatus = async (id: string, review_status: string) => {
    // Optimistic update so drag feels instant.
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, review_status } : m)));
    const { error } = await supabase
      .from("feature_mappings")
      .update({ review_status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      if (activeId) void loadMappings(activeId); void loadCoverage();
      return;
    }
  };

  const handleDrop = (col: "pending" | "approved" | "removed") => {
    if (draggingId) {
      const current = mappings.find((m) => m.id === draggingId);
      const currentKey =
        current?.review_status === "approved"
          ? "approved"
          : current?.review_status === "removed"
            ? "removed"
            : "pending";
      if (currentKey !== col) void setStatus(draggingId, col);
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    const { error } = await supabase.from("feature_mappings").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (activeId) void loadMappings(activeId); void loadCoverage();
  };

  const selected = useMemo(
    () => mappings.find((m) => m.id === selectedId) || null,
    [mappings, selectedId],
  );

  const columns = useMemo(() => {
    const cols: Record<"pending" | "approved" | "removed", Mapping[]> = {
      pending: [],
      approved: [],
      removed: [],
    };
    for (const m of mappings) {
      const key =
        m.review_status === "approved"
          ? "approved"
          : m.review_status === "removed"
            ? "removed"
            : "pending";
      cols[key].push(m);
    }
    return cols;
  }, [mappings]);

  if (changes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
        Capture a feature change first (in the Feature changes panel), then map it to your architecture.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Feature → Architecture Mapping</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Which parts of the current system does this change touch? Every mapping cites evidence.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="__all__">▦ All proposals (aggregate)</option>
            {changes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_active ? "★ " : ""}
                {c.title.slice(0, 50)}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => runMap(false)} disabled={running || !activeId || activeId === "__all__"} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Analyze
          </Button>
          <Button size="sm" variant="ghost" onClick={() => runMap(true)} disabled={running || !activeId || activeId === "__all__"} className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" /> Re-run
          </Button>
          <Button
            size="sm"
            onClick={() => runMapAllActive(false)}
            disabled={running || changes.filter((c) => c.is_active).length === 0}
            className="gap-1.5"
            title="Run mapping on every starred proposal"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Analyze all ★ ({changes.filter((c) => c.is_active).length})
          </Button>
        </div>
      </div>

      {/* Coverage across ALL Step 2 feature changes */}
      {(() => {
        const total = changes.length;
        const mapped = changes.filter((c) => (coverage[c.id]?.total ?? 0) > 0).length;
        const unmapped = total - mapped;
        const starred = changes.filter((c) => c.is_active).length;
        const starredMapped = changes.filter((c) => c.is_active && (coverage[c.id]?.total ?? 0) > 0).length;
        const pct = total > 0 ? Math.round((mapped / total) * 100) : 0;
        return (
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coverage across Step 2 feature changes
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span><span className="font-semibold text-foreground">{mapped}</span>/{total} mapped ({pct}%)</span>
                <span>★ starred: <span className="font-semibold text-foreground">{starredMapped}</span>/{starred}</span>
                {unmapped > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{unmapped} unmapped</span>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-background overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {changes.map((c) => {
                const cov = coverage[c.id];
                const has = (cov?.total ?? 0) > 0;
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    title={
                      has
                        ? `${cov!.total} mappings · ${cov!.approved} approved · ${cov!.pending} pending`
                        : "Not mapped yet — select and click Analyze"
                    }
                    className={
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors " +
                      (isActive
                        ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-300 "
                        : has
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20")
                    }
                  >
                    {c.is_active && <span>★</span>}
                    <span className="max-w-[180px] truncate">{c.title}</span>
                    <span className="opacity-70">
                      {has ? `${cov!.total}` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
            {unmapped > 0 && (
              <div className="text-[11px] text-muted-foreground pt-1">
                Tip: use <span className="font-medium">Analyze all ★</span> to map every starred proposal in one batch.
              </div>
            )}
          </div>
        );
      })()}

      <div className="space-y-4">
        <div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading mappings…
            </div>
          ) : mappings.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No mappings yet. Click <span className="font-medium">Analyze</span> to generate them.
            </div>
          ) : (
            (() => {
              const cols: Array<{
                key: "pending" | "approved" | "removed";
                title: string;
                hint: string;
                accent: string;
                list: Mapping[];
                prev?: "pending" | "approved" | "removed";
                next?: "pending" | "approved" | "removed";
              }> = [
                {
                  key: "pending",
                  title: "Pending review",
                  hint: "AI-suggested — needs triage",
                  accent: "border-slate-400/40 bg-slate-500/5",
                  list: columns.pending,
                  next: "approved",
                },
                {
                  key: "approved",
                  title: "Approved",
                  hint: "Confirmed as touched",
                  accent: "border-emerald-500/40 bg-emerald-500/5",
                  list: columns.approved,
                  prev: "pending",
                  next: "removed",
                },
                {
                  key: "removed",
                  title: "Not applicable",
                  hint: "Excluded from downstream",
                  accent: "border-red-500/40 bg-red-500/5",
                  list: columns.removed,
                  prev: "approved",
                },
              ];
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {cols.map((col) => (
                    <div
                      key={col.key}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverCol !== col.key) setDragOverCol(col.key);
                      }}
                      onDragLeave={(e) => {
                        // Only clear if leaving the column, not entering a child.
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverCol((prev) => (prev === col.key ? null : prev));
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(col.key);
                      }}
                      className={
                        "rounded-md border p-2.5 space-y-2 min-h-[140px] transition-colors " +
                        col.accent +
                        (dragOverCol === col.key ? " ring-2 ring-blue-500/60 border-blue-500/60" : "")
                      }
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide">
                            {col.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{col.hint}</div>
                        </div>
                        <span className="text-[11px] font-semibold rounded-full bg-background border border-border px-1.5 py-0.5">
                          {col.list.length}
                        </span>
                      </div>
                      {col.list.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic text-center py-3 border border-dashed border-border/60 rounded">
                          {dragOverCol === col.key ? "Drop here" : "Nothing here"}
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          {col.list.map((m) => (
                            <li
                              key={m.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggingId(m.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", m.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDragOverCol(null);
                              }}
                              onClick={() => setSelectedId(m.id)}
                              className={
                                "rounded-md border p-2 cursor-grab active:cursor-grabbing transition-all bg-background " +
                                (draggingId === m.id ? "opacity-40 " : "") +
                                (selectedId === m.id
                                  ? "border-blue-600 ring-1 ring-blue-600/40"
                                  : "border-border hover:bg-muted/40")
                              }
                            >
                              {activeId === "__all__" && (
                                <div className="text-[10px] text-muted-foreground truncate mb-0.5">
                                  {changes.find((c) => c.id === m.feature_change_id)?.title.slice(0, 40) || "—"}
                                </div>
                              )}
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-medium truncate flex-1 min-w-0">
                                  {m.element_ref}
                                </span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                                  {m.element_type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1 py-0 ${relColor[m.relationship] || relColor.touches}`}
                                >
                                  {m.relationship}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {(m.confidence * 100).toFixed(0)}%
                                </Badge>
                              </div>
                              {m.element_label && (
                                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                                  {m.element_label}
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-border/60">
                                <div className="flex items-center gap-0.5">
                                  {col.prev && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void setStatus(m.id, col.prev!);
                                      }}
                                      title="Move left"
                                    >
                                      <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {col.next && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className={
                                        "h-6 w-6 p-0 " +
                                        (col.next === "approved"
                                          ? "text-emerald-600 hover:text-emerald-700"
                                          : "text-amber-600 hover:text-amber-700")
                                      }
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void setStatus(m.id, col.next!);
                                      }}
                                      title={
                                        col.next === "approved"
                                          ? "Approve"
                                          : "Mark not applicable"
                                      }
                                    >
                                      {col.next === "approved" ? (
                                        <Check className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void remove(m.id);
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
        <EvidencePanel
          title="Evidence"
          subtitle={selected ? `For ${selected.element_ref}` : "Select a mapping to inspect its evidence."}
          refs={selected?.evidence_refs || []}
          emptyLabel={selected ? "This mapping has no evidence yet." : "Pick a mapping."}
        />
      </div>
    </div>
  );
}
