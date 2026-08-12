import { ArrowRight, CheckCircle2, ClipboardCheck, FileText, ListTree, ScanSearch, Sparkles, Upload, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1 as const, label: "Import", hint: "Upload code and documents", icon: Upload },
  { n: 2 as const, label: "Recover", hint: "Reverse-engineer the architecture", icon: ScanSearch },
  { n: 3 as const, label: "Change", hint: "Propose and review changes", icon: FileText },
];

export type ChangeTab = "recovered" | "propose" | "revision";

const CHANGE_TABS: { id: ChangeTab; label: string; hint: string; Icon: LucideIcon }[] = [
  {
    id: "recovered",
    label: "Current features",
    hint: "What the system already has",
    Icon: ListTree,
  },
  {
    id: "propose",
    label: "Propose changes",
    hint: "Add or select features for this change",
    Icon: Sparkles,
  },
  {
    id: "revision",
    label: "Review package",
    hint: "Diagram, decisions, tests, and change package",
    Icon: ClipboardCheck,
  },
];

interface Props {
  step: 1 | 2 | 3;
  hasImports: boolean;
  hasParsed: boolean;
  onSelect: (n: 1 | 2 | 3) => void;
  changeTab?: ChangeTab;
  onChangeTab?: (tab: ChangeTab) => void;
  /** When left rail owns Import/Recover/Change, only show Change sub-tabs */
  hidePipeline?: boolean;
}

export default function StepRail({
  step,
  hasImports,
  hasParsed,
  onSelect,
  changeTab,
  onChangeTab,
  hidePipeline,
}: Props) {
  const changeTabs =
    step === 3 && hasParsed && changeTab && onChangeTab ? (
      <div className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1">
        {CHANGE_TABS.map((t) => {
          const active = changeTab === t.id;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => onChangeTab(t.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors min-w-0",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  if (hidePipeline) {
    return changeTabs ? <div className="space-y-3">{changeTabs}</div> : null;
  }

  return (
    <div className="space-y-3">
      {/* Pipeline only — Import → Recover → Change */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1">
        {STEPS.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.n;
          const isDone =
            (s.n === 1 && hasImports && step !== 1) ||
            (s.n === 2 && hasParsed && step !== 2) ||
            (s.n === 3 && hasParsed && step === 3);
          const isReachable = s.n === 1 || (s.n === 2 && hasImports) || (s.n === 3 && hasParsed);
          return (
            <button
              key={s.n}
              type="button"
              title={s.hint}
              onClick={() => isReachable && onSelect(s.n)}
              disabled={!isReachable}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors min-w-0",
                isActive && "bg-primary text-primary-foreground shadow-sm",
                !isActive && isDone && "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10",
                !isActive &&
                  !isDone &&
                  isReachable &&
                  "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                !isReachable && "opacity-40 cursor-not-allowed",
              )}
            >
              {isDone && !isActive ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              )}
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {changeTabs}
    </div>
  );
}
