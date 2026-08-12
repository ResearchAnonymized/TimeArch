import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UiMode = "classic" | "studio";

const STORAGE_KEY = "timearch.ui.mode";

export const STUDIO_ENABLED =
  (import.meta.env.VITE_STUDIO_MODE_ENABLED ?? "true").toString().toLowerCase() !== "false";

interface UiModeContextType {
  mode: UiMode | null; // null = not yet chosen (forces chooser)
  loading: boolean;
  studioEnabled: boolean;
  setMode: (mode: UiMode) => Promise<void>;
}

const UiModeContext = createContext<UiModeContextType>({
  mode: "classic",
  loading: true,
  studioEnabled: STUDIO_ENABLED,
  setMode: async () => {},
});

function readLocalMode(): UiMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "classic" || v === "studio" ? v : null;
  } catch {
    return null;
  }
}

export function UiModeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [mode, setModeState] = useState<UiMode | null>(readLocalMode());
  const [loading, setLoading] = useState(true);

  // Sync from profile once user is known.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (authLoading) return;
      if (!user) {
        setModeState(readLocalMode());
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("ui_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const dbMode = (data?.ui_mode as UiMode | null) ?? null;
      setModeState(dbMode ?? readLocalMode());
      if (dbMode) {
        try { localStorage.setItem(STORAGE_KEY, dbMode); } catch {}
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const setMode = useCallback(async (next: UiMode) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    if (user) {
      await supabase.from("profiles").update({ ui_mode: next }).eq("user_id", user.id);
    }
  }, [user]);

  return (
    <UiModeContext.Provider value={{ mode, loading, studioEnabled: STUDIO_ENABLED, setMode }}>
      {children}
    </UiModeContext.Provider>
  );
}

export const useUiMode = () => useContext(UiModeContext);
