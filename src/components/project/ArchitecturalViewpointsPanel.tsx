import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Globe,
  Layers,
  Network,
  BookOpen,
  Users,
  Activity,
  Server,
  Code2,
  Target,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import MermaidDiagram from "./MermaidDiagram";

interface Props {
  className?: string;
  components?: any[];
  dependencyGraph?: any[];
  communicationPatterns?: any[];
  projectName?: string;
  viewpointData?: any; // Agent-generated architectural_viewpoints object
}

// ── Helpers ──

function toId(s: string): string {
  return (
    s
      ?.trim()
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "node"
  );
}

/**
 * Escape a label for inclusion inside a Mermaid `["..."]` node.
 * - Quotes are HTML-escaped so they don't terminate the string early.
 * - Real newlines become `<br/>` (Mermaid's only supported in-label break).
 * - Square brackets inside labels are converted to parens — bare `[` or `]`
 *   inside a node label is the #1 cause of "Diagram could not be rendered"
 *   because Mermaid re-interprets them as another node shape.
 */
function escapeMermaid(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, "<br/>")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")");
}

function truncate(s: string, max: number): string {
  return s?.length > max ? s.slice(0, max - 3) + "..." : s || "";
}

// ── Fallback diagram generators (when agent data is unavailable) ──

function generateLogicalViewDiagram(components: any[]): string {
  if (!components?.length) return "";
  const lines = ["flowchart TD"];
  const grouped: Record<string, any[]> = {};
  components.forEach((c) => {
    const t = c.type || "module";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(c);
  });
  let sgIdx = 0;
  for (const [type, comps] of Object.entries(grouped)) {
    const sgId = `sg_lv_${sgIdx++}`;
    const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ") + "s";
    lines.push(`  subgraph ${sgId}["${escapeMermaid(label)}"]`);
    comps.forEach((c) => {
      const id = toId(c.name);
      const resp = c.responsibility ? `${c.name}\n${truncate(c.responsibility, 40)}` : c.name;
      lines.push(`    ${id}["${escapeMermaid(resp)}"]`);
    });
    lines.push("  end");
  }
  components.forEach((c) => {
    (c.interfaces_provided || []).slice(0, 2).forEach((iface: string) => {
      lines.push(`  ${toId(iface)}([${escapeMermaid(truncate(iface, 30))}])`);
      lines.push(`  ${toId(c.name)} --> ${toId(iface)}`);
    });
  });
  return lines.join("\n");
}

function generateProcessViewDiagram(components: any[], patterns: any[]): string {
  if (!components?.length) return "";
  const lines = ["flowchart LR"];
  lines.push('  subgraph sg_sync["Synchronous Flows"]');
  const syncPatterns = (patterns || []).filter((p) =>
    (p.pattern || p.type || "sync").toLowerCase().includes("sync"),
  );
  if (syncPatterns.length) {
    syncPatterns.slice(0, 6).forEach((p) => {
      lines.push(
        `    ${toId(p.from)} -->|"${escapeMermaid(p.protocol || "REST/gRPC")}"| ${toId(p.to)}`,
      );
    });
  } else {
    lines.push('    sp_none["No sync patterns defined"]');
  }
  lines.push("  end");
  lines.push('  subgraph sg_async["Asynchronous Flows"]');
  const asyncPatterns = (patterns || []).filter((p) => {
    const t = (p.pattern || p.type || "").toLowerCase();
    return t.includes("async") || t.includes("event") || t.includes("pub") || t.includes("queue");
  });
  if (asyncPatterns.length) {
    asyncPatterns.slice(0, 6).forEach((p) => {
      lines.push(
        `    ${toId(p.from)} -.->|"${escapeMermaid(p.pattern || p.type || "async")}"| ${toId(p.to)}`,
      );
    });
  } else {
    lines.push('    ap_none["No async patterns defined"]');
  }
  lines.push("  end");
  return lines.join("\n");
}

