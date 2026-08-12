import { useNavigate } from "react-router-dom";
import { Sparkles, LayoutGrid, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUiMode, type UiMode } from "@/contexts/UiModeContext";
import { useState } from "react";

export default function ModeChooserPage() {
  const navigate = useNavigate();
  const { setMode, studioEnabled } = useUiMode();
  const [saving, setSaving] = useState<UiMode | null>(null);

  const choose = async (m: UiMode) => {
    setSaving(m);
    await setMode(m);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Choose how you want to work
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            TimeArch offers two experiences over the same lifecycle, agents and artifacts.
            You can switch anytime from the header.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <ModeCard
            icon={<LayoutGrid className="h-5 w-5" />}
            title="Classic"
            tagline="Everything on one canvas"
            bullets={[
              "18-stage sidebar always visible",
              "Requirements, agents, debate, artifacts side-by-side",
              "Best for power users who know the lifecycle",
            ]}
            cta="Use Classic"
            loading={saving === "classic"}
            onClick={() => choose("classic")}
          />
          <ModeCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Studio"
            tagline="One step at a time, guided"
            bullets={[
              "Phase-based nav with a single primary action",
              "Advanced tools tucked in a drawer, never removed",
              "Best if you want TimeArch to walk you through it",
            ]}
            cta="Use Studio"
            highlight
            disabled={!studioEnabled}
            loading={saving === "studio"}
            onClick={() => choose("studio")}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          You can change this any time from the header switcher.
        </p>
      </div>
    </div>
  );
}

function ModeCard({
  icon, title, tagline, bullets, cta, onClick, highlight, disabled, loading,
}: {
  icon: React.ReactNode; title: string; tagline: string; bullets: string[];
  cta: string; onClick: () => void; highlight?: boolean; disabled?: boolean; loading?: boolean;
}) {
  return (
    <Card
      className={`p-6 flex flex-col gap-4 border ${
        highlight ? "border-primary/40 shadow-sm" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`h-9 w-9 rounded flex items-center justify-center ${
          highlight ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}>{icon}</div>
        <div>
          <div className="font-display text-xl font-semibold leading-tight">{title}</div>
          <div className="text-sm text-muted-foreground">{tagline}</div>
        </div>
      </div>
      <ul className="text-sm space-y-1.5 text-muted-foreground">
        {bullets.map((b) => <li key={b} className="flex gap-2"><span>•</span><span>{b}</span></li>)}
      </ul>
      <div className="mt-auto pt-2">
        <Button
          className="w-full gap-2"
          variant={highlight ? "default" : "outline"}
          onClick={onClick}
          disabled={disabled || loading}
        >
          {loading ? "Saving…" : cta} <ArrowRight className="h-4 w-4" />
        </Button>
        {disabled && (
          <div className="text-xs text-muted-foreground mt-2 text-center">
            Studio is not enabled in this build.
          </div>
        )}
      </div>
    </Card>
  );
}
