import { ArrowLeft, ArrowRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  importCount: number;
  reversing: boolean;
  hasImports: boolean;
  hasParsed: boolean;
  onRun: (reprocess: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Reverse({
  importCount,
  reversing,
  hasImports,
  hasParsed,
  onRun,
  onBack,
  onNext,
}: Props) {
  return (
    <section className="rounded-xl border bg-card p-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <div className="mb-5">
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Let AI read everything
        </h3>
        <p className="text-xs text-muted-foreground">
          The reverse-engineering agent parses each file and writes <em>draft</em> artifacts into
          the right architecture stages. Everything is tagged{" "}
          <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono">
            needs human confirmation
          </span>{" "}
          so you stay in control.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Requirements", desc: "from SRS / PRD" },
          { label: "Components", desc: "from source code" },
          { label: "Data model", desc: "from SQL schema" },
          { label: "API surface", desc: "from OpenAPI" },
        ].map((p) => (
          <div key={p.label} className="rounded-md border bg-background px-3 py-2">
            <p className="text-xs font-semibold">{p.label}</p>
            <p className="text-[10px] text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4 text-center space-y-2">
        <Button
          size="lg"
          onClick={() => onRun(false)}
          disabled={reversing || !hasImports}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {reversing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading {importCount} file
              {importCount === 1 ? "" : "s"}…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Read {importCount} file
              {importCount === 1 ? "" : "s"} now
            </>
          )}
        </Button>
        {hasParsed && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRun(true)}
              disabled={reversing}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Re-run from scratch (wipes prior drafts)
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          Takes ~10–30 seconds depending on file sizes.
        </p>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        {hasParsed && (
          <Button onClick={onNext} className="bg-amber-600 hover:bg-amber-700 text-white">
            Next: Explore findings <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </section>
  );
}
