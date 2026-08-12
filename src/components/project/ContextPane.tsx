import { useState, useEffect, useMemo } from "react";
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
  Search,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "./HelpTip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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
  description: string | null;
  acceptance_criteria: any;
  source: string | null;
  category: string | null;
}

interface Driver {
  id: string;
  label: string;
  description: string | null;
  priority: string;
  category: string | null;
}

const TYPE_META: Record<string, { icon: typeof Target; label: string; color: string }> = {
  functional: { icon: Target, label: "Functional", color: "text-primary" },
  non_functional: { icon: Shield, label: "Non-functional", color: "text-emerald-500" },
  user_story: { icon: BookOpen, label: "User story", color: "text-violet-500" },
  constraint: { icon: Link2, label: "Constraint", color: "text-slate-400" },
  assumption: { icon: Zap, label: "Assumption", color: "text-amber-500" },
  dependency: { icon: Box, label: "Dependency", color: "text-cyan-500" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-muted-foreground/40",
};

const TYPE_FILTERS = ["all", "functional", "non_functional", "constraint", "user_story"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export default function ContextPane({ currentStage, projectId, refreshKey }: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reqOpen, setReqOpen] = useState(true);
  const [drvOpen, setDrvOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [reqRes, drvRes] = await Promise.all([
        supabase
          .from("requirements")
          .select(
            "id, requirement_id, title, type, status, priority, description, acceptance_criteria, source, category",
          )
          .eq("project_id", projectId)
          .order("requirement_id"),
        supabase
          .from("architecture_drivers")
          .select("id, label, description, priority, category")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);
      if (reqRes.data) setRequirements(reqRes.data as Requirement[]);
      if (drvRes.data) setDrivers(drvRes.data);
    };
    fetchData();
  }, [projectId, currentStage, refreshKey]);

  const lockedReqs = requirements.filter((r) => r.status === "locked" || r.status === "approved");
  const progress =
    requirements.length > 0 ? Math.round((lockedReqs.length / requirements.length) * 100) : 0;
  const draftCount = requirements.length - lockedReqs.length;
  const gateActive = currentStage >= 4 && draftCount > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requirements.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return (
        r.requirement_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [requirements, query, typeFilter]);

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: requirements.length };
    for (const r of requirements) c[r.type] = (c[r.type] ?? 0) + 1;
    return c;
  }, [requirements]);

  const renderAcceptance = (ac: any): string[] => {
    if (!ac) return [];
    if (Array.isArray(ac)) return ac.map(String);
    if (typeof ac === "string") return [ac];
    if (typeof ac === "object") return Object.values(ac).map((v) => String(v));
    return [];
  };

  return (
    <div className="p-4 space-y-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        Project Context
        <HelpTip
          text="Search, filter and inspect requirements + drivers gathered so far. From Stage 4 onward, only locked/approved requirements flow to AI agents."
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

      {gateActive && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-2 text-[10px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-warning">Gate active:</span> {lockedReqs.length} of{" "}
          {requirements.length} flow downstream. {draftCount} draft excluded.
        </div>
      )}

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

        {reqOpen && requirements.length > 0 && (
          <div className="space-y-2 mb-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search requirements…"
                className="w-full pl-7 pr-7 py-1.5 text-[11px] rounded-md border bg-background/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1">
              {TYPE_FILTERS.map((f) => {
                const count = typeCounts[f] ?? 0;
                if (f !== "all" && count === 0) return null;
                const active = typeFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border-transparent",
                    )}
                  >
                    {f === "all" ? "All" : (TYPE_META[f]?.label ?? f)} · {count}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {reqOpen && (
          <>
            {requirements.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic ml-1">
                No requirements yet.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic ml-1">
                No matches. Try clearing filters.
              </p>
            ) : (
              <div className="space-y-1">
                {filtered.map((req, i) => {
                  const meta = TYPE_META[req.type] ?? TYPE_META.functional;
                  const Icon = meta.icon;
                  const isFinalized =
                    req.status === "locked" || req.status === "approved";
                  const isExpanded = expandedId === req.id;
                  const ac = renderAcceptance(req.acceptance_criteria);

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className={cn(
                        "rounded-md border bg-card/40 overflow-hidden",
                        isExpanded && "ring-1 ring-primary/40 bg-card",
                      )}
                    >
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary/40 transition-colors"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full flex-shrink-0",
                            PRIORITY_DOT[req.priority] ?? PRIORITY_DOT.medium,
                          )}
                          title={`${req.priority} priority`}
                        />
                        <Icon className={cn("h-3 w-3 flex-shrink-0", meta.color)} />
                        <span className="font-mono text-[9px] text-muted-foreground flex-shrink-0">
                          {req.requirement_id}
                        </span>
                        <span className="text-[11px] truncate flex-1">{req.title}</span>
                        {isFinalized ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px]">
                              Finalized
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Clock className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px]">
                              Draft
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 text-muted-foreground/50 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="border-t bg-background/40"
                          >
                            <div className="px-3 py-2 space-y-2 text-[11px]">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                  {meta.label}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                  {req.priority}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] h-4 px-1.5",
                                    isFinalized
                                      ? "border-success/40 text-success"
                                      : "border-muted-foreground/30 text-muted-foreground",
                                  )}
                                >
                                  {isFinalized ? "Finalized" : "Draft"}
                                </Badge>
                                {req.category && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                                    {req.category}
                                  </Badge>
                                )}
                              </div>
                              {req.description ? (
                                <p className="text-muted-foreground leading-relaxed">
                                  {req.description}
                                </p>
                              ) : (
                                <p className="text-muted-foreground/60 italic text-[10px]">
                                  No description captured.
                                </p>
                              )}
                              {ac.length > 0 && (
                                <div>
                                  <p className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                                    Acceptance criteria
                                  </p>
                                  <ul className="space-y-0.5 list-disc list-inside marker:text-muted-foreground/50">
                                    {ac.map((line, idx) => (
                                      <li key={idx} className="text-[10.5px] leading-snug">
                                        {line}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {req.source && (
                                <p className="text-[9px] text-muted-foreground">
                                  <span className="font-semibold">Source:</span> {req.source}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
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
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="p-2 rounded-lg border bg-card/50 hover:bg-secondary/40 transition-colors"
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
                    </div>
                    {d.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-3 leading-relaxed">
                        {d.description}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-2 border-t">
        <GlossaryPanel variant="compact" />
      </div>
    </div>
  );
}
