import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Zap,
  Eye,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Cpu,
  Info,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import RagSourcesPanel from "./RagSourcesPanel";
import DebatePanel from "./DebatePanel";
import { useDebateData } from "@/hooks/useDebateData";
import RunStageCTA from "./RunStageCTA";
import { cn } from "@/lib/utils";
import { DensityText } from "./DensityControls";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import LockAdvanceBar from "./LockAdvanceBar";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

/* ── Reference standards for each concern ── */
const REFERENCE_STANDARDS = {
  security: [
    {
      id: "NIST-800-53",
      label: "NIST SP 800-53 Rev 5",
      desc: "Security & Privacy Controls",
      url: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
    },
    {
      id: "ISO-27001",
      label: "ISO/IEC 27001:2022",
      desc: "Information Security Management",
      url: "https://www.iso.org/standard/27001",
    },
    {
      id: "OWASP-TOP10",
      label: "OWASP Top 10 (2021)",
      desc: "Web Application Security Risks",
      url: "https://owasp.org/www-project-top-ten/",
    },
    {
      id: "ZERO-TRUST",
      label: "NIST SP 800-207",
      desc: "Zero Trust Architecture",
      url: "https://csrc.nist.gov/publications/detail/sp/800-207/final",
    },
  ],
  observability: [
    {
      id: "OTEL",
      label: "OpenTelemetry",
      desc: "Observability Framework (CNCF)",
      url: "https://opentelemetry.io/docs/",
    },
    {
      id: "SRE-BOOK",
      label: "Google SRE Book",
      desc: "Site Reliability Engineering",
      url: "https://sre.google/sre-book/table-of-contents/",
    },
    {
      id: "RED-USE",
      label: "RED & USE Methods",
      desc: "Monitoring methodologies (Tom Wilkie / Brendan Gregg)",
      url: "",
    },
    {
      id: "ISO-25010-REL",
      label: "ISO 25010 — Reliability",
      desc: "Maturity, Availability, Fault Tolerance, Recoverability",
      url: "",
    },
  ],
  resilience: [
    {
      id: "RELEASE-IT",
      label: "Release It! (2nd Ed.)",
      desc: "Michael Nygard — Stability Patterns",
      url: "",
    },
    {
      id: "AWS-RELIABILITY",
      label: "AWS Well-Architected — Reliability",
      desc: "Foundations, Change Mgmt, Failure Mgmt",
      url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/",
    },
    {
      id: "CHAOS-ENG",
      label: "Principles of Chaos Engineering",
      desc: "Netflix / principlesofchaos.org",
      url: "https://principlesofchaos.org/",
    },
    {
      id: "PATTERNS",
      label: "Stability Patterns",
      desc: "Circuit Breaker, Bulkhead, Retry, Timeout, Fallback",
      url: "",
    },
  ],
  caching: [
    {
      id: "AWS-CACHING",
      label: "AWS Caching Best Practices",
      desc: "ElastiCache, CloudFront, DAX",
      url: "https://aws.amazon.com/caching/best-practices/",
    },
    {
      id: "FOWLER-CACHE",
      label: "Martin Fowler — Cache Patterns",
      desc: "Cache-Aside, Write-Through, Write-Behind",
      url: "",
    },
    {
      id: "CDN-PATTERNS",
      label: "CDN & Edge Caching",
      desc: "Content delivery optimization strategies",
      url: "",
    },
    {
      id: "ISO-25010-PERF",
      label: "ISO 25010 — Performance Efficiency",
      desc: "Time Behaviour, Resource Utilization, Capacity",
      url: "",
    },
  ],
};

const CONCERN_TABS = [
  { id: "security", label: "Security Architecture", icon: Shield, color: "text-red-500" },
  { id: "observability", label: "Observability & Monitoring", icon: Eye, color: "text-blue-500" },
  {
    id: "resilience",
    label: "Error Handling & Resilience",
    icon: AlertTriangle,
    color: "text-amber-500",
  },
  { id: "caching", label: "Caching & Performance", icon: Zap, color: "text-emerald-500" },
];

/* ── Plain-language guidance for each concern ── */
const CONCERN_GUIDE: Record<
  string,
  {
    whatItIs: string;
    whyItMatters: string;
    howToUse: string[];
    checklistMeaning: string;
  }
