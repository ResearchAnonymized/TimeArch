import { Search, LayoutGrid, List, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
export type StatusFilter = "all" | "open" | "accepted" | "modified" | "rejected";
export type ViewMode = "board" | "list";

interface Props {
  query: string;
  setQuery: (v: string) => void;
  severity: SeverityFilter;
  setSeverity: (v: SeverityFilter) => void;
  status: StatusFilter;
  setStatus: (v: StatusFilter) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  counts: { open: number; accepted: number; modified: number; rejected: number };
}

export default function ChallengerFilters({
  query,
  setQuery,
  severity,
  setSeverity,
  status,
  setStatus,
  view,
  setView,
  counts,
}: Props) {
  const statusOptions: { v: StatusFilter; label: string; count?: number }[] = [
    { v: "all", label: "All" },
    { v: "open", label: "To review", count: counts.open },
    { v: "accepted", label: "Kept", count: counts.accepted },
    { v: "modified", label: "Revised", count: counts.modified },
    { v: "rejected", label: "Dismissed", count: counts.rejected },
  ];

  return (
    <div className="border-b bg-muted/20 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concerns"
            className="h-8 pl-7 text-[11px]"
          />
        </div>

        <label className="flex items-center gap-2 text-[10.5px] font-medium text-muted-foreground">
          <span>Priority</span>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
            className="h-8 rounded-md border bg-background px-2 text-[11px] text-foreground outline-none"
            aria-label="Filter by severity"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <div className="ml-auto flex items-center overflow-hidden rounded-md border bg-background">
          <button
            type="button"
            onClick={() => setView("board")}
            className={cn(
              "flex h-8 items-center gap-1.5 px-2 text-[10.5px] transition-colors",
              view === "board" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            title="Board view"
          >
            <LayoutGrid className="h-3 w-3" /> Board
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex h-8 items-center gap-1.5 border-l px-2 text-[10.5px] transition-colors",
              view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            title="List view"
          >
            <List className="h-3 w-3" /> List
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* Quick toggle — Show only undecided concerns */}
        <Button
          size="sm"
          variant={status === "open" ? "default" : "outline"}
          className={cn(
            "h-7 px-2.5 text-[10.5px] gap-1",
            status === "open"
              ? "bg-warning text-warning-foreground hover:bg-warning/90 border-warning"
              : counts.open > 0
                ? "border-warning/40 text-warning hover:bg-warning/10"
                : "",
          )}
          onClick={() => setStatus(status === "open" ? "all" : "open")}
          title="Show only concerns awaiting a decision"
        >
          {counts.open > 0 ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Undecided only
          <span className="ml-0.5 rounded-full bg-background/30 px-1.5 font-semibold tabular-nums">
            {counts.open}
          </span>
        </Button>

        <span className="mx-1 h-4 w-px bg-border" aria-hidden />

        {statusOptions.map((item) => (
          <Button
            key={item.v}
            size="sm"
            variant={status === item.v ? "default" : "outline"}
            className="h-7 px-2.5 text-[10.5px]"
            onClick={() => setStatus(item.v)}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className="ml-1 opacity-70">{item.count}</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