function generateDevelopmentViewDiagram(components: any[]): string {
  if (!components?.length) return "";
  const lines = ["flowchart TD"];
  lines.push('  subgraph sg_src["Source Organization"]');
  components.forEach((c) => {
    const id = toId(c.name);
    const dataStr = (c.data_owned || []).slice(0, 3).join(", ");
    // Use a real newline so escapeMermaid converts it to <br/>. The previous
    // "\\n[...]" embedded a literal backslash-n plus square-brackets inside
    // the label, which Mermaid mis-parses as another node shape and blanks
    // the whole diagram.
    const label = dataStr ? `${c.name}\n(${truncate(dataStr, 30)})` : c.name;
    lines.push(`    ${id}["${escapeMermaid(label)}"]`);
  });
  lines.push("  end");
  components.forEach((c) => {
    (c.dependencies || []).forEach((d: string) => {
      lines.push(`  ${toId(c.name)} -->|"depends on"| ${toId(d)}`);
    });
  });
  return lines.join("\n");
}

function generatePhysicalViewDiagram(components: any[]): string {
  if (!components?.length) return "";
  const lines = ["flowchart TD"];
  lines.push('  subgraph sg_lb["Load Balancer / Gateway"]');
  lines.push('    LB["API Gateway"]');
  lines.push("  end");
  lines.push('  subgraph sg_app["Application Tier"]');
  components.slice(0, 8).forEach((c) => {
    lines.push(`    ${toId(c.name)}["${escapeMermaid(c.name)}"]`);
  });
  lines.push("  end");
  lines.push('  subgraph sg_data["Data Tier"]');
  lines.push('    DB[("Primary Database")]');
  lines.push('    CACHE[("Cache Layer")]');
  lines.push("  end");
  components.slice(0, 4).forEach((c) => {
    lines.push(`  LB --> ${toId(c.name)}`);
  });
  components.slice(0, 3).forEach((c) => {
    lines.push(`  ${toId(c.name)} --> DB`);
  });
  if (components.length > 0) {
    lines.push(`  ${toId(components[0].name)} --> CACHE`);
  }
  return lines.join("\n");
}

/**
 * Scenarios (+1) — render an actor-centric use-case map, NOT a
 * component pipeline. Prefer `viewpointData.four_plus_one.scenarios.use_cases`
 * when present; otherwise infer 4-6 use cases from component responsibilities.
 */
function generateScenariosDiagram(components: any[], useCases?: any[]): string {
  const cases: { name: string; actor?: string }[] = [];

  if (Array.isArray(useCases) && useCases.length > 0) {
    for (const uc of useCases.slice(0, 8)) {
      if (!uc?.name) continue;
      cases.push({ name: String(uc.name), actor: uc.actor ? String(uc.actor) : undefined });
    }
  }

  if (cases.length === 0 && components?.length) {
    components.slice(0, 6).forEach((c) => {
      const verb = (c.responsibility || c.name || "")
        .toString()
        .split(/[.;]/)[0]
        .trim()
        .replace(/^[a-z]/, (m: string) => m.toUpperCase());
      cases.push({ name: truncate(verb || c.name, 36) });
    });
  }

  if (cases.length === 0) return "";

  // Group cases by actor (default actor = "User")
  const byActor = new Map<string, { name: string }[]>();
  cases.forEach((c) => {
    const a = c.actor || "User";
    if (!byActor.has(a)) byActor.set(a, []);
    byActor.get(a)!.push({ name: c.name });
  });

  const lines = ["flowchart LR"];
  // System boundary subgraph holds use cases (rendered as ovals via `(...)`)
  lines.push('  subgraph sg_sys["System Boundary"]');
  let ucIdx = 0;
  const ucIds: string[] = [];
  for (const list of byActor.values()) {
    list.forEach((uc) => {
      const id = `uc_${ucIdx++}`;
      ucIds.push(id);
      lines.push(`    ${id}(("${escapeMermaid(uc.name)}"))`);
    });
  }
  lines.push("  end");

  // Actors as stick-figure-ish stadium nodes outside the boundary
  let aIdx = 0;
  let cursor = 0;
  for (const [actor, list] of byActor.entries()) {
    const actorId = `actor_${aIdx++}`;
    lines.push(`  ${actorId}(["${escapeMermaid(actor)}"])`);
    for (let i = 0; i < list.length; i++) {
      const ucId = ucIds[cursor++];
      lines.push(`  ${actorId} --- ${ucId}`);
    }
  }

  return lines.join("\n");
}

