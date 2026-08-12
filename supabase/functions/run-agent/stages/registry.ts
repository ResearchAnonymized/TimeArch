/**
 * run-agent stage registry (Strategy pattern).
 *
 * Each stage's tool schema, system prompt, agent name, artifact type and
 * (optional) deterministic check live behind `getStageDefinition(stage)`.
 * The orchestrator (`index.ts`) is stage-agnostic — it just resolves the
 * definition and runs the standard pipeline.
 *
 * The challenger schemas and prompts live here too because they are
 * stage-aware reference material (and CHALLENGER_STAGES gates the inline
 * challenger run).
 */

export const KEY_FINDINGS_SCHEMA = {
  type: "array",
  description: "3-5 most important findings, decisions, or recommendations — the critical takeaways a senior architect would highlight in a review meeting. Each finding should be a concise, self-contained statement.",
  items: { type: "string" },
};

export { DENSITY_OUTPUT_INSTRUCTION, SYSTEM_PROMPTS } from "../../_shared/prompt-defaults/stage-prompts.ts";
export {
  SCIENTIFIC_CHALLENGER_SYSTEM_PROMPT,
  DECOMPOSITION_CHALLENGER_SYSTEM_PROMPT,
  API_CHALLENGER_SYSTEM_PROMPT,
  CHALLENGER_SYSTEM_PROMPT,
} from "../../_shared/prompt-defaults/challenger-prompts.ts";
import { SYSTEM_PROMPTS } from "../../_shared/prompt-defaults/stage-prompts.ts";


