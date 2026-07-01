import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Info,
  Inbox,
  CheckCircle2,
  Swords,
  CheckCheck,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChallengerDecisions, type DecisionType } from "@/hooks/useChallengerDecisions";
import { toast } from "sonner";
import ChallengerVerdictHeader from "./challenger/ChallengerVerdictHeader";
import ChallengerFilters, {
  type SeverityFilter,
  type StatusFilter,
  type ViewMode,
} from "./challenger/ChallengerFilters";
import ChallengerConcernRow from "./challenger/ChallengerConcernRow";
import { CATEGORY_META, normalizeCategory, SEVERITY_RANK } from "./challenger/challengerHelpers";
import { derivePlainLanguage } from "./challenger/challengerPlainLanguage";
import CycleTimeline from "./challenger/CycleTimeline";
import { cn } from "@/lib/utils";

type BoardColumnKey = "open" | "accepted" | "modified" | "rejected";
const COLUMN_TO_DECISION: Record<Exclude<BoardColumnKey, "open">, DecisionType> = {
  accepted: "accept",
  modified: "modify",
  rejected: "reject",
};

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  onRefine: (bundle: any) => Promise<void> | void;
  /** Trigger the Challenger Architect manually (challenge_only mode). */
  onChallenge?: () => Promise<void> | void;
  refining?: boolean;
  /** True while the Challenger Architect is being run. */
  challenging?: boolean;
  /** Called when the user locks & advances directly from the Challenger header. */
  onAdvance?: (nextStage: number) => void;
}

type EnrichedItem = { c: any; i: number; priority: number };

