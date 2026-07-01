import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ExtractedSection({
  title,
  icon: Icon,
  items,
  renderItem,
  color = "text-primary",
  onAcceptAll,
  onAcceptItem,
}: {
  title: string;
  icon: any;
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  color?: string;
  onAcceptAll?: () => void;
  onAcceptItem?: (item: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full text-left group mb-3"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-display font-bold text-sm">{title}</span>
        <Badge variant="outline" className="text-[10px] font-mono">
          {items.length}
        </Badge>
        {onAcceptAll && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-[10px] h-7 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onAcceptAll();
            }}
          >
            <Check className="h-3 w-3" /> Accept All
          </Button>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2.5 pl-7 overflow-hidden"
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.id || idx}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="p-3.5 rounded-xl border bg-card group/item hover:border-primary/30 hover:shadow-sm transition-all"
              >
                {renderItem(item, idx)}
                {onAcceptItem && (
                  <div className="flex gap-1.5 mt-2.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => onAcceptItem(item)}
                    >
                      <Check className="h-3 w-3" /> Accept
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
