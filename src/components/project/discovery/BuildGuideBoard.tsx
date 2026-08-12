import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  normalizeDecisionVerdicts,
  patchHandoffTests,
  testSummary,
  type DevHandoff,
  type ItemVerdict,
  type TestCase,
  type TestKind,
} from "@/lib/devHandoff";

interface Props {
  handoff: DevHandoff;
  onPersist: (next: DevHandoff) => Promise<void>;
  onHandoffChange: (next: DevHandoff) => void;
  readOnly?: boolean;
}

type KindFilter = "all" | TestKind;
type VerdictFilter = "pending" | "all" | "go" | "no_go";

export const TEST_LABEL: Record<TestKind, string> = {
  functional: "Functional",
  integration: "Integration",
  contract: "Contract",
  regression: "Regression",
  smoke: "Smoke",
  manual: "Manual",
};

const KIND_ORDER: TestKind[] = [
  "functional",
  "integration",
  "contract",
  "regression",
  "smoke",
  "manual",
];

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

const CODING_RULES = [
  "Wait for gate approval (unless human override).",
  "Additive API only — keep existing snapshot keys.",
  "Touch only the files listed under See changes.",
  "Honor ADRs; ignore discarded ripples.",
  "Report every Go test id before claiming done.",
];

function nextTestId(list: TestCase[]): string {
  const nums = list
    .map((t) => Number((t.id.match(/T-(\d+)/i) || [])[1]))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `T-${String(max + 1).padStart(2, "0")}`;
}

