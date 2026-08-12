/**
 * Stage 4 — Architecture Drivers (Studio native).
 *
 * Clean Clause-style surface built on StageShell. Lets the user:
 *   - See all captured drivers at a glance (grouped by category)
 *   - Add a new driver inline (label + category + priority)
 *   - Delete drivers
 *   - Advance to Stage 5 once at least 3 drivers exist across ≥2 categories
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Target, ShieldAlert, Gauge, Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { cn } from "@/lib/utils";
import RunAgentButton from "@/components/studio/RunAgentButton";

interface Driver {
  id: string;
  label: string;
  description: string | null;
  category: string | null;
  priority: "low" | "medium" | "high" | null;
}

interface RequirementGate {
  total: number;
  locked: number;
}

interface LastRun {
  status: string;
  agent_name: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  output: { stage4_metrics?: { deleted: number; inserted: number } } | null;
}

const CATEGORIES = [
  { key: "quality", label: "Quality attribute", icon: Gauge },
  { key: "constraint", label: "Constraint", icon: ShieldAlert },
  { key: "concern", label: "Concern", icon: Target },
] as const;

const PRIORITIES = ["low", "medium", "high"] as const;

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

export default function Stage4Drivers({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(4);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requirementGate, setRequirementGate] = useState<RequirementGate>({ total: 0, locked: 0 });
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>("quality");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const reload = useCallback(async () => {
    setLoading(true);
    const [driverRes, reqRes, runRes] = await Promise.all([
      supabase
        .from("architecture_drivers")
        .select("id, label, description, category, priority")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("requirements")
        .select("id, status")
        .eq("project_id", projectId),
      supabase
        .from("agent_runs")
        .select("status, agent_name, started_at, completed_at, error, output")
        .eq("project_id", projectId)
        .eq("stage", 4)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (driverRes.error) toast.error(`Couldn't load drivers: ${driverRes.error.message}`);
    setDrivers((driverRes.data ?? []) as Driver[]);
    const reqRows = reqRes.data ?? [];
    setRequirementGate({
      total: reqRows.length,
      locked: reqRows.filter((r) => ["locked", "approved"].includes(String(r.status ?? "").toLowerCase())).length,
    });
    setLastRun((runRes.data as unknown as LastRun | null) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Driver[]>();
    for (const d of drivers) {
      const k = d.category ?? "quality";
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return map;
  }, [drivers]);

  const categoriesCovered = byCategory.size;
  const ready = drivers.length >= 3 && categoriesCovered >= 2;

  async function addDriver() {
    if (!label.trim()) {
      toast.error("Give the driver a short label first.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("architecture_drivers")
      .insert({
        project_id: projectId,
        label: label.trim(),
        category,
        priority,
        created_by: userData.user?.id ?? null,
      })
      .select("id, label, description, category, priority")
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save driver: ${error.message}`);
      return;
    }
    setDrivers((prev) => [...prev, data as Driver]);
    setLabel("");
    toast.success("Driver added");
  }

  async function removeDriver(id: string) {
    const prev = drivers;
    setDrivers((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from("architecture_drivers").delete().eq("id", id);
    if (error) {
      setDrivers(prev);
      toast.error(`Couldn't delete: ${error.message}`);
    }
  }

  const highCount = drivers.filter((d) => d.priority === "high").length;
  const blockedByDraftRequirements = !loading && requirementGate.total > 0 && requirementGate.locked === 0 && drivers.length === 0;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 4 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : drivers.length > 0 ? "In progress" : "Not started",
        tone: ready ? "emerald" : drivers.length > 0 ? "primary" : "neutral",
      }}
      stats={[
        { label: "Drivers", value: loading ? "—" : drivers.length, sub: "captured so far", tone: drivers.length > 0 ? "primary" : "neutral" },
        { label: "Categories", value: loading ? "—" : categoriesCovered, sub: "of 3 covered", tone: categoriesCovered >= 2 ? "emerald" : "neutral" },
        { label: "High priority", value: loading ? "—" : highCount, sub: "must-have drivers", tone: highCount > 0 ? "amber" : "neutral" },
        { label: "Phase", value: "Design", sub: stage.phase, tone: "primary" },
      ]}
      checks={[
        { key: "count", label: "At least 3 drivers captured", ok: drivers.length >= 3 },
        { key: "cats", label: "Covers at least 2 categories", ok: categoriesCovered >= 2 },
        { key: "high", label: "At least one high-priority driver", ok: highCount >= 1 },
      ]}
      checklistTitle="Ready for style selection?"
      checklistBlurb="These drivers become the criteria TimeArch scores every architecture style against."
      advance={{
        label: ready ? "Drivers look solid — advance to Stage 5" : "Add drivers across categories to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Style selection",
      }}
      secondaryLink={{
        label: "Open in classic workspace",
        href: stage.classicRoute(projectId),
      }}
    >
      {/* Auto-generate drivers */}
      <SectionCard
        title="Auto-generate drivers"
        subtitle={
          requirementGate.locked === 0
            ? "Lock at least one requirement in Stage 3 to unlock automatic driver extraction."
            : `Runs the Driver Extraction agent against your ${requirementGate.locked} locked requirement${requirementGate.locked === 1 ? "" : "s"}. Re-running replaces the driver set.`
        }
        right={
          <RunAgentButton
            projectId={projectId}
            stage={4}
            onDone={reload}
            hasArtifact={drivers.length > 0}
            disabledReason={
              requirementGate.locked === 0
                ? "Lock at least one requirement in Stage 3 first."
                : undefined
            }
          />
        }
      >
        <div className="text-xs text-muted-foreground">
          {drivers.length > 0
            ? `Current set: ${drivers.length} driver${drivers.length === 1 ? "" : "s"} across ${categoriesCovered} categor${categoriesCovered === 1 ? "y" : "ies"}.`
            : "No drivers yet. Run the agent or add drivers manually below."}
        </div>
      </SectionCard>

      {/* Last agent run summary */}
      {lastRun && (
        <LastRunSummary
          run={lastRun}
          totalDrivers={drivers.length}
          byCategory={{
            quality: (byCategory.get("quality") ?? []).length,
            constraint: (byCategory.get("constraint") ?? []).length,
            concern: (byCategory.get("concern") ?? []).length,
          }}
          highPriority={highCount}
        />
      )}

      {/* Add-driver card */}
      {blockedByDraftRequirements && (
        <SectionCard
          title="Requirements are not locked yet"
          subtitle={`${requirementGate.total} requirement${requirementGate.total === 1 ? "" : "s"} found, but none are locked or approved for architecture decisions.`}
        >
          <div className="rounded-md border border-warning/20 bg-warning/5 p-4 text-sm text-warning">
            Run or review Stage 3 and lock the approved requirements first, then run this stage again to draft architecture drivers.
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Add a driver"
        subtitle="One short phrase per driver — e.g. 'p95 latency under 200ms', 'GDPR compliance', 'must run on-prem'."
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_140px_auto] gap-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Driver label…"
            onKeyDown={(e) => e.key === "Enter" && addDriver()}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addDriver} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      </SectionCard>

      {/* Drivers by category */}
      {CATEGORIES.map((cat) => {
        const list = byCategory.get(cat.key) ?? [];
        const Icon = cat.icon;
        return (
          <SectionCard
            key={cat.key}
            title={cat.label}
            subtitle={
              list.length === 0
                ? "Nothing captured in this category yet."
                : `${list.length} driver${list.length === 1 ? "" : "s"}.`
            }
            right={<Icon className="h-4 w-4 text-muted-foreground" />}
          >
            {list.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground text-center">
                <Sparkles className="h-3.5 w-3.5 inline mr-1 opacity-60" />
                Add a {cat.label.toLowerCase()} above.
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-md border bg-background px-3 py-2.5"
                  >
                    <PriorityDot priority={d.priority} />
                    <span className="text-sm flex-1 min-w-0 truncate">{d.label}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {d.priority ?? "—"}
                    </span>
                    <button
                      onClick={() => removeDriver(d.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
                      aria-label="Delete driver"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        );
      })}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading drivers…
        </div>
      )}
    </StageShell>
  );
}

