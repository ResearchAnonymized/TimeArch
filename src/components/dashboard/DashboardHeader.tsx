import React from "react";
import { useNavigate } from "react-router-dom";
import { Zap, LogOut, Shield, FileText, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import UiModeSwitcher from "@/components/UiModeSwitcher";

interface DashboardHeaderProps {
  displayName: string | null | undefined;
  email: string | undefined;
  avatarUrl: string | null | undefined;
  initials: string;
  isAdmin: boolean;
  onSignOut: () => void;
}

export default function DashboardHeader({
  displayName,
  email,
  avatarUrl,
  initials,
  isAdmin,
  onSignOut,
}: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">TimeArch</span>
        </div>
        <div className="flex items-center gap-3">
          <UiModeSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/prompts")}
            title="Prompt Library"
          >
            <FileText className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                onClick={() => navigate("/experiments")}
                title="Experiment Ground (empirical validation)"
              >
                <FlaskConical className="h-4 w-4" />
                <span className="hidden md:inline text-xs font-medium">Experiments</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/admin")}
                title="Admin Console"
              >
                <Shield className="h-4 w-4" />
              </Button>
            </>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {displayName || email}
          </span>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-display font-semibold text-primary overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="gap-1 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
