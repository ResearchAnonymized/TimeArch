import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  /** Optional icon node rendered before the title. */
  icon?: ReactNode;
  /** Optional subtle right-aligned meta (count, badges, etc.). */
  meta?: ReactNode;
  /** Optional actions rendered on the right side of the header (do not toggle). */
  actions?: ReactNode;
  /** Persist open/closed state in localStorage under this key. */
  storageKey?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Lightweight collapsible section wrapper used across workspaces.
 * State persists per `storageKey` in localStorage.
 */
export default function CollapsibleSection({
  title,
  icon,
  meta,
  actions,
  storageKey,
  defaultOpen = true,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined" || !storageKey) return defaultOpen;
    const stored = window.localStorage.getItem(`collapsible:${storageKey}`);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.setItem(`collapsible:${storageKey}`, String(next));
    }
  };

  return (
    <section className={cn("rounded-lg border bg-card/40 overflow-hidden", className)}>
      <div className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-colors">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </span>
          {meta && <span className="text-[10px] font-mono text-muted-foreground/70">{meta}</span>}
          <span className="ml-auto flex items-center gap-1 text-[10.5px] text-muted-foreground">
            {open ? (
              <>
                Hide <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        </button>
        {actions && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
