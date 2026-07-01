import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Edit3,
  HelpCircle,
  LayoutGrid,
  Link,
  Lock,
  Shield,
  Target,
  Trash2,
  Unlock,
  Users,
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
import type { SavedRequirement } from "../types";

export function SavedRequirementsList({
  requirements,
  onRefresh,
}: {
  requirements: SavedRequirement[];
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const filtered = filter === "all" ? requirements : requirements.filter((r) => r.type === filter);

  const typeGroups: { key: string; label: string; count: number; icon: any; color: string }[] = [
    { key: "all", label: "All", count: requirements.length, icon: LayoutGrid, color: "text-foreground" },
    { key: "functional", label: "Functional", count: requirements.filter((r) => r.type === "functional").length, icon: Target, color: "text-primary" },
    { key: "non_functional", label: "Non-Functional", count: requirements.filter((r) => r.type === "non_functional").length, icon: Shield, color: "text-emerald-500" },
    { key: "constraint", label: "Constraints", count: requirements.filter((r) => r.type === "constraint").length, icon: Lock, color: "text-slate-500" },
    { key: "assumption", label: "Assumptions", count: requirements.filter((r) => r.type === "assumption").length, icon: HelpCircle, color: "text-amber-500" },
    { key: "dependency", label: "Dependencies", count: requirements.filter((r) => r.type === "dependency").length, icon: Link, color: "text-cyan-500" },
    { key: "user_story", label: "Stories", count: requirements.filter((r) => r.type === "user_story").length, icon: Users, color: "text-violet-500" },
  ];

  const startEdit = (req: SavedRequirement) => {
    setEditing(req.id);
    setEditForm({
      title: req.title,
      description: req.description || "",
      priority: req.priority,
      type: req.type,
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
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement updated");
    setEditing(null);
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
