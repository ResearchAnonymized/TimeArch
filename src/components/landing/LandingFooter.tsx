import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import logoImg from "@/assets/timearch-logo.png";

export default function LandingFooter() {
  const navigate = useNavigate();

  return (
    <>
      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background" />
        <div className="container relative">
          <div className="max-w-2xl mx-auto text-center">
            <h2
              className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-4"
              style={{ textWrap: "balance" }}
            >
              Start Architecting with Discipline
            </h2>
            <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
              Create your first project and experience the full 18-stage architecture lifecycle —
              from requirements to verified, production-ready code.
            </p>
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/auth")}
              className="gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/20 px-8 py-6 text-base"
            >
              Create Your First Project <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img
              src={logoImg}
              alt="TimeArch"
              className="h-6 w-6 object-contain"
              width={24}
              height={24}
              loading="lazy"
            />
            <span className="font-display font-semibold text-foreground text-sm">TimeArch</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/privacy")}
              className="text-xs hover:text-foreground transition-colors underline underline-offset-2"
            >
              Privacy Notice
            </button>
            <p className="font-mono text-xs">Multi-Agent Architecture Lifecycle Platform</p>
          </div>
        </div>
      </footer>
    </>
  );
}
