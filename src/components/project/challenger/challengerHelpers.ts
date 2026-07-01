import {
  Cpu,
  Gauge,
  ShieldAlert,
  Coins,
  Network,
  Wrench,
  Activity,
  Settings2,
  Users,
  Database,
  FileCheck,
  Tag,
  type LucideIcon,
} from "lucide-react";

export type ConcernCategory =
  | "scalability"
  | "performance"
  | "security"
  | "cost"
  | "complexity"
  | "maintainability"
  | "reliability"
  | "operability"
  | "team_fit"
  | "data"
  | "compliance"
  | "other";

export const CATEGORY_META: Record<
  ConcernCategory,
  { label: string; icon: LucideIcon; tone: string }
> = {
  scalability: { label: "Scalability", icon: Network, tone: "text-primary" },
  performance: { label: "Performance", icon: Gauge, tone: "text-primary" },
  security: { label: "Security", icon: ShieldAlert, tone: "text-destructive" },
  cost: { label: "Cost", icon: Coins, tone: "text-warning" },
  complexity: { label: "Complexity", icon: Cpu, tone: "text-warning" },
  maintainability: { label: "Maintainability", icon: Wrench, tone: "text-muted-foreground" },
  reliability: { label: "Reliability", icon: Activity, tone: "text-success" },
  operability: { label: "Operability", icon: Settings2, tone: "text-muted-foreground" },
  team_fit: { label: "Team fit", icon: Users, tone: "text-muted-foreground" },
  data: { label: "Data", icon: Database, tone: "text-primary" },
  compliance: { label: "Compliance", icon: FileCheck, tone: "text-warning" },
  other: { label: "Other", icon: Tag, tone: "text-muted-foreground" },
};

export function normalizeCategory(raw?: string): ConcernCategory {
  if (!raw) return "other";
  const k = raw.toLowerCase().replace(/[\s-]+/g, "_") as ConcernCategory;
  return (CATEGORY_META as any)[k] ? k : "other";
}

export const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-secondary text-muted-foreground border-border",
};

export type VerdictKey =
  | "agree"
  | "partially_disagree"
  | "strongly_disagree"
  | "accept"
  | "accept_with_revisions"
  | "revise"
  | "reject";

export const VERDICT_META: Record<string, { label: string; tone: string; ringClass: string }> = {
  agree: { label: "Endorsed", tone: "text-success", ringClass: "stroke-success" },
  accept: { label: "Accept", tone: "text-success", ringClass: "stroke-success" },
  accept_with_revisions: {
    label: "Accept w/ revisions",
    tone: "text-primary",
    ringClass: "stroke-primary",
  },
  partially_disagree: {
    label: "Partially challenged",
    tone: "text-warning",
    ringClass: "stroke-warning",
  },
  revise: { label: "Revise", tone: "text-warning", ringClass: "stroke-warning" },
  strongly_disagree: {
    label: "Strongly challenged",
    tone: "text-destructive",
    ringClass: "stroke-destructive",
  },
  reject: { label: "Reject", tone: "text-destructive", ringClass: "stroke-destructive" },
};

export function getVerdictMeta(v?: string | null) {
  if (!v)
    return {
      label: "Reviewed",
      tone: "text-muted-foreground",
      ringClass: "stroke-muted-foreground",
    };
  return (
    VERDICT_META[v] || {
      label: v,
      tone: "text-muted-foreground",
      ringClass: "stroke-muted-foreground",
    }
  );
}
