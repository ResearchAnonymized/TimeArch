/**
 * Shared Discovery surfaces — one look for Current / Propose / Review.
 * Colors follow app tokens: primary blue, emerald, amber, violet, sky.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { FeatureCategory } from "@/lib/systemInventory";

export const CATEGORY_TONE: Record<
  FeatureCategory,
  { dot: string; chip: string; head: string }
> = {
  functional: {
    dot: "bg-primary",
    chip: "bg-primary/10 text-primary border-primary/20",
    head: "bg-primary/[0.07]",
  },
  interface: {
    dot: "bg-violet-500",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    head: "bg-violet-500/[0.07]",
  },
  non_functional: {
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20",
    head: "bg-amber-500/[0.07]",
  },
  constraint: {
    dot: "bg-sky-500",
    chip: "bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/20",
    head: "bg-sky-500/[0.07]",
  },
};

export function DiscoveryPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function DiscoveryPanelHeader({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border/80 bg-gradient-to-r from-primary/[0.06] via-transparent to-emerald-500/[0.05] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {meta}
          {children}
        </div>
        {actions ? <div className="flex items-center gap-1 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export function DiscoveryStat({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  tone?: "primary" | "emerald" | "sky" | "violet" | "amber";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "sky"
        ? "bg-sky-500"
        : tone === "violet"
          ? "bg-violet-500"
          : tone === "amber"
            ? "bg-amber-500"
            : "bg-primary";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-sm", dot)} />
      {label}
      <span className="tabular-nums text-foreground/75">{value}</span>
    </span>
  );
}

export function DiscoveryCategoryChip({
  category,
  label,
  count,
}: {
  category: FeatureCategory;
  label: string;
  count: number;
}) {
  const tone = CATEGORY_TONE[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tone.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {label}
      <span className="tabular-nums opacity-80">{count}</span>
    </span>
  );
}

export function discoveryTheadClassName(category?: FeatureCategory) {
  return cn(
    "border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground",
    category ? CATEGORY_TONE[category].head : "bg-muted/40",
  );
}

export function discoveryThClassName() {
  return "px-3 py-2.5 font-medium";
}

export function discoveryTdClassName() {
  return "px-3 py-2.5 align-top";
}

export function discoveryTrClassName() {
  return "border-b last:border-b-0 hover:bg-primary/[0.03] transition-colors";
}
