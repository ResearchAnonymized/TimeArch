import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExtractedData } from "../types";

function IssueSubgroup({
  storageKey,
  label,
  count,
  labelColor,
  defaultOpen = true,
  children,
}: {
  storageKey: string;
  label: string;
  count: number;
  labelColor: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = window.localStorage.getItem(`collapsible:${storageKey}`);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return defaultOpen;
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`collapsible:${storageKey}`, String(next));
    }
  };
  return (
    <div className="mb-4 last:mb-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <p className={`text-xs font-bold ${labelColor} uppercase tracking-wider`}>
          {label} ({count})
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground/70">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function IssuesPanel({ data }: { data: ExtractedData }) {
  const totalIssues =
    (data.ambiguities?.length || 0) +
    (data.contradictions?.length || 0) +
    (data.missing_information?.length || 0) +
    (data.duplicates?.length || 0);
  const hasIssues = totalIssues > 0;

  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("collapsible:issues-panel");
    if (stored === "true") return true;
    if (stored === "false") return false;
    return true;
  });
  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("collapsible:issues-panel", String(next));
    }
  };

  if (!hasIssues) return null;

  return (
    <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-warning/5 to-warning/10 p-5 mb-6">
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={panelOpen}
        className="w-full flex items-center gap-2 text-left mb-4 group"
      >
        <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </div>
        <h4 className="font-display font-bold text-base">Issues Detected — Review Required</h4>
        <Badge variant="outline" className="text-[10px] font-mono ml-1">
          {totalIssues}
        </Badge>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          {panelOpen ? (
            <>
              Hide <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div>
              {data.ambiguities && data.ambiguities.length > 0 && (
                <IssueSubgroup
                  storageKey="issues-ambiguities"
                  label="Ambiguities"
                  count={data.ambiguities.length}
                  labelColor="text-warning"
                >
                  {data.ambiguities.map((a) => (
                    <div
                      key={a.id}
                      className="ml-3 mb-2 p-3 rounded-lg bg-card border border-border/50 text-xs"
                    >
                      <p className="text-foreground">{a.description}</p>
                      {a.suggested_clarification && (
                        <p className="text-muted-foreground mt-1.5 italic flex items-start gap-1.5">
                          <Sparkles className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />{" "}
                          {a.suggested_clarification}
                        </p>
                      )}
                    </div>
                  ))}
                </IssueSubgroup>
              )}

              {data.contradictions && data.contradictions.length > 0 && (
                <IssueSubgroup
                  storageKey="issues-contradictions"
                  label="Contradictions"
                  count={data.contradictions.length}
                  labelColor="text-destructive"
                >
                  {data.contradictions.map((c) => (
                    <div
                      key={c.id}
                      className="ml-3 mb-2 p-3 rounded-lg bg-card border border-border/50 text-xs"
                    >
                      <p className="text-foreground">{c.description}</p>
                      {c.between && (
                        <p className="text-muted-foreground mt-1">
                          Between: {c.between.join(", ")}
                        </p>
                      )}
                      {c.suggested_resolution && (
                        <p className="text-muted-foreground italic mt-1 flex items-start gap-1.5">
                          <Sparkles className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />{" "}
                          {c.suggested_resolution}
                        </p>
                      )}
                    </div>
                  ))}
                </IssueSubgroup>
              )}

              {data.missing_information && data.missing_information.length > 0 && (
                <IssueSubgroup
                  storageKey="issues-missing"
                  label="Missing Information"
                  count={data.missing_information.length}
                  labelColor="text-warning"
                >
                  {data.missing_information.map((m) => (
                    <div
                      key={m.id}
                      className="ml-3 mb-2 p-3 rounded-lg bg-card border border-border/50 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-foreground">{m.description}</p>
                        {m.priority && (
                          <Badge
                            variant={m.priority === "high" ? "destructive" : "secondary"}
                            className="text-[9px] ml-2"
                          >
                            {m.priority}
                          </Badge>
                        )}
                      </div>
                      {m.impact && <p className="text-muted-foreground mt-1">Impact: {m.impact}</p>}
                    </div>
                  ))}
                </IssueSubgroup>
              )}

              {data.duplicates && data.duplicates.length > 0 && (
                <IssueSubgroup
                  storageKey="issues-duplicates"
                  label="Potential Duplicates"
                  count={data.duplicates.length}
                  labelColor="text-muted-foreground"
                >
                  {data.duplicates.map((d, i) => (
                    <div
                      key={i}
                      className="ml-3 mb-2 p-3 rounded-lg bg-card border border-border/50 text-xs"
                    >
                      <p className="text-foreground">{d.description}</p>
                      <p className="text-muted-foreground mt-1">
                        IDs: {d.ids.join(", ")} — Action: {d.suggested_action}
                      </p>
                    </div>
                  ))}
                </IssueSubgroup>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
