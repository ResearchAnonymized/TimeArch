import Stage1Cockpit from "@/components/studio/Stage1Cockpit";
import Stage4Drivers from "@/components/studio/Stage4Drivers";
import Stage5Style from "@/components/studio/Stage5Style";
import Stage6Components from "@/components/studio/Stage6Components";
import Stage7Data from "@/components/studio/Stage7Data";
import Stage8Apis from "@/components/studio/Stage8Apis";
import Stage9Concerns from "@/components/studio/Stage9Concerns";
import Stage10Infra from "@/components/studio/Stage10Infra";
import Stage11Atam from "@/components/studio/Stage11Atam";
import Stage12Risks from "@/components/studio/Stage12Risks";
import Stage13Tradeoffs from "@/components/studio/Stage13Tradeoffs";
import Stage14Checklists from "@/components/studio/Stage14Checklists";
import Stage15Approval from "@/components/studio/Stage15Approval";
import Stage16Plan from "@/components/studio/Stage16Plan";
import Stage17Deploy from "@/components/studio/Stage17Deploy";
import Stage18Evolution from "@/components/studio/Stage18Evolution";
import StageWorkspace from "@/components/studio/StageWorkspace";
import { StageShellProvider } from "@/components/studio/StageShellContext";
import DiscoveryWorkspace from "@/components/project/discovery/DiscoveryWorkspace";

interface Props {
  projectId: string;
  currentStage: number;
  projectName: string;
  projectDescription: string | null;
  advancing: boolean;
  onAdvance: (n: number) => void;
  discoveryStep?: 1 | 2 | 3;
  onDiscoveryStep?: (n: 1 | 2 | 3) => void;
  onDiscoveryProgress?: (p: { hasImports: boolean; hasParsed: boolean }) => void;
  hideInlineStepRail?: boolean;
}

export default function StageToolPane({
  projectId,
  currentStage,
  projectName,
  projectDescription,
  advancing,
  onAdvance,
  discoveryStep,
  onDiscoveryStep,
  onDiscoveryProgress,
  hideInlineStepRail,
}: Props) {
  const next = (n: number) => onAdvance(n);
  const content = (() => {
    switch (currentStage) {
      case 0:
        return (
          <DiscoveryWorkspace
            projectId={projectId}
            onJumpToStage={(n) => next(n)}
            step={discoveryStep}
            onStepChange={onDiscoveryStep}
            onProgress={onDiscoveryProgress}
            hideInlineStepRail={hideInlineStepRail}
          />
        );
      case 1:
        return (
          <Stage1Cockpit
            projectId={projectId}
            initialName={projectName}
            initialDescription={projectDescription}
            advancing={advancing}
            onAdvance={() => next(2)}
          />
        );
      case 4:
        return <Stage4Drivers projectId={projectId} advancing={advancing} onAdvance={() => next(5)} />;
      case 5:
        return <Stage5Style projectId={projectId} advancing={advancing} onAdvance={() => next(6)} />;
      case 6:
        return <Stage6Components projectId={projectId} advancing={advancing} onAdvance={() => next(7)} />;
      case 7:
        return <Stage7Data projectId={projectId} advancing={advancing} onAdvance={() => next(8)} />;
      case 8:
        return <Stage8Apis projectId={projectId} advancing={advancing} onAdvance={() => next(9)} />;
      case 9:
        return <Stage9Concerns projectId={projectId} advancing={advancing} onAdvance={() => next(10)} />;
      case 10:
        return <Stage10Infra projectId={projectId} advancing={advancing} onAdvance={() => next(11)} />;
      case 11:
        return <Stage11Atam projectId={projectId} advancing={advancing} onAdvance={() => next(12)} />;
      case 12:
        return <Stage12Risks projectId={projectId} advancing={advancing} onAdvance={() => next(13)} />;
      case 13:
        return <Stage13Tradeoffs projectId={projectId} advancing={advancing} onAdvance={() => next(14)} />;
      case 14:
        return <Stage14Checklists projectId={projectId} advancing={advancing} onAdvance={() => next(15)} />;
      case 15:
        return <Stage15Approval projectId={projectId} advancing={advancing} onAdvance={() => next(16)} />;
      case 16:
        return <Stage16Plan projectId={projectId} advancing={advancing} onAdvance={() => next(17)} />;
      case 17:
        return <Stage17Deploy projectId={projectId} advancing={advancing} onAdvance={() => next(18)} />;
      case 18:
        return <Stage18Evolution projectId={projectId} advancing={advancing} onAdvance={() => next(18)} />;
      default:
        return (
          <StageWorkspace
            projectId={projectId}
            currentStage={currentStage}
            advancing={advancing}
            onAdvance={(n) => next(n)}
          />
        );
    }
  })();

  return (
    <StageShellProvider compact>
      <div className="max-w-5xl">{content}</div>
    </StageShellProvider>
  );
}
