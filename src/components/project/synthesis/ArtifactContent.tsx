import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Lightbulb,
  CircleAlert,
  Target,
} from "lucide-react";
import MermaidDiagram, { extractMermaidDiagrams } from "../MermaidDiagram";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import { useDensity } from "@/contexts/DensityContext";

export type { DensityLevel } from "@/contexts/DensityContext";

// ─── Finding classification for visual priority signals ─────────────────────
type FindingType = "risk" | "decision" | "blocker" | "recommendation" | "insight";

const FINDING_PATTERNS: { type: FindingType; patterns: RegExp }[] = [
  {
    type: "blocker",
    patterns: /\b(block|miss|undefined|absent|lack|gap|critical gap|not defined|no .* defined)\b/i,
  },
  {
    type: "risk",
    patterns: /\b(risk|aggressive|overrun|complex|concern|threat|vulnerab|fail|fragile|debt)\b/i,
  },
  {
    type: "decision",
    patterns: /\b(decision|chose|selected|recommend|approved|adopt|architecture style|approach)\b/i,
  },
  {
    type: "recommendation",
    patterns:
      /\b(should|must|need|require|clarif|define|consider|establish|conduct|address|ensure|mitigat)\b/i,
  },
  { type: "insight", patterns: /\b(finding|note|observ|align|support|enabl|strong)\b/i },
];

function classifyFinding(text: string): FindingType {
  for (const { type, patterns } of FINDING_PATTERNS) {
    if (patterns.test(text)) return type;
  }
  return "insight";
}

const FINDING_CONFIG: Record<
  FindingType,
  { icon: typeof AlertTriangle; label: string; chipClass: string; iconClass: string }
> = {
  blocker: {
    icon: CircleAlert,
    label: "Blocker",
    chipClass: "bg-destructive/15 text-destructive border-destructive/30",
    iconClass: "text-destructive",
  },
  risk: {
    icon: AlertTriangle,
    label: "Risk",
    chipClass: "bg-warning/15 text-warning border-warning/30",
    iconClass: "text-warning",
  },
  decision: {
    icon: ShieldCheck,
    label: "Decision",
    chipClass: "bg-success/15 text-success border-success/30",
    iconClass: "text-success",
  },
  recommendation: {
    icon: Lightbulb,
    label: "Action",
    chipClass: "bg-primary/15 text-primary border-primary/30",
    iconClass: "text-primary",
  },
  insight: {
    icon: Target,
    label: "Insight",
    chipClass: "bg-secondary text-muted-foreground border-border",
    iconClass: "text-muted-foreground",
  },
};

// Keys that are considered "key findings" — shown in standard mode
const KEY_FINDING_KEYS = new Set([
  "summary",
  "recommendation",
  "verdict",
  "decision",
  "rationale",
  "key_findings",
  "conclusion",
  "overall_assessment",
  "final_verdict",
  "selected_style",
  "primary_recommendation",
  "architecture_style",
  "risk_level",
  "confidence",
  "score",
  "result",
  "status",
  "overengineering_assessment",
  "suitability_verdict",
]);

function isKeyFinding(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]/g, "_");
  return (
    KEY_FINDING_KEYS.has(normalized) ||
    normalized.includes("summary") ||
    normalized.includes("verdict") ||
    normalized.includes("recommendation")
  );
}

