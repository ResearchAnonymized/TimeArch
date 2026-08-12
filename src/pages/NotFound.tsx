import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // After OAuth, users sometimes land on a broker callback path while already signed in.
  useEffect(() => {
    if (loading || !user) return;
    if (
      location.pathname.startsWith("/iframe-oauth") ||
      location.pathname.startsWith("/oauth") ||
      location.pathname.startsWith("/~oauth")
    ) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
        <h1 className="text-6xl font-display font-bold text-primary">404</h1>
        <p className="text-xl text-muted-foreground">Oops! Page not found</p>
        <p className="text-sm text-muted-foreground font-mono break-all">
          {location.pathname}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Go Back
          </Button>
          <Button variant="default" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <Home className="h-3.5 w-3.5" /> Home
          </Button>
          {user && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
