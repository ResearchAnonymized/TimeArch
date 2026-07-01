import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  Wand2,
  Loader2,
  ChevronDown,
  MessageSquare,
  ShieldCheck,
  MapPin,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChecklistEvaluation } from "@/hooks/useChecklistEvaluation";
import { STATUS_LABEL, EvidenceStatus } from "./checklistEvidenceRules";
import { EvidenceLocationViewer } from "./EvidenceLocationViewer";
import { RefinementDiffViewer, RefinementRecord } from "./RefinementDiffViewer";
import { toast } from "sonner";

interface Props {
  projectId: string;
  stage: number;
  refreshKey?: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  checkedItems: Set<string>;
  setCheckedItems: (next: Set<string>) => void;
  justification: string;
  onJustificationChange: (next: string) => void;
}

const STATUS_ICON: Record<EvidenceStatus, React.ComponentType<{ className?: string }>> = {
  green: CheckCircle2,
  amber: AlertCircle,
  red: XCircle,
  unknown: HelpCircle,
};

const STATUS_DOT: Record<EvidenceStatus, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-destructive",
  unknown: "bg-muted-foreground/40",
};

const STATUS_TEXT: Record<EvidenceStatus, string> = {
  green: "text-emerald-500",
  amber: "text-amber-500",
  red: "text-destructive",
  unknown: "text-muted-foreground",
};

/**
 * Evidence-driven validation checklist. Each item is evaluated against the
 * generated artifact (deterministic + on-demand AI verification), with a
 * surgical refinement action that patches gaps without touching the rest.
 *
 * The component still surfaces the manual checkbox + justification so the
 * architect retains attestation control (soft-lock model).
 */
