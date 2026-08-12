/**
 * StageShell — the reusable Clause-style clean surface used by every
 * one of the 18 Studio stages.
 *
 * Layout:
 *   ┌ Header (kicker · title · blurb · status pill) ──────────────┐
 *   │ Identity strip (2-4 labelled inputs, divided)               │
 *   │ Stat cards (up to 4)                                        │
 *   │ Section cards (children — whatever the stage needs)         │
 *   │ Checklist card (readiness)                                  │
 *   │ Sticky advance bar                                          │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Each stage passes props; Stage 1 (Cockpit) is one caller, but the same
 * shell renders stages 2–18 with generic/placeholder content until they
 * are individually built out.
 */

import { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStageShellCompact } from "./StageShellContext";
import ArtifactVersionHistory from "@/components/project/ArtifactVersionHistory";

// ── Types ────────────────────────────────────────────────────────────────

export type FieldStatus = "empty" | "busy" | "ok";

export interface StageShellStat {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "emerald" | "primary" | "rose" | "amber" | "neutral";
}

export interface StageShellCheck {
  key: string;
  label: string;
  ok: boolean;
}

export interface StageShellProps {
  /** e.g. "Requirement Definition · Stage 1 of 18" */
  kicker: string;
  /** Page title */
  title: string;
  /** One-sentence blurb under the title */
  blurb?: string;
  /** Optional right-aligned pill (Draft / Ready / In review …) */
  statusPill?: {
    label: string;
    tone?: "emerald" | "primary" | "rose" | "amber" | "neutral";
  };
  /** 2–4 top-of-page identity fields */
  identityFields?: ReactNode;
  /** Up to 4 metric cards */
  stats?: StageShellStat[];
  /** Body sections (each rendered as a rounded-2xl card) */
  children?: ReactNode;
  /** Readiness checklist */
  checks?: StageShellCheck[];
  checklistTitle?: string;
  checklistBlurb?: string;
  /** Sticky advance bar */
  advance?: {
    label: string;
    ready: boolean;
    busy?: boolean;
    onClick: () => void;
    missingHint?: string;
    ctaLabel?: string;
  };
  /** Secondary link (e.g. "Open in classic workspace") */
  secondaryLink?: {
    label: string;
    href: string;
    icon?: ReactNode;
  };
  /** Optional per-stage saved-versions history (rendered in the header). */
  versionHistory?: {
    projectId: string;
    stage: number;
    onRestored?: () => void;
  };
}

// ── Component ────────────────────────────────────────────────────────────

export default function StageShell({
  kicker,
  title,
  blurb,
  statusPill,
  identityFields,
  stats,
  children,
  checks,
  checklistTitle = "Stage checklist",
  checklistBlurb = "All items must be green to advance.",
  advance,
  secondaryLink,
  versionHistory,
}: StageShellProps) {
  const compact = useStageShellCompact();
  const ready = checks?.filter((c) => c.ok).length ?? 0;
  const total = checks?.length ?? 0;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;

  if (compact) {
    // Compact mode: header, stats, checklist, and advance bar live in the
    // parent StageHeader. Render only the caller-provided body sections.
    return <section className="space-y-4">{children}</section>;
  }

  return (
    <section className="mb-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-2">
            {kicker}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            {title}
          </h1>
          {blurb && (
            <p className="text-sm text-muted-foreground leading-relaxed">{blurb}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {versionHistory && (
            <ArtifactVersionHistory
              projectId={versionHistory.projectId}
              stage={versionHistory.stage}
              onRestored={versionHistory.onRestored}
            />
          )}
          {statusPill && <StagePill {...statusPill} />}
        </div>
      </div>

      {/* Identity strip */}
      {identityFields && (
        <div className="rounded-2xl border bg-card">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
            {identityFields}
          </div>
        </div>
      )}

      {/* Stat cards */}
      {stats && stats.length > 0 && (
        <div className={cn("grid gap-4 grid-cols-2", stats.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Body sections (caller-provided) */}
      {children}

      {/* Checklist */}
      {checks && checks.length > 0 && (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">{checklistTitle}</h2>
              <p className="text-xs text-muted-foreground">{checklistBlurb}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={cn("h-full", ready === total ? "bg-emerald-500" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{ready}</span>/{total}
              </span>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {checks.map((c, i) => (
              <li
                key={c.key}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                  c.ok
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border bg-background",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                )}
                <span className={cn("flex-1", c.ok ? "text-foreground" : "text-muted-foreground")}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Secondary link row */}
      {secondaryLink && (
        <div className="flex justify-end">
          <a
            href={secondaryLink.href}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {secondaryLink.icon ?? <ExternalLink className="h-3 w-3" />}
            {secondaryLink.label}
          </a>
        </div>
      )}

      {/* Sticky advance bar */}
      {advance && (
        <div className="rounded-2xl border bg-background/90 backdrop-blur px-6 py-4 flex items-center justify-between gap-4 sticky bottom-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{advance.label}</p>
            {!advance.ready && advance.missingHint && (
              <p className="text-[11px] text-muted-foreground truncate">
                {advance.missingHint}
              </p>
            )}
          </div>
          <Button
            size="lg"
            disabled={!advance.ready || advance.busy}
            onClick={advance.onClick}
            className="gap-2 flex-shrink-0"
          >
            {advance.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {advance.ctaLabel ?? "Advance"}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Reusable primitives (exported for stage authors) ─────────────────────

export function StripField({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: FieldStatus;
  children: ReactNode;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {label}
        </span>
        {status && <StatusDot status={status} />}
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export function StatusDot({ status }: { status: FieldStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "busy") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

export function StatCard({ label, value, sub, tone = "neutral" }: StageShellStat) {
  const tones = {
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300",
    primary: "border-primary/20 bg-primary/5 text-primary",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-300",
    neutral: "border-border bg-card text-foreground",
  } as const;
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80 mb-1">
        {label}
      </p>
      <p className="font-display text-3xl font-semibold leading-none">{value}</p>
      {sub && <p className="text-[11px] opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card">
      {(title || right) && (
        <div className={cn("flex items-center justify-between", padded ? "p-6 pb-3" : "p-4")}>
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={cn(padded ? "px-6 pb-6" : "")}>{children}</div>
    </div>
  );
}

function StagePill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StageShellStat["tone"];
}) {
  const tones = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    primary: "border-primary/30 bg-primary/10 text-primary",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    neutral: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  } as const;
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium", tones[tone])}
    >
      {label}
    </Badge>
  );
}
