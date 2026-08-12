import { ArrowRight, ExternalLink, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getStage } from "@/components/studio/stage-registry";
import { cn } from "@/lib/utils";

const TONE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-500", border: "border-violet-500/30" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    border: "border-emerald-500/30",
  },
};

interface Props {
  currentStage: number;
  onOpenFull: () => void;
  onAdvance: () => void;
  onRun?: () => void;
  running?: boolean;
  advancing?: boolean;
  isLocked?: boolean;
}

export default function StageActionCard({
  currentStage,
  onOpenFull,
  onAdvance,
  onRun,
  running,
  advancing,
  isLocked,
}: Props) {
  const stage = getStage(currentStage);
  const tone = TONE_MAP[stage.tone] ?? TONE_MAP.primary;

  return (
    <aside className="w-[340px] border-l bg-card/40 flex-shrink-0 flex flex-col overflow-hidden">
      <div className="p-4 border-b flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Stage Action
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <motion.div
          key={stage.n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("rounded-xl border p-4 space-y-3", tone.border, tone.bg)}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono font-bold text-sm",
                "bg-background/70",
                tone.text,
              )}
            >
              {String(stage.n).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[10px] uppercase tracking-widest font-semibold", tone.text)}>
                {stage.phase}
              </p>
              <h3 className="font-display font-semibold text-sm leading-snug mt-0.5">
                {stage.title}
              </h3>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{stage.blurb}</p>
        </motion.div>

        <div className="space-y-2">
          <Button
            onClick={onOpenFull}
            variant="default"
            size="sm"
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Open stage tool
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </Button>

          {onRun && (
            <Button
              onClick={onRun}
              variant="outline"
              size="sm"
              className="w-full justify-between"
              disabled={running}
            >
              <span className="flex items-center gap-2">
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {running ? "Running…" : "Run this stage"}
              </span>
            </Button>
          )}
        </div>

        {stage.n < 18 && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Next up
            </p>
            <p className="text-xs font-medium mb-2">
              Stage {stage.n + 1} · {getStage(stage.n + 1).title}
            </p>
            <Button
              onClick={onAdvance}
              variant="ghost"
              size="sm"
              className="w-full justify-between h-8 text-xs"
              disabled={advancing || !isLocked}
              title={isLocked ? "" : "Lock this stage first"}
            >
              <span>Advance to next stage</span>
              {advancing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