export default function ArtifactContent({
  content,
  density: densityProp,
}: {
  content: any;
  density?: "compact" | "standard" | "detailed";
}) {
  const { density: contextDensity } = useDensity();
  const density = densityProp ?? contextDensity;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  if (!content || typeof content !== "object") {
    return <p className="text-xs text-muted-foreground whitespace-pre-wrap">{String(content)}</p>;
  }

  if (content.parse_error) {
    const recovered = recoverArtifactContent(content);
    if (recovered) {
      return <ArtifactContent content={recovered} density={density} />;
    }
    return (
      <div className="bg-destructive/10 rounded p-3">
        <p className="text-xs text-destructive font-mono mb-2">Failed to parse agent output</p>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto">
          {content.raw_output}
        </pre>
      </div>
    );
  }

  const renderValue = (key: string, value: any, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) return null;
    if (key === "title") return null;

    const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    // In compact mode, only show key findings as inline badges
    if (density === "compact" && !isKeyFinding(key)) return null;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (
        typeof value === "string" &&
        [
          "strong",
          "adequate",
          "weak",
          "high",
          "medium",
          "low",
          "passed",
          "warning",
          "failed",
          "critical",
        ].includes(value)
      ) {
        const colors: Record<string, string> = {
          strong: "bg-success/20 text-success",
          passed: "bg-success/20 text-success",
          high: "bg-warning/20 text-warning",
          adequate: "bg-primary/20 text-primary",
          medium: "bg-primary/20 text-primary",
          warning: "bg-warning/20 text-warning",
          weak: "bg-destructive/20 text-destructive",
          low: "bg-secondary text-muted-foreground",
          failed: "bg-destructive/20 text-destructive",
          critical: "bg-destructive/20 text-destructive",
        };
        return (
          <div key={key} className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted-foreground min-w-[120px]">{label}:</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded ${colors[value] || "bg-secondary text-muted-foreground"}`}
            >
              {value}
            </span>
          </div>
        );
      }

      // In compact mode, truncate long strings
      const displayValue =
        density === "compact" && typeof value === "string" && value.length > 120
          ? value.slice(0, 120) + "…"
          : String(value);

      return (
        <div key={key} className="py-1">
          <span className="text-xs font-medium text-foreground">{label}: </span>
          <span className="text-xs text-muted-foreground">{displayValue}</span>
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return null;

      // In standard mode, non-key arrays start collapsed; in detailed mode, all expanded
      const defaultExpanded =
        density === "detailed" ? true : density === "standard" ? isKeyFinding(key) : false;
      const isExpanded = expanded[key] ?? defaultExpanded;

      // In compact mode, just show count
      if (density === "compact") {
        return (
          <div key={key} className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted-foreground">{label}:</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
              {value.length} items
            </span>
          </div>
        );
      }

      return (
        <div key={key} className="py-2">
          <button
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 text-xs font-display font-semibold text-foreground hover:text-primary transition-colors w-full text-left"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {label} ({value.length})
          </button>
          {isExpanded && (
            <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
              {value.map((item, idx) => (
                <div key={idx} className="py-1">
                  {typeof item === "string" ? (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ) : typeof item === "object" && item !== null ? (
                    <div className="rounded border bg-card/50 p-3 space-y-1">
                      {Object.entries(item).map(([k, v]) => renderValue(k, v, depth + 1))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{String(item)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const defaultExpanded =
        density === "detailed" ? true : density === "standard" ? isKeyFinding(key) : false;
      const isExpanded = expanded[key] ?? defaultExpanded;

      if (density === "compact") return null;

      return (
        <div key={key} className="py-2">
          <button
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 text-xs font-display font-semibold text-foreground hover:text-primary transition-colors w-full text-left"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {label}
          </button>
          {isExpanded && (
            <div className="mt-2 pl-4 border-l-2 border-border space-y-1">
              {Object.entries(value).map(([k, v]) => renderValue(k, v, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const diagrams = extractMermaidDiagrams(content);
  const showDiagrams = density !== "compact" && diagrams.length > 0;

  // Build classified findings for the Key Takeaway card
  const classifiedFindings =
    content.key_findings && Array.isArray(content.key_findings)
      ? content.key_findings.map((f: string) => ({ text: f, type: classifyFinding(f) }))
      : [];
  const displayFindings =
    density === "compact" ? classifiedFindings.slice(0, 3) : classifiedFindings;

  return (
    <div className="space-y-1">
      {content.summary && (
        <div className="bg-primary/5 rounded-lg p-3 mb-3">
          <p className="text-xs text-foreground">
            {density === "compact" && content.summary.length > 200
              ? content.summary.slice(0, 200) + "…"
              : content.summary}
          </p>
        </div>
      )}

      {displayFindings.length > 0 && (
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10 p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-primary" />
            </div>
            <h4 className="text-xs font-display font-bold uppercase tracking-wider text-foreground">
              Key Takeaways
            </h4>
            <span className="text-[9px] font-mono text-muted-foreground ml-auto">
              {classifiedFindings.length} findings
            </span>
          </div>
          <div className="space-y-2.5">
            {displayFindings.map((finding: { text: string; type: FindingType }, i: number) => {
              const config = FINDING_CONFIG[finding.type];
              const Icon = config.icon;
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-md flex items-center justify-center ${config.chipClass} border`}
                  >
                    <Icon className={`h-3 w-3 ${config.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${config.iconClass}`}
                    >
                      {config.label}
                    </span>
                    <p className="text-xs text-foreground/90 leading-relaxed mt-0.5">
                      {density === "compact" && finding.text.length > 120
                        ? finding.text.slice(0, 120) + "…"
                        : finding.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showDiagrams && (
        <div className="space-y-3 mb-4">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}
      {Object.entries(content)
        .filter(
          ([key]) =>
            key !== "summary" &&
            key !== "key_findings" &&
            key !== "mermaid_diagrams" &&
            key !== "diagrams" &&
            key !== "generated_diagrams",
        )
        .map(([key, value]) => renderValue(key, value))}
    </div>
  );
}
