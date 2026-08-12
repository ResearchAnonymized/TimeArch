/**
 * Evidence Graph — SVG visualisation linking uploaded evidence
 * (project_imports) to the reconstructed artifacts derived from it
 * (architecture_artifacts with _meta.source_import_ids).
 *
 * Blueprint / Engineering skin. Zoom, pan, click-to-focus, confidence filter.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Network, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { KIND_META, type ProjectImport } from "@/features/discovery/types";
import { cn } from "@/lib/utils";

type Confidence = "low" | "med" | "high";

interface Artifact {
  id: string;
  title: string;
  stage: number;
  status: string;
  content: Record<string, unknown> | null;
}

interface Props {
  projectId: string;
}

function confidenceOf(a: Artifact): Confidence {
  const v = (a.content as any)?._meta?.confidence;
  if (typeof v === "number") return v >= 0.75 ? "high" : v >= 0.5 ? "med" : "low";
  if (v === "high" || v === "med" || v === "low") return v;
  return "med";
}

const CONF_COLOR: Record<Confidence, string> = {
  high: "hsl(160 84% 39%)",
  med: "hsl(217 91% 60%)",
  low: "hsl(38 92% 50%)",
};

export default function EvidenceGraphView({ projectId }: Props) {
  const [imports, setImports] = useState<ProjectImport[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [confFilter, setConfFilter] = useState<Record<Confidence, boolean>>({
    low: true,
    med: true,
    high: true,
  });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [i, a] = await Promise.all([
        supabase.from("project_imports").select("*").eq("project_id", projectId),
        supabase
          .from("architecture_artifacts")
          .select("id,title,stage,status,content")
          .eq("project_id", projectId),
      ]);
      const importsData = (i.data as ProjectImport[]) ?? [];
      setImports(importsData);
      // Older reverse-engineered rows only stored `source_label` / `source_kind`
      // on `_meta`, not `source_import_ids`. Back-fill the link in-memory so the
      // graph works retroactively.
      const labelIndex = new Map<string, string>();
      importsData.forEach((imp) => labelIndex.set(`${imp.kind}|${imp.source_label}`.toLowerCase(), imp.id));
      const arts = ((a.data as Artifact[]) ?? [])
        .map((x) => {
          const meta = (x.content as any)?._meta ?? {};
          const ids: string[] = Array.isArray(meta.source_import_ids) ? [...meta.source_import_ids] : [];
          if (ids.length === 0 && meta.source_label && meta.source_kind) {
            const key = `${meta.source_kind}|${meta.source_label}`.toLowerCase();
            const matched = labelIndex.get(key);
            if (matched) ids.push(matched);
          }
          if (ids.length === 0) return null;
          return { ...x, content: { ...(x.content as any), _meta: { ...meta, source_import_ids: ids } } };
        })
        .filter((x): x is Artifact => !!x);
      setArtifacts(arts);
      setLoading(false);
    })();
  }, [projectId]);


  const filtered = useMemo(
    () => artifacts.filter((a) => confFilter[confidenceOf(a)]),
    [artifacts, confFilter],
  );

  const layout = useMemo(() => {
    const width = 720;
    const leftX = 60;
    const rightX = width - 60;
    const rowH = 44;
    const linkedImportIds = new Set<string>();
    filtered.forEach((a) => {
      const meta = (a.content as any)?._meta;
      (meta?.source_import_ids ?? []).forEach((id: string) => linkedImportIds.add(id));
    });
    const visibleImports = imports.filter((i) => linkedImportIds.has(i.id));
    const impNodes = visibleImports.map((imp, idx) => ({ id: imp.id, x: leftX, y: 40 + idx * rowH, imp }));
    const artNodes = filtered.map((a, idx) => ({
      id: a.id,
      x: rightX,
      y: 40 + idx * rowH,
      art: a,
      conf: confidenceOf(a),
    }));
    const focusIds = focusId
      ? new Set<string>([
          focusId,
          ...(((filtered.find((a) => a.id === focusId)?.content as any)?._meta?.source_import_ids ??
            []) as string[]),
        ])
      : null;
    const edges: {
      x1: number; y1: number; x2: number; y2: number; key: string; color: string; dim: boolean;
    }[] = [];
    artNodes.forEach((an) => {
      const meta = (an.art.content as any)?._meta;
      (meta?.source_import_ids ?? []).forEach((impId: string) => {
        const src = impNodes.find((n) => n.id === impId);
        if (src) {
          const focused = focusIds ? focusIds.has(an.id) : true;
          edges.push({
            x1: src.x + 10,
            y1: src.y,
            x2: an.x - 10,
            y2: an.y,
            key: `${src.id}->${an.id}`,
            color: CONF_COLOR[an.conf],
            dim: !focused,
          });
        }
      });
    });
    const height = Math.max(impNodes.length, artNodes.length, 3) * rowH + 60;
    return { width, height, impNodes, artNodes, edges, focusIds };
  }, [imports, filtered, focusId]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(3, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };
  const endDrag = () => (dragRef.current = null);

  return (
    <section className="rounded-xl border-2 border-blue-600/30 bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b bg-gradient-to-r from-blue-600/10 via-slate-500/5 to-transparent px-5 py-3">
        <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h3 className="font-display text-sm font-bold">Evidence graph</h3>
        <span className="text-[11px] text-muted-foreground">
          {imports.length} sources · {filtered.length}/{artifacts.length} linked artifacts
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(["high", "med", "low"] as Confidence[]).map((c) => (
            <button
              key={c}
              onClick={() => setConfFilter((f) => ({ ...f, [c]: !f[c] }))}
              className={cn(
                "text-[10px] uppercase font-semibold px-2 py-1 rounded border transition",
                confFilter[c] ? "opacity-100" : "opacity-40",
              )}
              style={{ borderColor: CONF_COLOR[c], color: CONF_COLOR[c] }}
            >
              {c}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setFocusId(null); }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : layout.edges.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No provenance links match the current filter.
        </div>
      ) : (
        <div
          className="p-4 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {focusId && (
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">Focused</Badge>
              <button
                className="text-[10px] text-blue-600 hover:underline"
                onClick={() => setFocusId(null)}
              >
                Clear focus
              </button>
            </div>
          )}
          <svg
            width={layout.width}
            height={layout.height}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
            className="min-w-[720px]"
          >
            <defs>
              <marker id="arr-eg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(217 91% 60%)" />
              </marker>
            </defs>
            <text x={60} y={20} className="fill-slate-500 text-[10px] uppercase font-semibold">Evidence</text>
            <text x={layout.width - 60} y={20} textAnchor="end" className="fill-slate-500 text-[10px] uppercase font-semibold">Reconstructed artifact</text>
            {layout.edges.map((e) => (
              <path
                key={e.key}
                d={`M ${e.x1} ${e.y1} C ${(e.x1 + e.x2) / 2} ${e.y1}, ${(e.x1 + e.x2) / 2} ${e.y2}, ${e.x2} ${e.y2}`}
                stroke={e.color}
                strokeOpacity={e.dim ? 0.15 : 0.7}
                strokeWidth={e.dim ? 1 : 1.8}
                fill="none"
                markerEnd="url(#arr-eg)"
              />
            ))}
            {layout.impNodes.map((n) => {
              const meta = KIND_META[n.imp.kind];
              const dim = layout.focusIds && !layout.focusIds.has(n.id);
              return (
                <g key={n.id} style={{ opacity: dim ? 0.3 : 1 }}>
                  <rect x={n.x - 10} y={n.y - 14} width={220} height={28} rx={4} className="fill-blue-500/10 stroke-blue-500/40" strokeWidth={1} />
                  <text x={n.x + 4} y={n.y + 4} className="fill-foreground text-[11px] font-medium">
                    {meta.label}: {n.imp.source_label.length > 22 ? n.imp.source_label.slice(0, 22) + "…" : n.imp.source_label}
                  </text>
                </g>
              );
            })}
            {layout.artNodes.map((n) => {
              const dim = layout.focusIds && !layout.focusIds.has(n.id);
              return (
                <g
                  key={n.id}
                  style={{ opacity: dim ? 0.3 : 1, cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setFocusId(n.id === focusId ? null : n.id); }}
                >
                  <rect
                    x={n.x - 210}
                    y={n.y - 14}
                    width={220}
                    height={28}
                    rx={4}
                    className="stroke-slate-500/40"
                    fill={n.id === focusId ? CONF_COLOR[n.conf] + "22" : "hsl(215 20% 65% / 0.1)"}
                    strokeWidth={n.id === focusId ? 2 : 1}
                    stroke={n.id === focusId ? CONF_COLOR[n.conf] : undefined}
                  />
                  <circle cx={n.x - 200} cy={n.y} r={3.5} fill={CONF_COLOR[n.conf]} />
                  <text x={n.x - 192} y={n.y + 4} className="fill-foreground text-[11px] font-medium">
                    S{n.art.stage} · {n.art.title.length > 22 ? n.art.title.slice(0, 22) + "…" : n.art.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
