import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUiMode } from "@/contexts/UiModeContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, approvalStatus } = useAuth();
  const { mode, loading: modeLoading, studioEnabled } = useUiMode();
  const location = useLocation();

  if (loading || modeLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // If user is pending or rejected, redirect to pending approval page
  if (approvalStatus && approvalStatus !== "approved") {
    return <Navigate to="/pending-approval" replace />;
  }

  // Force the mode chooser on first login when Studio is enabled.
  if (studioEnabled && mode === null && location.pathname !== "/onboarding/mode") {
    return <Navigate to="/onboarding/mode" replace />;
  }

  return <>{children}</>;
}

