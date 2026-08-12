/**
 * Rubric drawer for a single prospective experiment run (Sprint 3).
 *
 * Lets a rater score each of the 6 stage dimensions plus two holistic ones
 * (usefulness, hallucination) on a 0–3 scale. Scores upsert per
 * (run_id, rater_user_id, dimension); κ is computed later from the raw
 * table in the report step.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { experimentService, type ExperimentRubricScore } from "@/services/experimentService";
import { errorOf } from "@/lib/result";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const RUBRIC_DIMENSIONS: Array<{ key: string; label: string; help: string }> = [
  { key: "mapping",       label: "Mapping",        help: "Cited components plausibly impacted?" },
  { key: "ripple",        label: "Ripple",         help: "Transitive impacts complete & non-hallucinated?" },
  { key: "quality",       label: "Quality",        help: "ISO 25010 characteristics relevant & directionally correct?" },
  { key: "alternatives",  label: "Alternatives",   help: "≥2 distinct, non-trivial options with real trade-offs?" },
  { key: "adr",           label: "ADR",            help: "Context / decision / consequences grounded?" },
  { key: "plan",          label: "Plan",           help: "Ordered, buildable, evidence-cited, validation covered?" },
  { key: "usefulness",    label: "Usefulness",     help: "Would you ship the guidance as-is?" },
  { key: "hallucination", label: "Hallucination",  help: "Rate 3 = no invented components; 0 = many fabrications" },
];

interface Props { runId: string | null; open: boolean; onClose: () => void }

export function RubricDrawer({ runId, open, onClose }: Props) {
  const qc = useQueryClient();
  const scores = useQuery({
    queryKey: ["experiment", "rubric", runId],
    queryFn: async () => {
      const r = await experimentService.listRubricScores(runId!);
      if (!r.ok) throw new Error(errorOf(r).message);
      return r.value;
    },
    enabled: !!runId && open,
  });

  const upsert = useMutation({
    mutationFn: async (args: { dimension: string; score: number; comment: string }) => {
      const r = await experimentService.upsertRubricScore({ run_id: runId!, ...args });
      if (!r.ok) throw new Error(errorOf(r).message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["experiment", "rubric", runId] }),
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const [drafts, setDrafts] = useState<Record<string, { score: number; comment: string }>>({});

  useEffect(() => {
    if (!scores.data) return;
    const next: Record<string, { score: number; comment: string }> = {};
    for (const d of RUBRIC_DIMENSIONS) {
      const existing = scores.data.find((s: ExperimentRubricScore) => s.dimension === d.key);
      next[d.key] = { score: existing?.score ?? -1, comment: existing?.comment ?? "" };
    }
    setDrafts(next);
  }, [scores.data]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Rubric scoring</SheetTitle>
          <SheetDescription>
            Rate each dimension 0 – 3. Scores save immediately; you can update them any time.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          {RUBRIC_DIMENSIONS.map((d) => {
            const draft = drafts[d.key] ?? { score: -1, comment: "" };
            return (
              <div key={d.key} className="rounded-md border p-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">{d.help}</div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={draft.score === n ? "default" : "outline"}
                      onClick={() => {
                        setDrafts((prev) => ({ ...prev, [d.key]: { ...draft, score: n } }));
                        upsert.mutate({ dimension: d.key, score: n, comment: draft.comment });
                      }}
                    >
                      {n}
                    </Button>
                  ))}
                  {upsert.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin self-center" />}
                </div>
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="Optional comment"
                  value={draft.comment}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [d.key]: { ...draft, comment: e.target.value } }))}
                  onBlur={() => {
                    if (draft.score >= 0) upsert.mutate({ dimension: d.key, score: draft.score, comment: draft.comment });
                  }}
                />
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
