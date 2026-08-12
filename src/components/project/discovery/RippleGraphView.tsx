/**
 * RippleGraphView (Phase 4) — shows secondary impacts of a feature change,
 * grouped by classification (confirmed / probable / possible / unlikely /
 * unknown). Requires feature_mappings to exist first.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, RotateCw, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EvidencePanel, { type EvidenceRef } from "./EvidencePanel";

interface FeatureChange {
  id: string;
  title: string;
  is_active: boolean;
}

interface Impact {
  id: string;
  impacted_element_type: string;
  impacted_element_ref: string;
  impacted_element_label: string | null;
  classification: "confirmed" | "probable" | "possible" | "unlikely" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  reason: string | null;
  dependency_path: Array<{ type: string; ref: string; label?: string }> | null;
  recommended_action: string | null;
  evidence_refs: EvidenceRef[] | null;
}



const classColor: Record<Impact["classification"], string> = {
  confirmed: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  probable: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  possible: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  unlikely: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  unknown: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
};

const sevColor: Record<Impact["severity"], string> = {
  critical: "bg-red-600 text-white border-transparent",
  high: "bg-amber-600 text-white border-transparent",
  medium: "bg-blue-600 text-white border-transparent",
  low: "bg-slate-600 text-white border-transparent",
};

interface Props {
  projectId: string;
}

export default function RippleGraphView({ projectId }: Props) {
  const { user } = useAuth();
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const loadImpacts = useCallback(async (fcId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("impact_findings")
      .select("*")
      .eq("feature_change_id", fcId)
      .order("severity", { ascending: false });
    setImpacts(((data as unknown) as Impact[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadChanges();
  }, [loadChanges]);

  useEffect(() => {
    if (activeId) void loadImpacts(activeId);
  }, [activeId, loadImpacts]);

  const run = async (replace = false) => {
    if (!activeId) return;
    setRunning(true);
    const res = await invokeFunction<
      { feature_change_id: string; replace?: boolean },
      { impact_count: number; error?: string }
    >("analyze-ripple", { feature_change_id: activeId, replace });
    setRunning(false);
    if (!res.ok) {
      toast.error(errorOf(res).message);
      return;
    }
    if (res.value.error) {
      toast.error(res.value.error);
      return;
    }
    toast.success(`Found ${res.value.impact_count} ripple(s)`);
    void loadImpacts(activeId);
  };

  const selected = useMemo(
    () => impacts.find((i) => i.id === selectedId) || null,
    [impacts, selectedId],
  );

  const groupedByModule = useMemo(() => {
    const g: Record<string, Impact[]> = {};
    for (const i of impacts) {
      const key = (i.impacted_element_type || "other").toLowerCase();
      (g[key] ||= []).push(i);
    }
    // Sort each bucket by severity then classification for architect readability.
    const sevRank: Record<Impact["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const clsRank: Record<Impact["classification"], number> = {
      confirmed: 0,
      probable: 1,
      possible: 2,
      unlikely: 3,
      unknown: 4,
    };
    for (const k of Object.keys(g)) {
      g[k].sort(
        (a, b) => sevRank[a.severity] - sevRank[b.severity] || clsRank[a.classification] - clsRank[b.classification],
      );
    }
    return g;
  }, [impacts]);

  // Blast-radius score: 0-100. Weights severity heavily, boosted by confirmed/probable.
  const summary = useMemo(() => {
    const sevW: Record<Impact["severity"], number> = { critical: 10, high: 6, medium: 3, low: 1 };
    const clsW: Record<Impact["classification"], number> = {
      confirmed: 1,
      probable: 0.75,
      possible: 0.5,
      unlikely: 0.25,
      unknown: 0.25,
    };
    let raw = 0;
    let criticalHigh = 0;
    let confirmed = 0;
    for (const i of impacts) {
      raw += sevW[i.severity] * clsW[i.classification];
      if (i.severity === "critical" || i.severity === "high") criticalHigh++;
      if (i.classification === "confirmed") confirmed++;
    }
    // Normalize with soft cap so 10 medium-probable ≈ 40, 5 critical-confirmed ≈ 90.
    const score = Math.min(100, Math.round((raw / (raw + 30)) * 100));
    return {
      score,
      criticalHigh,
      confirmed,
      modules: Object.keys(groupedByModule).length,
      total: impacts.length,
    };
  }, [impacts, groupedByModule]);

  const draftAdrFrom = async (imp: Impact) => {
    if (!user || !activeId) {
      toast.error("Sign in required");
      return;
    }
    setDraftingId(imp.id);
    const change = changes.find((c) => c.id === activeId);
    const context = [
      `Ripple finding from feature change "${change?.title || activeId}".`,
      `Impacted ${imp.impacted_element_type}: ${imp.impacted_element_ref}` +
        (imp.impacted_element_label ? ` (${imp.impacted_element_label})` : "") + ".",
      imp.reason ? `Reason: ${imp.reason}` : "",
      `Classification: ${imp.classification} · Severity: ${imp.severity}.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const { error } = await supabase.from("adr_records").insert({
      project_id: projectId,
      feature_change_id: activeId,
      title: `Handle ripple: ${imp.impacted_element_ref}`,
      status: "draft",
      context,
      decision: imp.recommended_action || null,
      evidence_refs: (imp.evidence_refs ?? []) as never,
      created_by: user.id,
    } as never);
    setDraftingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Draft ADR created — open Stage 6 to finalize");
  };

  if (changes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
        Capture a feature change first, then map it, then run ripple analysis.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Waves className="h-4 w-4 text-blue-500" /> Ripple analysis
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Downstream elements likely to be impacted, classified by confidence and severity. Requires mappings.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {changes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_active ? "★ " : ""}
                {c.title.slice(0, 50)}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={running || !activeId} className="gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Waves className="h-3.5 w-3.5" />}
            Analyze
          </Button>
          <Button size="sm" variant="ghost" onClick={() => run(true)} disabled={running || !activeId} className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" /> Re-run
          </Button>
        </div>
      </div>

      {impacts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            {
              label: "Blast radius",
              value: `${summary.score}`,
              suffix: "/100",
              hint:
                summary.score >= 70
                  ? "High — treat as major change"
                  : summary.score >= 40
                    ? "Moderate — plan carefully"
                    : "Contained",
              accent:
                summary.score >= 70
                  ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                  : summary.score >= 40
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            },
            {
              label: "Critical / High",
              value: `${summary.criticalHigh}`,
              suffix: ` of ${summary.total}`,
              hint: "Severity that needs attention",
              accent: "border-red-500/30 bg-red-500/5",
            },
            {
              label: "Confirmed",
              value: `${summary.confirmed}`,
              suffix: ` of ${summary.total}`,
              hint: "Backed by direct evidence",
              accent: "border-blue-500/30 bg-blue-500/5",
            },
            {
              label: "Modules touched",
              value: `${summary.modules}`,
              suffix: "",
              hint: "Distinct layers affected",
              accent: "border-slate-500/30 bg-slate-500/5",
            },
          ].map((tile) => (
            <div key={tile.label} className={"rounded-md border p-2.5 " + tile.accent}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{tile.label}</div>
              <div className="text-lg font-semibold leading-tight">
                {tile.value}
                <span className="text-xs font-normal text-muted-foreground">{tile.suffix}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{tile.hint}</div>
            </div>
          ))}
        </div>
      )}

      {impacts.length > 0 && (() => {
        const sevRows: Array<{ key: Impact["severity"]; label: string }> = [
          { key: "critical", label: "Critical" },
          { key: "high", label: "High" },
          { key: "medium", label: "Med" },
          { key: "low", label: "Low" },
        ];
        const likeCols: Array<{ key: Impact["classification"]; label: string }> = [
          { key: "unlikely", label: "Unlikely" },
          { key: "unknown", label: "Unknown" },
          { key: "possible", label: "Possible" },
          { key: "probable", label: "Probable" },
          { key: "confirmed", label: "Confirmed" },
        ];
        const heat = (rIdx: number, cIdx: number) => {
          const sevW = [4, 3, 2, 1][rIdx];
          const likeW = [1, 1, 2, 3, 4][cIdx];
          const score = sevW * likeW;
          if (score >= 12) return "bg-red-500/25 border-red-500/40";
          if (score >= 8) return "bg-amber-500/20 border-amber-500/40";
          if (score >= 4) return "bg-yellow-500/15 border-yellow-500/30";
          return "bg-emerald-500/10 border-emerald-500/30";
        };
        return (
          <div className="rounded-md border border-border bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide">Risk matrix</div>
              <div className="text-[10px] text-muted-foreground">Severity × Likelihood · click a dot to inspect</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-[10px]">
                <thead>
                  <tr>
                    <th className="w-16"></th>
                    {likeCols.map((c) => (
                      <th key={c.key} className="font-normal text-muted-foreground text-center py-1">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sevRows.map((row, rIdx) => (
                    <tr key={row.key}>
                      <td className="text-right pr-2 font-medium text-muted-foreground">{row.label}</td>
                      {likeCols.map((col, cIdx) => {
                        const cell = impacts.filter(
                          (i) => i.severity === row.key && i.classification === col.key,
                        );
                        return (
                          <td
                            key={col.key}
                            className={"rounded border align-top p-1 h-14 min-w-[52px] " + heat(rIdx, cIdx)}
                          >
                            {cell.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {cell.slice(0, 12).map((i) => (
                                  <button
                                    key={i.id}
                                    onClick={() => setSelectedId(i.id)}
                                    title={`${i.impacted_element_ref} — ${i.reason || ""}`}
                                    className={
                                      "h-3 w-3 rounded-full border transition-transform hover:scale-125 " +
                                      (selectedId === i.id
                                        ? "bg-blue-600 border-blue-800 ring-2 ring-blue-400"
                                        : "bg-foreground/70 border-foreground/40")
                                    }
                                  />
                                ))}
                                {cell.length > 12 && (
                                  <span className="text-[9px] text-muted-foreground self-center">
                                    +{cell.length - 12}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading impacts…
            </div>
          ) : impacts.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No ripple findings yet. Click <span className="font-medium">Analyze</span>.
            </div>
          ) : (
            Object.entries(groupedByModule)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([mod, list]) => {
                const critHigh = list.filter((i) => i.severity === "critical" || i.severity === "high").length;
                return (
                  <div key={mod} className="rounded-md border border-border bg-background/40 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide">{mod}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {list.length} finding{list.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {critHigh > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30">
                          {critHigh} high-severity
                        </Badge>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {list.map((i) => (
                        <li
                          key={i.id}
                          onClick={() => setSelectedId(i.id)}
                          className={
                            "rounded-md border p-2.5 cursor-pointer transition-colors " +
                            (selectedId === i.id
                              ? "border-blue-600 bg-blue-600/5"
                              : "border-border bg-background hover:bg-muted/40")
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${sevColor[i.severity]}`}>
                                  {i.severity}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${classColor[i.classification]}`}>
                                  {i.classification}
                                </Badge>
                                <span className="text-sm font-medium truncate">{i.impacted_element_ref}</span>
                              </div>
                              {i.impacted_element_label && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                  {i.impacted_element_label}
                                </div>
                              )}
                              {i.reason && <div className="text-xs text-muted-foreground mt-1">{i.reason}</div>}
                              {i.recommended_action && (
                                <div className="text-xs mt-1 rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1">
                                  <span className="font-medium text-emerald-700 dark:text-emerald-300">Action: </span>
                                  {i.recommended_action}
                                </div>
                              )}
                              {Array.isArray(i.dependency_path) && i.dependency_path.length > 0 && (
                                <div className="text-[11px] text-muted-foreground mt-1 font-mono truncate">
                                  {i.dependency_path.map((n) => `${n.type}:${n.ref}`).join(" → ")}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 gap-1 h-7 text-[11px]"
                              disabled={draftingId === i.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void draftAdrFrom(i);
                              }}
                              title="Create a draft ADR pre-filled from this finding"
                            >
                              {draftingId === i.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              Draft ADR
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
          )}
        </div>
        <EvidencePanel
          title="Evidence"
          subtitle={selected ? `For ${selected.impacted_element_ref}` : "Select an impact to inspect its evidence."}
          refs={selected?.evidence_refs || []}
          emptyLabel={selected ? "This finding has no evidence yet." : "Pick a finding."}
        />
      </div>
    </div>
  );
}
