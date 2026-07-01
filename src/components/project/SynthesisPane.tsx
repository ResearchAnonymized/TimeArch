import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import StageBanner from "./StageBanner";
import LockAdvanceBar from "./LockAdvanceBar";
import RequirementIntake from "./RequirementIntake";
import ArchitectureDecisionWorkspace from "./ArchitectureDecisionWorkspace";
import DecompositionWorkspace from "./DecompositionWorkspace";
import DataArchitectureWorkspace from "./DataArchitectureWorkspace";
import ApiDesignWorkspace from "./ApiDesignWorkspace";
import CrossCuttingWorkspace from "./CrossCuttingWorkspace";
import InfrastructureWorkspace from "./InfrastructureWorkspace";
import QualityAttributesWorkspace from "./QualityAttributesWorkspace";
import RiskAnalysisWorkspace from "./RiskAnalysisWorkspace";
import ValidationWorkspace from "./ValidationWorkspace";
import DocumentationWorkspace from "./DocumentationWorkspace";
import RequirementAnalysisWorkspace from "./synthesis/RequirementAnalysisWorkspace";
import ApprovalWorkspace from "./synthesis/ApprovalWorkspace";
import ArtifactsWorkspace from "./synthesis/ArtifactsWorkspace";
import CodeGenerationGate from "./CodeGenerationGate";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import ValidationCriteriaPanel from "./ValidationCriteriaPanel";
import DiscoveryWorkspace from "./discovery/DiscoveryWorkspace";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";
import GapAnalysisPanel from "./discovery/GapAnalysisPanel";
import EvolutionPlanWorkspace from "./discovery/EvolutionPlanWorkspace";
import DriftDetectionPanel from "./discovery/DriftDetectionPanel";
import BrownfieldRequirementsView from "./discovery/BrownfieldRequirementsView";

interface Stage {
  id: number;
  label: string;
  icon: LucideIcon;
  short: string;
}

interface Props {
  currentStage: number;
  stages: Stage[];
  projectId: string;
  projectMode?: string;
  refreshKey?: number;
  completedStages?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

export default function SynthesisPane({
  currentStage,
  stages,
  projectId,
  projectMode,
  refreshKey,
  completedStages,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const stage = stages.find((s) => s.id === currentStage);
  if (!stage) return null;
  const isBrownfield = projectMode === "brownfield";

  const renderWorkspace = () => {
    const runProps = { onRunStage, stageRunning };
    switch (currentStage) {
      case 0:
        return (
          <FeatureErrorBoundary feature="discovery">
            <DiscoveryWorkspace projectId={projectId} onJumpToStage={onAdvance} />
          </FeatureErrorBoundary>
        );
      case 1:
        return isBrownfield ? (
          <BrownfieldRequirementsView projectId={projectId} onJumpToStage={onAdvance} />
        ) : (
          <RequirementIntake projectId={projectId} />
        );
      case 2:
        return (
          <RequirementAnalysisWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
          />
        );
      case 3:
      case 4:
      case 5:
        return (
          <ArchitectureDecisionWorkspace
            projectId={projectId}
            currentStage={currentStage}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 6:
        return (
          <DecompositionWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 7:
        return (
          <DataArchitectureWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 8:
        return (
          <ApiDesignWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 9:
        return (
          <CrossCuttingWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 10:
        return (
          <InfrastructureWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            {...runProps}
            onAdvance={onAdvance}
          />
        );
      case 11:
        return (
          <>
            {isBrownfield && (
              <div className="mb-6">
                <GapAnalysisPanel projectId={projectId} />
              </div>
            )}
            <QualityAttributesWorkspace
              projectId={projectId}
              refreshKey={refreshKey}
              {...runProps}
            />
            <div className="mt-6">
              <CollapsibleChallengerSection
                projectId={projectId}
                stage={11}
                refreshKey={refreshKey}
                {...runProps}
                onAdvance={onAdvance}
              />
            </div>
            <LockAdvanceBar
              projectId={projectId}
              stage={11}
              refreshKey={refreshKey}
              onAdvance={onAdvance}
              position="bottom"
            />
          </>
        );
      case 12:
        return (
          <>
            <RiskAnalysisWorkspace projectId={projectId} refreshKey={refreshKey} {...runProps} />
            <div className="mt-6">
              <CollapsibleChallengerSection
                projectId={projectId}
                stage={12}
                refreshKey={refreshKey}
                {...runProps}
                onAdvance={onAdvance}
              />
            </div>
            <LockAdvanceBar
              projectId={projectId}
              stage={12}
              refreshKey={refreshKey}
              onAdvance={onAdvance}
              position="bottom"
            />
          </>
        );
      case 13:
        return (
          <>
            <ValidationWorkspace projectId={projectId} refreshKey={refreshKey} {...runProps} />
            <div className="mt-6 space-y-3">
              <ValidationCriteriaPanel stage={13} />
              <CollapsibleChallengerSection
                projectId={projectId}
                stage={13}
                refreshKey={refreshKey}
                {...runProps}
                onAdvance={onAdvance}
              />
            </div>
            <LockAdvanceBar
              projectId={projectId}
              stage={13}
              refreshKey={refreshKey}
              onAdvance={onAdvance}
              position="bottom"
            />
          </>
        );
      case 14:
        return (
          <>
            <DocumentationWorkspace projectId={projectId} refreshKey={refreshKey} {...runProps} />
            <div className="mt-6">
              {/* Lighter integration: collapsed by default since Documentation is narrative, not a design decision. */}
              <CollapsibleChallengerSection
                projectId={projectId}
                stage={14}
                refreshKey={refreshKey}
                {...runProps}
                onAdvance={onAdvance}
                defaultCollapsed
              />
            </div>
            <LockAdvanceBar
              projectId={projectId}
              stage={14}
              refreshKey={refreshKey}
              onAdvance={onAdvance}
              position="bottom"
            />
          </>
        );
      case 15:
        return <ApprovalWorkspace projectId={projectId} />;
      default:
        if (currentStage === 16 && isBrownfield) {
          return <EvolutionPlanWorkspace projectId={projectId} />;
        }
        if (currentStage === 18 && isBrownfield) {
          return (
            <>
              <div className="mb-6">
                <DriftDetectionPanel projectId={projectId} />
              </div>
              <ArtifactsWorkspace
                projectId={projectId}
                currentStage={currentStage}
                stageLabel={stage.label}
                refreshKey={refreshKey}
                {...runProps}
              />
            </>
          );
        }
        if (currentStage >= 16) {
          return (
            <CodeGenerationGate projectId={projectId} onGoToApproval={() => onAdvance?.(15)}>
              <ArtifactsWorkspace
                projectId={projectId}
                currentStage={currentStage}
                stageLabel={stage.label}
                refreshKey={refreshKey}
                {...runProps}
              />
            </CodeGenerationGate>
          );
        }
        return (
          <ArtifactsWorkspace
            projectId={projectId}
            currentStage={currentStage}
            stageLabel={stage.label}
            refreshKey={refreshKey}
            {...runProps}
          />
        );
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <LockAdvanceBar
        projectId={projectId}
        stage={currentStage}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
      />
      <StageBanner stage={stage} completedStages={completedStages ?? 0} />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {renderWorkspace()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
