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

interface ProjectCardProps {
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

export default function ProjectCard({
  project,
  index,
  onOpen,
  onDelete,
  onArchive,
  selectionMode,
  isSelected,
  onToggleSelect,
}: ProjectCardProps) {
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative rounded-xl border bg-card hover:shadow-lg cursor-pointer transition-all duration-300 ${
        isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/30"
      }`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(project.id)}
            className="h-5 w-5 border-2"
          />
        </div>
      )}

      {/* Action menu */}
      {!selectionMode && (
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
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
        </div>
      )}

      <div onClick={handleClick} className={`p-5 ${selectionMode ? "pl-11" : ""}`}>
        {/* Top: Icon + Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Name + Desc */}
        <h3 className="font-display font-semibold text-[15px] mb-1 truncate pr-6">
          {project.name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-5 min-h-[2.25rem] leading-relaxed">
          {project.description || "No description provided"}
        </p>

        {/* Progress section */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className={`font-medium ${phase?.color || "text-muted-foreground"}`}>
              {phase?.label}
            </span>
            <span className="font-mono font-bold text-foreground">
              {progressPct(project.current_stage)}%
            </span>
          </div>
          <Progress value={progressPct(project.current_stage)} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground truncate">
            Stage {project.current_stage}: {STAGE_LABELS[project.current_stage]}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1 mt-4 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
          {!selectionMode && (
            <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
