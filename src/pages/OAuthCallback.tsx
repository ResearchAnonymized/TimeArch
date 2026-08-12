import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Handles legacy OAuth callback paths (e.g. Lovable broker redirects)
 * by parking on /auth once the session is established.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user, loading, approvalStatus } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    if (approvalStatus && approvalStatus !== "approved") {
      navigate("/pending-approval", { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  }, [user, loading, approvalStatus, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
