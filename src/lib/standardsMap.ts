/**
 * Maps 18-stage lifecycle stages → applicable industry standards.
 * Used to render standards-traceability chips on brownfield artifacts
 * so reviewers can see which normative reference an artifact aligns with.
 */
export interface StandardRef {
  id: string;
  short: string;
  full: string;
}

export const STANDARDS: Record<string, StandardRef> = {
  "29148": { id: "29148", short: "ISO/IEC/IEEE 29148", full: "Requirements engineering (29148:2018)" },
  "42010": { id: "42010", short: "ISO/IEC/IEEE 42010", full: "Architecture description (42010:2022)" },
  "25010": { id: "25010", short: "ISO/IEC 25010", full: "Product quality model (25010:2023)" },
  "14764": { id: "14764", short: "ISO/IEC 14764", full: "Software maintenance categories (14764:2022)" },
  "ATAM": { id: "ATAM", short: "SEI ATAM", full: "Architecture Tradeoff Analysis Method" },
  "INCOSE": { id: "INCOSE", short: "INCOSE Guide", full: "INCOSE Guide for Writing Requirements" },
  "MADR": { id: "MADR", short: "MADR 3.0", full: "Markdown Architectural Decision Records" },
  "TOGAF": { id: "TOGAF", short: "TOGAF 10", full: "TOGAF Architecture Development Method" },
  "C4": { id: "C4", short: "C4 Model", full: "Software architecture visualisation model" },
};

/** Which standards apply to each stage number. */
export const STAGE_STANDARDS: Record<number, string[]> = {
  1: ["42010", "TOGAF"],
  2: ["29148", "INCOSE"],
  3: ["29148", "INCOSE"],
  4: ["ATAM", "25010"],
  5: ["42010", "MADR"],
  6: ["42010", "C4"],
  7: ["42010", "C4"],
  8: ["42010", "C4"],
  9: ["42010"],
  10: ["42010", "TOGAF"],
  11: ["ATAM", "25010"],
  12: ["ATAM", "25010"],
  13: ["42010", "MADR"],
  14: ["14764", "42010"],
  16: ["14764", "TOGAF"],
  17: ["14764"],
  18: ["14764", "25010"],
};

export function standardsForStage(stage: number): StandardRef[] {
  return (STAGE_STANDARDS[stage] ?? []).map((k) => STANDARDS[k]).filter(Boolean);
}
