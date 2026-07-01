/**
 * Stage-specific validation checklists.
 * Every stage must have all items checked before locking.
 */
export const STAGE_CHECKLISTS: Record<number, { id: string; label: string }[]> = {
  1: [
    { id: "sources_complete", label: "All requirement sources have been captured" },
    { id: "stakeholders_identified", label: "Key stakeholders and their concerns are identified" },
    { id: "scope_defined", label: "System scope and boundaries are clearly defined" },
  ],
  2: [
    { id: "reqs_categorized", label: "Requirements are properly categorized" },
    {
      id: "conflicts_resolved",
      label: "Conflicting requirements have been identified and resolved",
    },
    { id: "priorities_set", label: "Priority levels are assigned and justified" },
    {
      id: "acceptance_criteria",
      label: "Acceptance criteria are defined for critical requirements",
    },
  ],
  3: [
    { id: "drivers_traced", label: "Architecture drivers are traceable to source requirements" },
    { id: "quality_attrs", label: "Quality attribute scenarios are well-defined" },
    { id: "constraints_valid", label: "Technical constraints are validated and realistic" },
  ],
  4: [
    { id: "style_justified", label: "Selected architectural style is justified against drivers" },
    { id: "alternatives_evaluated", label: "Alternative styles were evaluated with rationale" },
    {
      id: "suitability_reviewed",
      label: "Suitability matrix scores are reasonable and defensible",
    },
  ],
  5: [
    { id: "tradeoffs_documented", label: "Key tradeoffs are documented with impact analysis" },
    { id: "sensitivity_points", label: "Sensitivity points and tradeoff points are identified" },
    { id: "risks_acknowledged", label: "Risks from tradeoff decisions are acknowledged" },
  ],
  6: [
    {
      id: "units_cohesive",
      label: "Decomposed units have clear responsibilities and high cohesion",
    },
    { id: "coupling_minimal", label: "Inter-unit coupling is minimized and justified" },
    { id: "no_circular_deps", label: "No circular dependencies exist between components" },
    { id: "views_consistent", label: "Component, connector, and module views are consistent" },
  ],
  7: [
    {
      id: "data_model_complete",
      label: "Data model covers all identified entities and relationships",
    },
    { id: "integrity_rules", label: "Data integrity rules and constraints are defined" },
    { id: "persistence_strategy", label: "Persistence strategy aligns with quality attributes" },
  ],
  8: [
    { id: "api_contracts", label: "API contracts are complete with request/response schemas" },
    { id: "integration_patterns", label: "Integration patterns are appropriate for the style" },
    { id: "error_handling", label: "Error handling and versioning strategies are defined" },
  ],
  9: [
    {
      id: "security_addressed",
      label: "Security concerns are addressed (authn, authz, encryption)",
    },
    { id: "observability_planned", label: "Observability covers logging, monitoring, and tracing" },
    { id: "resilience_patterns", label: "Resilience patterns are specified" },
  ],
  10: [
    { id: "infra_feasible", label: "Infrastructure topology is feasible and cost-effective" },
    { id: "cicd_defined", label: "CI/CD pipeline stages and quality gates are defined" },
    { id: "env_parity", label: "Environment parity strategy is documented" },
  ],
  11: [
    { id: "qa_scenarios", label: "Quality attribute scenarios have measurable targets" },
    { id: "qa_coverage", label: "All critical quality attributes are evaluated" },
    { id: "qa_achievable", label: "Quality targets are achievable with the chosen architecture" },
  ],
  12: [
    { id: "risks_identified", label: "Major architectural risks are identified and categorized" },
    {
      id: "mitigations_planned",
      label: "Mitigation strategies are defined for high-severity risks",
    },
    { id: "risk_owners", label: "Risk owners and review timelines are assigned" },
  ],
  13: [
    { id: "validation_complete", label: "Architecture has been validated against all drivers" },
    { id: "issues_resolved", label: "Identified issues have been resolved or accepted" },
    { id: "peer_review", label: "AI evaluator feedback has been reviewed and addressed" },
  ],
  14: [
    { id: "adrs_complete", label: "Architecture Decision Records are complete and justified" },
    { id: "diagrams_accurate", label: "All diagrams accurately reflect the current architecture" },
    { id: "docs_consistent", label: "Documentation is internally consistent across stages" },
  ],
  15: [
    { id: "all_stages_reviewed", label: "All prior stages have been reviewed and approved" },
    { id: "stakeholder_sign_off", label: "Stakeholder concerns have been addressed" },
  ],
  16: [
    { id: "code_matches_arch", label: "Generated code aligns with the approved architecture" },
    { id: "structure_valid", label: "Project structure follows decomposition design" },
  ],
  17: [
    { id: "impl_reviewed", label: "Implementation has been reviewed against architecture" },
    { id: "gaps_documented", label: "Any gaps between design and implementation are documented" },
  ],
  18: [
    { id: "evolution_plan", label: "Architecture evolution roadmap is documented" },
    { id: "tech_debt_tracked", label: "Technical debt items are identified and prioritized" },
  ],
};

export const FALLBACK_CHECKLIST = [
  { id: "output_reviewed", label: "Stage output has been reviewed for completeness" },
  { id: "quality_acceptable", label: "Output quality meets project standards" },
];

export function getStageChecklist(stage: number) {
  return STAGE_CHECKLISTS[stage] || FALLBACK_CHECKLIST;
}
