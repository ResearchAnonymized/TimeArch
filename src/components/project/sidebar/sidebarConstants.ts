import { Bot, User, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Stage {
  id: number;
  label: string;
  icon: LucideIcon;
  short: string;
}

export interface PhaseGroup {
  label: string;
  range: readonly [number, number];
  accent: string;
}

export interface AccentColors {
  label: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  dot: string;
  phaseBg: string;
  phaseRing: string;
}

export const STAGE_RESPONSIBILITY: Record<
  number,
  { type: "agent" | "human" | "collab"; label: string }
> = {
  0: { type: "human", label: "Human-driven" },
  1: { type: "human", label: "Human-driven" },
  2: { type: "agent", label: "AI Agent" },
  3: { type: "agent", label: "AI Agent" },
  4: { type: "agent", label: "AI Agent" },
  5: { type: "collab", label: "AI + Human Review" },
  6: { type: "agent", label: "AI Agent" },
  7: { type: "agent", label: "AI Agent" },
  8: { type: "agent", label: "AI Agent" },
  9: { type: "collab", label: "AI + Human Review" },
  10: { type: "agent", label: "AI Agent" },
  11: { type: "agent", label: "AI Agent" },
  12: { type: "agent", label: "AI Agent" },
  13: { type: "agent", label: "AI Agent" },
  14: { type: "agent", label: "AI Agent" },
  15: { type: "human", label: "Human-driven" },
  16: { type: "agent", label: "AI Agent" },
  17: { type: "collab", label: "AI + Human Review" },
  18: { type: "human", label: "Human-driven" },
};

export const RESPONSIBILITY_STYLES: Record<string, { icon: LucideIcon; className: string }> = {
  agent: { icon: Bot, className: "text-violet-400/60" },
  human: { icon: User, className: "text-blue-400/60" },
  collab: { icon: Users, className: "text-amber-400/60" },
};

export const PHASE_GROUPS: PhaseGroup[] = [
  { label: "Requirement\nDefinition", range: [1, 3] as const, accent: "blue" },
  { label: "Architecture\nDesign", range: [4, 10] as const, accent: "violet" },
  { label: "Validation &\nAssurance", range: [11, 14] as const, accent: "amber" },
  { label: "Delivery &\nEvolution", range: [15, 18] as const, accent: "emerald" },
];

/**
 * Brownfield-only Discovery phase (Stage 0). Prepended to PHASE_GROUPS
 * at runtime when projects.mode === 'brownfield'. Greenfield projects
 * never see this group.
 */
export const BROWNFIELD_DISCOVERY_GROUP: PhaseGroup = {
  label: "Discovery",
  range: [0, 0] as const,
  accent: "cyan",
};

export function getPhaseGroupsForMode(mode: string | undefined): PhaseGroup[] {
  return mode === "brownfield" ? [BROWNFIELD_DISCOVERY_GROUP, ...PHASE_GROUPS] : PHASE_GROUPS;
}

export const ACCENT_COLORS: Record<string, AccentColors> = {
  blue: {
    label: "text-blue-400",
    activeBg: "bg-blue-500/10",
    activeText: "text-blue-300",
    activeBorder: "border-l-blue-400",
    dot: "bg-blue-500",
    phaseBg: "bg-blue-500/8",
    phaseRing: "ring-blue-500/20",
  },
  violet: {
    label: "text-violet-400",
    activeBg: "bg-violet-500/10",
    activeText: "text-violet-300",
    activeBorder: "border-l-violet-400",
    dot: "bg-violet-500",
    phaseBg: "bg-violet-500/8",
    phaseRing: "ring-violet-500/20",
  },
  amber: {
    label: "text-amber-400",
    activeBg: "bg-amber-500/10",
    activeText: "text-amber-300",
    activeBorder: "border-l-amber-400",
    dot: "bg-amber-500",
    phaseBg: "bg-amber-500/8",
    phaseRing: "ring-amber-500/20",
  },
  emerald: {
    label: "text-emerald-400",
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-300",
    activeBorder: "border-l-emerald-400",
    dot: "bg-emerald-500",
    phaseBg: "bg-emerald-500/8",
    phaseRing: "ring-emerald-500/20",
  },
  cyan: {
    label: "text-cyan-400",
    activeBg: "bg-cyan-500/10",
    activeText: "text-cyan-300",
    activeBorder: "border-l-cyan-400",
    dot: "bg-cyan-500",
    phaseBg: "bg-cyan-500/8",
    phaseRing: "ring-cyan-500/20",
  },
};
