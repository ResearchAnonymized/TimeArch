import { useEffect, useMemo, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ArrowRight,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Code2,
  Database,
  Boxes,
  Filter,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import StageIntro from "../StageIntro";
import SystemDispositionPanel from "./SystemDispositionPanel";

interface Props {
  projectId: string;
  onJumpToStage?: (stage: number) => void;
}

type OriginType = "openapi_endpoint" | "db_table" | "repo_component" | "other";

interface Origin {
  type?: OriginType;
  method?: string;
  path?: string;
  summary?: string | null;
  tags?: string[];
  api_title?: string;
  table?: string;
  columns?: string[];
  column_count?: number;
  name?: string;
  kind?: string;
  language?: string | null;
}

interface ReqRow {
  id: string;
  requirement_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  source: string | null;
  acceptance_criteria: any;
}

const ORIGIN_META: Record<string, { label: string; icon: typeof Code2; tone: string }> = {
  openapi_endpoint: {
    label: "OpenAPI endpoint",
    icon: Code2,
    tone: "text-sky-500 bg-sky-500/10 border-sky-500/30",
  },
  db_table: {
    label: "DB table",
    icon: Database,
    tone: "text-violet-500 bg-violet-500/10 border-violet-500/30",
  },
  repo_component: {
    label: "Repo component",
    icon: Boxes,
    tone: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  other: {
    label: "Other source",
    icon: FileText,
    tone: "text-muted-foreground bg-muted/30 border-border",
  },
};

function getOrigin(r: ReqRow): Origin | null {
  return r.acceptance_criteria?._meta?.origin ?? null;
}
function getSourceLabel(r: ReqRow): string | null {
  return (
    r.acceptance_criteria?._meta?.source_label ??
    (r.source?.startsWith("reverse-engineered:")
      ? r.source.slice("reverse-engineered:".length)
      : null)
  );
}
function originType(r: ReqRow): OriginType {
  const t = getOrigin(r)?.type;
  if (t === "openapi_endpoint" || t === "db_table" || t === "repo_component") return t;
  return "other";
}

export default function BrownfieldRequirementsView({ projectId, onJumpToStage }: Props) {
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | OriginType>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("requirements")
      .select(
        "id, requirement_id, title, description, type, priority, status, source, acceptance_criteria",
      )
      .eq("project_id", projectId)
      .order("requirement_id");
    setReqs((data as ReqRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const draftReverseIds = useMemo(
    () =>
      reqs
        .filter((r) => r.status === "draft" && r.source?.startsWith("reverse-engineered:"))
        .map((r) => r.id),
    [reqs],
  );

  const handleBulkConfirm = async () => {
    if (!draftReverseIds.length) return;
    setConfirming(true);
    const { error, count } = await supabase
      .from("requirements")
      .update({ status: "locked" }, { count: "exact" })
      .in("id", draftReverseIds);
    setConfirming(false);
    if (error) {
      toast.error(`Could not confirm requirements: ${error.message}`);
      return;
    }
    toast.success(`Confirmed ${count ?? draftReverseIds.length} reverse-engineered requirement(s)`);
    await load();
  };


  const draftCount = reqs.filter((r) => r.status === "draft").length;
  const approvedCount = reqs.filter((r) => r.status === "approved" || r.status === "locked").length;

  const counts = useMemo(() => {
    const c = { openapi_endpoint: 0, db_table: 0, repo_component: 0, other: 0 } as Record<
      OriginType,
      number
    >;
    for (const r of reqs) c[originType(r)]++;
    return c;
  }, [reqs]);

  const filtered = filter === "all" ? reqs : reqs.filter((r) => originType(r) === filter);

  return (
    <div className="space-y-6">
      <StageIntro
        title="Requirements (Reverse-Engineered)"
        description="In brownfield mode, your Stage 1 requirements are derived from the source files imported during Discovery. Each item shows the exact endpoint, table, or component it came from."
        whatYouCanDo={[
          "Inspect provenance for every reverse-engineered requirement",
          "Filter by source type (API, data, repository)",
          "Confirm or refine items, then lock the set to advance to Stage 2",
        ]}
        mode="hybrid"
      />

      <SystemDispositionPanel projectId={projectId} />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold tabular-nums">{reqs.length}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Total Requirements</p>
        </div>
        <div className="rounded-xl border bg-success/5 border-success/20 p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-success">{approvedCount}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Confirmed</p>
        </div>
        <div className="rounded-xl border bg-warning/5 border-warning/20 p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-warning">{draftCount}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Needs Review</p>
        </div>
      </div>

      {draftReverseIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-foreground">
                {draftReverseIds.length} reverse-engineered requirement{draftReverseIds.length === 1 ? "" : "s"} awaiting confirmation
              </p>
              <p className="text-muted-foreground mt-0.5">
                Downstream agents (Stage 4+) only see confirmed requirements. Bulk-confirm to unblock the pipeline.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={confirming}>
                {confirming ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Confirm all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm reverse-engineered requirements?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will lock {draftReverseIds.length} draft requirement{draftReverseIds.length === 1 ? "" : "s"} that
                  were derived from your imported sources. Locked requirements become visible to the downstream
                  Stage 4+ agents but can still be re-opened individually if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkConfirm}>
                  Confirm {draftReverseIds.length}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}


      {/* Provenance filter strip */}
      {reqs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5" /> Provenance
          </span>
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`All (${reqs.length})`}
          />
          {(["openapi_endpoint", "db_table", "repo_component", "other"] as OriginType[]).map(
            (t) => {
              if (counts[t] === 0) return null;
              const meta = ORIGIN_META[t];
              const Icon = meta.icon;
              return (
                <FilterChip
                  key={t}
                  active={filter === t}
                  onClick={() => setFilter(t)}
                  label={`${meta.label} (${counts[t]})`}
                  icon={<Icon className="h-3 w-3" />}
                />
              );
            },
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading requirements…
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 rounded-xl border border-dashed border-border/60 bg-card/30"
        >
          <div className="h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-warning/60" />
          </div>
          <p className="text-sm font-medium mb-1.5">
            {reqs.length === 0
              ? "No reverse-engineered requirements yet"
              : "No requirements match this filter"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {reqs.length === 0
              ? "Go back to Discovery and run the source extraction to populate this list."
              : "Try a different provenance filter."}
          </p>
          {reqs.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => onJumpToStage?.(0)}>
              Go to Discovery <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => {
            const origin = getOrigin(r);
            const t = originType(r);
            const meta = ORIGIN_META[t];
            const Icon = meta.icon;
            const isOpen = !!expanded[r.id];
            const sourceLabel = getSourceLabel(r);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                className="rounded-lg border bg-card hover:bg-accent/20 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                  className="w-full text-left p-3 flex items-start gap-3"
                >
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {r.requirement_id}
                      </span>
                      <Badge variant="outline" className="text-[9px]">
                        {r.type}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {r.priority}
                      </Badge>
                      <Badge
                        className={`text-[9px] border ${
                          r.status === "approved" || r.status === "locked"
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-warning/10 text-warning border-warning/30"
                        }`}
                      >
                        {r.status}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${meta.tone}`}
                      >
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {r.description}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground mt-1 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden border-t bg-muted/20"
                    >
                      <ProvenanceDetails origin={origin} sourceLabel={sourceLabel} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-accent border-border text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProvenanceDetails({
  origin,
  sourceLabel,
}: {
  origin: Origin | null;
  sourceLabel: string | null;
}) {
  if (!origin) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No structured provenance metadata recorded.
        {sourceLabel && (
          <>
            {" "}
            Imported from <span className="font-mono text-foreground">{sourceLabel}</span>.
          </>
        )}{" "}
        Re-run the source extraction from Discovery to capture details.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5">
        {sourceLabel && (
          <Row label="Source file" value={<span className="font-mono">{sourceLabel}</span>} />
        )}

        {origin.type === "openapi_endpoint" && (
          <>
            {origin.api_title && <Row label="API" value={origin.api_title} />}
            <Row
              label="Method"
              value={<span className="font-mono font-semibold uppercase">{origin.method}</span>}
            />
            <Row label="Path" value={<span className="font-mono">{origin.path}</span>} />
            {origin.summary && <Row label="Summary" value={origin.summary} />}
            {origin.tags && origin.tags.length > 0 && (
              <Row
                label="Tags"
                value={
                  <div className="flex flex-wrap gap-1">
                    {origin.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[9px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                }
              />
            )}
          </>
        )}

        {origin.type === "db_table" && (
          <>
            <Row label="Table" value={<span className="font-mono">{origin.table}</span>} />
            <Row
              label="Columns"
              value={`${origin.column_count ?? origin.columns?.length ?? 0} total`}
            />
            {origin.columns && origin.columns.length > 0 && (
              <Row
                label="Sample columns"
                value={
                  <div className="flex flex-wrap gap-1">
                    {origin.columns.slice(0, 12).map((c) => (
                      <span
                        key={c}
                        className="rounded bg-background border px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {c}
                      </span>
                    ))}
                    {origin.columns.length > 12 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{origin.columns.length - 12} more
                      </span>
                    )}
                  </div>
                }
              />
            )}
          </>
        )}

        {origin.type === "repo_component" && (
          <>
            <Row label="Component" value={<span className="font-mono">{origin.name}</span>} />
            <Row label="Path" value={<span className="font-mono break-all">{origin.path}</span>} />
            <Row label="Kind" value={origin.kind} />
            {origin.language && <Row label="Language" value={origin.language} />}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </>
  );
}
