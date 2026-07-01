/** Centralized stage intro content for all 18 lifecycle stages. */
export const STAGE_INTROS: Record<
  number,
  {
    description: string;
    whatYouCanDo: string[];
    mode: "manual" | "ai" | "hybrid";
  }
> = {
  0: {
    description:
      "Brownfield-only Discovery phase. Upload artifacts from the existing system — source repository, OpenAPI specs, database schemas, ADRs, requirement documents, and diagrams — so TimeArch can reverse-engineer the as-is architecture and seed the lifecycle stages.",
    whatYouCanDo: [
      "Upload existing source code, OpenAPI specs, DB schemas, ADRs, and SRS documents",
      "Reference external repositories or documentation by URL",
      "Review the as-is snapshot summarizing what TimeArch has detected",
      "Seed Stages 1, 6, 7, 8 and 10 with reverse-engineered artifacts (Milestone 2)",
    ],
    mode: "hybrid",
  },
  1: {
    description:
      "This is where you capture all the requirements for your system — functional needs, non-functional constraints, assumptions, and dependencies. Everything defined here feeds into every downstream stage.",
    whatYouCanDo: [
      "Upload an SRS, BRD, or PRD document for automatic AI extraction",
      "Describe your system in plain language and let AI identify requirements",
      "Add requirements manually using the structured form",
      "Tag each requirement with type (functional, non-functional, constraint) and priority",
      "Lock finalized requirements to prevent accidental changes",
    ],
    mode: "hybrid",
  },
  2: {
    description:
      "The AI analyzes your collected requirements to find patterns, conflicts, gaps, and ambiguities. This ensures your requirement set is complete and consistent before architecture design begins.",
    whatYouCanDo: [
      "Run the analysis agent to cross-reference all requirements",
      "Review detected conflicts and ambiguities",
      "Accept or dismiss AI-identified gaps",
      "Ensure requirement coverage before proceeding to design",
    ],
    mode: "ai",
  },
  3: {
    description:
      "Architecture drivers are the key forces that shape every design decision — derived from your requirements. They define what matters most: scalability, security, compliance, performance, etc.",
    whatYouCanDo: [
      "Run the AI agent to automatically extract drivers from requirements",
      "Review and accept AI-suggested drivers individually or in bulk",
      "Add custom drivers manually with priority and category",
      "View quality attribute priorities that influence style selection",
    ],
    mode: "hybrid",
  },
  4: {
    description:
      "Systematically evaluates candidate architectural styles (monolithic, modular monolith, microservices, event-driven, hexagonal, layered) against your architecture drivers and constraints. The AI recommends the best-fit style using a multi-criteria suitability matrix grounded in AWS Well-Architected and ISO 25010.",
    whatYouCanDo: [
      "Run the Architectural Style Recommender agent for AI-powered evaluation",
      "Review the suitability matrix comparing styles across architecture drivers",
      "Examine the Challenger Architect's independent critical review and accept/reject/modify each concern",
      "View RAG-grounded citations from AWS Well-Architected Framework and ISO 25010",
      "Detect overengineering risk — complex styles are justified only when drivers demand them",
    ],
    mode: "ai",
  },
  5: {
    description:
      "Performs Architecture Tradeoff Analysis Method (ATAM)-inspired evaluation comparing architecture alternatives across quality attribute scenarios. Quantifies sensitivity points, tradeoff points, and architectural risks to support informed architecture decisions.",
    whatYouCanDo: [
      "Run the Architecture Tradeoff Evaluation agent to generate decision matrices",
      "Review tradeoffs across quality attributes for each architecture alternative",
      "Identify sensitivity points and tradeoff points per ATAM methodology",
      "Review the Challenger Architect's validation of tradeoff conclusions",
    ],
    mode: "ai",
  },
  6: {
    description:
      "Breaks your system into modules, services, or bounded contexts aligned with the chosen architectural style. Defines component responsibilities, boundaries, dependencies, and data ownership.",
    whatYouCanDo: [
      "Run the decomposition agent to generate system structure",
      "Explore components with their responsibilities and boundaries",
      "Review the dependency map between components",
      "Check boundary validation results (coupling, cohesion, circular deps)",
      "Analyze multiple architectural viewpoints (4+1, ISO 42010, TOGAF)",
    ],
    mode: "ai",
  },
  7: {
    description:
      "Designs the data layer — entities, attributes, relationships, aggregates, and storage strategy. Ensures data ownership aligns with component boundaries and addresses consistency, privacy, and security.",
    whatYouCanDo: [
      "Run the data architecture agent to generate the data model",
      "Explore entities with their attributes and types",
      "Review entity relationships and cardinality",
      "Check aggregate boundaries and data ownership per component",
      "Review consistency, privacy, and security considerations",
    ],
    mode: "ai",
  },
  8: {
    description:
      "Defines API contracts, communication patterns, event schemas, and integration points. Covers REST endpoints, async messaging, and external system connections.",
    whatYouCanDo: [
      "Run the API design agent to generate interface specifications",
      "Browse API endpoints with methods, paths, and schemas",
      "Review communication patterns (sync, async, event-driven)",
      "Explore event contracts with producers and consumers",
      "Check external integration points and protocols",
    ],
    mode: "ai",
  },
  9: {
    description:
      "Designs cross-cutting concerns that span all components: security architecture (ref: NIST SP 800-53, ISO 27001), observability (ref: OpenTelemetry, Google SRE), resilience patterns (ref: Release It!), and caching strategies (ref: AWS Caching Best Practices). Based on SEI ADD 3.0 methodology.",
    whatYouCanDo: [
      "Review and check off security architecture patterns (AuthN, AuthZ, encryption)",
      "Define observability strategy (logging, tracing, metrics, alerting)",
      "Plan error handling and resilience patterns (circuit breaker, retry, bulkhead)",
      "Design caching and performance optimization strategies",
      "Reference industry standards (NIST, OWASP, ISO 25010) for each concern",
    ],
    mode: "hybrid",
  },
  10: {
    description:
      "Translates the locked architecture into a runnable target operating environment — runtime topology, environments, CI/CD, scalability & resilience, and cost & ops readiness. Cloud-neutral by default; describes patterns, not vendors. Grounded in 12-Factor, DORA, Google SRE, and ISO 42010.",
    whatYouCanDo: [
      "Review the Inputs Snapshot to see which upstream decisions shape this design",
      "Inspect runtime topology with deployment, network-zone, and CI/CD diagrams",
      "Review environment tiers, IaC, secrets, DB migration & feature-flag strategy",
      "Evaluate scalability & resilience posture (autoscaling triggers, RTO/RPO, DR)",
      "Check cost band, FinOps levers, on-call model, and consolidated readiness checklist",
      "Run the Challenger Architect to surface SPOFs, cost overruns, and missing DR",
    ],
    mode: "ai",
  },
  11: {
    description:
      "Evaluates how well your architecture satisfies each quality attribute (performance, security, reliability, etc.) with measurable assessments and improvement recommendations.",
    whatYouCanDo: [
      "Run the quality attributes agent for comprehensive evaluation",
      "View radar chart visualization of attribute scores",
      "Review detailed assessments for each quality attribute",
      "Check improvement recommendations and their priority",
      "See the Challenger Architect's quality validation",
    ],
    mode: "ai",
  },
  12: {
    description:
      "Identifies architectural risks — technical, operational, and strategic — with likelihood/impact scoring and mitigation strategies. Includes a visual risk heat map.",
    whatYouCanDo: [
      "Run the risk analysis agent to identify potential risks",
      "Review risks with severity, likelihood, and impact ratings",
      "Explore the risk heat map for visual prioritization",
      "Check mitigation strategies and contingency plans",
      "View affected components for each risk",
    ],
    mode: "ai",
  },
  13: {
    description:
      "Validates the complete architecture against requirements, standards, and best practices. Runs automated checks for completeness, consistency, and compliance.",
    whatYouCanDo: [
      "Run the validation agent for comprehensive architecture review",
      "Review check results (passed, warning, failed) by category",
      "Check requirement traceability coverage",
      "View compliance status against industry standards",
      "Review recommendations for identified issues",
    ],
    mode: "ai",
  },
  14: {
    description:
      "Generates Architecture Decision Records (ADRs), executive summaries, and technical documentation. Each ADR captures the context, decision, alternatives considered, and consequences.",
    whatYouCanDo: [
      "Run the documentation agent to generate ADRs",
      "Review individual ADRs with full decision context",
      "Check the executive summary for stakeholder communication",
      "View cross-cutting concerns documentation",
      "See the Challenger Architect's documentation completeness review",
    ],
    mode: "ai",
  },
  15: {
    description:
      "Review architecture completeness and obtain stakeholder sign-off. All prior stages should be locked before formal approval. This is a governance checkpoint, not an AI-generated stage.",
    whatYouCanDo: [
      "Review total artifact count and lock status across all stages",
      "Check which stages are still pending review",
      "Record formal approval or request revisions",
      "View the complete approval history and audit trail",
    ],
    mode: "manual",
  },
  16: {
    description:
      "Generates implementation scaffolding, code templates, and project structure based on the approved architecture. The output reflects all decisions made in prior stages.",
    whatYouCanDo: [
      "Run the code generation agent to produce implementation artifacts",
      "Review generated project structure and boilerplate code",
      "Check that code aligns with architecture decisions and ADRs",
      "Export or download generated code templates",
    ],
    mode: "ai",
  },
  17: {
    description:
      "Reviews the generated implementation against the architecture specification. Checks for alignment between code output and the approved design, flagging any deviations.",
    whatYouCanDo: [
      "Run the implementation review agent",
      "Check alignment between code and architecture artifacts",
      "Review flagged deviations and their severity",
      "Verify that all architectural constraints are respected",
    ],
    mode: "ai",
  },
  18: {
    description:
      "Tracks how the architecture evolves over time — documenting technical debt, planned improvements, and version history. Use this stage for ongoing architecture governance.",
    whatYouCanDo: [
      "Document known technical debt items",
      "Plan incremental architecture improvements",
      "Track architecture version changes over time",
      "Monitor for architecture drift and erosion",
    ],
    mode: "hybrid",
  },
};
