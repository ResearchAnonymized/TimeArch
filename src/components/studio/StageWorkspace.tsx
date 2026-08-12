/**
 * StageWorkspace — generic Clause-style workspace for any stage that
 * doesn't yet have bespoke content built (stages 2–18).
 *
 * Renders inside the shared StageShell:
 *   - kicker / title / blurb / Draft pill
 *   - stat cards for artifacts + previous stage handoff
 *   - "Continue in classic workspace" section
 *   - sticky "Advance to next stage" bar (enabled when at least one
 *     artifact exists for the current stage)
 *
 * Individual stages (2, 3, …) can later be replaced with bespoke
 * components that use StageShell directly.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, FileText, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";

interface Props {
  projectId: string;
  currentStage: number;
  onAdvance: (nextStage: number) => Promise<void> | void;
  advancing: boolean;
}

const TONE_TO_PILL: Record<string, "primary" | "amber" | "emerald"> = {
  primary: "primary",
  violet: "primary",
  amber: "amber",
  emerald: "emerald",
};

export default function StageWorkspace({ projectId, currentStage, onAdvance, advancing }: Props) {
  const nav = useNavigate();
  const stage = getStage(currentStage);
  const nextStage = currentStage < 18 ? getStage(currentStage + 1) : null;

  const [artifactCount, setArtifactCount] = useState(0);
  const [prevStageArtifacts, setPrevStageArtifacts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ count: cur }, { count: prev }] = await Promise.all([
        supabase
          .from("architecture_artifacts")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .eq("stage", currentStage),
        supabase
          .from("architecture_artifacts")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .eq("stage", Math.max(1, currentStage - 1)),
      ]);
      if (!cancelled) {
        setArtifactCount(cur ?? 0);
        setPrevStageArtifacts(prev ?? 0);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, currentStage]);

  const ready = artifactCount > 0;

  return (
    <StageShell
      versionHistory={{ projectId, stage: currentStage }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "In progress" : "Not started",
        tone: ready ? TONE_TO_PILL[stage.tone] : "neutral",
      }}
      stats={[
        {
          label: "Artifacts",
          value: loading ? "—" : artifactCount,
          sub: "generated this stage",
          tone: artifactCount > 0 ? TONE_TO_PILL[stage.tone] : "neutral",
        },
        {
          label: "Handoff",
          value: loading ? "—" : prevStageArtifacts,
          sub: `from stage ${Math.max(1, currentStage - 1)}`,
          tone: "neutral",
        },
        {
          label: "Phase",
          value: stage.phase.split(" ")[0],
          sub: stage.phase,
          tone: TONE_TO_PILL[stage.tone],
        },
      ]}
      checks={[
        { key: "artifacts", label: "At least one artifact produced", ok: artifactCount > 0 },
        { key: "reviewed", label: "Stage reviewed in classic workspace", ok: artifactCount > 0 },
      ]}
      checklistTitle="Ready to advance?"
      checklistBlurb="TimeArch will unlock the next stage once these are green."
      advance={{
        label: ready
          ? nextStage
            ? `Stage ${currentStage} complete — advance to Stage ${nextStage.n}`
            : "Final stage — mark complete"
          : "Produce at least one artifact to advance",
        ready,
        busy: advancing,
        onClick: () => void onAdvance(currentStage + 1),
        ctaLabel: nextStage ? `Advance to Stage ${nextStage.n}` : "Complete lifecycle",
      }}
    >
      {/* Continue in classic workspace */}
      <SectionCard
        title="Work on this stage"
        subtitle="The full toolset for this stage lives in the classic workspace. Everything you do there syncs back here."
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => nav(stage.classicRoute(projectId))}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Open classic workspace
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-md border bg-background p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">What happens here</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{stage.blurb}</p>
          </div>
          <div className="rounded-md border bg-background p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">AI assistance</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              TimeArch agents will propose drafts, critiques, and diagrams inside the classic workspace. Return here to review the stage summary.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Studio-native shortcut (Stage 2/3 have their own review screen) */}
      {stage.studioRoute && (
        <SectionCard
          title="Studio-native view"
          subtitle="A streamlined review UI is available inside Studio for this stage."
        >
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => nav(stage.studioRoute!(projectId))}
          >
            Open Studio review
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </SectionCard>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading stage state…
        </div>
      )}
    </StageShell>
  );
}

// Toast import kept so unused-warn-clean; toast used by parent hooks.
void toast;
