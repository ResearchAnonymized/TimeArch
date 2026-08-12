import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentStage: number;
}

const PHASES = [
  {
    label: "Requirement Definition",
    tone: "text-primary",
    dot: "bg-primary",
    stages: [
      { n: 1, name: "Project setup" },
      { n: 2, name: "Requirements intake" },
      { n: 3, name: "Requirements critique" },
    ],
  },
  {
    label: "Architecture Design",
    tone: "text-violet-500",
    dot: "bg-violet-500",
    stages: [
      { n: 4, name: "Architecture drivers" },
      { n: 5, name: "Style selection" },
      { n: 6, name: "Component design" },
      { n: 7, name: "Data model" },
      { n: 8, name: "Interfaces & APIs" },
      { n: 9, name: "Cross-cutting concerns" },
      { n: 10, name: "Infrastructure" },
    ],
  },
  {
    label: "Validation & Assurance",
    tone: "text-amber-500",
    dot: "bg-amber-500",
    stages: [
      { n: 11, name: "ATAM evaluation" },
      { n: 12, name: "Risk analysis" },
      { n: 13, name: "Trade-off review" },
      { n: 14, name: "Quality checklists" },
    ],
  },
  {
    label: "Delivery & Evolution",
    tone: "text-emerald-500",
    dot: "bg-emerald-500",
    stages: [
      { n: 15, name: "Stakeholder approval" },
      { n: 16, name: "Implementation plan" },
      { n: 17, name: "Deployment blueprint" },
      { n: 18, name: "Continuous evolution" },
    ],
  },
];

export default function JourneyDrawer({ open, onClose, currentStage }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-display">Your journey</SheetTitle>
          <p className="text-xs text-muted-foreground">
            18 stages across 4 phases. Each stage unlocks the next.
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {PHASES.map((p) => (
            <section key={p.label}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} />
                <h3 className={cn("text-[11px] font-semibold uppercase tracking-widest", p.tone)}>
                  {p.label}
                </h3>
              </div>
              <ul className="space-y-1 pl-3 border-l border-border/60">
                {p.stages.map((s) => {
                  const done = s.n < currentStage;
                  const active = s.n === currentStage;
                  const locked = s.n > currentStage;
                  return (
                    <li
                      key={s.n}
                      className={cn(
                        "flex items-center gap-2 py-1.5 px-2 -ml-[1px] text-sm rounded-md",
                        active && "bg-primary/10 text-primary font-medium",
                        done && "text-muted-foreground",
                        locked && "text-muted-foreground/60",
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : active ? (
                        <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                          <span className="absolute h-3.5 w-3.5 rounded-full bg-primary/30 animate-ping" />
                          <span className="relative h-2 w-2 rounded-full bg-primary" />
                        </span>
                      ) : locked ? (
                        <Lock className="h-3 w-3 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="text-[11px] font-mono text-muted-foreground/70 w-5">
                        {String(s.n).padStart(2, "0")}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
