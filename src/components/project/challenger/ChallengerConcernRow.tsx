import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import {
  Check,
  ChevronDown,
  Edit3,
  Gauge,
  GripVertical,
  Lightbulb,
  MessageSquareQuote,
  Sparkles,
  Target,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChallengerDecisionRow, DecisionType } from "@/hooks/useChallengerDecisions";
import { cn } from "@/lib/utils";
import { CATEGORY_META, SEVERITY_STYLES, normalizeCategory } from "./challengerHelpers";
import { derivePlainLanguage, RECOMMENDATION_META } from "./challengerPlainLanguage";

interface Props {
  index: number;
  concern: any;
  decision?: ChallengerDecisionRow;
  counterArguments: any[];
  refining?: boolean;
  highlight?: boolean;
  showCategory?: boolean;
  /** Compact card layout — used in Kanban columns to maximize density. */
  compact?: boolean;
  /** Enable drag handle (Kanban). */
  draggable?: boolean;
  onQuickDecision: (i: number, d: DecisionType) => void;
  onSaveModification: (i: number, modification: string, rationale: string) => Promise<void> | void;
}

const DECISION_META = {
  accept: {
    label: "Kept",
    icon: Check,
    tone: "text-success",
    badge: "bg-success/10 border-success/30 text-success",
  },
  modify: {
    label: "Revised",
    icon: Edit3,
    tone: "text-primary",
    badge: "bg-primary/10 border-primary/30 text-primary",
  },
  reject: {
    label: "Dismissed",
    icon: X,
    tone: "text-muted-foreground",
    badge: "bg-muted border-border text-muted-foreground",
  },
} as const;

