import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { stagesForMode, type ProjectMode, type StageMeta } from "@/components/studio/stage-registry";

const TONE_BAR: Record<string, string> = {
  primary: "bg-primary",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
};

const TONE_TEXT: Record<string, string> = {
  primary: "text-primary",
  violet: "text-violet-500",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
};

interface Props {
  currentStage: number;
  lockedStages: Set<number>;
  onSelect: (n: number) => void;
  projectMode?: ProjectMode;
  /** When true, render list only (no outer aside) — used inside a Sheet */
  embedded?: boolean;
}

export default function StageRail({
  currentStage,
  lockedStages,
  onSelect,
  projectMode,
  embedded,
}: Props) {
  const visibleStages = stagesForMode(projectMode);
  // Group stages by phase for visual sectioning
  const groups: { phase: string; tone: string; items: StageMeta[] }[] = [];
  for (const s of visibleStages) {
    const last = groups[groups.length - 1];
    if (last && last.phase === s.phase) last.items.push(s);
    else groups.push({ phase: s.phase, tone: s.tone, items: [s] });
  }

  const body = (
    <>
      {!embedded && (
        <div className="px-4 py-3 border-b flex-shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Lifecycle
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lockedStages.size} / {visibleStages.length} locked
          </p>
        </div>
      )}
      <nav className={cn("flex-1 py-2", embedded && "pt-1")}>
        {groups.map((g) => (
          <div key={g.phase} className="mb-3">
            <div className="px-4 py-1 flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", TONE_BAR[g.tone] ?? "bg-primary")} />
              <p
                className={cn(
                  "text-[10px] uppercase tracking-widest font-semibold",
                  TONE_TEXT[g.tone] ?? "text-primary",
                )}
              >
                {g.phase}
              </p>
            </div>
            <ul>
              {g.items.map((s) => {
                const active = s.n === currentStage;
                const done = lockedStages.has(s.n);
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      onClick={() => onSelect(s.n)}
                      className={cn(
                        "w-full flex items-center gap-2.5 pl-4 pr-3 py-1.5 text-left text-xs transition-colors relative",
                        active
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-primary" />
                      )}
                      <span
                        className={cn(
                          "font-mono text-[10px] w-5 flex-shrink-0",
                          active ? "text-primary font-bold" : "text-muted-foreground/60",
                        )}
                      >
                        {String(s.n).padStart(2, "0")}
                      </span>
                      <span className="flex-1 truncate">{s.title}</span>
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col h-full bg-card">{body}</div>;
  }

  return (
    <aside className="w-60 border-r bg-card/40 flex flex-col overflow-y-auto flex-shrink-0">
      {body}
    </aside>
  );
}
