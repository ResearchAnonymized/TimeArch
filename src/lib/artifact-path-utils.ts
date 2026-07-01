/**
 * Utilities for navigating, locating, and previewing parts of a structured
 * architecture artifact (the merged JSON stored in
 * `architecture_artifacts.content`).
 *
 * Used by the evidence-driven validation checklist to surface clickable
 * "Evidence at <path>" pointers and by the refinement diff viewer to show
 * exactly which sub-tree changed.
 */

export interface PathHit {
  /** Dot/bracket notation path, e.g. "concern_diagrams.security" or "controls[2]". */
  path: string;
  /** The matched value (string snippet or sub-object). */
  value: unknown;
  /** The exact term that triggered the match, lowercased. */
  matchedTerm: string;
}

const MAX_DEPTH = 8;
const MAX_HITS = 8;

/**
 * Walks the artifact tree and finds every path whose key OR string value
 * contains any of the supplied search terms (case-insensitive).
 * Returns up to MAX_HITS distinct hits with the deepest, most specific paths.
 */
export function findPathsForTerms(artifact: unknown, terms: string[]): PathHit[] {
  if (!artifact || !terms.length) return [];
  const lowered = terms.map((t) => t.toLowerCase()).filter(Boolean);
  const hits: PathHit[] = [];
  const seenPaths = new Set<string>();

  const visit = (node: unknown, path: string, depth: number) => {
    if (hits.length >= MAX_HITS || depth > MAX_DEPTH || node == null) return;

    if (typeof node === "string") {
      const lc = node.toLowerCase();
      for (const term of lowered) {
        if (lc.includes(term)) {
          if (!seenPaths.has(path)) {
            seenPaths.add(path);
            hits.push({ path: path || "(root)", value: node, matchedTerm: term });
          }
          return;
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, `${path}[${i}]`, depth + 1));
      return;
    }

    if (typeof node === "object") {
      for (const key of Object.keys(node as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key;
        const lcKey = key.toLowerCase();
        // Match on KEY name itself
        for (const term of lowered) {
          if (lcKey.includes(term) && !seenPaths.has(childPath)) {
            seenPaths.add(childPath);
            hits.push({
              path: childPath,
              value: (node as Record<string, unknown>)[key],
              matchedTerm: term,
            });
            break;
          }
        }
        visit((node as Record<string, unknown>)[key], childPath, depth + 1);
      }
    }
  };

  visit(artifact, "", 0);
  return hits;
}

/** Resolve a path produced by `findPathsForTerms` back to its sub-tree. */
export function getValueAtPath(artifact: unknown, path: string): unknown {
  if (!path || path === "(root)") return artifact;
  const tokens = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = artifact;
  for (const t of tokens) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(t);
      cur = Number.isFinite(idx) ? cur[idx] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[t];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Pretty preview of the value at a path. Strings come through verbatim;
 * everything else is JSON-stringified with indentation.
 */
export function previewValue(value: unknown, maxLen = 1200): string {
  if (value == null) return "(empty)";
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + "\n…[truncated]" : value;
  }
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > maxLen ? s.slice(0, maxLen) + "\n…[truncated]" : s;
  } catch {
    return String(value);
  }
}

/** Friendly short label for display, e.g. "concern_diagrams › security". */
export function humanizePath(path: string): string {
  if (!path || path === "(root)") return "root";
  return path
    .replace(/\[(\d+)\]/g, " #$1")
    .split(".")
    .filter(Boolean)
    .join(" › ");
}