> = {
  security: {
    whatItIs:
      "Security architecture defines how the system protects data, identities, and operations from misuse, attack, or accidental exposure.",
    whyItMatters:
      "Weak security causes breaches, regulatory penalties (GDPR, HIPAA, SOC2), and loss of user trust. It is cheaper to design in than to patch later.",
    howToUse: [
      "Run the AI agent — it proposes authentication, authorization, encryption and audit controls based on your architecture.",
      "Read each checklist item — it represents a control your design must address.",
      "Tick items the AI clearly handled. Leave unchecked items as gaps you must resolve manually before locking.",
    ],
    checklistMeaning:
      "Each item is an industry-standard control (NIST 800-53 / OWASP / ISO 27001). 'Verified' means your design specifies how it is implemented — not just that it exists.",
  },
  observability: {
    whatItIs:
      "Observability is the ability to understand what the system is doing in production through logs, metrics, and traces — without shipping new code.",
    whyItMatters:
      "Without observability, outages take longer to detect, diagnose, and recover from. SLOs cannot be measured, and root-cause analysis becomes guesswork.",
    howToUse: [
      "Run the AI agent — it suggests a logging, tracing, metrics and alerting strategy aligned to your architecture style.",
      "For each checklist item, confirm the AI named a tool, format, or pattern (e.g. OpenTelemetry, RED method, structured JSON logs).",
      "Flag items where the AI was vague (e.g. 'add logging') — those need refinement before lock.",
    ],
    checklistMeaning:
      "Each item maps to the three pillars of observability (logs, metrics, traces) plus the operational glue (health checks, dashboards, alerts) defined by Google SRE and OpenTelemetry.",
  },
  resilience: {
    whatItIs:
      "Resilience (error handling) is the system's ability to keep working — or fail safely — when dependencies, network, or hardware misbehave.",
    whyItMatters:
      "Distributed systems fail constantly in small ways. Without explicit resilience patterns, one slow dependency can cascade into a full outage (the classic 'thundering herd').",
    howToUse: [
      "Run the AI agent — it recommends stability patterns (circuit breaker, retry, timeout, bulkhead) per integration point.",
      "Check each item against your actual integrations: are timeouts and retries defined for every external call?",
      "Items left unchecked indicate cascading-failure risk — surface them to the Synthetic Architect for review.",
    ],
    checklistMeaning:
      "Each item is a stability pattern from Nygard's 'Release It!' or AWS Well-Architected Reliability pillar. They are proven defenses against specific failure modes.",
  },
  caching: {
    whatItIs:
      "Caching stores frequently-used data closer to the consumer (in memory, at the edge, or in a fast store) to reduce latency and load on origin systems.",
    whyItMatters:
      "Caching is the highest-leverage performance lever — but a wrong invalidation strategy creates stale-data bugs that are hard to reproduce. Design it deliberately.",
    howToUse: [
      "Run the AI agent — it identifies cache layers (CDN, application, database) appropriate for your read/write patterns.",
      "Confirm each item names a concrete pattern (cache-aside, write-through), a TTL or invalidation trigger, and a target latency.",
      "If 'Performance budget' is unchecked, your team has no way to verify the cache is actually helping.",
    ],
    checklistMeaning:
      "Each item maps to a caching layer or invalidation concern from Fowler's cache patterns and AWS caching best practices. ISO 25010 'Performance Efficiency' grounds the targets.",
  },
};

