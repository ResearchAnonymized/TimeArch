import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useDensity, type DensityLevel } from "@/contexts/DensityContext";
import { cn } from "@/lib/utils";

/**
 * Wraps a text block and applies density-aware truncation.
 * Compact: truncates to `compactLength` chars with "show more".
 * Standard: shows full text.
 * Detailed: shows full text.
 */
export function DensityText({
  children,
  compactLength = 120,
  className,
}: {
  children: string;
  compactLength?: number;
  className?: string;
}) {
  const { density } = useDensity();
  const [expanded, setExpanded] = useState(false);

  if (density !== "compact" || children.length <= compactLength || expanded) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={className}>
      {children.slice(0, compactLength)}…{" "}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        className="text-primary text-[10px] font-medium hover:underline"
      >
        more
      </button>
    </span>
  );
}

/**
 * Wraps a list of items and applies density-aware collapsing.
 * Compact: shows count badge only.
 * Standard: shows first `standardLimit` items, rest collapsed.
 * Detailed: shows all items.
 */
export function DensityList({
  items,
  label,
  renderItem,
  standardLimit = 3,
  className,
}: {
  items: any[];
  label: string;
  renderItem: (item: any, index: number) => React.ReactNode;
  standardLimit?: number;
  className?: string;
}) {
  const { density } = useDensity();
  const [showAll, setShowAll] = useState(false);

  if (!items || items.length === 0) return null;

  // Compact: just show count
  if (density === "compact") {
    return (
      <div className={cn("flex items-center gap-2 py-0.5", className)}>
        <span className="text-xs text-muted-foreground">{label}:</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
          {items.length} items
        </span>
      </div>
    );
  }

  // Detailed: show all
  if (density === "detailed" || showAll) {
    return (
      <div className={className}>
        {items.map((item, i) => renderItem(item, i))}
        {density === "standard" && showAll && items.length > standardLimit && (
          <button
            onClick={() => setShowAll(false)}
            className="text-primary text-[10px] font-medium hover:underline mt-1"
          >
            Show less
          </button>
        )}
      </div>
    );
  }

  // Standard: show limited
  const visible = items.slice(0, standardLimit);
  const remaining = items.length - standardLimit;

  return (
    <div className={className}>
      {visible.map((item, i) => renderItem(item, i))}
      {remaining > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-primary text-[10px] font-medium hover:underline mt-1 flex items-center gap-1"
        >
          <ChevronRight className="h-3 w-3" />
          Show {remaining} more
        </button>
      )}
    </div>
  );
}

/**
 * Wraps a collapsible section. Density controls the default open state.
 * Compact: collapsed by default, shows just header with count.
 * Standard: collapsed by default, expandable.
 * Detailed: expanded by default.
 */
export function DensitySection({
  label,
  count,
  children,
  icon,
  className,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const { density } = useDensity();
  const [open, setOpen] = useState(density === "detailed");

  // Compact: only show header with count
  if (density === "compact") {
    return (
      <div className={cn("flex items-center gap-2 py-1.5 px-1", className)}>
        {icon}
        <span className="text-xs font-display font-semibold">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
            {count}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-display font-semibold text-foreground hover:text-primary transition-colors w-full text-left py-1.5"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {icon}
        {label}
        {count !== undefined && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground ml-1">
            {count}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
}
