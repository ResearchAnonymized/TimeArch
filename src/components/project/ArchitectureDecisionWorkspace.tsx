import { useState, useEffect, useCallback } from "react";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import DebatePanel from "./DebatePanel";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import CollapsibleSection from "./CollapsibleSection";
import LockAdvanceBar from "./LockAdvanceBar";
import CriticPanel from "./critic/CriticPanel";

import { useDebateData } from "@/hooks/useDebateData";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  GitBranch,
  BarChart3,
  Plus,
  Save,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Target,
  Zap,
  Lock,
  TrendingUp,
  Scale,
  FileCode,
  ArrowRight,
  Layers,
  Activity,
  Eye,
  Edit3,
  Check,
  FileDown,
  Loader2,
  Maximize2,
  X,
  Clock,
  Pencil,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { exportDiagramsAsPdf } from "@/lib/diagrams-pdf-export";
import { exportDiagramsAsPng } from "@/lib/diagrams-png-export";
import DiagramPreviewModal from "./DiagramPreviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import { useDensity } from "@/contexts/DensityContext";
import { DensityText, DensityList, DensitySection } from "./DensityControls";
import RunStageCTA from "./RunStageCTA";

// Helper to find the primary (non-evaluator/non-challenger) artifact
function findPrimaryArtifact(artifacts: any[]) {
  return (
    artifacts.find(
      (a) =>
        !a.generated_by?.includes("Evaluator") &&
        !a.generated_by?.includes("Challenger") &&
        !a.title?.startsWith("Evaluator Review:") &&
        !a.title?.startsWith("Challenger Review:"),
    ) || artifacts[0]
  );
}