// ── Viewpoint Metadata ──

const VIEWPOINTS_META = [
  {
    id: "4plus1",
    label: "4+1 View Model",
    author: "Philippe Kruchten, 1995",
    ref: "IEEE Software 12(6), pp.42-50",
    icon: Layers,
    color: "text-blue-500",
  },
  {
    id: "iso42010",
    label: "ISO/IEC/IEEE 42010",
    author: "ISO/IEC/IEEE, 2022 Revision",
    ref: "ISO/IEC/IEEE 42010:2022 — Architecture Description",
    icon: Globe,
    color: "text-emerald-500",
  },
  {
    id: "togaf",
    label: "TOGAF Architecture Views",
    author: "The Open Group, TOGAF 10",
    ref: "TOGAF Standard — Architecture Development Method (ADM)",
    icon: Network,
    color: "text-violet-500",
  },
];

// ── Detail renderers for agent-generated viewpoint data ──

function ViewpointDetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-foreground">{title}</h5>
      {children}
    </div>
  );
}

function renderAgentViewDetails(viewKey: string, viewpointData: any) {
  if (!viewpointData) return null;

  const fourPlusOne = viewpointData.four_plus_one;
  const iso = viewpointData.iso_42010;
  const togaf = viewpointData.togaf;

  switch (viewKey) {
    case "logical": {
      const data = fourPlusOne?.logical_view;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Key Abstractions">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(data.key_abstractions || []).map((a: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-semibold text-foreground">{a.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {a.type}
                  </Badge>
                </div>
                {a.responsibilities?.length > 0 && (
                  <ul className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                    {a.responsibilities.map((r: string, j: number) => (
                      <li key={j}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "process": {
      const data = fourPlusOne?.process_view;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Runtime Processes & Flows">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.processes || []).map((p: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{p.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {p.type}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {p.communication_mechanism && (
                    <>
                      <strong>Mechanism:</strong> {p.communication_mechanism}
                    </>
                  )}
                  {p.concurrency_notes && <> — {p.concurrency_notes}</>}
                </p>
                {p.components_involved?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.components_involved.map((c: string, j: number) => (
                      <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "development": {
      const data = fourPlusOne?.development_view;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Source Organization & Packages">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.packages || []).map((pkg: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{pkg.name}</span>
                  {pkg.layer && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                      {pkg.layer}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(pkg.modules || []).map((m: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            {data.build_constraints?.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                  Build Constraints:
                </p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  {data.build_constraints.map((c: string, i: number) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "physical": {
      const data = fourPlusOne?.physical_view;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Deployment Nodes & Network">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(data.nodes || []).map((n: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Server className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{n.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {n.type}
                  </Badge>
                </div>
                {n.network_zone && (
                  <p className="text-[10px] text-muted-foreground">Zone: {n.network_zone}</p>
                )}
                {n.scaling && (
                  <p className="text-[10px] text-muted-foreground">Scaling: {n.scaling}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {(n.hosted_components || []).map((c: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {data.network_connections?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                Network Connections:
              </p>
              <div className="space-y-1">
                {data.network_connections.map((nc: any, i: number) => (
                  <p key={i} className="text-[10px] text-muted-foreground">
                    {nc.from} → {nc.to} ({nc.protocol}){nc.security ? ` — ${nc.security}` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}
        </ViewpointDetailSection>
      );
    }
    case "scenarios": {
      const data = fourPlusOne?.scenarios;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Key Use Case Scenarios">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.use_cases || []).map((uc: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">{uc.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    Actor: {uc.actor}
                  </Badge>
                </div>
                <ol className="text-[10px] text-muted-foreground space-y-0.5 mt-1 list-decimal list-inside">
                  {(uc.flow || []).map((step: string, j: number) => (
                    <li key={j}>{step}</li>
                  ))}
                </ol>
                {uc.quality_attributes_tested?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {uc.quality_attributes_tested.map((qa: string, j: number) => (
                      <Badge
                        key={j}
                        className="text-[8px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                      >
                        {qa}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    // ISO 42010 views
    case "functional": {
      const data = iso?.functional;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="System Capabilities">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.capabilities || []).map((cap: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <span className="text-xs font-semibold">{cap.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(cap.functions || []).map((f: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "information": {
      const data = iso?.information;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Data Entities & Flows">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(data.data_entities || []).map((e: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <span className="text-xs font-semibold">{e.name}</span>
                <p className="text-[10px] text-muted-foreground">
                  Owner: {e.owner}
                  {e.lifecycle ? ` | Lifecycle: ${e.lifecycle}` : ""}
                </p>
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "concurrency": {
      const data = iso?.concurrency;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Concurrent Execution Units">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.concurrent_units || []).map((cu: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{cu.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {cu.type}
                  </Badge>
                </div>
                {cu.synchronization && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Sync: {cu.synchronization}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "deployment": {
      const data = iso?.deployment;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Deployment Units">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          {data.runtime_platform && (
            <p className="text-xs text-muted-foreground mb-2">
              <strong>Platform:</strong> {data.runtime_platform}
            </p>
          )}
          <div className="space-y-2">
            {(data.deployment_units || []).map((du: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <span className="text-xs font-semibold">{du.name}</span>
                <p className="text-[10px] text-muted-foreground">
                  {du.technology}
                  {du.resources ? ` — ${du.resources}` : ""}
                  {du.replicas ? ` (${du.replicas})` : ""}
                </p>
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    // TOGAF views
    case "business": {
      const data = togaf?.business;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Business Capabilities">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.business_capabilities || []).map((bc: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <span className="text-xs font-semibold">{bc.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(bc.supported_by || []).map((s: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      {s}
                    </Badge>
                  ))}
                </div>
                {bc.stakeholders?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Stakeholders: {bc.stakeholders.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "appArch": {
      const data = togaf?.application;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Application Components">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.application_components || []).map((ac: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{ac.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {ac.type}
                  </Badge>
                </div>
                {ac.interfaces?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ac.interfaces.map((iface: string, j: number) => (
                      <Badge key={j} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {iface}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    case "techArch": {
      const data = togaf?.technology;
      if (!data) return null;
      return (
        <ViewpointDetailSection title="Technology Stack">
          {data.description && (
            <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
          )}
          <div className="space-y-2">
            {(data.technology_stack || []).map((ts: any, i: number) => (
              <div key={i} className="rounded-md border bg-card/60 p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{ts.technology}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                    {ts.layer}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{ts.purpose}</p>
                {ts.alternatives_considered && (
                  <p className="text-[10px] text-muted-foreground italic mt-0.5">
                    Alternatives: {ts.alternatives_considered}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ViewpointDetailSection>
      );
    }
    default:
      return null;
  }
}

// Get agent-generated diagram for a viewpoint key
function getAgentDiagram(viewKey: string, viewpointData: any): string {
  if (!viewpointData) return "";
  const fp = viewpointData.four_plus_one;
  const iso = viewpointData.iso_42010;
  const togaf = viewpointData.togaf;

  const map: Record<string, string> = {
    logical: fp?.logical_view?.mermaid_diagram || "",
    process: fp?.process_view?.mermaid_diagram || "",
    development: fp?.development_view?.mermaid_diagram || "",
    physical: fp?.physical_view?.mermaid_diagram || "",
    scenarios: fp?.scenarios?.mermaid_diagram || "",
    functional: iso?.functional?.mermaid_diagram || "",
    information: iso?.information?.mermaid_diagram || "",
    concurrency: iso?.concurrency?.mermaid_diagram || "",
    deployment: iso?.deployment?.mermaid_diagram || "",
    business: togaf?.business?.mermaid_diagram || "",
    appArch: togaf?.application?.mermaid_diagram || "",
    techArch: togaf?.technology?.mermaid_diagram || "",
  };
  return map[viewKey] || "";
}

export default function ArchitecturalViewpointsPanel({
  className,
  components = [],
  dependencyGraph = [],
  communicationPatterns = [],
  projectName = "System",
  viewpointData,
}: Props) {
  const [activeViewpoint, setActiveViewpoint] = useState("4plus1");
  const [expandedView, setExpandedView] = useState<string | null>(null);

  const hasData = components.length > 0;
  const hasAgentViewpoints = !!viewpointData?.four_plus_one;

  // Fallback diagrams from component data
  const fallbackDiagrams = useMemo(() => {
    if (!hasData) return {};
    const agentUseCases = viewpointData?.four_plus_one?.scenarios?.use_cases;
    return {
      logical: generateLogicalViewDiagram(components),
      process: generateProcessViewDiagram(components, communicationPatterns),
      development: generateDevelopmentViewDiagram(components),
      physical: generatePhysicalViewDiagram(components),
      scenarios: generateScenariosDiagram(components, agentUseCases),
      functional: generateLogicalViewDiagram(components),
      information: generateDevelopmentViewDiagram(components),
      concurrency: generateProcessViewDiagram(components, communicationPatterns),
      deployment: generatePhysicalViewDiagram(components),
      business: generateScenariosDiagram(components, agentUseCases),
      appArch: generateLogicalViewDiagram(components),
      techArch: generatePhysicalViewDiagram(components),
    };
  }, [components, communicationPatterns, hasData, viewpointData]);

  const VIEWS_4PLUS1 = [
    {
      name: "Logical View",
      icon: Target,
      audience: "End users, analysts",
      desc: "Key abstractions — classes, objects, packages. Shows functional requirements decomposition.",
      diagramKey: "logical",
    },
    {
      name: "Process View",
      icon: Activity,
      audience: "System integrators",
      desc: "Concurrency, threads, processes, synchronization. Addresses performance, availability, fault tolerance.",
      diagramKey: "process",
    },
    {
      name: "Development View",
      icon: Code2,
      audience: "Developers, testers",
      desc: "Software module organization — packages, layers, subsystems. Maps to development environment.",
      diagramKey: "development",
    },
    {
      name: "Physical View",
      icon: Server,
      audience: "Operations, infrastructure",
      desc: "Mapping of software to hardware — nodes, networks, deployment topology.",
      diagramKey: "physical",
    },
    {
      name: "Scenarios (+1)",
      icon: Users,
      audience: "All stakeholders",
      desc: "Use cases that tie all views together — validate and illustrate the architecture.",
      diagramKey: "scenarios",
    },
  ];

  const VIEWS_ISO = [
    {
      name: "Functional Viewpoint",
      icon: Target,
      audience: "Business analysts",
      desc: "System functions, capabilities, and information flows.",
      diagramKey: "functional",
    },
    {
      name: "Information Viewpoint",
      icon: Layers,
      audience: "Data architects",
      desc: "Data semantics, lifecycle, quality, and information flows across boundaries.",
      diagramKey: "information",
    },
    {
      name: "Concurrency Viewpoint",
      icon: Activity,
      audience: "Developers",
      desc: "Process structure, inter-process communication, state management.",
      diagramKey: "concurrency",
    },
    {
      name: "Deployment Viewpoint",
      icon: Server,
      audience: "Operations",
      desc: "Runtime platform, hardware, and third-party software dependencies.",
      diagramKey: "deployment",
    },
  ];

  const VIEWS_TOGAF = [
    {
      name: "Business Architecture View",
      icon: Users,
      audience: "CxO, business stakeholders",
      desc: "Business strategy, governance, organization, key processes and their interaction.",
      diagramKey: "business",
    },
    {
      name: "Application Architecture View",
      icon: Layers,
      audience: "Solution architects",
      desc: "Application portfolio, interactions, interfaces to core business processes.",
      diagramKey: "appArch",
    },
    {
      name: "Technology Architecture View",
      icon: Server,
      audience: "Infrastructure team",
      desc: "Hardware, software, networking infrastructure and middleware.",
      diagramKey: "techArch",
    },
  ];

  const viewsMap: Record<string, typeof VIEWS_4PLUS1> = {
    "4plus1": VIEWS_4PLUS1,
    iso42010: VIEWS_ISO,
    togaf: VIEWS_TOGAF,
  };

  const renderViewCard = (view: (typeof VIEWS_4PLUS1)[0], i: number) => {
    const isOpen = expandedView === `${activeViewpoint}-${view.name}`;
    const Icon = view.icon;
    const agentDiagram = getAgentDiagram(view.diagramKey, viewpointData);
    const fallbackDiagram = (fallbackDiagrams as any)[view.diagramKey] || "";
    const diagramCode = agentDiagram || fallbackDiagram;
    const agentDetails = hasAgentViewpoints
      ? renderAgentViewDetails(view.diagramKey, viewpointData)
      : null;

    return (
      <motion.div
        key={view.name}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className="rounded-lg border bg-card overflow-hidden"
      >
        <button
          onClick={() => setExpandedView(isOpen ? null : `${activeViewpoint}-${view.name}`)}
          className="flex items-center gap-2.5 p-3 w-full text-left hover:bg-accent/30 transition-colors"
        >
          <Icon className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{view.name}</h4>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                {view.audience}
              </Badge>
              {agentDiagram && (
                <Badge className="text-[8px] px-1.5 py-0 h-4 bg-success/20 text-success border-success/30">
                  AI-generated
                </Badge>
              )}
              {!agentDiagram && diagramCode && (
                <Badge className="text-[8px] px-1.5 py-0 h-4 bg-warning/20 text-warning border-warning/30">
                  auto-inferred
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{view.desc}</p>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </button>

        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="border-t overflow-hidden"
          >
            <div className="p-3 space-y-4">
              {/* Agent-generated detail content */}
              {agentDetails}

              {/* Diagram */}
              {diagramCode ? (
                <MermaidDiagram
                  code={diagramCode}
                  title={`${view.name} — ${projectName}`}
                  type="flowchart"
                />
              ) : (
                <div className="text-center py-8 rounded border border-dashed">
                  <Eye className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Run the Decomposition Agent to generate this viewpoint diagram.
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Diagrams are auto-generated from your architecture components and dependencies.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Eye className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-display font-semibold">Architectural Viewpoints</h3>
        {hasAgentViewpoints ? (
          <Badge className="text-[10px] ml-auto bg-success/20 text-success border-success/30">
            Agent-generated views
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] ml-auto">
            Multi-perspective analysis
          </Badge>
        )}
      </div>

      {!hasData && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
          <p className="text-xs text-warning font-medium">No decomposition data available yet.</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Run the System Decomposition agent (Stage 6) first. Viewpoint diagrams are
            auto-generated from your architecture components, dependencies, and communication
            patterns.
          </p>
        </div>
      )}

      <Tabs
        value={activeViewpoint}
        onValueChange={(v) => {
          setActiveViewpoint(v);
          setExpandedView(null);
        }}
      >
        <TabsList className="w-full grid grid-cols-3 h-auto p-1">
          {VIEWPOINTS_META.map((vp) => {
            const Icon = vp.icon;
            return (
              <TabsTrigger
                key={vp.id}
                value={vp.id}
                className="flex items-center gap-1.5 text-[11px] py-2"
              >
                <Icon className={cn("h-3.5 w-3.5", vp.color)} />
                <span className="hidden sm:inline">{vp.label}</span>
                <span className="sm:hidden">{vp.label.split(" ")[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {VIEWPOINTS_META.map((vp) => (
          <TabsContent key={vp.id} value={vp.id} className="space-y-3 mt-4">
            {/* Attribution */}
            <div className="flex items-start gap-2 p-3 rounded-lg border bg-card/60">
              <BookOpen className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-display font-semibold">{vp.label}</p>
                <p className="text-[10px] text-muted-foreground">{vp.author}</p>
                <p className="text-[10px] text-muted-foreground italic mt-0.5">Ref: {vp.ref}</p>
              </div>
            </div>

            {/* Views with diagrams */}
            <div className="space-y-2">
              {(viewsMap[vp.id] || []).map((view, i) => renderViewCard(view, i))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
