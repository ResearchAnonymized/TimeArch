import { motion } from "framer-motion";
import {
  Upload,
  MessageSquareText,
  Mic,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

export function InputMethodSelector({ onSelect }: { onSelect: (method: string) => void }) {
  const methods = [
    {
      id: "document",
      icon: Upload,
      label: "Upload Document",
      description: "Paste SRS, BRD, RFP, or specification documents",
      gradient: "from-primary/10 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
    },
    {
      id: "freetext",
      icon: MessageSquareText,
      label: "Describe System",
      description: "Describe your system in natural language",
      gradient: "from-violet-500/10 to-violet-500/5",
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      id: "audio",
      icon: Mic,
      label: "Audio Discussion",
      description: "Record a meeting or upload audio/transcript",
      gradient: "from-amber-500/10 to-amber-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "structured",
      icon: ClipboardList,
      label: "Manual Form",
      description: "Add individual requirements via structured form",
      gradient: "from-emerald-500/10 to-emerald-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {methods.map((m) => (
        <motion.button
          key={m.id}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(m.id)}
          className={`relative group p-5 rounded-xl border border-border/60 bg-gradient-to-br ${m.gradient} text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5`}
        >
          <div className={`h-10 w-10 rounded-xl ${m.iconBg} flex items-center justify-center mb-3`}>
            <m.icon className={`h-5 w-5 ${m.iconColor}`} />
          </div>
          <h4 className="font-display font-bold text-sm mb-1">{m.label}</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{m.description}</p>
          <ArrowRight className="absolute top-5 right-4 h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
        </motion.button>
      ))}
    </div>
  );
}
