/**
 * Stage 10 — Infrastructure & Deployment (Studio native).
 *
 * StageShell surface with the minimum inputs needed to unlock the
 * validation & assurance phase:
 *   - Deployment topology (compute, region, load balancing)
 *   - Environment strategy (tiers, IaC tool, config management)
 *   - CI/CD pipeline (tool, stages, deployment method, rollback)
 *   - Scaling & resilience (autoscaling, DR RTO/RPO)
 *   - Governance review — an explicit checklist users must tick before
 *     the stage can be advanced. Mirrors the gates that would otherwise
 *     block final approval later in the lifecycle.
 *
 * Persists into `architecture_artifacts` as an `executive_summary` artifact
 * (matches the run-agent registry for stage 10).
 *
 * Readiness gates to advance to Stage 11 (ATAM evaluation):
 *   - Stage 9 (cross-cutting concerns) artifact exists.
 *   - Compute model, region topology, load balancing layer captured.
 *   - ≥2 environment tiers + IaC tool + config management.
 *   - CI/CD tool + ≥3 pipeline stages + deployment method + rollback.
 *   - DR RTO and RPO captured; horizontal autoscaling captured.
 *   - Every governance review item ticked.
 *   - Latest edits saved as a new artifact version.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  Cloud,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  Save,
  ClipboardCheck,
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

// ── Types ────────────────────────────────────────────────────────────────

const COMPUTE = [
  "Container orchestration (K8s)",
  "Managed serverless (Lambda / Cloud Run)",
  "PaaS (Fly.io / Render / Heroku)",
  "VM-based",
  "Hybrid",
] as const;
const REGIONS = ["single-region multi-AZ", "multi-region active-active", "multi-region active-passive", "edge"] as const;
const LB_LAYERS = ["L4", "L7", "Global anycast", "Client-side"] as const;
const CICD_TOOLS = ["GitHub Actions", "GitLab CI", "CircleCI", "Buildkite", "Jenkins", "Argo CD"] as const;
const DEPLOY_METHODS = ["blue-green", "canary", "rolling", "recreate"] as const;
const IAC_TOOLS = ["Terraform", "Pulumi", "CDK", "CloudFormation", "OpenTofu"] as const;

interface Topology {
  compute_pattern: string;
  compute_rationale: string;
  region_topology: string;
  availability_zones: number;
  lb_layer: string;
  service_mesh: boolean;
}
interface EnvTier { name: string; purpose: string }
interface EnvStrategy {
  tiers: EnvTier[];
  iac_tool: string;
  iac_approach: string;
  config_management: string;
  db_migration_tool: string;
}
interface CicdStage { name: string; description: string; automated: boolean }
interface Cicd {
  tool: string;
  stages: CicdStage[];
  deployment_method: string;
  rollback_plan: string;
  quality_gates: string[];
}
interface Scaling {
  autoscaling: string;
  min_replicas: number;
  max_replicas: number;
  rto: string;
  rpo: string;
  backup_strategy: string;
}
interface GovItem { id: string; label: string; note?: string }

const GOV_CHECKS: GovItem[] = [
  { id: "sec_signed_off", label: "Security review approved (Stage 9 auth, encryption & audit logging)." },
  { id: "obs_signed_off", label: "Observability plan approved (logs, tracing, metrics, alerting)." },
  { id: "err_signed_off", label: "Standardized error handling approved (circuit breaker, retries, fallbacks)." },
  { id: "cost_reviewed", label: "Cost band and finops levers reviewed with a budget owner." },
  { id: "dr_reviewed", label: "Disaster recovery RTO/RPO reviewed and accepted." },
  { id: "runbook_ready", label: "Runbooks and on-call rotation identified for launch." },
  { id: "iac_reviewed", label: "Infrastructure-as-Code repository and access model agreed." },
  { id: "quality_gates_agreed", label: "CI/CD quality gates (tests, SAST, SBOM, DAST) agreed with delivery team." },
];

interface Props {
  projectId: string;
  advancing: boolean;
  onAdvance: () => void;
}

const EMPTY_TOPO: Topology = {
  compute_pattern: "",
  compute_rationale: "",
  region_topology: "",
  availability_zones: 3,
  lb_layer: "",
  service_mesh: false,
};
const EMPTY_ENV: EnvStrategy = {
  tiers: [
    { name: "dev", purpose: "Developer sandbox" },
    { name: "staging", purpose: "Pre-production integration & UAT" },
    { name: "prod", purpose: "Customer-facing production" },
  ],
  iac_tool: "",
  iac_approach: "",
  config_management: "",
  db_migration_tool: "",
};
const EMPTY_CICD: Cicd = {
  tool: "",
  stages: [],
  deployment_method: "",
  rollback_plan: "",
  quality_gates: [],
};
const EMPTY_SCALING: Scaling = {
  autoscaling: "",
  min_replicas: 2,
  max_replicas: 10,
  rto: "",
  rpo: "",
  backup_strategy: "",
};

// ── Component ────────────────────────────────────────────────────────────

export default function Stage10Infra({ projectId, advancing, onAdvance }: Props) {
  const stage = getStage(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topo, setTopo] = useState<Topology>(EMPTY_TOPO);
  const [env, setEnv] = useState<EnvStrategy>(EMPTY_ENV);
  const [cicd, setCicd] = useState<Cicd>(EMPTY_CICD);
  const [scaling, setScaling] = useState<Scaling>(EMPTY_SCALING);
  const [gov, setGov] = useState<Record<string, boolean>>({});
  const [govNotes, setGovNotes] = useState<string>("");
  const [artifactVersion, setArtifactVersion] = useState<number>(0);
  const [ccVersion, setCcVersion] = useState<number>(0);
  const [savedHash, setSavedHash] = useState<string>(
    hashOf(EMPTY_TOPO, EMPTY_ENV, EMPTY_CICD, EMPTY_SCALING, {}, ""),
  );

  // Drafts
  const [tierName, setTierName] = useState("");
  const [tierPurpose, setTierPurpose] = useState("");
  const [stageName, setStageName] = useState("");
  const [stageDesc, setStageDesc] = useState("");
  const [stageAuto, setStageAuto] = useState(true);
  const [qgDraft, setQgDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [artifact, cc] = await Promise.all([
      supabase
        .from("architecture_artifacts")
        .select("id, version, content")
        .eq("project_id", projectId)
        .eq("stage", 10)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("architecture_artifacts")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("stage", 9)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setCcVersion(cc.data?.version ?? 0);

    if (artifact.data) {
      setArtifactVersion(artifact.data.version ?? 0);
      const content = artifact.data.content as any;
      const t = normalizeTopology(content?.deployment_topology);
      const e = normalizeEnv(content?.environment_strategy);
      const c = normalizeCicd(content?.cicd_pipeline);
      const s = normalizeScaling(content?.scaling_resilience);
      const g = normalizeGov(content?.governance_review);
      const gn = typeof content?.governance_review?.notes === "string" ? content.governance_review.notes : "";
      setTopo(t);
      setEnv(e);
      setCicd(c);
      setScaling(s);
      setGov(g);
      setGovNotes(gn);
      setSavedHash(hashOf(t, e, c, s, g, gn));
    } else {
      setTopo(EMPTY_TOPO);
      setEnv(EMPTY_ENV);
      setCicd(EMPTY_CICD);
      setScaling(EMPTY_SCALING);
      setGov({});
      setGovNotes("");
      setSavedHash(hashOf(EMPTY_TOPO, EMPTY_ENV, EMPTY_CICD, EMPTY_SCALING, {}, ""));
      setArtifactVersion(0);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { runStage, running, polling } = useRunStage(projectId, 10, load);

  // ── Derived ────────────────────────────────────────────────────────────
  const dirty = hashOf(topo, env, cicd, scaling, gov, govNotes) !== savedHash;
  const hasCc = ccVersion > 0;

  const topoOk = !!topo.compute_pattern && !!topo.region_topology && !!topo.lb_layer;
  const envOk = env.tiers.length >= 2 && !!env.iac_tool && !!env.config_management;
  const cicdOk = !!cicd.tool && cicd.stages.length >= 3 && !!cicd.deployment_method && !!cicd.rollback_plan;
  const scaleOk = !!scaling.autoscaling && !!scaling.rto && !!scaling.rpo;
  const govOk = GOV_CHECKS.every((c) => gov[c.id]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!hasCc) issues.push("Stage 9 (cross-cutting concerns) must be locked first.");
    if (!topo.compute_pattern) issues.push("Topology: choose a compute pattern.");
    if (!topo.region_topology) issues.push("Topology: choose a region topology.");
    if (!topo.lb_layer) issues.push("Topology: choose a load balancing layer.");
    if (env.tiers.length < 2) issues.push("Environments: define at least two tiers (e.g. staging + prod).");
    if (!env.iac_tool) issues.push("Environments: pick an IaC tool.");
    if (!env.config_management) issues.push("Environments: describe config management.");
    if (!cicd.tool) issues.push("CI/CD: pick a tool.");
    if (cicd.stages.length < 3) issues.push("CI/CD: define at least three pipeline stages.");
    if (!cicd.deployment_method) issues.push("CI/CD: choose a deployment method.");
    if (!cicd.rollback_plan) issues.push("CI/CD: document the rollback plan.");
    if (!scaling.autoscaling) issues.push("Scaling: describe the horizontal autoscaling strategy.");
    if (!scaling.rto || !scaling.rpo) issues.push("DR: RTO and RPO are required.");
    const missingGov = GOV_CHECKS.filter((c) => !gov[c.id]);
    if (missingGov.length > 0) {
      issues.push(`Governance review: ${missingGov.length} item${missingGov.length === 1 ? "" : "s"} still unchecked.`);
    }
    return issues;
  }, [topo, env, cicd, scaling, gov, hasCc]);

  const ready = hasCc && topoOk && envOk && cicdOk && scaleOk && govOk && !dirty && validation.length === 0;

  // ── Mutations ─────────────────────────────────────────────────────────
  function addTier() {
    const name = tierName.trim();
    const purpose = tierPurpose.trim();
    if (!name || !purpose) return toast.error("Tier needs a name and purpose.");
    if (env.tiers.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return toast.error("Tier already exists.");
    }
    setEnv((p) => ({ ...p, tiers: [...p.tiers, { name, purpose }] }));
    setTierName("");
    setTierPurpose("");
  }
  function removeTier(i: number) {
    setEnv((p) => ({ ...p, tiers: p.tiers.filter((_, idx) => idx !== i) }));
  }
  function addStage() {
    const name = stageName.trim();
    if (!name) return toast.error("Stage needs a name.");
    setCicd((p) => ({ ...p, stages: [...p.stages, { name, description: stageDesc.trim(), automated: stageAuto }] }));
    setStageName("");
    setStageDesc("");
    setStageAuto(true);
  }
  function removeStage(i: number) {
    setCicd((p) => ({ ...p, stages: p.stages.filter((_, idx) => idx !== i) }));
  }
  function addQg() {
    const v = qgDraft.trim();
    if (!v) return;
    setCicd((p) => ({ ...p, quality_gates: [...p.quality_gates, v] }));
    setQgDraft("");
  }
  function removeQg(i: number) {
    setCicd((p) => ({ ...p, quality_gates: p.quality_gates.filter((_, idx) => idx !== i) }));
  }
  function toggleGov(id: string, v: boolean) {
    setGov((prev) => ({ ...prev, [id]: v }));
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
      stage: 10,
      type: "executive_summary",
      title: `Infrastructure & Deployment (v${nextVersion})`,
      version: nextVersion,
      status: "draft",
      created_by: uid,
      generated_by: "studio_manual",
      content: {
        title: `Infrastructure & Deployment (v${nextVersion})`,
        summary: `${topo.compute_pattern || "compute TBD"} · ${topo.region_topology || "region TBD"} · ${cicd.tool || "CI/CD TBD"}`,
        key_findings: [
          `Compute: ${topo.compute_pattern || "—"} on ${topo.region_topology || "—"} (${topo.availability_zones} AZ).`,
          `Environments: ${env.tiers.map((t) => t.name).join(" → ") || "—"} with ${env.iac_tool || "—"}.`,
          `Delivery: ${cicd.tool || "—"} · ${cicd.stages.length} stage(s) · ${cicd.deployment_method || "—"} deploys.`,
          `DR: RTO ${scaling.rto || "—"}, RPO ${scaling.rpo || "—"}.`,
        ],
        deployment_topology: {
          compute_model: { pattern: topo.compute_pattern, rationale: topo.compute_rationale },
          region_strategy: { topology: topo.region_topology, availability_zones: topo.availability_zones, multi_region: topo.region_topology.includes("multi-region") },
          load_balancing: { layer: topo.lb_layer, strategy: "" },
          service_communication: { mesh_needed: topo.service_mesh, pattern: topo.service_mesh ? "service mesh" : "direct" },
        },
        environment_strategy: {
          tiers: env.tiers.map((t) => ({ name: t.name, purpose: t.purpose })),
          dev_prod_parity: { iac_tool: env.iac_tool, approach: env.iac_approach },
          config_management: { strategy: env.config_management, secrets_tool: "" },
          database_migrations: { tool: env.db_migration_tool, backward_compatible: true },
        },
        cicd_pipeline: {
          tool: cicd.tool,
          stages: cicd.stages,
          deployment_strategy: { method: cicd.deployment_method, rollback_plan: cicd.rollback_plan },
          quality_gates: cicd.quality_gates,
          artifact_versioning: { strategy: "semver + git sha", immutable: true },
        },
        scaling_resilience: {
          horizontal: {
            approach: scaling.autoscaling,
            auto_scaling: scaling.autoscaling,
            min_replicas: scaling.min_replicas,
            max_replicas: scaling.max_replicas,
          },
          database_scaling: { read_replicas: true },
          disaster_recovery: { rto: scaling.rto, rpo: scaling.rpo, backup_strategy: scaling.backup_strategy, failover: "" },
        },
        governance_review: {
          checklist: GOV_CHECKS.map((c) => ({ id: c.id, label: c.label, checked: !!gov[c.id] })),
          all_signed_off: govOk,
          notes: govNotes,
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

  const missingHint = !hasCc
    ? "Lock the cross-cutting concerns in Stage 9 first."
    : !topoOk
      ? "Complete the deployment topology."
      : !envOk
        ? "Complete the environment strategy."
        : !cicdOk
          ? "Complete the CI/CD pipeline."
          : !scaleOk
            ? "Complete the scaling & DR block."
            : !govOk
              ? "Tick every governance review item."
              : dirty
                ? "Save your changes first."
                : undefined;

  const govDone = GOV_CHECKS.filter((c) => gov[c.id]).length;

  return (
    <StageShell
      versionHistory={{ projectId, stage: 10 }}
      kicker={kickerFor(stage)}
      title={stage.title}
      blurb={stage.blurb}
      statusPill={{
        label: ready ? "Ready to advance" : (topoOk || envOk || cicdOk) ? "In progress" : "Not started",
        tone: ready ? "emerald" : (topoOk || envOk || cicdOk) ? "primary" : "neutral",
      }}
      stats={[
        { label: "Topology", value: loading ? "—" : topoOk ? "OK" : "Gaps", sub: topo.compute_pattern || "no compute", tone: topoOk ? "emerald" : "amber" },
        { label: "Environments", value: loading ? "—" : env.tiers.length, sub: env.iac_tool || "no IaC tool", tone: envOk ? "emerald" : "amber" },
        { label: "CI/CD", value: loading ? "—" : cicd.stages.length, sub: `${cicd.tool || "no tool"} · ${cicd.deployment_method || "no strategy"}`, tone: cicdOk ? "emerald" : "amber" },
        { label: "Governance", value: loading ? "—" : `${govDone}/${GOV_CHECKS.length}`, sub: govOk ? "all signed off" : "review pending", tone: govOk ? "emerald" : "amber" },
      ]}
      checks={[
        { key: "cc", label: `Cross-cutting concerns locked (Stage 9${ccVersion ? ` v${ccVersion}` : ""})`, ok: hasCc },
        { key: "topo", label: "Deployment topology defined", ok: topoOk },
        { key: "env", label: "Environment strategy defined (≥2 tiers + IaC)", ok: envOk },
        { key: "cicd", label: "CI/CD pipeline defined (≥3 stages + deploy method + rollback)", ok: cicdOk },
        { key: "scale", label: "Scaling & DR (autoscaling + RTO/RPO) defined", ok: scaleOk },
        { key: "gov", label: `Governance review complete (${govDone}/${GOV_CHECKS.length})`, ok: govOk },
        { key: "saved", label: "Latest edits saved as an artifact version", ok: !dirty },
      ]}
      checklistTitle="Ready to enter Validation & Assurance?"
      checklistBlurb="Stage 11 (ATAM) and onwards inherit this infrastructure design and the governance sign-offs captured here — no way to reach final approval without them."
      advance={{
        label: ready ? "Infrastructure & governance locked — advance to Stage 11" : "Complete the infrastructure design & governance review to advance",
        ready,
        busy: advancing,
        onClick: onAdvance,
        ctaLabel: "Advance to ATAM evaluation",
        missingHint,
      }}
      secondaryLink={{ label: "Open in classic workspace", href: stage.classicRoute(projectId) }}
    >
      {/* Auto-generate */}
      <SectionCard
        title="Auto-generate infrastructure design"
        subtitle={!hasCc ? "Lock the cross-cutting concerns in Stage 9 first." : "Runs the Infrastructure & Deployment agent with your cross-cutting decisions."}
        right={
          <div className="flex items-center gap-2">
            <RunAgentButton
              onRun={runStage}
              running={running || polling}
              hasArtifact={artifactVersion > 0}
              disabledReason={!hasCc ? "Complete cross-cutting concerns in Stage 9 first." : undefined}
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
            <>Latest artifact: <span className="font-mono font-semibold text-foreground">v{artifactVersion}</span>. Editing below creates a new version when saved.</>
          ) : (
            <>No infrastructure design yet. Run the agent or fill in the sections below.</>
          )}
        </div>
      </SectionCard>

      {/* Topology */}
      <SectionCard
        title="Deployment topology"
        subtitle="Compute, region strategy and load balancing."
        right={<Badge variant="outline" className="text-[10px]"><Cloud className="h-3 w-3 mr-1" />{topoOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="Compute pattern *" value={topo.compute_pattern} onChange={(v) => setTopo({ ...topo, compute_pattern: v })} options={COMPUTE} />
          <LabeledInput label="Compute rationale" placeholder="Why this pattern (scaling, ops maturity, cost)" value={topo.compute_rationale} onChange={(v) => setTopo({ ...topo, compute_rationale: v })} />
          <LabeledSelect label="Region topology *" value={topo.region_topology} onChange={(v) => setTopo({ ...topo, region_topology: v })} options={REGIONS} />
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Availability zones</label>
            <Input type="number" min={1} max={9} value={topo.availability_zones} onChange={(e) => setTopo({ ...topo, availability_zones: Number(e.target.value) || 1 })} />
          </div>
          <LabeledSelect label="Load balancing layer *" value={topo.lb_layer} onChange={(v) => setTopo({ ...topo, lb_layer: v })} options={LB_LAYERS} />
          <label className="flex items-end gap-2 text-xs text-muted-foreground pb-2">
            <Checkbox checked={topo.service_mesh} onCheckedChange={(v) => setTopo({ ...topo, service_mesh: !!v })} />
            Service mesh required (Istio / Linkerd / Consul)
          </label>
        </div>
      </SectionCard>

      {/* Environments */}
      <SectionCard
        title="Environment strategy"
        subtitle="Tiers, infrastructure-as-code, config and DB migrations."
        right={<Badge variant="outline" className="text-[10px]">{envOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="IaC tool *" value={env.iac_tool} onChange={(v) => setEnv({ ...env, iac_tool: v })} options={IAC_TOOLS} />
          <LabeledInput label="IaC approach" placeholder="Modules per env, GitHub PR + plan review" value={env.iac_approach} onChange={(v) => setEnv({ ...env, iac_approach: v })} />
          <LabeledInput label="Config management *" placeholder="Env vars + Vault + Doppler pull on boot" value={env.config_management} onChange={(v) => setEnv({ ...env, config_management: v })} />
          <LabeledInput label="DB migration tool" placeholder="Prisma migrate / Flyway / Liquibase" value={env.db_migration_tool} onChange={(v) => setEnv({ ...env, db_migration_tool: v })} />
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Environment tiers ({env.tiers.length})</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-3" placeholder="Name (e.g. prod)" value={tierName} onChange={(e) => setTierName(e.target.value)} />
            <Input className="md:col-span-8" placeholder="Purpose" value={tierPurpose} onChange={(e) => setTierPurpose(e.target.value)} />
            <Button onClick={addTier} className="md:col-span-1 gap-1"><Plus className="h-4 w-4" /></Button>
          </div>
          <ul className="space-y-1">
            {env.tiers.map((t, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                <span className="font-mono font-semibold">{t.name}</span>
                <span className="text-muted-foreground truncate">— {t.purpose}</span>
                <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeTier(i)} aria-label={`Remove ${t.name}`}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* CI/CD */}
      <SectionCard
        title="CI/CD pipeline"
        subtitle="Automation tool, pipeline stages, deployment method and rollback plan."
        right={<Badge variant="outline" className="text-[10px]"><GitBranch className="h-3 w-3 mr-1" />{cicdOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledSelect label="CI/CD tool *" value={cicd.tool} onChange={(v) => setCicd({ ...cicd, tool: v })} options={CICD_TOOLS} />
          <LabeledSelect label="Deployment method *" value={cicd.deployment_method} onChange={(v) => setCicd({ ...cicd, deployment_method: v })} options={DEPLOY_METHODS} />
        </div>
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Rollback plan *</label>
          <Textarea rows={2} value={cicd.rollback_plan} onChange={(e) => setCicd({ ...cicd, rollback_plan: e.target.value })} placeholder="Redeploy previous immutable artifact via GitOps revert; DB migrations must be backward compatible." />
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Pipeline stages ({cicd.stages.length}) *</p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input className="md:col-span-3" placeholder="Name (e.g. Build)" value={stageName} onChange={(e) => setStageName(e.target.value)} />
            <Input className="md:col-span-7" placeholder="Description" value={stageDesc} onChange={(e) => setStageDesc(e.target.value)} />
            <label className="md:col-span-1 flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
              <Checkbox checked={stageAuto} onCheckedChange={(v) => setStageAuto(!!v)} />
              auto
            </label>
            <Button onClick={addStage} className="md:col-span-1 gap-1"><Plus className="h-4 w-4" /></Button>
          </div>
          {cicd.stages.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Add at least three stages (e.g. Build → Test → Deploy).</p>
          ) : (
            <ul className="space-y-1">
              {cicd.stages.map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold">{i + 1}. {s.name}</span>
                  <span className="text-muted-foreground truncate">— {s.description}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">{s.automated ? "auto" : "manual"}</Badge>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeStage(i)} aria-label={`Remove stage ${s.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Quality gates</p>
          <div className="flex items-center gap-2">
            <Input placeholder="e.g. Unit tests > 80% coverage" value={qgDraft} onChange={(e) => setQgDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQg(); } }} />
            <Button onClick={addQg} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
          </div>
          {cicd.quality_gates.length > 0 && (
            <ul className="space-y-1">
              {cicd.quality_gates.map((q, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs">
                  <span>{q}</span>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => removeQg(i)} aria-label="Remove gate">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      {/* Scaling & DR */}
      <SectionCard
        title="Scaling & disaster recovery"
        subtitle="Autoscaling posture, replica bounds and RTO/RPO targets."
        right={<Badge variant="outline" className="text-[10px]">{scaleOk ? "OK" : "Gaps"}</Badge>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LabeledInput label="Horizontal autoscaling *" placeholder="HPA on CPU 60% + RPS 200, KEDA on queue depth" value={scaling.autoscaling} onChange={(v) => setScaling({ ...scaling, autoscaling: v })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Min replicas</label>
              <Input type="number" min={1} value={scaling.min_replicas} onChange={(e) => setScaling({ ...scaling, min_replicas: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Max replicas</label>
              <Input type="number" min={1} value={scaling.max_replicas} onChange={(e) => setScaling({ ...scaling, max_replicas: Number(e.target.value) || 1 })} />
            </div>
          </div>
          <LabeledInput label="RTO *" placeholder="≤ 30 min" value={scaling.rto} onChange={(v) => setScaling({ ...scaling, rto: v })} />
          <LabeledInput label="RPO *" placeholder="≤ 5 min" value={scaling.rpo} onChange={(v) => setScaling({ ...scaling, rpo: v })} />
          <LabeledInput label="Backup strategy" placeholder="PITR + cross-region snapshots nightly" value={scaling.backup_strategy} onChange={(v) => setScaling({ ...scaling, backup_strategy: v })} />
        </div>
      </SectionCard>

      {/* Governance review */}
      <SectionCard
        title="Quality & governance review"
        subtitle="Every item must be ticked before this stage locks. These are the gates final approval will re-check."
        right={<Badge variant="outline" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" />{govDone}/{GOV_CHECKS.length}</Badge>}
      >
        <ul className="space-y-1.5">
          {GOV_CHECKS.map((c) => {
            const checked = !!gov[c.id];
            return (
              <li key={c.id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${checked ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background"}`}>
                <Checkbox checked={checked} onCheckedChange={(v) => toggleGov(c.id, !!v)} className="mt-0.5" />
                <label className="cursor-pointer flex-1" onClick={() => toggleGov(c.id, !checked)}>
                  {c.label}
                </label>
                {checked ? (
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">Governance notes</label>
          <Textarea rows={2} value={govNotes} onChange={(e) => setGovNotes(e.target.value)} placeholder="Who signed off, meeting date, outstanding follow-ups…" />
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

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  const hasCustom = !!value && !options.includes(value);
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1 block">{label}</label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          {hasCustom && <SelectItem value={value}>{value} (custom)</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Canonicalize a free-form agent string against a preset list. Agents often
 * emit verbose values like "Kubernetes (EKS) container orchestration" — map
 * those back to the exact preset ("Container orchestration (K8s)") so the
 * <Select> displays them and validation passes. Falls back to the raw value
 * (rendered as "(custom)") when nothing matches.
 */
function toOption(raw: unknown, options: readonly string[]): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return "";
  const lower = v.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === lower);
  if (exact) return exact;
  const sub = options.find((o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower));
  if (sub) return sub;
  const hints: Record<string, string[]> = {
    "Container orchestration (K8s)": ["kubernet", "k8s", "eks", "gke", "aks", "container orch"],
    "Managed serverless (Lambda / Cloud Run)": ["serverless", "lambda", "cloud run", "functions"],
    "PaaS (Fly.io / Render / Heroku)": ["paas", "fly.io", "render", "heroku"],
    "VM-based": ["vm", "virtual machine", "ec2", "compute engine"],
    "Hybrid": ["hybrid"],
    "single-region multi-AZ": ["single region", "single-region", "multi-az", "multi az"],
    "multi-region active-active": ["active-active", "active active"],
    "multi-region active-passive": ["active-passive", "active passive", "failover region"],
    "edge": ["edge", "cdn"],
    "L4": ["l4", "layer 4", "network load"],
    "L7": ["l7", "layer 7", "application load", "alb", "nginx", "envoy"],
    "Global anycast": ["anycast", "global lb", "cloudflare", "front door"],
    "Client-side": ["client-side", "client side"],
    "GitHub Actions": ["github action"],
    "GitLab CI": ["gitlab"],
    "CircleCI": ["circle"],
    "Buildkite": ["buildkite"],
    "Jenkins": ["jenkins"],
    "Argo CD": ["argo"],
    "blue-green": ["blue-green", "blue green"],
    "canary": ["canary"],
    "rolling": ["rolling"],
    "recreate": ["recreate"],
    "Terraform": ["terraform"],
    "Pulumi": ["pulumi"],
    "CDK": ["cdk"],
    "CloudFormation": ["cloudformation", "cfn"],
    "OpenTofu": ["opentofu", "tofu"],
  };
  for (const opt of options) {
    const hs = hints[opt];
    if (hs && hs.some((h) => lower.includes(h))) return opt;
  }
  return v;
}

function normalizeTopology(raw: any): Topology {
  if (!raw || typeof raw !== "object") return EMPTY_TOPO;
  const c = raw.compute_model ?? {};
  const r = raw.region_strategy ?? {};
  const lb = raw.load_balancing ?? {};
  const sc = raw.service_communication ?? {};
  return {
    compute_pattern: toOption(c.pattern, COMPUTE),
    compute_rationale: str(c.rationale),
    region_topology: toOption(r.topology, REGIONS),
    availability_zones: Number(r.availability_zones) || 3,
    lb_layer: toOption(lb.layer, LB_LAYERS),
    service_mesh: sc.mesh_needed === true,
  };
}
function normalizeEnv(raw: any): EnvStrategy {
  if (!raw || typeof raw !== "object") return EMPTY_ENV;
  const tiers = Array.isArray(raw.tiers)
    ? raw.tiers.map((t: any) => (t && typeof t.name === "string" ? { name: t.name, purpose: str(t.purpose) } : null)).filter(Boolean) as EnvTier[]
    : EMPTY_ENV.tiers;
  const parity = raw.dev_prod_parity ?? {};
  const cfg = raw.config_management ?? {};
  const mig = raw.database_migrations ?? {};
  return {
    tiers: tiers.length > 0 ? tiers : EMPTY_ENV.tiers,
    iac_tool: toOption(parity.iac_tool, IAC_TOOLS),
    iac_approach: str(parity.approach),
    config_management: str(cfg.strategy),
    db_migration_tool: str(mig.tool),
  };
}
function normalizeCicd(raw: any): Cicd {
  if (!raw || typeof raw !== "object") return EMPTY_CICD;
  const ds = raw.deployment_strategy ?? {};
  return {
    tool: toOption(raw.tool, CICD_TOOLS),
    stages: Array.isArray(raw.stages)
      ? raw.stages.map((s: any) => (s && typeof s.name === "string" ? { name: s.name, description: str(s.description), automated: s.automated !== false } : null)).filter(Boolean) as CicdStage[]
      : [],
    deployment_method: toOption(ds.method, DEPLOY_METHODS),
    rollback_plan: str(ds.rollback_plan),
    quality_gates: Array.isArray(raw.quality_gates) ? raw.quality_gates.filter((q: unknown) => typeof q === "string") : [],
  };
}
function normalizeScaling(raw: any): Scaling {
  if (!raw || typeof raw !== "object") return EMPTY_SCALING;
  const h = raw.horizontal ?? {};
  const dr = raw.disaster_recovery ?? {};
  return {
    autoscaling: str(h.auto_scaling ?? h.approach),
    min_replicas: Number(h.min_replicas) || 2,
    max_replicas: Number(h.max_replicas) || 10,
    rto: str(dr.rto),
    rpo: str(dr.rpo),
    backup_strategy: str(dr.backup_strategy),
  };
}
function normalizeGov(raw: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw) return out;
  // Auto-tick every checklist item when the agent asserts all sign-offs.
  if (raw.all_signed_off === true) {
    for (const c of GOV_CHECKS) out[c.id] = true;
  }
  if (Array.isArray(raw.checklist)) {
    for (const c of raw.checklist) {
      if (c && typeof c.id === "string") out[c.id] = !!c.checked || out[c.id] === true;
    }
  }
  return out;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function hashOf(t: Topology, e: EnvStrategy, c: Cicd, s: Scaling, g: Record<string, boolean>, gn: string): string {
  const govSorted = Object.keys(g).sort().map((k) => [k, !!g[k]]);
  return JSON.stringify({ t, e, c, s, g: govSorted, gn });
}
