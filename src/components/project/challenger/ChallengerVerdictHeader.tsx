import { Swords, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { HelpTip } from "../HelpTip";
import { getVerdictMeta } from "./challengerHelpers";
import ChallengerLockControls from "./ChallengerLockControls";

interface Props {
  cycle: number;
  decidedCount: number;
  totalConcerns: number;
  acceptedCount: number;
  reviewMeta: any;
  projectId?: string;
  stage?: number;
  refreshKey?: number;
  onAdvance?: (nextStage: number) => void;
}

function ConfidenceRing({ value, tone }: { value: number; tone: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative h-12 w-12 flex-shrink-0">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} className="stroke-muted fill-none" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          className={cn("fill-none transition-all", tone)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
        {Math.round(value)}
      </div>
    </div>
  );
}

export default function ChallengerVerdictHeader({
  cycle,
  decidedCount,
  totalConcerns,
  acceptedCount,
  reviewMeta,
  projectId,
  stage,
  refreshKey,
  onAdvance,
}: Props) {
  const verdict = getVerdictMeta(reviewMeta?.verdict);
  const confidence = reviewMeta?.confidence ?? reviewMeta?.overall_score ?? null;
  const summary = reviewMeta?.summary || reviewMeta?.final_assessment;
  const progress = totalConcerns > 0 ? (decidedCount / totalConcerns) * 100 : 0;

  return (
    <header className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 via-background to-transparent">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Swords className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-display font-semibold flex items-center gap-1.5">
                Challenger Architect Review
                <HelpTip text="Independent peer review grounded in ISO/IEC 25010 + ATAM. Decide on each concern; accepted/modified ones feed back to the Generator. Max 2 refinement cycles." />
              </h3>
              <Badge variant="outline" className={cn("text-[10px] border", verdict.tone)}>
                {verdict.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Human-in-the-loop
              </Badge>
            </div>
            {summary && (
              <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2">
                {summary}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[10.5px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Cycle {cycle} of 2
              </span>
              <span>•</span>
              <span>
                {decidedCount}/{totalConcerns} decided
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-success" /> {acceptedCount} to apply
              </span>
            </div>
          </div>
        </div>

        {confidence !== null && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                Confidence
              </div>
              <div className={cn("text-[10.5px] font-medium", verdict.tone)}>{verdict.label}</div>
            </div>
            <ConfidenceRing value={confidence} tone={verdict.ringClass} />
          </div>
        )}

        {projectId && stage !== undefined && (
          <div className="flex-shrink-0">
            <ChallengerLockControls
              projectId={projectId}
              stage={stage}
              refreshKey={refreshKey}
              onAdvance={onAdvance}
              totalConcerns={totalConcerns}
              decidedCount={decidedCount}
            />
          </div>
        )}
      </div>
      <div className="mt-2.5">
        <Progress value={progress} className="h-1" />
      </div>
    </header>
  );
}
