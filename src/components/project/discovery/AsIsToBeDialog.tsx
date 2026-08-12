/**
 * As-Is vs To-Be compare dialog.
 *
 * Sprint 3 of the brownfield GUI plan. Given a confirmed As-Is artifact
 * (reverse-engineered, status = reviewed/approved/locked), find the newest
 * non-brownfield To-Be artifact for the same stage/type and render them
 * side-by-side in the Blueprint skin with a structural JSON-path diff and
 * suggested 7R modernization action chips.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Artifact {
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
  asIs: Artifact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** 7R vocabulary chips (Gartner / AWS migration playbook). */
const R7 = [
  { code: "Retain", tone: "slate" },
  { code: "Rehost", tone: "blue" },
  { code: "Replatform", tone: "blue" },
  { code: "Refactor", tone: "emerald" },
  { code: "Repurchase", tone: "violet" },
  { code: "Retire", tone: "red" },
  { code: "Relocate", tone: "amber" },
] as const;

const TONE: Record<string, string> = {
  slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

/** Flatten nested object into dotted-path leaves for diffing. */
function flatten(obj: unknown, prefix = "", out: Record<string, unknown> = {}) {
  if (obj === null || typeof obj !== "object") {
    out[prefix || "$"] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "_meta") continue;
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

interface DiffRow {
  path: string;
  asIs: unknown;
  toBe: unknown;
  kind: "added" | "removed" | "changed";
}

function diff(a: unknown, b: unknown): DiffRow[] {
  const fa = flatten(a);
  const fb = flatten(b);
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const rows: DiffRow[] = [];
  keys.forEach((k) => {
    const inA = k in fa;
    const inB = k in fb;
    if (inA && !inB) rows.push({ path: k, asIs: fa[k], toBe: undefined, kind: "removed" });
    else if (!inA && inB) rows.push({ path: k, asIs: undefined, toBe: fb[k], kind: "added" });
    else if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k]))
      rows.push({ path: k, asIs: fa[k], toBe: fb[k], kind: "changed" });
  });
  return rows.slice(0, 200);
}

export default function AsIsToBeDialog({ projectId, asIs, open, onOpenChange }: Props) {
  const [toBe, setToBe] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !asIs) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setToBe(null);
      const { data } = await supabase
        .from("architecture_artifacts")
        .select("id,title,type,stage,status,content,generated_by,created_at")
        .eq("project_id", projectId)
        .eq("stage", asIs.stage)
        .eq("type", asIs.type as never)
        .neq("id", asIs.id)
        .order("created_at", { ascending: false })
        .limit(10);
      const candidates = (data as Artifact[] | null) ?? [];
      const target =
        candidates.find((c) => {
          const m = ((c.content ?? {}) as { _meta?: { provenance?: string } })._meta;
          return m?.provenance !== "reverse-engineered";
        }) ?? candidates[0] ?? null;
      if (!cancelled) {
        setToBe(target);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, asIs, projectId]);

  const rows = useMemo(
    () => (asIs && toBe ? diff(asIs.content, toBe.content) : []),
    [asIs, toBe],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="flex items-center gap-2 font-display">
            <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            As-Is vs To-Be
            {asIs && (
              <span className="text-xs font-normal text-muted-foreground">
                · Stage {asIs.stage} · {asIs.type}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading To-Be…
          </div>
        ) : !asIs ? (
          <p className="p-8 text-sm text-muted-foreground">No As-Is artifact selected.</p>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 7R action strip */}
            <div className="border-b p-3 bg-gradient-to-r from-blue-600/5 to-transparent">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Modernization action (7R vocabulary)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {R7.map((r) => (
                  <span
                    key={r.code}
                    className={cn(
                      "text-[10px] font-semibold uppercase px-2 py-0.5 rounded border",
                      TONE[r.tone],
                    )}
                  >
                    {r.code}
                  </span>
                ))}
              </div>
            </div>

            {/* Side-by-side headers */}
            <div className="grid grid-cols-2 border-b">
              <div className="border-r p-3">
                <Badge
                  variant="outline"
                  className="border-slate-500/40 text-slate-700 dark:text-slate-300 mb-1"
                >
                  AS-IS · reverse-engineered
                </Badge>
                <p className="text-sm font-medium truncate">{asIs.title}</p>
              </div>
              <div className="p-3">
                <Badge
                  variant="outline"
                  className="border-blue-600/50 text-blue-700 dark:text-blue-300 mb-1"
                >
                  TO-BE · target
                </Badge>
                <p className="text-sm font-medium truncate">
                  {toBe?.title ?? "No To-Be artifact for this stage yet"}
                </p>
              </div>
            </div>

            {/* Diff table */}
            <div className="flex-1 overflow-auto">
              {!toBe ? (
                <p className="p-8 text-xs text-muted-foreground italic text-center">
                  Generate a To-Be artifact for Stage {asIs.stage} to enable comparison.
                </p>
              ) : rows.length === 0 ? (
                <p className="p-8 text-xs text-muted-foreground italic text-center">
                  Structurally identical — no differences.
                </p>
              ) : (
                <table className="w-full text-[11px] font-mono">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="border-b">
                      <th className="text-left px-3 py-1.5 w-16">Δ</th>
                      <th className="text-left px-3 py-1.5">Path</th>
                      <th className="text-left px-3 py-1.5 border-l">As-Is</th>
                      <th className="text-left px-3 py-1.5 border-l">To-Be</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-1.5">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                              r.kind === "added" && "bg-emerald-500/15 text-emerald-700",
                              r.kind === "removed" && "bg-red-500/15 text-red-700",
                              r.kind === "changed" && "bg-blue-500/15 text-blue-700",
                            )}
                          >
                            {r.kind}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[280px]">
                          {r.path}
                        </td>
                        <td className="px-3 py-1.5 border-l max-w-[240px] truncate">
                          {r.asIs === undefined ? (
                            <em className="text-muted-foreground">—</em>
                          ) : (
                            JSON.stringify(r.asIs)
                          )}
                        </td>
                        <td className="px-3 py-1.5 border-l max-w-[240px] truncate">
                          {r.toBe === undefined ? (
                            <em className="text-muted-foreground">—</em>
                          ) : (
                            JSON.stringify(r.toBe)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
