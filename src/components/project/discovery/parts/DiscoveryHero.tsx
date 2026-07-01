import { Compass, Loader2, Save, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  hasImports: boolean;
  hasParsed: boolean;
  reversing: boolean;
  loadingDemo: string | null;
  showOneClickDemo: boolean;
  pipelinePct: number;
  pipelineLabel: string;
  isReturning: boolean;
  importCount: number;
  step: 1 | 2 | 3;
  lastActivity: Date | null;
  onOneClickDemo: () => void;
  onDismissReturning: () => void;
}

export default function DiscoveryHero({
  hasImports,
  hasParsed,
  reversing,
  loadingDemo,
  showOneClickDemo,
  pipelinePct,
  pipelineLabel,
  isReturning,
  importCount,
  step,
  lastActivity,
  onOneClickDemo,
  onDismissReturning,
}: Props) {
  return (
    <>
      {isReturning && hasImports && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Save className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Welcome back — picking up where you left off</p>
              <p className="text-[11px] text-muted-foreground">
                {importCount} file{importCount === 1 ? "" : "s"} saved ·{" "}
                {hasParsed ? `Step ${step} ready` : "Ready to run AI reading"}
                {lastActivity && ` · last edit ${lastActivity.toLocaleString()}`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismissReturning}
            className="text-xs flex-shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Compass className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-display text-lg font-bold">Brownfield Discovery</h2>
              <Badge
                variant="outline"
                className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
              >
                existing system
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Excavate your legacy system in three guided steps. We'll read what you have, surface
              gaps, and plan how it evolves — no need to start from scratch.
            </p>
          </div>
          {showOneClickDemo && (
            <Button
              size="sm"
              onClick={onOneClickDemo}
              disabled={!!loadingDemo || reversing}
              className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0 shadow-sm"
            >
              {loadingDemo || reversing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Setting up…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> One-click demo
                </>
              )}
            </Button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-amber-500/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Upload → Parse → Baseline artifacts
            </span>
            <span className="text-[11px] text-muted-foreground">{pipelinePct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-amber-500/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${pipelinePct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{pipelineLabel}</p>
        </div>
      </div>
    </>
  );
}