export function ValidationChecklist({
  projectId,
  stage,
  refreshKey,
  open,
  onOpenChange,
  checkedItems,
  setCheckedItems,
  justification,
  onJustificationChange,
}: Props) {
  const {
    loading,
    artifact,
    evaluations,
    summary,
    verifying,
    refining,
    verifyItem,
    refineItem,
    refinementHistory,
  } = useChecklistEvaluation(projectId, stage, refreshKey);

  // Open evidence + diff dialogs by item id
  const [evidenceItemId, setEvidenceItemId] = useState<string | null>(null);
  const [diffRecord, setDiffRecord] = useState<RefinementRecord | null>(null);

  // Group refinements by item id for quick lookup; keep latest at the top.
  const refinementsByItem = useMemo(() => {
    const map = new Map<string, typeof refinementHistory>();
    [...refinementHistory]
      .sort((a, b) => (b.refined_at || "").localeCompare(a.refined_at || ""))
      .forEach((r) => {
        const list = map.get(r.item_id) || [];
        list.push(r);
        map.set(r.item_id, list);
      });
    return map;
  }, [refinementHistory]);

  const evidenceItem = evaluations.find((e) => e.id === evidenceItemId) || null;

  // Auto-tick GREEN items so architects can attest faster on covered items.
  // Never auto-untick — user retains full control once they've toggled.
  useEffect(() => {
    if (!evaluations.length) return;
    const next = new Set(checkedItems);
    let changed = false;
    evaluations.forEach((e) => {
      const status = e.aiVerdict?.status || e.evidence.status;
      if (status === "green" && !next.has(e.id)) {
        next.add(e.id);
        changed = true;
      }
    });
    if (changed) setCheckedItems(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluations]);

  const checkedCount = checkedItems.size;
  const total = evaluations.length;
  const allChecked = checkedCount === total && total > 0;

  const toggle = (id: string) => {
    const next = new Set(checkedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedItems(next);
  };

  const handleRefine = async (itemId: string, label: string, gaps: string[]) => {
    toast.loading("Refining architecture…", { id: `refine-${itemId}` });
    const res = await refineItem(itemId, label, gaps);
    toast.dismiss(`refine-${itemId}`);
    if (res.success) {
      toast.success(res.summary || "Section refined.");
    } else {
      toast.error(res.error || "Refinement failed.");
    }
  };

  return (
    <div className="relative z-10">
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <ShieldCheck
          className={cn(
            "h-3.5 w-3.5",
            allChecked ? "text-emerald-500" : summary.red > 0 ? "text-destructive" : "text-primary",
          )}
        />
        <span className="text-[10px] font-semibold flex-1 text-left">Validation Checklist</span>

        {/* Coverage chips */}
        {total > 0 && (
          <div className="flex items-center gap-1">
            {summary.green > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-500 font-mono tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {summary.green}
              </span>
            )}
            {summary.amber > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-amber-500 font-mono tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {summary.amber}
              </span>
            )}
            {summary.red > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-destructive font-mono tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {summary.red}
              </span>
            )}
          </div>
        )}

        <span
          className={cn(
            "text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded",
            allChecked ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground",
          )}
        >
          {checkedCount}/{total}
        </span>
        <ChevronDown
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-1.5">
              {!artifact && !loading && (
                <div className="text-[10.5px] text-muted-foreground italic px-2 py-3 text-center border border-dashed rounded-md">
                  No artifact found yet. Run the stage agent to generate evidence.
                </div>
              )}

              {evaluations.map((evalItem) => {
                const isChecked = checkedItems.has(evalItem.id);
                const status: EvidenceStatus =
                  evalItem.aiVerdict?.status || evalItem.evidence.status;
                const Icon = STATUS_ICON[status];
                const isVerifying = verifying[evalItem.id];
                const isRefining = refining[evalItem.id];
                const verdict = evalItem.aiVerdict;
                const evidence = evalItem.evidence;

                return (
                  <div
                    key={evalItem.id}
                    className={cn(
                      "rounded-lg border transition-colors",
                      isChecked
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-card border-border/60",
                    )}
                  >
                    <div className="flex items-start gap-2 p-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(evalItem.id)}
                        className="mt-0.5 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              "text-[11px] leading-relaxed flex-1",
                              isChecked ? "text-foreground" : "text-foreground/90",
                            )}
                          >
                            {evalItem.label}
                          </span>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 gap-1 text-[9px] font-medium flex-shrink-0",
                                  STATUS_TEXT[status],
                                  status === "green" && "border-emerald-500/40",
                                  status === "amber" && "border-amber-500/40",
                                  status === "red" && "border-destructive/40",
                                  status === "unknown" && "border-border",
                                )}
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {STATUS_LABEL[status]}
                                {verdict && <Sparkles className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs text-[10px]">
                              {verdict
                                ? `AI-verified · confidence ${Math.round(verdict.confidence * 100)}%`
                                : "Deterministic evaluation. Click 'Verify with AI' for a deeper check."}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Evidence summary */}
                        {(evidence.found.length > 0 || evidence.missing.length > 0) && !verdict && (
                          <div className="space-y-0.5">
                            {evidence.found.slice(0, 3).map((f, i) => (
                              <div
                                key={`f-${i}`}
                                className="flex items-start gap-1 text-[10px] text-muted-foreground"
                              >
                                <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
                                <span className="leading-tight">Found: {f}</span>
                              </div>
                            ))}
                            {evidence.missing.slice(0, 3).map((m, i) => (
                              <div
                                key={`m-${i}`}
                                className="flex items-start gap-1 text-[10px] text-muted-foreground"
                              >
                                <span className="mt-1 h-1 w-1 rounded-full bg-destructive flex-shrink-0" />
                                <span className="leading-tight">Missing: {m}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI verdict details */}
                        {verdict && (
                          <div className="space-y-1 pt-0.5">
                            {verdict.evidenceQuotes.length > 0 && (
                              <div className="space-y-0.5">
                                {verdict.evidenceQuotes.slice(0, 3).map((q, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-1 text-[10px] text-emerald-700 dark:text-emerald-400"
                                  >
                                    <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0" />
                                    <span className="leading-tight italic">"{q}"</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {verdict.gaps.length > 0 && (
                              <div className="space-y-0.5">
                                {verdict.gaps.slice(0, 3).map((g, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-1 text-[10px] text-destructive/90"
                                  >
                                    <XCircle className="mt-0.5 h-2.5 w-2.5 flex-shrink-0" />
                                    <span className="leading-tight">{g}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        {artifact && (
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {(() => {
                              const locCount =
                                (evalItem.evidence.locations?.length || 0) +
                                (verdict?.evidenceQuotes?.length || 0);
                              const hasEvidence = locCount > 0;
                              return (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px] gap-1"
                                  disabled={!hasEvidence}
                                  onClick={() => setEvidenceItemId(evalItem.id)}
                                  title={
                                    hasEvidence
                                      ? "Jump to where this is covered in the artifact"
                                      : "No evidence locations detected"
                                  }
                                >
                                  <MapPin className="h-2.5 w-2.5" />
                                  Evidence
                                  {hasEvidence ? (
                                    <span className="ml-0.5 font-mono opacity-70">{locCount}</span>
                                  ) : null}
                                </Button>
                              );
                            })()}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1"
                              disabled={isVerifying}
                              onClick={() => verifyItem(evalItem.id, evalItem.label)}
                            >
                              {isVerifying ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-2.5 w-2.5" />
                              )}
                              {verdict ? "Re-verify" : "Verify with AI"}
                            </Button>

                            {(status === "amber" || status === "red") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
                                disabled={isRefining}
                                onClick={() =>
                                  handleRefine(
                                    evalItem.id,
                                    evalItem.label,
                                    verdict?.gaps?.length ? verdict.gaps : evidence.missing,
                                  )
                                }
                              >
                                {isRefining ? (
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Wand2 className="h-2.5 w-2.5" />
                                )}
                                Refine architecture
                              </Button>
                            )}

                            {(refinementsByItem.get(evalItem.id) || []).length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
                                onClick={() =>
                                  setDiffRecord(
                                    refinementsByItem.get(evalItem.id)![0] as RefinementRecord,
                                  )
                                }
                                title="View what changed in the last refinement"
                              >
                                <GitCompare className="h-2.5 w-2.5" />
                                View changes
                                <span className="ml-0.5 font-mono opacity-70">
                                  {refinementsByItem.get(evalItem.id)!.length}
                                </span>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Optional justification */}
              <div className="pt-1 space-y-1">
                <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Notes / Justification
                  <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <Textarea
                  placeholder="Add any notes or justification for the lock record..."
                  value={justification}
                  onChange={(e) => onJustificationChange(e.target.value)}
                  className="min-h-[50px] text-xs resize-none"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EvidenceLocationViewer
        open={!!evidenceItem}
        onOpenChange={(o) => !o && setEvidenceItemId(null)}
        itemLabel={evidenceItem?.label || ""}
        artifact={artifact}
        locations={evidenceItem?.evidence.locations}
        searchTerms={evidenceItem?.evidence.searchTerms}
        aiQuotes={evidenceItem?.aiVerdict?.evidenceQuotes}
      />

      <RefinementDiffViewer
        open={!!diffRecord}
        onOpenChange={(o) => !o && setDiffRecord(null)}
        record={diffRecord}
      />
    </div>
  );
}
