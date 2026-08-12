/**
 * AdrPanel (Phase 8) — capture Architecture Decision Records for feature
 * changes. Supports per-proposal drafting, an aggregate view across all
 * proposals, coverage strip, auto-draft from recommended alternative +
 * ripple/quality signals, and MADR Markdown export (zipped).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, Trash2, Sparkles, Download } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FeatureChange { id: string; title: string; is_active?: boolean }
interface Adr {
  id: string; number: number | null; title: string; status: string;
  context: string | null; decision: string | null; consequences: string | null;
  chosen_alternative_id: string | null; feature_change_id: string | null;
  created_at: string;
}
interface Alt {
  id: string; name: string; recommended: boolean; description: string | null;
  feature_change_id?: string; pros?: unknown; cons?: unknown;
}
interface RippleRow { feature_change_id: string; severity: string | null }
interface QualityRow { feature_change_id: string; attribute: string; direction: string; severity: string | null }

const ALL = "__all__";

const statusColor: Record<string, string> = {
  proposed: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  superseded: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

function toStrList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  return [];
}

function madr(a: Adr, fcTitle: string, altName: string | null): string {
  const num = String(a.number ?? 0).padStart(4, "0");
  const lines = [
    `# ADR-${num}: ${a.title}`,
    ``,
    `- **Status:** ${a.status}`,
    `- **Feature change:** ${fcTitle}`,
    altName ? `- **Chosen alternative:** ${altName}` : null,
    `- **Date:** ${new Date(a.created_at).toISOString().slice(0, 10)}`,
    ``,
    `## Context`,
    ``,
    a.context?.trim() || "_—_",
    ``,
    `## Decision`,
    ``,
    a.decision?.trim() || "_—_",
    ``,
    `## Consequences`,
    ``,
    a.consequences?.trim() || "_—_",
    ``,
  ].filter(Boolean);
  return lines.join("\n");
}

export default function AdrPanel({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [changes, setChanges] = useState<FeatureChange[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adrs, setAdrs] = useState<Adr[]>([]);
  const [alts, setAlts] = useState<Alt[]>([]);
  const [allAlts, setAllAlts] = useState<Alt[]>([]);
  const [ripple, setRipple] = useState<RippleRow[]>([]);
  const [quality, setQuality] = useState<QualityRow[]>([]);
  const [draft, setDraft] = useState<{ title: string; context: string; decision: string; consequences: string; chosen: string | null }>({
    title: "", context: "", decision: "", consequences: "", chosen: null,
  });
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "proposed" | "accepted" | "superseded">("all");

  const isAll = activeId === ALL;

  const loadChanges = useCallback(async () => {
    const { data } = await supabase.from("feature_changes").select("id,title,is_active")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    const list = ((data as FeatureChange[]) || []);
    setChanges(list);
    if (!activeId) {
      const active = list.find((c) => c.is_active) || list[0];
      if (active) setActiveId(active.id);
    }
  }, [projectId, activeId]);

  const loadAllAdrs = useCallback(async () => {
    const { data } = await supabase.from("adr_records").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    setAdrs((data as unknown as Adr[]) || []);
  }, [projectId]);

  const loadForChange = useCallback(async (fcId: string) => {
    const [{ data: a }, { data: al }] = await Promise.all([
      supabase.from("adr_records").select("*").eq("feature_change_id", fcId).order("created_at", { ascending: false }),
      supabase.from("architecture_alternatives").select("id,name,recommended,description,pros,cons")
        .eq("feature_change_id", fcId).order("recommended", { ascending: false }),
    ]);
    setAdrs((a as unknown as Adr[]) || []);
    setAlts((al as unknown as Alt[]) || []);
  }, []);

  const loadContext = useCallback(async () => {
    const [{ data: al }, { data: r }, { data: q }] = await Promise.all([
      supabase.from("architecture_alternatives").select("id,name,recommended,description,feature_change_id,pros,cons")
        .eq("project_id", projectId),
      supabase.from("impact_findings").select("feature_change_id,severity").eq("project_id", projectId),
      supabase.from("quality_impact_assessments").select("feature_change_id,attribute,direction,severity").eq("project_id", projectId),
    ]);
    setAllAlts((al as unknown as Alt[]) || []);
    setRipple((r as RippleRow[]) || []);
    setQuality((q as QualityRow[]) || []);
  }, [projectId]);

  useEffect(() => { void loadChanges(); void loadContext(); }, [loadChanges, loadContext]);
  useEffect(() => {
    if (!activeId) return;
    if (isAll) void loadAllAdrs();
    else void loadForChange(activeId);
  }, [activeId, isAll, loadAllAdrs, loadForChange]);

  // Coverage per proposal
  const coverage = useMemo(() => {
    const map: Record<string, { total: number; accepted: number }> = {};
    for (const c of changes) map[c.id] = { total: 0, accepted: 0 };
    if (isAll) {
      for (const a of adrs) {
        const k = a.feature_change_id ?? "";
        if (!map[k]) continue;
        map[k].total += 1;
        if (a.status === "accepted") map[k].accepted += 1;
      }
    }
    return map;
  }, [changes, adrs, isAll]);

  const perChangeTitle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of changes) m[c.id] = c.title;
    return m;
  }, [changes]);
  const altsById = useMemo(() => {
    const m: Record<string, Alt> = {};
    for (const a of allAlts) m[a.id] = a;
    return m;
  }, [allAlts]);

  const nextNumber = (adrs.reduce((mx, a) => Math.max(mx, a.number ?? 0), 0)) + 1;

  const autoDraft = () => {
    if (isAll || !activeId) return;
    const rec = alts.find((a) => a.recommended) ?? alts[0];
    if (!rec) return toast.error("No alternatives found for this proposal — generate them first.");
    const fcTitle = perChangeTitle[activeId] ?? "this change";
    const rippleForFc = ripple.filter((r) => r.feature_change_id === activeId);
    const highRipple = rippleForFc.filter((r) => r.severity === "critical" || r.severity === "high").length;
    const qualityForFc = quality.filter((q) => q.feature_change_id === activeId);
    const positives = qualityForFc.filter((q) => q.direction === "positive").map((q) => q.attribute);
    const negatives = qualityForFc.filter((q) => q.direction === "negative").map((q) => q.attribute);
    const pros = toStrList(rec.pros);
    const cons = toStrList(rec.cons);

    const context = [
      `Feature change: ${fcTitle}.`,
      rippleForFc.length ? `Ripple analysis surfaced ${rippleForFc.length} impacted element(s)${highRipple ? `, ${highRipple} at high/critical severity` : ""}.` : `No ripple findings recorded yet.`,
      qualityForFc.length ? `Quality impact touches: ${qualityForFc.map((q) => `${q.attribute} (${q.direction})`).join(", ")}.` : null,
    ].filter(Boolean).join(" ");

    const decision = [
      `Adopt "${rec.name}".`,
      rec.description ? rec.description.trim() : null,
    ].filter(Boolean).join(" ");

    const consequences = [
      positives.length ? `Improves: ${positives.join(", ")}.` : null,
      negatives.length ? `Trade-offs against: ${negatives.join(", ")}.` : null,
      pros.length ? `Pros — ${pros.slice(0, 4).join("; ")}.` : null,
      cons.length ? `Cons/risks — ${cons.slice(0, 4).join("; ")}.` : null,
      highRipple ? `Follow-up: address ${highRipple} high/critical ripple finding(s) before rollout.` : null,
    ].filter(Boolean).join(" ") || "—";

    setDraft({
      title: `Adopt: ${rec.name}`,
      chosen: rec.id,
      context,
      decision,
      consequences,
    });
    toast.success("Draft filled from recommended alternative");
  };

  const create = async () => {
    if (!activeId || isAll || !user || !draft.title.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("adr_records").insert({
      project_id: projectId, feature_change_id: activeId, created_by: user.id,
      chosen_alternative_id: draft.chosen, number: nextNumber,
      title: draft.title.trim(), status: "proposed",
      context: draft.context || null, decision: draft.decision || null,
      consequences: draft.consequences || null,
      alternatives_considered: alts.map((a) => ({ id: a.id, name: a.name, recommended: a.recommended })),
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("ADR drafted");
    setDraft({ title: "", context: "", decision: "", consequences: "", chosen: null });
    void loadForChange(activeId);
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("adr_records").update({ status }).eq("id", id);
    if (isAll) void loadAllAdrs();
    else if (activeId) void loadForChange(activeId);
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this ADR?")) return;
    await supabase.from("adr_records").delete().eq("id", id);
    if (isAll) void loadAllAdrs();
    else if (activeId) void loadForChange(activeId);
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const { data } = await supabase.from("adr_records").select("*")
        .eq("project_id", projectId).order("number", { ascending: true });
      const list = (data as unknown as Adr[]) || [];
      if (list.length === 0) { toast.error("No ADRs to export"); return; }
      const zip = new JSZip();
      const idx: string[] = ["# Architecture Decision Records", ""];
      for (const a of list) {
        const num = String(a.number ?? 0).padStart(4, "0");
        const fcTitle = perChangeTitle[a.feature_change_id ?? ""] ?? "Unknown";
        const altName = a.chosen_alternative_id ? altsById[a.chosen_alternative_id]?.name ?? null : null;
        const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
        const file = `adr-${num}-${slug || "record"}.md`;
        zip.file(file, madr(a, fcTitle, altName));
        idx.push(`- [ADR-${num}: ${a.title}](./${file}) — ${a.status} · ${fcTitle}`);
      }
      zip.file("README.md", idx.join("\n") + "\n");
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `adrs-${projectId.slice(0, 8)}.zip`);
      toast.success(`Exported ${list.length} ADR(s)`);
    } finally {
      setExporting(false);
    }
  };

  const filtered = statusFilter === "all" ? adrs : adrs.filter((a) => a.status === statusFilter);
  const grouped = useMemo(() => {
    const g: Record<string, Adr[]> = {};
    for (const a of filtered) {
      const k = a.feature_change_id ?? "orphan";
      (g[k] ||= []).push(a);
    }
    return g;
  }, [filtered]);

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Architecture Decision Records</h3>
        </div>
        <Button size="sm" variant="outline" onClick={exportAll} disabled={exporting}>
          <Download className="h-3 w-3 mr-1" /> Export MADR
        </Button>
      </div>

      {changes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a feature change first.</p>
      ) : (
        <>
          {/* Coverage strip */}
          <div className="rounded-lg border border-border/60 bg-background/60 p-2">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Coverage across proposals</span>
              <span>{Object.values(coverage).filter((c) => c.total > 0).length}/{changes.length} with ADRs</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveId(ALL)}
                className={"px-2 py-1 rounded-md text-[11px] border " + (isAll
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-background border-border hover:bg-muted")}
              >▦ All proposals</button>
              {changes.map((c) => {
                const cov = coverage[c.id] ?? { total: 0, accepted: 0 };
                const has = cov.total > 0;
                const allAccepted = has && cov.accepted === cov.total;
                const cls = activeId === c.id
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : allAccepted
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    : has
                      ? "bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                      : "bg-background border-border text-muted-foreground hover:bg-muted";
                return (
                  <button key={c.id} onClick={() => setActiveId(c.id)}
                    title={`${cov.total} ADR(s), ${cov.accepted} accepted`}
                    className={"px-2 py-1 rounded-md text-[11px] border " + cls}>
                    {c.title} <span className="opacity-70">· {cov.total}{cov.total > 0 ? ` (${cov.accepted}✓)` : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isAll ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Filter:</span>
                {(["all", "proposed", "accepted", "superseded"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={"px-2 py-0.5 rounded border " + (statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted")}>{s}</button>
                ))}
                <span className="ml-auto text-muted-foreground">{filtered.length} record(s)</span>
              </div>
              <div className="space-y-3">
                {Object.keys(grouped).length === 0 && (
                  <p className="text-xs text-muted-foreground">No ADRs match this filter.</p>
                )}
                {Object.entries(grouped).map(([fcId, list]) => (
                  <div key={fcId} className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {perChangeTitle[fcId] ?? "Unknown proposal"} · {list.length}
                    </div>
                    {list.map((a) => (
                      <AdrRow key={a.id} adr={a} altName={a.chosen_alternative_id ? altsById[a.chosen_alternative_id]?.name ?? null : null}
                        onStatus={setStatus} onRemove={remove} />
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">ADR-{String(nextNumber).padStart(4, "0")}</Badge>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Decision title" className="h-8 text-sm" />
                  <Button size="sm" variant="outline" onClick={autoDraft} disabled={alts.length === 0}
                    title="Fill from recommended alternative + ripple/quality signals">
                    <Sparkles className="h-3 w-3 mr-1" /> Auto-draft
                  </Button>
                </div>
                {alts.length > 0 && (
                  <select value={draft.chosen ?? ""} onChange={(e) => setDraft({ ...draft, chosen: e.target.value || null })}
                    className="w-full h-8 text-xs rounded border border-border bg-background px-2">
                    <option value="">— No linked alternative —</option>
                    {alts.map((a) => <option key={a.id} value={a.id}>{a.recommended ? "★ " : ""}{a.name}</option>)}
                  </select>
                )}
                <Textarea value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })}
                  placeholder="Context — what problem/forces led here?" className="text-xs" rows={2} />
                <Textarea value={draft.decision} onChange={(e) => setDraft({ ...draft, decision: e.target.value })}
                  placeholder="Decision — what we will do." className="text-xs" rows={2} />
                <Textarea value={draft.consequences} onChange={(e) => setDraft({ ...draft, consequences: e.target.value })}
                  placeholder="Consequences — trade-offs, follow-ups, risks." className="text-xs" rows={2} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={create} disabled={creating || !draft.title.trim()}>
                    <Plus className="h-3 w-3 mr-1" /> Draft ADR
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {adrs.length === 0 ? <p className="text-xs text-muted-foreground">No ADRs yet.</p> :
                  adrs.map((a) => (
                    <AdrRow key={a.id} adr={a}
                      altName={a.chosen_alternative_id ? (alts.find((x) => x.id === a.chosen_alternative_id)?.name ?? null) : null}
                      onStatus={setStatus} onRemove={remove} />
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AdrRow({ adr: a, altName, onStatus, onRemove }: {
  adr: Adr; altName: string | null;
  onStatus: (id: string, status: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">ADR-{String(a.number ?? 0).padStart(4, "0")}</Badge>
            <span className="font-medium text-sm truncate">{a.title}</span>
            <Badge className={"text-[10px] " + (statusColor[a.status] || "")}>{a.status}</Badge>
            {altName && <Badge variant="outline" className="text-[10px]">★ {altName}</Badge>}
          </div>
          {a.context && <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Context:</span> {a.context}</p>}
          {a.decision && <p className="text-xs mt-1"><span className="font-medium">Decision:</span> {a.decision}</p>}
          {a.consequences && <p className="text-xs mt-1"><span className="font-medium">Consequences:</span> {a.consequences}</p>}
        </div>
        <div className="flex flex-col gap-1">
          {a.status !== "accepted" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(a.id, "accepted")}>Accept</Button>
          )}
          {a.status === "accepted" && (
            <Button size="sm" variant="outline" onClick={() => onStatus(a.id, "superseded")}>Supersede</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onRemove(a.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
