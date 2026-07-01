import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import logoImg from "@/assets/timearch-logo.png";

export default function LandingNav() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={logoImg}
            alt="TimeArch"
            className="h-10 w-10 object-contain"
            width={40}
            height={40}
          />
          <span className="font-display text-lg font-bold tracking-tight">TimeArch</span>
          <span className="text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 leading-none">
            Beta
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#lifecycle" className="hover:text-foreground transition-colors">
            Lifecycle
          </a>
          <button
            onClick={() => navigate("/survey")}
            className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            Survey
            <span className="text-[8px] font-mono font-bold tracking-widest uppercase px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 leading-none">
              MVP
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
          <Button
            variant="hero"
            size="sm"
            onClick={() => navigate("/auth")}
            className="active:scale-[0.97] transition-transform"
          >
            Start Free
          </Button>
        </div>
      </div>
    </nav>
  );
}
