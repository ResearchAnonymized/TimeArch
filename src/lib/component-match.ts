/**
 * Fuzzy match a candidate component name against the canonical Stage 6
 * component list. Handles the common drift where downstream agents invent
 * names like "Data Management Service" while Stage 6 has "CoreDataPersistence".
 *
 * Strategy (first hit wins):
 *   1. Exact case-insensitive match.
 *   2. Normalised match — strip generic suffixes (service, api, module,
 *      management, layer, component) and non-alphanumerics, compare.
 *   3. Token-overlap (Jaccard) on lowercased word/camel tokens; require
 *      score ≥ 0.5 and no tie with another candidate.
 *
 * Returns the canonical Stage 6 name, or `null` if no confident match.
 */

const STOPWORDS = new Set([
  "service",
  "services",
  "api",
  "apis",
  "module",
  "modules",
  "layer",
  "component",
  "components",
  "system",
  "systems",
  "data",
  "management",
  "manager",
  "handler",
  "handlers",
]);

function tokens(s: string): string[] {
  return s
    // split camelCase and PascalCase
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function contentTokens(s: string): Set<string> {
  return new Set(tokens(s).filter((t) => !STOPWORDS.has(t)));
}

function normalise(s: string): string {
  return [...contentTokens(s)].sort().join("");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

export function matchComponent(
  candidate: string | null | undefined,
  componentNames: string[],
): string | null {
  if (!candidate || typeof candidate !== "string" || componentNames.length === 0) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  // 1. Exact case-insensitive
  const lower = trimmed.toLowerCase();
  const exact = componentNames.find((n) => n.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Normalised (stopwords + non-alnum stripped)
  const cNorm = normalise(trimmed);
  if (cNorm) {
    const normHit = componentNames.find((n) => normalise(n) === cNorm);
    if (normHit) return normHit;
  }

  // 3. Token overlap
  const cToks = contentTokens(trimmed);
  if (cToks.size === 0) return null;
  const scored = componentNames
    .map((n) => ({ name: n, score: jaccard(cToks, contentTokens(n)) }))
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  // Reject ties (avoid random pick)
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].name;
}

/**
 * Bulk-map a set of candidates. Returns a map from original → canonical name
 * (only entries that resolved). Useful for building rewrite tables.
 */
export function buildComponentRemap(
  candidates: string[],
  componentNames: string[],
): { remap: Record<string, string>; unresolved: string[] } {
  const remap: Record<string, string> = {};
  const unresolved: string[] = [];
  const uniq = Array.from(new Set(candidates.map((c) => (c || "").trim()).filter(Boolean)));
  for (const c of uniq) {
    const canonical = matchComponent(c, componentNames);
    if (canonical && canonical !== c) remap[c] = canonical;
    else if (!canonical) unresolved.push(c);
  }
  return { remap, unresolved };
}
