import { motion } from "framer-motion";

const PHASES = [
  {
    label: "Requirement Definition",
    color: "bg-primary",
    accent: "border-primary/30",
    stages: [
      {
        num: 1,
        name: "Requirement Collection",
        desc: "Capture requirements from documents, free text, audio recordings with speaker diarization, or structured forms",
      },
      {
        num: 2,
        name: "Requirement Analysis",
        desc: "AI agents classify, prioritize, and identify conflicts and dependencies across requirements",
      },
      {
        num: 3,
        name: "Architecture Drivers",
        desc: "Extract quality attributes, constraints, and key architectural decisions from analyzed requirements",
      },
    ],
  },
  {
    label: "Architecture Design",
    color: "bg-success",
    accent: "border-success/30",
    stages: [
      {
        num: 4,
        name: "Style Selection",
        desc: "Compare architecture styles (microservices, monolith, modular monolith) with tradeoff analysis",
      },
      {
        num: 5,
        name: "Tradeoff Evaluation",
        desc: "Deep evaluation of selected styles against quality attributes and architecture drivers",
      },
      {
        num: 6,
        name: "System Decomposition",
        desc: "Break system into modules, services, and components with dependency maps and viewpoints",
      },
      {
        num: 7,
        name: "Data Architecture",
        desc: "Define entities, attributes, relationships, aggregates, and storage strategy per component",
      },
      {
        num: 8,
        name: "API & Integration",
        desc: "Design endpoints, contracts, integration patterns, and external system interfaces",
      },
      {
        num: 9,
        name: "Cross-Cutting Concerns",
        desc: "Address logging, security, caching, error handling, and observability across all components",
      },
      {
        num: 10,
        name: "Infrastructure & Deployment",
        desc: "Design deployment topology, CI/CD pipelines, environment tiers, and scaling strategies",
      },
    ],
  },
  {
    label: "Validation & Assurance",
    color: "bg-warning",
    accent: "border-warning/30",
    stages: [
      {
        num: 11,
        name: "Quality Attributes",
        desc: "Verify scalability, security, performance, and reliability targets against architecture decisions",
      },
      {
        num: 12,
        name: "Risk Assessment",
        desc: "Identify risks, assess impact and probability, define mitigations and contingency plans",
      },
      {
        num: 13,
        name: "Architecture Validation",
        desc: "Cross-check all artifacts for consistency, completeness, and requirement traceability",
      },
      {
        num: 14,
        name: "Documentation & ADRs",
        desc: "Generate Architecture Decision Records, executive summaries, and formal documentation",
      },
    ],
  },
  {
    label: "Delivery & Evolution",
    color: "bg-destructive",
    accent: "border-destructive/30",
    stages: [
      {
        num: 15,
        name: "Stakeholder Approval",
        desc: "Formal review and approval workflow with human-in-the-loop governance",
      },
      {
        num: 16,
        name: "Code Generation",
        desc: "Generate implementation-ready code that strictly follows the finalized architecture",
      },
      {
        num: 17,
        name: "Implementation Review",
        desc: "Verify generated code matches architecture boundaries and design contracts",
      },
      {
        num: 18,
        name: "Architecture Evolution",
        desc: "Track technical debt, plan improvements, and manage architecture version history",
      },
    ],
  },
];

export default function LifecycleSection() {
  return (
    <section id="lifecycle" className="py-24 bg-nav text-nav-foreground relative overflow-hidden">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container relative">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          className="text-center mb-20"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-nav-foreground/50 mb-6">
            End-to-End Governance
          </p>

          {/* Large numbers with labels — the hero statement */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-8">
            {[
              { number: "18", label: "Stages" },
              { number: "4", label: "Phases" },
              { number: "0", label: "Shortcuts" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.2 + i * 0.12,
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
                className="text-center"
              >
                <p className="text-6xl sm:text-7xl lg:text-8xl font-display font-bold tracking-tight leading-none text-gradient-brand">
                  {item.number}
                </p>
                <p className="text-xs sm:text-sm font-mono uppercase tracking-widest text-nav-foreground/50 mt-2">
                  {item.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Divider dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            <span className="h-1 w-1 rounded-full bg-primary" />
            <span className="h-1 w-8 rounded-full bg-primary/30" />
            <span className="h-1 w-1 rounded-full bg-primary" />
          </div>

          <p className="text-nav-foreground/60 max-w-xl mx-auto text-sm leading-relaxed">
            Every software architecture decision follows a disciplined path — from raw requirements
            to production code — with AI agents, verification, and governance at every step.
          </p>
        </motion.div>

        {/* Phase timeline */}
        <div className="space-y-10">
          {PHASES.map((phase, pi) => (
            <motion.div
              key={phase.label}
              initial={{ opacity: 0, x: pi % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: pi * 0.08, ease: [0.16, 1, 0.3, 1] as const }}
            >
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`h-3 w-3 rounded-sm ${phase.color} shadow-sm`} />
                <span className="text-sm font-display font-semibold uppercase tracking-widest text-nav-foreground/80">
                  Phase {pi + 1}: {phase.label}
                </span>
                <span className="h-px flex-1 bg-nav-foreground/10" />
                <span className="text-[10px] font-mono text-nav-foreground/40">
                  {phase.stages.length} stages
                </span>
              </div>

              {/* Stage cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {phase.stages.map((s) => (
                  <div
                    key={s.num}
                    className={`relative flex gap-3 p-4 rounded-lg border ${phase.accent} bg-nav-foreground/[0.03] hover:bg-nav-foreground/[0.07] transition-all duration-200 group hover:-translate-y-0.5`}
                  >
                    {/* Number */}
                    <span className="text-3xl font-display font-bold text-nav-foreground/50 absolute top-3 right-3 leading-none select-none group-hover:text-nav-foreground/70 transition-colors">
                      {String(s.num).padStart(2, "0")}
                    </span>

                    <div className="pr-8">
                      <p className="text-sm font-display font-semibold mb-1 group-hover:text-primary transition-colors">
                        {s.name}
                      </p>
                      <p className="text-xs text-nav-foreground/50 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
