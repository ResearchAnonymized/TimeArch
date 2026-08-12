/**
 * Stage 1 · "Cockpit" — split view for Project setup.
 *
 * Left pane  : the 5 inputs the user gives (name, one-line goal, target users,
 *              domain, first requirements).  Fields debounce-save straight into
 *              `projects` / `requirements`.
 * Right pane : a live activity log that reacts to those field changes, plus a
 *              growing list of "artifacts" (the small things TimeArch derives
 *              from what the user typed).
 *
 * No new edge function is needed — the observer is entirely derived from the
 * user's inputs so it feels live without any server-side stream.  When the
 * checklist hits 5/5 the sticky footer enables "Advance to Stage 2".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  initialName: string;
  initialDescription: string | null;
  onAdvance: () => void | Promise<void>;
  advancing: boolean;
}

interface LocalRequirement {
  id: string;
  title: string;
  saving?: boolean;
}

type ActivityKind = "pending" | "running" | "done";
interface ActivityEvent {
  id: string;
  ts: number;
  label: string;
  detail?: string;
  kind: ActivityKind;
}

type ArtifactKind = "brief" | "domain" | "stakeholders" | "requirements";
interface Artifact {
  kind: ArtifactKind;
  title: string;
  summary: string;
  version: number;
  updatedAt: number;
}

const DOMAIN_HINTS: Array<{ pattern: RegExp; label: string; tone: string }> = [
  { pattern: /bank|fintech|payment|invoice|billing|loan|wallet|ledger/i, label: "Fintech", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  { pattern: /health|patient|clinic|medical|hipaa|ehr|fhir/i, label: "Healthcare", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300" },
  { pattern: /learn|course|student|teacher|scorm|xapi|classroom/i, label: "Education", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  { pattern: /shop|cart|checkout|order|product|catalog|ecom|marketplace/i, label: "E-commerce", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  { pattern: /fleet|logistic|delivery|driver|route|shipment|warehouse/i, label: "Logistics", tone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300" },
  { pattern: /game|player|match|leaderboard|guild|multiplayer/i, label: "Gaming", tone: "bg-pink-500/15 text-pink-600 dark:text-pink-300" },
  { pattern: /iot|sensor|device|telemetry|edge|firmware/i, label: "IoT", tone: "bg-lime-500/15 text-lime-600 dark:text-lime-300" },
  { pattern: /saas|tenant|workspace|team|collab|dashboard|admin/i, label: "SaaS platform", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
];

const STAKEHOLDER_HINTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /admin/i, label: "Administrator" },
  { pattern: /user|customer|member/i, label: "End user" },
  { pattern: /manager|owner/i, label: "Business owner" },
  { pattern: /doctor|clinician|nurse/i, label: "Clinician" },
  { pattern: /student/i, label: "Student" },
  { pattern: /teacher|instructor/i, label: "Instructor" },
  { pattern: /seller|vendor|merchant/i, label: "Merchant" },
  { pattern: /driver/i, label: "Driver" },
  { pattern: /architect|engineer|dev/i, label: "Engineer" },
];

function useDebounced<T>(value: T, delay = 500): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function Stage1Cockpit({
  projectId,
  initialName,
  initialDescription,
  onAdvance,
  advancing,
}: Props) {
  // ── Left pane state ──────────────────────────────────────────────────────
  const [name, setName] = useState(initialName ?? "");
  const [goal, setGoal] = useState(initialDescription ?? "");
  const [users, setUsers] = useState<string[]>([]);
  const [userDraft, setUserDraft] = useState("");
  const [domain, setDomain] = useState("");
  const [reqs, setReqs] = useState<LocalRequirement[]>([]);
  const [reqDraft, setReqDraft] = useState("");
  const [addingReq, setAddingReq] = useState(false);
  const [savingName, setSavingName] = useState<"idle" | "saving" | "saved">("idle");
  const [savingGoal, setSavingGoal] = useState<"idle" | "saving" | "saved">("idle");

  // ── Right pane state ─────────────────────────────────────────────────────
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Record<ArtifactKind, Artifact | undefined>>({
    brief: undefined,
    domain: undefined,
    stakeholders: undefined,
    requirements: undefined,
  });
  const [traceOpen, setTraceOpen] = useState(true);
  const seededRef = useRef(false);

  // ── Initial load: pull existing requirements + prior user-list stored in
  //    description-augmented persistence (we keep users in local state only;
  //    they're persisted below as JSON-ish tail on the description).
  useEffect(() => {
    let mounted = true;
    supabase
      .from("requirements")
      .select("id, title")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!mounted || !data) return;
        setReqs(data.map((r) => ({ id: r.id, title: r.title })));
      });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  // ── Debounced save: name ─────────────────────────────────────────────────
  const debouncedName = useDebounced(name, 600);
  useEffect(() => {
    if (debouncedName === (initialName ?? "")) return;
    if (!debouncedName.trim()) return;
    setSavingName("saving");
    pushEvent({ label: "Saving project name", detail: `"${debouncedName}"`, kind: "running" });
    supabase
      .from("projects")
      .update({ name: debouncedName, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .then(({ error }) => {
        setSavingName(error ? "idle" : "saved");
        completeLast(error ? "Save failed" : "Name saved");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName]);

  // ── Debounced save: goal / description ───────────────────────────────────
  const debouncedGoal = useDebounced(goal, 700);
  useEffect(() => {
    if (debouncedGoal === (initialDescription ?? "")) return;
    setSavingGoal("saving");
    pushEvent({ label: "Reading goal", detail: debouncedGoal.slice(0, 60) || "(cleared)", kind: "running" });
    supabase
      .from("projects")
      .update({ description: debouncedGoal, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .then(({ error }) => {
        setSavingGoal(error ? "idle" : "saved");
        completeLast(error ? "Save failed" : "Goal captured");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedGoal]);

  // ── Domain inference (derived from goal + name) ──────────────────────────
  const inferredDomain = useMemo(() => {
    const hay = `${name} ${goal} ${domain}`;
    return DOMAIN_HINTS.find((d) => d.pattern.test(hay));
  }, [name, goal, domain]);

  useEffect(() => {
    if (!inferredDomain) return;
    setArtifacts((a) => {
      const prev = a.domain;
      if (prev?.summary === inferredDomain.label) return a;
      pushEvent({
        label: "Classified domain",
        detail: inferredDomain.label,
        kind: "done",
      });
      return {
        ...a,
        domain: {
          kind: "domain",
          title: "Domain classification",
          summary: inferredDomain.label,
          version: (prev?.version ?? 0) + 1,
          updatedAt: Date.now(),
        },
      };
    });
  }, [inferredDomain]);

  // ── Stakeholder inference ────────────────────────────────────────────────
  useEffect(() => {
    const hay = `${goal} ${users.join(" ")}`;
    const found = STAKEHOLDER_HINTS.filter((s) => s.pattern.test(hay)).map((s) => s.label);
    const merged = Array.from(new Set([...users, ...found])).slice(0, 8);
    if (merged.length === 0) return;
    setArtifacts((a) => {
      const prev = a.stakeholders;
      const summary = merged.join(", ");
      if (prev?.summary === summary) return a;
      pushEvent({
        label: "Inferred stakeholders",
        detail: `${merged.length} identified`,
        kind: "done",
      });
      return {
        ...a,
        stakeholders: {
          kind: "stakeholders",
          title: "Stakeholder map",
          summary,
          version: (prev?.version ?? 0) + 1,
          updatedAt: Date.now(),
        },
      };
    });
  }, [goal, users]);

  // ── Project-brief artifact (name + goal combined) ────────────────────────
  useEffect(() => {
    if (!name.trim() && !goal.trim()) return;
    setArtifacts((a) => {
      const summary = `${name.trim() || "Untitled"} — ${goal.trim().slice(0, 90) || "goal pending"}`;
      const prev = a.brief;
      if (prev?.summary === summary) return a;
      return {
        ...a,
        brief: {
          kind: "brief",
          title: "Draft project brief",
          summary,
          version: (prev?.version ?? 0) + 1,
          updatedAt: Date.now(),
        },
      };
    });
  }, [name, goal]);

  // ── Requirements artifact ────────────────────────────────────────────────
  useEffect(() => {
    if (reqs.length === 0) return;
    setArtifacts((a) => {
      const summary = `${reqs.length} captured`;
      const prev = a.requirements;
      if (prev?.summary === summary) return a;
      return {
        ...a,
        requirements: {
          kind: "requirements",
          title: "Requirement candidates",
          summary,
          version: (prev?.version ?? 0) + 1,
          updatedAt: Date.now(),
        },
      };
    });
  }, [reqs]);

  // ── Boot event ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    pushEvent({ label: "Cockpit online", detail: "Waiting for your first input", kind: "done" });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function pushEvent(e: Omit<ActivityEvent, "id" | "ts">) {
    setEvents((list) => [
      ...list.slice(-40),
      { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() },
    ]);
  }
  function completeLast(newLabel?: string) {
    setEvents((list) => {
      if (list.length === 0) return list;
      const copy = [...list];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, kind: "done", label: newLabel ?? last.label };
      return copy;
    });
  }

  const addUser = useCallback(() => {
    const v = userDraft.trim();
    if (!v) return;
    setUsers((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setUserDraft("");
    pushEvent({ label: "Added user type", detail: v, kind: "done" });
  }, [userDraft]);

  const removeUser = (u: string) => setUsers((prev) => prev.filter((x) => x !== u));

  const addRequirement = useCallback(async () => {
    const v = reqDraft.trim();
    if (!v) return;
    setAddingReq(true);
    pushEvent({ label: "Saving requirement", detail: v.slice(0, 60), kind: "running" });
    const { data: authUser } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("requirements")
      .insert({
        project_id: projectId,
        requirement_id: `REQ-${Date.now().toString(36).toUpperCase()}`,
        title: v,
        description: v,
        type: "functional" as const,
        priority: "medium" as const,
        status: "draft" as const,
        source: "stage1-cockpit",
        created_by: authUser.user?.id ?? "",
      })
      .select("id, title")
      .single();
    setAddingReq(false);
    if (error || !data) {
      completeLast("Save failed");
      toast.error(`Couldn't save: ${error?.message ?? "unknown"}`);
      return;
    }
    setReqs((prev) => [...prev, { id: data.id, title: data.title }]);
    setReqDraft("");
    completeLast(`Requirement #${reqs.length + 1} saved`);
  }, [reqDraft, projectId, reqs.length]);

  const removeRequirement = async (id: string) => {
    const prev = reqs;
    setReqs((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("requirements").delete().eq("id", id);
    if (error) {
      setReqs(prev);
      toast.error(`Couldn't delete: ${error.message}`);
      return;
    }
    pushEvent({ label: "Requirement removed", kind: "done" });
  };

  // ── Readiness checklist (5 items) ────────────────────────────────────────
  const checks = useMemo(
    () => [
      { key: "name", label: "Project has a name", ok: name.trim().length >= 3 },
      { key: "goal", label: "One-line goal captured", ok: goal.trim().length >= 15 },
      { key: "users", label: "At least one target user", ok: users.length >= 1 },
      { key: "domain", label: "Domain identified", ok: !!inferredDomain || domain.trim().length >= 3 },
      { key: "reqs", label: "At least one requirement", ok: reqs.length >= 1 },
    ],
    [name, goal, users.length, inferredDomain, domain, reqs.length],
  );
  const ready = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const pct = Math.round((ready / total) * 100);
  const canAdvance = ready === total;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);

  const artifactList = useMemo(
    () => (Object.values(artifacts).filter(Boolean) as Artifact[]).sort((a, b) => b.updatedAt - a.updatedAt),
    [artifacts],
  );

  return (
    <section className="mb-10 space-y-8">
      {/* Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-2">
            Requirement Definition · Stage 1 of 18
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            Project setup
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Give TimeArch the five essentials of your project. As you type, the workspace on the right shows what has been captured and what is still missing before you can advance.
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium",
            canAdvance
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
          )}
        >
          {canAdvance ? "Ready" : "Draft"}
        </Badge>
      </div>

      {/* Identity strip ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
          <StripField
            label="Project name"
            status={name.trim().length >= 3 ? "ok" : savingName === "saving" ? "busy" : "empty"}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northwind analytics"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm font-medium"
            />
          </StripField>
          <StripField
            label="Domain / industry"
            status={inferredDomain || domain.trim().length >= 3 ? "ok" : "empty"}
            hint={inferredDomain ? `auto · ${inferredDomain.label}` : undefined}
          >
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={inferredDomain?.label ?? "Fintech, Healthcare…"}
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm font-medium"
            />
          </StripField>
          <StripField
            label="Target users"
            status={users.length >= 1 ? "ok" : "empty"}
            hint={users.length ? `${users.length} identified` : undefined}
          >
            <div className="flex gap-2 items-center">
              <Input
                value={userDraft}
                onChange={(e) => setUserDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUser())}
                placeholder="Add: admin, customer…"
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-sm font-medium"
              />
              <Button size="sm" variant="ghost" onClick={addUser} disabled={!userDraft.trim()} className="h-7 px-2">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <AnimatePresence>
                  {users.map((u) => (
                    <motion.span
                      key={u}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px]"
                    >
                      {u}
                      <button onClick={() => removeUser(u)} className="hover:text-destructive" aria-label={`Remove ${u}`}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </StripField>
        </div>
      </div>

      {/* Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Ready" value={`${ready}`} sub={`of ${total} checks`} tone={canAdvance ? "emerald" : "primary"} />
        <StatCard label="Missing" value={`${total - ready}`} sub="to unlock Stage 2" tone={total - ready === 0 ? "neutral" : "rose"} />
        <StatCard label="Requirements" value={`${reqs.length}`} sub="captured" tone="amber" />
        <StatCard label="Artifacts" value={`${artifactList.length}`} sub="drafts generated" tone="neutral" />
      </div>

      {/* Goal ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold">One-line goal</h2>
            <p className="text-xs text-muted-foreground">What does success look like in one sentence?</p>
          </div>
          <StatusDot status={goal.trim().length >= 15 ? "ok" : savingGoal === "saving" ? "busy" : "empty"} />
        </div>
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Let regional managers see live sales performance and reorder low stock in one click."
          className="min-h-[70px] resize-none text-sm"
        />
      </div>

      {/* Requirements section ───────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card">
        <div className="p-6 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">First requirements</h2>
            <p className="text-xs text-muted-foreground">Two or three is plenty to start. Each row saves to your review queue.</p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{reqs.length} saved</span>
        </div>
        <div className="px-6 pb-4 space-y-1.5 max-h-64 overflow-auto">
          <AnimatePresence>
            {reqs.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-3 rounded-md border bg-background px-3 py-2"
              >
                <span className="font-mono text-[10px] text-muted-foreground w-6">R{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm flex-1 truncate">{r.title}</span>
                <button
                  onClick={() => removeRequirement(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove requirement"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {reqs.length === 0 && (
            <div className="text-xs text-muted-foreground italic py-4 text-center">
              Nothing yet — add your first requirement below.
            </div>
          )}
        </div>
        <div className="border-t p-4 flex gap-2 bg-muted/20 rounded-b-2xl">
          <Input
            value={reqDraft}
            onChange={(e) => setReqDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRequirement())}
            placeholder="e.g. Users can reset their password by email"
            className="h-9 text-sm"
            disabled={addingReq}
          />
          <Button size="sm" onClick={addRequirement} disabled={addingReq || !reqDraft.trim()} className="gap-1.5">
            {addingReq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add requirement
          </Button>
        </div>
      </div>

      {/* Readiness checklist ────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Stage 1 checklist</h2>
            <p className="text-xs text-muted-foreground">All five must be green to advance.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={cn("h-full", canAdvance ? "bg-emerald-500" : "bg-primary")}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{ready}</span>/{total}
            </span>
          </div>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {checks.map((c, i) => (
            <li
              key={c.key}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                c.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-background",
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
              )}
              <span className={cn("flex-1", c.ok ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Live artifacts + trace (collapsed side detail) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Live artifacts</h2>
            <span className="font-mono text-[11px] text-muted-foreground">{artifactList.length} drafts</span>
          </div>
          <div className="space-y-2 min-h-[80px]">
            <AnimatePresence>
              {artifactList.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground italic rounded-md border border-dashed p-4 text-center"
                >
                  Nothing yet. As you fill the form above, drafts appear here in real time.
                </motion.div>
              )}
              {artifactList.map((a) => (
                <motion.div
                  key={a.kind}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-md border bg-background px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">v{a.version}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <button
            onClick={() => setTraceOpen((v) => !v)}
            className="flex items-center gap-2 text-base font-semibold w-full hover:text-primary transition-colors mb-3"
          >
            {traceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Activity log
            <span className="font-mono text-[11px] text-muted-foreground ml-auto font-normal">{events.length} events</span>
          </button>
          <AnimatePresence initial={false}>
            {traceOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-md border bg-background p-3 max-h-64 overflow-auto space-y-1.5">
                  {events.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No activity yet.</p>
                  )}
                  <AnimatePresence initial={false}>
                    {events.map((e) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 text-[11px] font-mono leading-tight"
                      >
                        <span className="text-muted-foreground/70 w-16 flex-shrink-0">
                          {new Date(e.ts).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <span className="w-3 flex-shrink-0 flex items-center justify-center pt-0.5">
                          {e.kind === "running" ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                          ) : e.kind === "done" ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                          ) : (
                            <Circle className="h-2.5 w-2.5 text-muted-foreground" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-foreground">{e.label}</span>
                          {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky advance bar ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-background/90 backdrop-blur px-6 py-4 flex items-center justify-between gap-4 sticky bottom-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {canAdvance ? "Stage 1 is ready — you can advance to review." : `${total - ready} more to unlock Stage 2`}
          </p>
          {!canAdvance && missing.length > 0 && (
            <p className="text-[11px] text-muted-foreground truncate">Needs: {missing.join(" · ")}</p>
          )}
        </div>
        <Button
          size="lg"
          disabled={!canAdvance || advancing}
          onClick={() => void onAdvance()}
          className="gap-2 flex-shrink-0"
        >
          {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Advance to Stage 2
        </Button>
      </div>
    </section>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────

function StripField({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status: "empty" | "busy" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
        <StatusDot status={status} />
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function StatusDot({ status }: { status: "empty" | "busy" | "ok" }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "busy") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "primary" | "rose" | "amber" | "neutral";
}) {
  const tones: Record<typeof tone, string> = {
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300",
    primary: "border-primary/20 bg-primary/5 text-primary",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-300",
    neutral: "border-border bg-card text-foreground",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80 mb-1">{label}</p>
      <p className="font-display text-3xl font-semibold leading-none">{value}</p>
      <p className="text-[11px] opacity-70 mt-1">{sub}</p>
    </div>
  );
}

