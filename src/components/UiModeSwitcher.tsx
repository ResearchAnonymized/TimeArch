import { Sparkles, LayoutGrid } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUiMode } from "@/contexts/UiModeContext";
import { toast } from "sonner";

/**
 * Header switcher — flips preference AND navigates to the matching shell.
 */
export default function UiModeSwitcher() {
  const { mode, studioEnabled, setMode } = useUiMode();
  const nav = useNavigate();
  const loc = useLocation();
  if (!studioEnabled) return null;

  const isStudio = mode === "studio";
  const next = isStudio ? "classic" : "studio";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await setMode(next);
        toast.success(`Switched to ${next === "studio" ? "Studio" : "Classic"} mode`);
        const path = loc.pathname;
        // Try to map current URL to the matching shell.
        const projectMatch = path.match(/\/(?:studio\/)?project\/([^/]+)/);
        if (next === "studio") {
          if (projectMatch) nav(`/studio/project/${projectMatch[1]}`);
          else nav("/studio/dashboard");
        } else {
          if (projectMatch) nav(`/project/${projectMatch[1]}`);
          else nav("/dashboard");
        }
      }}
      title={`Switch to ${next} mode`}
    >
      {isStudio ? <Sparkles className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
      <span className="hidden md:inline">{isStudio ? "Studio" : "Classic"}</span>
    </Button>
  );
}
