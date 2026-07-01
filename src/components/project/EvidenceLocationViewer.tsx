import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, FileSearch, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PathHit,
  getValueAtPath,
  previewValue,
  humanizePath,
  findPathsForTerms,
} from "@/lib/artifact-path-utils";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  itemLabel: string;
  artifact: any;
  /** Locations precomputed by the detector. */
  locations?: PathHit[];
  /** Terms used by the detector — re-scanned to surface ALL occurrences. */
  searchTerms?: string[];
  /** Quoted evidence strings returned by the AI verifier (no path). */
  aiQuotes?: string[];
}

function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-amber-300/40 text-foreground rounded px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function EvidenceLocationViewer({
  open,
  onOpenChange,
  itemLabel,
  artifact,
  locations,
  searchTerms,
  aiQuotes,
}: Props) {
  // Re-discover hits live so we always show fresh paths after refinements.
  const allHits = useMemo<PathHit[]>(() => {
    if (!artifact) return [];
    const fromDetector = locations || [];
    const fromTerms = searchTerms?.length ? findPathsForTerms(artifact, searchTerms) : [];
    const seen = new Set<string>();
    return [...fromDetector, ...fromTerms].filter((h) => {
      if (seen.has(h.path)) return false;
      seen.add(h.path);
      return true;
    });
  }, [artifact, locations, searchTerms]);

  // Build filter chips from the actual matched terms + a few well-known
  // top-level path tokens (e.g. "security", "observability", "resilience").
  const availableFilters = useMemo<string[]>(() => {
    const set = new Set<string>();
    allHits.forEach((h) => {
      if (h.matchedTerm) set.add(h.matchedTerm);
      // First meaningful token of the path is often a domain bucket
      const first = h.path.split(/[.\[]/)[0];
      if (first && first !== "(root)") set.add(first.toLowerCase());
    });
    return Array.from(set).sort();
  }, [allHits]);

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Reset filters when the modal switches to a different checklist item.
  useEffect(() => {
    setActiveFilters(new Set());
  }, [itemLabel, open]);

  const toggleFilter = (term: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  };

  const visibleHits = useMemo<PathHit[]>(() => {
    if (activeFilters.size === 0) return allHits;
    return allHits.filter((h) => {
      const pathLc = h.path.toLowerCase();
      const term = h.matchedTerm.toLowerCase();
      // OR semantics: a hit matches if ANY active filter is in its path or term
      for (const f of activeFilters) {
        if (term.includes(f) || pathLc.includes(f)) return true;
      }
      return false;
    });
  }, [allHits, activeFilters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-4 w-4 text-primary" />
            Evidence locations
          </DialogTitle>
          <DialogDescription className="text-xs">
            Showing where the artifact addresses{" "}
            <span className="font-medium text-foreground">"{itemLabel}"</span>. Each card maps to a
            precise path inside the generated architecture document.
          </DialogDescription>
        </DialogHeader>

        {/* Filter chips — derived from this item's matched terms + path buckets */}
        {availableFilters.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap border-y py-2">
            <Filter className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mr-1">
              Filter
            </span>
            {availableFilters.map((f) => {
              const active = activeFilters.has(f);
              const count = allHits.filter(
                (h) => h.matchedTerm.toLowerCase().includes(f) || h.path.toLowerCase().includes(f),
              ).length;
              return (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  className={cn(
                    "inline-flex items-center gap-1 h-5 px-1.5 rounded-full border text-[10px] transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-foreground/80 border-border hover:bg-muted",
                  )}
                >
                  {f}
                  <span
                    className={cn(
                      "font-mono tabular-nums opacity-70",
                      active ? "opacity-90" : "opacity-60",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {activeFilters.size > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1.5 text-[10px] gap-0.5 ml-1"
                onClick={() => setActiveFilters(new Set())}
              >
                <X className="h-2.5 w-2.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {visibleHits.length} of {allHits.length}
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-3">
            {allHits.length === 0 && !aiQuotes?.length && (
              <div className="text-xs text-muted-foreground italic border border-dashed rounded-md p-6 text-center">
                No matching sections were found in the artifact for this checklist item. Try the{" "}
                <span className="font-medium">Refine architecture</span> action to add coverage.
              </div>
            )}

            {allHits.length > 0 && visibleHits.length === 0 && (
              <div className="text-xs text-muted-foreground italic border border-dashed rounded-md p-6 text-center">
                No matches for the selected filter{activeFilters.size > 1 ? "s" : ""}.
              </div>
            )}

            {visibleHits.map((hit, i) => {
              const value =
                hit.value !== undefined ? hit.value : getValueAtPath(artifact, hit.path);
              const text = previewValue(value);
              return (
                <div key={`${hit.path}-${i}`} className="border rounded-md overflow-hidden bg-card">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                    <MapPin className="h-3 w-3 text-primary" />
                    <code className="text-[11px] font-mono text-foreground/90 flex-1 truncate">
                      {humanizePath(hit.path)}
                    </code>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      match: {hit.matchedTerm}
                    </Badge>
                  </div>
                  <pre
                    className={cn(
                      "p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words",
                      "max-h-64 overflow-auto",
                    )}
                  >
                    {typeof text === "string" ? highlight(text, hit.matchedTerm) : text}
                  </pre>
                </div>
              );
            })}

            {aiQuotes?.length ? (
              <div className="border rounded-md overflow-hidden bg-card">
                <div className="px-3 py-2 bg-muted/40 border-b">
                  <span className="text-[11px] font-semibold">AI-quoted evidence</span>
                </div>
                <ul className="p-3 space-y-2">
                  {aiQuotes.map((q, i) => (
                    <li
                      key={i}
                      className="text-[11px] italic text-muted-foreground leading-relaxed"
                    >
                      "{q}"
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