// ─── Tool Definitions (structured output schemas per stage) ─────────────────
export const TOOL_SCHEMAS: Record<number, { name: string; description: string; parameters: any }> = {
  2: {
    name: "analyze_requirements",
    description: "Produce a structured requirement analysis report with gaps, risks, and recommendations.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        system_goals: { type: "array", items: { type: "string" } },
        business_context: { type: "string" },
        stakeholders: { type: "array", items: { type: "string" } },
        functional_requirements_summary: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, analysis: { type: "string" } }, required: ["id", "title", "analysis"] } },
        non_functional_requirements_summary: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, analysis: { type: "string" } }, required: ["id", "title", "analysis"] } },
        assumptions: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        dependencies: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        ambiguities: { type: "array", items: { type: "string" } },
        missing_information: { type: "array", items: { type: "string" } },
        contradictions: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
      required: ["title", "summary", "key_findings", "system_goals", "functional_requirements_summary", "non_functional_requirements_summary", "risks", "recommendations"],
    },
  },
  3: {
    name: "extract_drivers",
    description: "Extract architecture drivers from requirements with traceability.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        system_profile: { type: "object", properties: { size: { type: "string" }, complexity: { type: "string" }, criticality: { type: "string" }, user_scale: { type: "string" }, data_sensitivity: { type: "string" }, deployment_model: { type: "string" } }, required: ["size", "complexity", "criticality"] },
        drivers: { type: "array", items: { type: "object", properties: { label: { type: "string" }, category: { type: "string" }, priority: { type: "string" }, description: { type: "string" }, source_requirements: { type: "array", items: { type: "string" } }, impact: { type: "string" }, quality_attributes_affected: { type: "array", items: { type: "string" } } }, required: ["label", "category", "priority", "description", "source_requirements"] } },
        constraints: { type: "array", items: { type: "object", properties: { label: { type: "string" }, description: { type: "string" }, type: { type: "string" }, source_requirements: { type: "array", items: { type: "string" } } }, required: ["label", "description"] } },
        quality_attribute_priorities: { type: "array", items: { type: "object", properties: { attribute: { type: "string" }, priority: { type: "string" }, rationale: { type: "string" } }, required: ["attribute", "priority", "rationale"] } },
        missing_drivers: { type: "array", items: { type: "object", properties: { expected_driver: { type: "string" }, reason: { type: "string" }, recommendation: { type: "string" } }, required: ["expected_driver", "reason"] } },
        driver_conflicts: { type: "array", items: { type: "object", properties: { drivers: { type: "array", items: { type: "string" } }, conflict: { type: "string" }, resolution_suggestion: { type: "string" } }, required: ["drivers", "conflict"] } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "system_profile", "drivers", "quality_attribute_priorities"],
    },
  },
  4: {
    name: "recommend_architecture_style",
    description: "Recommend an architecture style with comparison matrix and evidence.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        system_context: { type: "string" },
        recommended_style: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, rationale: { type: "string" }, confidence: { type: "string" }, when_to_evolve: { type: "string" } }, required: ["name", "description", "rationale", "confidence"] },
        alternatives_considered: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, suitability_score: { type: "number" }, strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, why_not_chosen: { type: "string" }, when_appropriate: { type: "string" } }, required: ["name", "suitability_score", "strengths", "weaknesses", "why_not_chosen"] } },
        style_comparison_matrix: { type: "array", items: { type: "object", properties: { style: { type: "string" }, scalability: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, maintainability: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, complexity: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, team_fit: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, cost: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, time_to_market: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] }, testability: { type: "string", enum: ["strong", "good", "adequate", "limited", "weak"] } }, required: ["style"] } },
        anti_patterns_avoided: { type: "array", items: { type: "string" } },
        key_considerations: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        requirement_alignment: { type: "array", items: { type: "object", properties: { requirement_id: { type: "string" }, how_addressed: { type: "string" } }, required: ["requirement_id", "how_addressed"] } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "recommended_style", "alternatives_considered", "style_comparison_matrix"],
    },
  },
  5: {
    name: "evaluate_tradeoffs",
    description: "Critically evaluate architecture with tradeoff analysis and ADR.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        evaluation_summary: { type: "string" },
        architect_verdict: { type: "string", enum: ["approved", "approved_with_reservations", "rejected", "needs_revision"] },
        chosen_architecture: { type: "object", properties: { style: { type: "string" }, rationale: { type: "string" }, confidence_level: { type: "string" }, suitability_assessment: { type: "string" }, evolution_path: { type: "string" } }, required: ["style", "rationale", "confidence_level"] },
        tradeoff_analysis: { type: "object" },
        risks: { type: "array", items: { type: "object", properties: { risk: { type: "string" }, severity: { type: "string" }, mitigation: { type: "string" }, affected_requirements: { type: "array", items: { type: "string" } } }, required: ["risk", "severity", "mitigation"] } },
        strengths: { type: "array", items: { type: "string" } },
        weaknesses: { type: "array", items: { type: "string" } },
        overengineering_check: { type: "object", properties: { detected: { type: "boolean" }, details: { type: "string" }, simplification_opportunities: { type: "array", items: { type: "string" } } }, required: ["detected", "details"] },
        underengineering_check: { type: "object", properties: { detected: { type: "boolean" }, details: { type: "string" } }, required: ["detected", "details"] },
        decision_rationale: { type: "string" },
        dissenting_considerations: { type: "array", items: { type: "string" } },
        adr: { type: "object" },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "evaluation_summary", "architect_verdict", "chosen_architecture", "tradeoff_analysis", "risks", "strengths", "weaknesses"],
    },
  },
  // Stage 6: SIMPLIFIED — decomposition + viewpoints separated to avoid timeout
  6: {
    name: "decompose_system",
    description: "Decompose the system into a compact, implementation-ready component model with dependencies, communication flows, and validation findings.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        decomposition_approach: { type: "string" },
        architecture_style_alignment: { type: "string" },
        components: {
          type: "array",
          description: "Keep this compact: 4-8 components maximum unless the architecture truly requires more.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              responsibility: { type: "string" },
              boundaries: { type: "string" },
              does_not_own: { type: "string" },
              dependencies: { type: "array", items: { type: "string" } },
              interfaces_provided: { type: "array", items: { type: "string" } },
              interfaces_consumed: { type: "array", items: { type: "string" } },
              data_owned: { type: "array", items: { type: "string" } },
              related_requirements: { type: "array", items: { type: "string" } },
            },
            required: ["name", "type", "responsibility", "dependencies", "related_requirements"],
          },
        },
        dependency_graph: {
          type: "array",
          description: "Keep this compact: 6-12 critical dependencies maximum.",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              type: { type: "string" },
              description: { type: "string" },
              risk_level: { type: "string" },
            },
            required: ["from", "to", "type"],
          },
        },
        communication_patterns: {
          type: "array",
          description: "Only the most important runtime interactions.",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              pattern: { type: "string" },
              protocol: { type: "string" },
              description: { type: "string" },
            },
            required: ["from", "to", "pattern"],
          },
        },
        circular_dependency_check: { type: "object", properties: { passed: { type: "boolean" }, issues: { type: "array", items: { type: "string" } } }, required: ["passed"] },
        cohesion_assessment: { type: "string" },
        coupling_assessment: { type: "string" },
        coupling_issues: { type: "array", items: { type: "object" } },
        overlap_issues: { type: "array", items: { type: "object" } },
        missing_components: { type: "array", items: { type: "object" } },
        architectural_viewpoints: {
          type: "object",
          properties: {
            four_plus_one: {
              type: "object",
              properties: {
                logical_view: { type: "object", properties: { description: { type: "string" }, mermaid_diagram: { type: "string" } } },
                process_view: { type: "object", properties: { description: { type: "string" }, mermaid_diagram: { type: "string" } } },
                development_view: { type: "object", properties: { description: { type: "string" }, mermaid_diagram: { type: "string" } } },
                physical_view: { type: "object", properties: { description: { type: "string" }, mermaid_diagram: { type: "string" } } },
                scenarios: { type: "object", properties: { description: { type: "string" }, mermaid_diagram: { type: "string" } } },
              },
            },
          },
        },
        synthetic_architect_review: { type: "object", properties: { verdict: { type: "string" }, confidence: { type: "string" }, summary: { type: "string" } }, required: ["verdict", "confidence", "summary"] },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "decomposition_approach", "components", "dependency_graph", "circular_dependency_check", "synthetic_architect_review"],
    },
  },
  7: {
    name: "design_data_architecture",
    description: "Design data architecture with entities, relationships, aggregates, and an ER diagram.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        entities: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, attributes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, nullable: { type: "boolean" }, description: { type: "string" } }, required: ["name", "type"] } }, owner_component: { type: "string" }, aggregate_root: { type: "boolean" } }, required: ["name", "description", "attributes", "owner_component"] } },
        relationships: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, type: { type: "string" }, description: { type: "string" }, cardinality: { type: "string" } }, required: ["from", "to", "type"] } },
        aggregates: { type: "array", items: { type: "object", properties: { name: { type: "string", description: "Aggregate name (e.g. 'Order Aggregate')" }, root: { type: "string", description: "Name of the aggregate root entity" }, members: { type: "array", items: { type: "string" }, description: "Entity names that belong to this aggregate" }, description: { type: "string" } }, required: ["name", "root", "members"] } },
        data_ownership: { type: "array", items: { type: "object" } },
        consistency_requirements: { type: "array", items: { type: "object" } },
        privacy_considerations: { type: "array", items: { type: "string" } },
        security_considerations: { type: "array", items: { type: "string" } },
        shared_data_risks: { type: "array", items: { type: "string" } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "entities", "relationships", "mermaid_diagrams"],
    },
  },
  8: {
    name: "design_apis",
    description: "Design API contracts with endpoints, event contracts, and integration points.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        apis: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, owner_component: { type: "string" }, style: { type: "string" }, base_path: { type: "string" }, endpoints: { type: "array", items: { type: "object", properties: { method: { type: "string" }, path: { type: "string" }, description: { type: "string" }, request_schema: { type: "object" }, response_schema: { type: "object" }, auth_required: { type: "boolean" }, rate_limit: { type: "string" }, error_codes: { type: "array", items: { type: "string" } } }, required: ["method", "path", "description"] } } }, required: ["name", "description", "endpoints"] } },
        communication_patterns: {
          type: "array",
          description: "Synchronous and asynchronous interaction patterns between components. Each entry MUST identify the source (from) and target (to) components and the interaction style.",
          items: {
            type: "object",
            properties: {
              from: { type: "string", description: "Source component or service name (must match a component from Stage 6 decomposition when applicable)." },
              to: { type: "string", description: "Target component or service name." },
              pattern: { type: "string", description: "Interaction pattern, e.g. request_response, publish_subscribe, fire_and_forget, request_reply_async, streaming, saga, choreography, orchestration." },
              protocol: { type: "string", description: "Wire protocol, e.g. HTTPS/REST, gRPC, GraphQL, WebSocket, AMQP, Kafka, SQS, EventBridge, NATS." },
              description: { type: "string", description: "1-2 sentence rationale describing what this interaction is for." },
              sync: { type: "boolean", description: "True if synchronous, false if asynchronous." },
            },
            required: ["from", "to", "pattern", "protocol"],
          },
        },
        event_contracts: {
          type: "array",
          description: "Domain/integration events flowing through the system. Each event MUST have a name, producing component, consumer list, and a payload schema.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Event name in PascalCase past tense, e.g. PaymentInitiated, AccountOpened." },
              description: { type: "string", description: "What business fact this event represents." },
              producer: { type: "string", description: "Component or service that publishes the event." },
              consumers: { type: "array", items: { type: "string" }, description: "Components or services that subscribe to this event." },
              channel: { type: "string", description: "Topic / queue / stream name on the broker." },
              schema_version: { type: "string", description: "Semantic version of the payload contract, e.g. 1.0.0." },
              schema: { type: "object", description: "JSON-schema-like description of the event payload (field names with types)." },
            },
            required: ["name", "producer", "consumers", "schema"],
          },
        },
        integration_points: {
          type: "array",
          description: "External systems or third-party services this architecture integrates with (payment networks, KYC providers, identity providers, partner APIs, legacy systems, etc.). Return at minimum any external dependency implied by the requirements.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Integration name, e.g. SEPA Network, Stripe, Twilio, Plaid, Internal Mainframe." },
              type: { type: "string", description: "external | internal | legacy | partner.", enum: ["external", "internal", "legacy", "partner"] },
              protocol: { type: "string", description: "Protocol used, e.g. REST, SOAP, SFTP, ISO20022, Webhook, gRPC." },
              direction: { type: "string", description: "inbound | outbound | bidirectional.", enum: ["inbound", "outbound", "bidirectional"] },
              owner_component: { type: "string", description: "Internal component that owns this integration." },
              description: { type: "string", description: "Purpose of the integration and which requirement(s) it satisfies." },
              auth: { type: "string", description: "Auth mechanism, e.g. mTLS, OAuth2 client credentials, API key, signed webhook." },
              sla: { type: "string", description: "Expected SLA / criticality if known." },
            },
            required: ["name", "type", "protocol", "description"],
          },
        },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "apis", "communication_patterns", "event_contracts", "integration_points"],
    },
  },
  9: {
    name: "design_cross_cutting_concerns",
    description: "Design cross-cutting architectural concerns: security, observability, resilience, and caching strategies with industry standard references.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        security_architecture: {
          type: "object",
          properties: {
            authentication_strategy: { type: "object", properties: { method: { type: "string" }, protocol: { type: "string" }, mfa_policy: { type: "string" }, rationale: { type: "string" }, standards_ref: { type: "array", items: { type: "string" } } }, required: ["method", "protocol", "rationale"] },
            authorization_model: { type: "object", properties: { model: { type: "string" }, description: { type: "string" }, policy_engine: { type: "string" }, standards_ref: { type: "array", items: { type: "string" } } }, required: ["model", "description"] },
            encryption: { type: "object", properties: { at_rest: { type: "string" }, in_transit: { type: "string" }, key_management: { type: "string" } }, required: ["at_rest", "in_transit"] },
            input_validation: { type: "object", properties: { strategy: { type: "string" }, owasp_mitigations: { type: "array", items: { type: "string" } } }, required: ["strategy"] },
            secret_management: { type: "object", properties: { tool: { type: "string" }, rotation_policy: { type: "string" } }, required: ["tool"] },
            audit_logging: { type: "object", properties: { strategy: { type: "string" }, retention_policy: { type: "string" } }, required: ["strategy"] },
          },
          required: ["authentication_strategy", "authorization_model", "encryption"],
        },
        observability_strategy: {
          type: "object",
          properties: {
            logging: { type: "object", properties: { format: { type: "string" }, correlation_ids: { type: "boolean" }, retention: { type: "string" } }, required: ["format"] },
            tracing: { type: "object", properties: { framework: { type: "string" }, propagation: { type: "string" }, sampling_rate: { type: "string" } }, required: ["framework"] },
            metrics: { type: "object", properties: { methodology: { type: "string" }, slis: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, target: { type: "string" } }, required: ["name", "type"] } } }, required: ["methodology"] },
            alerting: { type: "object", properties: { strategy: { type: "string" }, escalation: { type: "string" } }, required: ["strategy"] },
            health_checks: { type: "array", items: { type: "object", properties: { component: { type: "string" }, liveness: { type: "string" }, readiness: { type: "string" } }, required: ["component"] } },
          },
          required: ["logging", "tracing", "metrics", "alerting"],
        },
        resilience_patterns: {
          type: "object",
          properties: {
            circuit_breaker: { type: "object", properties: { implementation: { type: "string" }, thresholds: { type: "string" }, fallback: { type: "string" } }, required: ["implementation"] },
            retry_strategy: { type: "object", properties: { algorithm: { type: "string" }, max_retries: { type: "number" }, idempotency: { type: "string" } }, required: ["algorithm"] },
            bulkhead: { type: "object", properties: { isolation_method: { type: "string" }, resource_limits: { type: "string" } }, required: ["isolation_method"] },
            timeout_config: { type: "array", items: { type: "object", properties: { dependency: { type: "string" }, connect_ms: { type: "number" }, read_ms: { type: "number" } }, required: ["dependency"] } },
            fallback_strategies: { type: "array", items: { type: "object", properties: { scenario: { type: "string" }, fallback: { type: "string" } }, required: ["scenario", "fallback"] } },
            data_consistency: { type: "object", properties: { pattern: { type: "string" }, description: { type: "string" } }, required: ["pattern"] },
          },
          required: ["circuit_breaker", "retry_strategy", "bulkhead", "data_consistency"],
        },
        caching_strategy: {
          type: "object",
          properties: {
            invalidation: { type: "object", properties: { strategy: { type: "string" }, ttl_defaults: { type: "string" } }, required: ["strategy"] },
            cdn_edge: { type: "object", properties: { provider: { type: "string" }, cached_content: { type: "array", items: { type: "string" } } } },
            performance_budget: { type: "object", properties: { p50_target_ms: { type: "number" }, p95_target_ms: { type: "number" }, p99_target_ms: { type: "number" } } },
          },
          required: ["invalidation"],
        },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
        concern_diagrams: {
          type: "object",
          description: "REQUIRED. Multiple industry-standard Mermaid diagrams per concern, each using the prescribed notation. Keys MUST be exactly: security, observability, resilience, caching.",
          properties: {
            security: {
              type: "array",
              description: "Provide at minimum THREE diagrams using these notations: (1) notation='dfd_trust_boundaries' — flowchart TD with subgraphs as trust zones (Public/DMZ/Internal/Data) showing data flows crossing boundaries; (2) notation='auth_sequence' — sequenceDiagram of OAuth2/OIDC login flow (User → Client → IdP → Resource); (3) notation='zero_trust_topology' — flowchart LR showing identity-aware proxy, mTLS service-to-service, policy decision point.",
              items: {
                type: "object",
                properties: {
                  notation: { type: "string", enum: ["dfd_trust_boundaries", "auth_sequence", "zero_trust_topology", "threat_model_stride", "encryption_zones"] },
                  title: { type: "string" },
                  description: { type: "string", description: "1-sentence plain-language explanation of what this diagram shows." },
                  type: { type: "string", description: "Mermaid diagram type, e.g. flowchart, sequenceDiagram, stateDiagram-v2." },
                  code: { type: "string" },
                },
                required: ["notation", "title", "description", "code"],
              },
            },
            observability: {
              type: "array",
              description: "Provide at minimum THREE diagrams: (1) notation='otel_pipeline' — flowchart LR of OpenTelemetry pipeline (Service SDK → Collector → Backends for logs/metrics/traces); (2) notation='three_pillars' — flowchart TD showing how logs, metrics, traces are collected from each system component; (3) notation='alert_runbook_sequence' — sequenceDiagram from SLI breach → alert → on-call → runbook → resolution.",
              items: {
                type: "object",
                properties: {
                  notation: { type: "string", enum: ["otel_pipeline", "three_pillars", "alert_runbook_sequence", "trace_propagation", "slo_error_budget"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  code: { type: "string" },
                },
                required: ["notation", "title", "description", "code"],
              },
            },
            resilience: {
              type: "array",
              description: "Provide at minimum THREE diagrams: (1) notation='circuit_breaker_state' — stateDiagram-v2 showing Closed/Open/HalfOpen transitions with thresholds; (2) notation='retry_bulkhead_flow' — flowchart TD of a request hitting timeout → retry-with-backoff → bulkhead isolation → fallback; (3) notation='saga_sequence' — sequenceDiagram of a saga or compensating-transaction flow across the riskiest services.",
              items: {
                type: "object",
                properties: {
                  notation: { type: "string", enum: ["circuit_breaker_state", "retry_bulkhead_flow", "saga_sequence", "failure_mode_tree", "graceful_degradation"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  code: { type: "string" },
                },
                required: ["notation", "title", "description", "code"],
              },
            },
            caching: {
              type: "array",
              description: "Provide at minimum THREE diagrams: (1) notation='tiered_topology' — flowchart LR of cache layers (Client → CDN → Edge → App Cache (Redis) → DB) with TTLs; (2) notation='cache_aside_sequence' — sequenceDiagram showing read hit/miss + write-back; (3) notation='invalidation_flow' — flowchart TD of event-driven invalidation (Write → Event Bus → Cache Invalidator → Affected Tiers).",
              items: {
                type: "object",
                properties: {
                  notation: { type: "string", enum: ["tiered_topology", "cache_aside_sequence", "invalidation_flow", "write_through", "write_behind"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string" },
                  code: { type: "string" },
                },
                required: ["notation", "title", "description", "code"],
              },
            },
          },
          required: ["security", "observability", "resilience", "caching"],
        },
      },
      required: ["title", "summary", "key_findings", "security_architecture", "observability_strategy", "resilience_patterns", "caching_strategy", "mermaid_diagrams", "concern_diagrams"],
    },
  },
  10: {
    name: "design_infrastructure",
    description: "Design cloud-neutral infrastructure & deployment architecture: runtime topology, environment strategy, CI/CD, scalability & resilience, and cost & operational readiness.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        inputs_snapshot: {
          type: "object",
          description: "Traceability — which upstream inputs shaped this design.",
          properties: {
            architecture_style: { type: "string" },
            data_classification: { type: "string" },
            critical_nfrs: { type: "array", items: { type: "string" } },
            cross_cutting_decisions: { type: "array", items: { type: "string" } },
          },
        },
        deployment_topology: {
          type: "object",
          description: "Target runtime topology described in cloud-neutral patterns (compute / network / storage / identity).",
          properties: {
            compute_model: { type: "object", properties: { pattern: { type: "string", description: "e.g., container orchestration, managed serverless, VM-based, hybrid" }, rationale: { type: "string" } }, required: ["pattern", "rationale"] },
            region_strategy: { type: "object", properties: { topology: { type: "string", description: "single-region multi-AZ / multi-region active-active / multi-region active-passive / edge" }, availability_zones: { type: "number" }, multi_region: { type: "boolean" }, rationale: { type: "string" } }, required: ["topology", "availability_zones"] },
            network_zones: { type: "object", properties: { public: { type: "string" }, private: { type: "string" }, data: { type: "string" }, ingress_controls: { type: "string" }, egress_controls: { type: "string" } } },
            service_communication: { type: "object", properties: { mesh_needed: { type: "boolean" }, pattern: { type: "string" }, rationale: { type: "string" } }, required: ["mesh_needed"] },
            load_balancing: { type: "object", properties: { layer: { type: "string", description: "L4 / L7 / global" }, strategy: { type: "string" } }, required: ["layer"] },
            identity_and_secrets: { type: "object", properties: { workload_identity: { type: "string" }, secrets_management: { type: "string" } } },
          },
          required: ["compute_model", "region_strategy", "load_balancing"],
        },
        environment_strategy: {
          type: "object",
          properties: {
            tiers: { type: "array", items: { type: "object", properties: { name: { type: "string" }, purpose: { type: "string" }, data_source: { type: "string" } }, required: ["name", "purpose"] } },
            dev_prod_parity: { type: "object", properties: { iac_tool: { type: "string" }, approach: { type: "string" } }, required: ["iac_tool", "approach"] },
            config_management: { type: "object", properties: { strategy: { type: "string" }, secrets_tool: { type: "string" } }, required: ["strategy"] },
            database_migrations: { type: "object", properties: { tool: { type: "string" }, backward_compatible: { type: "boolean" } }, required: ["tool"] },
            feature_flags: { type: "object", properties: { framework: { type: "string" }, use_cases: { type: "array", items: { type: "string" } } } },
          },
          required: ["tiers", "dev_prod_parity", "config_management", "database_migrations"],
        },
        cicd_pipeline: {
          type: "object",
          properties: {
            tool: { type: "string" },
            stages: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, automated: { type: "boolean" } }, required: ["name", "description"] } },
            deployment_strategy: { type: "object", properties: { method: { type: "string", description: "blue-green / canary / rolling / recreate" }, rollback_plan: { type: "string" } }, required: ["method", "rollback_plan"] },
            quality_gates: { type: "array", items: { type: "string" } },
            security_scanning: { type: "object", properties: { sast: { type: "string" }, dast: { type: "string" }, sca: { type: "string" }, container_scan: { type: "string" } } },
            delivery_model: { type: "object", properties: { type: { type: "string", description: "GitOps / push-based CI/CD / hybrid" }, rationale: { type: "string" } } },
            artifact_versioning: { type: "object", properties: { strategy: { type: "string" }, immutable: { type: "boolean" } }, required: ["strategy"] },
            dora_metrics_targets: { type: "object", properties: { deployment_frequency: { type: "string" }, lead_time: { type: "string" }, mttr: { type: "string" }, change_failure_rate: { type: "string" } } },
          },
          required: ["tool", "stages", "deployment_strategy", "artifact_versioning"],
        },
        scaling_resilience: {
          type: "object",
          description: "Combined scalability & resilience posture.",
          properties: {
            horizontal: { type: "object", properties: { approach: { type: "string" }, auto_scaling: { type: "string" }, triggers: { type: "array", items: { type: "string" } }, min_replicas: { type: "number" }, max_replicas: { type: "number" } }, required: ["approach", "auto_scaling"] },
            vertical: { type: "object", properties: { approach: { type: "string" }, limits: { type: "string" } } },
            database_scaling: { type: "object", properties: { read_replicas: { type: "boolean" }, sharding_strategy: { type: "string" }, connection_pooling: { type: "string" } }, required: ["read_replicas"] },
            edge_and_cdn: { type: "object", properties: { cdn: { type: "string" }, edge_compute: { type: "string" }, geographic_routing: { type: "string" } } },
            disaster_recovery: { type: "object", properties: { rto: { type: "string" }, rpo: { type: "string" }, backup_strategy: { type: "string" }, failover: { type: "string" } }, required: ["rto", "rpo"] },
            load_testing: { type: "object", properties: { expected_rps: { type: "number" }, peak_rps: { type: "number" }, tool: { type: "string" } } },
          },
          required: ["horizontal", "database_scaling", "disaster_recovery"],
        },
        cost_and_readiness: {
          type: "object",
          description: "Cost posture and operational go-live readiness.",
          properties: {
            estimated_monthly_cost_band: { type: "string", description: "e.g., $500-$2k/mo, $2k-$10k/mo, $10k-$50k/mo, >$50k/mo" },
            cost_drivers: { type: "array", items: { type: "string" } },
            finops_levers: { type: "array", items: { type: "string" }, description: "spot/reserved instances, autoscaling floors, storage tiering, etc." },
            on_call_model: { type: "string", description: "follow-the-sun / single team / vendor-managed" },
            runbook_coverage: { type: "string" },
            slo_alignment: { type: "string", description: "How this design supports SLOs/error budgets defined in cross-cutting concerns." },
            readiness_checklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  status: { type: "string", description: "ready / partial / gap" },
                  note: { type: "string" },
                },
                required: ["item", "status"],
              },
            },
          },
        },
        mermaid_diagrams: {
          type: "array",
          description: "Provide AT LEAST 3 diagrams: (1) Deployment topology, (2) Network/security zones, (3) CI/CD pipeline flow.",
          items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] },
        },
      },
      required: ["title", "summary", "key_findings", "inputs_snapshot", "deployment_topology", "environment_strategy", "cicd_pipeline", "scaling_resilience", "cost_and_readiness", "mermaid_diagrams"],
    },
  },
  11: {
    name: "evaluate_quality_attributes",
    description: "Evaluate architecture quality attributes with evidence-based scores.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        overall_score: { type: "string", enum: ["strong", "adequate", "needs_improvement", "weak"] },
        evaluations: { type: "array", items: { type: "object", properties: { attribute: { type: "string" }, rating: { type: "string", enum: ["strong", "adequate", "weak"] }, score: { type: "number" }, assessment: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, concerns: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["attribute", "rating", "score", "assessment"] } },
        critical_gaps: { type: "array", items: { type: "string" } },
        improvement_priorities: { type: "array", items: { type: "object", properties: { attribute: { type: "string" }, priority: { type: "string" }, action: { type: "string" }, expected_impact: { type: "string" } }, required: ["attribute", "priority", "action"] } },
        influence_on_architecture: { type: "string" },
        nfr_coverage: { type: "array", items: { type: "object", properties: { requirement_id: { type: "string" }, attribute: { type: "string" }, coverage: { type: "string" }, notes: { type: "string" } }, required: ["requirement_id", "coverage"] } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "overall_score", "evaluations", "critical_gaps"],
    },
  },
  12: {
    name: "analyze_risks",
    description: "Perform risk analysis with probability/impact ratings for heat map.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        risk_summary: { type: "string" },
        risks: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, category: { type: "string" }, description: { type: "string" }, probability: { type: "string", enum: ["very_low", "low", "medium", "high", "very_high"] }, impact: { type: "string", enum: ["very_low", "low", "medium", "high", "very_high"] }, severity: { type: "string" }, affected_components: { type: "array", items: { type: "string" } }, affected_quality_attributes: { type: "array", items: { type: "string" } }, mitigation_strategy: { type: "string" }, contingency_plan: { type: "string" }, owner: { type: "string" }, status: { type: "string" } }, required: ["id", "title", "category", "description", "probability", "impact", "severity", "mitigation_strategy"] } },
        risk_matrix: { type: "object", properties: { high_high: { type: "array", items: { type: "string" } }, high_medium: { type: "array", items: { type: "string" } }, medium_high: { type: "array", items: { type: "string" } }, medium_medium: { type: "array", items: { type: "string" } }, low_low: { type: "array", items: { type: "string" } } } },
        overall_risk_level: { type: "string" },
        top_risks_summary: { type: "array", items: { type: "string" } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "risks", "overall_risk_level"],
    },
  },
  13: {
    name: "validate_architecture",
    description: "Validate the complete architecture for consistency, completeness, and governance readiness.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        validation_status: { type: "string", enum: ["passed", "passed_with_warnings", "failed"] },
        requirement_coverage: { type: "object", properties: { total_requirements: { type: "number" }, covered: { type: "number" }, uncovered: { type: "array", items: { type: "string" } }, coverage_percentage: { type: "number" } }, required: ["total_requirements", "covered", "coverage_percentage"] },
        consistency_checks: { type: "array", items: { type: "object", properties: { check: { type: "string" }, status: { type: "string" }, details: { type: "string" } }, required: ["check", "status"] } },
        governance_readiness: { type: "object", properties: { ready: { type: "boolean" }, blockers: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } }, required: ["ready"] },
        risk_mitigation_status: { type: "array", items: { type: "object", properties: { risk_id: { type: "string" }, risk_title: { type: "string" }, mitigation_status: { type: "string" }, assessment: { type: "string" } }, required: ["risk_id", "mitigation_status"] } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "validation_status", "requirement_coverage", "consistency_checks", "governance_readiness"],
    },
  },
  14: {
    name: "generate_documentation",
    description: "Generate comprehensive architecture documentation with ADRs and executive summary.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
        executive_summary: { type: "object", properties: { overview: { type: "string" }, key_decisions: { type: "array", items: { type: "string" } }, risks_and_mitigations: { type: "array", items: { type: "string" } }, implementation_roadmap: { type: "string" } }, required: ["overview", "key_decisions"] },
        architecture_overview: { type: "object", properties: { style: { type: "string" }, components: { type: "array", items: { type: "string" } }, key_patterns: { type: "array", items: { type: "string" } }, technology_stack: { type: "array", items: { type: "string" } } }, required: ["style", "components"] },
        adrs: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, context: { type: "string" }, decision: { type: "string" }, alternatives: { type: "array", items: { type: "string" } }, consequences: { type: "array", items: { type: "string" } }, rationale: { type: "string" } }, required: ["id", "title", "context", "decision", "consequences"] } },
        traceability_matrix: { type: "array", items: { type: "object" } },
        handoff_notes: { type: "array", items: { type: "string" } },
        mermaid_diagrams: { type: "array", items: { type: "object", properties: { title: { type: "string" }, type: { type: "string" }, code: { type: "string" } }, required: ["title", "code"] } },
      },
      required: ["title", "summary", "key_findings", "executive_summary", "architecture_overview", "adrs"],
    },
  },
  16: {
    name: "generate_code",
    description: "Generate implementation-ready code scaffolding based on finalized architecture.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        project_structure: { type: "object", properties: { root_directory: { type: "string" }, description: { type: "string" }, directories: { type: "array", items: { type: "object", properties: { path: { type: "string" }, purpose: { type: "string" } }, required: ["path", "purpose"] } } }, required: ["root_directory"] },
        modules: { type: "array", items: { type: "object", properties: { name: { type: "string" }, path: { type: "string" }, responsibility: { type: "string" }, source_component: { type: "string", description: "Component from decomposition this module implements" }, interfaces: { type: "array", items: { type: "object", properties: { name: { type: "string" }, methods: { type: "array", items: { type: "string" } }, description: { type: "string" } }, required: ["name", "methods"] } }, dependencies: { type: "array", items: { type: "string" } }, types: { type: "array", items: { type: "object", properties: { name: { type: "string" }, definition: { type: "string" } }, required: ["name", "definition"] } }, code_snippet: { type: "string", description: "Interface stub or skeleton code (not full implementation)" } }, required: ["name", "responsibility", "source_component", "interfaces"] } },
        api_implementations: { type: "array", items: { type: "object", properties: { endpoint: { type: "string" }, method: { type: "string" }, handler_module: { type: "string" }, request_type: { type: "string" }, response_type: { type: "string" }, description: { type: "string" } }, required: ["endpoint", "method", "handler_module"] } },
        test_files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, target_module: { type: "string" }, test_type: { type: "string", description: "unit, integration, or e2e" }, test_cases: { type: "array", items: { type: "string" } } }, required: ["path", "target_module", "test_type"] } },
        traceability: { type: "array", items: { type: "object", properties: { requirement_id: { type: "string" }, module_name: { type: "string" }, coverage_notes: { type: "string" } }, required: ["requirement_id", "module_name"] } },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
      },
      required: ["title", "summary", "key_findings", "modules"],
    },
  },
  17: {
    name: "validate_code",
    description: "Validate generated code against the approved architecture.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        overall_status: { type: "string", enum: ["passed", "passed_with_warnings", "failed"] },
        checks: { type: "array", items: { type: "object", properties: { name: { type: "string" }, status: { type: "string", enum: ["passed", "warning", "failed"] }, details: { type: "string" }, affected_modules: { type: "array", items: { type: "string" } } }, required: ["name", "status", "details"] } },
        boundary_violations: { type: "array", items: { type: "object", properties: { module: { type: "string" }, violation: { type: "string" }, severity: { type: "string" }, recommendation: { type: "string" } }, required: ["module", "violation", "severity"] } },
        missing_implementations: { type: "array", items: { type: "object", properties: { component: { type: "string" }, expected_module: { type: "string" }, gap_description: { type: "string" } }, required: ["component", "gap_description"] } },
        api_mismatches: { type: "array", items: { type: "object", properties: { endpoint: { type: "string" }, expected: { type: "string" }, actual: { type: "string" }, severity: { type: "string" } }, required: ["endpoint", "expected", "actual"] } },
        packaging_status: { type: "object", properties: { complete: { type: "boolean" }, missing_artifacts: { type: "array", items: { type: "string" } }, notes: { type: "string" } }, required: ["complete"] },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
      },
      required: ["title", "overall_status", "checks", "summary"],
    },
  },
  18: {
    name: "assess_evolution",
    description: "Assess architecture for future evolution readiness.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        current_version: { type: "string" },
        evolution_readiness: { type: "string", enum: ["high", "moderate", "low"] },
        evolution_paths: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, trigger: { type: "string" }, effort: { type: "string", enum: ["low", "medium", "high"] }, risk: { type: "string", enum: ["low", "medium", "high"] }, affected_components: { type: "array", items: { type: "string" } } }, required: ["name", "description", "trigger", "effort"] } },
        extensibility_points: { type: "array", items: { type: "object", properties: { name: { type: "string" }, location: { type: "string" }, mechanism: { type: "string" }, use_case: { type: "string" } }, required: ["name", "mechanism", "use_case"] } },
        technical_debt_assessment: { type: "array", items: { type: "object", properties: { item: { type: "string" }, severity: { type: "string", enum: ["low", "medium", "high"] }, remediation: { type: "string" }, cost_of_delay: { type: "string" } }, required: ["item", "severity", "remediation"] } },
        re_assessment_triggers: { type: "array", items: { type: "string" } },
        narrative: { type: "string", description: "1-3 paragraph evolution narrative: cadence, triggers, tech-debt policy, decision authority. Minimum 120 chars." },
        kpis: { type: "array", description: "At least 3 KPIs that indicate architectural health.", items: { type: "object", properties: { name: { type: "string" }, target: { type: "string" }, cadence: { type: "string" }, owner: { type: "string" } }, required: ["name", "target", "cadence"] } },
        drift_signals: { type: "array", description: "At least 1 early-warning drift indicator.", items: { type: "object", properties: { name: { type: "string" }, source: { type: "string" }, threshold: { type: "string" }, response: { type: "string" } }, required: ["name", "source", "threshold"] } },
        feedback_loops: { type: "array", description: "At least 1 feedback loop feeding architecture decisions.", items: { type: "object", properties: { channel: { type: "string" }, cadence: { type: "string" }, owner: { type: "string" }, input_type: { type: "string" } }, required: ["channel", "cadence", "owner"] } },
        summary: { type: "string" },
        key_findings: KEY_FINDINGS_SCHEMA,
      },
      required: ["title", "evolution_readiness", "evolution_paths", "summary", "narrative", "kpis", "drift_signals", "feedback_loops"],
    },
  },
};

