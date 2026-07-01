import { motion } from "framer-motion";
import { Building2, GraduationCap, Users } from "lucide-react";

const CASES = [
  {
    icon: Building2,
    title: "Enterprise Architecture Teams",
    desc: "Replace ad-hoc architecture reviews with a governed, auditable process. Generate compliance-ready documentation automatically.",
    gradient: "from-primary/10 to-violet-500/10",
  },
  {
    icon: GraduationCap,
    title: "Software Architecture Education",
    desc: "Teach architecture methodology hands-on. Students walk the full lifecycle, seeing how requirements map to decisions and code.",
    gradient: "from-amber-500/10 to-emerald-500/10",
  },
  {
    icon: Users,
    title: "Startup Technical Leads",
    desc: "Make defensible architecture choices early, grounded in industry standards. Avoid costly rewrites by validating before writing code.",
    gradient: "from-rose-500/10 to-primary/10",
  },
];

export default function UseCasesSection() {
  return (
    <section className="py-24 bg-secondary/40">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Who It's For
          </p>
          <h2
            className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4"
            style={{ textWrap: "balance" }}
          >
            Architecture Governance for Every Team
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {CASES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`group p-6 rounded-xl border bg-gradient-to-br ${c.gradient} hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
            >
              <div className="h-12 w-12 rounded-xl bg-card/80 border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <c.icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
