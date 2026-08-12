import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import UiModeSwitcher from "@/components/UiModeSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  crumb?: string;
  onOpenJourney?: () => void;
  backTo?: string;
}

export default function StudioTopBar({ crumb, onOpenJourney, backTo }: Props) {
  const { user, profile, signOut } = useAuth();
  const nav = useNavigate();

  const initials =
    profile?.display_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
        {backTo ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-2 text-muted-foreground"
            onClick={() => nav(backTo)}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        ) : (
          <Link to="/studio/dashboard" className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
              <span className="font-display text-xs font-bold">T</span>
              <span className="absolute inset-0 rounded-lg bg-white/10" />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">TimeArch</span>
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.18em] text-muted-foreground pl-1">
              Studio
            </span>
          </Link>
        )}

        {crumb && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm font-medium text-foreground/80 truncate max-w-[40ch]">
              {crumb}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          {onOpenJourney && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenJourney}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Compass className="h-4 w-4" />
              <span className="hidden md:inline text-xs">Journey</span>
            </Button>
          )}
          <UiModeSwitcher />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 rounded-full ring-1 ring-border hover:ring-primary/40 transition">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">
                <p className="font-medium truncate">{profile?.display_name || user?.email}</p>
                <p className="text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/onboarding/mode")}>
                Change mode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav("/prompts")}>Prompt library</DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav("/integrations")}>Integrations</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
