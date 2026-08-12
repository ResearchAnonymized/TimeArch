/**
 * Robust formatter for requirement acceptance criteria.
 *
 * Acceptance criteria arrive in many shapes depending on how a requirement
 * was authored / extracted / reverse-engineered:
 *
 *   - a plain string
 *   - an array of strings
 *   - an array of objects { text | criterion | description | label | value }
 *   - an object with Given / When / Then keys (optionally arrays)
 *   - an object keyed by id → criterion
 *   - deeply nested combinations of the above
 *   - with null / undefined / empty entries interleaved
 *
 * `formatAcceptanceCriteria(input)` always returns a clean `string[]`
 * with no empty entries and no literal "[object Object]".
 */

type Primitive = string | number | boolean;

const TEXT_KEYS = [
  "text",
  "criterion",
  "criteria",
  "description",
  "label",
  "value",
  "statement",
  "requirement",
  "detail",
  "summary",
] as const;

const isPrimitive = (v: unknown): v is Primitive =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Turn a Given/When/Then chunk (string or array of strings) into one line. */
function joinGwt(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(joinGwt).filter(Boolean).join(" and ");
  if (isPrimitive(v)) return clean(String(v));
  if (typeof v === "object") {
    // Nested object under given/when/then — try to grab any text-like field.
    const obj = v as Record<string, unknown>;
    for (const key of TEXT_KEYS) {
      const candidate = obj[key];
      if (isPrimitive(candidate)) return clean(String(candidate));
    }
  }
  return "";
}

function formatProvenance(obj: Record<string, unknown>): string {
  const origin = obj.origin as Record<string, unknown> | undefined;
  const provenance = obj.provenance;
  const sourceKind = obj.source_kind ?? obj.sourceKind;
  const sourceLabel = obj.source_label ?? obj.sourceLabel;

  // Only treat as provenance if it clearly is one — avoid hijacking real ACs.
  if (!origin && !provenance && !sourceKind && !sourceLabel) return "";

  const parts: string[] = [];

  if (origin && typeof origin === "object") {
    const type = origin.type as string | undefined;
    const table = origin.table as string | undefined;
    const columns = origin.columns as unknown;
    const columnCount = origin.column_count ?? origin.columnCount;

    if (type && table) {
      parts.push(`Derived from ${clean(String(type))} \`${clean(String(table))}\``);
    } else if (table) {
      parts.push(`Derived from \`${clean(String(table))}\``);
    } else if (type) {
      parts.push(`Derived from ${clean(String(type))}`);
    }

    if (Array.isArray(columns) && columns.length) {
      const cols = columns.slice(0, 6).map((c) => clean(String(c))).join(", ");
      const suffix = columns.length > 6 ? `, +${columns.length - 6} more` : "";
      parts.push(`columns: ${cols}${suffix}`);
    } else if (columnCount) {
      parts.push(`${columnCount} columns`);
    }
  }

  if (sourceLabel) parts.push(`source: ${clean(String(sourceLabel))}`);
  else if (provenance) parts.push(`source: ${clean(String(provenance))}`);

  if (obj.needs_human_confirmation === true || obj.needsHumanConfirmation === true) {
    parts.push("needs human confirmation");
  }

  return parts.join(" · ");
}

function formatOne(item: unknown): string {
  if (item == null) return "";
  if (isPrimitive(item)) return clean(String(item));

  if (Array.isArray(item)) {
    return item.map(formatOne).filter(Boolean).join(" · ");
  }

  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;

    // 0) Provenance / origin blob (reverse-engineered requirements)
    const provSummary = formatProvenance(obj);
    if (provSummary) return provSummary;

    // 1) Direct text-like field
    for (const key of TEXT_KEYS) {
      const candidate = obj[key];
      if (isPrimitive(candidate)) return clean(String(candidate));
    }

    // 2) Given / When / Then shape (case-insensitive keys)
    const lower: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
    const given = joinGwt(lower.given);
    const when = joinGwt(lower.when);
    const then = joinGwt(lower.then);
    if (given || when || then) {
      const parts = [
        given && `Given ${given}`,
        when && `When ${when}`,
        then && `Then ${then}`,
      ].filter(Boolean) as string[];
      if (parts.length) return parts.join(" · ");
    }

    // 3) Fall back to first primitive value
    for (const v of Object.values(obj)) {
      if (isPrimitive(v)) {
        const s = clean(String(v));
        if (s) return s;
      }
    }

    // 4) Recurse into nested objects
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        const nested = formatOne(v);
        if (nested) return nested;
      }
    }
  }

  return "";
}


export function formatAcceptanceCriteria(input: unknown): string[] {
  if (input == null) return [];

  if (typeof input === "string") {
    // Try JSON string first (some rows store JSON as text)
    const trimmed = input.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return formatAcceptanceCriteria(JSON.parse(trimmed));
      } catch {
        /* not JSON — treat as plain */
      }
    }
    return trimmed ? [clean(trimmed)] : [];
  }

  if (Array.isArray(input)) {
    return input.map(formatOne).filter(Boolean);
  }

  if (typeof input === "object") {
    // Object with GWT at the top level? Return one entry.
    const one = formatOne(input);
    if (one) {
      // If the object is really a map of criteria (id → criterion), the GWT
      // branch above won't fire; formatOne will pick the first primitive,
      // which isn't what we want. Detect that case explicitly.
      const obj = input as Record<string, unknown>;
      const hasGwt = ["given", "when", "then"].some((k) =>
        Object.keys(obj).some((key) => key.toLowerCase() === k),
      );
      const hasTextKey = TEXT_KEYS.some((k) => k in obj);
      if (hasGwt || hasTextKey) return [one];
    }
    return Object.values(input as object).map(formatOne).filter(Boolean);
  }

  if (isPrimitive(input)) return [clean(String(input))];
  return [];
}
