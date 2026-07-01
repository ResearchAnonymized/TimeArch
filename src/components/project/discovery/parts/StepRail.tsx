import { ArrowRight, CheckCircle2, Layers, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1 as const, label: "Bring in files", icon: Upload },
  { n: 2 as const, label: "AI reads them", icon: Sparkles },
  { n: 3 as const, label: "Explore findings", icon: Layers },
];

interface Props {
  step: 1 | 2 | 3;
  hasImports: boolean;
  hasParsed: boolean;
  onSelect: (n: 1 | 2 | 3) => void;
}

export default function StepRail({ step, hasImports, hasParsed, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const isActive = step === s.n;
        const isDone = (s.n === 1 && hasImports) || (s.n === 2 && hasParsed);
        const isReachable =
          s.n === 1 || (s.n === 2 && hasImports) || (s.n === 3 && hasParsed);
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => isReachable && onSelect(s.n)}
              disabled={!isReachable}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 transition-all",
                isActive && "border-amber-500/60 bg-amber-500/10 shadow-sm",
                !isActive &&
                  isDone &&
                  "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
                !isActive && !isDone && isReachable && "border-border hover:border-amber-500/30",
                !isReachable && "opacity-40 cursor-not-allowed",
              )}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                  isActive && "bg-amber-500 text-white",
                  !isActive && isDone && "bg-emerald-500 text-white",
                  !isActive && !isDone && "bg-muted text-muted-foreground",
                )}
              >
                {isDone && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
              </div>
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "text-xs font-medium truncate",
                  isActive && "text-amber-700 dark:text-amber-300",
                )}
              >
                {s.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