/* ── Why it matters + how to verify per checklist item ── */
const ITEM_GUIDANCE: Record<string, { why: string; verify: string }> = {
  // Security
  "Authentication strategy defined": {
    why: "Without a defined authn strategy, anyone can impersonate any user.",
    verify:
      "AI output should name a protocol (OAuth2/OIDC/SAML), token format (JWT, opaque), and MFA stance.",
  },
  "Authorization model selected": {
    why: "Authn proves identity; authz controls what they can do. Skipping this leads to privilege escalation.",
    verify:
      "Look for RBAC roles, ABAC attributes, or policy engine (OPA) — plus where decisions are enforced.",
  },
  "Data encryption at rest & in transit": {
    why: "Unencrypted data on disk or wire is a regulatory violation in most jurisdictions.",
    verify:
      "Confirm TLS version, cipher for at-rest (AES-256), and key-management owner (KMS, Vault).",
  },
  "Input validation & sanitization": {
    why: "The #1 source of breaches (OWASP A03). Untrusted input is the universal attack vector.",
    verify:
      "AI should specify validation library or framework, and call out injection-prone surfaces (DB, HTML, shell).",
  },
  "Secret management": {
    why: "Hard-coded or env-leaked secrets are routinely scraped from logs and repos.",
    verify: "Look for a vault/KMS, rotation cadence, and how services receive secrets at runtime.",
  },
  "Audit logging & compliance": {
    why: "Required for forensics and most compliance regimes (SOC2, HIPAA, GDPR Art. 30).",
    verify: "AI should name what events are logged, retention period, and immutability mechanism.",
  },
  "Zero Trust boundaries": {
    why: "Perimeter security is dead — internal traffic must also authenticate (NIST SP 800-207).",
    verify:
      "Confirm service-to-service auth (mTLS, signed tokens) and network segmentation strategy.",
  },
  // Observability
  "Logging strategy defined": {
    why: "Unstructured logs cannot be searched or correlated across services in production.",
    verify:
      "AI should specify format (JSON), levels, correlation/trace ID propagation, and retention.",
  },
  "Distributed tracing implemented": {
    why: "Without traces, you cannot follow a single request across microservices to find latency root cause.",
    verify:
      "OpenTelemetry SDK, sampling strategy, and a backend (Jaeger, Tempo, Datadog APM) should be named.",
  },
  "Metrics & SLIs defined": {
    why: "You cannot manage what you cannot measure. SLIs are the basis for SLOs and error budgets.",
    verify:
      "Look for RED (Rate, Errors, Duration) or USE (Utilization, Saturation, Errors) metrics per service.",
  },
  "Alerting & on-call policy": {
    why: "Metrics without alerts mean nobody knows when things break. Alerts without runbooks waste on-call time.",
    verify: "AI should tie alerts to SLOs (not raw thresholds), and reference runbook locations.",
  },
  "Health check endpoints": {
    why: "Orchestrators (K8s, ECS) need probes to route traffic safely and restart unhealthy instances.",
    verify:
      "Liveness vs readiness should be distinguished — they have different failure semantics.",
  },
  "Dashboard & visualization": {
    why: "On-call engineers need a single pane of glass during an incident, not 20 raw queries.",
    verify:
      "AI should name the tool (Grafana, Datadog) and list dashboards per service or per SLO.",
  },
  // Resilience
  "Circuit breaker pattern": {
    why: "Prevents one slow downstream from exhausting all your threads/connections (cascading failure).",
    verify:
      "Confirm the pattern is applied at every external integration boundary, with thresholds.",
  },
  "Retry with exponential backoff": {
    why: "Naive retries amplify load on a struggling dependency; backoff + jitter spreads it out.",
    verify: "AI should mention max attempts, base delay, jitter, and idempotency requirement.",
  },
  "Bulkhead isolation": {
    why: "Isolates failures so one bad tenant or endpoint cannot drain shared resources.",
    verify: "Look for separate thread pools / connection pools per dependency or tenant.",
  },
  "Timeout configuration": {
    why: "The default in most HTTP clients is 'wait forever' — the #1 cause of cascading hangs.",
    verify:
      "Every outbound call should have explicit connect + read timeouts, shorter than the caller's.",
  },
  "Fallback strategies": {
    why: "When a dependency is down, returning cached or default data beats returning a 500.",
    verify: "AI should specify fallback per critical call (cached value, default, degraded UI).",
  },
  "Chaos engineering readiness": {
    why: "Resilience patterns are theory until tested under controlled failure (Netflix principle).",
    verify: "Look for game-day cadence, failure-injection tooling, and blast-radius limits.",
  },
  "Data consistency strategy": {
    why: "Distributed writes without a strategy create silent data corruption.",
    verify:
      "AI should pick saga, compensating transaction, or eventual consistency — and justify it.",
  },
  // Caching
  "Cache-aside pattern defined": {
    why: "The default and safest pattern: app reads cache, falls back to DB, writes back to cache.",
    verify: "Confirm pattern is named and which layer (app vs DB vs CDN) owns the cache.",
  },
  "Cache invalidation strategy": {
    why: "'There are only two hard things in CS: cache invalidation and naming things.' Stale data causes the worst bugs.",
    verify: "AI should name TTL values, event-driven invalidation, or versioned cache keys.",
  },
  "CDN / edge caching": {
    why: "Static and read-heavy content served from the edge cuts latency by 10–100x globally.",
    verify: "Look for CloudFront/Fastly/Cloudflare and which content types are cached at the edge.",
  },
  "Database query caching": {
    why: "Repeated identical queries waste DB CPU — the most expensive resource in most stacks.",
    verify: "Confirm query result caching, materialized views, or read-replica routing strategy.",
  },
  "Session & state caching": {
    why: "Storing sessions in the DB makes every request a DB hit; Redis/Memcached eliminates this.",
    verify: "AI should name Redis/Memcached, eviction policy, and replication mode for HA.",
  },
  "Performance budget defined": {
    why: "Without a target, you cannot tell if the cache is working or if you are over-engineering.",
    verify: "Look for explicit p50/p95/p99 latency targets per endpoint.",
  },
};

