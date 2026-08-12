import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Edit3,
  Filter,
  Keyboard,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import StudioLayout from "@/layouts/StudioLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRequirements } from "@/features/requirements/hooks";

/* -------------------- Types -------------------- */

type Decision = "keep" | "edit" | "drop";
type Sev = "critical" | "high" | "medium" | "low" | "none";
type QualityKey = "clarity" | "testability" | "completeness" | "consistency" | "feasibility";

type Urgency = "immediate" | "soon" | "later" | "future";

interface ReqRow {
  id: string;
  requirement_id: string;
  title: string;
  description: string | null;
  priority: string;
  type: string;
  status: string;
  source: string | null;
  acceptance_criteria: any;
  category?: string | null;
  urgency?: Urgency | null;
}

const URGENCY_OPTIONS: { key: Urgency; label: string; hint: string; cls: string }[] = [
  { key: "immediate", label: "Immediate", hint: "Now — release-blocking",     cls: "bg-rose-500/10  text-rose-600  dark:text-rose-400  border-rose-500/40" },
  { key: "soon",      label: "Soon",      hint: "Within the next iteration",   cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40" },
  { key: "later",     label: "Later",     hint: "Planned, not time-critical",  cls: "bg-sky-500/10   text-sky-600   dark:text-sky-400   border-sky-500/40" },
  { key: "future",    label: "Future",    hint: "Backlog / future release",    cls: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/40" },
];
const URGENCY_META: Record<Urgency, { label: string; cls: string }> =
  Object.fromEntries(URGENCY_OPTIONS.map(o => [o.key, { label: o.label, cls: o.cls }])) as any;

interface Review {
  id: string;
  target_key: string;
  severity: string;
  verdict: string;
  rationale: string | null;
  suggested_rewrite: string | null;
}

type FilterKey = "all" | "blocking" | "review" | "approved" | "draft";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "blocking", label: "Blocking" },
  { key: "review", label: "Needs review" },
  { key: "approved", label: "Approved" },
  { key: "draft", label: "Draft" },
];

const QUALITY_KEYS: QualityKey[] = ["clarity", "testability", "completeness", "consistency", "feasibility"];
const QUALITY_LABELS: Record<QualityKey, string> = {
  clarity: "Clarity",
  testability: "Testability",
  completeness: "Completeness",
  consistency: "Consistency",
  feasibility: "Feasibility",
};

/* -------------------- Page -------------------- */

