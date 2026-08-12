/**
 * Feature Changes panel — Phase 1 of the brownfield improvement plan.
 *
 * Captures concrete change requests for a brownfield/hybrid project so that
 * downstream architecture stages (gap analysis, impact, ADRs) can reason
 * against a specific requested change rather than blank slate.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Download, Gauge, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { errorOf } from "@/lib/result";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createLogger } from "@/lib/logger";

const log = createLogger("FeatureChangesPanel");

type ChangeType = "add" | "modify" | "remove" | "migrate";
type Priority = "low" | "medium" | "high" | "critical";
type Status = "draft" | "active" | "in_review" | "approved" | "implemented" | "archived";

interface MeritBreakdown {
  business_value: number;
  technical_feasibility: number;
  effort_efficiency: number;
  dependency_clarity: number;
  urgency: number;
}

interface FeatureChange {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  current_behavior: string | null;
  desired_behavior: string | null;
  change_type: ChangeType;
  priority: Priority;
  status: Status;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  merit_score: number | null;
  merit_breakdown: MeritBreakdown | null;
  merit_justification: string | null;
  merit_scored_at: string | null;
}

interface Props {
  projectId: string;
}

const priorityBadge: Record<Priority, string> = {
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  medium: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

const typeBadge: Record<ChangeType, string> = {
  add: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  modify: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  remove: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  migrate: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
};

const statusBadge: Record<Status, string> = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  implemented: "bg-primary/15 text-primary border-primary/30",
  archived: "bg-muted text-muted-foreground border-border",
};

export default function FeatureChangesPanel({ projectId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeatureChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [expandedScore, setExpandedScore] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    current_behavior: "",
    desired_behavior: "",
    change_type: "modify" as ChangeType,
    priority: "medium" as Priority,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feature_changes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) {
      log.warn("load failed", error);
      toast.error("Could not load feature changes");
    } else {
      setItems(((data as unknown) as FeatureChange[]) ?? []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () =>
    setForm({
      title: "",
      description: "",
      current_behavior: "",
      desired_behavior: "",
      change_type: "modify",
      priority: "medium",
    });

  const handleCreate = async () => {
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("feature_changes").insert({
      project_id: projectId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      current_behavior: form.current_behavior.trim() || null,
      desired_behavior: form.desired_behavior.trim() || null,
      change_type: form.change_type,
      priority: form.priority,
      status: "draft",
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      log.warn("insert failed", error);
      toast.error(error.message);
      return;
    }
    toast.success("Feature change captured");
    resetForm();
    setDialogOpen(false);
    void load();
  };

  const setActive = async (id: string, makeActive: boolean) => {
    // Multi-select: toggle just this one, don't touch siblings.
    const { error } = await supabase
      .from("feature_changes")
      .update({ is_active: makeActive, status: makeActive ? "active" : "draft" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(makeActive ? "Added to active batch" : "Removed from active batch");
    void load();
  };

  const approveChange = async (id: string) => {
    const { error } = await supabase
      .from("feature_changes")
      .update({ status: "approved", is_active: true })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feature proposal approved and saved");
    void load();
  };

  const scoreAll = async () => {
    if (items.length === 0) return;
    setScoring(true);
    const res = await invokeFunction<
      { project_id: string; feature_change_ids?: string[] },
      { scored: number; results: Array<{ id: string; score: number | null }>; error?: string }
    >("score-feature-changes", { project_id: projectId });
    setScoring(false);
    if (!res.ok) {
      toast.error(errorOf(res).message);
      return;
    }
    if (res.value.error) {
      toast.error(res.value.error);
      return;
    }
    toast.success(`Scored ${res.value.scored} of ${items.length} proposals`);
    void load();
  };

  const exportJson = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      project_id: projectId,
      count: items.length,
      feature_changes: items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-changes-${projectId.slice(0, 8)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} feature change${items.length === 1 ? "" : "s"}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this feature change?")) return;
    const { error } = await supabase.from("feature_changes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Feature Changes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Star multiple proposals to include them in the active batch. Downstream stages will fan out across every active change.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={scoreAll}
            disabled={scoring || items.length === 0}
            title="Neutrally score every proposal on 5 merit criteria (LLM-driven, ~1s per proposal)"
          >
            {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gauge className="h-3.5 w-3.5" />}
            Score proposals
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={exportJson}
            disabled={items.length === 0}
            title="Download all feature changes as JSON backup"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New change
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New feature change</DialogTitle>
              <DialogDescription>
                Describe what should change in the existing system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fc-title">Title *</Label>
                <Input
                  id="fc-title"
                  placeholder="e.g. Add multi-currency support to Orders"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Change type</Label>
                  <Select
                    value={form.change_type}
                    onValueChange={(v) => setForm((f) => ({ ...f, change_type: v as ChangeType }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add new capability</SelectItem>
                      <SelectItem value="modify">Modify existing</SelectItem>
                      <SelectItem value="remove">Remove/deprecate</SelectItem>
                      <SelectItem value="migrate">Migrate/replatform</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fc-desc">Description</Label>
                <Textarea
                  id="fc-desc"
                  rows={2}
                  placeholder="Business goal, drivers, constraints…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fc-cur">Current behavior</Label>
                <Textarea
                  id="fc-cur"
                  rows={2}
                  placeholder="How the system behaves today (as observed in discovery)…"
                  value={form.current_behavior}
                  onChange={(e) => setForm((f) => ({ ...f, current_behavior: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fc-des">Desired behavior</Label>
                <Textarea
                  id="fc-des"
                  rows={2}
                  placeholder="How it should behave after the change…"
                  value={form.desired_behavior}
                  onChange={(e) => setForm((f) => ({ ...f, desired_behavior: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save change"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No feature changes yet. Mapping, ripple, agents, and implementation tasks all need one.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create first feature change
          </Button>
        </div>
      ) : (
        (() => {
          const columns: Array<{
            key: "backlog" | "in_review" | "approved";
            title: string;
            hint: string;
            accent: string;
            match: (s: Status) => boolean;
            nextStatus?: Status;
            prevStatus?: Status;
          }> = [
            {
              key: "backlog",
              title: "Backlog",
              hint: "Newly captured proposals",
              accent: "border-slate-400/40 bg-slate-500/5",
              match: (s) => s === "draft" || s === "active",
              nextStatus: "in_review",
            },
            {
              key: "in_review",
              title: "In Review",
              hint: "Being triaged / scored",
              accent: "border-amber-500/40 bg-amber-500/5",
              match: (s) => s === "in_review",
              nextStatus: "approved",
              prevStatus: "draft",
            },
            {
              key: "approved",
              title: "Approved",
              hint: "Locked in for downstream stages",
              accent: "border-emerald-500/40 bg-emerald-500/5",
              match: (s) => s === "approved" || s === "implemented",
              prevStatus: "in_review",
            },
          ];

          const moveTo = async (id: string, status: Status) => {
            const { error } = await supabase
              .from("feature_changes")
              .update({ status, is_active: status === "approved" ? true : undefined })
              .eq("id", id);
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success(`Moved to ${status.replace("_", " ")}`);
            void load();
          };

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {columns.map((col) => {
                const cards = items.filter((it) => col.match(it.status));
                return (
                  <div
                    key={col.key}
                    className={"rounded-md border p-2.5 space-y-2 min-h-[120px] " + col.accent}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide">
                          {col.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{col.hint}</div>
                      </div>
                      <span className="text-[11px] font-semibold rounded-full bg-background border border-border px-1.5 py-0.5">
                        {cards.length}
                      </span>
                    </div>
                    {cards.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic text-center py-3">
                        Nothing here
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {cards.map((it) => (
                          <li
                            key={it.id}
                            className={
                              "rounded-md border p-2 space-y-1.5 bg-background transition-colors " +
                              (it.is_active ? "border-blue-600/60" : "border-border")
                            }
                          >
                            <div className="flex items-start gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium truncate">{it.title}</div>
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  <Badge variant="outline" className={typeBadge[it.change_type] + " text-[10px] px-1 py-0"}>
                                    {it.change_type}
                                  </Badge>
                                  <Badge variant="outline" className={priorityBadge[it.priority] + " text-[10px] px-1 py-0"}>
                                    {it.priority}
                                  </Badge>
                                  {typeof it.merit_score === "number" && (
                                    <button
                                      onClick={() =>
                                        setExpandedScore(expandedScore === it.id ? null : it.id)
                                      }
                                      className={
                                        "inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-semibold " +
                                        (it.merit_score >= 7
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                          : it.merit_score >= 5
                                            ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                            : "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300")
                                      }
                                    >
                                      <Gauge className="h-2.5 w-2.5" /> {it.merit_score.toFixed(1)}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {expandedScore === it.id && it.merit_breakdown && (
                              <div className="rounded border border-blue-500/30 bg-blue-500/5 p-1.5 space-y-1">
                                <div className="grid grid-cols-5 gap-1">
                                  {[
                                    { k: "business_value", label: "Val" },
                                    { k: "technical_feasibility", label: "Feas" },
                                    { k: "effort_efficiency", label: "Eff" },
                                    { k: "dependency_clarity", label: "Dep" },
                                    { k: "urgency", label: "Urg" },
                                  ].map(({ k, label }) => {
                                    const v = (it.merit_breakdown as unknown as Record<string, number>)[k];
                                    return (
                                      <div key={k} className="text-center">
                                        <div className="text-[9px] uppercase text-muted-foreground">{label}</div>
                                        <div className="text-[10px] font-semibold">{v?.toFixed?.(1) ?? v}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {it.merit_justification && (
                                  <div className="text-[10px] text-foreground/80 leading-snug">
                                    {it.merit_justification}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/60">
                              <div className="flex items-center gap-0.5">
                                {col.prevStatus && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => moveTo(it.id, col.prevStatus!)}
                                    title={`Move back to ${col.prevStatus.replace("_", " ")}`}
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {col.nextStatus && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={
                                      "h-6 w-6 p-0 " +
                                      (col.nextStatus === "approved"
                                        ? "text-emerald-600 hover:text-emerald-700"
                                        : "")
                                    }
                                    onClick={() => moveTo(it.id, col.nextStatus!)}
                                    title={
                                      col.nextStatus === "approved"
                                        ? "Approve"
                                        : `Move to ${col.nextStatus.replace("_", " ")}`
                                    }
                                  >
                                    {col.nextStatus === "approved" ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={"h-6 w-6 p-0 " + (it.is_active ? "text-blue-600" : "")}
                                  onClick={() => setActive(it.id, !it.is_active)}
                                  title={it.is_active ? "Remove from active batch" : "Add to active batch"}
                                >
                                  <Star className={"h-3.5 w-3.5 " + (it.is_active ? "fill-current" : "")} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                  onClick={() => remove(it.id)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
