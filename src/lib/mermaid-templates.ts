/**
 * Configurable Mermaid diagram templates.
 *
 * Centralizes spacing, typography, and color tokens for the three diagram
 * families used across the app (flowchart, ER, sequence) so diagrams look
 * consistent across every project and stage.
 *
 * To tweak the platform-wide diagram look, edit the values below — every
 * MermaidDiagram instance reads from `getMermaidConfig()` and stays in sync.
 */

export type MermaidTemplateName = "flowchart" | "er" | "sequence";

export interface MermaidTypography {
  fontFamily: string;
  nodeFontSize: number; // px
  edgeFontSize: number; // px
  clusterFontSize: number; // px
  fontWeight: number; // 400-700
  letterSpacing: string; // CSS letter-spacing
  lineHeight: number;
}

export interface FlowchartTemplate {
  curve: "basis" | "linear" | "cardinal" | "step" | "monotoneX";
  nodeSpacing: number;
  rankSpacing: number;
  padding: number;
  htmlLabels: boolean;
  useMaxWidth: boolean;
  strokeWidth: number;
  clusterRadius: number;
  clusterDash: string; // SVG dasharray
}

export interface ErTemplate {
  entityPadding: number;
  fontSize: number;
  useMaxWidth: boolean;
  strokeWidth: number;
}

export interface SequenceTemplate {
  actorMargin: number;
  messageMargin: number;
  boxMargin: number;
  useMaxWidth: boolean;
  mirrorActors: boolean;
}

export interface MermaidPalette {
  primary: string;
  primaryText: string;
  primaryBorder: string;
  line: string;
  secondary: string;
  tertiary: string;
  background: string;
  nodeBg: string;
  nodeBorder: string;
  clusterBg: string;
  clusterBorder: string;
  edgeLabelBg: string;
  textColor: string;
}

export interface MermaidTemplates {
  typography: MermaidTypography;
  flowchart: FlowchartTemplate;
  er: ErTemplate;
  sequence: SequenceTemplate;
  light: MermaidPalette;
  dark: MermaidPalette;
}

/* ------------------------------------------------------------------ */
/*  Default templates — tune here to change the look platform-wide.   */
/* ------------------------------------------------------------------ */

export const DEFAULT_MERMAID_TEMPLATES: MermaidTemplates = {
  typography: {
    fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
    nodeFontSize: 14,
    edgeFontSize: 12,
    clusterFontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.01em",
    lineHeight: 1.35,
  },
  flowchart: {
    curve: "basis",
    nodeSpacing: 60,
    rankSpacing: 80,
    padding: 16,
    htmlLabels: true,
    useMaxWidth: true,
    strokeWidth: 1.5,
    clusterRadius: 8,
    clusterDash: "4 4",
  },
  er: {
    entityPadding: 18,
    fontSize: 14,
    useMaxWidth: true,
    strokeWidth: 1.5,
  },
  sequence: {
    actorMargin: 60,
    messageMargin: 40,
    boxMargin: 12,
    useMaxWidth: true,
    mirrorActors: false,
  },
  light: {
    primary: "#dbeafe",
    primaryText: "#0f172a",
    primaryBorder: "#3b82f6",
    line: "#64748b",
    secondary: "#f1f5f9",
    tertiary: "#f8fafc",
    background: "#ffffff",
    nodeBg: "#ffffff",
    nodeBorder: "#94a3b8",
    clusterBg: "#f8fafc",
    clusterBorder: "#cbd5e1",
    edgeLabelBg: "#ffffff",
    textColor: "#0f172a",
  },
  dark: {
    primary: "#3b82f6",
    primaryText: "#f8fafc",
    primaryBorder: "#60a5fa",
    line: "#64748b",
    secondary: "#1e293b",
    tertiary: "#0f172a",
    background: "#0f172a",
    nodeBg: "#1e293b",
    nodeBorder: "#475569",
    clusterBg: "#0f172a",
    clusterBorder: "#334155",
    edgeLabelBg: "#0f172a",
    textColor: "#f8fafc",
  },
};

