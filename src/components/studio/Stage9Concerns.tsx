/**
 * Stage 9 — Cross-cutting concerns (Studio native).
 *
 * StageShell surface for capturing the three cross-cutting pillars users
 * asked for:
 *   - Security (authentication, authorization, encryption)
 *   - Logging & observability (log format, tracing, metrics, alerting)
 *   - Standardized error handling (circuit breaker, retry, fallback, timeouts)
 *
 * Persists into `architecture_artifacts` as an `executive_summary` artifact
 * for stage 9 (matches the run-agent registry). Also renders the "Run agent"
 * shortcut for `useRunStage(9)`.
 *
 * Readiness gates to advance to Stage 10 (Infrastructure):
 *   - Stage 8 (`api_design`) artifact exists.
 *   - Auth method + protocol + rationale captured.
 *   - Encryption at-rest + in-transit captured.
 *   - Log format + tracing framework + metrics methodology + alerting captured.
 *   - Circuit breaker + retry + timeouts captured.
 *   - Latest edits saved as a new artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  Shield,
  Activity,
  ShieldAlert,
  AlertTriangle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import StageShell, { SectionCard } from "@/components/studio/StageShell";
import { getStage, kickerFor } from "@/components/studio/stage-registry";
import { useRunStage } from "@/hooks/useRunStage";
import RunAgentButton from "@/components/studio/RunAgentButton";

// ── Types ────────────────────────────────────────────────────────────────

const AUTH_METHODS = ["OAuth2/OIDC", "SAML", "JWT", "API Key", "mTLS", "Session cookie"] as const;
const AUTHZ_MODELS = ["RBAC", "ABAC", "ReBAC", "PBAC", "ACL"] as const;
const LOG_FORMATS = ["JSON structured", "OpenTelemetry logs", "syslog", "Plain text"] as const;
const TRACING_FW = ["OpenTelemetry", "Jaeger", "Zipkin", "AWS X-Ray", "Datadog APM"] as const;
const METRICS_METH = ["RED (Rate/Errors/Duration)", "USE (Utilization/Saturation/Errors)", "Four Golden Signals", "Custom SLIs"] as const;
const RETRY_ALGOS = ["Exponential backoff + jitter", "Fixed interval", "Linear backoff", "No retry"] as const;
const CB_IMPLS = ["Resilience4j", "Polly", "Istio circuit breaker", "Envoy outlier detection", "Custom middleware"] as const;

interface Security {
  auth_method: string;
  auth_protocol: string;
  mfa_policy: string;
  authz_model: string;
  authz_engine: string;
  encryption_at_rest: string;
  encryption_in_transit: string;
  secret_management: string;
  rationale: string;
}

interface Observability {
  log_format: string;
  log_retention: string;
  correlation_ids: boolean;
  tracing_framework: string;
  tracing_sampling: string;
  metrics_methodology: string;
  alerting_strategy: string;
  slis: { name: string; type: string; target: string }[];
}

interface Resilience {
  circuit_breaker_impl: string;
  circuit_thresholds: string;
  retry_algorithm: string;
  max_retries: number;
  bulkhead_isolation: string;
  data_consistency: string;
  timeouts: { dependency: string; connect_ms: number; read_ms: number }[];
  fallbacks: { scenario: string; fallback: string }[];
}

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

const EMPTY_SEC: Security = {
  auth_method: "",
  auth_protocol: "",
  mfa_policy: "",
  authz_model: "",
  authz_engine: "",
  encryption_at_rest: "",
  encryption_in_transit: "",
  secret_management: "",
  rationale: "",
};
const EMPTY_OBS: Observability = {
  log_format: "",
  log_retention: "",
  correlation_ids: true,
  tracing_framework: "",
  tracing_sampling: "",
  metrics_methodology: "",
  alerting_strategy: "",
  slis: [],
};
const EMPTY_RES: Resilience = {
  circuit_breaker_impl: "",
  circuit_thresholds: "",
  retry_algorithm: "",
  max_retries: 3,
  bulkhead_isolation: "",
  data_consistency: "",
  timeouts: [],
  fallbacks: [],
};

// ── Component ────────────────────────────────────────────────────────────

export default function Stage9Concerns({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(9);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sec, setSec] = useState<Security>(EMPTY_SEC);
  const [obs, setObs] = useState<Observability>(EMPTY_OBS);
  const [res, setRes] = useState<Resilience>(EMPTY_RES);
  const [savedHash, setSavedHash] = useState<string>(hashOf(EMPTY_SEC, EMPTY_OBS, EMPTY_RES));
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [apiVersion, setApiVersion] = useState<number>(0);

  // SLI draft
  const [sliName, setSliName] = useState("");
  const [sliType, setSliType] = useState("latency");
  const [sliTarget, setSliTarget] = useState("");
  // timeout draft
  const [toDep, setToDep] = useState("");
  const [toConnect, setToConnect] = useState<number>(1000);
  const [toRead, setToRead] = useState<number>(3000);
  // fallback draft
  const [fbScenario, setFbScenario] = useState("");
  const [fbFallback, setFbFallback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, api] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 9)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("architecture_artifacts")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("stage", 8)
        .eq("type", "api_design")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setApiVersion(api.data?.version ?? 0);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const content = artifact.data.content as any;
      const s = normalizeSecurity(content?.security_architecture);
      const o = normalizeObservability(content?.observability_strategy);
      const r = normalizeResilience(content?.resilience_patterns);
      setSec(s);
      setObs(o);
      setRes(r);
      setSavedHash(hashOf(s, o, r));
    } else {
      setSec(EMPTY_SEC);
      setObs(EMPTY_OBS);
      setRes(EMPTY_RES);
      setSavedHash(hashOf(EMPTY_SEC, EMPTY_OBS, EMPTY_RES));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { runStage, running, polling } = useRunStage(projectId, 9, load);

  // ── Derived ────────────────────────────────────────────────────────────
  const dirty = hashOf(sec, obs, res) !== savedHash;
  const hasApi = apiVersion > 0;

  const secOk = !!sec.auth_method && !!sec.auth_protocol && !!sec.rationale && !!sec.encryption_at_rest && !!sec.encryption_in_transit;
  const obsOk = !!obs.log_format && !!obs.tracing_framework && !!obs.metrics_methodology && !!obs.alerting_strategy;
  const resOk = !!res.circuit_breaker_impl && !!res.retry_algorithm && res.timeouts.length > 0;

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasApi) issues.push("Stage 8 (API design) must be locked first.");
    if (!sec.auth_method) issues.push("Security: choose an authentication method.");
    if (!sec.auth_protocol) issues.push("Security: name the auth protocol (e.g. OAuth2 authorization code + PKCE).");
    if (!sec.rationale) issues.push("Security: add a short rationale for the chosen model.");
    if (!sec.encryption_at_rest) issues.push("Security: define encryption at rest (algorithm + key mgmt).");
    if (!sec.encryption_in_transit) issues.push("Security: define encryption in transit (e.g. TLS 1.3).");
    if (!obs.log_format) issues.push("Observability: choose a log format.");
    if (!obs.tracing_framework) issues.push("Observability: choose a tracing framework.");
    if (!obs.metrics_methodology) issues.push("Observability: choose a metrics methodology.");
    if (!obs.alerting_strategy) issues.push("Observability: describe the alerting/escalation strategy.");
    if (!res.circuit_breaker_impl) issues.push("Error handling: pick a circuit breaker implementation.");
    if (!res.retry_algorithm) issues.push("Error handling: pick a retry algorithm.");
    if (res.timeouts.length === 0) issues.push("Error handling: define at least one dependency timeout.");
    return issues;
  }, [sec, obs, res, hasApi]);

  const ready = hasApi && secOk && obsOk && resOk && !dirty && validation.length === 0;

  // ── SLI / Timeout / Fallback mutations ─────────────────────────────────
  function addSli() {
    if (!sliName.trim() || !sliTarget.trim()) return toast.error("SLI needs a name and target.");
    setObs((p) => ({ ...p, slis: [...p.slis, { name: sliName.trim(), type: sliType, target: sliTarget.trim() }] }));
    setSliName("");
    setSliTarget("");
  }
  function removeSli(i: number) {
    setObs((p) => ({ ...p, slis: p.slis.filter((_, idx) => idx !== i) }));
  }
  function addTimeout() {
    if (!toDep.trim()) return toast.error("Name the dependency.");
    setRes((p) => ({ ...p, timeouts: [...p.timeouts, { dependency: toDep.trim(), connect_ms: toConnect, read_ms: toRead }] }));
    setToDep("");
  }
  function removeTimeout(i: number) {
    setRes((p) => ({ ...p, timeouts: p.timeouts.filter((_, idx) => idx !== i) }));
  }
  function addFallback() {
    if (!fbScenario.trim() || !fbFallback.trim()) return toast.error("Scenario and fallback are required.");
    setRes((p) => ({ ...p, fallbacks: [...p.fallbacks, { scenario: fbScenario.trim(), fallback: fbFallback.trim() }] }));
    setFbScenario("");
    setFbFallback("");
  }
  function removeFallback(i: number) {
    setRes((p) => ({ ...p, fallbacks: p.fallbacks.filter((_, idx) => idx !== i) }));
  }

  async function persist() {
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
      stage: 9,
      type: "executive_summary",
      title: `Cross-cutting Concerns (v${nextVersion})`,
      version: nextVersion,
      status: "draft",
      created_by: uid,
      generated_by: "studio_manual",
      content: {
        title: `Cross-cutting Concerns (v${nextVersion})`,
        summary: `${sec.auth_method || "auth TBD"} · ${obs.tracing_framework || "tracing TBD"} · ${res.circuit_breaker_impl || "resilience TBD"}`,
        key_findings: [
          `Authentication: ${sec.auth_method || "—"} (${sec.auth_protocol || "—"}).`,
          `Observability: ${obs.log_format || "—"} logs, ${obs.tracing_framework || "—"} tracing, ${obs.metrics_methodology || "—"}.`,
          `Error handling: ${res.circuit_breaker_impl || "—"} + ${res.retry_algorithm || "—"} across ${res.timeouts.length} dependency timeout(s).`,
        ],
        security_architecture: {
          authentication_strategy: {
            method: sec.auth_method,
            protocol: sec.auth_protocol,
            mfa_policy: sec.mfa_policy,
            rationale: sec.rationale,
          },
          authorization_model: {
            model: sec.authz_model,
            description: sec.authz_engine,
            policy_engine: sec.authz_engine,
          },
          encryption: {
            at_rest: sec.encryption_at_rest,
            in_transit: sec.encryption_in_transit,
            key_management: sec.secret_management,
          },
          secret_management: { tool: sec.secret_management },
        },
        observability_strategy: {
          logging: { format: obs.log_format, correlation_ids: obs.correlation_ids, retention: obs.log_retention },
          tracing: { framework: obs.tracing_framework, sampling_rate: obs.tracing_sampling, propagation: "W3C traceparent" },
          metrics: { methodology: obs.metrics_methodology, slis: obs.slis },
          alerting: { strategy: obs.alerting_strategy, escalation: obs.alerting_strategy },
        },
        resilience_patterns: {
          circuit_breaker: { implementation: res.circuit_breaker_impl, thresholds: res.circuit_thresholds, fallback: res.fallbacks.map((f) => f.fallback).join("; ") },
          retry_strategy: { algorithm: res.retry_algorithm, max_retries: res.max_retries, idempotency: "required for retried operations" },
          bulkhead: { isolation_method: res.bulkhead_isolation, resource_limits: "" },
          data_consistency: { pattern: res.data_consistency, description: res.data_consistency },
          timeout_config: res.timeouts,
          fallback_strategies: res.fallbacks,
        },
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

  const missingHint = !hasApi
    ? "Lock the interface layer in Stage 8 first."
    : !secOk
      ? "Complete the security block."
      : !obsOk
        ? "Complete the observability block."
        : !resOk
          ? "Complete the error handling block."
          : dirty
            ? "Save your changes first."
            : undefined;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 9 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : (secOk || obsOk || resOk) ? "In progress" : "Not started",
        tone: ready ? "emerald" : (secOk || obsOk || resOk) ? "primary" : "neutral",
      }}
      stats={[
        {
          label: "Security",
          value: loading ? "—" : secOk ? "OK" : "Gaps",
          sub: sec.auth_method || "no method",
          tone: secOk ? "emerald" : "amber",
        },
        {
          label: "Observability",
          value: loading ? "—" : obsOk ? "OK" : "Gaps",
          sub: `${obs.slis.length} SLI${obs.slis.length === 1 ? "" : "s"}`,
          tone: obsOk ? "emerald" : "amber",
        },
        {
          label: "Error handling",
          value: loading ? "—" : resOk ? "OK" : "Gaps",
          sub: `${res.timeouts.length} timeout${res.timeouts.length === 1 ? "" : "s"} · ${res.fallbacks.length} fallback${res.fallbacks.length === 1 ? "" : "s"}`,
          tone: resOk ? "emerald" : "amber",
        },
        {
          label: "Artifact",
          value: loading ? "—" : artifactVersion > 0 ? `v${artifactVersion}` : "—",
          sub: dirty ? "unsaved changes" : "up to date",
          tone: dirty ? "amber" : "primary",
        },
      ]}
      checks={[
        {
          key: "api",
          label: `Interface layer locked (Stage 8${apiVersion ? ` v${apiVersion}` : ""})`,
          ok: hasApi,
        },
        { key: "sec", label: "Security: auth, authz and encryption defined", ok: secOk },
        { key: "obs", label: "Observability: logs, tracing, metrics and alerting defined", ok: obsOk },
        { key: "res", label: "Error handling: circuit breaker, retry and timeouts defined", ok: resOk },
        { key: "saved", label: "Latest edits saved as an artifact version", ok: !dirty },
      ]}
      checklistTitle="Ready to lock the cross-cutting concerns?"
      checklistBlurb="Infrastructure planning (Stage 10) inherits these security, observability and resilience decisions."
      advance={{
        label: ready ? "Concerns are locked — advance to Stage 10" : "Complete the cross-cutting design to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to Infrastructure",
        missingHint,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-generate */}
      <SectionCard
        title="Auto-generate cross-cutting design"
        subtitle={
          !hasApi
            ? "Lock the API design in Stage 8 first."
            : "Runs the Cross-cutting Concerns agent against your APIs and components."
        }
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasApi ? "Design APIs in Stage 8 first." : undefined}
            />
            <Button size="sm" onClick={persist} disabled={saving || !dirty} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? "Save version" : "Saved"}
            </Button>
          </div>
        }
      >
        <div className="text-xs text-muted-foreground">
          {artifactVersion > 0 ? (
            <>
              Latest artifact: <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span>. Editing below creates a new version when saved.
            </>
          ) : (
            <>No cross-cutting design yet. Run the agent or fill in the sections below.</>
          )}
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard
        title="Security"
        subtitle="Authentication, authorization and encryption. All fields required to lock."
        right={<Badge variant="outline" className="text-[10px]"><Shield className="h-3 w-3 mr-1" />{secOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="Auth method *" value={sec.auth_method} onChange={(v) => setSec({ ...sec, auth_method: v })} options={AUTH_METHODS} />
          <LabeledInput label="Auth protocol *" placeholder="OAuth2 authorization code + PKCE" value={sec.auth_protocol} onChange={(v) => setSec({ ...sec, auth_protocol: v })} />
          <LabeledInput label="MFA policy" placeholder="Required for admin roles" value={sec.mfa_policy} onChange={(v) => setSec({ ...sec, mfa_policy: v })} />
          <LabeledSelect label="Authorization model" value={sec.authz_model} onChange={(v) => setSec({ ...sec, authz_model: v })} options={AUTHZ_MODELS} />
          <LabeledInput label="Policy engine" placeholder="OPA / Cedar / in-app" value={sec.authz_engine} onChange={(v) => setSec({ ...sec, authz_engine: v })} />
          <LabeledInput label="Secret management" placeholder="AWS Secrets Manager, Vault, etc." value={sec.secret_management} onChange={(v) => setSec({ ...sec, secret_management: v })} />
          <LabeledInput label="Encryption at rest *" placeholder="AES-256, KMS-managed keys" value={sec.encryption_at_rest} onChange={(v) => setSec({ ...sec, encryption_at_rest: v })} />
          <LabeledInput label="Encryption in transit *" placeholder="TLS 1.3, mTLS between services" value={sec.encryption_in_transit} onChange={(v) => setSec({ ...sec, encryption_in_transit: v })} />
        </div>
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Rationale *</label>
          <Textarea
            rows={2}
            value={sec.rationale}
            onChange={(e) => setSec({ ...sec, rationale: e.target.value })}
            placeholder="Why these choices fit the drivers (compliance, threat model, integrations)."
          />
        </div>
      </SectionCard>

      {/* Observability */}
      <SectionCard
        title="Logging & observability"
        subtitle="Structured logs, distributed tracing, metrics and alerting."
        right={<Badge variant="outline" className="text-[10px]"><Activity className="h-3 w-3 mr-1" />{obsOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="Log format *" value={obs.log_format} onChange={(v) => setObs({ ...obs, log_format: v })} options={LOG_FORMATS} />
          <LabeledInput label="Log retention" placeholder="30 days hot / 1 year cold" value={obs.log_retention} onChange={(v) => setObs({ ...obs, log_retention: v })} />
          <LabeledSelect label="Tracing framework *" value={obs.tracing_framework} onChange={(v) => setObs({ ...obs, tracing_framework: v })} options={TRACING_FW} />
          <LabeledInput label="Trace sampling" placeholder="10% head-based, 100% for errors" value={obs.tracing_sampling} onChange={(v) => setObs({ ...obs, tracing_sampling: v })} />
          <LabeledSelect label="Metrics methodology *" value={obs.metrics_methodology} onChange={(v) => setObs({ ...obs, metrics_methodology: v })} options={METRICS_METH} />
          <LabeledInput label="Alerting strategy *" placeholder="PagerDuty on SLO burn > 2x, Slack on warnings" value={obs.alerting_strategy} onChange={(v) => setObs({ ...obs, alerting_strategy: v })} />
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Service level indicators</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-4" placeholder="Name (e.g. checkout latency)" value={sliName} onChange={(e) => setSliName(e.target.value)} />
            <Select value={sliType} onValueChange={setSliType}>
              <SelectTrigger className="md:col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["latency", "availability", "error_rate", "throughput", "saturation"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="md:col-span-4" placeholder="Target (e.g. p95 < 300ms)" value={sliTarget} onChange={(e) => setSliTarget(e.target.value)} />
            <Button onClick={addSli} className="md:col-span-1 gap-1"><Plus className="h-4 w-4" /></Button>
          </div>
          {obs.slis.length > 0 && (
            <ul className="space-y-1">
              {obs.slis.map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">{s.type}</Badge>
                  <span className="text-muted-foreground">→ {s.target}</span>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeSli(i)} aria-label="Remove SLI">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={obs.correlation_ids}
            onChange={(e) => setObs({ ...obs, correlation_ids: e.target.checked })}
          />
          Propagate correlation IDs across services (recommended).
        </label>
      </SectionCard>

      {/* Error handling / resilience */}
      <SectionCard
        title="Standardized error handling"
        subtitle="Circuit breakers, retries, timeouts and fallbacks."
        right={<Badge variant="outline" className="text-[10px]"><ShieldAlert className="h-3 w-3 mr-1" />{resOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="Circuit breaker *" value={res.circuit_breaker_impl} onChange={(v) => setRes({ ...res, circuit_breaker_impl: v })} options={CB_IMPLS} />
          <LabeledInput label="Circuit thresholds" placeholder="50% error over 30s, 10 min half-open" value={res.circuit_thresholds} onChange={(v) => setRes({ ...res, circuit_thresholds: v })} />
          <LabeledSelect label="Retry algorithm *" value={res.retry_algorithm} onChange={(v) => setRes({ ...res, retry_algorithm: v })} options={RETRY_ALGOS} />
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Max retries</label>
            <Input type="number" min={0} max={10} value={res.max_retries} onChange={(e) => setRes({ ...res, max_retries: Number(e.target.value) || 0 })} />
          </div>
          <LabeledInput label="Bulkhead isolation" placeholder="Per-dependency thread pools, K8s namespace quotas" value={res.bulkhead_isolation} onChange={(v) => setRes({ ...res, bulkhead_isolation: v })} />
          <LabeledInput label="Data consistency" placeholder="Saga with outbox, eventual consistency" value={res.data_consistency} onChange={(v) => setRes({ ...res, data_consistency: v })} />
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Dependency timeouts *</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-5" placeholder="Dependency (e.g. Payments API)" value={toDep} onChange={(e) => setToDep(e.target.value)} />
            <Input className="md:col-span-3" type="number" placeholder="Connect ms" value={toConnect} onChange={(e) => setToConnect(Number(e.target.value) || 0)} />
            <Input className="md:col-span-3" type="number" placeholder="Read ms" value={toRead} onChange={(e) => setToRead(Number(e.target.value) || 0)} />
            <Button onClick={addTimeout} className="md:col-span-1 gap-1"><Plus className="h-4 w-4" /></Button>
          </div>
          {res.timeouts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Add at least one dependency timeout.</p>
          ) : (
            <ul className="space-y-1">
              {res.timeouts.map((t, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{t.dependency}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">connect {t.connect_ms}ms</Badge>
                  <Badge variant="outline" className="text-[10px] font-normal">read {t.read_ms}ms</Badge>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeTimeout(i)} aria-label="Remove timeout">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Fallback strategies</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-5" placeholder="Scenario (e.g. Payments API down)" value={fbScenario} onChange={(e) => setFbScenario(e.target.value)} />
            <Input className="md:col-span-6" placeholder="Fallback (e.g. queue for later, degrade to cash-on-delivery)" value={fbFallback} onChange={(e) => setFbFallback(e.target.value)} />
            <Button onClick={addFallback} className="md:col-span-1 gap-1"><Plus className="h-4 w-4" /></Button>
          </div>
          {res.fallbacks.length > 0 && (
            <ul className="space-y-1">
              {res.fallbacks.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span className="font-semibold">{f.scenario}</span>
                  <span className="text-muted-foreground">→ {f.fallback}</span>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeFallback(i)} aria-label="Remove fallback">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      {/* Validation */}
      {validation.length > 0 && (
        <SectionCard title="Validation issues" subtitle="Resolve these before advancing.">
          <ul className="space-y-1.5">
            {validation.map((v, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs">
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

// ── Small labeled controls ───────────────────────────────────────────────

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  const known = options.includes(value as any);
  const showFallback = !!value && !known;
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {showFallback && (
            <SelectItem key="__custom" value={value}>{value} <span className="opacity-60">(custom)</span></SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

// Map any raw string (e.g. "OpenTelemetry for distributed tracing across all services.")
// to the closest preset option so the <Select> actually renders it. Returns the
// original string when nothing matches (validation still treats it as filled).
function toOption(raw: string, options: readonly string[]): string {
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const contained = options.find((o) => lower.includes(o.toLowerCase()));
  if (contained) return contained;
  const scored = options
    .map((o) => {
      const tokens = o.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      const hits = tokens.filter((t) => lower.includes(t)).length;
      return { o, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  return scored[0]?.o ?? raw;
}

function normalizeSecurity(raw: any): Security {
  if (!raw || typeof raw !== "object") return EMPTY_SEC;
  const auth = raw.authentication_strategy ?? {};
  const authz = raw.authorization_model ?? {};
  const enc = raw.encryption ?? {};
  const secret = raw.secret_management ?? {};
  return {
    auth_method: toOption(str(auth.method), AUTH_METHODS),
    auth_protocol: str(auth.protocol),
    mfa_policy: str(auth.mfa_policy),
    rationale: str(auth.rationale),
    authz_model: toOption(str(authz.model), AUTHZ_MODELS),
    authz_engine: str(authz.policy_engine ?? authz.description),
    encryption_at_rest: str(enc.at_rest),
    encryption_in_transit: str(enc.in_transit),
    secret_management: str(secret.tool ?? enc.key_management),
  };
}

function normalizeObservability(raw: any): Observability {
  if (!raw || typeof raw !== "object") return EMPTY_OBS;
  const log = raw.logging ?? {};
  const tr = raw.tracing ?? {};
  const met = raw.metrics ?? {};
  const alert = raw.alerting ?? {};
  return {
    log_format: toOption(str(log.format), LOG_FORMATS),
    log_retention: str(log.retention),
    correlation_ids: log.correlation_ids !== false,
    tracing_framework: toOption(str(tr.framework), TRACING_FW),
    tracing_sampling: str(tr.sampling_rate),
    metrics_methodology: toOption(str(met.methodology), METRICS_METH),
    alerting_strategy: str(alert.strategy),
    slis: Array.isArray(met.slis)
      ? met.slis
          .map((s: any) => s && typeof s.name === "string" ? { name: s.name, type: str(s.type), target: str(s.target) } : null)
          .filter(Boolean) as Observability["slis"]
      : [],
  };
}

function normalizeResilience(raw: any): Resilience {
  if (!raw || typeof raw !== "object") return EMPTY_RES;
  const cb = raw.circuit_breaker ?? {};
  const retry = raw.retry_strategy ?? {};
  const bulk = raw.bulkhead ?? {};
  const dc = raw.data_consistency ?? {};
  return {
    circuit_breaker_impl: toOption(str(cb.implementation), CB_IMPLS),
    circuit_thresholds: str(cb.thresholds),
    retry_algorithm: toOption(str(retry.algorithm), RETRY_ALGOS),
    max_retries: Number(retry.max_retries) || 0,
    bulkhead_isolation: str(bulk.isolation_method),
    data_consistency: str(dc.pattern),
    timeouts: Array.isArray(raw.timeout_config)
      ? raw.timeout_config
          .map((t: any) => t && typeof t.dependency === "string" ? { dependency: t.dependency, connect_ms: Number(t.connect_ms) || 0, read_ms: Number(t.read_ms) || 0 } : null)
          .filter(Boolean) as Resilience["timeouts"]
      : [],
    fallbacks: Array.isArray(raw.fallback_strategies)
      ? raw.fallback_strategies
          .map((f: any) => f && typeof f.scenario === "string" ? { scenario: f.scenario, fallback: str(f.fallback) } : null)
          .filter(Boolean) as Resilience["fallbacks"]
      : [],
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function hashOf(sec: Security, obs: Observability, res: Resilience): string {
  return JSON.stringify({ sec, obs: { ...obs, slis: [...obs.slis].sort((a, b) => a.name.localeCompare(b.name)) }, res });
}
