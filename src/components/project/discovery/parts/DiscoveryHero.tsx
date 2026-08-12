import { Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BrownfieldMode } from "./ModeToggle";

interface Props {
  mode: BrownfieldMode;
  pipelinePct: number;
  pipelineLabel: string;
}

export default function DiscoveryHero({ mode, pipelinePct, pipelineLabel }: Props) {
  return (
    <div
      className={
        mode === "live"
          ? "rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-5"
          : "rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent p-5"
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            mode === "live"
              ? "h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0"
              : "h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0"
          }
        >
          <Compass
            className={
              mode === "live"
                ? "h-5 w-5 text-emerald-700 dark:text-emerald-300"
                : "h-5 w-5 text-blue-600 dark:text-blue-400"
            }
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-display text-lg font-bold">Brownfield change</h2>
            <Badge
              variant="outline"
              className={
                mode === "live"
                  ? "text-[10px] border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
                  : "text-[10px] border-blue-500/40 text-blue-700 dark:text-blue-300"
              }
            >
              {mode === "live" ? "Live" : "Demo"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Import a system → recover architecture → describe a new requirement → see what changes
            where → hand off a clear proposal for humans and machines.
          </p>
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={
                  mode === "live"
                    ? "h-full rounded-full bg-emerald-600 transition-all duration-500"
                    : "h-full rounded-full bg-blue-600 transition-all duration-500"
                }
                style={{ width: `${pipelinePct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{pipelineLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
