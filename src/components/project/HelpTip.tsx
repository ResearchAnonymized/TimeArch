import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Enterprise-grade inline help icon with polished tooltip. */
export function HelpTip({
  text,
  side = "top",
  variant = "default",
}: {
  text: string;
  side?: "top" | "bottom" | "left" | "right";
  variant?: "default" | "accent";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center h-4 w-4 rounded-full cursor-help flex-shrink-0 ml-1 transition-all duration-200",
            variant === "accent"
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-muted/60 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground",
          )}
        >
          <Info className="h-2.5 w-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[260px] text-xs leading-relaxed bg-popover/95 backdrop-blur-sm shadow-lg border-border/60 px-3 py-2 rounded-lg"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
