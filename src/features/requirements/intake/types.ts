// Types for the Stage 1 Requirement Intake feature.

export interface ExtractedData {
  system_goal?: string;
  business_context?: string;
  stakeholders?: Array<{ name: string; role: string; concerns: string[] }>;
  functional_requirements?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    acceptance_criteria?: string[];
    source: string;
    source_reference?: string;
  }>;
  non_functional_requirements?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    category?: string;
    acceptance_criteria?: string[];
    source: string;
  }>;
  constraints?: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    source: string;
  }>;
  assumptions?: Array<{
    id: string;
    title: string;
    description: string;
    risk_if_wrong?: string;
    source: string;
  }>;
  integrations?: Array<{
    id: string;
    system: string;
    description: string;
    type: string;
    protocol: string;
  }>;
  business_rules?: Array<{ id: string; title: string; description: string; source: string }>;
  actors?: Array<{ name: string; type: string; description: string }>;
  ambiguities?: Array<{
    id: string;
    description: string;
    affected_requirements?: string[];
    suggested_clarification?: string;
  }>;
  contradictions?: Array<{
    id: string;
    description: string;
    between?: string[];
    suggested_resolution?: string;
  }>;
  missing_information?: Array<{
    id: string;
    description: string;
    impact?: string;
    priority?: string;
  }>;
  duplicates?: Array<{ ids: string[]; description: string; suggested_action: string }>;
  risks?: Array<{
    id: string;
    title: string;
    description: string;
    probability: string;
    impact: string;
  }>;
  processing_summary?: {
    total_functional: number;
    total_non_functional: number;
    total_constraints: number;
    total_assumptions: number;
    total_ambiguities: number;
    total_contradictions: number;
    total_missing: number;
    confidence_score: string;
    completeness_assessment: string;
  };
  parse_error?: boolean;
  raw_output?: string;
}

export type RequirementChangeType = "preserve" | "change" | "deprecate" | "new";

export interface SavedRequirement {
  id: string;
  requirement_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  category: string | null;
  source: string | null;
  acceptance_criteria: any;
  locked_at: string | null;
  change_type: RequirementChangeType | null;
}

export type PersistableRequirementType =
  | "functional"
  | "non_functional"
  | "constraint"
  | "assumption"
  | "dependency";

export interface PersistedExtractionItem {
  id: string;
  title: string;
  description: string | null;
  type: PersistableRequirementType;
  priority: string;
  category: string | null;
  source: string | null;
  acceptance_criteria: string[] | null;
}
