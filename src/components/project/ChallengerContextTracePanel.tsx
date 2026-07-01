import { useEffect, useState } from "react";
import {
  Database,
  FileText,
  Lock,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  GitBranch,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
}

interface ContextTrace {
  primary_artifact?: {
    id: string;
    title: string;
    stage: number;
    status?: string;
    locked_at?: string | null;
    generated_by?: string | null;
    version?: number;
    created_at?: string;
  };
  requirements?: {
    total_count: number;
    included_count: number;
    included: Array<{ id: string; title: string; type?: string; priority?: string }>;
  };
  drivers?: {
    total_count: number;
    included_count: number;
    included: Array<{ label: string; category?: string; priority?: string }>;
  };
  upstream_decisions?: Array<{
    stage: number;
    agent?: string;
    title: string;
    locked: boolean;
    summary?: string;
  }>;
  project?: { name?: string | null };
  notes?: string;
  captured_at?: string;
}

/**
 * Shows the upstream artifacts and locked decisions the Challenger loaded
 * for the most recent run on this stage. Sourced from the challenger
 * artifact's _meta.context_trace, with a fallback to agent_runs.input.
 */
export default function ChallengerContextTracePanel({ projectId, stage, refreshKey }: Props) {
  const [trace, setTrace] = useState<ContextTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      // 1. Try latest challenger artifact for the stage
      const { data: artifacts } = await supabase
        .from("architecture_artifacts")
        .select("content, generated_by, title, created_at")
        .eq("project_id", projectId)
        .eq("stage", stage)
        .order("created_at", { ascending: false })
        .limit(20);

      let found: ContextTrace | null = null;
      const chal = (artifacts || []).find(
        (a: any) =>
          a.generated_by?.includes("Challenger") || a.title?.startsWith("Challenger Review:"),
      );
      if (chal) {
        const content = recoverArtifactContent(chal.content);
        const t = content?._meta?.context_trace;
        if (t && typeof t === "object") found = t as ContextTrace;
      }

      // 2. Fallback: most recent challenger agent_run input
      if (!found) {
        const { data: runs } = await supabase
          .from("agent_runs")
          .select("input, agent_name, created_at")
          .eq("project_id", projectId)
          .eq("stage", stage)
          .order("created_at", { ascending: false })
          .limit(10);
        const run = (runs || []).find((r: any) => r.agent_name?.includes("Challenger"));
        const t = (run?.input as any)?.context_trace;
        if (t && typeof t === "object") found = t as ContextTrace;
      }

      if (!cancelled) {
        setTrace(found);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, stage, refreshKey]);

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        Loading context trace…
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="rounded-md border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
        <Info className="h-3.5 w-3.5" />
        No context trace yet — run the Challenger to capture which inputs it used.
      </div>
    );
  }

  const reqs = trace.requirements;
  const drvs = trace.drivers;
  const primary = trace.primary_artifact;
  const upstream = trace.upstream_decisions || [];
  const isValidationStage = stage === 13;

  return (
    <TooltipProvider delayDuration={200}>
      <section className="rounded-md border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
          aria-expanded={open}
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Context Trace
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/70 hover:text-foreground transition-colors inline-flex"
                aria-label="What is the Context Trace?"
              >
                <HelpCircle className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-[11px] leading-relaxed">
              <p className="font-semibold mb-1">What is this?</p>
              <p>
                The exact inputs the Challenger Architect loaded for its review on this stage — the
                artifact under evaluation, prioritized requirements, and architectural drivers.
                {isValidationStage &&
                  " For Architecture Validation it also includes locked decisions from Stages 4–12."}
              </p>
              <p className="font-semibold mt-2 mb-1">Why it matters</p>
              <p>
                Reviews are only as good as their inputs. This makes the Challenger's reasoning
                auditable — you can see what was considered (and what wasn't) before accepting
                concerns.
              </p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1.5 ml-1 flex-wrap">
            {primary && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <FileText className="h-3 w-3" />1 artifact
              </Badge>
            )}
            {upstream.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 bg-primary/5 border-primary/30 text-primary"
              >
                <GitBranch className="h-3 w-3" />
                {upstream.length} upstream
              </Badge>
            )}
            {reqs && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Target className="h-3 w-3" />
                {reqs.included_count}/{reqs.total_count} reqs
              </Badge>
            )}
            {drvs && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Database className="h-3 w-3" />
                {drvs.included_count}/{drvs.total_count} drivers
              </Badge>
            )}
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            {open ? (
              <>
                Hide <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show details <ChevronDown className="h-3 w-3" />
              </>
            )}
          </span>
        </button>

        {open && (
          <div className="border-t px-3 py-3 space-y-3 bg-background/40">
            {isValidationStage && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-primary mb-0.5">
                  <Info className="h-3.5 w-3.5" />
                  Why Architecture Validation gets extra context
                </div>
                <p className="text-foreground/80">
                  Validation is a cross-stage check, not a standalone design step. The Challenger
                  also loads <strong>locked decisions from Stages 4–12</strong> (style,
                  decomposition, data, API, cross-cutting, infrastructure, quality, risks) so it can
                  flag inconsistencies between the validation report and what was actually decided
                  upstream — e.g. risks left unaddressed or quality scenarios missing.
                </p>
              </div>
            )}

            {/* Upstream locked decisions (Stage 13) */}
            {upstream.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" /> Upstream decisions inspected
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
                    ({upstream.length} stage{upstream.length === 1 ? "" : "s"})
                  </span>
                </div>
                <ul className="space-y-1">
                  {upstream.map((u) => (
                    <li
                      key={`${u.stage}-${u.title}`}
                      className="text-[11px] rounded border bg-card px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          Stage {u.stage}
                        </Badge>
                        <span className="flex-1 truncate font-medium">{u.title}</span>
                        {u.locked ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 bg-success/10 text-success border-success/30"
                          >
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      {u.summary && (
                        <p className="text-[10.5px] text-muted-foreground mt-1 line-clamp-2">
                          {u.summary}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Primary artifact */}
            {primary && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Primary artifact (subject of evaluation)
                </div>
                <div className="rounded border bg-card px-2.5 py-1.5 text-[11px] flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{primary.title}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      <span>Stage {primary.stage}</span>
                      {primary.version != null && <span>· v{primary.version}</span>}
                      {primary.status && <span>· {primary.status}</span>}
                      {primary.generated_by && (
                        <span className="truncate">· {primary.generated_by}</span>
                      )}
                    </div>
                  </div>
                  {primary.locked_at ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 bg-success/10 text-success border-success/30"
                    >
                      <Lock className="h-3 w-3" /> Locked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Draft
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Requirements */}
            {reqs && reqs.included.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Requirements consumed
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
                    ({reqs.included_count} of {reqs.total_count}, prioritized)
                  </span>
                </div>
                <ul className="space-y-1 max-h-44 overflow-auto pr-1">
                  {reqs.included.map((r) => (
                    <li
                      key={r.id}
                      className="text-[11px] flex items-center gap-2 rounded border bg-card px-2 py-1"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {r.id}
                      </span>
                      <span className="flex-1 truncate">{r.title}</span>
                      {r.priority && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            r.priority === "critical" &&
                              "bg-destructive/10 text-destructive border-destructive/30",
                            r.priority === "high" && "bg-warning/10 text-warning border-warning/30",
                          )}
                        >
                          {r.priority}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {reqs.total_count > reqs.included_count && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {reqs.total_count - reqs.included_count} lower-priority requirement(s) trimmed
                    to control prompt size.
                  </p>
                )}
              </div>
            )}

            {/* Drivers */}
            {drvs && drvs.included.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="h-3 w-3" /> Architecture drivers
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/80">
                    ({drvs.included_count} of {drvs.total_count})
                  </span>
                </div>
                <ul className="space-y-1">
                  {drvs.included.map((d, i) => (
                    <li
                      key={`${d.label}-${i}`}
                      className="text-[11px] flex items-center gap-2 rounded border bg-card px-2 py-1"
                    >
                      <span className="flex-1 truncate font-medium">{d.label}</span>
                      {d.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {d.category}
                        </Badge>
                      )}
                      {d.priority && (
                        <Badge variant="outline" className="text-[10px]">
                          {d.priority}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trace.notes && (
              <p className="text-[10px] text-muted-foreground border-t pt-2 leading-relaxed">
                {trace.notes}
              </p>
            )}
            {trace.captured_at && (
              <p className="text-[10px] text-muted-foreground/70">
                Captured {new Date(trace.captured_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
