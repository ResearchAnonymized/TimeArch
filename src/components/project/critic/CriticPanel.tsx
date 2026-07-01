import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Verdict = "approve" | "revise" | "reject";
type Severity = "info" | "minor" | "major" | "critical";

interface Review {
  id: string;
  target_key: string;
  target_label: string | null;
  verdict: Verdict;
  severity: Severity;
  rationale: string | null;
  suggested_rewrite: string | null;
  violated_rules: string[];
  created_at: string;
}

const VERDICT_META: Record<Verdict, { label: string; icon: any; cls: string; chipCls: string }> = {
  approve: {
    label: "Approve",
    icon: CheckCircle2,
    cls: "text-success",
    chipCls: "bg-success/10 text-success border-success/30",
  },
  revise: {
    label: "Revise",
    icon: AlertTriangle,
    cls: "text-warning",
    chipCls: "bg-warning/10 text-warning border-warning/30",
  },
  reject: {
    label: "Reject",
    icon: XCircle,
    cls: "text-destructive",
    chipCls: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

const SEVERITY_CLS: Record<Severity, string> = {
  info: "bg-muted text-muted-foreground border-border",
  minor: "bg-primary/10 text-primary border-primary/30",
  major: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

interface Props {
  projectId: string;
  stage: 2 | 3;
  itemTypeLabel: string; // e.g. "requirements" or "drivers"
}

export default function CriticPanel({ projectId, stage, itemTypeLabel }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("requirement_reviews")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });
    setReviews((data as any) || []);
    setLoading(false);
  }, [projectId, stage]);

  useEffect(() => {
    load();
  }, [load]);

  const runCritic = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("critic-agent", {
        body: { projectId, stage },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error, { description: data.detail });
      } else {
        toast.success(`Critic reviewed ${data.reviewed} ${itemTypeLabel}`, {
          description: `Approve ${data.summary.approve} · Revise ${data.summary.revise} · Reject ${data.summary.reject}`,
        });
        await load();
      }
    } catch (e: any) {
      toast.error("Critic agent failed", { description: e.message || String(e) });
    } finally {
      setRunning(false);
    }
  };

  const counts = {
    approve: reviews.filter((r) => r.verdict === "approve").length,
    revise: reviews.filter((r) => r.verdict === "revise").length,
    reject: reviews.filter((r) => r.verdict === "reject").length,
  };

  const filtered = filter === "all" ? reviews : reviews.filter((r) => r.verdict === filter);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Gavel className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sm">Requirement Critic</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Independent AI peer-review of {itemTypeLabel} against ISO/IEC/IEEE 29148 + INCOSE
          </p>
        </div>
        <Button size="sm" onClick={runCritic} disabled={running} className="gap-2">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {reviews.length === 0 ? "Run Critic" : "Re-run"}
        </Button>
      </div>

      {reviews.length === 0 && !loading ? (
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No critic reviews yet. Click{" "}
            <span className="font-medium text-foreground">Run Critic</span> to audit your{" "}
            {itemTypeLabel}.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20 flex-wrap">
            {(["all", "approve", "revise", "reject"] as const).map((f) => {
              const count = f === "all" ? reviews.length : counts[f];
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {f === "all" ? "All" : VERDICT_META[f].label}{" "}
                  <span className="tabular-nums opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="divide-y">
            <AnimatePresence initial={false}>
              {filtered.map((r) => {
                const meta = VERDICT_META[r.verdict];
                const Icon = meta.icon;
                const isOpen = !!expanded[r.id];
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="px-4 py-3"
                  >
                    <button
                      onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.cls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {r.target_key}
                          </span>
                          <span className="text-sm font-medium truncate">{r.target_label}</span>
                        </div>
                        {r.rationale && !isOpen && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {r.rationale}
                          </p>
                        )}
                      </div>
                      <Badge className={`text-[9px] border ${meta.chipCls}`}>{meta.label}</Badge>
                      <Badge className={`text-[9px] border ${SEVERITY_CLS[r.severity]}`}>
                        {r.severity}
                      </Badge>
                    </button>

                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 ml-11 space-y-2.5"
                      >
                        {r.rationale && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              Rationale
                            </div>
                            <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                              {r.rationale}
                            </p>
                          </div>
                        )}
                        {r.suggested_rewrite && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              Suggested rewrite
                            </div>
                            <p className="text-[12.5px] text-foreground/90 leading-relaxed bg-muted/40 border rounded-md p-2.5">
                              {r.suggested_rewrite}
                            </p>
                          </div>
                        )}
                        {r.violated_rules?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.violated_rules.map((rule) => (
                              <Badge
                                key={rule}
                                variant="outline"
                                className="text-[9px] font-mono border-warning/30 text-warning"
                              >
                                {rule}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                No items match this filter.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
