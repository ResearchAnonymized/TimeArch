import { Cpu, Shield, GitBranch, Lock, FileCode, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  {
    icon: Cpu,
    title: "18 Specialized AI Agents",
    description:
      "Each stage is powered by a purpose-built agent — from requirement parsing and audio diarization to code generation and architecture evolution.",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: Shield,
    title: "RAG-Grounded in Standards",
    description:
      "Recommendations cite ISO 25010, AWS Well-Architected, TOGAF, and SEI ADD 3.0. Agents retrieve relevant knowledge before generating output.",
    accent: "bg-emerald-500/10 text-emerald-500",
  },
  {
    icon: GitBranch,
    title: "Evaluator Architect Agent",
    description:
      "A dedicated adversarial agent challenges every recommendation — identifying blind spots, alternatives, and risk scenarios before approval.",
    accent: "bg-violet-500/10 text-violet-500",
  },
  {
    icon: Lock,
    title: "Governance & Approval",
    description:
      "Architecture must be reviewed and formally approved before code generation begins. Locking prevents unauthorized changes to finalized decisions.",
    accent: "bg-amber-500/10 text-amber-500",
  },
  {
    icon: FileCode,
    title: "Schema-Validated Outputs",
    description:
      "Every agent output is validated against JSON schemas with a rules engine checking consistency, completeness, and architectural constraints.",
    accent: "bg-rose-500/10 text-rose-500",
  },
  {
    icon: BarChart3,
    title: "Professional Documents",
    description:
      "Generate SRS, SAD, and Architecture Assessment Reports as PDF & DOCX — with embedded diagrams, ready for audits and compliance reviews.",
    accent: "bg-cyan-500/10 text-cyan-500",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Platform Capabilities
          </p>
          <h2
            className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4"
            style={{ textWrap: "balance" }}
          >
            Built for Architects Who Need Rigor
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            Not a diagram tool. Not a chatbot. A governed platform that follows professional
            software architecture methodology at every step.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="group relative p-6 rounded-xl border bg-card hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Gradient top line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div
                className={`h-12 w-12 rounded-xl ${f.accent} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
