import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  GitBranch,
  Layers,
  Server,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Container,
  BarChart3,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Gauge,
  Globe,
  Database,
  Workflow,
  ArrowUpDown,
  DollarSign,
  Wallet,
  Activity,
  ListChecks,
  Network,
  Lock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { cn } from "@/lib/utils";
import RunStageCTA from "./RunStageCTA";
import CollapsibleChallengerSection from "./CollapsibleChallengerSection";
import ChallengerExecutionStatusPanel from "./ChallengerExecutionStatusPanel";
import LockAdvanceBar from "./LockAdvanceBar";

interface Props {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
  onAdvance?: (nextStage: number) => void;
}

const REFERENCE_STANDARDS = {
  topology: [
    {
      id: "ISO-42010",
      label: "ISO/IEC/IEEE 42010 — Architecture Description",
      desc: "Deployment viewpoint conventions",
      url: "",
    },
    {
      id: "AWS-WA-REL",
      label: "AWS Well-Architected — Reliability (reference)",
      desc: "Multi-AZ, multi-region patterns",
      url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/",
    },
    {
      id: "CNCF",
      label: "CNCF Cloud Native Landscape",
      desc: "Container orchestration, service mesh, networking patterns",
      url: "https://landscape.cncf.io/",
    },
    {
      id: "ISO-25010-PORT",
      label: "ISO 25010 — Portability",
      desc: "Cloud-neutral adaptability",
      url: "",
    },
  ],
  environment: [
    {
      id: "12FACTOR",
      label: "12-Factor App Methodology",
      desc: "Config, dev/prod parity, disposability",
      url: "https://12factor.net/",
    },
    {
      id: "GITOPS",
      label: "GitOps Principles (OpenGitOps)",
      desc: "Declarative, versioned, automated, continuously reconciled",
      url: "https://opengitops.dev/",
    },
    {
      id: "IAC",
      label: "Infrastructure as Code",
      desc: "Terraform, Pulumi, CloudFormation, Bicep",
      url: "",
    },
  ],
  cicd: [
    {
      id: "DORA",
      label: "DORA Metrics (Accelerate)",
      desc: "Deployment Frequency, Lead Time, MTTR, Change Failure Rate",
      url: "https://dora.dev/guides/dora-metrics-four-keys/",
    },
    {
      id: "CD-BOOK",
      label: "Continuous Delivery (Humble & Farley)",
      desc: "Pipelines, deployment strategies, feature flags",
      url: "",
    },
    {
      id: "12FACTOR-V",
      label: "12-Factor §V — Build/Release/Run",
      desc: "Strict separation between build and run",
      url: "https://12factor.net/build-release-run",
    },
  ],
  scaling: [
    {
      id: "GOOGLE-SRE",
      label: "Google SRE — Managing Load",
      desc: "Load balancing, overload, graceful degradation",
      url: "https://sre.google/sre-book/handling-overload/",
    },
    {
      id: "CAP",
      label: "CAP Theorem (Brewer)",
      desc: "Consistency, Availability, Partition Tolerance",
      url: "",
    },
    {
      id: "PACELC",
      label: "PACELC Theorem (Abadi)",
      desc: "Latency vs Consistency in normal operation",
      url: "",
    },
  ],
  cost: [
    {
      id: "FINOPS",
      label: "FinOps Foundation Framework",
      desc: "Inform → Optimize → Operate",
      url: "https://www.finops.org/framework/",
    },
    {
      id: "SRE-SLO",
      label: "Google SRE — SLOs & Error Budgets",
      desc: "Operational readiness via measurable objectives",
      url: "https://sre.google/workbook/implementing-slos/",
    },
  ],
};

const INFRA_TABS = [
  { id: "topology", label: "Runtime Topology", icon: Cloud, color: "text-blue-500" },
  { id: "environment", label: "Environments", icon: Layers, color: "text-purple-500" },
  { id: "cicd", label: "CI/CD & Release", icon: GitBranch, color: "text-green-500" },
  { id: "scaling", label: "Scale & Resilience", icon: BarChart3, color: "text-orange-500" },
  { id: "cost", label: "Cost & Ops Readiness", icon: Wallet, color: "text-amber-500" },
] as const;

