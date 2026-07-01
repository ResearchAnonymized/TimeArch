import type { ExtractedData, PersistedExtractionItem } from "./types";

export function normalizeExtractedRequirements(data: ExtractedData): PersistedExtractionItem[] {
  const items: PersistedExtractionItem[] = [
    ...(data.functional_requirements || []).map((item) => ({
      id: item.id,
      title: item.title || item.id,
      description: item.description || null,
      type: "functional" as const,
      priority: item.priority || "medium",
      category: null,
      source: item.source === "inferred" ? "ai-inferred" : "ai-extracted",
      acceptance_criteria: item.acceptance_criteria || null,
    })),
    ...(data.non_functional_requirements || []).map((item) => ({
      id: item.id,
      title: item.title || item.id,
      description: item.description || null,
      type: "non_functional" as const,
      priority: item.priority || "medium",
      category: item.category || null,
      source: item.source === "inferred" ? "ai-inferred" : "ai-extracted",
      acceptance_criteria: item.acceptance_criteria || null,
    })),
    ...(data.constraints || []).map((item) => ({
      id: item.id,
      title: item.title || item.id,
      description: item.description || null,
      type: "constraint" as const,
      priority: "medium",
      category: item.type || null,
      source: item.source === "inferred" ? "ai-inferred" : "ai-extracted",
      acceptance_criteria: null,
    })),
    ...(data.assumptions || []).map((item) => ({
      id: item.id,
      title: item.title || item.id,
      description: item.description || null,
      type: "assumption" as const,
      priority: "medium",
      category: null,
      source: item.source === "inferred" ? "ai-inferred" : "ai-extracted",
      acceptance_criteria: null,
    })),
    ...(data.integrations || []).map((item) => ({
      id: item.id,
      title: item.system || item.id,
      description: item.description || null,
      type: "dependency" as const,
      priority: "medium",
      category: item.protocol || null,
      source: "ai-extracted",
      acceptance_criteria: null,
    })),
  ];

  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