// ─── Challenger Agent tool schema ───────────────────────────────────────────
export const CHALLENGER_SCHEMA = {
  name: "challenge_recommendation",
  description: "Challenge and debate the primary agent's recommendation as a devil's advocate.",
  parameters: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["agree", "partially_disagree", "strongly_disagree"] },
      confidence: { type: "number", description: "0-100 confidence in verdict" },
      summary: { type: "string", description: "2-3 sentence summary of the challenger's position" },
      strengths_acknowledged: { type: "array", items: { type: "string" }, description: "What the primary agent got right" },
      concerns: { type: "array", items: { type: "object", properties: { issue: { type: "string" }, severity: { type: "string", enum: ["critical", "high", "medium", "low"] }, category: { type: "string", enum: ["scalability", "performance", "security", "cost", "complexity", "maintainability", "reliability", "operability", "team_fit", "data", "compliance", "other"], description: "High-level category for triage and grouping" }, evidence: { type: "string" }, alternative_approach: { type: "string" }, confidence: { type: "number", description: "0-100 confidence that this concern is genuine and material, given the cited evidence." }, confidence_signals: { type: "array", items: { type: "string" }, description: "Short bullets explaining what drove the confidence score." } }, required: ["issue", "severity", "evidence", "confidence", "confidence_signals"] } },
      counter_arguments: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, counter: { type: "string" }, supporting_evidence: { type: "string" } }, required: ["claim", "counter"] } },
      alternative_recommendation: { type: "string", description: "What the challenger would recommend instead" },
      risk_blindspots: { type: "array", items: { type: "string" }, description: "Risks the primary agent may have missed" },
      final_assessment: { type: "string", description: "Overall assessment" },
    },
    required: ["verdict", "confidence", "summary", "concerns", "counter_arguments", "final_assessment"],
  },
};

