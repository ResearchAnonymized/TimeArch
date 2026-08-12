import { cn } from "@/lib/utils";

export type BrownfieldMode = "demo" | "live";

interface Props {
  mode: BrownfieldMode;
  onChange: (mode: BrownfieldMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: Props) {
  const isLive = mode === "live";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
      <p className="text-sm font-medium">{isLive ? "Live import" : "Demo project"}</p>
      <div className="flex items-center gap-2">
        <span className={cn("text-xs", !isLive ? "text-foreground font-medium" : "text-muted-foreground")}>
          Demo
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isLive}
          aria-label="Toggle Demo or Live"
          disabled={disabled}
          onClick={() => onChange(isLive ? "demo" : "live")}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors",
            isLive ? "bg-foreground" : "bg-muted-foreground/40",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              isLive && "translate-x-5",
            )}
          />
        </button>
        <span className={cn("text-xs", isLive ? "text-foreground font-medium" : "text-muted-foreground")}>
          Live
        </span>
      </div>
    </div>
  );
}