/* ── Reference card ── */
function ReferenceCard({
  refs,
}: {
  refs: { id: string; label: string; desc: string; url: string }[];
}) {
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

/* ── Metric card ── */
function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
          {label}
        </p>
        <p className="text-xs font-semibold text-foreground truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Inputs Snapshot strip ── */
function InputsSnapshot({ data }: { data: any }) {
  if (!data) return null;
  const chips: { label: string; value: string | string[]; icon: any }[] = [];
  if (data.architecture_style)
    chips.push({ label: "Style", value: data.architecture_style, icon: Sparkles });
  if (data.data_classification)
    chips.push({ label: "Data Class", value: data.data_classification, icon: Database });
  if (Array.isArray(data.critical_nfrs) && data.critical_nfrs.length)
    chips.push({ label: "Critical NFRs", value: data.critical_nfrs, icon: Gauge });
  if (Array.isArray(data.cross_cutting_decisions) && data.cross_cutting_decisions.length)
    chips.push({ label: "Cross-cutting", value: data.cross_cutting_decisions, icon: ShieldCheck });
  if (chips.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed bg-secondary/30 p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        <ListChecks className="h-3 w-3" /> Inputs Snapshot — upstream decisions shaping this design
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-md border bg-card/70 p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-primary" />
                <p className="text-[9px] font-mono uppercase text-muted-foreground tracking-wider">
                  {c.label}
                </p>
              </div>
              {Array.isArray(c.value) ? (
                <div className="flex flex-wrap gap-1">
                  {c.value.slice(0, 4).map((v, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                      {v}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-medium text-foreground line-clamp-2">{c.value}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Topology view (cloud-neutral) ── */
function TopologyView({ data }: { data: any }) {
  if (!data) return null;
  const cm = data.compute_model;
  const rs = data.region_strategy;
  const nz = data.network_zones;
  const sc = data.service_communication;
  const lb = data.load_balancing;
  const id = data.identity_and_secrets;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {cm && (
          <MetricCard
            icon={Container}
            label="Compute Model"
            value={cm.pattern}
            sub={cm.rationale}
          />
        )}
        {rs && (
          <MetricCard
            icon={Globe}
            label="Region Topology"
            value={`${rs.topology}${rs.availability_zones ? ` — ${rs.availability_zones} AZ${rs.availability_zones > 1 ? "s" : ""}` : ""}`}
            sub={rs.rationale || (rs.multi_region ? "Multi-region enabled" : "Single region")}
          />
        )}
        {sc && (
          <MetricCard
            icon={Server}
            label="Service Communication"
            value={sc.mesh_needed ? `Mesh: ${sc.pattern || "Yes"}` : "No mesh"}
            sub={sc.rationale}
          />
        )}
        {lb && (
          <MetricCard
            icon={ArrowUpDown}
            label="Load Balancing"
            value={lb.layer}
            sub={lb.strategy}
          />
        )}
        {id?.workload_identity && (
          <MetricCard
            icon={Lock}
            label="Workload Identity"
            value={id.workload_identity}
            sub={id.secrets_management ? `Secrets: ${id.secrets_management}` : undefined}
          />
        )}
      </div>

      {nz && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Network className="h-3 w-3" /> Network Zones
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {nz.public && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                <p className="text-[9px] font-mono uppercase text-emerald-600 dark:text-emerald-400">
                  Public
                </p>
                <p className="text-[11px] text-foreground">{nz.public}</p>
              </div>
            )}
            {nz.private && (
              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2">
                <p className="text-[9px] font-mono uppercase text-blue-600 dark:text-blue-400">
                  Private
                </p>
                <p className="text-[11px] text-foreground">{nz.private}</p>
              </div>
            )}
            {nz.data && (
              <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2">
                <p className="text-[9px] font-mono uppercase text-purple-600 dark:text-purple-400">
                  Data
                </p>
                <p className="text-[11px] text-foreground">{nz.data}</p>
              </div>
            )}
          </div>
          {(nz.ingress_controls || nz.egress_controls) && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {nz.ingress_controls && (
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono uppercase">Ingress:</span> {nz.ingress_controls}
                </div>
              )}
              {nz.egress_controls && (
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono uppercase">Egress:</span> {nz.egress_controls}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Environment view ── */
function EnvironmentView({ data }: { data: any }) {
  if (!data) return null;
  const tiers = data.tiers || [];
  const parity = data.dev_prod_parity;
  const config = data.config_management;
  const db = data.database_migrations;
  const ff = data.feature_flags;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {parity && (
          <MetricCard
            icon={Layers}
            label="IaC Tool"
            value={parity.iac_tool}
            sub={parity.approach}
          />
        )}
        {config && (
          <MetricCard
            icon={Server}
            label="Config Mgmt"
            value={config.strategy}
            sub={config.secrets_tool ? `Secrets: ${config.secrets_tool}` : undefined}
          />
        )}
        {db && (
          <MetricCard
            icon={Database}
            label="DB Migrations"
            value={db.tool}
            sub={db.backward_compatible ? "Backward compatible" : "Breaking changes possible"}
          />
        )}
        {ff?.framework && (
          <MetricCard
            icon={GitBranch}
            label="Feature Flags"
            value={ff.framework}
            sub={ff.use_cases?.join(", ")}
          />
        )}
      </div>

      {tiers.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Environment Tiers ({tiers.length})
          </p>
          <div className="space-y-1.5">
            {tiers.map((t: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-md bg-secondary/30 border"
              >
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{t.purpose}</p>
                </div>
                {t.data_source && (
                  <Badge variant="outline" className="text-[9px] flex-shrink-0">
                    {t.data_source}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CI/CD view ── */
function CICDView({ data }: { data: any }) {
  if (!data) return null;
  const stages = data.stages || [];
  const ds = data.deployment_strategy;
  const sec = data.security_scanning;
  const dora = data.dora_metrics_targets;
  const av = data.artifact_versioning;
  const dm = data.delivery_model;
  const gates = data.quality_gates || [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard icon={Workflow} label="CI/CD Tool" value={data.tool || "—"} />
        {ds && (
          <MetricCard
            icon={GitBranch}
            label="Deploy Strategy"
            value={ds.method}
            sub={ds.rollback_plan}
          />
        )}
        {dm?.type && (
          <MetricCard icon={Activity} label="Delivery Model" value={dm.type} sub={dm.rationale} />
        )}
        {av && (
          <MetricCard
            icon={Container}
            label="Versioning"
            value={av.strategy}
            sub={av.immutable ? "Immutable artifacts" : ""}
          />
        )}
      </div>

      {stages.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Pipeline Stages ({stages.length})
          </p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {stages.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-center min-w-[80px]",
                    s.automated !== false
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-warning/5 border-warning/20",
                  )}
                >
                  <p className="text-[10px] font-semibold text-foreground">{s.name}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">
                    {s.description}
                  </p>
                </div>
                {i < stages.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {gates.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Quality Gates
          </p>
          <div className="flex flex-wrap gap-1.5">
            {gates.map((g: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {g}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {sec && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Security Scanning
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sec.sast && (
              <div className="text-center p-2 rounded border bg-secondary/30">
                <p className="text-[9px] font-mono text-muted-foreground">SAST</p>
                <p className="text-[11px] font-medium">{sec.sast}</p>
              </div>
            )}
            {sec.dast && (
              <div className="text-center p-2 rounded border bg-secondary/30">
                <p className="text-[9px] font-mono text-muted-foreground">DAST</p>
                <p className="text-[11px] font-medium">{sec.dast}</p>
              </div>
            )}
            {sec.sca && (
              <div className="text-center p-2 rounded border bg-secondary/30">
                <p className="text-[9px] font-mono text-muted-foreground">SCA</p>
                <p className="text-[11px] font-medium">{sec.sca}</p>
              </div>
            )}
            {sec.container_scan && (
              <div className="text-center p-2 rounded border bg-secondary/30">
                <p className="text-[9px] font-mono text-muted-foreground">Container</p>
                <p className="text-[11px] font-medium">{sec.container_scan}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {dora && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <Gauge className="h-3 w-3" />
            DORA Metrics Targets
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {dora.deployment_frequency && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Deploy Freq</p>
                <p className="text-xs font-semibold">{dora.deployment_frequency}</p>
              </div>
            )}
            {dora.lead_time && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Lead Time</p>
                <p className="text-xs font-semibold">{dora.lead_time}</p>
              </div>
            )}
            {dora.mttr && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">MTTR</p>
                <p className="text-xs font-semibold">{dora.mttr}</p>
              </div>
            )}
            {dora.change_failure_rate && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Change Fail</p>
                <p className="text-xs font-semibold">{dora.change_failure_rate}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Scale & Resilience view ── */
function ScalingView({ data }: { data: any }) {
  if (!data) return null;
  const h = data.horizontal;
  const v = data.vertical;
  const dbs = data.database_scaling;
  const ec = data.edge_and_cdn;
  const dr = data.disaster_recovery;
  const lt = data.load_testing;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {h && (
          <MetricCard
            icon={BarChart3}
            label="Horizontal Scaling"
            value={h.approach}
            sub={`Auto: ${h.auto_scaling}${h.min_replicas ? ` | ${h.min_replicas}-${h.max_replicas} replicas` : ""}`}
          />
        )}
        {v && (
          <MetricCard
            icon={ArrowUpDown}
            label="Vertical Scaling"
            value={v.approach}
            sub={v.limits}
          />
        )}
        {dbs && (
          <MetricCard
            icon={Database}
            label="DB Scaling"
            value={dbs.read_replicas ? "Read replicas enabled" : "Single writer"}
            sub={[dbs.sharding_strategy, dbs.connection_pooling].filter(Boolean).join(" | ")}
          />
        )}
        {ec?.cdn && (
          <MetricCard
            icon={Globe}
            label="CDN / Edge"
            value={ec.cdn}
            sub={[ec.edge_compute, ec.geographic_routing].filter(Boolean).join(" | ")}
          />
        )}
      </div>

      {h?.triggers?.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Autoscaling Triggers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {h.triggers.map((t: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {dr && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase text-muted-foreground">RTO</p>
            <p className="text-sm font-bold text-primary">{dr.rto}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase text-muted-foreground">RPO</p>
            <p className="text-sm font-bold text-primary">{dr.rpo}</p>
          </div>
          {dr.backup_strategy && (
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-[9px] font-mono uppercase text-muted-foreground">Backup</p>
              <p className="text-xs font-medium text-foreground">{dr.backup_strategy}</p>
            </div>
          )}
          {dr.failover && (
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-[9px] font-mono uppercase text-muted-foreground">Failover</p>
              <p className="text-xs font-medium text-foreground">{dr.failover}</p>
            </div>
          )}
        </div>
      )}

      {lt && (lt.expected_rps || lt.peak_rps) && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Gauge className="h-3 w-3" />
            Load Testing Targets
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {lt.expected_rps && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Expected RPS</p>
                <p className="text-lg font-bold text-foreground">
                  {lt.expected_rps.toLocaleString()}
                </p>
              </div>
            )}
            {lt.peak_rps && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Peak RPS</p>
                <p className="text-lg font-bold text-primary">{lt.peak_rps.toLocaleString()}</p>
              </div>
            )}
            {lt.tool && (
              <div>
                <p className="text-[9px] font-mono text-muted-foreground">Tool</p>
                <p className="text-xs font-semibold text-foreground">{lt.tool}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Cost & Operational Readiness view ── */
function CostReadinessView({ data }: { data: any }) {
  if (!data)
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        Run the agent to generate cost & readiness analysis.
      </div>
    );
  const checklist = data.readiness_checklist || [];
  const ready = checklist.filter((c: any) => c.status === "ready").length;
  const partial = checklist.filter((c: any) => c.status === "partial").length;
  const gap = checklist.filter((c: any) => c.status === "gap").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {data.estimated_monthly_cost_band && (
          <MetricCard
            icon={DollarSign}
            label="Monthly Cost Band"
            value={data.estimated_monthly_cost_band}
          />
        )}
        {data.on_call_model && (
          <MetricCard icon={Activity} label="On-Call Model" value={data.on_call_model} />
        )}
        {data.runbook_coverage && (
          <MetricCard icon={ListChecks} label="Runbook Coverage" value={data.runbook_coverage} />
        )}
      </div>

      {data.slo_alignment && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1 flex items-center gap-1.5">
            <Gauge className="h-3 w-3" />
            SLO Alignment
          </p>
          <p className="text-xs text-foreground">{data.slo_alignment}</p>
        </div>
      )}

      {Array.isArray(data.cost_drivers) && data.cost_drivers.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Cost Drivers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.cost_drivers.map((d: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {d}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(data.finops_levers) && data.finops_levers.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Wallet className="h-3 w-3" />
            FinOps Levers
          </p>
          <ul className="space-y-1">
            {data.finops_levers.map((l: string, i: number) => (
              <li key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {checklist.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="h-3 w-3" />
              Go-Live Readiness Checklist
            </p>
            <div className="flex gap-1.5 text-[10px]">
              <Badge
                variant="outline"
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              >
                {ready} ready
              </Badge>
              {partial > 0 && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                >
                  {partial} partial
                </Badge>
              )}
              {gap > 0 && (
                <Badge
                  variant="outline"
                  className="bg-destructive/10 border-destructive/30 text-destructive"
                >
                  {gap} gap
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {checklist.map((c: any, i: number) => {
              const isReady = c.status === "ready";
              const isGap = c.status === "gap";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-md border",
                    isReady
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : isGap
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-amber-500/5 border-amber-500/20",
                  )}
                >
                  {isReady ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  ) : isGap ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{c.item}</p>
                    {c.note && <p className="text-[10px] text-muted-foreground mt-0.5">{c.note}</p>}
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase flex-shrink-0">
                    {c.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const TAB_VIEWS: Record<string, (content: any) => React.ReactNode> = {
  topology: (c) => <TopologyView data={c.deployment_topology} />,
  environment: (c) => <EnvironmentView data={c.environment_strategy} />,
  cicd: (c) => <CICDView data={c.cicd_pipeline} />,
  scaling: (c) => <ScalingView data={c.scaling_resilience || c.scaling_strategy} />,
  cost: (c) => <CostReadinessView data={c.cost_and_readiness} />,
};

const TAB_CONTENT_KEY: Record<string, string[]> = {
  topology: ["deployment_topology"],
  environment: ["environment_strategy"],
  cicd: ["cicd_pipeline"],
  scaling: ["scaling_resilience", "scaling_strategy"],
  cost: ["cost_and_readiness"],
};

export default function InfrastructureWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>("topology");
  const [artifacts, setArtifacts] = useState<any[]>([]);

  useEffect(() => {
    const fetchArtifacts = async () => {
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("*")
        .eq("project_id", projectId)
        .eq("stage", 10)
        .order("created_at", { ascending: false });
      if (data) setArtifacts(data);
    };
    fetchArtifacts();
  }, [projectId, refreshKey]);

  const artifactContent = useMemo(() => {
    const primary =
      artifacts.find((a) => {
        let c = a.content;
        if (c?.parse_error) c = recoverArtifactContent(c) || c;
        return (
          c?.deployment_topology ||
          c?.cicd_pipeline ||
          c?.environment_strategy ||
          c?.scaling_resilience ||
          c?.scaling_strategy ||
          c?.cost_and_readiness
        );
      }) ||
      artifacts.find((a) => !a.generated_by?.includes("Evaluator")) ||
      artifacts[0];
    if (!primary) return null;
    let content = primary.content;
    if (content?.parse_error) content = recoverArtifactContent(content) || content;
    return content;
  }, [artifacts]);

  const hasArtifacts = !!artifactContent;
  const diagrams = useMemo(
    () => (hasArtifacts ? extractMermaidDiagrams(artifactContent) : []),
    [artifactContent, hasArtifacts],
  );

  const sectionCount = hasArtifacts
    ? INFRA_TABS.filter((t) => {
        const keys = TAB_CONTENT_KEY[t.id];
        return keys.some((k) => !!artifactContent[k]);
      }).length
    : 0;

  const refs = REFERENCE_STANDARDS[activeTab as keyof typeof REFERENCE_STANDARDS] || [];

  return (
    <div className="space-y-6">
      {STAGE_INTROS[10] && <StageIntro {...STAGE_INTROS[10]} title="Infrastructure & Deployment" />}

      {/* Status banner */}
      {hasArtifacts && (
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Infrastructure Design — Cloud-Neutral
            </p>
            <p className="text-sm font-semibold text-foreground">
              {artifactContent.summary ||
                `${sectionCount} of ${INFRA_TABS.length} sections generated`}
            </p>
          </div>
          <div className="flex gap-3 text-center flex-shrink-0">
            <div>
              <p className="text-xl font-bold tabular-nums text-primary">{sectionCount}</p>
              <p className="text-[9px] text-muted-foreground">Sections</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{diagrams.length}</p>
              <p className="text-[9px] text-muted-foreground">Diagrams</p>
            </div>
          </div>
        </div>
      )}

      {!hasArtifacts && (
        <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
          <Cloud className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No infrastructure design yet</p>
          <p className="text-[11px] text-muted-foreground/80 max-w-md mx-auto">
            The agent will produce a cloud-neutral deployment topology, environment strategy, CI/CD
            pipeline, scalability/resilience posture, and cost & ops readiness — grounded in the
            upstream architecture.
          </p>
          <RunStageCTA
            stageLabel="Infrastructure"
            onRun={onRunStage ? () => onRunStage() : undefined}
            running={stageRunning}
          />
        </div>
      )}

      {/* Inputs Snapshot */}
      {hasArtifacts && <InputsSnapshot data={artifactContent.inputs_snapshot} />}

      {/* Diagrams */}
      {diagrams.length > 0 && (
        <div className="space-y-3">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5 h-auto p-1">
          {INFRA_TABS.map((tab) => {
            const Icon = tab.icon;
            const keys = TAB_CONTENT_KEY[tab.id];
            const hasContent = hasArtifacts && keys.some((k) => !!artifactContent[k]);
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-1.5 text-[11px] py-2 px-2"
              >
                <Icon className={cn("h-3.5 w-3.5", tab.color)} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.label.split(" ")[0]}</span>
                {hasContent && (
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {INFRA_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-4 mt-4">
            {hasArtifacts && TAB_VIEWS[tab.id] && (
              <div className="space-y-3">{TAB_VIEWS[tab.id](artifactContent)}</div>
            )}
            <ReferenceCard refs={refs} />
          </TabsContent>
        ))}
      </Tabs>

      {/* Real-time execution status */}
      <ChallengerExecutionStatusPanel projectId={projectId} stage={10} refreshKey={refreshKey} />

      {/* Challenger Architect */}
      <CollapsibleChallengerSection
        projectId={projectId}
        stage={10}
        refreshKey={refreshKey}
        onRunStage={onRunStage}
        stageRunning={stageRunning}
        onAdvance={onAdvance}
      />

      <LockAdvanceBar
        projectId={projectId}
        stage={10}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}
