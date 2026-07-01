import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Zap,
  Radio,
  Lock,
  Unlock,
  Server,
  Workflow,
  Info,
} from "lucide-react";

const TAB_GUIDES: Record<string, { title: string; body: string }> = {
  apis: {
    title: "What are APIs?",
    body: "Each API exposes a component's capabilities to other components or external clients. Endpoints define the contract: HTTP method, path, request/response schemas, and whether authentication is required. Review these to confirm boundaries match your decomposition (Stage 6).",
  },
  communication: {
    title: "What are Communication Patterns?",
    body: "Patterns describe how components talk to each other: synchronous request/response (REST, gRPC), asynchronous messaging (queues, pub/sub), or streaming. Each row shows the source → target component, the interaction style, and the wire protocol.",
  },
  events: {
    title: "What are Event Contracts?",
    body: "Events are messages produced by one component and consumed by others, enabling loose coupling. Each contract names the event, identifies its producer and consumers, and pins down the payload schema so teams can evolve independently without breaking integrations.",
  },
  integrations: {
    title: "What are Integration Points?",
    body: "Integrations are connections to external systems (payment providers, identity, analytics, etc.) or internal platform services. They surface third-party dependencies, the protocol used, and the direction of data flow so risk and compliance can be assessed.",
  },
};