interface Props {
  projectId: string;
  currentStage: number;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

// ── Rating badge helper ─────────────────────────────
function RatingBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    strong: "bg-success/20 text-success border-success/30",
    high: "bg-success/20 text-success border-success/30",
    passed: "bg-success/20 text-success border-success/30",
    adequate: "bg-primary/20 text-primary border-primary/30",
    medium: "bg-warning/20 text-warning border-warning/30",
    weak: "bg-destructive/20 text-destructive border-destructive/30",
    low: "bg-secondary text-muted-foreground border-border",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
    critical: "bg-destructive/20 text-destructive border-destructive/30",
  };
  return (
    <span
      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${colors[value] || "bg-secondary text-muted-foreground border-border"}`}
    >
      {value}
    </span>
  );
}

// ── Confidence Indicator ────────────────────────────
function ConfidenceIndicator({ level }: { level: string }) {
  const pct = level === "high" ? 90 : level === "medium" ? 60 : 30;
  const color =
    level === "high" ? "bg-success" : level === "medium" ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">{level}</span>
    </div>
  );
}

// ── Drivers Workspace (Stage 3) ─────────────────────
function DriversWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
}) {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [form, setForm] = useState({
    label: "",
    description: "",
    priority: "medium",
    category: "functional",
  });
  // Per-driver review decisions: 'accepted' | 'rejected' | 'deferred'
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "rejected" | "deferred">>(
    {},
  );
  const [editing, setEditing] = useState<{ key: string; data: any } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ key: string; reason: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [drvRes, artRes] = await Promise.all([
      supabase
        .from("architecture_drivers")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 3)
        .order("created_at", { ascending: false }),
    ]);
    if (drvRes.data) setDrivers(drvRes.data);
    if (artRes.data) setArtifacts(artRes.data);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("architecture_drivers").insert({
      project_id: projectId,
      label: form.label,
      description: form.description || null,
      priority: form.priority as any,
      category: form.category,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Driver added!");
    setForm({ label: "", description: "", priority: "medium", category: "functional" });
    setShowForm(false);
    fetchData();
  };

  const primaryArt = findPrimaryArtifact(artifacts);
  const aiDrivers = primaryArt?.content?.drivers || [];
  const aiConstraints = primaryArt?.content?.constraints || [];
  const aiQualityPriorities = primaryArt?.content?.quality_attribute_priorities || [];

  const driverKey = (d: any, i: number) => `${d.label || "drv"}-${i}`;

  // Resolve AI-provided business IDs (e.g. "NFR-005") to actual requirement UUIDs.
  // Drops any IDs that don't match a known requirement so the uuid[] insert succeeds.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const resolveSourceRequirementIds = async (raw: any): Promise<string[] | null> => {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
    const ids = raw.map(String);
    const uuids = ids.filter((s) => UUID_RE.test(s));
    const businessIds = ids.filter((s) => !UUID_RE.test(s));
    let resolved: string[] = [...uuids];
    if (businessIds.length > 0) {
      const { data } = await supabase
        .from("requirements")
        .select("id, requirement_id")
        .eq("project_id", projectId)
        .in("requirement_id", businessIds);
      if (data) resolved.push(...data.map((r: any) => r.id));
    }
    return resolved.length > 0 ? Array.from(new Set(resolved)) : null;
  };

  const acceptAiDriver = async (d: any, key: string) => {
    if (!user) return;
    const sourceIds = await resolveSourceRequirementIds(d.source_requirements);
    const { error } = await supabase.from("architecture_drivers").insert({
      project_id: projectId,
      label: d.label,
      description: d.description || d.impact || null,
      priority: (d.priority || "medium") as any,
      category: d.category || "functional",
      created_by: user.id,
      source_requirement_ids: sourceIds,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDecisions((prev) => ({ ...prev, [key]: "accepted" }));
    toast.success(`Accepted: ${d.label}`);
    fetchData();
  };

  const rejectAiDriver = (key: string, label: string, reason: string) => {
    setDecisions((prev) => ({ ...prev, [key]: "rejected" }));
    toast.success(`Rejected: ${label}${reason ? ` — ${reason}` : ""}`);
    setRejectDialog(null);
  };

  const deferAiDriver = (key: string, label: string) => {
    setDecisions((prev) => ({ ...prev, [key]: "deferred" }));
    toast.info(`Deferred: ${label}`);
  };

  const undoDecision = (key: string) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const acceptAllAiDrivers = async () => {
    if (!user || !aiDrivers.length) return;
    const pending = aiDrivers
      .map((d: any, i: number) => ({ d, key: driverKey(d, i) }))
      .filter(({ key }) => !decisions[key]);
    if (pending.length === 0) {
      toast.info("No pending drivers to accept");
      return;
    }
    let failed = 0;
    for (const { d } of pending) {
      const sourceIds = await resolveSourceRequirementIds(d.source_requirements);
      const { error } = await supabase.from("architecture_drivers").insert({
        project_id: projectId,
        label: d.label,
        description: d.description || d.impact || null,
        priority: (d.priority || "medium") as any,
        category: d.category || "functional",
        created_by: user.id,
        source_requirement_ids: sourceIds,
      });
      if (error) failed++;
    }
    const newDecisions = { ...decisions };
    pending.forEach(({ key }) => {
      newDecisions[key] = "accepted";
    });
    setDecisions(newDecisions);
    if (failed > 0)
      toast.warning(
        `Accepted ${pending.length - failed}/${pending.length} drivers (${failed} failed)`,
      );
    else toast.success(`Accepted ${pending.length} pending drivers`);
    fetchData();
  };

  const rejectAllPending = () => {
    const next = { ...decisions };
    let count = 0;
    aiDrivers.forEach((d: any, i: number) => {
      const key = driverKey(d, i);
      if (!next[key]) {
        next[key] = "rejected";
        count++;
      }
    });
    setDecisions(next);
    if (count) toast.success(`Rejected ${count} pending drivers`);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <span className="text-sm font-display font-semibold">
            {drivers.length} Drivers Identified
          </span>
        </div>
        {aiDrivers.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {aiDrivers.length} AI-extracted (pending review)
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onRunStage && (
            <RunStageCTA
              stageLabel="Driver Extraction"
              onRun={onRunStage}
              running={stageRunning}
              className="inline"
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-1"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3 w-3" /> Add Manual
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> Saved Drivers
          </TabsTrigger>
          <TabsTrigger
            value="ai_extracted"
            className="text-xs gap-1.5"
            disabled={aiDrivers.length === 0}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Analysis
            {aiDrivers.length > 0 && (
              <span className="ml-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="quality"
            className="text-xs gap-1.5"
            disabled={aiQualityPriorities.length === 0}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Quality Attrs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {/* Manual form */}
          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmit}
                className="rounded-lg border p-4 bg-card space-y-4 mb-4 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="functional">Functional</SelectItem>
                        <SelectItem value="non_functional">Non-Functional</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger className="mt-1">
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
                </div>
                <div>
                  <Label className="text-xs">Driver Label</Label>
                  <Input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="e.g., High Availability"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Description & Impact</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Why is this an architectural driver? How does it impact design?"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="gap-2">
                    <Save className="h-3 w-3" /> Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Saved drivers */}
          {drivers.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-dashed">
              <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">
                No architecture drivers identified yet.
              </p>
              <p className="text-xs text-muted-foreground">
                Run the AI agent from the Governance panel, or add drivers manually.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-display font-semibold text-sm">{d.label}</h4>
                    <Badge
                      variant={
                        d.priority === "critical"
                          ? "destructive"
                          : d.priority === "high"
                            ? "default"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {d.priority}
                    </Badge>
                    {d.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {d.category}
                      </Badge>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  )}
                  {d.source_requirement_ids?.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {d.source_requirement_ids.map((rid: string) => (
                        <span
                          key={rid}
                          className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded"
                        >
                          {rid}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai_extracted" className="mt-4">
          {aiDrivers.length > 0 && (
            <div className="space-y-4">
              {primaryArt?.content?.summary && (
                <div className="bg-primary/5 rounded-lg p-3 mb-3">
                  <p className="text-xs text-foreground">{primaryArt.content.summary}</p>
                </div>
              )}

              {(() => {
                const counts = aiDrivers.reduce((acc: any, d: any, i: number) => {
                  const s = decisions[driverKey(d, i)] || "pending";
                  acc[s] = (acc[s] || 0) + 1;
                  return acc;
                }, {});
                const pendingCount = counts.pending || 0;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display font-semibold text-sm">AI-Identified Drivers</h4>
                      <div className="flex items-center gap-1.5 ml-1">
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {pendingCount} pending
                          </Badge>
                        )}
                        {counts.accepted > 0 && (
                          <Badge className="text-[9px] gap-1 bg-success/15 text-success border-success/30 border">
                            <Check className="h-2.5 w-2.5" />
                            {counts.accepted} accepted
                          </Badge>
                        )}
                        {counts.rejected > 0 && (
                          <Badge className="text-[9px] gap-1 bg-destructive/15 text-destructive border-destructive/30 border">
                            <X className="h-2.5 w-2.5" />
                            {counts.rejected} rejected
                          </Badge>
                        )}
                        {counts.deferred > 0 && (
                          <Badge className="text-[9px] gap-1 bg-warning/15 text-warning border-warning/30 border">
                            <Clock className="h-2.5 w-2.5" />
                            {counts.deferred} deferred
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1"
                        onClick={acceptAllAiDrivers}
                        disabled={pendingCount === 0}
                      >
                        <Check className="h-3 w-3" /> Accept All Pending ({pendingCount})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                        onClick={rejectAllPending}
                        disabled={pendingCount === 0}
                      >
                        <X className="h-3 w-3" /> Reject All Pending
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {aiDrivers.map((d: any, i: number) => {
                const key = driverKey(d, i);
                const status = decisions[key];
                const statusBg =
                  status === "accepted"
                    ? "border-success/40 bg-success/5"
                    : status === "rejected"
                      ? "border-destructive/40 bg-destructive/5 opacity-70"
                      : status === "deferred"
                        ? "border-warning/40 bg-warning/5"
                        : "bg-card hover:border-primary/30";
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`p-3 rounded-lg border transition-colors ${statusBg}`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-display font-semibold text-xs">{d.label}</span>
                      <RatingBadge value={d.priority || "medium"} />
                      {d.category && (
                        <Badge variant="outline" className="text-[9px]">
                          {d.category}
                        </Badge>
                      )}
                      {status && (
                        <Badge
                          className={`text-[9px] gap-1 border ${
                            status === "accepted"
                              ? "bg-success/15 text-success border-success/30"
                              : status === "rejected"
                                ? "bg-destructive/15 text-destructive border-destructive/30"
                                : "bg-warning/15 text-warning border-warning/30"
                          }`}
                        >
                          {status === "accepted" ? (
                            <Check className="h-2.5 w-2.5" />
                          ) : status === "rejected" ? (
                            <X className="h-2.5 w-2.5" />
                          ) : (
                            <Clock className="h-2.5 w-2.5" />
                          )}
                          {status}
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        {!status ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1 text-success hover:text-success hover:bg-success/10"
                              onClick={() => acceptAiDriver(d, key)}
                              title="Accept this driver"
                            >
                              <Check className="h-3 w-3" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => setEditing({ key, data: { ...d } })}
                              title="Edit before accepting"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1 text-warning hover:text-warning hover:bg-warning/10"
                              onClick={() => deferAiDriver(key, d.label)}
                              title="Defer to later review"
                            >
                              <Clock className="h-3 w-3" /> Defer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectDialog({ key, reason: "" })}
                              title="Reject with reason"
                            >
                              <X className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={() => undoDecision(key)}
                            title="Undo decision"
                          >
                            <Undo2 className="h-3 w-3" /> Undo
                          </Button>
                        )}
                      </div>
                    </div>
                    {d.description && (
                      <p className="text-[11px] text-muted-foreground">{d.description}</p>
                    )}
                    {d.impact && (
                      <p className="text-[11px] text-muted-foreground mt-1 italic">
                        Impact: {d.impact}
                      </p>
                    )}
                    {d.source_requirements?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {d.source_requirements.map((r: string) => (
                          <span
                            key={r}
                            className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Constraints */}
              {aiConstraints.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Constraints (
                    {aiConstraints.length})
                  </h4>
                  {aiConstraints.map((c: any, i: number) => (
                    <div key={i} className="p-2 rounded border bg-card mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">{c.label}</span>
                        {c.type && (
                          <Badge variant="outline" className="text-[9px]">
                            {c.type}
                          </Badge>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quality" className="mt-4">
          {aiQualityPriorities.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-display font-semibold text-sm mb-3">
                Quality Attribute Priorities
              </h4>
              {aiQualityPriorities.map((qa: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-semibold text-xs capitalize">
                      {qa.attribute}
                    </span>
                    <RatingBadge value={qa.priority} />
                  </div>
                  {qa.rationale && (
                    <p className="text-[11px] text-muted-foreground">{qa.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Driver dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Driver Before Accepting</DialogTitle>
            <DialogDescription>
              Refine the AI-extracted driver. Changes apply only when you accept.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input
                  value={editing.data.label || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, data: { ...editing.data, label: e.target.value } })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={3}
                  value={editing.data.description || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, description: e.target.value },
                    })
                  }
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={editing.data.priority || "medium"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, data: { ...editing.data, priority: v } })
                    }
                  >
                    <SelectTrigger className="mt-1">
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
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={editing.data.category || "functional"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, data: { ...editing.data, category: v } })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="non_functional">Non-Functional</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editing) return;
                await acceptAiDriver(editing.data, editing.key);
                setEditing(null);
              }}
              className="gap-1"
            >
              <Check className="h-3 w-3" /> Save & Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Driver</DialogTitle>
            <DialogDescription>
              Provide a brief rationale for the audit trail (optional).
            </DialogDescription>
          </DialogHeader>
          {rejectDialog && (
            <Textarea
              rows={3}
              placeholder="e.g. Out of scope for MVP, duplicates DRV-002, not architecturally significant…"
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectDialog) return;
                const drv = aiDrivers.find(
                  (d: any, i: number) => driverKey(d, i) === rejectDialog.key,
                );
                rejectAiDriver(rejectDialog.key, drv?.label || "driver", rejectDialog.reason);
              }}
              className="gap-1"
            >
              <X className="h-3 w-3" /> Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Score Dot visualization ─────────────────────────
function normalizeRating(raw: string, invertScale = false): number {
  if (!raw) return 3;
  const s = raw.toLowerCase().trim();
  // Exact matches first
  const exact: Record<string, number> = {
    strong: 5,
    high: 5,
    passed: 5,
    excellent: 5,
    very_high: 5,
    "very high": 5,
    good: 4,
    "above average": 4,
    moderate_high: 4,
    adequate: 3,
    medium: 3,
    moderate: 3,
    average: 3,
    fair: 3,
    neutral: 3,
    mixed: 3,
    ok: 3,
    decent: 3,
    below_average: 2,
    "below average": 2,
    limited: 2,
    poor: 2,
    challenging: 2,
    difficult: 2,
    weak: 1,
    low: 1,
    minimal: 1,
    very_low: 1,
    "very low": 1,
    insufficient: 1,
    small: 1,
    simple: 1,
    failed: 0,
    critical: 0,
    none: 0,
    impossible: 0,
  };
  let score: number | null = null;
  if (exact[s] !== undefined) {
    score = exact[s];
  } else if (/strong|excellent|very.?high|outstanding|superior/i.test(s)) {
    score = 5;
  } else if (/good|above.?average|favorable|positive/i.test(s)) {
    score = 4;
  } else if (/adequate|medium|moderate|average|fair|reasonable|acceptable/i.test(s)) {
    score = 3;
  } else if (/below|limited|poor|challenging|difficult|concern/i.test(s)) {
    score = 2;
  } else if (/weak|low|minimal|insufficient|lacking|problematic|small|simple/i.test(s)) {
    score = 1;
  } else if (/large|big|extensive|significant|substantial/i.test(s)) {
    score = 4;
  } else if (/fail|critical|none|impossible/i.test(s)) {
    score = 0;
  } else {
    // Try parsing numeric values (e.g., "3", "4/5", "2.5")
    const numMatch = s.match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const n = parseFloat(numMatch[1]);
      score = Math.min(5, Math.max(0, Math.round(n <= 5 ? n : n / 2)));
    }
  }
  if (score === null) score = 3; // safe default
  // For inverted attributes (complexity, cost), low raw = good (5), high raw = bad (1)
  if (invertScale) score = 5 - score;
  return Math.min(5, Math.max(0, score));
}

function ScoreDots({ rating, invert }: { rating: string; invert?: boolean }) {
  const filled = normalizeRating(rating, invert);
  const color =
    filled >= 4
      ? "bg-success"
      : filled >= 3
        ? "bg-primary"
        : filled >= 2
          ? "bg-warning"
          : "bg-destructive";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full transition-colors ${i < filled ? color : "bg-secondary"}`}
        />
      ))}
    </div>
  );
}

