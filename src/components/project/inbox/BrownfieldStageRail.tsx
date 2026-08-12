/**
 * Brownfield left nav — Import / Recover / Change vertically.
 * Full 00–18 Lifecycle stays behind the menu (hamburger).
 */
import { useState } from "react";
import {
  CheckCircle2,
  FileText,
  Menu,
  ScanSearch,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import StageRail from "./StageRail";
import type { ProjectMode } from "@/components/studio/stage-registry";

const STEPS: {
  n: 1 | 2 | 3;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[] = [
  { n: 1, label: "Import", hint: "Upload code and documents", Icon: Upload },
  { n: 2, label: "Recover", hint: "Reverse-engineer the architecture", Icon: ScanSearch },
  { n: 3, label: "Change", hint: "Current features, propose, review", Icon: FileText },
];

interface Props {
  discoveryStep: 1 | 2 | 3;
  onDiscoveryStep: (n: 1 | 2 | 3) => void;
  hasImports: boolean;
  hasParsed: boolean;
  currentStage: number;
  lockedStages: Set<number>;
  onSelectStage: (n: number) => void;
  projectMode?: ProjectMode;
}

export default function BrownfieldStageRail({
  discoveryStep,
  onDiscoveryStep,
  hasImports,
  hasParsed,
  currentStage,
  lockedStages,
  onSelectStage,
  projectMode,
}: Props) {
  const [lifecycleOpen, setLifecycleOpen] = useState(false);

  return (
    <aside className="w-56 border-r bg-card/40 flex flex-col overflow-hidden flex-shrink-0">
      <div className="px-3 py-3 border-b flex items-center justify-between gap-2 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Discovery
        </p>
        <Sheet open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              title="Full lifecycle"
              aria-label="Open full lifecycle"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 overflow-hidden flex flex-col">
            <SheetHeader className="px-4 py-3 border-b text-left">
              <SheetTitle className="text-sm">Full lifecycle</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <StageRail
                currentStage={currentStage}
                lockedStages={lockedStages}
                onSelect={(n) => {
                  onSelectStage(n);
                  setLifecycleOpen(false);
                }}
                projectMode={projectMode}
                embedded
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {STEPS.map((s) => {
          const Icon = s.Icon;
          const active = currentStage === 0 && discoveryStep === s.n;
          const done =
            (s.n === 1 && hasImports && discoveryStep !== 1) ||
            (s.n === 2 && hasParsed && discoveryStep !== 2) ||
            (s.n === 3 && hasParsed && discoveryStep === 3 && currentStage === 0);
          const reachable = s.n === 1 || (s.n === 2 && hasImports) || (s.n === 3 && hasParsed);

          return (
            <button
              key={s.n}
              type="button"
              title={s.hint}
              disabled={!reachable && s.n !== 1}
              onClick={() => {
                onSelectStage(0);
                onDiscoveryStep(s.n);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : done
                    ? "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    : reachable
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "text-muted-foreground/40 cursor-not-allowed",
              )}
            >
              {done && !active ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              )}
              <span className="flex-1 truncate">{s.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
