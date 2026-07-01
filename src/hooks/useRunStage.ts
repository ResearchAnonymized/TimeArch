import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getRequiredAccessToken } from "@/lib/authenticated-functions";

const MANUAL_STAGES = [1, 15];

// Total time we keep polling agent_runs after an edge-function timeout / 5xx.
const POLL_TIMEOUT_MS = 8 * 60 * 1000; // 8 min
const POLL_INITIAL_MS = 1000; // start at 1s
const POLL_MAX_MS = 30000; // cap at 30s

export interface PollProgress {
  status: "pending" | "running" | "waiting" | "idle";
  agentName?: string;
  attempts: number;
  elapsedMs: number;
  nextPollInMs: number; // ETA until next supabase check
  intervalMs: number; // current backoff interval
  startedAt: number; // epoch ms when polling started
}

const EMPTY_PROGRESS: PollProgress = {
  status: "idle",
  attempts: 0,
  elapsedMs: 0,
  nextPollInMs: 0,
  intervalMs: POLL_INITIAL_MS,
  startedAt: 0,
};

/**
 * Shared hook for triggering a stage agent run from any workspace.
 * Falls back to client-side polling with exponential backoff when the
 * edge function times out or errors. Exposes live polling progress so
 * the UI can show status, attempts, and an ETA to the next check.
 */
export function useRunStage(projectId: string, stage: number, onComplete?: () => void) {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState<PollProgress>(EMPTY_PROGRESS);
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);
  const tickRef = useRef<number | null>(null);
  const isManualStage = MANUAL_STAGES.includes(stage);

  // Drive a 250ms ticker while polling so the countdown/elapsed update live.
  useEffect(() => {
    if (!polling) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p.status === "idle") return p;
        const elapsedMs = Date.now() - p.startedAt;
        const nextPollInMs = Math.max(0, p.nextPollInMs - 250);
        return { ...p, elapsedMs, nextPollInMs };
      });
    }, 250);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [polling]);

  const cancelRun = () => {
    if (cancelRef.current) {
      cancelRef.current.cancelled = true;
      toast.info("Stopped monitoring agent run. The agent may still finish in the background.");
    }
  };

  const pollLatestRun = async (since: string): Promise<boolean> => {
    const token = { cancelled: false };
    cancelRef.current = token;
    setPolling(true);
    const startedAt = Date.now();
    const deadline = startedAt + POLL_TIMEOUT_MS;
    let interval = POLL_INITIAL_MS;
    let attempts = 0;

    setProgress({
      status: "pending",
      attempts: 0,
      elapsedMs: 0,
      nextPollInMs: interval,
      intervalMs: interval,
      startedAt,
    });

    toast.info("Agent is still working — monitoring in background.", { duration: 6000 });

    try {
      while (Date.now() < deadline) {
        if (token.cancelled) return false;
        await new Promise((r) => setTimeout(r, interval));
        if (token.cancelled) return false;

        attempts += 1;
        setProgress((p) => ({ ...p, attempts, status: "waiting", nextPollInMs: 0 }));

        try {
          const { data, error } = await supabase
            .from("agent_runs")
            .select("id, status, agent_name, error, completed_at")
            .eq("project_id", projectId)
            .eq("stage", stage)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            if (data.status === "completed") {
              toast.success(`${data.agent_name} completed.`);
              onComplete?.();
              return true;
            }
            if (data.status === "failed") {
              toast.error(data.error || "Agent execution failed");
              return true;
            }
            // running/pending → keep fast polling
            interval = POLL_INITIAL_MS;
            setProgress((p) => ({
              ...p,
              status: data.status === "running" ? "running" : "pending",
              agentName: data.agent_name ?? p.agentName,
              intervalMs: interval,
              nextPollInMs: interval,
            }));
            continue;
          }
        } catch {
          // transient query error — fall through to backoff
        }
        // Exponential backoff (doubles each cycle, capped)
        interval = Math.min(interval * 2, POLL_MAX_MS);
        setProgress((p) => ({
          ...p,
          intervalMs: interval,
          nextPollInMs: interval,
        }));
      }
      toast.error(
        "Agent run is taking longer than expected. Refresh in a minute to see the result.",
      );
      return false;
    } finally {
      setPolling(false);
      setProgress(EMPTY_PROGRESS);
      if (cancelRef.current === token) cancelRef.current = null;
    }
  };

  const runStage = async (options?: Record<string, unknown>) => {
    if (!user || isManualStage) return;
    setRunning(true);
    const startedAt = new Date().toISOString();
    try {
      const token = await getRequiredAccessToken();
      // Stages routed through the LangGraph-style agentic runtime (planner →
      // executor → critic loop). Mirrored from supabase/functions/_shared/
      // agent-runtime/config.ts::AGENTIC_STAGES — keep both lists in sync.
      const AGENTIC_STAGES = new Set<number>([2, 3, 7]);
      const overrideAgentic =
        typeof window !== "undefined" &&
        localStorage.getItem("timearch.agentic.allStages") === "1";
      const useAgentic = overrideAgentic || AGENTIC_STAGES.has(stage);
      const fnName = useAgentic ? "run-agent-v2" : "run-agent";
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ project_id: projectId, stage, user_id: user.id, options }),
      });

      const rawText = await response.text();
      const looksLikeIdleTimeout =
        response.status === 504 ||
        response.status === 546 ||
        response.status === 408 ||
        response.status === 502 ||
        response.status === 503 ||
        /IDLE_TIMEOUT|idle.?timeout|WORKER_LIMIT|timeout limit|gateway.?time.?out/i.test(rawText);

      if (looksLikeIdleTimeout) {
        await pollLatestRun(startedAt);
        return;
      }

      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        toast.error(data.error || "Agent execution failed");
      } else if (data.queued || data.status === "running") {
        await pollLatestRun(startedAt);
      } else {
        toast.success(`${data.agent} completed: ${data.artifact_title}`);
        onComplete?.();
      }
    } catch {
      await pollLatestRun(startedAt);
    } finally {
      setRunning(false);
    }
  };

  return { runStage, running, isManualStage, polling, cancelRun, progress };
}
