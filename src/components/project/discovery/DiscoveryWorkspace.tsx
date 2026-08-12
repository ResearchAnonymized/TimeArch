/**
 * Brownfield Discovery — end-to-end:
 *   Import → Recover → Change
 * Change work: Current features | Propose changes | Review package
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDiscoveryImports,
  useDiscoveryStep,
  useRemotePresets,
} from "@/features/discovery/hooks";
import { useSystemInventory } from "@/features/discovery/useSystemInventory";
import DiscoveryToolbar from "./parts/DiscoveryToolbar";
import type { BrownfieldMode } from "./parts/ModeToggle";
import StepRail, { type ChangeTab } from "./parts/StepRail";
import Step1Upload from "./parts/Step1Upload";
import Step2Reverse from "./parts/Step2Reverse";
import SimpleChangeFlow from "./SimpleChangeFlow";
import SystemInventoryPanel from "./SystemInventoryPanel";

interface Props {
  projectId: string;
  onJumpToStage?: (stage: number) => void;
  step?: 1 | 2 | 3;
  onStepChange?: (n: 1 | 2 | 3) => void;
  onProgress?: (p: { hasImports: boolean; hasParsed: boolean }) => void;
  hideInlineStepRail?: boolean;
}

const MODE_KEY = (projectId: string) => `timearch.brownfield.mode.${projectId}`;
const STEP3_TAB_KEY = (projectId: string) => `timearch.brownfield.step3.${projectId}`;

type Step3Tab = ChangeTab;

function readMode(projectId: string): BrownfieldMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY(projectId));
    if (v === "live" || v === "demo") return v;
  } catch {
    /* ignore */
  }
  return "demo";
}

function readStep3Tab(projectId: string): Step3Tab {
  try {
    const v = window.localStorage.getItem(STEP3_TAB_KEY(projectId));
    if (v === "propose" || v === "recovered" || v === "revision") return v;
  } catch {
    /* ignore */
  }
  return "recovered";
}