// Stages where the Challenger Architect runs automatically alongside the primary
// recommendation. Stage 4 (Architectural Style Recommendation) auto-runs the
// Challenger never auto-runs — the architect must explicitly trigger it via the
// "Challenge this Recommendation" button (challenge_only mode). This keeps the
// primary recommendation flow fast and avoids surprising users with a second
// opinion they did not ask for.
export const CHALLENGER_STAGES: number[] = [];

// ─── Scientific Challenger Schema (architect-grade evaluation) ─────────────
// Grounded in: ISO/IEC 25010 (Software Quality Model), SEI ATAM (Architecture
// Tradeoff Analysis Method), IEEE 1471 / ISO 42010 (Architecture Description),
// and TOGAF Architecture Compliance Review.
export const SCIENTIFIC_CHALLENGER_SCHEMA = {
  name: "evaluate_architecture_scientifically",
  description: "Perform an evidence-based, multi-criteria scientific evaluation of an architectural recommendation.",
  parameters: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["accept", "accept_with_revisions", "revise", "reject"],
        description: "Overall verdict on the recommendation, ATAM-style.",
      },
      overall_score: { type: "number", description: "Weighted score 0-100 across all dimensions." },
      confidence: { type: "number", description: "Evaluator's confidence in this verdict, 0-100." },
      executive_summary: { type: "string", description: "2-3 sentence verdict summary for an architect review board." },
      evaluation_dimensions: {
        type: "array",
        description: "Per-dimension evaluation. MUST include all 10 dimensions.",
        items: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: [
                "completeness",      // Are all required artifacts/decisions present?
                "consistency",       // Are decisions internally consistent and aligned with drivers?
                "feasibility",       // Implementable with the team/budget/timeline?
                "risk",              // Severity & likelihood of failure modes
                "traceability",      // Each decision tied to specific requirements/drivers (ISO 42010)
                "modifiability",     // ISO 25010 — change cost
                "testability",       // ISO 25010 — verification effort
                "tradeoff_balance",  // ATAM — are quality attribute tradeoffs explicit & balanced?
                "anti_patterns",     // Presence of known architectural smells
                "sensitivity_points" // ATAM — decisions that strongly impact quality attributes
              ],
            },
            score: { type: "number", description: "0-100 score on this dimension." },
            rating: { type: "string", enum: ["strong", "adequate", "weak", "critical"] },
            rationale: { type: "string", description: "Evidence-based justification (1-3 sentences)." },
            evidence: { type: "array", items: { type: "string" }, description: "Specific citations: requirement IDs, design choices, or standards." },
            findings: { type: "array", items: { type: "string" }, description: "Concrete observations supporting the score." },
            recommendations: { type: "array", items: { type: "string" }, description: "Actionable improvements for this dimension." },
          },
          required: ["dimension", "score", "rating", "rationale", "findings"],
        },
      },
      atam_analysis: {
        type: "object",
        description: "ATAM-style analysis (SEI Architecture Tradeoff Analysis Method).",
        properties: {
          sensitivity_points: { type: "array", items: { type: "object", properties: { decision: { type: "string" }, affected_attributes: { type: "array", items: { type: "string" } }, impact: { type: "string" } }, required: ["decision", "affected_attributes", "impact"] } },
          tradeoff_points: { type: "array", items: { type: "object", properties: { decision: { type: "string" }, gains: { type: "array", items: { type: "string" } }, sacrifices: { type: "array", items: { type: "string" } } }, required: ["decision", "gains", "sacrifices"] } },
          risks: { type: "array", items: { type: "object", properties: { risk: { type: "string" }, severity: { type: "string", enum: ["critical", "high", "medium", "low"] }, likelihood: { type: "string", enum: ["high", "medium", "low"] }, mitigation: { type: "string" } }, required: ["risk", "severity", "likelihood"] } },
          non_risks: { type: "array", items: { type: "string" }, description: "Decisions explicitly judged safe — important for documenting what was checked." },
        },
        required: ["sensitivity_points", "tradeoff_points", "risks"],
      },
      concerns: {
        type: "array",
        description: "Actionable concerns the architect can accept/reject/modify (used by HITL refinement loop).",
        items: {
          type: "object",
          properties: {
            issue: { type: "string" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            category: { type: "string", enum: ["scalability", "performance", "security", "cost", "complexity", "maintainability", "reliability", "operability", "team_fit", "data", "compliance", "other"], description: "High-level category for triage and grouping" },
            evidence: { type: "string" },
            alternative_approach: { type: "string" },
            related_dimension: { type: "string" },
            confidence: { type: "number", description: "0-100 confidence that this concern is genuine and material, given the cited evidence." },
            confidence_signals: { type: "array", items: { type: "string" }, description: "Short bullets explaining what drove the confidence score (e.g., 'Cited REQ-014 verbatim', 'Two components show the same coupling smell', 'ISO 25010 maintainability applies', 'Inferred — no direct artifact citation')." },
          },
          required: ["issue", "severity", "evidence", "confidence", "confidence_signals"],
        },
      },
      strengths_acknowledged: { type: "array", items: { type: "string" } },
      standards_referenced: { type: "array", items: { type: "string" }, description: "ISO 25010, ATAM, TOGAF, AWS Well-Architected, etc." },
      final_assessment: { type: "string", description: "Closing paragraph for the review record." },
    },
    required: ["verdict", "overall_score", "confidence", "executive_summary", "evaluation_dimensions", "atam_analysis", "concerns", "final_assessment"],
  },
};