// ── Architectural Style Recommender Workspace (Stage 4) ────────
function StyleRecommendationWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
}) {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"recommendation" | "matrix" | "alternatives">(
    "recommendation",
  );
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [projectName, setProjectName] = useState<string>("Architecture Project");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setProjectName(data.name);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 4)
        .order("created_at", { ascending: false });
      if (data) setArtifacts(data);
    };
    fetch();
  }, [projectId, refreshKey]);

  const content = recoverArtifactContent(findPrimaryArtifact(artifacts)?.content);
  if (!content) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-card/30"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <GitBranch className="h-8 w-8 text-primary/40" />
        </div>
        <p className="text-muted-foreground text-sm font-medium mb-1.5">
          No architectural style evaluation yet
        </p>
        <RunStageCTA stageLabel="Style Evaluation" onRun={onRunStage} running={stageRunning} />
      </motion.div>
    );
  }

  const rec = content.recommended_style;
  const alternatives = content.alternatives_considered || [];
  const matrix = content.style_comparison_matrix || [];
  const warnings = content.warnings || [];
  const considerations = content.key_considerations || [];
  const diagrams = extractMermaidDiagrams(content);

  return (
    <div className="space-y-5">
      <CollapsibleSection
        storageKey={`stage4-workspace-${projectId}`}
        defaultOpen={true}
        icon={<Target className="h-3.5 w-3.5 text-primary" />}
        title={rec?.name ? `Recommendation Workspace — ${rec.name}` : "Recommendation Workspace"}
      >
        {/* Tab Navigation — pill style */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/40 border border-border/40">
          {[
            { key: "recommendation" as const, label: "Recommendation", icon: Target },
            {
              key: "matrix" as const,
              label: "Suitability Matrix",
              icon: Scale,
              disabled: matrix.length === 0,
            },
            {
              key: "alternatives" as const,
              label: "Alternatives",
              icon: Layers,
              disabled: alternatives.length === 0,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveView(tab.key)}
              disabled={tab.disabled}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center
                ${activeView === tab.key ? "bg-card shadow-sm text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"}
                ${tab.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Diagrams (if any) — collapsible */}
        {diagrams.length > 0 && (
          <CollapsibleSection
            storageKey={`stage4-diagrams-${projectId}`}
            defaultOpen={true}
            icon={<GitBranch className="h-3.5 w-3.5 text-primary" />}
            title="Architecture Diagrams"
            meta={`(${diagrams.length})`}
            actions={
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => {
                    setPreviewIndex(0);
                    setPreviewOpen(true);
                  }}
                  title="Preview at high resolution"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-[11px]"
                  disabled={exportingPng || exportingPdf}
                  onClick={async () => {
                    setExportingPng(true);
                    try {
                      const { data: project } = await supabase
                        .from("projects")
                        .select("name")
                        .eq("id", projectId)
                        .maybeSingle();
                      await exportDiagramsAsPng(diagrams, {
                        projectName: project?.name || "Architecture Project",
                      });
                      toast.success(
                        `Exported ${diagrams.length} diagram${diagrams.length === 1 ? "" : "s"} as PNG`,
                      );
                    } catch (err: any) {
                      toast.error(err?.message || "PNG export failed");
                    } finally {
                      setExportingPng(false);
                    }
                  }}
                >
                  {exportingPng ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {exportingPng ? "Exporting…" : "PNG"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-[11px]"
                  disabled={exportingPdf || exportingPng}
                  onClick={async () => {
                    setExportingPdf(true);
                    try {
                      const { data: project } = await supabase
                        .from("projects")
                        .select("name")
                        .eq("id", projectId)
                        .maybeSingle();
                      await exportDiagramsAsPdf(diagrams, {
                        projectName: project?.name || "Architecture Project",
                        reportTitle: "Style Recommender — Architecture Diagrams",
                      });
                      toast.success(
                        `Exported ${diagrams.length} diagram${diagrams.length === 1 ? "" : "s"} to PDF`,
                      );
                    } catch (err: any) {
                      toast.error(err?.message || "PDF export failed");
                    } finally {
                      setExportingPdf(false);
                    }
                  }}
                >
                  {exportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {exportingPdf ? "Building PDF…" : "PDF"}
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              {diagrams.map((d, i) => (
                <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {diagrams.length > 0 && (
          <DiagramPreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            diagrams={diagrams}
            projectName={projectName}
            reportTitle="Style Recommender — Architecture Diagrams"
            initialIndex={previewIndex}
          />
        )}

        <AnimatePresence mode="wait">
          {/* ─── Recommendation View ─── */}
          {activeView === "recommendation" && rec && (
            <motion.div
              key="rec"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Hero Card — compact, scannable */}
              <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-primary/5" />
                <div className="relative flex items-start gap-4">
                  {/* Icon */}
                  <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono text-primary uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                        Recommended
                      </span>
                      {rec.confidence && (
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border
                        ${
                          rec.confidence === "high"
                            ? "text-success bg-success/10 border-success/20"
                            : rec.confidence === "medium"
                              ? "text-warning bg-warning/10 border-warning/20"
                              : "text-muted-foreground bg-secondary border-border"
                        }`}
                        >
                          {rec.confidence} confidence
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-bold text-foreground tracking-tight">
                      {rec.name}
                    </h3>
                    {rec.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                        <DensityText compactLength={100}>{rec.description}</DensityText>
                      </p>
                    )}
                  </div>
                </div>

                {/* Rationale — concise block */}
                {rec.rationale && (
                  <div className="mt-4 p-3 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50">
                    <p className="text-[9px] font-mono text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Decision Rationale
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      <DensityText compactLength={150}>{rec.rationale}</DensityText>
                    </p>
                  </div>
                )}
              </div>

              {/* Warnings — compact inline */}
              {warnings.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-warning/30 bg-warning/5">
                  <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {warnings.map((w: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Considerations — numbered chips */}
              {considerations.length > 0 && (
                <DensitySection
                  label="Key Considerations"
                  count={considerations.length}
                  icon={<Eye className="h-3.5 w-3.5 text-primary" />}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <DensityList
                      items={considerations}
                      label="Considerations"
                      standardLimit={4}
                      renderItem={(c: string, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30"
                        >
                          <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[9px] font-mono text-primary font-bold">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <DensityText compactLength={80}>{c}</DensityText>
                          </p>
                        </div>
                      )}
                    />
                  </div>
                </DensitySection>
              )}
            </motion.div>
          )}

          {/* ─── Suitability Matrix View ─── */}
          {activeView === "matrix" &&
            matrix.length > 0 &&
            (() => {
              // 7 quality dimensions per ISO 25010 — `invert` means a "low" raw rating
              // is actually GOOD for the system (e.g., low complexity = good).
              const DIMS = [
                { key: "scalability", label: "Scalability", invert: false },
                { key: "maintainability", label: "Maintainability", invert: false },
                { key: "complexity", label: "Complexity", invert: true },
                { key: "team_fit", label: "Team Fit", invert: false },
                { key: "cost", label: "Cost", invert: true },
                { key: "time_to_market", label: "Time to Market", invert: false },
                { key: "testability", label: "Testability", invert: false },
              ];
              const MAX_TOTAL = DIMS.length * 5;

              // Compute totals (using normalizeRating + invert) and rank.
              const scored = matrix.map((row: any) => {
                const dimScores = DIMS.map((d) => ({
                  ...d,
                  raw: row[d.key],
                  score: normalizeRating(row[d.key] || "medium", d.invert),
                }));
                const total = dimScores.reduce((s, d) => s + d.score, 0);
                return { row, dimScores, total };
              });
              // Stable sort: highest total first, recommended ties win.
              const ranked = [...scored].sort((a, b) => {
                if (b.total !== a.total) return b.total - a.total;
                if (a.row.style === rec?.name) return -1;
                if (b.row.style === rec?.name) return 1;
                return 0;
              });
              // Runner-ups = ranked entries that are NOT the recommended style.
              const runnerUps = ranked.filter((r) => r.row.style !== rec?.name).slice(0, 3);

              const pctColor = (pct: number) =>
                pct >= 75
                  ? "text-success"
                  : pct >= 55
                    ? "text-primary"
                    : pct >= 35
                      ? "text-warning"
                      : "text-destructive";
              const pctBg = (pct: number) =>
                pct >= 75
                  ? "bg-success"
                  : pct >= 55
                    ? "bg-primary"
                    : pct >= 35
                      ? "bg-warning"
                      : "bg-destructive";

              return (
                <motion.div
                  key="matrix"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* ── Top-3 Runner-Up Summary ────────────────────────── */}
                  {runnerUps.length > 0 && (
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="px-4 py-2.5 border-b bg-secondary/20 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <h4 className="font-display font-semibold text-sm">
                          Top {runnerUps.length} Runner-Up Style{runnerUps.length === 1 ? "" : "s"}
                        </h4>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          Closest alternatives by composite score
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
                        {runnerUps.map((r, i) => {
                          const pct = Math.round((r.total / MAX_TOTAL) * 100);
                          return (
                            <motion.div
                              key={r.row.style}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-3.5"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="h-6 w-6 rounded-full bg-secondary text-[10px] font-mono font-bold flex items-center justify-center text-muted-foreground">
                                  #{i + 2}
                                </span>
                                <span className="font-display font-semibold text-sm truncate">
                                  {r.row.style}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1.5 mb-1.5">
                                <span
                                  className={`text-2xl font-display font-bold ${pctColor(pct)}`}
                                >
                                  {r.total}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  / {MAX_TOTAL}
                                </span>
                                <span className={`ml-auto text-[10px] font-mono ${pctColor(pct)}`}>
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.05 }}
                                  className={`h-full ${pctBg(pct)}`}
                                />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Full per-style × per-driver scoring matrix ─────── */}
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b bg-secondary/20 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="font-display font-semibold text-sm flex items-center gap-2">
                          <Scale className="h-4 w-4 text-primary" /> Suitability Matrix
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Scored against ISO 25010 quality attributes — sorted by composite score
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-success" /> Strong
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-primary" /> Adequate
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-warning" /> Limited
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-destructive" /> Weak
                        </span>
                      </div>
                    </div>

                    {/* Desktop: dense table view; Mobile: card fallback handled via overflow-x */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-separate border-spacing-0 min-w-[760px]">
                        <thead>
                          <tr className="bg-secondary/10">
                            <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40 sticky left-0 bg-secondary/10 z-10">
                              Rank · Style
                            </th>
                            {DIMS.map((d) => (
                              <th
                                key={d.key}
                                className="text-center px-2 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40"
                              >
                                {d.label}
                                {d.invert && (
                                  <span
                                    className="ml-1 text-[8px] text-muted-foreground/60"
                                    title="Inverted: lower raw value is better"
                                  >
                                    ↓
                                  </span>
                                )}
                              </th>
                            ))}
                            <th className="text-center px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranked.map(({ row, dimScores, total }, i) => {
                            const isRec = row.style === rec?.name;
                            const pct = Math.round((total / MAX_TOTAL) * 100);
                            return (
                              <motion.tr
                                key={row.style + i}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className={`group ${isRec ? "bg-primary/5" : "hover:bg-secondary/20"}`}
                              >
                                <td
                                  className={`px-3 py-2 border-b border-border/30 sticky left-0 z-10 ${isRec ? "bg-primary/5" : "bg-card group-hover:bg-secondary/20"}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`h-5 w-5 rounded-full text-[9px] font-mono font-bold flex items-center justify-center flex-shrink-0
                                  ${isRec ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                                    >
                                      {i + 1}
                                    </span>
                                    <span className="font-display font-semibold whitespace-nowrap">
                                      {row.style}
                                    </span>
                                    {isRec && (
                                      <span className="text-[8px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20 whitespace-nowrap">
                                        ★ CHOSEN
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {dimScores.map((d) => (
                                  <td
                                    key={d.key}
                                    className="px-2 py-2 border-b border-border/30 text-center"
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <ScoreDots rating={d.raw || "medium"} invert={d.invert} />
                                      <span className="text-[9px] font-mono text-muted-foreground/70">
                                        {d.raw ? String(d.raw) : "—"}
                                      </span>
                                    </div>
                                  </td>
                                ))}
                                <td className="px-3 py-2 border-b border-border/30 text-center min-w-[88px]">
                                  <div className="flex flex-col items-center gap-1">
                                    <span
                                      className={`text-sm font-display font-bold ${pctColor(pct)}`}
                                    >
                                      {total}
                                    </span>
                                    <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                                      <div
                                        className={`h-full ${pctBg(pct)}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-mono text-muted-foreground">
                                      {pct}%
                                    </span>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2 border-t border-border/40 bg-secondary/10 text-[10px] text-muted-foreground">
                      Composite score = sum of normalized ratings across {DIMS.length} dimensions
                      (max {MAX_TOTAL}). Inverted dimensions (Complexity, Cost) are scored so that{" "}
                      <em>lower raw value = higher contribution</em>.
                    </div>
                  </div>
                </motion.div>
              );
            })()}

          {/* ─── Alternatives Analysis View ─── */}
          {activeView === "alternatives" && alternatives.length > 0 && (
            <motion.div
              key="alts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {alternatives.map((alt: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border bg-card overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-border/40 bg-secondary/10 flex items-center justify-between">
                    <h5 className="font-display font-semibold text-sm">{alt.name}</h5>
                    {alt.description && (
                      <p className="text-[10px] text-muted-foreground max-w-xs truncate">
                        {alt.description}
                      </p>
                    )}
                  </div>
                  {/* Strengths vs Weaknesses side-by-side */}
                  <div className="grid grid-cols-2 divide-x divide-border/40">
                    <div className="p-3">
                      <p className="text-[9px] font-semibold text-success uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Strengths
                      </p>
                      <ul className="space-y-1">
                        {alt.strengths?.map((s: string, j: number) => (
                          <li
                            key={j}
                            className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-success mt-0.5 flex-shrink-0">✓</span>
                            <span className="line-clamp-2">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3">
                      <p className="text-[9px] font-semibold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Weaknesses
                      </p>
                      <ul className="space-y-1">
                        {alt.weaknesses?.map((w: string, j: number) => (
                          <li
                            key={j}
                            className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-destructive mt-0.5 flex-shrink-0">✗</span>
                            <span className="line-clamp-2">{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {/* Elimination Rationale */}
                  {alt.why_not_chosen && (
                    <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground/70">Eliminated: </span>
                        {alt.why_not_chosen}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleSection>
    </div>
  );
}

// ── Tradeoff Analysis Workspace (Stage 5) ───────────
function TradeoffWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: {
  projectId: string;
  refreshKey?: number;
  onRunStage?: () => void;
  stageRunning?: boolean;
}) {
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<"decision" | "tradeoffs" | "risks">("decision");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 5)
        .order("created_at", { ascending: false });
      if (data) setArtifacts(data);
    };
    fetch();
  }, [projectId, refreshKey]);

  const content = recoverArtifactContent(findPrimaryArtifact(artifacts)?.content);
  if (!content) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-card/30"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Scale className="h-8 w-8 text-primary/40" />
        </div>
        <p className="text-muted-foreground text-sm font-medium mb-1.5">
          No architecture evaluation yet
        </p>
        <RunStageCTA stageLabel="Tradeoff Evaluation" onRun={onRunStage} running={stageRunning} />
      </motion.div>
    );
  }

  const chosen = content.chosen_architecture;
  const tradeoffs = content.tradeoff_analysis || {};
  const risks = content.risks || [];
  const strengths = content.strengths || [];
  const weaknesses = content.weaknesses || [];
  const overCheck = content.overengineering_check;
  const diagrams = extractMermaidDiagrams(content);

  const tradeoffEntries = Object.entries(tradeoffs).map(([key, val]: [string, any]) => ({
    attribute: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    rating: val?.rating || "adequate",
    assessment: val?.assessment || "",
  }));

  const hasRisks = risks.length > 0 || !!overCheck;

  return (
    <div className="space-y-5">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/40 border border-border/40">
        {[
          { key: "decision" as const, label: "Decision", icon: Target },
          {
            key: "tradeoffs" as const,
            label: "Tradeoff Matrix",
            icon: Activity,
            disabled: tradeoffEntries.length === 0,
          },
          {
            key: "risks" as const,
            label: "Risks & Gaps",
            icon: AlertTriangle,
            disabled: !hasRisks,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && setActiveView(tab.key)}
            disabled={tab.disabled}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all flex-1 justify-center
              ${activeView === tab.key ? "bg-card shadow-sm text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"}
              ${tab.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Diagrams */}
      {diagrams.length > 0 && (
        <div className="space-y-3">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ─── Decision View ─── */}
        {activeView === "decision" && (
          <motion.div
            key="dec"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Chosen Architecture Hero */}
            {chosen && (
              <div className="rounded-xl border-2 border-success/20 bg-gradient-to-br from-success/5 via-transparent to-transparent p-5 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-success/5" />
                <div className="relative flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono text-success uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-success/10 border border-success/20">
                        Final Decision
                      </span>
                      {chosen.confidence_level && (
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border
                          ${
                            chosen.confidence_level === "high"
                              ? "text-success bg-success/10 border-success/20"
                              : chosen.confidence_level === "medium"
                                ? "text-warning bg-warning/10 border-warning/20"
                                : "text-muted-foreground bg-secondary border-border"
                          }`}
                        >
                          {chosen.confidence_level} confidence
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-bold text-foreground tracking-tight">
                      {chosen.style}
                    </h3>
                    {chosen.pattern && (
                      <p className="text-[11px] font-mono text-success/70 mt-0.5">
                        {chosen.pattern}
                      </p>
                    )}
                  </div>
                </div>
                {chosen.rationale && (
                  <div className="mt-4 p-3 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50">
                    <p className="text-[9px] font-mono text-success uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Decision Rationale
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed">
                      <DensityText compactLength={150}>{chosen.rationale}</DensityText>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Overengineering Check */}
            {overCheck && (
              <div
                className={`flex items-start gap-2.5 p-3 rounded-lg border ${overCheck.detected ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}`}
              >
                {overCheck.detected ? (
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-display font-semibold">
                    {overCheck.detected ? "Overengineering Detected" : "No Overengineering"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <DensityText compactLength={100}>{overCheck.details}</DensityText>
                  </p>
                </div>
              </div>
            )}

            {/* Strengths vs Weaknesses */}
            {(strengths.length > 0 || weaknesses.length > 0) && (
              <div className="grid grid-cols-2 divide-x divide-border rounded-xl border bg-card overflow-hidden">
                <div className="p-3">
                  <p className="text-[9px] font-semibold text-success uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {strengths.map((s: string, i: number) => (
                      <li
                        key={i}
                        className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-success mt-0.5 flex-shrink-0">✓</span>
                        <span className="line-clamp-2">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3">
                  <p className="text-[9px] font-semibold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Weaknesses
                  </p>
                  <ul className="space-y-1">
                    {weaknesses.map((w: string, i: number) => (
                      <li
                        key={i}
                        className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-destructive mt-0.5 flex-shrink-0">✗</span>
                        <span className="line-clamp-2">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Evaluation Summary */}
            {content.evaluation_summary && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[9px] font-mono text-primary uppercase tracking-wider mb-1">
                  Evaluation Summary
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  <DensityText compactLength={200}>{content.evaluation_summary}</DensityText>
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Tradeoff Matrix View ─── */}
        {activeView === "tradeoffs" && tradeoffEntries.length > 0 && (
          <motion.div
            key="tradeoffs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-secondary/20 flex items-center justify-between">
                <div>
                  <h4 className="font-display font-semibold text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Quality Attribute Tradeoffs
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ATAM sensitivity & tradeoff point analysis
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success" /> Strong
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Adequate
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> Weak
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                {tradeoffEntries.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="p-3 rounded-lg border border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-display font-semibold text-sm min-w-[140px]">
                        {t.attribute}
                      </span>
                      <ScoreDots rating={t.rating} />
                      <RatingBadge value={t.rating} />
                    </div>
                    {t.assessment && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        <DensityText compactLength={100}>{t.assessment}</DensityText>
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Risks View ─── */}
        {activeView === "risks" && (
          <motion.div
            key="risks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {risks.map((r: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-display font-semibold text-sm">{r.risk}</span>
                  </div>
                  <ScoreDots rating={r.severity || "medium"} />
                </div>
                {r.mitigation && (
                  <div className="px-4 py-2.5 border-t border-border/40 bg-secondary/10">
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground/70">Mitigation: </span>
                      {r.mitigation}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}

            {content.dissenting_considerations?.length > 0 && (
              <div className="rounded-lg border bg-secondary/20 p-4">
                <h4 className="font-display font-semibold text-xs mb-2 uppercase tracking-wider text-muted-foreground">
                  Counter-Arguments
                </h4>
                <ul className="space-y-1">
                  {content.dissenting_considerations.map((d: string, i: number) => (
                    <li
                      key={i}
                      className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                    >
                      <span className="text-muted-foreground/50 mt-0.5">•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {content.decision_rationale && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[9px] font-mono text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileCode className="h-3 w-3" /> Decision Rationale
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  <DensityText compactLength={200}>{content.decision_rationale}</DensityText>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Architecture Decision Workspace ────────────
export default function ArchitectureDecisionWorkspace({
  projectId,
  currentStage,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const stageLabels: Record<number, string> = {
    3: "Architecture Drivers",
    4: "Architectural Style Recommender",
    5: "Architecture Tradeoff Evaluation",
  };

  const renderWorkspace = () => {
    switch (currentStage) {
      case 3:
        return (
          <DriversWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            onRunStage={onRunStage}
            stageRunning={stageRunning}
          />
        );
      case 4:
        return (
          <StyleRecommendationWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            onRunStage={onRunStage}
            stageRunning={stageRunning}
          />
        );
      case 5:
        return (
          <TradeoffWorkspace
            projectId={projectId}
            refreshKey={refreshKey}
            onRunStage={onRunStage}
            stageRunning={stageRunning}
          />
        );
      default:
        return null;
    }
  };

  // Stage 4 & 5 use the rich DebatePanel for the Challenger Architect's
  // critique of the recommendation, followed by the HITL ChallengerReviewPanel
  // where the architect curates concerns and triggers a refinement cycle.
  const showDebate = currentStage === 4 || currentStage === 5;
  // Stage 4: Challenger critiques the *style recommendation*.
  // Stage 5: Challenger critiques the *tradeoff evaluation & final decision*
  //          (ATAM sensitivity/tradeoff points, risk balance, ADR rationale).
  const showChallengerReview = currentStage === 4 || currentStage === 5;

  const handleRefine = async (bundle: any) => {
    await onRunStage?.({ refinement: bundle });
  };

  const handleChallenge = async () => {
    await onRunStage?.({ challenge_only: true });
  };

  return (
    <div className="space-y-6">
      {STAGE_INTROS[currentStage] && (
        <StageIntro {...STAGE_INTROS[currentStage]} title={stageLabels[currentStage] || ""} />
      )}
      {renderWorkspace()}
      {currentStage === 3 && (
        <CriticPanel projectId={projectId} stage={3} itemTypeLabel="drivers" />
      )}
      {showDebate && (
        <DebatePanelWrapper
          projectId={projectId}
          stage={currentStage}
          refreshKey={refreshKey}
          stageName={stageLabels[currentStage] || ""}
        />
      )}
      {showChallengerReview && (
        <CollapsibleChallengerSection
          projectId={projectId}
          stage={currentStage}
          refreshKey={refreshKey}
          onRunStage={onRunStage}
          stageRunning={stageRunning}
          onAdvance={onAdvance}
          defaultCollapsed={true}
        />
      )}
      {/* Bottom Lock & Advance bar — mirrors the sticky top bar so the
          architect can approve & advance without scrolling back up. */}
      <LockAdvanceBar
        projectId={projectId}
        stage={currentStage}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}

function DebatePanelWrapper({
  projectId,
  stage,
  refreshKey,
  stageName,
}: {
  projectId: string;
  stage: number;
  refreshKey?: number;
  stageName: string;
}) {
  const { challengerData, validationData, ragSources } = useDebateData(
    projectId,
    stage,
    refreshKey,
  );
  if (!challengerData && !validationData) return null;
  return (
    <DebatePanel
      challengerData={challengerData}
      validationData={validationData}
      ragSources={ragSources}
      stageName={stageName}
    />
  );
}
