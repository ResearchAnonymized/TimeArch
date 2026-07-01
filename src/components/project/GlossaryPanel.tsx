import { useMemo, useState } from "react";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Shield,
  Eye,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ── Glossary: plain-language definitions of every architecture term used in the workspace ── */
type GlossaryEntry = { term: string; definition: string; example?: string };

const GLOSSARY: { category: string; icon: typeof Shield; entries: GlossaryEntry[] }[] = [
  {
    category: "Workflow terms",
    icon: BookOpen,
    entries: [
      {
        term: "Cross-cutting concern",
        definition:
          "A design topic that affects every part of the system (not just one feature) — like security, logging, or caching. It must be designed once and applied consistently everywhere.",
      },
      {
        term: "Design checklist",
        definition:
          "The list of items shown before you run the AI. It tells you what topics the AI will try to cover, so you know what to expect in its output.",
      },
      {
        term: "Verification checklist",
        definition:
          "The same list after the AI has run. You tick items the AI clearly addressed; unticked items are gaps you must close before locking the stage.",
        example: "AI named 'OAuth2 + MFA' → tick 'Authentication strategy defined'.",
      },
      {
        term: "AI covered",
        definition:
          "A blue badge that means the AI's output mentioned this checklist topic. It does not guarantee the design is correct — you still review and tick it yourself.",
      },
      {
        term: "Lock & Advance",
        definition:
          "Marks this stage as final. Locked stages cannot be edited and feed downstream stages with frozen decisions.",
      },
    ],
  },
  {
    category: "Security",
    icon: Shield,
    entries: [
      {
        term: "Authentication (authn)",
        definition:
          "Proving who a user or service is — usually with a password, token, or certificate.",
      },
      {
        term: "Authorization (authz)",
        definition:
          "Deciding what an authenticated user is allowed to do (read this file, delete that record).",
      },
      {
        term: "RBAC / ABAC",
        definition:
          "Two ways to model permissions. RBAC = roles (admin, editor). ABAC = attributes (department=finance AND time<5pm).",
      },
      {
        term: "MFA",
        definition:
          "Multi-Factor Authentication — requires a second proof beyond a password (SMS code, authenticator app, hardware key).",
      },
      {
        term: "Encryption at rest / in transit",
        definition:
          "At rest = data on disk is encrypted. In transit = data on the network is encrypted (usually with TLS).",
      },
      {
        term: "Zero Trust",
        definition:
          "A model where no request is trusted just because it comes from inside the network. Every call must authenticate, even between internal services.",
      },
      {
        term: "Secret management",
        definition:
          "Storing API keys, passwords, and certificates in a dedicated vault (not in code or env files) so they can be rotated and audited.",
      },
      {
        term: "OWASP Top 10",
        definition:
          "A widely-used list of the ten most common web-application security risks, updated by the OWASP foundation.",
      },
    ],
  },
  {
    category: "Observability",
    icon: Eye,
    entries: [
      {
        term: "Observability",
        definition:
          "Being able to understand what your live system is doing from the outside — without adding new code — using logs, metrics, and traces.",
      },
      {
        term: "Logs",
        definition:
          "Time-stamped text records of events ('user X logged in', 'payment failed'). Best when structured as JSON so they can be searched.",
      },
      {
        term: "Metrics",
        definition:
          "Numbers measured over time (requests per second, error rate, CPU usage). Used for dashboards and alerts.",
      },
      {
        term: "Traces",
        definition:
          "A record of a single request as it travels through every service. Lets you find which step was slow or failed.",
      },
      {
        term: "OpenTelemetry (OTel)",
        definition:
          "An open standard for emitting logs, metrics, and traces. Lets you switch monitoring vendors without rewriting code.",
      },
      {
        term: "SLI / SLO / SLA",
        definition:
          "SLI = a measurement (e.g. % successful requests). SLO = your internal target (99.9%). SLA = the contract you sign with customers.",
      },
      {
        term: "RED method",
        definition:
          "Monitor every service with three metrics: Rate (requests/sec), Errors (failures/sec), Duration (latency).",
      },
      {
        term: "USE method",
        definition:
          "Monitor every resource (CPU, disk, network) with: Utilization, Saturation, Errors.",
      },
      {
        term: "Liveness vs readiness probe",
        definition:
          "Liveness = 'is the service alive?' (restart if not). Readiness = 'is it ready for traffic?' (route around if not).",
      },
      {
        term: "Runbook",
        definition:
          "A short document an on-call engineer follows when an alert fires — the steps to diagnose and fix the problem.",
      },
    ],
  },
  {
    category: "Resilience & error handling",
    icon: AlertTriangle,
    entries: [
      {
        term: "Resilience",
        definition:
          "The ability of the system to keep working — or fail safely — when something it depends on misbehaves.",
      },
      {
        term: "Circuit breaker",
        definition:
          "A safety switch around a call to another service. After too many failures it 'opens' and stops sending traffic for a while, so a slow dependency does not drag the whole system down.",
      },
      {
        term: "Retry with backoff",
        definition:
          "If a call fails, try again — but wait longer between each attempt (exponential backoff) and add a small random delay (jitter) so you don't hammer a recovering service.",
      },
      {
        term: "Idempotency",
        definition:
          "An operation is idempotent if running it twice has the same effect as running it once. Required for safe retries (e.g. 'create order #123' must not create two orders).",
      },
      {
        term: "Bulkhead",
        definition:
          "Like watertight compartments in a ship — isolate resources (thread pools, connections) per dependency so one failure cannot sink the whole system.",
      },
      {
        term: "Timeout",
        definition:
          "A maximum time to wait for a response. Without timeouts, a single slow call can hold a thread forever and starve the whole service.",
      },
      {
        term: "Fallback",
        definition:
          "A backup answer to return when a dependency fails — like a cached value, a default, or a degraded UI — instead of an error.",
      },
      {
        term: "Graceful degradation",
        definition:
          "When part of the system is down, the rest keeps working with reduced features (e.g. show cached prices when the pricing service is offline).",
      },
      {
        term: "Cascading failure",
        definition:
          "When one slow or broken service causes its callers to slow down, which causes their callers to slow down — until the whole system is unhealthy.",
      },
      {
        term: "Chaos engineering",
        definition:
          "Deliberately injecting failures (kill a server, add latency) in a controlled way, to verify your resilience patterns actually work.",
      },
      {
        term: "Saga",
        definition:
          "A way to keep data consistent across multiple services without a distributed transaction: each step has a 'compensating action' that undoes it if a later step fails.",
      },
      {
        term: "Eventual consistency",
        definition:
          "Different copies of the data may disagree for a short time, but will converge. Common in distributed systems where strict consistency is too expensive.",
      },
    ],
  },
  {
    category: "Caching & performance",
    icon: Zap,
    entries: [
      {
        term: "Cache",
        definition:
          "A fast, temporary store of frequently-used data, kept close to the consumer to avoid recomputing or refetching it.",
      },
      {
        term: "Cache-aside (lazy loading)",
        definition:
          "The application checks the cache first; on a miss it loads from the database and writes the result back to the cache. The default, safest pattern.",
      },
      {
        term: "Write-through / write-behind",
        definition:
          "Write-through: every write goes to cache AND database together. Write-behind: writes go to cache first and are flushed to the database later (faster, riskier).",
      },
      {
        term: "TTL (time-to-live)",
        definition:
          "How long a cached entry is considered fresh before being discarded or refreshed.",
      },
      {
        term: "Cache invalidation",
        definition:
          "Removing or refreshing cached data when the underlying source changes — so users don't see stale data. Famously hard.",
      },
      {
        term: "CDN / edge caching",
        definition:
          "A network of servers around the world that cache static or read-heavy content close to users, cutting latency dramatically.",
      },
      {
        term: "Materialized view",
        definition:
          "A pre-computed query result stored in the database. Useful when the same expensive query runs over and over.",
      },
      {
        term: "Read replica",
        definition:
          "A read-only copy of the database. Spreads read traffic across more machines so the primary is not overloaded.",
      },
      {
        term: "p50 / p95 / p99 latency",
        definition:
          "Latency at percentiles. p95 = 95% of requests are faster than this. p99 captures the slow tail users complain about.",
      },
      {
        term: "Performance budget",
        definition:
          "An explicit upper limit on latency (or page weight, or cost) that the team agrees not to exceed. Without it, performance silently degrades.",
      },
    ],
  },
];

