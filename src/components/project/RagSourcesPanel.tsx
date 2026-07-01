import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Tag,
  Sparkles,
  Library,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RagSource {
  ref: string;
  id: string;
  framework: string;
  category: string;
  title: string;
  relevance: number;
  tags?: string[];
}

interface Props {
  sources: RagSource[];
  className?: string;
}

const FRAMEWORK_META: Record<string, { label: string; color: string; icon: string }> = {
  aws_well_architected: {
    label: "AWS Well-Architected",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
    icon: "☁️",
  },
  iso_25010: {
    label: "ISO 25010",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
    icon: "📐",
  },
  togaf: {
    label: "TOGAF",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    icon: "🏛️",
  },
  patterns: {
    label: "Architecture Patterns",
    color: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25",
    icon: "🧩",
  },
};

function RelevanceBar({ value }: { value: number }) {
  const normalized = Math.min(Math.max(value * 25, 5), 100); // scale up for visibility
  const color =
    normalized > 60 ? "bg-success" : normalized > 30 ? "bg-warning" : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${normalized}%` }}
        />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export default function RagSourcesPanel({ sources, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Group by framework
  const grouped = sources.reduce<Record<string, RagSource[]>>((acc, s) => {
    const key = s.framework || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const frameworkCount = Object.keys(grouped).length;

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <Library className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-display font-semibold flex-1">Knowledge Sources</span>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[10px] font-mono px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20"
          >
            {sources.length} refs
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">
            {frameworkCount} {frameworkCount === 1 ? "framework" : "frameworks"}
          </Badge>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t pt-3">
              {Object.entries(grouped).map(([framework, items]) => {
                const meta = FRAMEWORK_META[framework] || {
                  label: framework,
                  color: "bg-secondary text-muted-foreground border-border",
                  icon: "📄",
                };
                return (
                  <div key={framework} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{meta.icon}</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          meta.color,
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="space-y-1 ml-4">
                      {items.map((source) => (
                        <div
                          key={source.id}
                          className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-secondary/40 hover:bg-secondary/70 transition-colors"
                        >
                          <span className="text-[10px] font-mono font-bold text-primary mt-0.5 flex-shrink-0">
                            [{source.ref}]
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground leading-tight truncate">
                              {source.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {source.category?.replace(/_/g, " ")}
                              </span>
                              <RelevanceBar value={source.relevance} />
                            </div>
                            {source.tags && source.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {source.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[9px] px-1.5 py-0 rounded bg-muted text-muted-foreground"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {source.tags.length > 4 && (
                                  <span className="text-[9px] text-muted-foreground">
                                    +{source.tags.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>Agent output grounded in {sources.length} authoritative references</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
