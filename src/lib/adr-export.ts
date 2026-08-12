// Export an architecture-decision-like artifact as a Markdown MADR file.
// MADR 3.0 template: https://adr.github.io/madr/

interface DecisionOption {
  title?: string;
  name?: string;
  pros?: string[];
  cons?: string[];
  description?: string;
}

interface DecisionShape {
  title?: string;
  status?: string;
  date?: string;
  context?: string;
  decision?: string;
  decision_drivers?: string[];
  drivers?: string[];
  considered_options?: DecisionOption[];
  options?: DecisionOption[];
  consequences?: string | { positive?: string[]; negative?: string[]; neutral?: string[] };
  related_requirements?: string[];
  rationale?: string;
}

export function decisionToMarkdown(a: {
  title: string | null;
  type: string;
  version: number | null;
  status: string | null;
  content: unknown;
}): string {
  const c = (a.content ?? {}) as DecisionShape;
  const title = c.title || a.title || a.type;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- Status: ${c.status || a.status || "proposed"}`);
  if (c.date) lines.push(`- Date: ${c.date}`);
  if (a.version != null) lines.push(`- Version: v${a.version}`);
  lines.push("");

  const drivers = c.decision_drivers || c.drivers;
  if (drivers?.length) {
    lines.push("## Decision Drivers");
    drivers.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
  }

  if (c.context) {
    lines.push("## Context and Problem Statement");
    lines.push(c.context);
    lines.push("");
  }

  const options = c.considered_options || c.options;
  if (options?.length) {
    lines.push("## Considered Options");
    options.forEach((o) => {
      const t = o.title || o.name || "(unnamed option)";
      lines.push(`### ${t}`);
      if (o.description) lines.push(o.description);
      if (o.pros?.length) {
        lines.push("");
        lines.push("Pros:");
        o.pros.forEach((p) => lines.push(`- ${p}`));
      }
      if (o.cons?.length) {
        lines.push("");
        lines.push("Cons:");
        o.cons.forEach((p) => lines.push(`- ${p}`));
      }
      lines.push("");
    });
  }

  if (c.decision) {
    lines.push("## Decision Outcome");
    lines.push(c.decision);
    lines.push("");
  }

  if (c.rationale) {
    lines.push("## Rationale");
    lines.push(c.rationale);
    lines.push("");
  }

  if (c.consequences) {
    lines.push("## Consequences");
    if (typeof c.consequences === "string") {
      lines.push(c.consequences);
    } else {
      if (c.consequences.positive?.length) {
        lines.push("**Positive**");
        c.consequences.positive.forEach((p) => lines.push(`- ${p}`));
      }
      if (c.consequences.negative?.length) {
        lines.push("");
        lines.push("**Negative**");
        c.consequences.negative.forEach((p) => lines.push(`- ${p}`));
      }
      if (c.consequences.neutral?.length) {
        lines.push("");
        lines.push("**Neutral**");
        c.consequences.neutral.forEach((p) => lines.push(`- ${p}`));
      }
    }
    lines.push("");
  }

  if (c.related_requirements?.length) {
    lines.push("## Related Requirements");
    c.related_requirements.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
