import { useState } from "react";
import { ChevronDown, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FreeTextMode({
  onProcess,
  processing,
  onBack,
  initialText = "",
}: {
  onProcess: (text: string, mode: string) => void;
  processing: boolean;
  onBack: () => void;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <ChevronDown className="h-3 w-3 rotate-90" /> Back to methods
      </button>
      <div className="rounded-xl border bg-gradient-to-b from-violet-500/5 to-transparent p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <MessageSquareText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm mb-0.5">Describe Your System</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Include what the system should do, who uses it, performance expectations, security
              needs, integrations, and any constraints. The AI will structure your description into
              formal requirements.
            </p>
          </div>
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Example: "We need a patient portal for our hospital that allows patients to register, book appointments, view medical records, and communicate with doctors. It must comply with HIPAA, support 10,000 concurrent users, integrate with our existing Epic EHR system, and provide real-time notifications..."`}
        className="min-h-[240px] text-sm"
      />
      <Button
        onClick={() => onProcess(text, "free_text")}
        disabled={!text.trim() || processing}
        className="w-full gap-2 h-11"
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {processing ? "Structuring Requirements..." : "Structure & Analyze"}
      </Button>
    </div>
  );
}