function matchesFilters(
  t: TestCase,
  kind: KindFilter,
  verdictFilter: VerdictFilter,
  showDropped: boolean,
) {
  const v = (t.verdict || "pending") as ItemVerdict;
  if (v === "dropped") return showDropped && verdictFilter === "all" && (kind === "all" || t.kind === kind);
  if (kind !== "all" && t.kind !== kind) return false;
  if (verdictFilter === "all") return true;
  if (verdictFilter === "pending") return v === "pending";
  if (verdictFilter === "go") return v === "go";
  return v === "no_go";
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

export default function BuildGuideBoard({
  handoff,
  onPersist,
  onHandoffChange,
  readOnly,
}: Props) {
  const normalized = useMemo(() => normalizeDecisionVerdicts(handoff), [handoff]);
  const summary = useMemo(() => testSummary(normalized), [normalized]);
  const [saving, setSaving] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [filter, setFilter] = useState<VerdictFilter>("pending");
  const [showDropped, setShowDropped] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const locked = readOnly || handoff.status === "approved";

  const persist = async (testCases: TestCase[], okMsg?: string) => {
    if (locked) return;
    setSaving(true);
    try {
      const next = patchHandoffTests(normalized, { testCases });
      await onPersist(next);
      onHandoffChange(next);
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save tests");
    } finally {
      setSaving(false);
    }
  };

  const setVerdict = (id: string, verdict: ItemVerdict) => {
    void persist(
      normalized.testCases.map((t) => (t.id === id ? { ...t, verdict } : t)),
    );
  };

  const saveEdit = (id: string, patch: Partial<TestCase>) => {
    void persist(
      normalized.testCases.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      "Test updated",
    );
    setEditing(null);
  };

  const addTest = () => {
    const id = nextTestId(normalized.testCases);
    const blank: TestCase = {
      id,
      kind: kind === "all" ? "functional" : kind,
      title: "New test case",
      steps: "",
      expected: "",
      automatable: false,
      verdict: "pending",
    };
    setFilter("pending");
    setExpanded(id);
    setEditing(id);
    void persist([...normalized.testCases, blank], "Test added");
  };

  const visible = normalized.testCases.filter((t) =>
    matchesFilters(t, kind, filter, showDropped),
  );

  const kindChips: { id: KindFilter; label: string; count: number }[] = [
    {
      id: "all",
      label: "All kinds",
      count: summary.total - (showDropped ? 0 : summary.dropped),
    },
    ...KIND_ORDER.filter((k) => (summary.byKind[k] || 0) > 0 || kind === k).map((k) => ({
      id: k as KindFilter,
      label: TEST_LABEL[k],
      count: summary.byKind[k] || 0,
    })),
  ];

  const verdictChips: { id: VerdictFilter; label: string; count: number }[] = [
    {
      id: "pending",
      label: "Pending",
      count:
        kind === "all"
          ? summary.pending
          : normalized.testCases.filter(
              (t) => t.kind === kind && (t.verdict || "pending") === "pending",
            ).length,
    },
    {
      id: "all",
      label: "All",
      count:
        kind === "all"
          ? summary.total - (showDropped ? 0 : summary.dropped)
          : normalized.testCases.filter(
              (t) =>
                t.kind === kind &&
                (showDropped || t.verdict !== "dropped"),
            ).length,
    },
    {
      id: "go",
      label: "Go",
      count:
        kind === "all"
          ? summary.go
          : normalized.testCases.filter(
              (t) => t.kind === kind && t.verdict === "go",
            ).length,
    },
    {
      id: "no_go",
      label: "No-go",
      count:
        kind === "all"
          ? summary.noGo
          : normalized.testCases.filter(
              (t) => t.kind === kind && t.verdict === "no_go",
            ).length,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Compact coding rules */}
      <section className="rounded-lg border overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30"
          onClick={() => setRulesOpen((v) => !v)}
        >
          <span className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rules before coding
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {CODING_RULES.length} constraints · always apply
            </span>
          </span>
          {rulesOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
        {rulesOpen && (
          <ul className="border-t px-3 py-2.5 text-xs space-y-1.5 list-disc pl-7 text-muted-foreground">
            {CODING_RULES.map((r) => (
              <li key={r} className="text-foreground/85">
                {r}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Summary */}
      <div className="rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">Definition of done</span>
          <span className="rounded-md bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 font-medium">
            {summary.go} go
          </span>
          <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-medium">
            {summary.pending} pending
          </span>
          <span className="rounded-md bg-rose-600/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 font-medium">
            {summary.noGo} no-go
          </span>
          {summary.dropped > 0 && (
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setShowDropped((v) => !v);
                if (!showDropped) setFilter("all");
              }}
            >
              {showDropped ? "Hide" : "Show"} {summary.dropped} dropped
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {summary.pending === 0 ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready — Next for Change package
            </span>
          ) : (
            <span>Mark Go on tests that must pass</span>
          )}
        </div>
      </div>

      {/* Kind + verdict filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {kindChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setKind(chip.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                kind === chip.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {chip.label}
              <span className="ml-1 tabular-nums opacity-70">{chip.count}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {verdictChips.map((chip) => (
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
          </div>
          {!locked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              disabled={saving}
              onClick={addTest}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add test
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-lg border overflow-hidden">
        <ul className="divide-y max-h-[28rem] overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-3 py-8 text-center text-xs text-muted-foreground">
              {filter === "pending"
                ? "No pending tests in this view — switch to All, or continue with Next."
                : "Nothing in this filter."}
            </li>
          ) : (
            visible.map((t) => {
              const v = (t.verdict || "pending") as ItemVerdict;
              const style = VERDICT_STYLE[v];
              const open = expanded === t.id;
              const isEditing = editing === t.id;
              return (
                <li key={t.id} className={`px-3 py-2.5 ${style.row}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="flex items-start gap-2 min-w-0 text-left flex-1"
                      onClick={() => {
                        if (isEditing) return;
                        setExpanded(open ? null : t.id);
                      }}
                    >
                      {open || isEditing ? (
                        <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {t.id}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.chip}`}
                          >
                            {style.label}
                          </span>
                          <span className="rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {TEST_LABEL[t.kind]}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-snug line-clamp-2">{t.title}</p>
                        {!open && !isEditing && t.expected && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            Expected: {t.expected}
                          </p>
                        )}
                      </div>
                    </button>
                    {!locked && (
                      <VerdictButtons
                        value={v}
                        disabled={saving}
                        onChange={(nv) => setVerdict(t.id, nv)}
                      />
                    )}
                  </div>

                  {(open || isEditing) && (
                    <div className="mt-2 ml-6 space-y-2">
                      {isEditing && !locked ? (
                        <TestEditForm
                          test={t}
                          saving={saving}
                          onCancel={() => setEditing(null)}
                          onSave={(patch) => saveEdit(t.id, patch)}
                        />
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">Steps. </span>
                            {t.steps || "—"}
                          </p>
                          <p className="text-xs">
                            <span className="font-medium">Expected. </span>
                            {t.expected || "—"}
                          </p>
                          {!locked && (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setEditing(t.id)}
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
                                  onClick={() => setVerdict(t.id, "dropped")}
                                  title="Drop test"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
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
    </div>
  );
}

function TestEditForm({
  test,
  saving,
  onCancel,
  onSave,
}: {
  test: TestCase;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<TestCase>) => void;
}) {
  const [title, setTitle] = useState(test.title);
  const [kind, setKind] = useState<TestKind>(test.kind);
  const [steps, setSteps] = useState(test.steps);
  const [expected, setExpected] = useState(test.expected);

  return (
    <div className="space-y-2 rounded-md border bg-background p-2.5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm font-medium"
        placeholder="Title"
        disabled={saving}
      />
      <div className="flex flex-wrap gap-1">
        {KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            disabled={saving}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-medium",
              kind === k
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {TEST_LABEL[k]}
          </button>
        ))}
      </div>
      <Textarea
        rows={2}
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        className="text-xs"
        placeholder="Steps"
        disabled={saving}
      />
      <Textarea
        rows={2}
        value={expected}
        onChange={(e) => setExpected(e.target.value)}
        className="text-xs"
        placeholder="Expected result"
        disabled={saving}
      />
      <div className="flex gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 text-[11px]"
          disabled={saving || !title.trim()}
          onClick={() =>
            onSave({
              title: title.trim(),
              kind,
              steps: steps.trim(),
              expected: expected.trim(),
            })
          }
        >
          <Check className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={onCancel}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
