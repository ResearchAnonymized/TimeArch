/**
 * Reconstruction Review — split "Evidence ↔ Artifact" view.
 *
 * Phase A shell for the brownfield GUI plan (Blueprint / Engineering skin,
 * Split reconstruction, side-by-side As-Is confirmation).
 *
 * Left pane  : uploaded evidence (project_imports rows).
 * Right pane : draft artifacts the reverse-engineer agent back-filled into
 *              architecture stages, each tagged with a confidence chip and
 *              Confirm / Reject actions. Confirm flips status draft → reviewed.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { KIND_META, type ProjectImport } from "@/features/discovery/types";
import { cn } from "@/lib/utils";
import AsIsToBeDialog from "./AsIsToBeDialog";
import StandardsChips from "./StandardsChips";
import DriftBanner from "./DriftBanner";

type Confidence = "low" | "med" | "high";

interface DraftArtifact {
  id: string;
  title: string;
  type: string;
  stage: number;
  status: string;
  content: Record<string, unknown> | null;
  generated_by: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  onClose: () => void;
}

interface ArtifactMeta {
  provenance?: string;
  confidence?: Confidence | number;
  extractor?: string;
  source_import_ids?: string[];
  source_label?: string;
}

function metaOf(a: DraftArtifact): ArtifactMeta {
  const c = (a.content ?? {}) as { _meta?: ArtifactMeta };
  return c._meta ?? {};
}

function inferConfidence(a: DraftArtifact): Confidence {
  const v = metaOf(a).confidence;
  if (typeof v === "number") return v >= 0.75 ? "high" : v >= 0.5 ? "med" : "low";
  if (v === "high" || v === "med" || v === "low") return v;
  return "med";
}

const CONF_STYLE: Record<Confidence, string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  med: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  low: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

export default function ReconstructionReview({ projectId, onClose }: Props) {
  const [imports, setImports] = useState<ProjectImport[]>([]);
  const [artifacts, setArtifacts] = useState<DraftArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [impRes, artRes] = await Promise.all([
      supabase
        .from("project_imports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("architecture_artifacts")
        .select("id,title,type,stage,status,content,generated_by,created_at")
        .eq("project_id", projectId)
        .in("status", ["draft", "generated", "reviewed"])
        .order("stage", { ascending: true }),
    ]);
    if (impRes.error) toast.error(impRes.error.message);
    if (artRes.error) toast.error(artRes.error.message);
    setImports((impRes.data as ProjectImport[]) ?? []);
    // Only show reverse-engineered / brownfield drafts here.
    const rows = ((artRes.data as DraftArtifact[]) ?? []).filter((a) => {
      const m = ((a.content ?? {}) as { _meta?: { provenance?: string } })._meta;
      return (
        m?.provenance === "reverse-engineered" ||
        (a.generated_by ?? "").toLowerCase().includes("reverse")
      );
    });
    setArtifacts(rows);
    setLoading(false);
    if (rows[0] && !selectedId) setSelectedId(rows[0].id);
  }, [projectId, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => artifacts.find((a) => a.id === selectedId) ?? null,
    [artifacts, selectedId],
  );

  const confirm = async (a: DraftArtifact) => {
    setActing(a.id);
    const { error } = await supabase
      .from("architecture_artifacts")
      .update({ status: "reviewed" })
      .eq("id", a.id);
    setActing(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Confirmed: ${a.title}`);
    load();
  };

  const reject = async (a: DraftArtifact) => {
    if (!window.confirm(`Reject "${a.title}"? This deletes the draft.`)) return;
    setActing(a.id);
    const { error } = await supabase.from("architecture_artifacts").delete().eq("id", a.id);
    setActing(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Rejected: ${a.title}`);
    load();
  };

  return (
    <section className="rounded-xl border-2 border-blue-600/30 bg-card shadow-lg animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      {/* Header — blueprint accent */}
      <header className="flex items-center justify-between border-b bg-gradient-to-r from-blue-600/10 via-slate-500/5 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-display text-sm font-bold">Reconstruction review</h3>
          <span className="text-[11px] text-muted-foreground">
            Evidence ↔ reconstructed artifact
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="px-5 pt-4">
        <DriftBanner projectId={projectId} onRescanned={load} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : artifacts.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No reconstructed drafts yet. Run the AI reading step first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] min-h-[420px]">
          {/* Artifact list */}
          <aside className="border-r bg-muted/20 p-2 space-y-1 overflow-y-auto max-h-[560px]">
            <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Reconstructed ({artifacts.length})
            </p>
            {artifacts.map((a) => {
              const conf = inferConfidence(a);
              const active = a.id === selectedId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2 py-2 text-xs transition-colors border border-transparent",
                    active
                      ? "bg-blue-600/10 border-blue-600/40"
                      : "hover:bg-muted hover:border-border",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400">
                      S{a.stage}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border",
                        CONF_STYLE[conf],
                      )}
                    >
                      {conf}
                    </span>
                    {a.status === "reviewed" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 ml-auto" />
                    )}
                    {active && a.status !== "reviewed" && (
                      <ChevronRight className="h-3 w-3 ml-auto text-blue-600" />
                    )}
                  </div>
                  <p className="font-medium leading-tight line-clamp-2">{a.title}</p>
                </button>
              );
            })}
          </aside>

          {/* Evidence pane */}
          <div className="border-r p-4 overflow-y-auto max-h-[560px]">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Evidence
              </p>
            </div>
            {imports.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No source files.</p>
            )}
            <ul className="space-y-1.5">
              {imports.map((i) => {
                const kmeta = KIND_META[i.kind];
                const Icon = kmeta.icon;
                const linkedIds = selected ? metaOf(selected).source_import_ids ?? [] : [];
                const isLinked = linkedIds.includes(i.id);
                return (
                  <li
                    key={i.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-2.5 py-2 transition-colors",
                      isLinked
                        ? "border-blue-600/60 bg-blue-600/10 ring-1 ring-blue-600/30"
                        : "border-border bg-background/60",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 mt-0.5 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{i.source_label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {kmeta.label}
                        {isLinked && " · linked to selected"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] uppercase",
                        i.status === "parsed" && "border-emerald-500/40 text-emerald-700",
                        i.status === "pending" && "border-blue-500/40 text-blue-700",
                        i.status === "failed" && "border-red-500/40 text-red-700",
                      )}
                    >
                      {i.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[10px] text-muted-foreground italic">
              Provenance: draft artifacts are back-filled from these files by the
              reverse-engineer agent. Confirm on the right to lock into the stage.
            </p>
          </div>

          {/* Artifact detail pane */}
          <div className="p-4 overflow-y-auto max-h-[560px]">
            {!selected ? (
              <p className="text-xs text-muted-foreground italic">
                Select a reconstructed artifact.
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-600/30">
                        Stage {selected.stage}
                      </span>
                      {(() => {
                        const c = inferConfidence(selected);
                        const Ico = c === "high" ? ShieldCheck : ShieldAlert;
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border",
                              CONF_STYLE[c],
                            )}
                          >
                            <Ico className="h-3 w-3" /> {c} confidence
                          </span>
                        );
                      })()}
                    </div>
                    <h4 className="font-display text-sm font-bold leading-tight">
                      {selected.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {selected.type} · extractor: {metaOf(selected).extractor ?? "heuristic"}
                    </p>
                    <StandardsChips stage={selected.stage} className="mt-1.5" />
                  </div>
                </div>

                <pre className="text-[10.5px] leading-relaxed bg-muted/40 border rounded-md p-3 max-h-[300px] overflow-auto font-mono">
                  {JSON.stringify(selected.content ?? {}, null, 2)}
                </pre>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompareOpen(true)}
                    className="border-blue-600/40 text-blue-700 dark:text-blue-300 hover:bg-blue-600/10"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Compare As-Is vs To-Be
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reject(selected)}
                    disabled={acting === selected.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => confirm(selected)}
                    disabled={acting === selected.id || selected.status === "reviewed"}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {acting === selected.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {selected.status === "reviewed" ? "Confirmed" : "Confirm"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <AsIsToBeDialog
        projectId={projectId}
        asIs={selected}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
    </section>
  );
}
