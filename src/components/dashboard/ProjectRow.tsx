import React from "react";
import {
  Folder,
  Clock,
  ArrowRight,
  MoreVertical,
  Trash2,
  Archive,
  ExternalLink,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_LABELS, PHASE_MAP, StatusBadge, type Project } from "./dashboardConstants";

interface ProjectRowProps {
  project: Project;
  index: number;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const progressPct = (stage: number) => Math.min(100, Math.round(((stage - 1) / 17) * 100));

export default function ProjectRow({
  project,
  index,
  onOpen,
  onDelete,
  onArchive,
  selectionMode,
  isSelected,
  onToggleSelect,
}: ProjectRowProps) {
  const phase = PHASE_MAP[project.current_stage];

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(project.id);
    } else {
      onOpen(project.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleClick}
      className={`group flex items-center gap-4 rounded-xl border bg-card px-5 py-3.5 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "hover:shadow-sm hover:border-primary/20"
      }`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(project.id)}
            className="h-5 w-5 border-2"
          />
        </div>
      )}

      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Folder className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display font-semibold text-sm truncate">{project.name}</h3>
        <p className="text-xs text-muted-foreground truncate">
          {project.description || "No description"}
        </p>
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-[11px] flex-shrink-0 w-36">
        <span className={`font-medium ${phase?.color || ""}`}>{phase?.label}</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-36">
        <Progress value={progressPct(project.current_stage)} className="h-1.5 flex-1" />
        <span className="text-[11px] font-mono font-semibold w-8 text-right">
          {progressPct(project.current_stage)}%
        </span>
      </div>
      <StatusBadge status={project.status} />
      <div className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0 w-24">
        <Clock className="h-3 w-3" />
        <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
      </div>

      {/* Actions */}
      {!selectionMode && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted flex-shrink-0"
              >
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onOpen(project.id)}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(project.id)}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(project.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </>
      )}
    </motion.div>
  );
}
