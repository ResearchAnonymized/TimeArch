import { ArrowRight, Loader2, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { getStage } from "@/components/studio/stage-registry";
import { useStageSummary, type ChipTone } from "@/hooks/useStageSummary";
import { cn } from "@/lib/utils";

const TONE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  primary: { bg: "bg-primary/5", text: "text-primary", border: "border-primary/20" },
  violet: { bg: "bg-violet-500/5", text: "text-violet-500", border: "border-violet-500/20" },
  amber: { bg: "bg-amber-500/5", text: "text-amber-500", border: "border-amber-500/20" },
  emerald: { bg: "bg-emerald-500/5", text: "text-emerald-500", border: "border-emerald-500/20" },
};

const CHIP_TONE: Record<ChipTone, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  info: "bg-primary/10 text-primary border-primary/20",
  muted: "bg-muted text-muted-foreground border-border",
};

interface Props {
  projectId: string;
  currentStage: number;
  refreshKey?: number;
  onAdvance: () => void;
  onRun?: () => void;
  running?: boolean;
  advancing?: boolean;
  isLocked?: boolean;
}

export default function StageHeader({
  projectId,
  currentStage,
  refreshKey,
  onAdvance,
  onRun,
  running,
  advancing,
  isLocked,
}: Props) {

  const stage = getStage(currentStage);
  const tone = TONE_MAP[stage.tone] ?? TONE_MAP.primary;
  const next = stage.n < 18 ? getStage(stage.n + 1) : null;
  const summary = useStageSummary(projectId, currentStage, refreshKey, isLocked);

  const statusBadge = (() => {
    if (summary.status === "locked")
      return { label: "Locked", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20", Icon: CheckCircle2 };
    if (summary.status === "ready")
      return { label: "Ready", cls: "text-primary bg-primary/10 border-primary/20", Icon: CheckCircle2 };
    if (summary.status === "draft")
      return { label: "Draft", cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20", Icon: AlertCircle };
    return { label: "Not started", cls: "text-muted-foreground bg-muted border-border", Icon: AlertCircle };
  })();

  return (
    <motion.div
      key={stage.n}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("border-b", tone.bg)}
    >
      {/* Row 1 · identity + actions */}
      <div className="flex items-start gap-4 px-6 pt-4 pb-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-mono font-bold text-lg bg-background border-2 shadow-sm",
            tone.border,
            tone.text,
          )}
        >
          {String(stage.n).padStart(2, "0")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-[10px] uppercase tracking-widest font-semibold", tone.text)}>
              {stage.phase} · Stage {stage.n} of 18
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-widest font-semibold",
                statusBadge.cls,
              )}
            >
              <statusBadge.Icon className="h-2.5 w-2.5" />
              {statusBadge.label}
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold leading-tight mt-0.5">
            {stage.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1 max-w-2xl">
            {stage.blurb}
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0 w-52">


          {onRun && (
            <Button
              onClick={onRun}
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              disabled={running}
            >
              {running ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Running…
                </>
              ) : (
                <>Run this stage</>
              )}
            </Button>
          )}
          {next && (
            <Button
              onClick={onAdvance}
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs justify-between text-muted-foreground hover:text-foreground"
              disabled={advancing}
            >
              <span className="flex items-center gap-1.5 truncate">
                Next · {next.title}
              </span>
              {advancing ? (
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
              ) : (
                <ArrowRight className="h-3 w-3 flex-shrink-0" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Row 2 · KPI strip */}
      <div className="border-t border-border/50 bg-background/40 px-6 py-2.5 flex items-center gap-3 flex-wrap">
        {summary.loading && summary.chips.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading stage status…
          </div>
        ) : (
          <>
            {summary.chips.map((c) => (
              <span
                key={c.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  CHIP_TONE[c.tone ?? "muted"],
                )}
              >
                <span className="uppercase tracking-wider text-[10px] font-semibold opacity-70">
                  {c.label}
                </span>
                <span className="font-mono font-semibold">{c.value}</span>
              </span>
            ))}
            {summary.hint && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                <span className="truncate">{summary.hint}</span>
              </span>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