// ─── Artifact type mapping ──────────────────────────────────────────────────
export const ARTIFACT_TYPES: Record<number, string> = {
  2: "executive_summary", 3: "adr", 4: "style_recommendation", 5: "tradeoff_analysis",
  6: "decomposition", 7: "data_architecture", 8: "api_design",
  9: "executive_summary", 10: "executive_summary",
  11: "quality_evaluation", 12: "risk_analysis", 13: "validation_report", 14: "adr",
  16: "code_output", 17: "validation_report", 18: "executive_summary",
};

export const AGENT_NAMES: Record<number, string> = {
  2: "Requirement Analysis Agent", 3: "Architecture Driver Identification Agent",
  4: "Architecture Style Recommendation Agent", 5: "Synthetic Architect Agent",
  6: "Decomposition Agent", 7: "Data Architecture Agent",
  8: "API and Interface Design Agent",
  9: "Cross-Cutting Concerns Agent", 10: "Infrastructure & Deployment Agent",
  11: "Quality Attribute Evaluation Agent", 12: "Risk Analysis Agent",
  13: "Validation and Governance Agent", 14: "Documentation and ADR Agent",
  16: "Code Generation Agent", 17: "Code Validation Agent", 18: "Architecture Evolution Agent",
};


// ─── Strategy resolver ──────────────────────────────────────────────────────
export interface StageDefinition {
  stage: number;
  agentName: string;
  artifactType: string;
  toolSchema: { name: string; description: string; parameters: any };
  systemPrompt: string;
}

export function getStageDefinition(stage: number): StageDefinition | null {
  const toolSchema = TOOL_SCHEMAS[stage];
  const systemPrompt = SYSTEM_PROMPTS[stage];
  const agentName = AGENT_NAMES[stage];
  const artifactType = ARTIFACT_TYPES[stage];
  if (!toolSchema || !systemPrompt || !agentName || !artifactType) return null;
  return { stage, agentName, artifactType, toolSchema, systemPrompt };
}