export default function ChallengerReviewPanel({
  projectId,
  stage,
  refreshKey,
  onRefine,
  onChallenge,
  refining,
  challenging,
  onAdvance,
}: Props) {
  const {
    loading,
    concerns,
    reviewMeta,
    decisions,
    cycle,
    decidedCount,
    acceptedCount,
    allDecided,
    canRefine,
    noProblemsRemaining,
    keptMaterialCount,
    setDecision,
    buildRefinementBundle,
    primaryArtifactId,
    primaryArtifactMeta,
    challengerArtifactMeta,
    latestRefinedMeta,
    lastDecisionAt,
  } = useChallengerDecisions(projectId, stage, refreshKey);

  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("board");
  const [showEmptyColumns, setShowEmptyColumns] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const concernIndex = (active.data.current as any)?.concernIndex;
    const dropTarget = String(over.id) as BoardColumnKey;
    if (typeof concernIndex !== "number") return;

    const current = decisions[concernIndex]?.decision ?? null;
    if (dropTarget === "open") {
      // Drop on "To review" — only meaningful if there is an existing decision
      if (current === null) return;
      // Re-opening requires hook support; for now, no-op with a hint.
      toast.info("Use Keep / Revise / Dismiss to change a decision.");
      return;
    }
    const nextDecision = COLUMN_TO_DECISION[dropTarget];
    if (current === nextDecision) return;
    try {
      await setDecision(concernIndex, nextDecision);
    } catch {
      toast.error("Could not move concern.");
    }
  };

  const counts = useMemo(() => {
    const all = concerns.map((_, i) => decisions[i]);
    return {
      open: all.filter((d) => !d).length,
      accepted: all.filter((d) => d?.decision === "accept").length,
      modified: all.filter((d) => d?.decision === "modify").length,
      rejected: all.filter((d) => d?.decision === "reject").length,
    };
  }, [concerns, decisions]);

  // Enrich + filter
  const filtered: EnrichedItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concerns
      .map((c, i) => ({ c, i, priority: derivePlainLanguage(c).priorityScore }))
      .filter(({ c, i }) => {
        if (severity !== "all" && (c.severity || "medium") !== severity) return false;
        const d = decisions[i];
        if (status === "open" && d) return false;
        if (status === "accepted" && d?.decision !== "accept") return false;
        if (status === "modified" && d?.decision !== "modify") return false;
        if (status === "rejected" && d?.decision !== "reject") return false;
        if (!q) return true;
        return (
          (c.issue || "").toLowerCase().includes(q) ||
          (c.evidence || "").toLowerCase().includes(q) ||
          (c.alternative_approach || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q)
        );
      });
  }, [concerns, decisions, query, severity, status]);

  // Top 3 must-address (from full set, undecided + highest priority)
  const top3: EnrichedItem[] = useMemo(() => {
    return concerns
      .map((c, i) => ({ c, i, priority: derivePlainLanguage(c).priorityScore }))
      .filter(({ i }) => !decisions[i])
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  }, [concerns, decisions]);
  const top3Indexes = useMemo(() => new Set(top3.map((x) => x.i)), [top3]);

  // Group by category for List view
  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedItem[]>();
    for (const item of filtered) {
      const key = normalizeCategory(item.c.category);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (SEVERITY_RANK[a.c.severity] ?? 9) - (SEVERITY_RANK[b.c.severity] ?? 9));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Board columns
  const columns = useMemo(() => {
    const open: EnrichedItem[] = [];
    const accepted: EnrichedItem[] = [];
    const modified: EnrichedItem[] = [];
    const rejected: EnrichedItem[] = [];
    for (const item of filtered) {
      const d = decisions[item.i];
      if (!d) open.push(item);
      else if (d.decision === "accept") accepted.push(item);
      else if (d.decision === "modify") modified.push(item);
      else if (d.decision === "reject") rejected.push(item);
    }
    open.sort((a, b) => b.priority - a.priority);
    return { open, accepted, modified, rejected };
  }, [filtered, decisions]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading Challenger review…
      </div>
    );
  }

  // No concerns yet — two distinct empty states:
  //   1) Challenger has NEVER run on this primary → show "Challenge this recommendation" CTA.
  //   2) Challenger HAS run and returned zero concerns → show clean-bill-of-health state
  //      with any strengths the Challenger acknowledged + a "Re-run review" CTA.
  if (concerns.length === 0) {
    if (!primaryArtifactId) return null;

    const hasRunBefore = !!reviewMeta;
    const strengths: string[] = Array.isArray(reviewMeta?.strengths_acknowledged)
      ? reviewMeta.strengths_acknowledged.filter(
          (s: any) => typeof s === "string" && s.trim().length > 0,
        )
      : [];
    const reviewVerdict: string | undefined = reviewMeta?.verdict;
    const reviewConfidence: number | undefined =
      typeof reviewMeta?.confidence === "number" ? reviewMeta.confidence : undefined;

    if (hasRunBefore) {
      // CASE 2 — Challenger ran but found nothing to flag.
      return (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-success/30 bg-success/5 overflow-hidden"
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-success/15 flex items-center justify-center flex-shrink-0">
                <CheckCheck className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">No concerns raised</h3>
                  {reviewVerdict && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <ShieldCheck className="h-3 w-3" />
                      {reviewVerdict.replace(/_/g, " ")}
                    </span>
                  )}
                  {typeof reviewConfidence === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success tabular-nums">
                      {Math.round(reviewConfidence)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  The Challenger Architect reviewed this recommendation in evidence-only mode and
                  found <span className="font-medium text-foreground">no material concerns</span>{" "}
                  worth flagging. You can lock the stage with confidence, or request a fresh
                  re-review if the recommendation has changed since.
                </p>

                {strengths.length > 0 ? (
                  <div className="mt-4 rounded-md border border-success/20 bg-background/60 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                      <Sparkles className="h-3 w-3" />
                      Strengths the Challenger acknowledged ({strengths.length})
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {strengths.slice(0, 6).map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-foreground/85"
                        >
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                          <span className="break-words">{s}</span>
                        </li>
                      ))}
                    </ul>
                    {strengths.length > 6 && (
                      <div className="mt-1.5 text-[10.5px] text-muted-foreground italic">
                        +{strengths.length - 6} more in the full review record.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-success/30 bg-background/60 p-3 text-[11.5px] text-muted-foreground italic">
                    The Challenger did not list specific strengths — only a clean verdict.
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChallenge?.()}
                    disabled={!onChallenge || challenging}
                    className="h-8 border-success/40 text-success hover:bg-success/10 hover:text-success"
                  >
                    {challenging ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {challenging ? "Re-reviewing…" : "Request re-review"}
                  </Button>
                  {onAdvance && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onAdvance(stage + 1)}
                      className="h-8"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Lock & advance
                    </Button>
                  )}
                  <span className="text-[10.5px] text-muted-foreground">
                    Re-review re-runs the Challenger against the current recommendation — useful
                    after edits.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      );
    }

    // CASE 1 — Challenger has never run.
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-dashed bg-card p-5"
      >
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Swords className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Challenge this recommendation?
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              The Challenger Architect performs an independent, scientific critique of the current
              recommendation — surfacing weaknesses, blind spots, and alternative approaches. Run it
              only if you want a second opinion before locking the stage.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => onChallenge?.()}
                disabled={!onChallenge || challenging}
                className="h-8"
              >
                {challenging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Swords className="h-3.5 w-3.5" />
                )}
                {challenging ? "Challenger reviewing…" : "Challenge this recommendation"}
              </Button>
              <span className="text-[10.5px] text-muted-foreground">
                Optional · You can lock the stage without running this.
              </span>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  const handleQuick = async (i: number, decision: DecisionType) => {
    await setDecision(i, decision);
  };

  const handleSaveModify = async (i: number, modification: string, rationale: string) => {
    if (!modification.trim()) {
      toast.error("Please describe your modification.");
      return;
    }
    await setDecision(i, "modify", modification, rationale);
  };

  const remaining = concerns.length - decidedCount;
  const progressPct = concerns.length > 0 ? (decidedCount / concerns.length) * 100 : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <ChallengerVerdictHeader
        cycle={cycle}
        decidedCount={decidedCount}
        totalConcerns={concerns.length}
        acceptedCount={acceptedCount}
        reviewMeta={reviewMeta}
        projectId={projectId}
        stage={stage}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
      />

      <CycleTimeline
        cycle={cycle}
        hasChallenger={concerns.length > 0}
        totalConcerns={concerns.length}
        decidedCount={decidedCount}
        acceptedCount={counts.accepted}
        modifiedCount={counts.modified}
        rejectedCount={counts.rejected}
        refining={refining}
        primaryCreatedAt={primaryArtifactMeta?.created_at}
        primaryTitle={primaryArtifactMeta?.title}
        primaryVersion={primaryArtifactMeta?.version}
        challengerCreatedAt={challengerArtifactMeta?.created_at}
        lastDecisionAt={lastDecisionAt}
        refinedCreatedAt={latestRefinedMeta?.created_at ?? primaryArtifactMeta?.created_at}
        refinedTitle={latestRefinedMeta?.title}
        refinedVersion={latestRefinedMeta?.version}
        refinedCycle={latestRefinedMeta?.cycle ?? cycle}
      />

      <ChallengerFilters
        query={query}
        setQuery={setQuery}
        severity={severity}
        setSeverity={setSeverity}
        status={status}
        setStatus={setStatus}
        view={view}
        setView={setView}
        counts={counts}
      />

      {/* Sticky progress strip */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                allDecided ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-medium tabular-nums whitespace-nowrap">
            {decidedCount}/{concerns.length} decided
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {remaining > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning border border-warning/30 px-2 py-0.5 font-semibold">
                <AlertTriangle className="h-3 w-3" /> {remaining} left to decide
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success border border-success/30 px-2 py-0.5 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> All decided — ready to refine
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3 max-h-[720px] overflow-y-auto">
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Review one concern at a time. Use{" "}
          <span className="font-medium text-foreground">Keep</span>,{" "}
          <span className="font-medium text-foreground">Revise</span>, or{" "}
          <span className="font-medium text-foreground">Dismiss</span>. Open a card only if you need
          the supporting detail.
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
            <Inbox className="h-4 w-4" />
            No concerns match the current filters.
          </div>
        ) : view === "board" ? (
          /* KANBAN BOARD VIEW — drag concerns between columns; empty columns hidden by default */
          (() => {
            const allCols: Array<{
              key: BoardColumnKey;
              title: string;
              accent: string;
              headerBg: string;
              borderTone: string;
              items: EnrichedItem[];
              emptyText: string;
              showHighlight?: boolean;
            }> = [
              {
                key: "open",
                title: "To review",
                accent: "text-warning",
                headerBg: "bg-warning/10",
                borderTone: "border-l-4 border-l-warning",
                items: columns.open,
                emptyText: "Nothing left here 🎉",
                showHighlight: true,
              },
              {
                key: "accepted",
                title: "Kept",
                accent: "text-success",
                headerBg: "bg-success/10",
                borderTone: "border-l-4 border-l-success",
                items: columns.accepted,
                emptyText: "Drop here to keep",
              },
              {
                key: "modified",
                title: "Revised",
                accent: "text-primary",
                headerBg: "bg-primary/10",
                borderTone: "border-l-4 border-l-primary",
                items: columns.modified,
                emptyText: "Drop here to revise",
              },
              {
                key: "rejected",
                title: "Dismissed",
                accent: "text-muted-foreground",
                headerBg: "bg-muted/40",
                borderTone: "border-l-4 border-l-muted-foreground/40",
                items: columns.rejected,
                emptyText: "Drop here to dismiss",
              },
            ];

            const visibleCols = showEmptyColumns
              ? allCols
              : allCols.filter((col) => col.items.length > 0 || col.key === "open");
            const hiddenCount = allCols.length - visibleCols.length;

            return (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="space-y-2">
                  {hiddenCount > 0 && !showEmptyColumns && (
                    <button
                      type="button"
                      onClick={() => setShowEmptyColumns(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed bg-background px-2.5 py-1 text-[10.5px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="Show empty columns"
                    >
                      <Eye className="h-3 w-3" /> Show {hiddenCount} empty column
                      {hiddenCount === 1 ? "" : "s"}
                    </button>
                  )}
                  {showEmptyColumns && (
                    <button
                      type="button"
                      onClick={() => setShowEmptyColumns(false)}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[10.5px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="Hide empty columns"
                    >
                      <EyeOff className="h-3 w-3" /> Hide empty columns
                    </button>
                  )}

                  <div
                    className={cn(
                      "grid gap-3 grid-cols-1",
                      visibleCols.length >= 2 && "md:grid-cols-2",
                      visibleCols.length >= 3 && "[@media(min-width:1400px)]:grid-cols-3",
                      visibleCols.length >= 4 && "[@media(min-width:1700px)]:grid-cols-4",
                    )}
                  >
                    {visibleCols.map((col) => (
                      <DroppableBoardColumn
                        key={col.key}
                        id={col.key}
                        title={col.title}
                        accent={col.accent}
                        headerBg={col.headerBg}
                        borderTone={col.borderTone}
                        items={col.items}
                        emptyText={col.emptyText}
                      >
                        {col.items.map(({ c, i }) => (
                          <ChallengerConcernRow
                            key={i}
                            index={i}
                            concern={c}
                            decision={decisions[i]}
                            counterArguments={reviewMeta?.counter_arguments || []}
                            refining={refining}
                            highlight={col.showHighlight && top3Indexes.has(i)}
                            compact
                            draggable
                            onQuickDecision={handleQuick}
                            onSaveModification={handleSaveModify}
                          />
                        ))}
                      </DroppableBoardColumn>
                    ))}
                  </div>
                </div>
              </DndContext>
            );
          })()
        ) : (
          /* GROUPED LIST VIEW */
          grouped.map(([catKey, items]) => {
            const meta = CATEGORY_META[catKey as keyof typeof CATEGORY_META];
            const Icon = meta.icon;
            return (
              <div key={catKey} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Icon className={`h-3 w-3 ${meta.tone}`} />
                  {meta.label}
                  <span className="opacity-60">· {items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(({ c, i }) => (
                    <ChallengerConcernRow
                      key={i}
                      index={i}
                      concern={c}
                      decision={decisions[i]}
                      counterArguments={reviewMeta?.counter_arguments || []}
                      refining={refining}
                      highlight={top3Indexes.has(i)}
                      showCategory={false}
                      onQuickDecision={handleQuick}
                      onSaveModification={handleSaveModify}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / refinement CTA */}
      <footer className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {cycle >= 2 ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Refinement cycle limit reached (max 1 refinement). Lock the stage when satisfied.
            </>
          ) : !allDecided ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              {remaining} concern{remaining === 1 ? "" : "s"} still undecided — decide every concern
              (Keep / Revise / Dismiss) to enable refinement.
            </>
          ) : acceptedCount === 0 ? (
            <>
              <Info className="h-3.5 w-3.5" />
              All concerns dismissed — nothing to refine. You can lock the recommendation.
            </>
          ) : noProblemsRemaining ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              No critical or high-severity problems remain — a second round isn't needed. You can
              lock the recommendation as-is.
            </>
          ) : (
            <>
              <Info className="h-3.5 w-3.5 text-primary" />
              {keptMaterialCount} material problem{keptMaterialCount === 1 ? "" : "s"} kept — refine
              the recommendation to address {keptMaterialCount === 1 ? "it" : "them"}.
            </>
          )}
        </div>
        <Button
          size="sm"
          variant="default"
          disabled={!canRefine || refining}
          onClick={() => onRefine(buildRefinementBundle())}
          className="h-8"
          title={
            cycle >= 2
              ? "Refinement limit reached"
              : !allDecided
                ? `${remaining} concern(s) still undecided`
                : acceptedCount === 0
                  ? "No Keep/Revise decisions to refine from"
                  : noProblemsRemaining
                    ? "No material problems remain — refinement isn't needed"
                    : "Refine using selected concerns"
          }
        >
          {refining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refine recommendation
        </Button>
      </footer>
    </motion.section>
  );
}

function DroppableBoardColumn({
  id,
  title,
  accent,
  headerBg,
  borderTone,
  items,
  emptyText,
  children,
}: {
  id: BoardColumnKey;
  title: string;
  accent: string;
  headerBg: string;
  borderTone: string;
  items: EnrichedItem[];
  emptyText: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border bg-muted/10 flex flex-col min-h-[120px] transition-colors",
        borderTone,
        isOver && "bg-primary/5 border-primary/40 ring-1 ring-primary/30",
      )}
    >
      <div className={cn("px-2.5 py-1.5 border-b flex items-center justify-between", headerBg)}>
        <span className={cn("text-[10.5px] font-semibold uppercase tracking-wider", accent)}>
          {title}
        </span>
        <span
          className={cn(
            "text-[10px] rounded-full border bg-background/70 px-1.5 py-0.5 font-semibold tabular-nums",
            accent,
          )}
        >
          {items.length}
        </span>
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {items.length === 0 ? (
          <div
            className={cn(
              "text-[10.5px] italic text-center py-6 rounded-md border border-dashed",
              isOver
                ? "text-primary border-primary/40 bg-primary/5"
                : "text-muted-foreground border-transparent",
            )}
          >
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
