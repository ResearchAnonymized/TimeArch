import React from "react";
import { Activity, Lock, AlertTriangle, Archive } from "lucide-react";

export const STAGE_LABELS: Record<number, string> = {
  1: "Requirement Collection",
  2: "Requirement Analysis",
  3: "Architecture Drivers",
  4: "Style Selection",
  5: "Tradeoff Evaluation",
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
  9: "Cross-Cutting Concerns",
  10: "Infrastructure & Deployment",
  11: "Quality Attributes",
  12: "Risk Assessment",
  13: "Architecture Validation",
  14: "Documentation & ADRs",
  15: "Stakeholder Approval",
  16: "Code Generation",
  17: "Implementation Review",
  18: "Architecture Evolution",
};

export const PHASE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "Requirement Definition", color: "text-primary" },
  2: { label: "Requirement Definition", color: "text-primary" },
  3: { label: "Requirement Definition", color: "text-primary" },
  4: { label: "Architecture Design", color: "text-violet-500" },
  5: { label: "Architecture Design", color: "text-violet-500" },
  6: { label: "Architecture Design", color: "text-violet-500" },
  7: { label: "Architecture Design", color: "text-violet-500" },
  8: { label: "Architecture Design", color: "text-violet-500" },
  9: { label: "Architecture Design", color: "text-violet-500" },
  10: { label: "Architecture Design", color: "text-violet-500" },
  11: { label: "Validation & Assurance", color: "text-amber-500" },
  12: { label: "Validation & Assurance", color: "text-amber-500" },
  13: { label: "Validation & Assurance", color: "text-amber-500" },
  14: { label: "Validation & Assurance", color: "text-amber-500" },
  15: { label: "Delivery & Evolution", color: "text-emerald-500" },
  16: { label: "Delivery & Evolution", color: "text-emerald-500" },
  17: { label: "Delivery & Evolution", color: "text-emerald-500" },
  18: { label: "Delivery & Evolution", color: "text-emerald-500" },
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  updated_at: string;
  created_at: string;
}

export type StatusFilter = "all" | "active" | "review" | "locked" | "archived";
export type SortKey = "updated" | "name" | "progress";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string; label: string }
> = {
  active: {
    icon: <Activity className="h-3 w-3" />,
    bg: "bg-primary/10",
    text: "text-primary",
    label: "Active",
  },
  locked: {
    icon: <Lock className="h-3 w-3" />,
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Locked",
  },
  review: {
    icon: <AlertTriangle className="h-3 w-3" />,
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    label: "In Review",
  },
  archived: {
    icon: <Archive className="h-3 w-3" />,
    bg: "bg-muted",
    text: "text-muted-foreground",
    label: "Archived",
  },
};

export const StatusBadge = React.forwardRef<HTMLSpanElement, { status: string }>(
  function StatusBadge({ status }, ref) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase ${cfg.bg} ${cfg.text}`}
      >
        {cfg.icon} {cfg.label}
      </span>
    );
  },
);
