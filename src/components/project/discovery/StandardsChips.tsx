/**
 * Renders standards-traceability chips (ISO/IEEE, ATAM, MADR, …) for a stage.
 * Used inside brownfield artifact detail views so reviewers see which
 * normative reference the artifact conforms to.
 */
import { BookMarked } from "lucide-react";
import { standardsForStage } from "@/lib/standardsMap";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  stage: number;
  className?: string;
}

export default function StandardsChips({ stage, className }: Props) {
  const refs = standardsForStage(stage);
  if (refs.length === 0) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <div className={"flex flex-wrap items-center gap-1 " + (className ?? "")}>
        <BookMarked className="h-3 w-3 text-slate-500" aria-hidden />
        {refs.map((r) => (
          <Tooltip key={r.id}>
            <TooltipTrigger asChild>
              <span className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-slate-400/40 bg-slate-500/5 text-slate-700 dark:text-slate-300 cursor-help">
                {r.short}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {r.full}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
