import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Target,
  Shield,
  Zap,
  Box,
  Link2,
  BookOpen,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "./HelpTip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import GlossaryPanel from "./GlossaryPanel";

interface Props {
  currentStage: number;
  projectId: string;
  refreshKey?: number;
}

interface Requirement {
  id: string;
  requirement_id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
}

interface Driver {
  id: string;
  label: string;
  description: string | null;
  priority: string;
  category: string | null;
}

const TYPE_ICON: Record<string, typeof Target> = {
  functional: Target,
  non_functional: Shield,
  user_story: BookOpen,
  constraint: Link2,
  assumption: Zap,
  dependency: Box,
};

const TYPE_COLOR: Record<string, string> = {
  functional: "border-l-primary",
  non_functional: "border-l-emerald-500",
  user_story: "border-l-violet-500",
  constraint: "border-l-slate-400",
  assumption: "border-l-amber-500",
  dependency: "border-l-cyan-500",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
};

export default function ContextPane({ currentStage, projectId, refreshKey }: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reqOpen, setReqOpen] = useState(true);
  const [drvOpen, setDrvOpen] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [reqRes, drvRes] = await Promise.all([
        supabase
          .from("requirements")
          .select("id, requirement_id, title, type, status, priority")
          .eq("project_id", projectId)
          .order("requirement_id"),
        supabase
          .from("architecture_drivers")
          .select("id, label, description, priority, category")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);
      if (reqRes.data) setRequirements(reqRes.data);
      if (drvRes.data) setDrivers(drvRes.data);
    };
    fetchData();
  }, [projectId, currentStage, refreshKey]);

  const lockedReqs = requirements.filter((r) => r.status === "locked" || r.status === "approved");
  const progress =
    requirements.length > 0 ? Math.round((lockedReqs.length / requirements.length) * 100) : 0;
  const draftCount = requirements.length - lockedReqs.length;
  const gateActive = currentStage >= 4 && draftCount > 0;

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        Project Context
        <HelpTip
          text="Shows all requirements and architecture drivers from earlier stages. From Stage 4 onward, only locked/approved requirements are sent to AI agents."
          side="right"
        />
      </h3>

      {/* Mini Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-card/60 p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-primary">{requirements.length}</p>
          <p className="text-[10px] text-muted-foreground">Requirements</p>
        </div>
        <div className="rounded-lg border bg-card/60 p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{drivers.length}</p>
          <p className="text-[10px] text-muted-foreground">Drivers</p>
        </div>
      </div>

      {/* Governance gate notice — only shown on Stage 4+ when drafts exist */}
      {gateActive && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-2 text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-warning">Gate active:</span> {lockedReqs.length} of{" "}
          {requirements.length} flow downstream. {draftCount} draft excluded.
        </div>
      )}

      {/* Progress bar */}
      {requirements.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Finalized</span>
            <span className="tabular-nums">
              {lockedReqs.length}/{requirements.length} ({progress}%)
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Requirements */}
      <div>
        <button
          onClick={() => setReqOpen(!reqOpen)}
          className="flex items-center gap-2 w-full text-left mb-2 group"
        >
          {reqOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-display font-semibold flex-1">Requirements</span>
          <Badge variant="secondary" className="text-[9px] h-5">
            {requirements.length}
          </Badge>
        </button>

        {reqOpen && (
          <>
            {requirements.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic ml-7">No requirements yet.</p>
            ) : (
              <div className="space-y-1 ml-1">
                {requirements.map((req, i) => {
                  const Icon = TYPE_ICON[req.type] || Target;
                  const borderColor = TYPE_COLOR[req.type] || "border-l-primary";
                  const isFinalized = req.status === "locked" || req.status === "approved";

                  return (
                    <Tooltip key={req.id}>
                      <TooltipTrigger asChild>
                        <motion.div
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md border-l-2 cursor-help text-[11px] transition-colors hover:bg-secondary/50",
                            borderColor,
                            isFinalized ? "bg-success/[0.03]" : "",
                          )}
                        >
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full flex-shrink-0",
                              PRIORITY_DOT[req.priority] || PRIORITY_DOT.medium,
                            )}
                          />
                          {isFinalized ? (
                            <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                          )}
                          <span className="font-mono text-[9px] text-muted-foreground flex-shrink-0">
                            {req.requirement_id}
                          </span>
                          <span className="truncate">{req.title}</span>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs max-w-[220px]">
                        <p className="font-semibold">
                          {req.requirement_id}: {req.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {req.type.replace(/_/g, " ")} · {req.priority} ·{" "}
                          {isFinalized ? "Finalized" : "Draft"}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drivers */}
      <div>
        <button
          onClick={() => setDrvOpen(!drvOpen)}
          className="flex items-center gap-2 w-full text-left mb-2 group"
        >
          {drvOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-display font-semibold flex-1">Architecture Drivers</span>
          <Badge variant="secondary" className="text-[9px] h-5">
            {drivers.length}
          </Badge>
        </button>

        {drvOpen && (
          <>
            {drivers.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic ml-7">
                No drivers identified yet.
              </p>
            ) : (
              <div className="space-y-1.5 ml-1">
                {drivers.map((d, i) => (
                  <Tooltip key={d.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="p-2 rounded-lg border bg-card/50 cursor-help hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-display font-semibold flex-1 truncate">
                            {d.label}
                          </span>
                          <span
                            className={cn(
                              "text-[9px] font-mono px-1.5 py-0.5 rounded",
                              d.priority === "critical"
                                ? "bg-destructive/10 text-destructive"
                                : d.priority === "high"
                                  ? "bg-warning/10 text-warning"
                                  : d.priority === "medium"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-muted text-muted-foreground",
                            )}
                          >
                            {d.priority}
                          </span>
                          {d.category && (
                            <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                              {d.category}
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {d.description}
                          </p>
                        )}
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs max-w-[220px]">
                      <p className="font-semibold">{d.label}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Priority: {d.priority} —{" "}
                        {d.priority === "critical"
                          ? "Must be addressed in every architecture decision"
                          : d.priority === "high"
                            ? "Significantly impacts design choices"
                            : d.priority === "medium"
                              ? "Should be considered during design"
                              : "Nice to have — consider if resources allow"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Architecture Glossary — always available reference */}
      <div className="pt-2 border-t">
        <GlossaryPanel variant="compact" />
      </div>
    </div>
  );
}
