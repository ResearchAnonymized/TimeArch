/**
 * Brownfield Discovery workspace — orchestrator only.
 *
 * Pulls data + actions from `@/features/discovery/hooks` and dispatches to
 * three presentational step components. All Supabase calls live in
 * `discoveryService`; this file stays UI-only.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDiscoveryImports,
  useDiscoveryStep,
  useRemotePresets,
  useReturningUser,
  useSeededPreset,
} from "@/features/discovery/hooks";
import { discoveryService } from "@/services/discoveryService";
import { errorOf } from "@/lib/result";
import { createLogger } from "@/lib/logger";
import DiscoveryToolbar from "./parts/DiscoveryToolbar";
import DiscoveryHero from "./parts/DiscoveryHero";
import StepRail from "./parts/StepRail";
import Step1Upload from "./parts/Step1Upload";
import Step2Reverse from "./parts/Step2Reverse";
import Step3Findings from "./parts/Step3Findings";

const log = createLogger("DiscoveryWorkspace");

interface Props {
  projectId: string;
  onJumpToStage?: (stage: number) => void;
}

export default function DiscoveryWorkspace({ projectId, onJumpToStage }: Props) {
  const { user } = useAuth();
  const { step, setStep } = useDiscoveryStep(projectId);
  const seededPreset = useSeededPreset(projectId);
  const remotePresets = useRemotePresets();
  const [jumping, setJumping] = useState<11 | 16 | 18 | null>(null);

  const data = useDiscoveryImports({
    projectId,
    userId: user?.id,
    onParsed: useCallback(() => setStep(3), [setStep]),
    onAllUploaded: useCallback(() => {
      // After files land, advance to Step 2 if still on Step 1.
      if (step === 1) setStep(2);
    }, [step, setStep]),
  });

  const { isReturning, dismissReturning } = useReturningUser(
    projectId,
    data.loading,
    data.imports.length,
  );

  // Auto-advance step based on data state
  useEffect(() => {
    if (data.loading) return;
    if (data.hasParsed && step === 1) setStep(3);
    else if (data.hasImports && step === 1 && !data.hasParsed) setStep(2);
  }, [data.loading, data.hasParsed, data.hasImports, step, setStep]);

  const handleJump = async (stage: 11 | 16 | 18) => {
    setJumping(stage);
    try {
      if (stage === 11) {
        const gaps = await discoveryService.analyzeGaps({ project_id: projectId });
        if (!gaps.ok) log.warn("gap-analyzer failed", errorOf(gaps));
      } else if (stage === 18) {
        toast.info("Running Drift Detection…");
        const drift = await discoveryService.detectDrift({ project_id: projectId });
        if (!drift.ok) log.warn("drift-detect failed", errorOf(drift));
      }
      onJumpToStage?.(stage);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
      onJumpToStage?.(stage);
    } finally {
      setJumping(null);
    }
  };

  const handleRestart = () => {
    if (
      !confirm(
        "Start over from Step 1? Your uploaded files stay — only the wizard position resets.",
      )
    )
      return;
    setStep(1);
    dismissReturning();
  };

  // Overall pipeline progress: 0 = empty, 33 = files in, 66 = parsed, 100 = jumped/explored
  const pipelinePct = data.hasParsed
    ? step === 3
      ? 100
      : 75
    : data.hasImports
      ? data.reversing
        ? 50
        : 33
      : 0;
  const pipelineLabel = !data.hasImports
    ? "Step 1 — bring in files"
    : !data.hasParsed
      ? data.reversing
        ? "AI is reading your files…"
        : "Files in. Run AI reading next."
      : step === 3
        ? "Baseline artifacts generated — explore findings"
        : "AI finished. Step 3 unlocked.";

  return (
    <div className="space-y-5">
      <DiscoveryToolbar
        step={step}
        hasImports={data.hasImports}
        lastActivity={data.lastActivity}
        onRestart={handleRestart}
        onPersist={() => {
          try {
            window.localStorage.setItem(`timearch.discovery.step.${projectId}`, String(step));
          } catch {
            /* ignore */
          }
        }}
      />

      <DiscoveryHero
        hasImports={data.hasImports}
        hasParsed={data.hasParsed}
        reversing={data.reversing}
        loadingDemo={data.loadingDemo}
        showOneClickDemo={!data.hasImports && !seededPreset}
        pipelinePct={pipelinePct}
        pipelineLabel={pipelineLabel}
        isReturning={isReturning}
        importCount={data.imports.length}
        step={step}
        lastActivity={data.lastActivity}
        onOneClickDemo={() => data.loadDemoPack(true)}
        onDismissReturning={dismissReturning}
      />

      <StepRail
        step={step}
        hasImports={data.hasImports}
        hasParsed={data.hasParsed}
        onSelect={setStep}
      />

      {step === 1 && (
        <Step1Upload
          imports={data.imports}
          uploading={data.uploading}
          reversing={data.reversing}
          loadingDemo={data.loadingDemo}
          hasImports={data.hasImports}
          seededPreset={seededPreset}
          remotePresets={remotePresets}
          onFiles={data.handleFiles}
          onLoadDemoPack={() => data.loadDemoPack(true)}
          onLoadRemotePreset={(p) => data.loadRemotePreset(p, true)}
          onDelete={data.deleteImport}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2Reverse
          importCount={data.imports.length}
          reversing={data.reversing}
          hasImports={data.hasImports}
          hasParsed={data.hasParsed}
          onRun={(reprocess) => data.runReverseEngineer(reprocess)}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3Findings
          parsedCount={data.parsedCount}
          hasParsed={data.hasParsed}
          findings={data.findings}
          jumping={jumping}
          onJump={handleJump}
          onBack={() => setStep(1)}
          onGoStep2={() => setStep(2)}
        />
      )}
    </div>
  );
}
