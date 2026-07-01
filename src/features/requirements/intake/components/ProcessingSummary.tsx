import { motion } from "framer-motion";
import {
  Sparkles,
  Target,
  Shield,
  Lock,
  HelpCircle,
  AlertTriangle,
  XCircle,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExtractedData } from "../types";

export function ProcessingSummary({ data }: { data: ExtractedData }) {
  const s = data.processing_summary;
  if (!s) return null;

  const items = [
    { label: "Functional", count: s.total_functional, icon: Target, color: "text-primary", bg: "bg-primary/10" },
    { label: "Non-Functional", count: s.total_non_functional, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Constraints", count: s.total_constraints, icon: Lock, color: "text-slate-500", bg: "bg-slate-500/10" },
    { label: "Assumptions", count: s.total_assumptions, icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Ambiguities", count: s.total_ambiguities, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Contradictions", count: s.total_contradictions, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Missing Info", count: s.total_missing, icon: EyeOff, color: "text-warning", bg: "bg-warning/10" },
  ];

  const confidenceColor =
    s.confidence_score === "high"
      ? "bg-success/20 text-success"
      : s.confidence_score === "medium"
        ? "bg-warning/20 text-warning"
        : "bg-destructive/20 text-destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-gradient-to-br from-card to-secondary/30 p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display font-bold text-base flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          Extraction Summary
        </h4>
        <Badge className={`text-[11px] px-2.5 py-1 ${confidenceColor}`}>
          {s.confidence_score} confidence
        </Badge>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {items
          .filter((i) => i.count > 0)
          .map((item) => (
            <div
              key={item.label}
              className={`text-center p-3 rounded-lg ${item.bg} border border-border/50`}
            >
              <item.icon className={`h-4 w-4 mx-auto mb-1.5 ${item.color}`} />
              <p className="text-xl font-bold">{item.count}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
            </div>
          ))}
      </div>
      {s.completeness_assessment && (
        <p className="text-xs text-muted-foreground leading-relaxed">{s.completeness_assessment}</p>
      )}
    </motion.div>
  );
}
