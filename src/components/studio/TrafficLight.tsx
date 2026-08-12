import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export type Signal = "green" | "amber" | "red";

interface Props {
  signal: Signal;
  label: string;
  verdict: string;
  className?: string;
}

const MAP = {
  green: {
    ring: "border-emerald-500/40 bg-emerald-500/5",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  amber: {
    ring: "border-amber-500/40 bg-amber-500/5",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  red: {
    ring: "border-rose-500/40 bg-rose-500/5",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    Icon: XCircle,
  },
} as const;

export default function TrafficLight({ signal, label, verdict, className }: Props) {
  const m = MAP[signal];
  const { Icon } = m;
  return (
    <div className={cn("rounded-xl border p-3 flex items-start gap-3", m.ring, className)}>
      <div className="relative mt-0.5">
        <span className={cn("block h-2.5 w-2.5 rounded-full", m.dot)} />
        <span
          className={cn(
            "absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping opacity-40",
            m.dot,
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", m.text)} />
          <p className="text-xs font-semibold tracking-wide uppercase">{label}</p>
        </div>
        <p className="text-sm text-foreground/80 mt-0.5">{verdict}</p>
      </div>
    </div>
  );
}