export default function ChallengerConcernRow({
  index,
  concern,
  decision,
  counterArguments,
  refining,
  highlight,
  showCategory = true,
  compact = false,
  draggable = false,
  onQuickDecision,
  onSaveModification,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [draft, setDraft] = useState({
    modification: decision?.modification || concern.alternative_approach || "",
    rationale: decision?.architect_rationale || "",
  });

  const dnd = useDraggable({
    id: `concern-${index}`,
    data: { concernIndex: index, currentDecision: decision?.decision ?? null },
    disabled: !draggable || refining,
  });

  const cat = normalizeCategory(concern.category);
  const meta = CATEGORY_META[cat];
  const Icon = meta.icon;
  const sevCls = SEVERITY_STYLES[concern.severity] || SEVERITY_STYLES.medium;
  const plain = derivePlainLanguage(concern);
  const recMeta = RECOMMENDATION_META[plain.recommendation];
  const decisionMeta = decision ? DECISION_META[decision.decision] : null;
  const DecisionIcon = decisionMeta?.icon;

  const relatedCounters =
    counterArguments?.filter(
      (c: any) =>
        c?.claim &&
        (concern.issue?.toLowerCase().includes(c.claim.slice(0, 18).toLowerCase()) ||
          c.claim.toLowerCase().includes(concern.issue?.slice(0, 18).toLowerCase() || "x")),
    ) || [];

  return (
    <motion.div
      ref={dnd.setNodeRef}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      style={
        dnd.transform
          ? { transform: `translate3d(${dnd.transform.x}px, ${dnd.transform.y}px, 0)`, zIndex: 50 }
          : undefined
      }
      className={cn(
        "rounded-md border transition-colors overflow-hidden",
        decision?.decision === "accept" && "border-success/40 bg-success/5",
        decision?.decision === "modify" && "border-primary/40 bg-primary/5",
        decision?.decision === "reject" && "border-muted bg-muted/30",
        !decision && "bg-background hover:bg-muted/15",
        highlight && !decision && "ring-1 ring-warning/40 border-warning/40",
        dnd.isDragging && "shadow-lg ring-2 ring-primary/40 cursor-grabbing",
      )}
    >
      <div className={cn(compact ? "p-2" : "p-3")}>
        <div className="flex items-start gap-1.5 min-w-0">
          {draggable && (
            <button
              type="button"
              {...dnd.listeners}
              {...dnd.attributes}
              className="mt-0.5 flex h-5 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground active:cursor-grabbing"
              aria-label="Drag to move"
              title="Drag to another column"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted/60"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {highlight && !decision && (
                <Badge className="h-4 gap-1 border border-warning/30 bg-warning/15 px-1.5 text-[9.5px] text-warning">
                  <Target className="h-2.5 w-2.5" /> Start here
                </Badge>
              )}
              <Badge className={cn("h-4 border px-1.5 text-[9.5px]", sevCls)}>
                {concern.severity || "medium"}
              </Badge>
              {showCategory && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Icon className={cn("h-3 w-3", meta.tone)} />
                  {meta.label}
                </span>
              )}
              {!compact && <ConfidenceBadge confidence={concern.confidence} />}
              {!decision && !compact && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                    recMeta.bg,
                  )}
                >
                  <Lightbulb className={cn("h-3 w-3", recMeta.tone)} />
                  <span className={cn("font-medium", recMeta.tone)}>{recMeta.label}</span>
                </span>
              )}
              {decisionMeta && DecisionIcon && !compact && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                    decisionMeta.badge,
                  )}
                >
                  <DecisionIcon className={cn("h-3 w-3", decisionMeta.tone)} />
                  <span className="font-medium">{decisionMeta.label}</span>
                </span>
              )}
            </div>

            <h4
              className={cn(
                "font-semibold leading-snug text-foreground break-words [overflow-wrap:anywhere]",
                compact ? "mt-1.5 text-[12.5px]" : "mt-2 text-sm",
              )}
            >
              {concern.issue}
            </h4>

            {compact ? (
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground break-words line-clamp-2">
                {plain.what}
              </p>
            ) : (
              <dl className="mt-2 grid gap-2 lg:grid-cols-2">
                <InfoBlock label="What this means" value={plain.what} />
                <InfoBlock label="What to do" value={plain.action} />
              </dl>
            )}

            {decision?.modification && !compact && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground break-words">
                <span className="font-medium text-foreground">Saved revision:</span>{" "}
                {decision.modification}
              </p>
            )}
          </div>
        </div>

        <div
          className={cn("flex flex-wrap items-center gap-1.5", compact ? "mt-2 pl-6" : "mt-3 pl-7")}
        >
          <Button
            size="sm"
            variant={decision?.decision === "accept" ? "success" : "outline"}
            className={cn(compact ? "h-6 px-2 text-[10.5px]" : "h-7 px-2.5 text-[11px]")}
            disabled={refining}
            onClick={() => onQuickDecision(index, "accept")}
            title="Keep this concern"
          >
            <Check className="h-3 w-3" /> Keep
          </Button>
          <Button
            size="sm"
            variant={decision?.decision === "modify" ? "default" : "outline"}
            className={cn(compact ? "h-6 px-2 text-[10.5px]" : "h-7 px-2.5 text-[11px]")}
            disabled={refining}
            onClick={() => {
              setExpanded(true);
              setModifyOpen((v) => !v);
            }}
            title="Revise before sending forward"
          >
            <Edit3 className="h-3 w-3" /> Revise
          </Button>
          <Button
            size="sm"
            variant={decision?.decision === "reject" ? "secondary" : "outline"}
            className={cn(compact ? "h-6 px-2 text-[10.5px]" : "h-7 px-2.5 text-[11px]")}
            disabled={refining}
            onClick={() => onQuickDecision(index, "reject")}
            title="Dismiss this concern"
          >
            <X className="h-3 w-3" /> Dismiss
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t bg-muted/10"
          >
            <div className="space-y-3 p-3">
              <DetailSection title="Why this matters">
                <p className="text-[11.5px] leading-relaxed">{plain.why}</p>
              </DetailSection>

              <DetailSection title="Why the Challenger raised it">
                <p className="text-[11.5px] leading-relaxed break-words">{concern.evidence}</p>
              </DetailSection>

              <ConfidenceBreakdown
                confidence={concern.confidence}
                signals={concern.confidence_signals}
              />

              <DetailSection title="Reviewer guidance">
                <p className="text-[11.5px] leading-relaxed">{plain.recommendationReason}</p>
              </DetailSection>

              {concern.alternative_approach && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <Sparkles className="h-3 w-3" /> Suggested revision
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10.5px] border-primary/30 text-primary hover:bg-primary/10"
                      disabled={refining}
                      onClick={() => {
                        setDraft({
                          modification: concern.alternative_approach,
                          rationale: draft.rationale,
                        });
                        setModifyOpen(true);
                      }}
                    >
                      <Wand2 className="h-3 w-3" /> Use this
                    </Button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-primary break-words">
                    {concern.alternative_approach}
                  </p>
                </div>
              )}

              {relatedCounters.length > 0 && (
                <details className="rounded-md border bg-background/50">
                  <summary className="flex cursor-pointer items-center gap-1.5 p-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <MessageSquareQuote className="h-3 w-3" /> Counter-points (
                    {relatedCounters.length})
                  </summary>
                  <div className="space-y-1.5 px-2.5 pb-2.5">
                    {relatedCounters.map((c: any, i: number) => (
                      <div key={i} className="border-l-2 border-muted pl-2 text-[11px]">
                        <div className="italic text-muted-foreground">“{c.claim}”</div>
                        <div className="mt-0.5 break-words">{c.counter}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <AnimatePresence>
                {modifyOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 border-t pt-3">
                      <div>
                        <label className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Revised guidance
                        </label>
                        <Textarea
                          value={draft.modification}
                          onChange={(e) =>
                            setDraft((p) => ({ ...p, modification: e.target.value }))
                          }
                          placeholder="Explain what should change in the recommendation."
                          className="mt-1 min-h-[64px] text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Reviewer note (optional)
                        </label>
                        <Textarea
                          value={draft.rationale}
                          onChange={(e) => setDraft((p) => ({ ...p, rationale: e.target.value }))}
                          placeholder="Add project context the AI may not know."
                          className="mt-1 min-h-[44px] text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px]"
                          onClick={() => setModifyOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={async () => {
                            await onSaveModification(index, draft.modification, draft.rationale);
                            setModifyOpen(false);
                          }}
                        >
                          Save revision
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[11.5px] leading-relaxed text-foreground/85 break-words">
        {value}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function confidenceTone(c: number) {
  if (c >= 85)
    return { tone: "text-success", bg: "bg-success/10 border-success/30", label: "High" };
  if (c >= 60)
    return { tone: "text-primary", bg: "bg-primary/10 border-primary/30", label: "Solid" };
  if (c >= 40)
    return { tone: "text-warning", bg: "bg-warning/10 border-warning/30", label: "Moderate" };
  return { tone: "text-muted-foreground", bg: "bg-muted border-border", label: "Low" };
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (typeof confidence !== "number") return null;
  const c = Math.max(0, Math.min(100, Math.round(confidence)));
  const t = confidenceTone(c);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
        t.bg,
        t.tone,
      )}
      title={`Challenger confidence: ${c}/100 (${t.label})`}
    >
      <Gauge className="h-3 w-3" />
      {c}% · {t.label}
    </span>
  );
}

function ConfidenceBreakdown({ confidence, signals }: { confidence?: number; signals?: string[] }) {
  if (typeof confidence !== "number" && (!signals || signals.length === 0)) return null;
  const c =
    typeof confidence === "number" ? Math.max(0, Math.min(100, Math.round(confidence))) : null;
  const t = c !== null ? confidenceTone(c) : null;
  return (
    <div className="rounded-md border bg-muted/15 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Why this confidence
        </div>
        {c !== null && t && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              t.bg,
              t.tone,
            )}
          >
            <Gauge className="h-3 w-3" />
            {c}/100 · {t.label}
          </span>
        )}
      </div>
      {c !== null && t && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-all",
              c >= 85
                ? "bg-success"
                : c >= 60
                  ? "bg-primary"
                  : c >= 40
                    ? "bg-warning"
                    : "bg-muted-foreground/60",
            )}
            style={{ width: `${c}%` }}
          />
        </div>
      )}
      {signals && signals.length > 0 ? (
        <ul className="space-y-1">
          {signals.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-foreground/85"
            >
              <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span className="break-words">{s}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">
          No signals reported by the Challenger.
        </p>
      )}
    </div>
  );
}