function TabGuide({ tabId }: { tabId: string }) {
  const guide = TAB_GUIDES[tabId];
  const storageKey = `apidesign-guide-collapsed:${tabId}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed, storageKey]);

  if (!guide) return null;

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full p-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Info className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold flex-1">{guide.title}</span>
        <span className="text-[10px] text-muted-foreground">
          {collapsed ? "Show guide" : "Hide guide"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed">{guide.body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import MermaidDiagram, { extractMermaidDiagrams } from "./MermaidDiagram";
import RunStageCTA from "./RunStageCTA";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
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

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-success/15 text-success border-success/30",
  POST: "bg-primary/15 text-primary border-primary/30",
  PUT: "bg-warning/15 text-warning border-warning/30",
  PATCH: "bg-warning/15 text-warning border-warning/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  SUBSCRIBE: "bg-accent text-accent-foreground border-accent",
};

function ApiCard({ api, index }: { api: any; index: number }) {
  const [open, setOpen] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-3 w-full text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Server className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-display font-semibold text-sm flex-1">{api.name}</span>
        <Badge variant="outline" className="text-[9px]">
          {api.style || "REST"}
        </Badge>
        {api.owner_component && (
          <Badge variant="secondary" className="text-[9px]">
            {api.owner_component}
          </Badge>
        )}
        <span className="text-[9px] text-muted-foreground font-mono">
          {api.endpoints?.length || 0} ep
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 space-y-2">
              {api.description && (
                <p className="text-xs text-muted-foreground mb-3">{api.description}</p>
              )}
              {api.endpoints?.map((ep: any, j: number) => (
                <div key={j} className="rounded border overflow-hidden">
                  <button
                    onClick={() => setExpandedEndpoint(expandedEndpoint === j ? null : j)}
                    className="flex items-center gap-2 p-2 w-full text-left hover:bg-secondary/30 transition-colors text-xs"
                  >
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border ${METHOD_COLORS[ep.method] || "bg-secondary text-muted-foreground"}`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-foreground flex-1">{ep.path}</span>
                    {ep.auth_required !== undefined &&
                      (ep.auth_required ? (
                        <Lock className="h-3 w-3 text-warning" />
                      ) : (
                        <Unlock className="h-3 w-3 text-muted-foreground/40" />
                      ))}
                    {expandedEndpoint === j ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedEndpoint === j && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t bg-secondary/20"
                      >
                        <div className="p-3 space-y-2 text-[11px]">
                          {ep.description && (
                            <p className="text-muted-foreground">{ep.description}</p>
                          )}
                          {ep.request_schema && Object.keys(ep.request_schema).length > 0 && (
                            <div>
                              <p className="font-semibold text-foreground mb-1">Request</p>
                              <pre className="bg-card rounded p-2 font-mono text-[10px] overflow-x-auto border">
                                {JSON.stringify(ep.request_schema, null, 2)}
                              </pre>
                            </div>
                          )}
                          {ep.response_schema && Object.keys(ep.response_schema).length > 0 && (
                            <div>
                              <p className="font-semibold text-foreground mb-1">Response</p>
                              <pre className="bg-card rounded p-2 font-mono text-[10px] overflow-x-auto border">
                                {JSON.stringify(ep.response_schema, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EventCard({ ev, index }: { ev: any; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-3 w-full text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Zap className="h-3.5 w-3.5 text-warning flex-shrink-0" />
        <span className="font-display font-semibold text-sm flex-1">
          {ev.name || "Unnamed event"}
        </span>
        {ev.producer && (
          <Badge variant="outline" className="text-[9px]">
            {ev.producer}
          </Badge>
        )}
        <span className="text-[9px] text-muted-foreground">
          {ev.consumers?.length || 0} consumers
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 text-xs space-y-2">
              {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="text-muted-foreground">Producer:</span>
                <Badge variant="outline" className="text-[9px]">
                  {ev.producer || "—"}
                </Badge>
                <span className="text-muted-foreground ml-2">Consumers:</span>
                {ev.consumers?.length ? (
                  ev.consumers.map((c: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[9px]">
                      {c}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic text-[10px]">none</span>
                )}
              </div>
              {ev.schema && Object.keys(ev.schema).length > 0 && (
                <pre className="bg-secondary/30 rounded p-2 font-mono text-[10px] overflow-x-auto border">
                  {JSON.stringify(ev.schema, null, 2)}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function IntegrationCard({ ip, index }: { ip: any; index: number }) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-3 w-full text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Radio className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="font-display font-semibold text-sm flex-1">
          {ip.name || "Unnamed integration"}
        </span>
        {ip.type && (
          <Badge
            variant={ip.type === "external" ? "destructive" : "outline"}
            className="text-[9px]"
          >
            {ip.type}
          </Badge>
        )}
        {ip.protocol && (
          <Badge variant="secondary" className="text-[9px]">
            {ip.protocol}
          </Badge>
        )}
      </button>
      <AnimatePresence>
        {open && (ip.description || ip.direction) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 text-xs space-y-1">
              {ip.description && <p className="text-muted-foreground">{ip.description}</p>}
              {ip.direction && (
                <p className="text-[11px]">
                  <span className="text-muted-foreground">Direction:</span>{" "}
                  <span className="font-mono">{ip.direction}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function isReviewArtifact(a: any): boolean {
  const title = a.title || "";
  const content = a.content || a.parsedContent;
  const metaType = content?._meta?.type || "";
  return (
    title.startsWith("Evaluator Review:") ||
    title.startsWith("Challenger Review:") ||
    metaType === "evaluator_review" ||
    metaType === "scientific_challenger_review" ||
    !!content?.verdict
  );
}

function isPrimaryApiPayload(content: any): boolean {
  return !!(content?.apis && Array.isArray(content.apis));
}

export default function ApiDesignWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
  onAdvance,
}: Props) {
  const [artifact, setArtifact] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchArtifact = async () => {
    const { data, error } = await supabase
      .from("architecture_artifacts")
      .select("*")
      .eq("project_id", projectId)
      .eq("stage", 8)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ApiDesignWorkspace] fetch error:", error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Parse and recover content for all artifacts
      const parsed = data.map((a) => {
        let content = a.content as any;
        if (content?.parse_error) content = recoverArtifactContent(content) || content;
        return { ...a, parsedContent: content };
      });

      // Find primary API artifact (not evaluator review)
      const primary =
        parsed.find((a) => !isReviewArtifact(a) && isPrimaryApiPayload(a.parsedContent)) ||
        parsed.find((a) => !isReviewArtifact(a) && a.parsedContent) ||
        parsed[0];

      if (primary) {
        setArtifact({ ...primary, content: primary.parsedContent });
        // Stop polling once we have data
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchArtifact();
    // Start polling if no artifact found
    pollingRef.current = setInterval(fetchArtifact, 4000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [projectId, refreshKey]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );

  if (!artifact)
    return (
      <div className="text-center py-12 rounded-lg border border-dashed">
        <Globe className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm mb-1">No API design generated yet.</p>
        <RunStageCTA stageLabel="API Design" onRun={onRunStage} running={stageRunning} />
        <p className="text-[10px] text-muted-foreground/60 mt-2">
          If you already ran the stage, it may still be processing — this panel will update
          automatically.
        </p>
      </div>
    );

  const content = artifact.content;
  const apis = content.apis || [];
  const commPatterns = content.communication_patterns || [];
  const events = content.event_contracts || [];
  const integrations = content.integration_points || [];
  const diagrams = extractMermaidDiagrams(content);

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[8]} title="API & Integration Design" />
      {content.summary && (
        <div className="bg-primary/5 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <DensityText compactLength={200}>{content.summary}</DensityText>
          </p>
        </div>
      )}

      {diagrams.length > 0 && (
        <div className="space-y-3">
          {diagrams.map((d, i) => (
            <MermaidDiagram key={i} code={d.code} title={d.title} type={d.type} />
          ))}
        </div>
      )}

      <Tabs defaultValue="apis" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="apis" className="text-xs gap-1.5">
            <Server className="h-3 w-3" />
            APIs ({apis.length})
          </TabsTrigger>
          <TabsTrigger value="communication" className="text-xs gap-1.5">
            <Workflow className="h-3 w-3" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs gap-1.5">
            <Zap className="h-3 w-3" />
            Events ({events.length})
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1.5">
            <Radio className="h-3 w-3" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="apis" className="space-y-2 mt-4">
          <TabGuide tabId="apis" />
          {apis.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No APIs defined.</p>
          ) : (
            apis.map((api: any, i: number) => <ApiCard key={i} api={api} index={i} />)
          )}
        </TabsContent>

        <TabsContent value="communication" className="space-y-3 mt-4">
          <TabGuide tabId="communication" />
          {commPatterns.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No patterns defined.</p>
          ) : (
            <div className="space-y-1.5">
              {commPatterns.map((cp: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs p-2.5 rounded border hover:bg-secondary/20 transition-colors"
                >
                  <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                    {cp.from}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-foreground bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                    {cp.to}
                  </span>
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {cp.pattern}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px]">
                    {cp.protocol}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-2 mt-4">
          <TabGuide tabId="events" />
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No event contracts defined.</p>
          ) : (
            events.map((ev: any, i: number) => <EventCard key={i} ev={ev} index={i} />)
          )}
        </TabsContent>

        <TabsContent value="integrations" className="space-y-2 mt-4">
          <TabGuide tabId="integrations" />
          {integrations.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No integration points defined.</p>
          ) : (
            integrations.map((ip: any, i: number) => <IntegrationCard key={i} ip={ip} index={i} />)
          )}
        </TabsContent>
      </Tabs>

      <CollapsibleChallengerSection
        projectId={projectId}
        stage={8}
        refreshKey={refreshKey}
        onRunStage={onRunStage}
        stageRunning={stageRunning}
        onAdvance={onAdvance}
      />

      <LockAdvanceBar
        projectId={projectId}
        stage={8}
        refreshKey={refreshKey}
        onAdvance={onAdvance}
        position="bottom"
      />
    </div>
  );
}