function PriorityDot({ priority }: { priority: Driver["priority"] }) {
  const tone =
    priority === "high"
      ? "bg-rose-500"
      : priority === "medium"
        ? "bg-amber-500"
        : priority === "low"
          ? "bg-emerald-500"
          : "bg-muted-foreground/40";
  return <span className={cn("h-2 w-2 rounded-full flex-shrink-0", tone)} />;
}

function LastRunSummary({
  run,
  totalDrivers,
  byCategory,
  highPriority,
}: {
  run: LastRun;
  totalDrivers: number;
  byCategory: { quality: number; constraint: number; concern: number };
  highPriority: number;
}) {
  const status = String(run.status ?? "").toLowerCase();
  const isDone = status === "completed" || status === "success" || status === "succeeded";
  const isFailed = status === "failed" || status === "error";
  const isRunning = status === "running" || status === "in_progress" || status === "pending";

  const Icon = isFailed ? XCircle : isRunning ? Clock : CheckCircle2;
  const tone = isFailed
    ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
    : isRunning
      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";

  const when = run.completed_at || run.started_at;
  const whenLabel = when ? new Date(when).toLocaleString() : "—";

  const headline = isFailed
    ? "Last run failed"
    : isRunning
      ? "Agent is still working"
      : totalDrivers === 0
        ? "Stage executed — but no drivers were materialized"
        : `Stage executed — ${totalDrivers} driver${totalDrivers === 1 ? "" : "s"} in the current set`;

  return (
    <div className={cn("rounded-lg border p-4", tone)}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{headline}</span>
            <span className="text-[11px] opacity-75">· {whenLabel}</span>
          </div>
          <div className="mt-1 text-xs opacity-80">
            {run.agent_name} · status <span className="font-mono">{run.status}</span>
          </div>

          {isDone && run.output?.stage4_metrics && (
            <div className="mt-3 rounded-md border border-current/20 bg-background/60 p-2.5 text-xs">
              <div className="font-semibold mb-1">Latest run changes</div>
              <div className="flex flex-wrap gap-3">
                <span>🗑️ <strong>{run.output.stage4_metrics.deleted}</strong> driver{run.output.stage4_metrics.deleted === 1 ? "" : "s"} deleted</span>
                <span>➕ <strong>{run.output.stage4_metrics.inserted}</strong> driver{run.output.stage4_metrics.inserted === 1 ? "" : "s"} inserted</span>
                <span>📊 Net: <strong>{run.output.stage4_metrics.inserted - run.output.stage4_metrics.deleted >= 0 ? "+" : ""}{run.output.stage4_metrics.inserted - run.output.stage4_metrics.deleted}</strong></span>
              </div>
            </div>
          )}

          {isFailed && run.error && (
            <div className="mt-2 rounded border border-rose-500/20 bg-background/60 p-2 text-[11px] font-mono text-rose-600 dark:text-rose-400 max-h-24 overflow-auto">
              {run.error}
            </div>
          )}

          {isDone && totalDrivers > 0 && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-widest opacity-70 mb-1.5">Key findings</div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Chip label={`${byCategory.quality} quality`} />
                <Chip label={`${byCategory.constraint} constraints`} />
                <Chip label={`${byCategory.concern} concerns`} />
                <Chip label={`${highPriority} high priority`} />
              </div>
              <p className="mt-2 text-[11px] opacity-70">
                Re-running this stage replaces the driver set (previous drivers are cleared, not appended).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-current/30 bg-background/60 px-2 py-0.5 text-[11px] font-medium">
      {label}
    </span>
  );
}
