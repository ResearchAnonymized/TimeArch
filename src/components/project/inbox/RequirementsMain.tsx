import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  ChevronRight,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  BookOpen,
  Link2,
  Zap,
  Box,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import StageToolPane from "./StageToolPane";
import { formatAcceptanceCriteria } from "@/lib/acceptance-criteria";


interface Requirement {
  id: string;
  requirement_id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  acceptance_criteria: unknown;
  source: string | null;
  category: string | null;
}

interface Driver {
  id: string;
  label: string;
  description: string | null;
  priority: string;
}

const TYPE_META: Record<string, { icon: typeof Target; label: string; color: string }> = {
  functional: { icon: Target, label: "Functional", color: "text-primary" },
  non_functional: { icon: Shield, label: "Non-functional", color: "text-emerald-500" },
  user_story: { icon: BookOpen, label: "User story", color: "text-violet-500" },
  constraint: { icon: Link2, label: "Constraint", color: "text-slate-400" },
  assumption: { icon: Zap, label: "Assumption", color: "text-amber-500" },
  dependency: { icon: Box, label: "Dependency", color: "text-cyan-500" },
};

const PRIORITY_PILL: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const TYPE_FILTERS = ["all", "functional", "non_functional", "constraint", "user_story"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

interface Props {
  projectId: string;
  refreshKey?: number;
  currentStage: number;
  projectName: string;
  projectDescription: string | null;
  advancing: boolean;
  onAdvance: (n: number) => void;
}

export default function RequirementsMain({
  projectId,
  refreshKey,
  currentStage,
  projectName,
  projectDescription,
  advancing,
  onAdvance,
}: Props) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"stage" | "requirements" | "drivers">("stage");

  // Which auxiliary tabs make sense for this stage.
  // Requirements are the artefact of stages 1–3 (Requirement Definition).
  // Drivers are produced at stage 4 and consumed by every downstream stage.
  const showRequirementsTab = currentStage <= 3;
  const showDriversTab = currentStage >= 4;

  // Whenever the user switches stage in the left rail, snap back to the
  // stage's own tool so they don't keep seeing the previous stage's list.
  useEffect(() => {
    setTab("stage");
    setExpandedId(null);
    setQuery("");
    setTypeFilter("all");
  }, [currentStage]);



  useEffect(() => {
    (async () => {
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
          .select("id, label, description, priority")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);
      if (reqRes.data) setRequirements(reqRes.data as Requirement[]);
      if (drvRes.data) setDrivers(drvRes.data);
    })();
  }, [projectId, refreshKey]);

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

  const renderAcceptance = formatAcceptanceCriteria;




  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Top bar */}
      <div className="border-b bg-card/60 backdrop-blur px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTab("stage")}
              className={cn(
                "text-sm font-display font-semibold pb-1 border-b-2 transition-colors",
                tab === "stage"
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              Stage tool
            </button>
            {showRequirementsTab && (
              <button
                onClick={() => setTab("requirements")}
                className={cn(
                  "text-sm font-display font-semibold pb-1 border-b-2 transition-colors",
                  tab === "requirements"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                Requirements
                <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                  {requirements.length}
                </Badge>
              </button>
            )}
            {showDriversTab && (
              <button
                onClick={() => setTab("drivers")}
                className={cn(
                  "text-sm font-display font-semibold pb-1 border-b-2 transition-colors",
                  tab === "drivers"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground",
                )}
              >
                Drivers
                <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                  {drivers.length}
                </Badge>
              </button>
            )}

          </div>

        </div>

        {tab === "requirements" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search requirements…"
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md border bg-background/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
                      "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
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
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "stage" ? (
          <StageToolPane
            projectId={projectId}
            currentStage={currentStage}
            projectName={projectName}
            projectDescription={projectDescription}
            advancing={advancing}
            onAdvance={onAdvance}
          />
        ) : tab === "requirements" ? (

          requirements.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No requirements yet"
              hint="Add requirements in Stage 1 (Project setup) to populate this list."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              hint="Try clearing filters or adjusting your search."
            />
          ) : (
            <div className="space-y-1.5 max-w-4xl">
              {filtered.map((req, i) => {
                const meta = TYPE_META[req.type] ?? TYPE_META.functional;
                const Icon = meta.icon;
                const isFinalized = req.status === "locked" || req.status === "approved";
                const isExpanded = expandedId === req.id;
                const ac = renderAcceptance(req.acceptance_criteria);
                const pill = PRIORITY_PILL[req.priority] ?? PRIORITY_PILL.medium;
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2) }}
                    className={cn(
                      "rounded-lg border bg-card/40 overflow-hidden",
                      isExpanded && "ring-1 ring-primary/40 bg-card shadow-sm",
                    )}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground w-14 flex-shrink-0">
                        {req.requirement_id}
                      </span>
                      <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", meta.color)} />
                      <span className="text-sm truncate flex-1">{req.title}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize flex-shrink-0",
                          pill,
                        )}
                      >
                        {req.priority}
                      </span>
                      {isFinalized ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                      )}
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground/50 transition-transform flex-shrink-0",
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
                          <div className="px-4 py-3 space-y-3 text-xs">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {meta.label}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {isFinalized ? "Finalized" : "Draft"}
                              </Badge>
                              {req.category && (
                                <Badge variant="outline" className="text-[10px]">
                                  {req.category}
                                </Badge>
                              )}
                            </div>
                            {req.description ? (
                              <p className="text-muted-foreground leading-relaxed">
                                {req.description}
                              </p>
                            ) : (
                              <p className="text-muted-foreground/60 italic">
                                No description captured.
                              </p>
                            )}
                            {ac.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                                  Acceptance criteria
                                </p>
                                <ul className="space-y-0.5 list-disc list-inside marker:text-muted-foreground/50">
                                  {ac.map((line, idx) => (
                                    <li key={idx} className="leading-snug">
                                      {line}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {req.source && (
                              <p className="text-[10px] text-muted-foreground">
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
          )
        ) : drivers.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No architecture drivers yet"
            hint="Drivers appear after Stage 4 (Architecture Drivers) runs."
          />
        ) : (
          <div className="space-y-2 max-w-4xl">
            {drivers.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
                className="p-3 rounded-lg border bg-card/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-display font-semibold flex-1">{d.label}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize",
                      PRIORITY_PILL[d.priority] ?? PRIORITY_PILL.medium,
                    )}
                  >
                    {d.priority}
                  </span>
                </div>
                {d.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof FileText;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <Icon className="h-8 w-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>
    </div>
  );
}