export default function DiscoveryWorkspace({
  projectId,
  step: controlledStep,
  onStepChange,
  onProgress,
  hideInlineStepRail,
}: Props) {
  const { user } = useAuth();
  const internalStep = useDiscoveryStep(projectId);
  const step = controlledStep ?? internalStep.step;
  const setStep = onStepChange ?? internalStep.setStep;
  const remotePresets = useRemotePresets();
  const [mode, setMode] = useState<BrownfieldMode>(() => readMode(projectId));
  const [step3Tab, setStep3Tab] = useState<Step3Tab>(() => readStep3Tab(projectId));
  const didInitialRoute = useRef(false);

  const inventoryState = useSystemInventory(projectId, true);

  const data = useDiscoveryImports({
    projectId,
    userId: user?.id,
    onParsed: useCallback(() => {
      setStep(3);
      setStep3Tab("recovered");
      void inventoryState.reload();
    }, [setStep, inventoryState.reload]),
    onAllUploaded: useCallback(() => {
      if (step === 1) setStep(2);
    }, [step, setStep]),
  });

  useEffect(() => {
    if (data.hasParsed) void inventoryState.reload();
  }, [data.hasParsed, data.parsedCount, inventoryState.reload]);

  useEffect(() => {
    onProgress?.({ hasImports: data.hasImports, hasParsed: data.hasParsed });
  }, [data.hasImports, data.hasParsed, onProgress]);

  useEffect(() => {
    if (data.loading || didInitialRoute.current) return;
    didInitialRoute.current = true;
    if (data.hasParsed && step < 3) setStep(3);
    else if (data.hasImports && !data.hasParsed && step === 1) setStep(2);
  }, [data.loading, data.hasParsed, data.hasImports, step, setStep]);

  const handleModeChange = (next: BrownfieldMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY(projectId), next);
    } catch {
      /* ignore */
    }
  };

  const handleStep3Tab = (tab: Step3Tab) => {
    setStep3Tab(tab);
    try {
      window.localStorage.setItem(STEP3_TAB_KEY(projectId), tab);
    } catch {
      /* ignore */
    }
  };

  const handleSelectStep = (n: 1 | 2 | 3) => {
    setStep(n);
  };

  const handleRestart = () => {
    if (!confirm("Start over from Import? Uploaded files stay.")) return;
    setStep(1);
  };

  const persist = () => {
    try {
      window.localStorage.setItem(`timearch.discovery.step.${projectId}`, String(step));
    } catch {
      /* ignore */
    }
  };

  const findingsSummary = data.hasParsed
    ? `Reverse-engineered baseline: ${data.findings.components} components, ${data.findings.endpoints} endpoints, ${data.findings.tables} tables, ${data.findings.requirements} requirements.`
    : undefined;

  return (
    <div className="space-y-4">
      <DiscoveryToolbar
        step={step}
        hasImports={data.hasImports}
        onRestart={handleRestart}
        onPersist={persist}
        compact={hideInlineStepRail}
        mode={mode}
        onModeChange={handleModeChange}
        modeDisabled={data.reversing || data.uploading}
      />

      {/* Pipeline strip only when left rail is NOT owning navigation */}
      {!hideInlineStepRail && (
        <StepRail
          step={step}
          hasImports={data.hasImports}
          hasParsed={data.hasParsed}
          onSelect={handleSelectStep}
          changeTab={data.hasParsed ? step3Tab : undefined}
          onChangeTab={data.hasParsed ? handleStep3Tab : undefined}
        />
      )}

      {/* Change sub-tabs when left rail owns Import/Recover/Change */}
      {hideInlineStepRail && step === 3 && data.hasParsed && (
        <StepRail
          step={step}
          hasImports={data.hasImports}
          hasParsed={data.hasParsed}
          onSelect={handleSelectStep}
          changeTab={step3Tab}
          onChangeTab={handleStep3Tab}
          hidePipeline
        />
      )}

      {step === 1 && (
        <Step1Upload
          mode={mode}
          imports={data.imports}
          uploading={data.uploading}
          reversing={data.reversing}
          loadingDemo={data.loadingDemo}
          hasImports={data.hasImports}
          remotePresets={remotePresets}
          onFiles={data.handleFiles}
          onLoadDemoPack={() => data.loadDemoPack(true)}
          onLoadRemotePreset={(p) => data.loadRemotePreset(p, true)}
          onLoadGithubRepo={(url, ref) => data.loadGithubRepo(url, ref, true)}
          onDelete={data.deleteImport}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2Reverse
          importCount={data.imports.length}
          pendingCount={data.pendingCount}
          reversing={data.reversing}
          hasImports={data.hasImports}
          hasParsed={data.hasParsed}
          onRun={(reprocess) => data.runReverseEngineer(reprocess)}
          onBack={() => setStep(1)}
          onNext={() => {
            setStep(3);
            handleStep3Tab("recovered");
          }}
        />
      )}

      {step === 3 && (
        <div className="space-y-4">
          {!data.hasParsed ? (
            <div className="rounded-xl border px-4 py-3 text-sm text-muted-foreground">
              Recover architecture first, then come back here.
              <button
                type="button"
                className="ml-2 underline text-foreground"
                onClick={() => setStep(2)}
              >
                Go to recover
              </button>
            </div>
          ) : (
            <>
              {step3Tab === "recovered" && (
                <SystemInventoryPanel
                  inventory={inventoryState.inventory}
                  loading={inventoryState.loading}
                  embedded={hideInlineStepRail}
                />
              )}

              {(step3Tab === "propose" || step3Tab === "revision") && (
                <SimpleChangeFlow
                  projectId={projectId}
                  findingsSummary={findingsSummary}
                  inventory={inventoryState.inventory}
                  view={step3Tab}
                  onOpenRevision={() => handleStep3Tab("revision")}
                  onOpenPropose={() => handleStep3Tab("propose")}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
