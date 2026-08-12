import { ArrowLeft, ArrowRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  importCount: number;
  pendingCount: number;
  reversing: boolean;
  hasImports: boolean;
  hasParsed: boolean;
  onRun: (reprocess: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Reverse({
  importCount,
  pendingCount,
  reversing,
  hasImports,
  hasParsed,
  onRun,
  onBack,
  onNext,
}: Props) {
  const needsFreshPass = hasParsed && pendingCount === 0;

  return (
    <section className="rounded-xl border bg-card p-6 animate-in fade-in-50 duration-300 space-y-5">
      <div>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Recover architecture
        </h3>
        <p className="text-xs text-muted-foreground">
          AI reads your files and rebuilds the as-is architecture.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/20 p-6 text-center space-y-3">
        {needsFreshPass ? (
          <>
            <p className="text-sm font-medium">
              Architecture ready from {importCount} file{importCount === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground">
              Continue to propose a change, or re-read files from scratch.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => onRun(true)}
                disabled={reversing || !hasImports}
              >
                {reversing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Re-read
              </Button>
              <Button onClick={onNext} className="bg-foreground text-background hover:bg-foreground/90">
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        ) : (
          <Button
            size="lg"
            onClick={() => onRun(pendingCount === 0 && hasParsed)}
            disabled={reversing || !hasImports}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {reversing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading{" "}
                {pendingCount > 0 ? pendingCount : importCount} file
                {(pendingCount > 0 ? pendingCount : importCount) === 1 ? "" : "s"}…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" /> Recover architecture (
                {pendingCount > 0 ? pendingCount : importCount})
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button onClick={onNext} disabled={!hasParsed} variant="outline">
          Next: Propose change <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </section>
  );
}
