import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import PromptLibrary from "@/components/prompts/PromptLibrary";
import { useAuth } from "@/contexts/AuthContext";

export default function PromptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Dashboard
          </Button>
          <div>
            <h1 className="font-display font-bold tracking-tight">Prompt Library</h1>
            <p className="text-xs text-muted-foreground">
              Every system prompt driving a TimeArch agent. Read-only for non-admins.
            </p>
          </div>
        </div>
      </header>
      <PromptLibrary />
    </div>
  );
}
