// Static catalog of LLMs TimeArch can call through the Lovable AI Gateway.
// Surfaced read-only to every authenticated user (and embedded in the Admin
// Console "LLM Models" tab). This answers paper reviewer Comment 1.4 by
// making the model layer fully inspectable in-product.

export type CostTier = "low" | "medium" | "high";
export type Modality = "text" | "multimodal" | "image" | "embedding";

export interface CatalogModel {
  id: string;
  family: "gemini" | "openai" | "embedding" | "image";
  provider: "Google" | "OpenAI";
  contextWindow?: string;
  modality: Modality;
  cost: CostTier;
  /** Why TimeArch uses this model. */
  rationale: string;
  /** Which lifecycle stages / agents this model powers by default. */
  usedFor: string[];
  /** Mark the current default. */
  isDefault?: boolean;
}

export const CATALOG: CatalogModel[] = [
  // ── Google Gemini ────────────────────────────────────────────────
  {
    id: "google/gemini-2.5-flash",
    family: "gemini",
    provider: "Google",
    contextWindow: "1M tokens",
    modality: "multimodal",
    cost: "low",
    isDefault: true,
    rationale:
      "Default workhorse — fast, cheap, large context. Used for the bulk of stage runs, requirement extraction, decomposition, and challenger agents.",
    usedFor: [
      "Stages 1–13 (requirement, design, validation generation)",
      "Challenger / Refinement agents",
      "Document section refinement",
      "Verify checklist items",
    ],
  },
  {
    id: "google/gemini-2.5-pro",
    family: "gemini",
    provider: "Google",
    contextWindow: "2M tokens",
    modality: "multimodal",
    cost: "high",
    rationale:
      "Strongest reasoning + huge context. Reserved for Stage 14 (ATAM consolidation), cross-stage validation, and any run where the artifact must merge many prior stages.",
    usedFor: [
      "Stage 14 — Validation & ATAM consolidation",
      "Stage 17 — Delivery review",
      "Heavy synthesis / multi-artifact merges",
    ],
  },
  {
    id: "google/gemini-2.5-flash-lite",
    family: "gemini",
    provider: "Google",
    modality: "text",
    cost: "low",
    rationale:
      "Cheapest Gemini for high-volume classification, scoring, and summarisation — used inside the requirement critic and density-aware preview cards.",
    usedFor: ["Requirement critic scoring", "Density-aware preview generation"],
  },
  {
    id: "google/gemini-3-flash-preview",
    family: "gemini",
    provider: "Google",
    modality: "multimodal",
    cost: "low",
    rationale:
      "Next-generation Flash preview. Pipeline can switch the default to this once it stabilises; available now for opt-in experiments.",
    usedFor: ["Opt-in experiments via Playground"],
  },
  {
    id: "google/gemini-3.1-pro-preview",
    family: "gemini",
    provider: "Google",
    modality: "multimodal",
    cost: "high",
    rationale:
      "Preview of Google's next-gen reasoning model. Earmarked for upgrading Stage 14 ATAM consolidation when promoted out of preview.",
    usedFor: ["Future Stage 14 upgrade path"],
  },
  {
    id: "google/gemini-2.5-flash-image",
    family: "image",
    provider: "Google",
    modality: "image",
    cost: "medium",
    rationale:
      "Image/diagram generation for architecture sketches and visual artifacts.",
    usedFor: ["Architecture sketch generation", "Mermaid diagram renders"],
  },

  // ── OpenAI ──────────────────────────────────────────────────────
  {
    id: "openai/gpt-5",
    family: "openai",
    provider: "OpenAI",
    modality: "multimodal",
    cost: "high",
    rationale:
      "OpenAI flagship. Used as a cross-vendor verifier — Stage 14 validation can be re-run with GPT-5 to confirm Gemini's ATAM verdict.",
    usedFor: ["Cross-vendor validation", "Optional reviewer second-opinion"],
  },
  {
    id: "openai/gpt-5-mini",
    family: "openai",
    provider: "OpenAI",
    modality: "multimodal",
    cost: "medium",
    rationale: "Mid-tier OpenAI model for cost-sensitive multimodal runs.",
    usedFor: ["Opt-in via Playground"],
  },
  {
    id: "openai/gpt-5-nano",
    family: "openai",
    provider: "OpenAI",
    modality: "text",
    cost: "low",
    rationale: "Cheapest OpenAI model for bulk classification.",
    usedFor: ["High-volume classification (opt-in)"],
  },
  {
    id: "openai/gpt-5.4",
    family: "openai",
    provider: "OpenAI",
    modality: "multimodal",
    cost: "high",
    rationale:
      "Extended-reasoning model. Used for hard tradeoff / risk analysis when Gemini Pro is uncertain.",
    usedFor: ["Tradeoff / risk deep-dives"],
  },
  {
    id: "openai/gpt-5.5",
    family: "openai",
    provider: "OpenAI",
    modality: "multimodal",
    cost: "high",
    rationale: "Most capable OpenAI model. Optional escalation path.",
    usedFor: ["Optional escalation"],
  },

  // ── Embeddings ──────────────────────────────────────────────────
  {
    id: "google/gemini-embedding-001",
    family: "embedding",
    provider: "Google",
    modality: "embedding",
    cost: "low",
    isDefault: true,
    rationale:
      "Default embedding model for the RAG layer — pgvector index over the knowledge base (ISO 25010, 27001, ATAM, NFR catalogues).",
    usedFor: ["Knowledge base indexing", "RAG retrieval for every stage prompt"],
  },
  {
    id: "openai/text-embedding-3-large",
    family: "embedding",
    provider: "OpenAI",
    modality: "embedding",
    cost: "medium",
    rationale: "Higher-quality embeddings for evaluation experiments.",
    usedFor: ["Evaluation runs (opt-in)"],
  },
];

export const CATALOG_GROUPS: { key: string; label: string; description: string }[] = [
  { key: "gemini", label: "Google Gemini", description: "Lovable AI Gateway · Google" },
  { key: "openai", label: "OpenAI GPT", description: "Lovable AI Gateway · OpenAI" },
  { key: "image", label: "Image / Diagram", description: "Visual artifact generation" },
  { key: "embedding", label: "Embeddings", description: "pgvector RAG index" },
];

export const COST_LABEL: Record<CostTier, string> = {
  low: "Low cost",
  medium: "Mid cost",
  high: "Premium",
};
