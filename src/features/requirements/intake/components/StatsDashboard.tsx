import { motion } from "framer-motion";
import { CheckCircle2, FileText, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SavedRequirement } from "../types";

export function StatsDashboard({ requirements }: { requirements: SavedRequirement[] }) {
  const total = requirements.length;
  const locked = requirements.filter(
    (r) => r.status === "locked" || r.status === "approved",
  ).length;
  const progress = total > 0 ? Math.round((locked / total) * 100) : 0;

  const byType = [
    { label: "Functional", count: requirements.filter((r) => r.type === "functional").length, color: "text-primary", bg: "bg-primary" },
    { label: "Non-Functional", count: requirements.filter((r) => r.type === "non_functional").length, color: "text-emerald-500", bg: "bg-emerald-500" },
    { label: "Constraints", count: requirements.filter((r) => r.type === "constraint").length, color: "text-slate-500", bg: "bg-slate-500" },
    { label: "Assumptions", count: requirements.filter((r) => r.type === "assumption").length, color: "text-amber-500", bg: "bg-amber-500" },
    { label: "Dependencies", count: requirements.filter((r) => r.type === "dependency").length, color: "text-cyan-500", bg: "bg-cyan-500" },
    { label: "User Stories", count: requirements.filter((r) => r.type === "user_story").length, color: "text-violet-500", bg: "bg-violet-500" },
  ].filter((t) => t.count > 0);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="rounded-xl border bg-gradient-to-br from-card to-secondary/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Total
          </span>
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">{total}</p>
        <div className="flex gap-1.5 mt-2">
          {byType.map((t) => (
            <Tooltip key={t.label}>
              <TooltipTrigger asChild>
                <div
                  className={`h-1.5 rounded-full ${t.bg}`}
                  style={{ width: `${(t.count / total) * 100}%`, minWidth: 8 }}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {t.label}: {t.count}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-gradient-to-br from-success/5 to-success/10 border-success/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Finalized
          </span>
          <div className="h-8 w-8 rounded-lg bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight text-success">{locked}</p>
        <p className="text-[10px] text-muted-foreground mt-1">of {total} requirements</p>
      </div>

      <div className="rounded-xl border bg-gradient-to-br from-card to-secondary/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Progress
          </span>
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-3xl font-bold tracking-tight">{progress}%</p>
        <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
