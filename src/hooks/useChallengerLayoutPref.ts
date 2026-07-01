import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Per-stage Challenger panel layout preference.
 *
 * - Local choice is always saved to localStorage (per project + stage) so the
 *   panel feels instant on revisit.
 * - When the user opts in to "sync to my account", the choice is also written
 *   to public.user_ui_preferences keyed globally per stage so it follows them
 *   across browsers and devices.
 *
 * Storage keys:
 *   localStorage: `challenger:open:{projectId}:{stage}` = "1" | "0"
 *   localStorage: `challenger:sync` = "1" | "0"   (global opt-in)
 *   db preference_key: `challenger.open.stage.{stage}` = { open: boolean }
 */

const SYNC_FLAG_KEY = "challenger:sync";
const localKey = (projectId: string, stage: number) => `challenger:open:${projectId}:${stage}`;
const remoteKey = (stage: number) => `challenger.open.stage.${stage}`;

type StoredOpen = "1" | "0" | null;

const readLocal = (projectId: string, stage: number): StoredOpen => {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(localKey(projectId, stage));
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
};

const writeLocal = (projectId: string, stage: number, value: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localKey(projectId, stage), value ? "1" : "0");
  } catch {
    // ignore quota / privacy errors
  }
};

const clearLocal = (projectId: string, stage: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(localKey(projectId, stage));
  } catch {
    // ignore
  }
};

const readSyncFlag = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SYNC_FLAG_KEY) === "1";
  } catch {
    return false;
  }
};

export interface ChallengerLayoutPref {
  /** Stored preference value, or null if the user has no saved choice. */
  storedOpen: boolean | null;
  /** Whether cross-device sync is enabled. */
  syncEnabled: boolean;
  /** True while the initial remote fetch is in flight. */
  hydrating: boolean;
  /** Persist a new open/closed value (always local; remote if sync is on). */
  setOpenPreference: (value: boolean) => Promise<void>;
  /** Clear local + remote preference for this stage. */
  resetPreference: () => Promise<void>;
  /** Toggle cross-device sync. When enabling, pushes current value up. */
  setSyncEnabled: (enabled: boolean) => Promise<void>;
}

export function useChallengerLayoutPref(projectId: string, stage: number): ChallengerLayoutPref {
  const { user } = useAuth();
  const [storedOpen, setStoredOpen] = useState<boolean | null>(() => {
    const v = readLocal(projectId, stage);
    return v === "1" ? true : v === "0" ? false : null;
  });
  const [syncEnabled, setSyncEnabledState] = useState<boolean>(readSyncFlag);
  const [hydrating, setHydrating] = useState<boolean>(() => readSyncFlag() && !!user);

  // Re-hydrate from localStorage when project/stage changes.
  useEffect(() => {
    const v = readLocal(projectId, stage);
    setStoredOpen(v === "1" ? true : v === "0" ? false : null);
  }, [projectId, stage]);

  // Pull the remote preference for this stage when sync is on and user logged in.
  useEffect(() => {
    let cancelled = false;
    if (!syncEnabled || !user) {
      setHydrating(false);
      return;
    }
    setHydrating(true);
    (async () => {
      const { data, error } = await supabase
        .from("user_ui_preferences")
        .select("preference_value")
        .eq("user_id", user.id)
        .eq("preference_key", remoteKey(stage))
        .maybeSingle();
      if (cancelled) return;
      if (!error && data?.preference_value) {
        const remote = (data.preference_value as { open?: boolean }).open;
        if (typeof remote === "boolean") {
          setStoredOpen(remote);
          writeLocal(projectId, stage, remote);
        }
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [syncEnabled, user, projectId, stage]);

  const pushRemote = useCallback(
    async (value: boolean) => {
      if (!user) return;
      await supabase.from("user_ui_preferences").upsert(
        {
          user_id: user.id,
          preference_key: remoteKey(stage),
          preference_value: { open: value },
        },
        { onConflict: "user_id,preference_key" },
      );
    },
    [user, stage],
  );

  const setOpenPreference = useCallback(
    async (value: boolean) => {
      writeLocal(projectId, stage, value);
      setStoredOpen(value);
      if (syncEnabled && user) {
        await pushRemote(value);
      }
    },
    [projectId, stage, syncEnabled, user, pushRemote],
  );

  const resetPreference = useCallback(async () => {
    clearLocal(projectId, stage);
    setStoredOpen(null);
    if (syncEnabled && user) {
      await supabase
        .from("user_ui_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("preference_key", remoteKey(stage));
    }
  }, [projectId, stage, syncEnabled, user]);

  const setSyncEnabled = useCallback(
    async (enabled: boolean) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SYNC_FLAG_KEY, enabled ? "1" : "0");
        } catch {
          // ignore
        }
      }
      setSyncEnabledState(enabled);
      // When enabling, push current local choice up so it's available everywhere.
      if (enabled && user && storedOpen !== null) {
        await pushRemote(storedOpen);
      }
    },
    [user, storedOpen, pushRemote],
  );

  return {
    storedOpen,
    syncEnabled,
    hydrating,
    setOpenPreference,
    resetPreference,
    setSyncEnabled,
  };
}