export default function StudioRequirementsReview() {
  const { projectId } = useParams<{ projectId: string }>();
  const nav = useNavigate();
  const { user } = useAuth();

  const [projectName, setProjectName] = useState("");
  const [currentStage, setCurrentStage] = useState(2);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | Urgency>("all");
  const [sortKey, setSortKey] = useState<"id" | "priority" | "severity" | "type" | "urgency">("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [locking, setLocking] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [lockOpen, setLockOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const reqQuery = useRequirements(projectId);
  const requirements = (reqQuery.data ?? []) as ReqRow[];

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [{ data: proj }, { data: rvs }] = await Promise.all([
        supabase.from("projects").select("name, current_stage").eq("id", projectId).single(),
        supabase
          .from("requirement_reviews")
          .select("id, target_key, severity, verdict, rationale, suggested_rewrite")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
      ]);
      if (proj) {
        setProjectName(proj.name);
        setCurrentStage(proj.current_stage);
      }
      setReviews((rvs as Review[]) ?? []);
    })();
  }, [projectId]);

  const reviewByReq = useMemo(() => {
    const m = new Map<string, Review>();
    for (const r of reviews) if (!m.has(r.target_key)) m.set(r.target_key, r);
    return m;
  }, [reviews]);

  const enriched = useMemo(() => {
    return requirements.map((r) => {
      const rv = reviewByReq.get(r.requirement_id);
      const sev = normSeverity(rv);
      const quality = qualityForReview(rv);
      const qualityScore = quality.reduce((a, b) => a + b, 0) / quality.length; // 0..1
      const decision = decisions[r.requirement_id];
      const rowStatus: FilterKey =
        decision === "keep" ? "approved" :
        decision === "drop" ? "approved" :
        sev === "critical" ? "blocking" :
        sev === "high" || sev === "medium" ? "review" :
        rv ? "approved" : "draft";
      return { req: r, review: rv, sev, quality, qualityScore, decision, rowStatus };
    });
  }, [requirements, reviewByReq, decisions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = enriched.filter((e) => {
      if (filter !== "all" && e.rowStatus !== filter) return false;
      if (urgencyFilter !== "all" && (e.req.urgency ?? "") !== urgencyFilter) return false;
      if (!q) return true;
      return (
        e.req.requirement_id.toLowerCase().includes(q) ||
        e.req.title.toLowerCase().includes(q) ||
        (e.req.description ?? "").toLowerCase().includes(q)
      );
    });
    const sevRank: Record<Sev, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    const priRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const urgRank: Record<Urgency, number> = { immediate: 4, soon: 3, later: 2, future: 1 };
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "id") cmp = a.req.requirement_id.localeCompare(b.req.requirement_id, undefined, { numeric: true });
      else if (sortKey === "priority") cmp = (priRank[b.req.priority?.toLowerCase()] ?? 0) - (priRank[a.req.priority?.toLowerCase()] ?? 0);
      else if (sortKey === "severity") cmp = sevRank[b.sev] - sevRank[a.sev];
      else if (sortKey === "type") cmp = a.req.type.localeCompare(b.req.type);
      else if (sortKey === "urgency") cmp = (urgRank[(b.req.urgency as Urgency) ?? "future"] ?? 0) - (urgRank[(a.req.urgency as Urgency) ?? "future"] ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [enriched, filter, urgencyFilter, query, sortKey, sortDir]);

  useEffect(() => {
    if (!selectedId && filtered.length) setSelectedId(filtered[0].req.id);
  }, [filtered, selectedId]);

  const selected = useMemo(() => enriched.find((e) => e.req.id === selectedId), [enriched, selectedId]);

  const counts = useMemo(() => {
    let blocking = 0, review = 0, approved = 0, draft = 0;
    for (const e of enriched) {
      if (e.rowStatus === "blocking") blocking++;
      else if (e.rowStatus === "review") review++;
      else if (e.rowStatus === "approved") approved++;
      else draft++;
    }
    return { blocking, review, approved, draft, total: enriched.length };
  }, [enriched]);

  const healthScore = useMemo(() => {
    if (enriched.length === 0) return 0;
    const sum = enriched.reduce((acc, e) => acc + (e.decision === "drop" ? 1 : e.decision ? 0.95 : e.qualityScore), 0);
    return Math.round((sum / enriched.length) * 100);
  }, [enriched]);

  const canLock = counts.total > 0 && counts.blocking === 0;

  /* ---- actions ---- */

  const setDecision = useCallback((rid: string, d: Decision) => {
    setDecisions((prev) => ({ ...prev, [rid]: d }));
  }, []);

  const moveSelection = useCallback((delta: number) => {
    const idx = filtered.findIndex((e) => e.req.id === selectedId);
    const next = Math.max(0, Math.min(filtered.length - 1, idx + delta));
    setSelectedId(filtered[next]?.req.id ?? null);
  }, [filtered, selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "?") setShowShortcuts((s) => !s);
      else if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); moveSelection(1); }
      else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); moveSelection(-1); }
      else if (selected && (e.key === "a" || e.key === "A")) setDecision(selected.req.id, "keep");
      else if (selected && (e.key === "r" || e.key === "R")) setDecision(selected.req.id, "drop");
      else if (selected && (e.key === "e" || e.key === "E")) setDecision(selected.req.id, "edit");
      else if (e.key === "l" || e.key === "L") { if (canLock) setLockOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveSelection, selected, setDecision, canLock]);

  const bulkApply = useCallback((d: Decision) => {
    if (!checked.size) return;
    const next = { ...decisions };
    for (const id of checked) {
      const r = requirements.find((x) => x.id === id);
      if (r) next[r.requirement_id] = d;
    }
    setDecisions(next);
    setChecked(new Set());
    toast.success(`${d === "keep" ? "Approved" : d === "drop" ? "Dropped" : "Marked for edit"} ${checked.size} rows`);
  }, [checked, decisions, requirements]);

  async function handleLock() {
    if (!user || !projectId) return;
    if (confirmName.trim() !== projectName.trim()) {
      toast.error("Type the project name exactly to confirm.");
      return;
    }
    setLocking(true);
    try {
      for (const r of requirements) {
        const d = decisions[r.requirement_id];
        if (d === "drop") {
          await supabase.from("requirements").update({ status: "deferred" as any }).eq("id", r.id);
        } else if (d === "edit" && edits[r.requirement_id]?.trim()) {
          await supabase.from("requirements").update({ description: edits[r.requirement_id] }).eq("id", r.id);
        }
      }
      const reviewIds = reviews.map((r) => r.id);
      if (reviewIds.length) {
        await supabase
          .from("requirement_reviews")
          .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
          .in("id", reviewIds);
      }
      const dropped = Object.values(decisions).filter((d) => d === "drop").length;
      const edited = Object.values(decisions).filter((d) => d === "edit").length;
      await supabase.from("stage_approvals").insert({
        project_id: projectId,
        stage: currentStage,
        action: "locked",
        actor_id: user.id,
        justification: `Studio console lock — ${counts.total - dropped} kept, ${dropped} dropped, ${edited} edited.`,
      } as any);
      await supabase.from("projects").update({ current_stage: Math.max(currentStage + 1, 3) }).eq("id", projectId);
      toast.success("Requirements baseline sealed.");
      nav(`/studio/project/${projectId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to lock");
    } finally {
      setLocking(false);
    }
  }

  async function runCritic() {
    if (!projectId) return;
    toast.loading("Re-running requirement critic…", { id: "critic" });
    try {
      await supabase.functions.invoke("critic-agent", {
        body: { project_id: projectId, stage: currentStage },
      });
      toast.success("Critic queued. Refresh in ~1 minute.", { id: "critic" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to invoke critic", { id: "critic" });
    }
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleExpand = useCallback((rid: string, forceOpen = false) => {
    setExpanded((prev) => {
      const nx = new Set(prev);
      if (nx.has(rid) && !forceOpen) nx.delete(rid);
      else nx.add(rid);
      return nx;
    });
  }, []);

  const saveRevision = useCallback(async (row: ReqRow) => {
    const next = edits[row.requirement_id];
    if (next == null || next.trim() === (row.description ?? "").trim()) {
      toast.info("No changes to save.");
      return;
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("requirements")
      .update({ description: next })
      .eq("id", row.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.requirement_id} revised`);
    setDecisions((p) => ({ ...p, [row.requirement_id]: "keep" }));
    reqQuery.refetch?.();
  }, [edits, reqQuery]);

  const setUrgency = useCallback(async (row: ReqRow, u: Urgency | null) => {
    const { error } = await supabase
      .from("requirements")
      .update({ urgency: u } as any)
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.requirement_id} · urgency ${u ?? "cleared"}`);
    reqQuery.refetch?.();
  }, [reqQuery]);

  return (
    <StudioLayout
      crumb={`${projectName || "Requirements"} · Console`}
      backTo={`/studio/project/${projectId}`}
      projectId={projectId}
      currentStage={currentStage}
      console
    >
      {/* Toolbar */}
      <div className="border-y border-border bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search id, title, description…   /"
              className="h-8 pl-8 w-72 font-mono text-xs bg-background"
            />
          </div>

          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <Filter className="h-3 w-3 text-muted-foreground ml-1.5" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-2 py-1 text-[11px] rounded transition-colors",
                  filter === f.key
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
                {f.key === "blocking" && counts.blocking > 0 && (
                  <span className="ml-1 text-rose-500">·{counts.blocking}</span>
                )}
                {f.key === "review" && counts.review > 0 && (
                  <span className="ml-1 text-amber-500">·{counts.review}</span>
                )}
              </button>
            ))}
          </div>

          {/* Urgency filter */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1.5">Urgency</span>
            <button
              onClick={() => setUrgencyFilter("all")}
              className={cn(
                "px-2 py-1 text-[11px] rounded transition-colors",
                urgencyFilter === "all" ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {URGENCY_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => setUrgencyFilter(o.key)}
                className={cn(
                  "px-2 py-1 text-[11px] rounded transition-colors",
                  urgencyFilter === o.key ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
                )}
                title={o.hint}
              >
                {o.label}
              </button>
            ))}
          </div>

          {checked.size > 0 && (
            <div className="flex items-center gap-1 pl-2 border-l border-border ml-2">
              <span className="text-[11px] text-muted-foreground mr-1">{checked.size} selected:</span>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => bulkApply("keep")}>
                <Check className="h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => bulkApply("edit")}>
                <Edit3 className="h-3 w-3" /> Rewrite
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-rose-600" onClick={() => bulkApply("drop")}>
                <Trash2 className="h-3 w-3" /> Drop
              </Button>
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground ml-1.5" />
            {([
              { key: "id" as const, label: "ID" },
              { key: "priority" as const, label: "Priority" },
              { key: "severity" as const, label: "Severity" },
              { key: "urgency" as const, label: "Urgency" },
              { key: "type" as const, label: "Type" },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSort(s.key)}
                className={cn(
                  "px-2 py-1 text-[11px] rounded transition-colors flex items-center gap-1",
                  sortKey === s.key ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
                {sortKey === s.key && (
                  <span className="font-mono text-[9px] opacity-70">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{filtered.length}/{counts.total}</span>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={runCritic}>
              <RefreshCw className="h-3 w-3" /> Re-run critic
            </Button>
          </div>
        </div>
      </div>

      {/* Split: grid + detail pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_540px] min-h-[calc(100vh-190px)]">
        {/* --- LEFT: INDUSTRIAL PRECISION CARDS --- */}
        <div className="border-r border-border overflow-y-auto max-h-[calc(100vh-190px)] bg-muted/20">
          {/* Header block: bold count */}
          <div className="flex items-end justify-between px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Review Queue
              </h2>
              <p className="text-3xl font-black text-foreground leading-none mt-1.5">
                {filtered.length}
                <span className="text-muted-foreground font-normal text-lg ml-2">
                  {filtered.length === 1 ? "item" : "items"} / {counts.total}
                </span>
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={checked.size > 0 && checked.size === filtered.length}
                onChange={(e) => setChecked(e.target.checked ? new Set(filtered.map((f) => f.req.id)) : new Set())}
                className="h-3 w-3 accent-foreground"
              />
              Select all
            </label>
          </div>
          <QualityLegend />

          <div className="px-5 pb-5 space-y-3">

            {filtered.map((e) => {
              const isSel = e.req.id === selectedId;
              const priKey = (e.req.priority || "medium").toLowerCase();
              const barCls = priorityBar(priKey);
              const dotCls = priorityDot(priKey);
              const priLabel = priorityLabel(priKey);
              const isCritical = priKey === "critical" || e.sev === "critical";
              const isRowChecked = checked.has(e.req.id);

              const frameCls = isSel
                ? "border-2 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))]"
                : isCritical
                ? "border-2 border-foreground/80 shadow-[3px_3px_0px_0px_hsl(var(--foreground)/0.85)]"
                : e.rowStatus === "review"
                ? "border border-amber-400/60 shadow-sm"
                : "border border-border shadow-sm";

              const idChipCls = isCritical
                ? "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/40"
                : "text-muted-foreground bg-background border-border";

              return (
                <div
                  key={e.req.id}
                  onClick={() => setSelectedId(e.req.id)}
                  className={cn(
                    "group relative bg-card rounded-xl overflow-hidden cursor-pointer transition-all",
                    frameCls,
                  )}
                >
                  {/* Priority bar */}
                  <div className={cn("absolute left-0 top-0 bottom-0", barCls)} />

                  <div className="pl-5 pr-4 py-4">
                    {/* Meta row */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isRowChecked}
                          onClick={(ev) => ev.stopPropagation()}
                          onChange={(ev) => {
                            const nx = new Set(checked);
                            ev.target.checked ? nx.add(e.req.id) : nx.delete(e.req.id);
                            setChecked(nx);
                          }}
                          className="h-3 w-3 accent-foreground flex-shrink-0"
                        />
                        <button
                          onClick={(ev) => { ev.stopPropagation(); toggleExpand(e.req.id); }}
                          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={expanded.has(e.req.id) ? "Collapse details" : "Expand details"}
                          title={expanded.has(e.req.id) ? "Hide details" : "Show details"}
                        >
                          {expanded.has(e.req.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <span
                          className={cn(
                            "font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase whitespace-nowrap",
                            idChipCls,
                          )}
                        >
                          {e.req.requirement_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                        <UrgencyBadge urgency={(e.req as any).urgency ?? null} />
                        <span className="truncate">{e.req.type.replace(/_/g, " ")}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-[14px] font-bold text-foreground leading-snug mb-3">
                      {e.req.title}
                    </h3>

                    {/* Quality bar (compact) */}
                    <div className="mb-3">
                      <QualityBar segments={e.quality} />
                    </div>

                    {/* Expanded inline details */}
                    {expanded.has(e.req.id) && (
                      <ExpandedDetails
                        req={e.req}
                        review={e.review}
                        editing={e.decision === "edit"}
                        editValue={edits[e.req.requirement_id] ?? e.req.description ?? ""}
                        onEditChange={(v) => setEdits((p) => ({ ...p, [e.req.requirement_id]: v }))}
                        onSave={() => saveRevision(e.req)}
                        onCancelEdit={() => {
                          setEdits((p) => { const nx = { ...p }; delete nx[e.req.requirement_id]; return nx; });
                          setDecision(e.req.requirement_id, "keep");
                        }}
                        saving={savingId === e.req.id}
                        onUrgency={(u) => setUrgency(e.req, u)}
                      />
                    )}

                    {/* Footer: priority + status + decision */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/70">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-2 w-2 rounded-full", dotCls)} />
                          <span className="text-[10.5px] font-bold text-foreground uppercase tracking-wide">
                            {priLabel}
                          </span>
                        </div>
                        <StudioStatusChip status={e.rowStatus} />
                      </div>

                      <div className="flex items-center gap-1.5">
                        {e.decision && (
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              e.decision === "keep" && "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
                              e.decision === "edit" && "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
                              e.decision === "drop" && "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10 line-through",
                            )}
                          >
                            {e.decision}
                          </span>
                        )}
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setDecision(e.req.requirement_id, "edit");
                            toggleExpand(e.req.id, true);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-border text-foreground rounded-md active:scale-95 transition-transform hover:bg-muted"
                          title="Revise wording"
                        >
                          Revise
                        </button>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleExpand(e.req.id);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-border text-foreground rounded-md active:scale-95 transition-transform hover:bg-muted"
                        >
                          {expanded.has(e.req.id) ? "Hide" : "Details"}
                        </button>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setDecision(e.req.requirement_id, "keep");
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-foreground text-background rounded-md active:scale-95 transition-transform hover:bg-foreground/90"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                No requirements match the current filter.
              </div>
            )}
          </div>
        </div>


        {/* --- RIGHT: DETAIL PANE --- */}
        <aside className="bg-card/40 overflow-y-auto max-h-[calc(100vh-190px)]">
          {selected ? (
            <DetailPane
              row={selected}
              editValue={edits[selected.req.requirement_id] ?? selected.req.description ?? ""}
              onEditChange={(v) => setEdits((p) => ({ ...p, [selected.req.requirement_id]: v }))}
              onDecision={(d) => setDecision(selected.req.requirement_id, d)}
            />
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">Select a requirement.</div>
          )}
        </aside>
      </div>

      {/* Bottom status bar */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex items-center gap-6 px-4 py-2.5 text-[12px]">
          <StatusPill dot="bg-rose-500" label="Blocking" value={counts.blocking} />
          <StatusPill dot="bg-amber-500" label="Needs review" value={counts.review} />
          <StatusPill dot="bg-emerald-500" label="Approved" value={counts.approved} />
          <StatusPill dot="bg-slate-400" label="Draft" value={counts.draft} />
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border">
            <span className="text-muted-foreground text-[11px] uppercase tracking-wider">Baseline health</span>
            <span className="font-mono font-semibold">{healthScore}</span>
            <MiniHealthBar value={healthScore} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowShortcuts((s) => !s)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Keyboard className="h-3 w-3" /> Shortcuts
            </button>
            <Button
              size="sm"
              className="gap-2 h-8"
              disabled={!canLock}
              onClick={() => setLockOpen(true)}
              title={!canLock ? `${counts.blocking} blocking issues unresolved` : "Lock baseline and advance"}
            >
              <Lock className="h-3.5 w-3.5" />
              {canLock ? "Lock baseline & advance" : `${counts.blocking} blocking unresolved`}
            </Button>
          </div>
        </div>
      </div>

      {/* Shortcut palette */}
      {showShortcuts && (
        <div className="fixed bottom-16 right-6 z-40 rounded-md border border-border bg-card p-4 shadow-lg text-xs w-64">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Keyboard</span>
            <button onClick={() => setShowShortcuts(false)}><X className="h-3 w-3" /></button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-[11px]">
            <dt>↑ ↓ / j k</dt><dd className="text-muted-foreground">Move row</dd>
            <dt>/</dt><dd className="text-muted-foreground">Focus search</dd>
            <dt>A</dt><dd className="text-muted-foreground">Approve selected</dd>
            <dt>E</dt><dd className="text-muted-foreground">Mark for rewrite</dd>
            <dt>R</dt><dd className="text-muted-foreground">Drop selected</dd>
            <dt>L</dt><dd className="text-muted-foreground">Lock baseline</dd>
            <dt>?</dt><dd className="text-muted-foreground">Toggle this</dd>
          </dl>
        </div>
      )}

      {/* Lock confirm modal */}
      {lockOpen && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => !locking && setLockOpen(false)}>
          <div className="w-full max-w-md rounded-md border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4 text-primary" /> Lock requirements baseline
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This seals the current requirements as an immutable baseline and unlocks the Architecture Design phase.
                Dropped and rewritten items are persisted.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Approved" value={counts.approved} tone="text-emerald-500" />
                <MiniStat label="Review" value={counts.review} tone="text-amber-500" />
                <MiniStat label="Blocking" value={counts.blocking} tone="text-rose-500" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Type <span className="font-mono text-foreground">{projectName}</span> to confirm
                </label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  className="mt-1 h-8 font-mono text-xs"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => setLockOpen(false)} disabled={locking}>Cancel</Button>
              <Button size="sm" onClick={handleLock} disabled={locking || confirmName.trim() !== projectName.trim()}>
                {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Seal baseline
              </Button>
            </div>
          </div>
        </div>
      )}
    </StudioLayout>
  );
}

/* -------------------- Detail Pane -------------------- */

function DetailPane({
  row, editValue, onEditChange, onDecision,
}: {
  row: ReturnType<typeof enrichSignature>;
  editValue: string;
  onEditChange: (v: string) => void;
  onDecision: (d: Decision) => void;
}) {
  const { req, review, sev, quality, decision } = row;
  const [tab, setTab] = useState<"detail" | "quality" | "history">("detail");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span>{req.requirement_id}</span>
          <span>·</span>
          <TypeChip type={req.type} />
          <PriorityChip priority={req.priority} />
          <SeverityDot sev={sev} withLabel />
          <span className="ml-auto text-[10px] uppercase tracking-wider">
            {decision ? <span className={decision === "drop" ? "text-rose-500" : decision === "edit" ? "text-amber-500" : "text-emerald-500"}>· {decision}</span> : "no decision"}
          </span>
        </div>
        <h2 className="text-[15px] font-semibold text-foreground mt-1.5 leading-snug">{req.title}</h2>

        <div className="flex items-center gap-1 mt-3 border-b border-border/60 -mb-3">
          {(["detail", "quality", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors border-b-2",
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-[13px] leading-relaxed">
        {tab === "detail" && (
          <>
            <Section title="Statement">
              <p className="text-foreground/90 whitespace-pre-wrap">{req.description || <em className="text-muted-foreground">No description.</em>}</p>
            </Section>
            {review && (
              <Section title="Critic verdict" tone="amber">
                <p className="text-foreground/90 whitespace-pre-wrap">{review.rationale ?? review.verdict}</p>
                {review.suggested_rewrite && (
                  <div className="mt-3 rounded-sm border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">Suggested rewrite</p>
                    <p className="text-foreground/90 whitespace-pre-wrap">{review.suggested_rewrite}</p>
                  </div>
                )}
              </Section>
            )}
            {decision === "edit" && (
              <Section title="Rewrite">
                <Textarea
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  rows={5}
                  className="font-mono text-[12px]"
                />
              </Section>
            )}
          </>
        )}

        {tab === "quality" && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              ISO 29148 + INCOSE dimensions
            </p>
            <table className="w-full text-[12px]">
              <tbody>
                {QUALITY_KEYS.map((k, i) => {
                  const v = quality[i];
                  return (
                    <tr key={k} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground w-32">{QUALITY_LABELS[k]}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                v >= 0.8 ? "bg-emerald-500" : v >= 0.5 ? "bg-amber-500" : "bg-rose-500",
                              )}
                              style={{ width: `${Math.round(v * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] w-8 text-right">{Math.round(v * 100)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "history" && (
          <div className="text-[12px] text-muted-foreground">
            <p>No baseline snapshots yet. History appears here once you lock a baseline.</p>
          </div>
        )}
      </div>

      {/* Decision footer */}
      <div className="border-t border-border p-3 bg-muted/20">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={decision === "keep" ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1.5", decision === "keep" && "bg-emerald-600 hover:bg-emerald-600/90 text-white")}
            onClick={() => onDecision("keep")}
          >
            <Check className="h-3.5 w-3.5" /> Approve <kbd className="ml-1 text-[9px] opacity-60 font-mono">A</kbd>
          </Button>
          <Button
            variant={decision === "edit" ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1.5", decision === "edit" && "bg-amber-500 hover:bg-amber-500/90 text-black")}
            onClick={() => onDecision("edit")}
          >
            <Edit3 className="h-3.5 w-3.5" /> Rewrite <kbd className="ml-1 text-[9px] opacity-60 font-mono">E</kbd>
          </Button>
          <Button
            variant={decision === "drop" ? "default" : "outline"}
            size="sm"
            className={cn("h-8 gap-1.5", decision === "drop" && "bg-rose-600 hover:bg-rose-600/90 text-white")}
            onClick={() => onDecision("drop")}
          >
            <Trash2 className="h-3.5 w-3.5" /> Drop <kbd className="ml-1 text-[9px] opacity-60 font-mono">R</kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}

// Type helper for the row shape (satisfies the compiler for `DetailPane`'s prop typing)
function enrichSignature() {
  return {} as {
    req: ReqRow;
    review?: Review;
    sev: Sev;
    quality: number[];
    qualityScore: number;
    decision?: Decision;
    rowStatus: FilterKey;
  };
}

/* -------------------- Expanded card details -------------------- */

function ExpandedDetails({
  req, review, editing, editValue, onEditChange, onSave, onCancelEdit, saving, onUrgency,
}: {
  req: ReqRow;
  review?: Review;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  saving: boolean;
  onUrgency: (u: Urgency | null) => void;
}) {
  const criteria: string[] = Array.isArray(req.acceptance_criteria)
    ? req.acceptance_criteria.filter((x) => typeof x === "string")
    : [];
  const currentUrgency = ((req as any).urgency ?? null) as Urgency | null;
  return (
    <div
      className="mb-3 rounded-lg border border-border bg-muted/30 p-3.5 space-y-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Urgency <span className="text-muted-foreground/70 normal-case font-normal tracking-normal">— when it must ship (separate from priority)</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {URGENCY_OPTIONS.map((o) => {
            const active = currentUrgency === o.key;
            return (
              <button
                key={o.key}
                onClick={() => onUrgency(active ? null : o.key)}
                title={o.hint}
                className={cn(
                  "px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors",
                  active ? o.cls : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {o.label}
              </button>
            );
          })}
          {currentUrgency && (
            <button
              onClick={() => onUrgency(null)}
              className="px-2 py-1 rounded-md text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Statement
        </p>
        {editing ? (
          <p className="text-[12.5px] text-muted-foreground italic">
            Editing below — the current statement will be replaced on save.
          </p>
        ) : (
          <p className="text-[12.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {req.description?.trim() || <em className="text-muted-foreground">No description recorded. Use Revise to add one.</em>}
          </p>
        )}
      </div>

      {criteria.length > 0 && !editing && (
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Acceptance criteria
          </p>
          <ul className="space-y-1">
            {criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/90 leading-relaxed">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review?.rationale && !editing && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50/50 dark:bg-amber-500/5 p-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
            Critic verdict · {review.severity ?? "info"}
          </p>
          <p className="text-[12px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {review.rationale}
          </p>
          {review.suggested_rewrite && (
            <button
              onClick={() => onEditChange(review.suggested_rewrite!)}
              className="mt-2 text-[10.5px] font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              Use suggested rewrite →
            </button>
          )}
        </div>
      )}

      {editing && (
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Revise statement
          </p>
          <Textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            rows={5}
            className="text-[12.5px] leading-relaxed"
            placeholder="Rewrite so it is specific, measurable, and testable (ISO 29148 / INCOSE)."
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save revision
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}



function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("py-2 px-2 text-left font-medium border-b border-border", className)}>{children}</th>;
}
function ThSort({
  label, k, active, dir, onClick, width,
}: { label: string; k: string; active: string; dir: string; onClick: () => void; width?: string }) {
  return (
    <th className={cn("py-2 px-2 text-left font-medium border-b border-border cursor-pointer select-none", width)} onClick={onClick}>
      <span className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className={cn("h-2.5 w-2.5", active === k ? "opacity-100" : "opacity-30")} />
        {active === k && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("py-1.5 px-2 align-middle", className)}>{children}</td>;
}

function TypeChip({ type }: { type: string }) {
  const t = (type ?? "").toLowerCase();
  const isNFR = t.includes("non") || t === "nfr";
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded-sm border font-mono text-[10px] uppercase",
      isNFR ? "border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/5" : "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/5",
    )}>
      {isNFR ? "NFR" : "FR"}
    </span>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const p = (priority ?? "").toLowerCase();
  const map: Record<string, string> = {
    critical: "text-rose-600 dark:text-rose-400",
    high: "text-amber-600 dark:text-amber-400",
    medium: "text-sky-600 dark:text-sky-400",
    low: "text-muted-foreground",
  };
  const short = p === "critical" ? "P0" : p === "high" ? "P1" : p === "medium" ? "P2" : p === "low" ? "P3" : "—";
  return <span className={cn("font-mono text-[11px] font-semibold", map[p] ?? "text-muted-foreground")}>{short}</span>;
}

function UrgencyBadge({ urgency }: { urgency: Urgency | null }) {
  if (!urgency) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-dashed border-border text-muted-foreground/70 text-[9.5px] font-bold uppercase tracking-wider">
        No urgency
      </span>
    );
  }
  const m = URGENCY_META[urgency];
  return (
    <span
      title={`Urgency: ${m.label}`}
      className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[9.5px] font-bold uppercase tracking-wider", m.cls)}
    >
      ⏱ {m.label}
    </span>
  );
}

function SeverityDot({ sev, withLabel = false }: { sev: Sev; withLabel?: boolean }) {
  const map: Record<Sev, { c: string; l: string }> = {
    critical: { c: "bg-rose-500", l: "Critical" },
    high: { c: "bg-amber-500", l: "High" },
    medium: { c: "bg-yellow-500", l: "Medium" },
    low: { c: "bg-emerald-500", l: "Low" },
    none: { c: "bg-muted-foreground/30", l: "—" },
  };
  const s = map[sev];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", s.c)} />
      {withLabel && <span className="text-[11px] text-muted-foreground">{s.l}</span>}
    </span>
  );
}