function ReferenceCard({ refs }: { refs: typeof REFERENCE_STANDARDS.security }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border bg-card/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-display font-semibold flex-1">
          Industry & Academic References
        </span>
        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-5">
          {refs.length} standards
        </Badge>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t pt-3 space-y-2">
          {refs.map((r) => (
            <div key={r.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/40">
              <span className="text-[10px] font-mono font-bold text-primary mt-0.5 flex-shrink-0">
                [{r.id}]
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground">{r.label}</p>
                <p className="text-[10px] text-muted-foreground">{r.desc}</p>
              </div>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors mt-0.5"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Checklist items per concern ── */
const CHECKLISTS: Record<string, { label: string; description: string; keywords: string[] }[]> = {
  security: [
    {
      label: "Authentication strategy defined",
      description: "OAuth2, OIDC, SAML, or custom — with MFA policy",
      keywords: ["authentication", "authn", "oauth", "oidc", "mfa", "saml"],
    },
    {
      label: "Authorization model selected",
      description: "RBAC, ABAC, or policy-based (e.g., OPA/Rego)",
      keywords: ["authorization", "authz", "rbac", "abac", "opa", "permission"],
    },
    {
      label: "Data encryption at rest & in transit",
      description: "TLS 1.3, AES-256, key management strategy",
      keywords: ["encryption", "tls", "aes", "key management", "at rest", "in transit"],
    },
    {
      label: "Input validation & sanitization",
      description: "OWASP Top 10 mitigations, SQL injection, XSS prevention",
      keywords: ["input validation", "sanitization", "xss", "sql injection", "owasp"],
    },
    {
      label: "Secret management",
      description: "Vault, KMS, or environment-based secret rotation",
      keywords: ["secret", "vault", "kms", "rotation", "credential"],
    },
    {
      label: "Audit logging & compliance",
      description: "GDPR, HIPAA, SOC2 — immutable audit trail",
      keywords: ["audit", "compliance", "gdpr", "hipaa", "soc2", "logging"],
    },
    {
      label: "Zero Trust boundaries",
      description: "Service-to-service auth, network segmentation, least privilege",
      keywords: ["zero trust", "least privilege", "network segmentation", "mtls"],
    },
  ],
  observability: [
    {
      label: "Logging strategy defined",
      description: "Structured logging, log levels, correlation IDs, retention",
      keywords: ["logging", "structured log", "correlation id", "log level"],
    },
    {
      label: "Distributed tracing implemented",
      description: "OpenTelemetry traces across service boundaries",
      keywords: ["tracing", "opentelemetry", "distributed trace", "span"],
    },
    {
      label: "Metrics & SLIs defined",
      description: "RED method (Rate, Errors, Duration) for each service",
      keywords: ["metrics", "sli", "red method", "rate", "duration"],
    },
    {
      label: "Alerting & on-call policy",
      description: "SLO-based alerts, escalation paths, runbooks",
      keywords: ["alerting", "on-call", "slo", "escalation", "runbook"],
    },
    {
      label: "Health check endpoints",
      description: "Liveness, readiness, startup probes per component",
      keywords: ["health check", "liveness", "readiness", "probe"],
    },
    {
      label: "Dashboard & visualization",
      description: "Grafana, Datadog, or CloudWatch dashboards per service",
      keywords: ["dashboard", "grafana", "datadog", "visualization"],
    },
  ],
  resilience: [
    {
      label: "Circuit breaker pattern",
      description: "Prevent cascading failures across service boundaries",
      keywords: ["circuit breaker", "cascading failure"],
    },
    {
      label: "Retry with exponential backoff",
      description: "Idempotent operations, jitter, max retry limits",
      keywords: ["retry", "backoff", "jitter", "idempotent"],
    },
    {
      label: "Bulkhead isolation",
      description: "Thread pools, connection pools, resource isolation",
      keywords: ["bulkhead", "isolation", "thread pool", "connection pool"],
    },
    {
      label: "Timeout configuration",
      description: "Connection, read, write timeouts per dependency",
      keywords: ["timeout", "connection timeout", "read timeout"],
    },
    {
      label: "Fallback strategies",
      description: "Graceful degradation, default responses, cached fallbacks",
      keywords: ["fallback", "graceful degradation", "default response"],
    },
    {
      label: "Chaos engineering readiness",
      description: "Game days, failure injection, blast radius analysis",
      keywords: ["chaos engineering", "game day", "failure injection", "blast radius"],
    },
    {
      label: "Data consistency strategy",
      description: "Saga, compensating transactions, eventual consistency",
      keywords: ["saga", "compensating transaction", "eventual consistency", "data consistency"],
    },
  ],
  caching: [
    {
      label: "Cache-aside pattern defined",
      description: "Application-managed cache with lazy loading",
      keywords: ["cache-aside", "lazy loading", "cache pattern"],
    },
    {
      label: "Cache invalidation strategy",
      description: "TTL, event-driven invalidation, cache versioning",
      keywords: ["cache invalidation", "ttl", "cache versioning"],
    },
    {
      label: "CDN / edge caching",
      description: "Static assets, API responses, geographic distribution",
      keywords: ["cdn", "edge caching", "cloudfront", "geographic"],
    },
    {
      label: "Database query caching",
      description: "Query result cache, materialized views, read replicas",
      keywords: ["query cache", "materialized view", "read replica"],
    },
    {
      label: "Session & state caching",
      description: "Redis/Memcached for session data, distributed state",
      keywords: ["redis", "memcached", "session cache", "distributed state"],
    },
    {
      label: "Performance budget defined",
      description: "Target latencies (p50, p95, p99) per endpoint",
      keywords: ["performance budget", "latency", "p50", "p95", "p99"],
    },
  ],
};

/* Glossary moved to ContextPane (left sidebar) — available across all stages. */

function getAICoverage(
  artifactContents: any[],
  keywords: string[],
): { covered: boolean; snippet?: string } {
  for (const content of artifactContents) {
    const text = JSON.stringify(content).toLowerCase();
    const matchCount = keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
    if (matchCount >= 2 || (keywords.length === 1 && matchCount === 1)) {
      for (const kw of keywords) {
        const idx = text.indexOf(kw.toLowerCase());
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + kw.length + 60);
          const raw = text
            .slice(start, end)
            .replace(/[{}"\\]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return { covered: true, snippet: `…${raw}…` };
        }
      }
      return { covered: true };
    }
  }
  return { covered: false };
}

/* Notation labels — shown as a badge next to each diagram */
const NOTATION_LABELS: Record<string, { label: string; ref: string }> = {
  // security
  dfd_trust_boundaries: {
    label: "Data Flow Diagram + Trust Boundaries",
    ref: "STRIDE / Microsoft SDL",
  },
  auth_sequence: { label: "Authentication Sequence", ref: "OAuth2 / OIDC (RFC 6749)" },
  zero_trust_topology: { label: "Zero Trust Topology", ref: "NIST SP 800-207" },
  threat_model_stride: { label: "STRIDE Threat Model", ref: "Microsoft Threat Modeling" },
  encryption_zones: { label: "Encryption Zones", ref: "NIST SP 800-57" },
  // observability
  otel_pipeline: { label: "OpenTelemetry Pipeline", ref: "CNCF OpenTelemetry" },
  three_pillars: { label: "Three Pillars (Logs / Metrics / Traces)", ref: "Google SRE Book" },
  alert_runbook_sequence: {
    label: "Alert to Runbook Sequence",
    ref: "Google SRE — Incident Response",
  },
  trace_propagation: { label: "Trace Propagation", ref: "W3C Trace Context" },
  slo_error_budget: { label: "SLO / Error Budget", ref: "Google SRE Workbook" },
  // resilience
  circuit_breaker_state: { label: "Circuit Breaker State Machine", ref: "Nygard — Release It!" },
  retry_bulkhead_flow: {
    label: "Retry + Bulkhead Flow",
    ref: "AWS Well-Architected — Reliability",
  },
  saga_sequence: { label: "Saga / Compensating Transactions", ref: "Garcia-Molina & Salem (1987)" },
  failure_mode_tree: { label: "Failure Mode Tree (FMEA)", ref: "IEC 60812" },
  graceful_degradation: { label: "Graceful Degradation", ref: "Nygard — Stability Patterns" },
  // caching
  tiered_topology: { label: "Tiered Cache Topology", ref: "AWS Caching Best Practices" },
  cache_aside_sequence: { label: "Cache-Aside Sequence", ref: "Fowler — Cache Patterns" },
  invalidation_flow: { label: "Cache Invalidation Flow", ref: "Fowler / AWS" },
  write_through: { label: "Write-Through", ref: "Fowler — Cache Patterns" },
  write_behind: { label: "Write-Behind", ref: "Fowler — Cache Patterns" },
};

type ConcernDiagram = {
  notation?: string;
  title: string;
  type?: string;
  code: string;
  description?: string;
};

function getConcernDiagrams(artifactContents: any[], concernId: string): ConcernDiagram[] {
  const out: ConcernDiagram[] = [];
  const concernKeywords: Record<string, string[]> = {
    security: ["security", "auth", "encryption", "zero trust", "rbac", "iam"],
    observability: ["observability", "tracing", "metric", "logging", "telemetry", "monitor"],
    resilience: ["resilience", "circuit", "retry", "bulkhead", "fallback", "failure"],
    caching: ["caching", "cache", "cdn", "ttl", "performance"],
  };
  const kws = concernKeywords[concernId] || [];

  for (const content of artifactContents) {
    if (!content) continue;
    const cd = content.concern_diagrams;
    if (cd && typeof cd === "object" && Array.isArray(cd[concernId])) {
      for (const d of cd[concernId]) {
        if (d?.code)
          out.push({
            notation: d.notation,
            title: d.title || `${concernId} diagram`,
            type: d.type,
            code: d.code,
            description: d.description,
          });
      }
    }
    const md = content.mermaid_diagrams;
    if (Array.isArray(md)) {
      for (const d of md) {
        if (!d?.code) continue;
        const title = String(d.title || "").toLowerCase();
        if (kws.some((k) => title.includes(k))) {
          out.push({ title: d.title || `${concernId} diagram`, type: d.type, code: d.code });
        }
      }
    }
  }
  const seen = new Set<string>();
  return out.filter((d) => {
    if (seen.has(d.code)) return false;
    seen.add(d.code);
    return true;
  });
}

export default function CrossCuttingWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const [activeTab, setActiveTab] = useState("security");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [artifacts, setArtifacts] = useState<any[]>([]);

  useEffect(() => {
    const fetchArtifacts = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 9)
        .order("created_at", { ascending: false });
      if (data) setArtifacts(data);
    };
    fetchArtifacts();
  }, [projectId, refreshKey]);

  const hasArtifacts = artifacts.length > 0;

  const artifactContents = useMemo(() => {
    return artifacts.map((a) => {
      let content = a.content;
      if (content?.parse_error) content = recoverArtifactContent(content) || content;
      return content;
    });
  }, [artifacts]);

  const toggleCheck = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentChecklist = CHECKLISTS[activeTab] || [];
  const completedCount = currentChecklist.filter(
    (_, i) => checkedItems[`${activeTab}-${i}`],
  ).length;
  const progressPct =
    currentChecklist.length > 0 ? Math.round((completedCount / currentChecklist.length) * 100) : 0;
  const refs = REFERENCE_STANDARDS[activeTab as keyof typeof REFERENCE_STANDARDS] || [];

  const aiCoverageMap = useMemo(() => {
    if (!hasArtifacts) return {};
    const map: Record<string, { covered: boolean; snippet?: string }> = {};
    currentChecklist.forEach((item, i) => {
      map[`${activeTab}-${i}`] = getAICoverage(artifactContents, item.keywords);
    });
    return map;
  }, [activeTab, artifactContents, hasArtifacts, currentChecklist]);

  const aiCoveredCount = Object.values(aiCoverageMap).filter((v) => v.covered).length;

  // Per-concern Mermaid diagrams (AI-generated)
  const concernDiagrams = useMemo(
    () => getConcernDiagrams(artifactContents, activeTab),
    [artifactContents, activeTab],
  );

  return (
    <div className="space-y-6">
      {STAGE_INTROS[9] && <StageIntro {...STAGE_INTROS[9]} title="Cross-Cutting Concerns" />}

      {/* Why cross-cutting concerns matter — prominent highlight */}
      <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h3 className="text-base font-display font-semibold text-foreground">
                Why cross-cutting concerns matter
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These are{" "}
                <strong className="text-foreground">architectural decisions, not features</strong>.
                They apply to every module — and are extremely costly to retrofit.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                <Shield className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">Security</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    Bolting it on later means breaches, fines (GDPR/HIPAA), and rewrites of every
                    auth boundary.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                <Eye className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">Observability</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    You can't fix what you can't see. Without traces &amp; metrics, production
                    debugging is guesswork.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">Resilience</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    One slow dependency cascades into total outage without circuit breakers, retries
                    &amp; timeouts.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <Zap className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    Caching &amp; Performance
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    Drives infrastructure cost, user retention, and consistency trade-offs across
                    the whole system.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-foreground/5 px-3 py-2 border-l-2 border-amber-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Bottom line:</strong> deciding these{" "}
                <em>before</em> you build services is the difference between a prototype and a
                production-grade system. That's why TimeArch dedicates Stage 9 to them.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow guidance banner */}
      <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 space-y-2">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <h4 className="text-sm font-display font-semibold text-foreground">
              How this stage works
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>
                <strong>Run the AI agent</strong> — generates security, observability, resilience
                and caching recommendations <em>and</em> a tailored architecture diagram for each
                concern.
              </li>
              <li>
                <strong>Review the output</strong> — recommendations + per-concern Mermaid diagram
                appear inside each tab.
              </li>
              <li>
                <strong>Verify the checklist</strong> — check off items the AI addressed and flag
                any gaps for manual follow-up.
              </li>
              <li>
                <strong>Lock &amp; Advance</strong> — once satisfied, lock this stage in the
                Governance panel.
              </li>
            </ol>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-auto p-1">
          {CONCERN_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 text-[11px] py-2 px-2"
              >
                <Icon className={cn("h-3.5 w-3.5", tab.color)} />
                <span className="truncate">{tab.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CONCERN_TABS.map((tab) => {
          const guide = CONCERN_GUIDE[tab.id];
          return (
            <TabsContent key={tab.id} value={tab.id} className="space-y-4 mt-4">
              {/* Per-concern plain-language guide (collapsible) */}
              {guide && <ConcernGuide tab={tab} guide={guide} />}

              {/* Progress with AI coverage info */}
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-display font-semibold">
                      {tab.label} Readiness
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {completedCount}/{currentChecklist.length} verified
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-1.5" />
                  {hasArtifacts && activeTab === tab.id && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-primary font-medium">
                        AI covers {aiCoveredCount} of {currentChecklist.length} items
                      </span>
                    </div>
                  )}
                </div>
                <Badge
                  variant={progressPct === 100 ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {progressPct}%
                </Badge>
              </div>

              {/* AI-generated industry-standard diagrams for this concern */}
              {hasArtifacts &&
                activeTab === tab.id &&
                (concernDiagrams.length > 0 ? (
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <tab.icon className={cn("h-4 w-4", tab.color)} />
                      <h4 className="text-sm font-display font-semibold flex-1">
                        {tab.label} — Industry-Standard Architecture Diagrams
                      </h4>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        {concernDiagrams.length} notation{concernDiagrams.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Each diagram uses a recognized industry notation tailored to <em>your</em>{" "}
                      system. Use them to walk reviewers through {tab.label.toLowerCase()} from
                      multiple perspectives.
                    </p>
                    <div className="space-y-5">
                      {concernDiagrams.map((d, i) => {
                        const meta = d.notation ? NOTATION_LABELS[d.notation] : undefined;
                        return (
                          <div key={i} className="space-y-2 rounded-md border bg-background/40 p-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-display font-semibold text-foreground">
                                  {d.title}
                                </h5>
                                {d.description && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                    {d.description}
                                  </p>
                                )}
                              </div>
                              {meta && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] font-mono whitespace-nowrap cursor-help"
                                    >
                                      {meta.label}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <p className="text-[11px]">
                                      <strong>Notation:</strong> {meta.label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Reference: {meta.ref}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <MermaidDiagram code={d.code} title={d.title} type={d.type} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">
                      No industry-standard {tab.label.toLowerCase()} diagrams in this artifact yet —
                      re-run the agent to generate them (DFD, sequence, state machine, topology…).
                    </p>
                  </div>
                ))}

              {/* AI artifact summary — if output exists */}
              {hasArtifacts &&
                artifacts
                  .filter((a) => {
                    const content = typeof a.content === "object" ? a.content : {};
                    return (
                      content?.concern_area === tab.id || a.title?.toLowerCase().includes(tab.id)
                    );
                  })
                  .map((artifact) => {
                    let content = artifact.content;
                    if (content?.parse_error) content = recoverArtifactContent(content) || content;
                    return (
                      <div key={artifact.id} className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-display font-semibold flex-1">
                            {artifact.title}
                          </h4>
                          <Badge variant="outline" className="text-[10px]">
                            {artifact.status}
                          </Badge>
                        </div>
                        {content?.summary && (
                          <p className="text-xs text-muted-foreground">
                            <DensityText compactLength={150}>{content.summary}</DensityText>
                          </p>
                        )}
                      </div>
                    );
                  })}

              {/* No output yet — CTA */}
              {!hasArtifacts && (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
                  <Cpu className="h-8 w-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground font-medium">
                    No AI recommendations yet
                  </p>
                  <RunStageCTA
                    stageLabel="Cross-Cutting Concerns"
                    onRun={onRunStage}
                    running={stageRunning}
                  />
                  <p className="text-xs text-muted-foreground">
                    The checklist below shows what the AI will evaluate.
                  </p>
                </div>
              )}

              {/* References */}
              <ReferenceCard refs={refs} />

              {/* Checklist with AI coverage indicators */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    {hasArtifacts ? "Verification Checklist" : "Design Checklist"}
                  </h4>
                  {hasArtifacts && (
                    <span className="text-[10px] text-muted-foreground">
                      Check items the AI adequately addressed
                    </span>
                  )}
                </div>
                {currentChecklist.map((item, i) => {
                  const key = `${tab.id}-${i}`;
                  const isChecked = !!checkedItems[key];
                  const coverage = aiCoverageMap[key];
                  const hasCoverage = coverage?.covered;
                  return (
                    <motion.button
                      key={key}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => toggleCheck(key)}
                      className={cn(
                        "flex items-start gap-2.5 w-full text-left p-2.5 rounded-lg border transition-all",
                        isChecked
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : hasCoverage
                            ? "bg-primary/[0.03] border-primary/15 hover:bg-primary/[0.06]"
                            : "bg-card hover:bg-accent/50 border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5",
                          isChecked
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-muted-foreground/30",
                        )}
                      >
                        {isChecked && <span className="text-[10px]">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={cn(
                              "text-xs font-medium",
                              isChecked && "line-through text-muted-foreground",
                            )}
                          >
                            {item.label}
                          </p>
                          {ITEM_GUIDANCE[item.label] && (
                            <Tooltip>
                              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-muted/60 text-muted-foreground/70 hover:bg-primary/15 hover:text-primary cursor-help transition-colors">
                                  <Info className="h-2.5 w-2.5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="max-w-[320px] text-[11px] leading-relaxed space-y-2 p-3"
                              >
                                <div>
                                  <p className="font-semibold text-foreground mb-0.5">
                                    Why it matters
                                  </p>
                                  <p className="text-muted-foreground">
                                    {ITEM_GUIDANCE[item.label].why}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground mb-0.5">
                                    How to verify
                                  </p>
                                  <p className="text-muted-foreground">
                                    {ITEM_GUIDANCE[item.label].verify}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {hasCoverage && !isChecked && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 px-1.5 border-primary/30 text-primary gap-0.5"
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              AI covered
                            </Badge>
                          )}
                          {isChecked && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {item.description}
                        </p>
                        {hasCoverage && coverage.snippet && !isChecked && (
                          <p className="text-[10px] text-primary/60 mt-1 italic line-clamp-1">
                            {coverage.snippet}
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <CollapsibleChallengerSection
        projectId={projectId}
        stage={9}
        refreshKey={refreshKey}
        onRunStage={onRunStage}
        stageRunning={stageRunning}
        onAdvance={onAdvance}
      />

      <LockAdvanceBar
        projectId={projectId}
        stage={9}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}

interface ConcernGuideProps {
  tab: { id: string; label: string; icon: any; color: string };
  guide: { whatItIs: string; whyItMatters: string; howToUse: string[]; checklistMeaning: string };
}

function ConcernGuide({ tab, guide }: ConcernGuideProps) {
  const storageKey = `crosscutting-guide-collapsed:${tab.id}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, storageKey]);

  const Icon = tab.icon;

  return (
    <div className="rounded-xl border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 p-3 hover:bg-accent/30 transition-colors text-left"
        aria-expanded={!collapsed}
        aria-controls={`concern-guide-body-${tab.id}`}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Icon className={cn("h-4 w-4", tab.color)} />
        <h4 className="text-sm font-display font-semibold flex-1">What is {tab.label}?</h4>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {collapsed ? "Show guide" : "Hide guide"}
        </span>
      </button>

      {!collapsed && (
        <motion.div
          id={`concern-guide-body-${tab.id}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="px-4 pb-4 space-y-3 border-t"
        >
          <p className="text-xs text-muted-foreground leading-relaxed pt-3">{guide.whatItIs}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-md border bg-background/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Why it matters
              </p>
              <p className="text-xs leading-relaxed">{guide.whyItMatters}</p>
            </div>
            <div className="rounded-md border bg-background/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                How to use this tab
              </p>
              <ol className="text-xs leading-relaxed space-y-1 list-decimal list-inside text-muted-foreground">
                {guide.howToUse.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/15 p-2.5">
            <Info className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              <strong className="text-foreground">What the checklist means: </strong>
              {guide.checklistMeaning}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
