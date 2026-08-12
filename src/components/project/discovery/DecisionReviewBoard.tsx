import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Scale,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  decisionSummary,
  normalizeDecisionVerdicts,
  patchHandoffDecisions,
  type AcceptanceCriterion,
  type DevHandoff,
  type HandoffAdr,
  type ItemVerdict,
} from "@/lib/devHandoff";

interface Props {
  handoff: DevHandoff;
  onPersist: (next: DevHandoff) => Promise<void>;
  onHandoffChange: (next: DevHandoff) => void;
  readOnly?: boolean;
}

type FocusTab = "adrs" | "acs";
type VerdictFilter = "pending" | "all" | "go" | "no_go";

const VERDICT_STYLE: Record<
  ItemVerdict,
  { label: string; row: string; chip: string }
> = {
  pending: {
    label: "Pending",
    row: "border-border bg-card",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  go: {
    label: "Go",
    row: "border-emerald-500/35 bg-emerald-500/[0.04]",
    chip: "bg-emerald-600 text-white",
  },
  no_go: {
    label: "No-go",
    row: "border-rose-500/35 bg-rose-500/[0.04]",
    chip: "bg-rose-600 text-white",
  },
  dropped: {
    label: "Dropped",
    row: "border-border bg-muted/40 opacity-70",
    chip: "bg-muted-foreground/20 text-muted-foreground line-through",
  },
};

function nextAcId(list: AcceptanceCriterion[]): string {
  const nums = list
    .map((c) => Number((c.id.match(/AC-(\d+)/i) || [])[1]))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `AC-${max + 1}`;
}

function nextAdrId(list: HandoffAdr[]): string {
  const nums = list
    .map((a) => Number((a.id.match(/ADR-CHANGE-(\d+)/i) || [])[1]))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `ADR-CHANGE-${String(max + 1).padStart(3, "0")}`;
}

function matchesFilter(verdict: ItemVerdict, filter: VerdictFilter, showDropped: boolean) {
  if (verdict === "dropped") return showDropped && filter === "all";
  if (filter === "all") return true;
  if (filter === "pending") return verdict === "pending";
  if (filter === "go") return verdict === "go";
  return verdict === "no_go";
}

function VerdictButtons({
  value,
  disabled,
  onChange,
}: {
  value: ItemVerdict;
  disabled?: boolean;
  onChange: (v: ItemVerdict) => void;
}) {
  const btn = (v: ItemVerdict, label: string, activeClass: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(v === value && v !== "pending" ? "pending" : v)}
      className={`h-7 px-2 rounded-md text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
        value === v
          ? activeClass
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1 shrink-0">
      {btn("go", "Go", "border-emerald-600 bg-emerald-600 text-white")}
      {btn("no_go", "No-go", "border-rose-600 bg-rose-600 text-white")}
      {btn("dropped", "Drop", "border-muted-foreground/40 bg-muted text-muted-foreground")}
    </div>
  );
}

export default function DecisionReviewBoard({
  handoff,
  onPersist,
  onHandoffChange,
  readOnly,
}: Props) {
  const normalized = useMemo(() => normalizeDecisionVerdicts(handoff), [handoff]);
  const summary = useMemo(() => decisionSummary(normalized), [normalized]);
  const [saving, setSaving] = useState(false);
  const [expandedAdr, setExpandedAdr] = useState<string | null>(null);
  const [editingAc, setEditingAc] = useState<string | null>(null);
  const [showDropped, setShowDropped] = useState(false);
  const [focus, setFocus] = useState<FocusTab>("acs");
  const [filter, setFilter] = useState<VerdictFilter>("pending");

  const locked = readOnly || handoff.status === "approved";

  const persist = async (
    patch: { adrs?: HandoffAdr[]; acceptanceCriteria?: AcceptanceCriterion[] },
    okMsg?: string,
  ) => {
    if (locked) return;
    setSaving(true);
    try {
      const next = patchHandoffDecisions(normalized, patch);
      await onPersist(next);
      onHandoffChange(next);
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save decisions");
    } finally {
      setSaving(false);
    }
  };

  const setAdrVerdict = (id: string, verdict: ItemVerdict) => {
    void persist({
      adrs: normalized.adrs.map((a) => (a.id === id ? { ...a, verdict } : a)),
    });
  };

  const setAcVerdict = (id: string, verdict: ItemVerdict) => {
    void persist({
      acceptanceCriteria: normalized.acceptanceCriteria.map((c) =>
        c.id === id ? { ...c, verdict } : c,
      ),
    });
  };

  const updateAdr = (id: string, fields: Partial<HandoffAdr>) => {
    void persist(
      {
        adrs: normalized.adrs.map((a) => (a.id === id ? { ...a, ...fields } : a)),
      },
      "Decision updated",
    );
  };

  const updateAc = (id: string, text: string) => {
    void persist(
      {
        acceptanceCriteria: normalized.acceptanceCriteria.map((c) =>
          c.id === id ? { ...c, text } : c,
        ),
      },
      "Requirement updated",
    );
    setEditingAc(null);
  };

  const addAdr = () => {
    const id = nextAdrId(normalized.adrs);
    const blank: HandoffAdr = {
      id,
      title: "New architecture decision",
      status: "proposed",
      context: "",
      decision: "",
      consequences: "",
      alternativesConsidered: [],
      verdict: "pending",
    };
    setFocus("adrs");
    setFilter("pending");
    setExpandedAdr(id);
    void persist({ adrs: [...normalized.adrs, blank] }, "Decision added");
  };

  const addAc = () => {
    const id = nextAcId(normalized.acceptanceCriteria);
    const blank: AcceptanceCriterion = {
      id,
      text: "New acceptance criterion",
      source: "manual",
      verdict: "pending",
    };
    setFocus("acs");
    setFilter("pending");
    setEditingAc(id);
    void persist(
      { acceptanceCriteria: [...normalized.acceptanceCriteria, blank] },
      "Requirement added",
    );
  };

  const pendingTotal = summary.adr.pending + summary.ac.pending;
  const decidedGo = summary.adr.go + summary.ac.go;
  const decidedNo = summary.adr.noGo + summary.ac.noGo;
  const droppedCount = summary.adr.dropped + summary.ac.dropped;

  const visibleAdrs = normalized.adrs.filter((a) =>
    matchesFilter((a.verdict || "pending") as ItemVerdict, filter, showDropped),
  );
  const visibleAcs = normalized.acceptanceCriteria.filter((c) =>
    matchesFilter((c.verdict || "pending") as ItemVerdict, filter, showDropped),
  );

  const filterChips: { id: VerdictFilter; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: focus === "adrs" ? summary.adr.pending : summary.ac.pending },
    {
      id: "all",
      label: "All",
      count:
        focus === "adrs"
          ? summary.adr.total - (showDropped ? 0 : summary.adr.dropped)
          : summary.ac.total - (showDropped ? 0 : summary.ac.dropped),
    },
    { id: "go", label: "Go", count: focus === "adrs" ? summary.adr.go : summary.ac.go },
    { id: "no_go", label: "No-go", count: focus === "adrs" ? summary.adr.noGo : summary.ac.noGo },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-foreground">Decide fast</span>
          <span className="rounded-md bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-medium">
            {decidedGo} go
          </span>
          <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-medium">
            {pendingTotal} pending
          </span>
          <span className="rounded-md bg-rose-600/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 font-medium">
            {decidedNo} no-go
          </span>
          {droppedCount > 0 && (
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setShowDropped((v) => !v);
                if (!showDropped) setFilter("all");
              }}
            >
              {showDropped ? "Hide" : "Show"} {droppedCount} dropped
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pendingTotal === 0 ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready — use Next for Build guide
            </span>
          ) : (
            <span>Clear pending, then Next</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5 bg-muted/30">
          {(
            [
              {
                id: "adrs" as const,
                label: "Decisions",
                count: summary.adr.total - summary.adr.dropped,
                pending: summary.adr.pending,
                Icon: Scale,
              },
              {
                id: "acs" as const,
                label: "Requirements",
                count: summary.ac.total - summary.ac.dropped,
                pending: summary.ac.pending,
                Icon: CheckCircle2,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFocus(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                focus === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.Icon className="h-3.5 w-3.5" />
              {tab.label}
              <span
                className={cn(
                  "tabular-nums rounded px-1 py-0.5 text-[10px]",
                  focus === tab.id ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {tab.count}
              </span>
              {tab.pending > 0 && focus !== tab.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title={`${tab.pending} pending`} />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                filter === chip.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {chip.label}
              <span className="ml-1 tabular-nums opacity-70">{chip.count}</span>
            </button>
          ))}
          {!locked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px] ml-1"
              disabled={saving}
              onClick={focus === "adrs" ? addAdr : addAc}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {focus === "adrs" ? (
        <section className="rounded-lg border overflow-hidden">
          <ul className="divide-y max-h-[28rem] overflow-y-auto">
            {visibleAdrs.length === 0 ? (
              <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                {filter === "pending"
                  ? "No pending decisions — switch to All, or continue with Next."
                  : "Nothing in this filter."}
              </li>
            ) : (
              visibleAdrs.map((a) => {
                const v = (a.verdict || "pending") as ItemVerdict;
                const open = expandedAdr === a.id;
                const style = VERDICT_STYLE[v];
                return (
                  <li key={a.id} className={`px-3 py-2.5 ${style.row}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        className="flex items-start gap-2 min-w-0 text-left flex-1"
                        onClick={() => setExpandedAdr(open ? null : a.id)}
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {a.id}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.chip}`}
                            >
                              {style.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium leading-snug line-clamp-2">{a.title}</p>
                          {!open && a.decision && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {a.decision}
                            </p>
                          )}
                        </div>
                      </button>
                      {!locked && (
                        <VerdictButtons
                          value={v}
                          disabled={saving}
                          onChange={(nv) => setAdrVerdict(a.id, nv)}
                        />
                      )}
                    </div>
                    {open && (
                      <div className="mt-2 ml-6 space-y-2">
                        {locked ? (
                          <>
                            <p className="text-xs">
                              <span className="font-medium">Decision. </span>
                              {a.decision || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground/80">Consequences. </span>
                              {a.consequences || "—"}
                            </p>
                          </>
                        ) : (
                          <>
                            <Input
                              value={a.title}
                              disabled={saving}
                              onChange={(e) =>
                                onHandoffChange(
                                  patchHandoffDecisions(normalized, {
                                    adrs: normalized.adrs.map((x) =>
                                      x.id === a.id ? { ...x, title: e.target.value } : x,
                                    ),
                                  }),
                                )
                              }
                              onBlur={(e) =>
                                updateAdr(a.id, { title: e.target.value.trim() || a.title })
                              }
                              className="h-8 text-sm font-medium"
                              placeholder="Title"
                            />
                            <Textarea
                              rows={2}
                              value={a.decision}
                              disabled={saving}
                              onChange={(e) =>
                                onHandoffChange(
                                  patchHandoffDecisions(normalized, {
                                    adrs: normalized.adrs.map((x) =>
                                      x.id === a.id ? { ...x, decision: e.target.value } : x,
                                    ),
                                  }),
                                )
                              }
                              onBlur={(e) => updateAdr(a.id, { decision: e.target.value })}
                              className="text-xs"
                              placeholder="Decision"
                            />
                            <Textarea
                              rows={2}
                              value={a.consequences}
                              disabled={saving}
                              onChange={(e) =>
                                onHandoffChange(
                                  patchHandoffDecisions(normalized, {
                                    adrs: normalized.adrs.map((x) =>
                                      x.id === a.id ? { ...x, consequences: e.target.value } : x,
                                    ),
                                  }),
                                )
                              }
                              onBlur={(e) => updateAdr(a.id, { consequences: e.target.value })}
                              className="text-xs"
                              placeholder="Consequences"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      ) : (
        <section className="rounded-lg border overflow-hidden">
          <ul className="divide-y max-h-[28rem] overflow-y-auto">
            {visibleAcs.length === 0 ? (
              <li className="px-3 py-8 text-center text-xs text-muted-foreground">
                {filter === "pending"
                  ? "No pending requirements — switch to All, or continue with Next."
                  : "Nothing in this filter."}
              </li>
            ) : (
              visibleAcs.map((c) => {
                const v = (c.verdict || "pending") as ItemVerdict;
                const style = VERDICT_STYLE[v];
                const editing = editingAc === c.id;
                return (
                  <li key={c.id} className={`px-3 py-2.5 ${style.row}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.chip}`}
                          >
                            {style.label}
                          </span>
                          {c.source === "manual" && (
                            <span className="text-[9px] text-muted-foreground">manual</span>
                          )}
                        </div>
                        {editing && !locked ? (
                          <div className="space-y-1.5">
                            <Textarea
                              rows={3}
                              defaultValue={c.text}
                              autoFocus
                              className="text-xs"
                              id={`ac-edit-${c.id}`}
                            />
                            <div className="flex gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 text-[11px]"
                                disabled={saving}
                                onClick={() => {
                                  const el = document.getElementById(
                                    `ac-edit-${c.id}`,
                                  ) as HTMLTextAreaElement | null;
                                  updateAc(c.id, (el?.value || c.text).trim() || c.text);
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px]"
                                onClick={() => setEditingAc(null)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs leading-relaxed">{c.text}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!locked && (
                          <VerdictButtons
                            value={v}
                            disabled={saving}
                            onChange={(nv) => setAcVerdict(c.id, nv)}
                          />
                        )}
                        {!locked && !editing && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => setEditingAc(c.id)}
                            >
                              Edit
                            </Button>
                            {v !== "dropped" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] text-muted-foreground"
                                disabled={saving}
                                onClick={() => setAcVerdict(c.id, "dropped")}
                                title="Drop requirement"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
