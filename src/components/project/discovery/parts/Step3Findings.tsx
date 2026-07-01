import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Database,
  FileCode,
  FileText,
  GitCompare,
  Globe,
  Layers,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type JumpStage = 11 | 16 | 18;

interface Findings {
  endpoints: number;
  schemas: number;
  tables: number;
  components: number;
  requirements: number;
  adrs: number;
}

interface Props {
  parsedCount: number;
  hasParsed: boolean;
  findings: Findings;
  jumping: JumpStage | null;
  onJump: (stage: JumpStage) => void;
  onBack: () => void;
  onGoStep2: () => void;
}

export default function Step3Findings({
  parsedCount,
  hasParsed,
  findings,
  jumping,
  onJump,
  onBack,
  onGoStep2,
}: Props) {
  const tiles = [
    { icon: Globe, label: "Endpoints", val: findings.endpoints },
    { icon: Database, label: "DB tables", val: findings.tables },
    { icon: Layers, label: "Components", val: findings.components },
    { icon: FileText, label: "Requirements", val: findings.requirements },
    { icon: FileCode, label: "ADRs", val: findings.adrs },
    { icon: Activity, label: "Schemas", val: findings.schemas },
  ].filter((f) => f.val > 0);

  const jumps: Array<{ stage: JumpStage; icon: typeof GitCompare; title: string; desc: string }> = [
    { stage: 11, icon: GitCompare, title: "Gap Analysis", desc: "Where the as-is falls short" },
    { stage: 16, icon: TrendingUp, title: "Evolution Plan", desc: "Phased migration roadmap" },
    { stage: 18, icon: Activity, title: "Drift Detection", desc: "Live system vs. baseline" },
  ];

  return (
    <section className="rounded-xl border bg-card p-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <div className="mb-5">
        <h3 className="font-display text-base font-bold mb-1">
          Here's what we found in your legacy system
        </h3>
        <p className="text-xs text-muted-foreground">
          {parsedCount} file{parsedCount === 1 ? "" : "s"} parsed. Drafts are now sitting in the
          architecture stages — confirm them, or jump straight to the brownfield-only views below.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
        {tiles.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-lg border bg-gradient-to-br from-amber-500/5 to-transparent px-3 py-2.5"
            >
              <div className="h-8 w-8 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-display font-bold leading-none">{f.val}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{f.label}</p>
              </div>
            </div>
          );
        })}
        {!hasParsed && (
          <p className="col-span-full text-xs text-muted-foreground italic text-center py-4">
            Nothing parsed yet — go back to step 2.
          </p>
        )}
      </div>

      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
        Brownfield-only workspaces
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {jumps.map(({ stage, icon: Icon, title, desc }) => (
          <button
            key={stage}
            onClick={() => onJump(stage)}
            disabled={!hasParsed || jumping !== null}
            className={cn(
              "text-left rounded-lg border p-4 transition-all group",
              hasParsed
                ? "hover:border-amber-500/60 hover:bg-amber-500/5 hover:shadow-sm"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {jumping === stage ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              ) : (
                <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="text-sm font-bold">{title}</span>
              <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[11px] text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Add more files
        </Button>
        {!hasParsed && (
          <Button variant="outline" size="sm" onClick={onGoStep2}>
            Run AI reading first
          </Button>
        )}
      </div>
    </section>
  );
}
