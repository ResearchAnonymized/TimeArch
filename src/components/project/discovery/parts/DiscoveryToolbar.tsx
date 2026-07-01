import { CheckCircle2, Home, PauseCircle, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  step: 1 | 2 | 3;
  hasImports: boolean;
  lastActivity: Date | null;
  onRestart: () => void;
  onPersist: () => void;
}

export default function DiscoveryToolbar({
  step,
  hasImports,
  lastActivity,
  onRestart,
  onPersist,
}: Props) {
  const navigate = useNavigate();
  const handleSaveAndExit = () => {
    onPersist();
    toast.success("Progress saved", {
      description:
        "Pick up right where you left off — your files and parsed results stay here.",
    });
    navigate("/dashboard");
  };

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/85 backdrop-blur-sm border-b border-border/60 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="h-8 px-2 text-xs"
        >
          <Home className="h-3.5 w-3.5 mr-1.5" /> Dashboard
        </Button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-xs text-muted-foreground truncate">
          Brownfield Discovery · Step {step} of 3
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> Auto-saved
          {lastActivity && (
            <span className="text-muted-foreground ml-1">
              · {lastActivity.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
        {hasImports && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestart}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveAndExit}
          className="h-8 px-3 text-xs"
        >
          <PauseCircle className="h-3.5 w-3.5 mr-1.5" /> Save & exit
        </Button>
      </div>
    </div>
  );
}
