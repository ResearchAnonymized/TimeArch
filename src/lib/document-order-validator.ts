// Validates that a generated Stage 14 document follows the required
// discovery-wizard artifact order and flags missing sections.
import type { DocumentDraft, DocumentSection } from "./document-editor-types";

export interface RequiredArtifact {
  key: string;
  title: string;
  /** Substrings (lowercase) that identify this section in a heading */
  matchers: string[];
}

/** The mandated order that generate-document enforces server-side. */
export const REQUIRED_WIZARD_ORDER: RequiredArtifact[] = [
  { key: "impact",        title: "Change Impact Scorecard",       matchers: ["change impact", "impact scorecard"] },
  { key: "mapping",       title: "Feature → Component Mapping",   matchers: ["component mapping", "feature mapping", "feature → component", "feature to component"] },
  { key: "ripple",        title: "Ripple / Blast-Radius Analysis", matchers: ["ripple", "blast radius", "blast-radius"] },
  { key: "quality",       title: "Quality Attribute Impact",      matchers: ["quality attribute impact", "quality impact"] },
  { key: "alternatives",  title: "Alternatives Considered",       matchers: ["alternatives considered", "alternative options"] },
  { key: "plan",          title: "Implementation Plan",           matchers: ["implementation plan", "delivery plan", "phased plan"] },
  { key: "adr",           title: "ADR — Change Decision",         matchers: ["adr —", "adr -", "adr:", "change decision", "decision record"] },
  { key: "lineage",       title: "Traceability & Lineage",        matchers: ["traceability", "lineage"] },
];

export interface SectionMatch {
  key: string;
  title: string;
  found: boolean;
  matchedHeading?: string;
  index?: number; // position in the flat section list
}

export interface DocumentOrderValidation {
  ok: boolean;
  matches: SectionMatch[];
  missing: SectionMatch[];
  outOfOrder: SectionMatch[];
  summary: string;
}

function flattenSections(sections: DocumentSection[]): DocumentSection[] {
  const out: DocumentSection[] = [];
  const walk = (list: DocumentSection[]) => {
    for (const s of list) {
      out.push(s);
      if (s.subsections?.length) walk(s.subsections);
    }
  };
  walk(sections || []);
  return out;
}

function findFirstMatch(
  flat: DocumentSection[],
  matchers: string[],
): { index: number; heading: string } | null {
  for (let i = 0; i < flat.length; i++) {
    const t = String(flat[i].title || "").toLowerCase();
    if (matchers.some((m) => t.includes(m))) {
      return { index: i, heading: flat[i].title };
    }
  }
  return null;
}

export function validateDocumentOrder(draft: DocumentDraft): DocumentOrderValidation {
  const flat = flattenSections(draft.sections || []);

  const matches: SectionMatch[] = REQUIRED_WIZARD_ORDER.map((req) => {
    const hit = findFirstMatch(flat, req.matchers);
    return hit
      ? { key: req.key, title: req.title, found: true, matchedHeading: hit.heading, index: hit.index }
      : { key: req.key, title: req.title, found: false };
  });

  const missing = matches.filter((m) => !m.found);

  // Out of order: among the found sections, their indices should be strictly increasing
  const found = matches.filter((m) => m.found);
  const outOfOrder: SectionMatch[] = [];
  let prev = -1;
  for (const m of found) {
    if ((m.index ?? -1) <= prev) outOfOrder.push(m);
    else prev = m.index ?? prev;
  }

  const ok = missing.length === 0 && outOfOrder.length === 0;
  const summary = ok
    ? `All ${REQUIRED_WIZARD_ORDER.length} required wizard sections present and in order.`
    : [
        missing.length > 0 ? `${missing.length} missing` : "",
        outOfOrder.length > 0 ? `${outOfOrder.length} out of order` : "",
      ].filter(Boolean).join(" · ");

  return { ok, matches, missing, outOfOrder, summary };
}
