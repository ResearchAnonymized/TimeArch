import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Architecture Knowledge Base Seed Data ──────────────────────────────────
const KNOWLEDGE_CHUNKS = [
  // ═══ AWS Well-Architected Framework ═══════════════════════════════════════
  {
    framework: "aws_well_architected",
    category: "security",
    title: "AWS Security Pillar — Design Principles",
    content: `The AWS Security Pillar encompasses the ability to protect data, systems, and assets. Key design principles:
1. Implement a strong identity foundation — Use least privilege, enforce separation of duties with appropriate authorization for each interaction with AWS resources. Centralize identity management, eliminate reliance on long-term static credentials.
2. Maintain traceability — Monitor, alert, and audit actions and changes in real time. Integrate log and metric collection to automatically investigate and take action.
3. Apply security at all layers — Apply a defense in depth approach with multiple security controls at every layer (edge, VPC, load balancer, instance, OS, application).
4. Automate security best practices — Automated software-based security mechanisms improve your ability to securely scale more rapidly and cost-effectively.
5. Protect data in transit and at rest — Classify data into sensitivity levels and use mechanisms such as encryption, tokenization, and access control.
6. Keep people away from data — Use mechanisms and tools to reduce or eliminate the need for direct access or manual processing of data.
7. Prepare for security events — Run incident response simulations and use tools with automation to increase speed for detection, investigation, and recovery.`,
    tags: ["security", "iam", "encryption", "defense-in-depth", "least-privilege", "audit-logging"],
    relevant_stages: [4, 5, 6, 7, 8, 9, 10],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/",
  },
  {
    framework: "aws_well_architected",
    category: "reliability",
    title: "AWS Reliability Pillar — Design Principles",
    content: `The Reliability Pillar focuses on workloads performing their intended functions correctly and consistently. Key principles:
1. Automatically recover from failure — Monitor KPIs and trigger automation when thresholds are breached. Focus on MTTR (Mean Time to Recovery), not just MTBF.
2. Test recovery procedures — Use automation to simulate different failures or to recreate scenarios that led to failures before. Verify recovery paths.
3. Scale horizontally — Replace one large resource with multiple small resources to reduce the impact of a single failure. Distribute requests across resources.
4. Stop guessing capacity — Use auto scaling to add and remove resources automatically. Monitor demand and system utilization.
5. Manage change through automation — Changes to infrastructure should be made using automation. Changes that need to be managed include changes to the automation, which then can be tracked and reviewed.
Failure management: Use bulkhead architecture to limit blast radius. Implement circuit breakers for external dependencies. Use retry with exponential backoff and jitter.`,
    tags: ["reliability", "fault-tolerance", "auto-scaling", "circuit-breaker", "bulkhead", "disaster-recovery", "high-availability"],
    relevant_stages: [4, 5, 6, 9, 10],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/",
  },
  {
    framework: "aws_well_architected",
    category: "performance",
    title: "AWS Performance Efficiency Pillar",
    content: `Performance Efficiency focuses on the efficient use of computing resources. Key principles:
1. Democratize advanced technologies — Use managed services instead of hosting and running technology yourself.
2. Go global in minutes — Deploy workloads in multiple AWS Regions to provide lower latency and a better experience at minimal cost.
3. Use serverless architectures — Remove the operational burden of running and maintaining traditional compute activities.
4. Experiment more often — With virtual and automatable resources, comparative testing using different types of instances, storage, or configurations is easy.
5. Consider mechanical sympathy — Understand how cloud services are consumed and always use the technology approach that aligns best to your workload goals.
Selection: Choose the right resource types and sizes based on workload requirements. Review choices using load testing and monitoring.
Caching strategies: Use CDN for static content, in-memory caching (Redis/ElastiCache) for frequently accessed data, database query caching.
Database performance: Choose purpose-built databases. Use read replicas for read-heavy workloads. Consider NoSQL for specific access patterns.`,
    tags: ["performance", "scalability", "caching", "serverless", "cdn", "database-optimization", "load-testing"],
    relevant_stages: [4, 5, 6, 7, 8, 9],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/",
  },
  {
    framework: "aws_well_architected",
    category: "cost",
    title: "AWS Cost Optimization Pillar",
    content: `Cost Optimization focuses on avoiding unnecessary costs. Key principles:
1. Implement cloud financial management — Invest in Cloud Financial Management to build capability.
2. Adopt a consumption model — Pay only for the computing resources you consume. Increase or decrease usage depending on business requirements.
3. Measure overall efficiency — Measure the business output of the workload and the costs associated with delivering it.
4. Stop spending money on undifferentiated heavy lifting — AWS does the heavy lifting of data center operations like racking, stacking, and powering servers.
5. Analyze and attribute expenditure — Accurately identify the usage and cost of workloads, used to measure return on investment.
Right sizing: Select the cheapest resource that still meets your performance requirements. Use Compute Optimizer and Cost Explorer. Review regularly.
Architecture patterns: Use event-driven architectures to avoid idle resources. Use spot instances for fault-tolerant workloads. Consider reserved capacity for steady-state.`,
    tags: ["cost", "optimization", "right-sizing", "consumption-model", "serverless", "reserved-instances"],
    relevant_stages: [4, 5, 6, 9],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/",
  },
  {
    framework: "aws_well_architected",
    category: "operational_excellence",
    title: "AWS Operational Excellence Pillar",
    content: `Operational Excellence focuses on running and monitoring systems to deliver business value. Key principles:
1. Perform operations as code — Define entire workload (applications, infrastructure, etc.) as code and update with code. Script operations procedures and automate their execution.
2. Make frequent, small, reversible changes — Design workloads to allow components to be updated regularly. Make changes in small increments that can be reversed if they fail.
3. Refine operations procedures frequently — Look for opportunities to improve operations procedures. Evolve procedures as workloads evolve. Set up regular game days.
4. Anticipate failure — Test failure scenarios and validate your understanding of their impact. Test response procedures and practice them regularly.
5. Learn from all operational failures — Drive improvement through lessons learned from all operational events and failures. Share what is learned across teams.
Observability: Implement distributed tracing, structured logging, and metrics. Use dashboards for operational health visibility. Set up automated alerting with runbooks.
Deployment: Use blue/green or canary deployments. Implement feature flags for gradual rollouts. Automate rollback procedures.`,
    tags: ["operations", "observability", "deployment", "monitoring", "logging", "tracing", "devops", "infrastructure-as-code"],
    relevant_stages: [4, 5, 6, 9, 10, 11],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/",
  },
  {
    framework: "aws_well_architected",
    category: "sustainability",
    title: "AWS Sustainability Pillar",
    content: `The Sustainability Pillar focuses on environmental impacts, especially energy consumption and efficiency. Key principles:
1. Understand your impact — Measure the impact of your cloud workload and model the future impact of your workload.
2. Establish sustainability goals — For each cloud workload, set long-term sustainability goals such as reducing compute and storage resources.
3. Maximize utilization — Right-size each workload to maximize the energy efficiency of the underlying hardware and minimize idle resources.
4. Anticipate and adopt new, more efficient hardware and software offerings — Support upstream improvements your partners and suppliers make.
5. Use managed services — Sharing services across a broad customer base helps maximize resource utilization.
6. Reduce the downstream impact of your cloud workloads — Reduce the amount of energy or resources required to use your services.
Architecture implications: Prefer async/event-driven patterns. Use purpose-built databases over general-purpose. Cache aggressively. Minimize data movement.`,
    tags: ["sustainability", "efficiency", "green-computing", "resource-optimization"],
    relevant_stages: [4, 5, 9],
    source_url: "https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/",
  },

  // ═══ ISO 25010 — Software Quality Model ═══════════════════════════════════
  {
    framework: "iso_25010",
    category: "functional_suitability",
    title: "ISO 25010 — Functional Suitability",
    content: `Functional Suitability represents the degree to which a product or system provides functions that meet stated and implied needs when used under specified conditions. Sub-characteristics:
1. Functional completeness — Degree to which the set of functions covers all the specified tasks and user objectives. Every user requirement must map to at least one system function.
2. Functional correctness — Degree to which a product or system provides the correct results with the needed degree of precision. Includes calculation accuracy, data integrity, and business rule adherence.
3. Functional appropriateness — Degree to which the functions facilitate the accomplishment of specified tasks and objectives. The right abstraction level for users — neither too granular nor too coarse.
Architectural implications: Ensure clear mapping between requirements and components. Use domain-driven design to align architecture with business capabilities. Validate completeness through traceability matrices.`,
    tags: ["functional", "completeness", "correctness", "appropriateness", "requirements-coverage", "traceability"],
    relevant_stages: [2, 3, 6, 9, 11],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "performance_efficiency",
    title: "ISO 25010 — Performance Efficiency",
    content: `Performance Efficiency represents the performance relative to the amount of resources used under stated conditions. Sub-characteristics:
1. Time behaviour — Degree to which response and processing times and throughput rates meet requirements. Define SLOs: p50 < 200ms, p99 < 1s for API calls. Measure under realistic load profiles.
2. Resource utilization — Degree to which the amounts and types of resources used by a product or system meet requirements. CPU, memory, I/O, network bandwidth. Avoid over-provisioning and under-provisioning.
3. Capacity — Degree to which the maximum limits of a product or system parameter meet requirements. Define capacity limits explicitly: max concurrent users, max transactions/second, max data volume.
Architectural implications: Use caching (CDN, in-memory, query-level). Design for horizontal scaling. Use async processing for non-critical paths. Implement connection pooling. Choose appropriate data structures and algorithms. Load test at 2x expected peak.`,
    tags: ["performance", "latency", "throughput", "capacity", "resource-utilization", "slo", "load-testing"],
    relevant_stages: [4, 5, 8, 9],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "compatibility",
    title: "ISO 25010 — Compatibility",
    content: `Compatibility represents the degree to which a product, system, or component can exchange information with other products, systems, or components, and/or perform its required functions while sharing the same hardware or software environment. Sub-characteristics:
1. Co-existence — Degree to which a product can perform its required functions efficiently while sharing a common environment and resources with other products, without detrimental impact on any other product. Consider resource contention, port conflicts, shared dependencies.
2. Interoperability — Degree to which two or more systems can exchange information and use the information that has been exchanged. Use standard protocols (REST, GraphQL, gRPC). Adopt industry-standard data formats (JSON, XML, Protocol Buffers). Implement API versioning. Use OpenAPI/Swagger specifications.
Architectural implications: Design APIs with clear contracts. Use event-driven integration patterns. Implement API gateways for cross-system communication. Use standard authentication (OAuth 2.0, OIDC). Consider backward compatibility in API evolution.`,
    tags: ["compatibility", "interoperability", "api-contracts", "standards", "integration", "api-versioning"],
    relevant_stages: [6, 7, 8, 9],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "usability",
    title: "ISO 25010 — Usability",
    content: `Usability represents the degree to which a product or system can be used by specified users to achieve specified goals with effectiveness, efficiency, and satisfaction. Sub-characteristics:
1. Appropriateness recognizability — Users can recognize whether the product is appropriate for their needs.
2. Learnability — Degree to which a product can be used by specified users to achieve specified goals of learning with effectiveness, efficiency, freedom from risk, and satisfaction.
3. Operability — Degree to which a product has attributes that make it easy to operate and control.
4. User error protection — Degree to which a system protects users against making errors. Input validation, confirmation dialogs for destructive actions, undo capability.
5. User interface aesthetics — Degree to which a user interface enables pleasing and satisfying interaction.
6. Accessibility — Degree to which a product can be used by people with the widest range of characteristics and capabilities. WCAG 2.1 AA compliance minimum.
Architectural implications: Separate UI concerns from business logic. Design for progressive disclosure. Implement client-side validation with server-side backup. Consider offline capabilities for mobile.`,
    tags: ["usability", "ux", "accessibility", "learnability", "error-protection", "wcag"],
    relevant_stages: [2, 6, 8, 9],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "reliability",
    title: "ISO 25010 — Reliability",
    content: `Reliability represents the degree to which a system performs specified functions under specified conditions for a specified period of time. Sub-characteristics:
1. Maturity — Degree to which a system meets needs for reliability under normal operation. Measure with MTBF (Mean Time Between Failures). Target: 99.9% uptime = 8.76h downtime/year.
2. Availability — Degree to which a system is operational and accessible when required for use. Design for: active-passive failover (99.9%), active-active (99.99%), multi-region active-active (99.999%).
3. Fault tolerance — Degree to which a system operates as intended despite the presence of hardware or software faults. Implement graceful degradation, circuit breakers, bulkhead isolation, retry with backoff.
4. Recoverability — Degree to which a product or system can recover data and re-establish the desired state after an interruption or failure. Define RPO (Recovery Point Objective) and RTO (Recovery Time Objective). Automate backup and restore procedures.
Architectural implications: Design for failure. Implement health checks. Use redundancy at every layer. Practice chaos engineering. Define SLAs with clear escalation procedures.`,
    tags: ["reliability", "availability", "fault-tolerance", "recoverability", "sla", "mtbf", "rpo", "rto", "chaos-engineering"],
    relevant_stages: [4, 5, 6, 9, 10],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "security",
    title: "ISO 25010 — Security",
    content: `Security represents the degree to which a product or system protects information and data so that persons or other systems have the degree of data access appropriate to their types and levels of authorization. Sub-characteristics:
1. Confidentiality — Degree to which a product or system ensures that data are accessible only to those authorized. Implement encryption at rest (AES-256) and in transit (TLS 1.3). Use field-level encryption for PII.
2. Integrity — Degree to which a system prevents unauthorized access to, or modification of, data. Use checksums, digital signatures, and audit trails. Implement optimistic concurrency control.
3. Non-repudiation — Degree to which actions or events can be proven to have taken place. Implement comprehensive audit logging with tamper-proof storage. Use cryptographic signing for critical operations.
4. Accountability — Degree to which the actions of an entity can be traced uniquely to the entity. Map every action to an authenticated identity. Maintain complete audit trail.
5. Authenticity — Degree to which the identity of a subject or resource can be proved to be the one claimed. Use multi-factor authentication. Implement certificate-based authentication for service-to-service.
Architectural implications: Defense in depth — apply security at network, application, and data layers. Implement RBAC or ABAC. Follow OWASP Top 10. Use security headers. Regular penetration testing.`,
    tags: ["security", "confidentiality", "integrity", "authentication", "authorization", "encryption", "audit", "owasp", "rbac"],
    relevant_stages: [4, 5, 6, 7, 8, 9, 10],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "maintainability",
    title: "ISO 25010 — Maintainability",
    content: `Maintainability represents the degree of effectiveness and efficiency with which a product or system can be modified. Sub-characteristics:
1. Modularity — Degree to which a system is composed of discrete components such that a change to one component has minimal impact on others. High cohesion within modules, low coupling between modules. Single Responsibility Principle.
2. Reusability — Degree to which an asset can be used in more than one system or in building other assets. Extract shared libraries. Use composition over inheritance. Design generic interfaces.
3. Analysability — Degree of effectiveness and efficiency with which it is possible to assess the impact of an intended change. Clear code structure, comprehensive documentation, dependency graphs, impact analysis tools.
4. Modifiability — Degree to which a product can be effectively and efficiently modified without introducing defects. Open/Closed Principle. Use dependency injection. Avoid tight coupling. Design for extension points.
5. Testability — Degree of effectiveness and efficiency with which test criteria can be established and tests performed. Design for testability: dependency injection, interface-based design, avoid static dependencies. Target 80%+ code coverage for critical paths.
Architectural implications: Follow SOLID principles. Use clean architecture or hexagonal architecture. Keep cyclomatic complexity below 10 per function. Enforce coding standards. Implement automated quality gates.`,
    tags: ["maintainability", "modularity", "testability", "solid", "clean-architecture", "coupling", "cohesion", "code-quality"],
    relevant_stages: [4, 5, 6, 9, 11],
    source_url: "https://www.iso.org/standard/35733.html",
  },
  {
    framework: "iso_25010",
    category: "portability",
    title: "ISO 25010 — Portability",
    content: `Portability represents the degree of effectiveness and efficiency with which a system can be transferred from one hardware, software, or other operational environment to another. Sub-characteristics:
1. Adaptability — Degree to which a product can effectively and efficiently be adapted for different or evolving hardware, software or other environments. Use environment-specific configuration. Abstract infrastructure dependencies.
2. Installability — Degree of effectiveness and efficiency with which a product can be successfully installed and/or uninstalled. Use containerization (Docker). Implement infrastructure as code (Terraform, CloudFormation). Automate deployment pipelines.
3. Replaceability — Degree to which a product can replace another specified product for the same purpose in the same environment. Use standard interfaces and protocols. Avoid vendor lock-in through abstraction layers.
Architectural implications: Containerize applications. Use 12-Factor App principles. Abstract cloud provider specific services behind interfaces. Use standard APIs. Implement database abstraction layers. Consider multi-cloud strategies for critical workloads.`,
    tags: ["portability", "containerization", "cloud-native", "vendor-lock-in", "twelve-factor", "docker", "kubernetes"],
    relevant_stages: [4, 5, 6, 9],
    source_url: "https://www.iso.org/standard/35733.html",
  },

  // ═══ Architecture Patterns ════════════════════════════════════════════════
  {
    framework: "patterns",
    category: "monolithic",
    title: "Monolithic Architecture — When and How",
    content: `A monolithic architecture is a single deployable unit containing all application functionality. 
WHEN TO USE: Small teams (2-8 developers), startups/MVPs, simple domain logic, tight deadlines, single deployment target, limited budget.
WHEN NOT TO USE: Large teams (10+), complex domain requiring independent scaling, need for technology diversity, high availability requirements (99.99%+).
STRENGTHS: Simple deployment pipeline, easy debugging and tracing, no network latency between components, simple transactions (ACID), low operational overhead, fast development velocity for small teams.
WEAKNESSES: Scaling limitations (must scale entire app), technology lock-in, long build/deploy cycles as app grows, single point of failure, difficult to onboard large teams, risk of "Big Ball of Mud" without discipline.
EVOLUTION PATH: Start modular monolith → extract high-traffic or independently-scaling modules → strangler fig pattern to microservices.
ANTI-PATTERNS TO AVOID: Distributed monolith (worst of both worlds), Big Ball of Mud (no internal structure), God classes/modules.
KEY METRICS: Deployment frequency, build time, team velocity, code coupling metrics (afferent/efferent coupling).`,
    tags: ["monolith", "monolithic", "simple", "mvp", "startup", "small-team"],
    relevant_stages: [4, 5, 6],
    source_url: null,
  },
  {
    framework: "patterns",
    category: "modular_monolith",
    title: "Modular Monolith Architecture — Best of Both Worlds",
    content: `A modular monolith is a single deployable unit with strictly enforced module boundaries. Each module owns its data and exposes a well-defined API.
WHEN TO USE: Medium teams (5-20), growing systems with clear domain boundaries, need for future extraction flexibility, when operational simplicity matters but modularity is required.
STRUCTURE: Each module has its own package/namespace with: public API (interface), internal implementation (hidden), own database schema (logical separation), own tests.
RULES: 1) Modules communicate ONLY through their public APIs, never direct DB access. 2) No circular dependencies between modules. 3) Shared kernel kept minimal. 4) Each module can be tested independently. 5) Module boundaries enforced by architectural fitness functions.
EVOLUTION: When a module needs independent scaling → extract to a service. The module boundary IS the service boundary. This makes extraction straightforward.
TECHNOLOGY: ArchUnit/NetArchTest for boundary enforcement. Module dependency graphs for visualization. Database schema-per-module for data isolation.`,
    tags: ["modular-monolith", "modularity", "domain-driven", "bounded-context", "medium-team"],
    relevant_stages: [4, 5, 6],
    source_url: null,
  },
  {
    framework: "patterns",
    category: "microservices",
    title: "Microservices Architecture — Distributed Systems",
    content: `Microservices decompose a system into small, independently deployable services, each owning its data and business capability.
WHEN TO USE: Large organizations (50+ developers), need for independent deployment and scaling, polyglot technology requirements, complex domain with clear bounded contexts, high availability requirements.
WHEN NOT TO USE: Small teams, simple domains, limited DevOps maturity, tight deadlines for MVP, when the team doesn't understand the domain well enough to draw boundaries.
PREREQUISITES: 1) Mature CI/CD pipeline. 2) Container orchestration (Kubernetes). 3) Service mesh or API gateway. 4) Distributed tracing and centralized logging. 5) Team per service ownership model.
CHALLENGES: Distributed transactions (use Saga pattern), data consistency (eventual consistency), service discovery, network latency, debugging complexity, operational overhead.
PATTERNS: API Gateway, Circuit Breaker, Saga (Choreography vs Orchestration), CQRS, Event Sourcing, Strangler Fig, Sidecar, Ambassador.
ANTI-PATTERNS: Distributed monolith, shared database between services, synchronous chains of calls, chatty services, nano-services (too fine-grained).
KEY METRICS: Service availability, inter-service latency p99, deployment independence score, mean time to recovery per service.`,
    tags: ["microservices", "distributed", "large-team", "bounded-context", "saga", "cqrs", "event-sourcing", "kubernetes"],
    relevant_stages: [4, 5, 6],
    source_url: null,
  },
  {
    framework: "patterns",
    category: "event_driven",
    title: "Event-Driven Architecture — Async Communication",
    content: `Event-driven architecture uses events to trigger and communicate between decoupled services.
PATTERNS:
1. Event Notification — Simple notification that something happened. Consumer decides what to do. Low coupling.
2. Event-Carried State Transfer — Events carry all data needed by consumers. Reduces queries but increases event size.
3. Event Sourcing — Store state as a sequence of events. Rebuild state by replaying events. Provides complete audit trail.
4. CQRS (Command Query Responsibility Segregation) — Separate read and write models. Write model optimized for consistency, read model optimized for queries.
WHEN TO USE: Systems requiring loose coupling, async processing, audit trails, complex event processing, systems with different read/write patterns.
TECHNOLOGIES: Message brokers (Kafka, RabbitMQ, AWS SQS/SNS), event stores, stream processing frameworks.
CHALLENGES: Event ordering, idempotency, eventual consistency, debugging event flows, schema evolution, dead letter queues.
BEST PRACTICES: Use schema registry for event contracts. Implement idempotent consumers. Design events as immutable facts. Use correlation IDs for tracing. Version events explicitly.`,
    tags: ["event-driven", "async", "messaging", "kafka", "cqrs", "event-sourcing", "saga", "eventual-consistency"],
    relevant_stages: [4, 5, 6, 7, 8],
    source_url: null,
  },
  {
    framework: "patterns",
    category: "layered",
    title: "Layered Architecture — Separation of Concerns",
    content: `Layered architecture organizes code into horizontal layers, each with a specific responsibility.
CLASSIC LAYERS: Presentation → Business Logic → Data Access → Database.
CLEAN ARCHITECTURE (Robert C. Martin): Entities (core) → Use Cases → Interface Adapters → Frameworks & Drivers. Dependencies point inward — inner layers know nothing about outer layers.
HEXAGONAL ARCHITECTURE (Alistair Cockburn): Domain core surrounded by ports (interfaces) and adapters (implementations). The domain has no dependencies on infrastructure.
ONION ARCHITECTURE: Similar to Clean Architecture with concentric rings: Domain Model → Domain Services → Application Services → Infrastructure.
WHEN TO USE: Traditional enterprise applications, CRUD-heavy systems, when team is familiar with layered patterns, systems with clear separation between UI, business logic, and data.
RULES: 1) Each layer only depends on the layer below it (strict) or any layer below it (relaxed). 2) No skipping layers in strict mode. 3) Interfaces define the contract between layers.
ANTI-PATTERNS: Anemic domain model (logic in services, not entities), leaky abstractions (DB concerns in business layer), god services that do everything.`,
    tags: ["layered", "clean-architecture", "hexagonal", "onion", "solid", "separation-of-concerns", "domain-driven"],
    relevant_stages: [4, 5, 6],
    source_url: null,
  },

  // ═══ TOGAF ═══════════════════════════════════════════════════════════════
  {
    framework: "togaf",
    category: "adm",
    title: "TOGAF Architecture Development Method (ADM)",
    content: `The TOGAF ADM provides a tested and repeatable process for developing architectures. Phases:
Phase A — Architecture Vision: Define scope, stakeholders, and high-level vision. Develop Architecture Vision document. Identify business goals and drivers.
Phase B — Business Architecture: Develop baseline and target business architecture. Gap analysis between current and target state. Model business processes and capabilities.
Phase C — Information Systems Architecture: Application Architecture (what applications are needed) and Data Architecture (what data entities exist). Define application interactions and data flows.
Phase D — Technology Architecture: Define technology platforms, infrastructure, and middleware. Map logical components to physical technologies.
Phase E — Opportunities and Solutions: Identify delivery vehicles (projects). Consolidate gaps across phases. Define transition architectures.
Phase F — Migration Planning: Develop implementation and migration plan. Prioritize projects. Define governance model.
Phase G — Implementation Governance: Provide architectural oversight during implementation. Ensure conformance to target architecture.
Phase H — Architecture Change Management: Monitor technology changes and business changes. Decide on architecture updates.
Requirements Management: Central to all phases. Continuously manage and validate requirements throughout the cycle.`,
    tags: ["togaf", "adm", "enterprise-architecture", "governance", "stakeholder", "gap-analysis"],
    relevant_stages: [2, 3, 4, 5, 6, 11, 12],
    source_url: "https://www.opengroup.org/togaf",
  },
  {
    framework: "togaf",
    category: "architecture_principles",
    title: "TOGAF Architecture Principles",
    content: `Architecture principles define the underlying general rules and guidelines for the use and deployment of all IT resources and assets across the enterprise.
BUSINESS PRINCIPLES:
1. Primacy of Principles — These principles apply to all organizations within the enterprise.
2. Maximize Benefit — Architecture decisions are made to maximize the benefit to the enterprise as a whole.
3. Information Management is Everybody's Business — All organizations participate in information management decisions.
DATA PRINCIPLES:
4. Data is an Asset — Data is an asset that has value and is managed accordingly.
5. Data is Shared — Users have access to the data necessary to perform their duties; therefore, data is shared across enterprise functions.
6. Data is Accessible — Data is accessible for users to perform their functions.
7. Data Trustee — Each data element has a trustee accountable for data quality.
APPLICATION PRINCIPLES:
8. Technology Independence — Applications are independent of specific technology choices and therefore can operate on a variety of platforms.
9. Ease of Use — Applications are easy to use. The underlying technology is transparent to users.
TECHNOLOGY PRINCIPLES:
10. Requirements-Based Change — Changes to applications and technology are based on business needs.
11. Responsive Change Management — Changes to the enterprise information environment are implemented in a timely manner.
12. Control Technical Diversity — Technical diversity is controlled to minimize the non-trivial cost of maintaining expertise in and connectivity between multiple processing environments.`,
    tags: ["togaf", "principles", "governance", "enterprise", "data-management", "technology-independence"],
    relevant_stages: [3, 4, 5, 11, 12],
    source_url: "https://www.opengroup.org/togaf",
  },

  // ═══ Data Architecture Patterns ═══════════════════════════════════════════
  {
    framework: "patterns",
    category: "data_architecture",
    title: "Data Architecture Patterns and Best Practices",
    content: `KEY PATTERNS:
1. Database per Service — Each microservice owns its data. No shared databases. Communication via APIs or events. Ensures loose coupling and independent scaling.
2. Shared Database — Multiple services share one database. Simple but creates tight coupling. Suitable for modular monoliths with schema-per-module.
3. CQRS — Separate read and write models. Write side uses normalized model. Read side uses denormalized views optimized for queries.
4. Event Sourcing — Store every state change as an immutable event. Reconstruct state by replaying events. Provides complete audit trail and temporal queries.
5. Saga Pattern — Manage distributed transactions across services. Choreography (events) or Orchestration (central coordinator). Each step has a compensating transaction.
DATA MODELING RULES:
- Identify aggregate roots (DDD) — they define consistency boundaries
- Use UUIDs for primary keys in distributed systems
- Always include created_at, updated_at timestamps
- Implement soft delete (deleted_at) for audit-sensitive data
- Use JSONB for flexible schemas, but index commonly queried fields
- Normalize to 3NF then selectively denormalize for performance
SECURITY: Row-Level Security (RLS) for multi-tenant data isolation. Field-level encryption for PII. Data classification (public, internal, confidential, restricted).`,
    tags: ["data-architecture", "cqrs", "event-sourcing", "saga", "aggregate-root", "ddd", "normalization", "rls", "multi-tenant"],
    relevant_stages: [7, 8, 9],
    source_url: null,
  },

  // ═══ API Design Best Practices ════════════════════════════════════════════
  {
    framework: "patterns",
    category: "api_design",
    title: "API Design Best Practices and Standards",
    content: `REST API DESIGN:
- Use nouns for resources, not verbs: /users, /orders, not /getUsers
- HTTP methods: GET (read), POST (create), PUT (full update), PATCH (partial update), DELETE
- Use plural nouns: /users not /user
- Nest related resources: /users/{id}/orders
- Use query parameters for filtering, sorting, pagination: ?status=active&sort=-created_at&page=2&limit=20
- Version APIs: /v1/users or Accept: application/vnd.api.v1+json
- Return appropriate HTTP status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Unprocessable Entity), 429 (Too Many Requests), 500 (Internal Server Error)
PAGINATION: Use cursor-based pagination for large datasets (more efficient than offset). Return next_cursor, has_more in response.
ERROR HANDLING: Consistent error response format with code, message, and details. Include request_id for tracing.
RATE LIMITING: Implement per-user and per-endpoint rate limits. Return X-RateLimit-* headers.
AUTHENTICATION: Use OAuth 2.0 + JWT. Short-lived access tokens (15 min). Refresh tokens for long sessions. API keys for server-to-server.
DOCUMENTATION: OpenAPI 3.0 specification. Auto-generate docs. Include examples for every endpoint.`,
    tags: ["api-design", "rest", "http", "pagination", "versioning", "authentication", "rate-limiting", "openapi"],
    relevant_stages: [8, 9],
    source_url: null,
  },

  // ═══ Risk Management ══════════════════════════════════════════════════════
  {
    framework: "patterns",
    category: "risk_management",
    title: "Architecture Risk Management Framework",
    content: `RISK IDENTIFICATION CATEGORIES:
1. Technical Risk — Technology immaturity, complexity, integration challenges, performance unknowns, scalability limits.
2. Operational Risk — Deployment complexity, monitoring gaps, incident response readiness, team skill gaps.
3. Security Risk — Authentication weaknesses, data exposure, injection vulnerabilities, supply chain attacks, insider threats.
4. Business Risk — Vendor lock-in, licensing costs, compliance requirements (GDPR, HIPAA, SOC2), market changes.
5. Project Risk — Schedule pressure, resource constraints, scope creep, requirements volatility.
RISK ASSESSMENT MATRIX:
- Probability: Rare (1) | Unlikely (2) | Possible (3) | Likely (4) | Almost Certain (5)
- Impact: Negligible (1) | Minor (2) | Moderate (3) | Major (4) | Catastrophic (5)
- Risk Score = Probability × Impact. Critical: 15-25, High: 10-14, Medium: 5-9, Low: 1-4
MITIGATION STRATEGIES:
- Avoid: Change approach to eliminate the risk entirely
- Mitigate: Reduce probability or impact through design decisions
- Transfer: Use insurance, SLAs, or third-party services
- Accept: Acknowledge and monitor with contingency plan
ARCHITECTURE-SPECIFIC RISKS:
- Single points of failure → Add redundancy
- Cascading failures → Circuit breakers, bulkheads
- Data loss → Backup strategy, replication
- Vendor lock-in → Abstraction layers
- Scaling bottlenecks → Load testing, capacity planning`,
    tags: ["risk", "risk-management", "mitigation", "security-risk", "technical-risk", "compliance", "gdpr", "hipaa"],
    relevant_stages: [5, 9, 10, 11],
    source_url: null,
  },

  // ═══ Architecture Decision Records ════════════════════════════════════════
  {
    framework: "patterns",
    category: "adr",
    title: "Architecture Decision Records (ADR) Best Practices",
    content: `An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences.
FORMAT (Michael Nygard):
- Title: Short noun phrase. E.g., "Use PostgreSQL for primary datastore"
- Status: Proposed | Accepted | Deprecated | Superseded
- Context: What is the issue motivating this decision? What forces are at play? Include technical, political, social, and project constraints.
- Decision: What is the change that we're proposing and/or doing? State it in full sentences with active voice. "We will..."
- Consequences: What becomes easier or more difficult to do because of this change? Both positive and negative.
ADDITIONAL SECTIONS (recommended):
- Alternatives Considered: What other options were evaluated? Why were they rejected?
- Rationale: Detailed reasoning for the decision
- Risks: What risks does this decision introduce?
- Compliance: How does this affect regulatory requirements?
BEST PRACTICES:
1. One ADR per decision. Keep them focused.
2. ADRs are immutable — never modify, only supersede with a new ADR
3. Number sequentially (ADR-001, ADR-002, etc.)
4. Link related ADRs (supersedes, relates-to)
5. Store in version control alongside code
6. Review ADRs quarterly — mark deprecated ones
7. Include stakeholder sign-off for significant decisions`,
    tags: ["adr", "decision-record", "documentation", "governance", "traceability"],
    relevant_stages: [5, 11, 12],
    source_url: null,
  },

  // ═══ Validation & Governance ══════════════════════════════════════════════
  {
    framework: "patterns",
    category: "validation",
    title: "Architecture Validation and Governance Checklist",
    content: `VALIDATION DIMENSIONS:
1. Requirement Traceability — Every requirement maps to at least one component, API endpoint, or data entity. No orphaned requirements. No gold-plating (features without requirements).
2. Consistency — Component interfaces match API contracts. Data models align with business entities. Error handling is consistent across all APIs.
3. Completeness — All quality attributes addressed. All integration points defined. All data flows documented. All failure modes considered.
4. Feasibility — Technology choices are mature enough. Team has required skills. Timeline is realistic. Budget covers infrastructure costs.
5. Conformance — Architecture follows stated principles. Patterns are applied consistently. Standards are met (security, accessibility, compliance).
GOVERNANCE GATES:
- Gate 1 (Requirements): All requirements classified, prioritized, and reviewed
- Gate 2 (Drivers): Architecture drivers extracted and validated against requirements
- Gate 3 (Style): Architecture style selected with evidence-based rationale
- Gate 4 (Design): Components, data, and APIs designed with traceability
- Gate 5 (Quality): Quality attributes evaluated with measurable targets
- Gate 6 (Risk): All high/critical risks have mitigation strategies
- Gate 7 (Documentation): ADRs complete, documentation comprehensive
ANTI-PATTERNS: Ivory tower architecture (no implementation input), architecture by committee (no clear decision-maker), big design up front without feedback loops.`,
    tags: ["validation", "governance", "traceability", "checklist", "gates", "review", "conformance"],
    relevant_stages: [11, 12],
    source_url: null,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Require admin role to seed the shared RAG knowledge base
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Check if already seeded
    const { count } = await supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return new Response(
        JSON.stringify({ message: `Knowledge base already seeded with ${count} chunks. Use ?force=true to reseed.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert all chunks
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .insert(KNOWLEDGE_CHUNKS)
      .select("id, title");

    if (error) {
      console.error("Seed error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Seeded ${data.length} knowledge chunks`,
        chunks: data.map((d: any) => d.title),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("seed-knowledge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
