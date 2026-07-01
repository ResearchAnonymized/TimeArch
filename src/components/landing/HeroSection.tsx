import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/timearch-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: i * 0.14, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="pt-24 pb-20 relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Animated background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-background to-background" />

      {/* Floating glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-subtle" />
      <div
        className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px] animate-pulse-subtle"
        style={{ animationDelay: "1s" }}
      />

      <div className="container relative">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
        >
          {/* Large standalone logo */}
          <motion.div variants={fadeUp} custom={0} className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-[40px] scale-150" />
              <img
                src={logoImg}
                alt="TimeArch"
                className="relative h-24 w-24 sm:h-28 sm:w-28 object-contain drop-shadow-lg"
                width={112}
                height={112}
              />
            </div>
          </motion.div>

          {/* Beta badge */}
          <motion.div variants={fadeUp} custom={0.5} className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card/60 backdrop-blur-sm shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-subtle" />
              <span className="text-[10px] font-mono font-medium tracking-wider uppercase text-muted-foreground">
                Multi-Agent Architecture Platform
              </span>
              <span className="text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                Beta
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight leading-[1.05] mb-6"
            style={{ textWrap: "balance" }}
          >
            Transform Requirements into{" "}
            <span className="text-gradient-brand relative">
              Verified Architecture
              <svg
                className="absolute -bottom-2 left-0 w-full h-3 text-primary/30"
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 8 Q75 0 150 8 Q225 16 300 8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            style={{ textWrap: "pretty" }}
          >
            18 specialized AI agents. 4 governed phases. Grounded in ISO 25010, AWS
            Well-Architected, and SEI ADD 3.0 — production code only after review, validation, and
            approval.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 w-full sm:w-auto active:scale-[0.97] transition-transform text-base px-8 py-6 shadow-lg shadow-primary/20"
            >
              Start Your First Project <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="hero-outline"
              size="lg"
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="gap-2 w-full sm:w-auto active:scale-[0.97] transition-transform text-base px-8 py-6"
            >
              <Play className="h-3.5 w-3.5" /> See How It Works
            </Button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={fadeUp}
            custom={4}
            className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
          >
            {[
              { value: "18", label: "AI Agents" },
              { value: "4", label: "Governed Phases" },
              { value: "100%", label: "Traceable" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-display font-bold text-gradient-brand">{stat.value}</p>
                <p className="text-xs font-mono text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Trust signals */}
          <motion.div
            variants={fadeUp}
            custom={5}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground font-mono"
          >
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border">
              <span className="h-2 w-2 rounded-full bg-success" /> RAG-Grounded
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border">
              <span className="h-2 w-2 rounded-full bg-primary" /> Schema-Validated
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border">
              <span className="h-2 w-2 rounded-full bg-warning" /> Multi-Agent Verified
            </span>
          </motion.div>

          {/* Experimental disclaimer */}
          <motion.p
            variants={fadeUp}
            custom={6}
            className="mt-6 text-[10px] text-muted-foreground/60 max-w-md mx-auto"
          >
            ⚠ Experimental version — for evaluation, research, and educational purposes only. Not
            intended for commercial use.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
