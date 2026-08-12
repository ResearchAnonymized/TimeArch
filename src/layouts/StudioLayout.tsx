import { ReactNode, useState } from "react";
import StudioTopBar from "@/components/studio/StudioTopBar";
import JourneyDrawer from "@/components/studio/JourneyDrawer";

interface Props {
  children: ReactNode;
  crumb?: string;
  backTo?: string;
  projectId?: string;
  currentStage?: number;
  /** Engineering console: full width, no aurora, dense chrome. */
  console?: boolean;
}

/**
 * Studio shell — calm canvas, aurora backdrop, one focused zone at a time.
 * No sidebar. Journey mini-map lives in a right-side drawer, opened on demand.
 * Pass `console` for dense engineering-tool surfaces (DOORS/Polarion style).
 */
export default function StudioLayout({
  children,
  crumb,
  backTo,
  projectId,
  currentStage,
  console: consoleMode = false,
}: Props) {
  const [journeyOpen, setJourneyOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {!consoleMode && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 motion-reduce:hidden"
        >
          <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl animate-[pulse_9s_ease-in-out_infinite]" />
          <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-violet-500/10 blur-3xl animate-[pulse_11s_ease-in-out_infinite]" />
          <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl animate-[pulse_13s_ease-in-out_infinite]" />
        </div>
      )}

      <StudioTopBar
        crumb={crumb}
        backTo={backTo}
        onOpenJourney={projectId ? () => setJourneyOpen(true) : undefined}
      />

      {consoleMode ? (
        <main className="w-full">{children}</main>
      ) : (
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      )}

      {projectId && (
        <JourneyDrawer
          open={journeyOpen}
          onClose={() => setJourneyOpen(false)}
          projectId={projectId}
          currentStage={currentStage ?? 1}
        />
      )}
    </div>
  );
}
