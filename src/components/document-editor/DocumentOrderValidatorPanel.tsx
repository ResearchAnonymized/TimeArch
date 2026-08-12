import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { DocumentDraft } from "@/lib/document-editor-types";
import { validateDocumentOrder, REQUIRED_WIZARD_ORDER } from "@/lib/document-order-validator";

export default function DocumentOrderValidatorPanel({ draft }: { draft: DocumentDraft }) {
  const result = validateDocumentOrder(draft);

  const borderColor = result.ok
    ? "border-emerald-500/30 bg-emerald-500/5"
    : result.missing.length > 0
    ? "border-destructive/30 bg-destructive/5"
    : "border-amber-500/30 bg-amber-500/5";

  const Icon = result.ok ? CheckCircle2 : result.missing.length > 0 ? XCircle : AlertTriangle;
  const iconColor = result.ok
    ? "text-emerald-600"
    : result.missing.length > 0
    ? "text-destructive"
    : "text-amber-600";

  return (
    <div className={`rounded-lg border-2 ${borderColor} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h4 className="text-sm font-semibold">Stage 14 Artifact Order Check</h4>
        <span className="text-[11px] text-muted-foreground ml-auto">{result.summary}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {result.matches.map((m, i) => {
          const req = REQUIRED_WIZARD_ORDER[i];
          const outOfOrder = result.outOfOrder.some((o) => o.key === m.key);
          return (
            <div
              key={m.key}
              className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                !m.found
                  ? "border-destructive/30 bg-destructive/5"
                  : outOfOrder
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-card"
              }`}
            >
              <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{req.title}</div>
                {m.found ? (
                  <div className="text-[10px] text-muted-foreground truncate">
                    ↳ {m.matchedHeading}
                    {outOfOrder && <span className="text-amber-600 ml-1">(out of order)</span>}
                  </div>
                ) : (
                  <div className="text-[10px] text-destructive">Missing — regenerate or add manually</div>
                )}
              </div>
              {m.found ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
