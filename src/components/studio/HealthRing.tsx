import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  /** 0..100 */
  score: number;
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

/**
 * Cinematic gauge — one number, one color, one meaning.
 * Green ≥ 80, amber 55-79, red < 55.
 */
export default function HealthRing({ score, size = 160, label, sublabel, className }: Props) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;

  const tone =
    s >= 80
      ? { ring: "text-emerald-500", grad: ["#10b981", "#34d399"], word: "Ready" }
      : s >= 55
        ? { ring: "text-amber-500", grad: ["#f59e0b", "#fbbf24"], word: "Almost" }
        : { ring: "text-rose-500", grad: ["#f43f5e", "#fb7185"], word: "Not yet" };

  const gradId = `hr-grad-${label ?? "x"}-${size}`;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tone.grad[0]} />
              <stop offset="100%" stopColor={tone.grad[1]} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted opacity-30"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - dash }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn("text-4xl font-display font-bold leading-none", tone.ring)}
          >
            {s}
          </motion.span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {tone.word}
          </span>
        </div>
      </div>
      {label && <p className="text-sm font-medium">{label}</p>}
      {sublabel && <p className="text-xs text-muted-foreground -mt-1">{sublabel}</p>}
    </div>
  );
}