interface GlossaryPanelProps {
  /** Compact = sidebar style (smaller padding, no side-by-side dl). Default: full. */
  variant?: "compact" | "full";
  defaultOpen?: boolean;
}

export default function GlossaryPanel({
  variant = "full",
  defaultOpen = false,
}: GlossaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.map((group) => ({
      ...group,
      entries: group.entries.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q) ||
          (e.example?.toLowerCase().includes(q) ?? false),
      ),
    })).filter((g) => g.entries.length > 0);
  }, [query]);

  const totalTerms = GLOSSARY.reduce((n, g) => n + g.entries.length, 0);
  const isCompact = variant === "compact";

  return (
    <div className="rounded-lg border bg-card/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={
          isCompact
            ? "flex items-center gap-2 w-full p-2.5 text-left hover:bg-accent/40 transition-colors"
            : "flex items-center gap-2 w-full p-4 text-left hover:bg-accent/40 transition-colors"
        }
      >
        <GraduationCap
          className={
            isCompact
              ? "h-3.5 w-3.5 text-primary flex-shrink-0"
              : "h-4 w-4 text-primary flex-shrink-0"
          }
        />
        <div className="flex-1 min-w-0">
          <p
            className={
              isCompact
                ? "text-xs font-display font-semibold"
                : "text-sm font-display font-semibold"
            }
          >
            {isCompact ? "Glossary" : "Glossary — plain-language definitions"}
          </p>
          {!isCompact && (
            <p className="text-[11px] text-muted-foreground">
              What every architecture term in the workspace means, in one short sentence.
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 h-4">
          {totalTerms}
        </Badge>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className={isCompact ? "border-t p-2.5 space-y-3" : "border-t p-4 space-y-4"}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isCompact ? "Search…" : "Search terms (e.g. circuit breaker, SLO, idempotency)…"
            }
            className={
              isCompact
                ? "w-full text-[11px] px-2 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                : "w-full text-xs px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            }
          />

          {filtered.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              No terms match "{query}".
            </p>
          )}

          <div className={isCompact ? "space-y-3 max-h-[60vh] overflow-y-auto pr-1" : "space-y-5"}>
            {filtered.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.category}>
                  <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-border/60">
                    <Icon className="h-3 w-3 text-primary" />
                    <h5 className="text-[10px] font-display font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.category}
                    </h5>
                    <span className="text-[9px] font-mono text-muted-foreground/70 ml-auto">
                      {group.entries.length}
                    </span>
                  </div>
                  {isCompact ? (
                    <dl className="space-y-2">
                      {group.entries.map((e) => (
                        <div key={e.term}>
                          <dt className="text-[11px] font-semibold text-foreground">{e.term}</dt>
                          <dd className="text-[10px] text-muted-foreground leading-snug">
                            {e.definition}
                            {e.example && (
                              <span className="block mt-0.5 text-[10px] text-primary/80 italic">
                                e.g. {e.example}
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <dl className="space-y-2.5">
                      {group.entries.map((e) => (
                        <div
                          key={e.term}
                          className="grid md:grid-cols-[180px_1fr] gap-x-4 gap-y-0.5"
                        >
                          <dt className="text-xs font-semibold text-foreground">{e.term}</dt>
                          <dd className="text-xs text-muted-foreground leading-relaxed">
                            {e.definition}
                            {e.example && (
                              <span className="block mt-0.5 text-[11px] text-primary/80 italic">
                                Example: {e.example}
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
