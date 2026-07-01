import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Sparkles, PenLine, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description: string;
  whatYouCanDo: string[];
  mode: "manual" | "ai" | "hybrid";
}

const MODE_META = {
  manual: { label: "Manual Input", icon: PenLine, color: "text-primary", bg: "bg-primary/8" },
  ai: {
    label: "AI-Generated",
    icon: Sparkles,
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/8",
  },
  hybrid: {
    label: "AI + Manual Review",
    icon: Sparkles,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/8",
  },
};

export default function StageIntro({ title, description, whatYouCanDo, mode }: Props) {
  const [open, setOpen] = useState(false);
  const m = MODE_META[mode];
  const ModeIcon = m.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-lg border border-border/60 bg-card/60 mb-6"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
      >
        <Info className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
        <span className="font-display text-sm font-semibold text-foreground">About this stage</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
            m.bg,
            m.color,
          )}
        >
          <ModeIcon className="h-3 w-3" />
          {m.label}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              <div className="border-t border-border/40 pt-3">
                <p className="text-xs font-display font-semibold text-foreground mb-1.5">
                  What you can do here:
                </p>
                <ul className="space-y-1">
                  {whatYouCanDo.map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