const QUALITY_INITIALS: Record<QualityKey, string> = {
  clarity: "C",
  testability: "T",
  completeness: "M",
  consistency: "X",
  feasibility: "F",
};

function QualityBar({ segments }: { segments: number[] }) {
  const avg = segments.length ? segments.reduce((a, b) => a + b, 0) / segments.length : 0;
  const pct = Math.round(avg * 100);
  const overall =
    avg >= 0.8 ? "text-emerald-600 dark:text-emerald-400"
    : avg >= 0.5 ? "text-amber-600 dark:text-amber-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
        Quality
      </span>
      <div className="flex items-center gap-[2px]">
        {segments.map((v, i) => {
          const k = QUALITY_KEYS[i];
          const cls =
            v >= 0.8 ? "bg-emerald-500 text-white border-emerald-600"
            : v >= 0.5 ? "bg-amber-500 text-white border-amber-600"
            : v > 0 ? "bg-rose-500 text-white border-rose-600"
            : "bg-muted text-muted-foreground border-border";
          return (
            <div
              key={i}
              className={cn(
                "h-4 w-4 rounded-[2px] border grid place-items-center font-mono text-[9px] font-bold leading-none",
                cls,
              )}
              title={`${QUALITY_LABELS[k]}: ${Math.round(v * 100)}%`}
              aria-label={`${QUALITY_LABELS[k]} ${Math.round(v * 100)} percent`}
            >
              {QUALITY_INITIALS[k]}
            </div>
          );
        })}
      </div>
      <span className={cn("text-[10px] font-bold tabular-nums", overall)}>{pct}%</span>
    </div>
  );
}

function QualityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-3 -mt-2">
      <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
        Quality dims
      </span>
      {QUALITY_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-3.5 w-3.5 rounded-[2px] border border-border bg-muted grid place-items-center font-mono text-[8.5px] font-bold text-foreground">
            {QUALITY_INITIALS[k]}
          </span>
          <span className="uppercase tracking-wide">{QUALITY_LABELS[k]}</span>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-2 text-[9.5px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" />Pass</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-amber-500" />Warn</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-rose-500" />Fail</span>
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: FilterKey }) {
  const map: Record<FilterKey, { c: string; l: string }> = {
    all: { c: "", l: "" },
    blocking: { c: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30", l: "Blocking" },
    review: { c: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", l: "Review" },
    approved: { c: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", l: "Approved" },
    draft: { c: "bg-muted text-muted-foreground border-border", l: "Draft" },
  };
  const s = map[status];
  return <span className={cn("inline-block px-1.5 py-0.5 rounded-sm border text-[10px] uppercase tracking-wider font-medium", s.c)}>{s.l}</span>;
}

// Alias for card-based industrial layout — same semantics as StatusChip.
function StudioStatusChip({ status }: { status: FilterKey }) {
  return <StatusChip status={status} />;
}

function priorityBar(p: string): string {
  switch (p) {
    case "critical": return "w-2 bg-rose-500";
    case "high": return "w-1.5 bg-amber-400";
    case "medium": return "w-1.5 bg-sky-400";
    case "low": return "w-1 bg-slate-300 dark:bg-slate-600";
    default: return "w-1 bg-slate-300 dark:bg-slate-600";
  }
}
function priorityDot(p: string): string {
  switch (p) {
    case "critical": return "bg-rose-500";
    case "high": return "bg-amber-400";
    case "medium": return "bg-sky-400";
    case "low": return "bg-slate-300 dark:bg-slate-600";
    default: return "bg-slate-300 dark:bg-slate-600";
  }
}
function priorityLabel(p: string): string {
  switch (p) {
    case "critical": return "Urgent";
    case "high": return "High";
    case "medium": return "Normal";
    case "low": return "Minor";
    default: return "Normal";
  }
}

function StatusPill({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      <span className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-sm border border-border p-2">
      <div className={cn("font-mono text-lg font-bold leading-none", tone)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function MiniHealthBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full transition-all",
          value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "amber" }) {
  return (
    <div>
      <p className={cn(
        "text-[10px] uppercase tracking-wider font-semibold mb-1.5",
        tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}>{title}</p>
      {children}
    </div>
  );
}

/* -------------------- Domain helpers -------------------- */

function normSeverity(rv?: Review): Sev {
  const s = (rv?.severity ?? "").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "none";
}

function qualityForReview(rv?: Review): number[] {
  // Base 1.0; deduct per matched concern per dimension.
  const base = [1, 1, 1, 1, 1];
  if (!rv || rv.verdict === "pass") return base;
  const txt = ((rv.rationale ?? "") + " " + (rv.verdict ?? "")).toLowerCase();
  const sev = normSeverity(rv);
  const penalty = sev === "critical" ? 0.75 : sev === "high" ? 0.55 : sev === "medium" ? 0.35 : 0.15;
  const hits: Record<QualityKey, boolean> = {
    clarity: /clar|ambigu|vague|unclear|confus/.test(txt),
    testability: /test|verif|measur|accept|criteri/.test(txt),
    completeness: /miss|incomplete|gap|absent|undefin/.test(txt),
    consistency: /conflict|contradic|inconsist|dupl/.test(txt),
    feasibility: /feasib|realistic|infeasible|cost|impossible|risk/.test(txt),
  };
  let anyHit = false;
  const out = base.slice();
  QUALITY_KEYS.forEach((k, i) => {
    if (hits[k]) { out[i] = Math.max(0, 1 - penalty); anyHit = true; }
  });
  if (!anyHit) {
    // generic penalty on clarity if we couldn't classify
    out[0] = Math.max(0, 1 - penalty * 0.7);
  }
  return out;
}
