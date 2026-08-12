import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Edit3,
  HelpCircle,
  LayoutGrid,
  Link,
  Lock,
  Shield,
  Sparkles,
  Target,
  Trash2,
  Unlock,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PRIORITY_STYLES, TYPE_COLORS } from "../constants";
import type { RequirementChangeType, SavedRequirement } from "../types";

const CHANGE_TYPE_META: Record<
  RequirementChangeType,
  { label: string; icon: any; badge: string; dot: string }
> = {
  preserve: {
    label: "Preserve",
    icon: Shield,
    badge: "bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  change: {
    label: "Change",
    icon: ArrowRightLeft,
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  deprecate: {
    label: "Deprecate",
    icon: XCircle,
    badge: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  new: {
    label: "New",
    icon: Sparkles,
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

const CHANGE_TYPES: RequirementChangeType[] = ["preserve", "change", "deprecate", "new"];

export function SavedRequirementsList({
  requirements,
  onRefresh,
  projectMode,
}: {
  requirements: SavedRequirement[];
  onRefresh: () => void;
  projectMode?: string | null;
}) {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [deltaFilter, setDeltaFilter] = useState<"all" | RequirementChangeType>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const isBrownfield = projectMode === "brownfield";


  const typeFiltered =
    filter === "all" ? requirements : requirements.filter((r) => r.type === filter);
  const filtered =
    isBrownfield && deltaFilter !== "all"
      ? typeFiltered.filter((r) => (r.change_type ?? "new") === deltaFilter)
      : typeFiltered;

  const typeGroups: { key: string; label: string; count: number; icon: any; color: string }[] = [
    { key: "all", label: "All", count: requirements.length, icon: LayoutGrid, color: "text-foreground" },
    { key: "functional", label: "Functional", count: requirements.filter((r) => r.type === "functional").length, icon: Target, color: "text-primary" },
    { key: "non_functional", label: "Non-Functional", count: requirements.filter((r) => r.type === "non_functional").length, icon: Shield, color: "text-emerald-500" },
    { key: "constraint", label: "Constraints", count: requirements.filter((r) => r.type === "constraint").length, icon: Lock, color: "text-slate-500" },
    { key: "assumption", label: "Assumptions", count: requirements.filter((r) => r.type === "assumption").length, icon: HelpCircle, color: "text-amber-500" },
    { key: "dependency", label: "Dependencies", count: requirements.filter((r) => r.type === "dependency").length, icon: Link, color: "text-cyan-500" },
    { key: "user_story", label: "Stories", count: requirements.filter((r) => r.type === "user_story").length, icon: Users, color: "text-violet-500" },
  ];

  const deltaCount = (k: RequirementChangeType) =>
    requirements.filter((r) => (r.change_type ?? "new") === k).length;

  const startEdit = (req: SavedRequirement) => {
    setEditing(req.id);
    setEditForm({
      title: req.title,
      description: req.description || "",
      priority: req.priority,
      type: req.type,
      change_type: req.change_type ?? (isBrownfield ? "new" : "new"),
    });
  };

  const saveEdit = async (reqId: string) => {
    const { error } = await supabase
      .from("requirements")
      .update({
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority as any,
        type: editForm.type as any,
        change_type: editForm.change_type ?? null,
      } as any)
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement updated");
    setEditing(null);
    onRefresh();
  };

  const setChangeType = async (reqId: string, next: RequirementChangeType) => {
    const { error } = await supabase
      .from("requirements")
      .update({ change_type: next } as any)
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    onRefresh();
  };


  const lockRequirement = async (reqId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "locked" as any,
        locked_at: new Date().toISOString(),
        locked_by: user.id,
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement locked");
    onRefresh();
  };

  const unlockRequirement = async (reqId: string) => {
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "draft" as any,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement unlocked");
    onRefresh();
  };

  const deleteRequirement = async (reqId: string) => {
    const { error } = await supabase.from("requirements").delete().eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement deleted");
    onRefresh();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {typeGroups
          .filter((g) => g.key === "all" || g.count > 0)
          .map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.key}
                onClick={() => setFilter(g.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === g.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {g.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === g.key ? "bg-primary-foreground/20" : "bg-background"
                  }`}
                >
                  {g.count}
                </span>
              </button>
            );
          })}
      </div>

      {isBrownfield && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mr-1">
            Delta
          </span>
          <button
            onClick={() => setDeltaFilter("all")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              deltaFilter === "all"
                ? "bg-foreground text-background"
                : "bg-secondary/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            All
            <span className="text-[9px] opacity-70">{requirements.length}</span>
          </button>
          {CHANGE_TYPES.map((k) => {
            const m = CHANGE_TYPE_META[k];
            const Icon = m.icon;
            const active = deltaFilter === k;
            return (
              <button
                key={k}
                onClick={() => setDeltaFilter(k)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                  active ? m.badge : "border-transparent bg-secondary/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {m.label}
                <span className="text-[9px] opacity-70">{deltaCount(k)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((req) => {
          const tc = TYPE_COLORS[req.type] || TYPE_COLORS.functional;
          const TypeIcon = tc.icon;
          return (
            <motion.div
              key={req.id}
              layout
              className={`rounded-xl border-l-[3px] ${tc.border} border border-border/60 bg-card overflow-hidden hover:shadow-sm transition-all`}
            >
              {editing === req.id ? (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={editForm.type}
                      onValueChange={(v) => setEditForm({ ...editForm, type: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="functional">Functional</SelectItem>
                        <SelectItem value="non_functional">Non-Functional</SelectItem>
                        <SelectItem value="constraint">Constraint</SelectItem>
                        <SelectItem value="assumption">Assumption</SelectItem>
                        <SelectItem value="dependency">Dependency</SelectItem>
                        <SelectItem value="user_story">User Story</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={editForm.priority}
                      onValueChange={(v) => setEditForm({ ...editForm, priority: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="h-9 text-xs"
                  />
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="text-xs min-h-[60px]"
                  />
                  {isBrownfield && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        Delta
                      </span>
                      <Select
                        value={editForm.change_type ?? "new"}
                        onValueChange={(v) => setEditForm({ ...editForm, change_type: v })}
                      >
                        <SelectTrigger className="h-8 text-xs w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANGE_TYPES.map((k) => (
                            <SelectItem key={k} value={k}>
                              {CHANGE_TYPE_META[k].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => saveEdit(req.id)}
                    >
                      <Check className="h-3 w-3" /> Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div
                        className={`h-7 w-7 rounded-lg ${tc.bg} flex items-center justify-center flex-shrink-0`}
                      >
                        <TypeIcon className={`h-3.5 w-3.5 ${tc.text}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {req.requirement_id}
                          </span>
                          {req.source && (
                            <Badge variant="outline" className="text-[9px]">
                              {req.source === "ai-extracted"
                                ? "AI"
                                : req.source === "ai-inferred"
                                  ? "Inferred"
                                  : req.source}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-display font-semibold text-sm leading-tight">
                          {req.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      {isBrownfield && (() => {
                        const key = (req.change_type ?? "new") as RequirementChangeType;
                        const m = CHANGE_TYPE_META[key];
                        const Icon = m.icon;
                        return (
                          <Badge className={`text-[9px] border gap-0.5 ${m.badge}`}>
                            <Icon className="h-2.5 w-2.5" />
                            {m.label}
                          </Badge>
                        );
                      })()}
                      <Badge
                        className={`text-[9px] border ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.medium}`}
                      >
                        {req.priority}
                      </Badge>
                      {req.status === "locked" || req.status === "approved" ? (
                        <Badge className="text-[9px] bg-success/15 text-success border-success/30">
                          <Lock className="h-2.5 w-2.5 mr-0.5" /> Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </div>
                  {req.description && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 ml-[38px] line-clamp-2">
                      {req.description}
                    </p>
                  )}
                  {req.acceptance_criteria &&
                    Array.isArray(req.acceptance_criteria) &&
                    req.acceptance_criteria.length > 0 && (
                      <div className="mt-2 ml-[38px] pl-3 border-l-2 border-border/60">
                        {(req.acceptance_criteria as string[]).slice(0, 2).map((c, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-muted-foreground flex items-start gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3 text-success/60 mt-0.5 flex-shrink-0" />{" "}
                            {c}
                          </p>
                        ))}
                        {(req.acceptance_criteria as string[]).length > 2 && (
                          <p className="text-[10px] text-muted-foreground/50">
                            +{(req.acceptance_criteria as string[]).length - 2} more
                          </p>
                        )}
                      </div>
                    )}
                  <div className="flex gap-1.5 mt-3 ml-[38px]">
                    {req.status !== "locked" && req.status !== "approved" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => startEdit(req)}
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 text-success hover:text-success hover:bg-success/10"
                          onClick={() => lockRequirement(req.id)}
                        >
                          <Lock className="h-3 w-3" /> Lock
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteRequirement(req.id)}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </Button>
                      </>
                    )}
                    {(req.status === "locked" || req.status === "approved") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] gap-1 text-warning hover:text-warning hover:bg-warning/10"
                        onClick={() => unlockRequirement(req.id)}
                      >
                        <Unlock className="h-3 w-3" /> Unlock
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
