import { motion } from "framer-motion";
import { FileText, Cpu, ShieldCheck, Lock, Code, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: FileText,
    num: "01",
    title: "Define",
    subtitle: "Requirements",
    desc: "Paste user stories, upload specs, or record audio. AI agents parse, classify, and extract architecture drivers.",
    color: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: Cpu,
    num: "02",
    title: "Design",
    subtitle: "Architecture",
    desc: "18 specialized agents analyze, decompose, and design data models, APIs, and infrastructure.",
    color: "from-violet-500/20 to-violet-500/5",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: ShieldCheck,
    num: "03",
    title: "Validate",
    subtitle: "& Assure",
    desc: "Quality evaluation, risk assessment, and schema validation with the Evaluator Architect agent.",
    color: "from-amber-500/20 to-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: Lock,
    num: "04",
    title: "Govern",
    subtitle: "& Approve",
    desc: "Review ADRs, lock stages, or run the full Autonomous Pipeline across all 18 stages.",
    color: "from-emerald-500/20 to-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: Code,
    num: "05",
    title: "Deliver",
    subtitle: "& Evolve",
    desc: "Generate code, validate against architecture boundaries, and track evolution over time.",
    color: "from-rose-500/20 to-rose-500/5",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/40">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Getting Started
          </p>
          <h2
            className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4"
            style={{ textWrap: "balance" }}
          >
            From Idea to Production in 5 Steps
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            A clear, governed workflow — AI does the heavy lifting, humans keep control.
          </p>
        </motion.div>

        {/* Horizontal steps */}
        <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-0">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex items-stretch"
            >
              <div
                className={`relative flex-1 rounded-xl border bg-gradient-to-b ${step.color} p-6 flex flex-col items-center text-center group hover:shadow-lg hover:scale-[1.02] transition-all duration-300`}
              >
                {/* Step number */}
                <span className="text-[10px] font-mono font-bold text-muted-foreground/50 mb-3">
                  STEP {step.num}
                </span>

                {/* Icon */}
                <div
                  className={`h-14 w-14 rounded-2xl ${step.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <step.icon className={`h-7 w-7 ${step.iconColor}`} />
                </div>

                {/* Title */}
                <h3 className="font-display font-bold text-lg leading-tight mb-1">{step.title}</h3>
                <p className="text-xs font-mono text-muted-foreground mb-3">{step.subtitle}</p>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>

              {/* Arrow connector (desktop only) */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:flex items-center px-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