/* ------------------------------------------------------------------ */
/*  Runtime overrides (localStorage) — power users can tune live.     */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "mermaid:templates:v1";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const ov = (override as any)[key];
    const bv = (base as any)[key];
    if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object") {
      out[key] = deepMerge(bv, ov);
    } else if (ov !== undefined) {
      out[key] = ov;
    }
  }
  return out as T;
}

export function getMermaidTemplates(): MermaidTemplates {
  if (typeof window === "undefined") return DEFAULT_MERMAID_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MERMAID_TEMPLATES;
    const parsed = JSON.parse(raw) as DeepPartial<MermaidTemplates>;
    return deepMerge(DEFAULT_MERMAID_TEMPLATES, parsed);
  } catch {
    return DEFAULT_MERMAID_TEMPLATES;
  }
}

export function setMermaidTemplates(overrides: DeepPartial<MermaidTemplates> | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!overrides) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
    window.dispatchEvent(new Event("mermaid-templates-change"));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Convert templates → mermaid.initialize() config + themeCSS.        */
/* ------------------------------------------------------------------ */

function paletteToThemeVariables(palette: MermaidPalette, fontSize: number) {
  return {
    primaryColor: palette.primary,
    primaryTextColor: palette.primaryText,
    primaryBorderColor: palette.primaryBorder,
    lineColor: palette.line,
    secondaryColor: palette.secondary,
    tertiaryColor: palette.tertiary,
    background: palette.background,
    mainBkg: palette.nodeBg,
    nodeBorder: palette.nodeBorder,
    clusterBkg: palette.clusterBg,
    clusterBorder: palette.clusterBorder,
    titleColor: palette.textColor,
    edgeLabelBackground: palette.edgeLabelBg,
    nodeTextColor: palette.textColor,
    fontSize: `${fontSize}px`,
  };
}

export function buildMermaidConfig(dark: boolean) {
  const t = getMermaidTemplates();
  const palette = dark ? t.dark : t.light;

  const themeCSS = `
    .nodeLabel, .edgeLabel, .label, .cluster-label text {
      font-family: ${t.typography.fontFamily} !important;
      font-size: ${t.typography.nodeFontSize}px !important;
      font-weight: ${t.typography.fontWeight} !important;
      letter-spacing: ${t.typography.letterSpacing};
    }
    .edgeLabel { font-size: ${t.typography.edgeFontSize}px !important; font-weight: ${t.typography.fontWeight} !important; }
    .cluster-label text {
      font-weight: 600 !important;
      font-size: ${t.typography.clusterFontSize}px !important;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .node rect, .node polygon, .node circle, .node ellipse, .node path {
      stroke-width: ${t.flowchart.strokeWidth}px !important;
    }
    .edgePath .path { stroke-width: ${t.flowchart.strokeWidth}px !important; }
    .cluster rect {
      rx: ${t.flowchart.clusterRadius}px;
      ry: ${t.flowchart.clusterRadius}px;
      stroke-dasharray: ${t.flowchart.clusterDash};
    }
    .er.entityBox { stroke-width: ${t.er.strokeWidth}px !important; }
    foreignObject div { line-height: ${t.typography.lineHeight} !important; }
  `;

  return {
    startOnLoad: false,
    theme: dark ? ("dark" as const) : ("default" as const),
    securityLevel: "loose" as const,
    fontFamily: t.typography.fontFamily,
    flowchart: {
      htmlLabels: t.flowchart.htmlLabels,
      curve: t.flowchart.curve,
      nodeSpacing: t.flowchart.nodeSpacing,
      rankSpacing: t.flowchart.rankSpacing,
      padding: t.flowchart.padding,
      useMaxWidth: t.flowchart.useMaxWidth,
    },
    er: {
      useMaxWidth: t.er.useMaxWidth,
      entityPadding: t.er.entityPadding,
      fontSize: t.er.fontSize,
    },
    sequence: {
      useMaxWidth: t.sequence.useMaxWidth,
      actorMargin: t.sequence.actorMargin,
      messageMargin: t.sequence.messageMargin,
      boxMargin: t.sequence.boxMargin,
      mirrorActors: t.sequence.mirrorActors,
    },
    themeCSS,
    themeVariables: paletteToThemeVariables(palette, t.typography.nodeFontSize),
  };
}
