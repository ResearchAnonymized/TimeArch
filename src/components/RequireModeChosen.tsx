import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useUiMode } from "@/contexts/UiModeContext";
import { useAuth } from "@/contexts/AuthContext";

/**
 * If Studio mode is enabled and the user has not picked a mode yet,
 * force them to the /onboarding/mode chooser before hitting the app.
 */
export default function RequireModeChosen({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { mode, loading, studioEnabled } = useUiMode();
  const location = useLocation();

  if (!studioEnabled) return <>{children}</>;
  if (authLoading || loading) return <>{children}</>;
  if (!user) return <>{children}</>;
  if (mode === null && location.pathname !== "/onboarding/mode") {
    return <Navigate to="/onboarding/mode" replace />;
  }
  return <>{children}</>;
}
