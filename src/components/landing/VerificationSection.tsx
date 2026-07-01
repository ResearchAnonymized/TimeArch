import { motion } from "framer-motion";
import { BookOpen, ShieldCheck, Scale, Cog } from "lucide-react";

const PILLARS = [
  {
    icon: BookOpen,
    title: "RAG Knowledge Base",
    desc: "Every agent retrieves relevant knowledge from ISO 25010, AWS Well-Architected, TOGAF, and established architecture patterns before generating recommendations.",
    tag: "Grounding",
    num: "01",
  },
  {
    icon: Cog,
    title: "Schema Validation",
    desc: "All agent outputs validated against strict JSON schemas. A rules engine checks for missing fields, inconsistencies, and constraint violations.",
    tag: "Validation",
    num: "02",
  },
  {
    icon: Scale,
    title: "Evaluator Architect",
    desc: "A dedicated adversarial agent reviews every recommendation, presenting counter-arguments, alternatives, and risk scenarios.",
    tag: "Challenge",
    num: "03",
  },
  {
    icon: ShieldCheck,
    title: "Human Governance",
    desc: "Architecture decisions require human review and formal approval before code generation. Locking prevents drift between design and implementation.",
    tag: "Control",
    num: "04",
  },
];

export default function VerificationSection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Anti-Hallucination Pipeline
          </p>
          <h2
            className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4"
            style={{ textWrap: "balance" }}
          >
            Four Layers of Verification
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            AI-generated architecture is only as good as its verification. TimeArch combines RAG,
            schema validation, adversarial review, and human governance.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative p-6 rounded-xl border bg-card group hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              {/* Number watermark */}
              <span className="absolute top-4 right-4 text-7xl font-display font-bold leading-none select-none text-primary/50 dark:text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]">
                {p.num}
              </span>

              <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-primary/70 bg-primary/8 px-2.5 py-1 rounded-md mb-4">
                {p.tag}
              </span>
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <p.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
