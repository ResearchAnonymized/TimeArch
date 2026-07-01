/**
 * Tries to recover parsed content from an artifact that may have parse_error.
 * Returns the parsed content object, or null if unrecoverable.
 */
export function recoverArtifactContent(rawContent: any): any | null {
  if (!rawContent) return null;

  // Already parsed successfully
  if (!rawContent.parse_error) return rawContent;

  // Try to parse raw_output
  if (rawContent.raw_output && typeof rawContent.raw_output === "string") {
    const raw = rawContent.raw_output;

    // Attempt 1: Direct parse
    try {
      return JSON.parse(raw);
    } catch {
      /* continue */
    }

    // Attempt 2: Strip markdown fences then parse
    try {
      const stripped = raw
        .replace(/^```(?:json|JSON|javascript|js|typescript|ts)?\s*\n?/gim, "")
        .replace(/\n?```\s*$/gim, "")
        .trim();
      return JSON.parse(stripped);
    } catch {
      /* continue */
    }

    // Attempt 3: Extract JSON block
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      /* continue */
    }

    // Attempt 4: Fix common AI JSON issues
    try {
      let cleaned = raw;
      // Remove trailing commas
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
      // Remove control characters (except newline/tab)
      cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
      const match2 = cleaned.match(/\{[\s\S]*\}/);
      if (match2) return JSON.parse(match2[0]);
    } catch {
      /* continue */
    }

    // Attempt 5: Truncate at the error and close brackets
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const json = match[0];
        const step = Math.max(1, Math.floor(json.length / 200));
        for (let i = json.length; i > json.length * 0.4; i -= step) {
          const truncated = json.substring(0, i);
          const openBraces = (truncated.match(/{/g) || []).length;
          const closeBraces = (truncated.match(/}/g) || []).length;
          const openBrackets = (truncated.match(/\[/g) || []).length;
          const closeBrackets = (truncated.match(/]/g) || []).length;
          let fixed = truncated;
          // Remove trailing partial values
          fixed = fixed.replace(/,\s*"[^"]*$/, "");
          fixed = fixed.replace(/:\s*"[^"]*$/, ': ""');
          fixed = fixed.replace(/,\s*$/, "");
          // Close arrays then objects
          for (let b = 0; b < openBrackets - closeBrackets; b++) fixed += "]";
          for (let b = 0; b < openBraces - closeBraces; b++) fixed += "}";
          fixed = fixed.replace(/,\s*([\]}])/g, "$1");
          try {
            return JSON.parse(fixed);
          } catch {
            /* try shorter */
          }
        }
      }
    } catch {
      /* unrecoverable */
    }

    // Attempt 6: Extract module-like structures from text for code_output artifacts
    try {
      const modules = extractModulesFromText(raw);
      if (modules.length > 0) {
        return {
          title: "Recovered Code Scaffold",
          summary:
            "Recovered from unstructured AI output. Review module interfaces before locking.",
          key_findings: [
            `Recovered ${modules.length} module(s) from text output.`,
            "Structured tool calling was unavailable — review carefully.",
          ],
          modules,
          _recovered_from_text: true,
        };
      }
    } catch {
      /* continue */
    }
  }

  return null;
}

/**
 * Extract module-like structures from unstructured text (headings, bold bullets).
 */
function extractModulesFromText(raw: string): any[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const modules: any[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (modules.length >= 8) break;

    // Match ## Headings
    const headingMatch = line.match(/^#{2,6}\s+(.+)$/);
    if (headingMatch) {
      const name = headingMatch[1].replace(/[\s:]+$/, "");
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        modules.push({
          name,
          responsibility: "Extracted from heading — review and refine.",
          interfaces: [],
          recovered_from_text: true,
        });
      }
      continue;
    }

    // Match **Bold**: description bullets
    const boldMatch = line.match(/^[-*+]\s+\*\*([^*]+)\*\*:?\s*(.*)$/);
    if (boldMatch) {
      const name = boldMatch[1].replace(/[\s:]+$/, "");
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        modules.push({
          name,
          responsibility: boldMatch[2] || "Extracted from text — review and refine.",
          interfaces: [],
          recovered_from_text: true,
        });
      }
    }
  }

  return modules;
}
