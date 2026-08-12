/**
 * Stage 8 — Interfaces & APIs (Studio native).
 *
 * StageShell surface for capturing the interface layer:
 *   - Load latest `api_design` artifact (Stage 8) and latest `decomposition`
 *     artifact (Stage 6) for owner-component mapping.
 *   - Manage APIs (name, style, base path, owner component) and their
 *     endpoints (method + path + description + auth).
 *   - Manage communication patterns between components (sync/async,
 *     protocol, pattern).
 *   - Manage event contracts (name, producer, consumers, channel).
 *   - Trigger the API design agent via `useRunStage(8)`.
 *   - Persist edits as a new artifact version.
 *
 * Readiness gates to advance to Stage 9 (Cross-cutting concerns):
 *   - Component decomposition exists (Stage 6 locked).
 *   - ≥1 API with ≥1 endpoint.
 *   - Every API maps to a known component.
 *   - Every communication pattern from/to reference known components.
 *   - Every event references known producer/consumers.
 *   - Latest saved artifact matches the current in-memory model.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  Network,
  Radio,
  Waypoints,
  AlertTriangle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";
import { cn } from "@/lib/utils";
import { matchComponent } from "@/lib/component-match";

// ── Types ────────────────────────────────────────────────────────────────

const API_STYLES = ["REST", "GraphQL", "gRPC", "WebSocket", "SOAP", "Webhook"] as const;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const PATTERNS = [
  "request_response",
  "publish_subscribe",
  "fire_and_forget",
  "request_reply_async",
  "streaming",
  "saga",
  "orchestration",
  "choreography",
] as const;
const PROTOCOLS = [
  "HTTPS/REST",
  "gRPC",
  "GraphQL",
  "WebSocket",
  "AMQP",
  "Kafka",
  "SQS",
  "EventBridge",
  "NATS",
] as const;

interface Endpoint {
  method: (typeof METHODS)[number];
  path: string;
  description: string;
  auth_required: boolean;
}

interface Api {
  name: string;
  description: string;
  style: (typeof API_STYLES)[number];
  base_path: string;
  owner_component: string;
  endpoints: Endpoint[];
}

interface CommPattern {
  from: string;
  to: string;
  pattern: (typeof PATTERNS)[number];
  protocol: string;
  description: string;
  sync: boolean;
}

interface EventContract {
  name: string;
  producer: string;
  consumers: string[];
  channel: string;
  description: string;
}

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export default function Stage8Apis({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(8);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apis, setApis] = useState<Api[]>([]);
  const [comms, setComms] = useState<CommPattern[]>([]);
  const [events, setEvents] = useState<EventContract[]>([]);
  const [savedHash, setSavedHash] = useState<string>("");
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [componentNames, setComponentNames] = useState<string[]>([]);
  const [decompositionVersion, setDecompositionVersion] = useState<number>(0);

  // Drafts
  const [apiName, setApiName] = useState("");
  const [apiDesc, setApiDesc] = useState("");
  const [apiStyle, setApiStyle] = useState<Api["style"]>("REST");
  const [apiBase, setApiBase] = useState("/api/v1");
  const [apiOwner, setApiOwner] = useState("");

  const [commFrom, setCommFrom] = useState("");
  const [commTo, setCommTo] = useState("");
  const [commPattern, setCommPattern] = useState<CommPattern["pattern"]>("request_response");
  const [commProtocol, setCommProtocol] = useState<string>("HTTPS/REST");
  const [commSync, setCommSync] = useState(true);
  const [commDesc, setCommDesc] = useState("");

  const [evName, setEvName] = useState("");
  const [evProducer, setEvProducer] = useState("");
  const [evConsumers, setEvConsumers] = useState("");
  const [evChannel, setEvChannel] = useState("");
  const [evDesc, setEvDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, decomp] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 8)
        .eq("type", "api_design")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 6)
        .eq("type", "decomposition")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const rawComponents =
      (decomp.data?.content as { components?: unknown } | null)?.components;
    const names = Array.isArray(rawComponents)
      ? rawComponents
          .map((c: any) => (c && typeof c.name === "string" ? c.name : null))
          .filter((n): n is string => !!n)
      : [];
    setComponentNames(names);
    setDecompositionVersion(decomp.data?.version ?? 0);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const content = artifact.data.content as {
        apis?: unknown;
        communication_patterns?: unknown;
        event_contracts?: unknown;
      };
      let a = normalizeApis(content?.apis);
      let c = normalizeComms(content?.communication_patterns);
      let ev = normalizeEvents(content?.event_contracts);
      // Auto-remap component references to canonical Stage 6 names when the
      // agent invented drift (e.g. "Data Management Service" → "CoreDataPersistence").
      if (names.length > 0) {
        const fallback = names[0];
        const fix = (v: string) => {
          if (!v) return fallback;
          if (names.some((n) => n.toLowerCase() === v.toLowerCase())) return v;
          return matchComponent(v, names) ?? fallback;
        };
        a = a.map((api) => ({ ...api, owner_component: fix(api.owner_component) }));
        c = c.map((cm) => ({ ...cm, from: fix(cm.from), to: fix(cm.to) }));
        ev = ev.map((e) => ({
          ...e,
          producer: fix(e.producer),
          consumers: e.consumers.map(fix),
        }));
      }
      setApis(a);
      setComms(c);
      setEvents(ev);
      setSavedHash(hashOf(a, c, ev));
    } else {
      setApis([]);
      setComms([]);
      setEvents([]);
      setSavedHash(hashOf([], [], []));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { runStage, running, polling } = useRunStage(projectId, 8, load);

  // ── Derived validations ─────────────────────────────────────────────────
  const componentSet = useMemo(
    () => new Set(componentNames.map((n) => n.toLowerCase())),
    [componentNames],
  );
  const apiNames = useMemo(
    () => new Set(apis.map((a) => a.name.toLowerCase())),
    [apis],
  );

  const validation = useMemo(() => {
    const issues: string[] = [];
    for (const a of apis) {
      if (a.endpoints.length === 0) issues.push(`${a.name}: has no endpoints.`);
      if (!a.owner_component.trim()) {
        issues.push(`${a.name}: no owner component assigned.`);
      } else if (componentSet.size > 0 && !componentSet.has(a.owner_component.toLowerCase())) {
        issues.push(`${a.name}: owner "${a.owner_component}" is not a known component.`);
      }
      for (const e of a.endpoints) {
        if (!e.path.trim()) issues.push(`${a.name}: endpoint has an empty path.`);
        if (!e.description.trim()) issues.push(`${a.name} ${e.method} ${e.path}: description is empty.`);
      }
    }
    for (const c of comms) {
      if (componentSet.size > 0 && !componentSet.has(c.from.toLowerCase())) {
        issues.push(`Communication: unknown source "${c.from}".`);
      }
      if (componentSet.size > 0 && !componentSet.has(c.to.toLowerCase())) {
        issues.push(`Communication: unknown target "${c.to}".`);
      }
    }
    for (const e of events) {
      if (componentSet.size > 0 && !componentSet.has(e.producer.toLowerCase())) {
        issues.push(`Event "${e.name}": producer "${e.producer}" is unknown.`);
      }
      for (const con of e.consumers) {
        if (componentSet.size > 0 && !componentSet.has(con.toLowerCase())) {
          issues.push(`Event "${e.name}": consumer "${con}" is unknown.`);
        }
      }
    }
    return issues;
  }, [apis, comms, events, componentSet]);

  const dirty = hashOf(apis, comms, events) !== savedHash;
  const hasComponents = componentNames.length > 0;
  const totalEndpoints = apis.reduce((n, a) => n + a.endpoints.length, 0);
  const ready =
    hasComponents &&
    apis.length >= 1 &&
    totalEndpoints >= 1 &&
    validation.length === 0 &&
    !dirty;

  // ── Mutations ───────────────────────────────────────────────────────────
  function addApi() {
    const name = apiName.trim();
    if (!name) {
      toast.error("Give the API a name.");
      return;
    }
    if (apiNames.has(name.toLowerCase())) {
      toast.error("An API with that name already exists.");
      return;
    }
    setApis((prev) => [
      ...prev,
      {
        name,
        description: apiDesc.trim(),
        style: apiStyle,
        base_path: apiBase.trim() || "/",
        owner_component: apiOwner || componentNames[0] || "",
        endpoints: [],
      },
    ]);
    setApiName("");
    setApiDesc("");
    setApiOwner("");
  }

  function updateApi(idx: number, patch: Partial<Api>) {
    setApis((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function removeApi(idx: number) {
    setApis((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEndpoint(apiIdx: number) {
    updateApi(apiIdx, {
      endpoints: [
        ...apis[apiIdx].endpoints,
        { method: "GET", path: "/", description: "", auth_required: true },
      ],
    });
  }

  function updateEndpoint(apiIdx: number, epIdx: number, patch: Partial<Endpoint>) {
    const eps = apis[apiIdx].endpoints.map((e, i) => (i === epIdx ? { ...e, ...patch } : e));
    updateApi(apiIdx, { endpoints: eps });
  }

  function removeEndpoint(apiIdx: number, epIdx: number) {
    updateApi(apiIdx, { endpoints: apis[apiIdx].endpoints.filter((_, i) => i !== epIdx) });
  }

  function addComm() {
    if (!commFrom || !commTo) {
      toast.error("Pick source and target components.");
      return;
    }
    setComms((prev) => [
      ...prev,
      {
        from: commFrom,
        to: commTo,
        pattern: commPattern,
        protocol: commProtocol,
        sync: commSync,
        description: commDesc.trim(),
      },
    ]);
    setCommDesc("");
  }

  function removeComm(idx: number) {
    setComms((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEvent() {
    const name = evName.trim();
    if (!name || !evProducer) {
      toast.error("Event needs a name and a producer.");
      return;
    }
    const consumers = evConsumers.split(",").map((s) => s.trim()).filter(Boolean);
    setEvents((prev) => [
      ...prev,
      {
        name,
        producer: evProducer,
        consumers,
        channel: evChannel.trim() || name.toLowerCase(),
        description: evDesc.trim(),
      },
    ]);
    setEvName("");
    setEvConsumers("");
    setEvChannel("");
    setEvDesc("");
  }

  function removeEvent(idx: number) {
    setEvents((prev) => prev.filter((_, i) => i !== idx));
  }

  async function persist() {
    if (apis.length === 0) {
      toast.error("Add at least one API before saving.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      toast.error("You need to be signed in.");
      return;
    }
    const nextVersion = (artifactVersion ?? 0) + 1;
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId,
      stage: 8,
      type: "api_design",
      title: `API Design (v${nextVersion})`,
      version: nextVersion,
      status: "draft",
      created_by: uid,
      generated_by: "studio_manual",
      content: {
        title: `API Design (v${nextVersion})`,
        summary: `${apis.length} APIs, ${totalEndpoints} endpoints, ${comms.length} communication patterns, ${events.length} events.`,
        key_findings: [
          `${apis.length} API contract(s) across ${new Set(apis.map((a) => a.owner_component)).size} component(s).`,
          `${comms.filter((c) => !c.sync).length} async interaction(s) captured.`,
          `${events.length} event contract(s) defined.`,
        ],
        apis,
        communication_patterns: comms,
        event_contracts: events,
      } as unknown as never,
    });
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save: ${error.message}`);
      return;
    }
    toast.success(`Saved as v${nextVersion}`);
    await load();
  }

  const missingHint = !hasComponents
    ? "Lock a component decomposition in Stage 6 first."
    : apis.length === 0
      ? "Add at least one API."
      : totalEndpoints === 0
        ? "Add at least one endpoint."
        : validation.length > 0
          ? `Fix ${validation.length} validation issue${validation.length === 1 ? "" : "s"}.`
          : dirty
            ? "Save your changes first."
            : undefined;

  const ownersCovered = new Set(apis.map((a) => a.owner_component).filter(Boolean)).size;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 8 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : apis.length > 0 ? "In progress" : "Not started",
        tone: ready ? "emerald" : apis.length > 0 ? "primary" : "neutral",
      }}
      stats={[
        {
          label: "APIs",
          value: loading ? "—" : apis.length,
          sub: apis.length >= 1 ? "contracts defined" : "≥1 needed",
          tone: apis.length >= 1 ? "emerald" : "amber",
        },
        {
          label: "Endpoints",
          value: loading ? "—" : totalEndpoints,
          sub: "across all APIs",
          tone: totalEndpoints > 0 ? "primary" : "amber",
        },
        {
          label: "Comm patterns",
          value: loading ? "—" : comms.length,
          sub: `${comms.filter((c) => !c.sync).length} async`,
          tone: "primary",
        },
        {
          label: "Events",
          value: loading ? "—" : events.length,
          sub: `${ownersCovered}/${componentNames.length || "—"} owners with APIs`,
          tone: hasComponents ? "primary" : "amber",
        },
      ]}
      checks={[
        {
          key: "decomp",
          label: `Component decomposition locked (Stage 6${decompositionVersion ? ` v${decompositionVersion}` : ""})`,
          ok: hasComponents,
        },
        { key: "apis", label: "At least one API defined", ok: apis.length >= 1 },
        { key: "endpoints", label: "At least one endpoint defined", ok: totalEndpoints >= 1 },
        {
          key: "owner",
          label: "Every API maps to a known component",
          ok:
            apis.length > 0 &&
            apis.every(
              (a) => a.owner_component && componentSet.has(a.owner_component.toLowerCase()),
            ),
        },
        {
          key: "comms",
          label: "Communication patterns reference known components",
          ok: comms.every(
            (c) => componentSet.has(c.from.toLowerCase()) && componentSet.has(c.to.toLowerCase()),
          ),
        },
        { key: "saved", label: "Latest edits saved as an artifact version", ok: !dirty && apis.length > 0 },
      ]}
      checklistTitle="Ready to lock the interface layer?"
      checklistBlurb="Downstream stages (cross-cutting, infrastructure) reference these APIs and integration patterns."
      advance={{
        label: ready ? "APIs are locked — advance to Stage 9" : "Complete the interface design to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Cross-cutting concerns",
        missingHint,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-generate */}
      <SectionCard
        title="Auto-generate API design"
        subtitle={
          !hasComponents
            ? "Lock a component decomposition in Stage 6 first."
            : `Runs the API Design agent against your ${componentNames.length} component${componentNames.length === 1 ? "" : "s"}.`
        }
        right={
          <RunAgentButton
            onRun={runStage}
            running={running || polling}
            hasArtifact={artifactVersion > 0}
            disabledReason={!hasComponents ? "Define components in Stage 6 first." : undefined}
          />
        }
      >
        <div className="text-xs text-muted-foreground">
          {artifactVersion > 0 ? (
            <>
              Latest artifact: <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span>. Editing below creates a new version when saved.
            </>
          ) : (
            <>No API design artifact yet. Run the agent or add APIs manually below.</>
          )}
        </div>
      </SectionCard>

      {/* Add API */}
      <SectionCard title="Add an API" subtitle="Group endpoints under a single contract owned by one component.">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <Input
            placeholder="Name (e.g. Orders API)"
            value={apiName}
            onChange={(e) => setApiName(e.target.value)}
            className="md:col-span-3"
          />
          <Select value={apiStyle} onValueChange={(v) => setApiStyle(v as Api["style"])}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {API_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Base path"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            className="md:col-span-2 font-mono text-sm"
          />
          <Select value={apiOwner} onValueChange={setApiOwner}>
            <SelectTrigger className="md:col-span-3">
              <SelectValue placeholder={hasComponents ? "Owner component" : "No components"} />
            </SelectTrigger>
            <SelectContent>
              {componentNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Description"
            value={apiDesc}
            onChange={(e) => setApiDesc(e.target.value)}
            className="md:col-span-1"
          />
          <Button onClick={addApi} className="md:col-span-1 gap-1" disabled={!hasComponents}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </SectionCard>

      {/* APIs list */}
      <SectionCard
        title={`APIs (${apis.length})`}
        subtitle="Edit endpoints inline — auth defaults to required."
        right={
          <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Save version" : "Saved"}
          </Button>
        }
      >
        {loading ? (
          <div className="h-24 rounded-xl border border-dashed animate-pulse bg-muted/30" />
        ) : apis.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Network className="h-6 w-6 mx-auto mb-2 opacity-40" />
            No APIs yet. Add one above or run the agent.
          </div>
        ) : (
          <ul className="space-y-3">
            {apis.map((a, i) => {
              const ownerOk = !a.owner_component || componentSet.has(a.owner_component.toLowerCase());
              return (
                <li key={`${a.name}-${i}`} className="rounded-xl border bg-background p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                    <Input
                      value={a.name}
                      onChange={(ev) => updateApi(i, { name: ev.target.value })}
                      className="md:col-span-3 font-mono text-sm font-semibold"
                    />
                    <Select value={a.style} onValueChange={(v) => updateApi(i, { style: v as Api["style"] })}>
                      <SelectTrigger className="md:col-span-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {API_STYLES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={a.base_path}
                      onChange={(ev) => updateApi(i, { base_path: ev.target.value })}
                      className="md:col-span-2 font-mono text-sm"
                    />
                    <Select
                      value={a.owner_component || undefined}
                      onValueChange={(v) => updateApi(i, { owner_component: v })}
                    >
                      <SelectTrigger
                        className={cn(
                          "md:col-span-3 text-sm",
                          !ownerOk && "border-rose-500/40 text-rose-600 dark:text-rose-300",
                        )}
                      >
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {componentNames.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={a.description}
                      onChange={(ev) => updateApi(i, { description: ev.target.value })}
                      placeholder="Description"
                      className="md:col-span-1 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeApi(i)}
                      className="md:col-span-1 justify-self-end"
                      aria-label={`Remove ${a.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Endpoints */}
                  <div className="rounded-lg border bg-muted/20 p-2 space-y-1.5">
                    {a.endpoints.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic px-1">
                        No endpoints yet.
                      </p>
                    )}
                    {a.endpoints.map((e, ei) => (
                      <div key={ei} className="grid grid-cols-12 gap-1.5 items-center">
                        <Select
                          value={e.method}
                          onValueChange={(v) => updateEndpoint(i, ei, { method: v as Endpoint["method"] })}
                        >
                          <SelectTrigger className="col-span-2 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METHODS.map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={e.path}
                          onChange={(ev) => updateEndpoint(i, ei, { path: ev.target.value })}
                          placeholder="/orders/:id"
                          className="col-span-3 h-8 text-xs font-mono"
                        />
                        <Input
                          value={e.description}
                          onChange={(ev) => updateEndpoint(i, ei, { description: ev.target.value })}
                          placeholder="What this endpoint does"
                          className="col-span-5 h-8 text-xs"
                        />
                        <label className="col-span-1 flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={e.auth_required}
                            onCheckedChange={(v) => updateEndpoint(i, ei, { auth_required: !!v })}
                          />
                          auth
                        </label>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeEndpoint(i, ei)}
                          className="col-span-1 h-7 w-7 justify-self-end"
                          aria-label="Remove endpoint"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addEndpoint(i)}
                      className="h-7 gap-1 text-[11px]"
                    >
                      <Plus className="h-3 w-3" /> Add endpoint
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Communication patterns */}
      <SectionCard
        title={`Communication patterns (${comms.length})`}
        subtitle="Maps interface use between components (sync request/response, async pub/sub, etc.)."
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3">
          <Select value={commFrom} onValueChange={setCommFrom}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="From" />
            </SelectTrigger>
            <SelectContent>
              {componentNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={commTo} onValueChange={setCommTo}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="To" />
            </SelectTrigger>
            <SelectContent>
              {componentNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={commPattern} onValueChange={(v) => setCommPattern(v as CommPattern["pattern"])}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATTERNS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={commProtocol} onValueChange={setCommProtocol}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="md:col-span-1 flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={commSync} onCheckedChange={(v) => setCommSync(!!v)} />
            sync
          </label>
          <Input
            value={commDesc}
            onChange={(e) => setCommDesc(e.target.value)}
            placeholder="Notes"
            className="md:col-span-2 text-xs"
          />
          <Button onClick={addComm} className="md:col-span-1 gap-1" disabled={componentNames.length < 2}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {comms.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            <Waypoints className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
            No communication patterns yet.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {comms.map((c, i) => {
              const fromOk = componentSet.has(c.from.toLowerCase());
              const toOk = componentSet.has(c.to.toLowerCase());
              const bad = !fromOk || !toOk;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                    bad ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background",
                  )}
                >
                  <span className={cn("font-mono font-semibold", !fromOk && "text-rose-500")}>
                    {c.from}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn("font-mono font-semibold", !toOk && "text-rose-500")}>
                    {c.to}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {c.pattern.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {c.protocol}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-normal",
                      c.sync
                        ? "border-primary/30 text-primary"
                        : "border-amber-500/30 text-amber-600 dark:text-amber-300",
                    )}
                  >
                    {c.sync ? "sync" : "async"}
                  </Badge>
                  {c.description && (
                    <span className="text-muted-foreground truncate">— {c.description}</span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-6 w-6"
                    onClick={() => removeComm(i)}
                    aria-label="Remove pattern"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Events */}
      <SectionCard
        title={`Event contracts (${events.length})`}
        subtitle="Domain events published on channels — PascalCase past tense (e.g. OrderPlaced)."
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3">
          <Input
            value={evName}
            onChange={(e) => setEvName(e.target.value)}
            placeholder="OrderPlaced"
            className="md:col-span-2 font-mono text-sm"
          />
          <Select value={evProducer} onValueChange={setEvProducer}>
            <SelectTrigger className="md:col-span-2">
              <SelectValue placeholder="Producer" />
            </SelectTrigger>
            <SelectContent>
              {componentNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={evConsumers}
            onChange={(e) => setEvConsumers(e.target.value)}
            placeholder="Consumers (comma-separated)"
            className="md:col-span-3 text-sm"
          />
          <Input
            value={evChannel}
            onChange={(e) => setEvChannel(e.target.value)}
            placeholder="Channel / topic"
            className="md:col-span-2 font-mono text-sm"
          />
          <Input
            value={evDesc}
            onChange={(e) => setEvDesc(e.target.value)}
            placeholder="What it represents"
            className="md:col-span-2 text-sm"
          />
          <Button onClick={addEvent} className="md:col-span-1 gap-1" disabled={componentNames.length === 0}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            <Radio className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
            No event contracts yet.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs"
              >
                <span className="font-mono font-semibold">{e.name}</span>
                <span className="text-muted-foreground">from</span>
                <span className="font-mono">{e.producer}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">{e.consumers.join(", ") || "—"}</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {e.channel}
                </Badge>
                {e.description && (
                  <span className="text-muted-foreground truncate">— {e.description}</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto h-6 w-6"
                  onClick={() => removeEvent(i)}
                  aria-label="Remove event"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Validation */}
      {validation.length > 0 && (
        <SectionCard title="Validation issues" subtitle="Resolve these before advancing.">
          <ul className="space-y-1.5">
            {validation.map((v, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </StageShell>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeApis(raw: unknown): Api[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any) => {
      if (!a || typeof a !== "object" || typeof a.name !== "string") return null;
      const style = API_STYLES.includes(a.style) ? (a.style as Api["style"]) : "REST";
      return {
        name: a.name,
        description: typeof a.description === "string" ? a.description : "",
        style,
        base_path: typeof a.base_path === "string" ? a.base_path : "/",
        owner_component: typeof a.owner_component === "string" ? a.owner_component : "",
        endpoints: Array.isArray(a.endpoints)
          ? a.endpoints
              .map((e: any) =>
                e && typeof e.path === "string"
                  ? {
                      method: METHODS.includes(e.method) ? (e.method as Endpoint["method"]) : "GET",
                      path: e.path,
                      description: typeof e.description === "string" ? e.description : "",
                      auth_required: e.auth_required !== false,
                    }
                  : null,
              )
              .filter((e: Endpoint | null): e is Endpoint => !!e)
          : [],
      } as Api;
    })
    .filter((a): a is Api => !!a);
}

function normalizeComms(raw: unknown): CommPattern[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => {
      if (!c || typeof c.from !== "string" || typeof c.to !== "string") return null;
      const pattern = PATTERNS.includes(c.pattern)
        ? (c.pattern as CommPattern["pattern"])
        : "request_response";
      return {
        from: c.from,
        to: c.to,
        pattern,
        protocol: typeof c.protocol === "string" ? c.protocol : "HTTPS/REST",
        description: typeof c.description === "string" ? c.description : "",
        sync: c.sync !== false,
      } as CommPattern;
    })
    .filter((c): c is CommPattern => !!c);
}

function normalizeEvents(raw: unknown): EventContract[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e: any) => {
      if (!e || typeof e.name !== "string") return null;
      return {
        name: e.name,
        producer: typeof e.producer === "string" ? e.producer : "",
        consumers: Array.isArray(e.consumers)
          ? e.consumers.filter((c: unknown) => typeof c === "string")
          : [],
        channel: typeof e.channel === "string" ? e.channel : "",
        description: typeof e.description === "string" ? e.description : "",
      } as EventContract;
    })
    .filter((e): e is EventContract => !!e);
}

function hashOf(apis: Api[], comms: CommPattern[], events: EventContract[]): string {
  return JSON.stringify({
    a: apis.map((a) => [
      a.name,
      a.style,
      a.base_path,
      a.owner_component,
      a.description,
      a.endpoints.map((e) => [e.method, e.path, e.description, e.auth_required]),
    ]),
    c: comms.map((c) => [c.from, c.to, c.pattern, c.protocol, c.sync, c.description]),
    e: events.map((e) => [e.name, e.producer, [...e.consumers].sort(), e.channel, e.description]),
  });
}
