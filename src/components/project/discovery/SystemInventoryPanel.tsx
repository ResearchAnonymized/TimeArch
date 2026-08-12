import { useMemo, useState } from "react";
import { Copy, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import { cn } from "@/lib/utils";
import {
  FEATURE_CATEGORY_LABEL,
  type FeatureCategory,
  type SystemInventory,
} from "@/lib/systemInventory";
import {
  CATEGORY_TONE,
  DiscoveryPanel,
  DiscoveryPanelHeader,
  DiscoveryStat,
} from "./parts/discoveryUi";

interface Props {
  inventory: SystemInventory | null;
  loading?: boolean;
  /** When true, omit outer title (parent already shows Change chrome) */
  embedded?: boolean;
}

type SubView = "table" | "diagram";
type Filter = "all" | FeatureCategory;

const CATEGORY_ORDER: FeatureCategory[] = [
  "functional",
  "interface",
  "non_functional",
  "constraint",
];

/** Current (as-is) features — one professional table. */
export default function SystemInventoryPanel({ inventory, loading, embedded }: Props) {
  const [subView, setSubView] = useState<SubView>("table");
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);

  const features = inventory?.currentFeatures || [];

  const counts = useMemo(() => {
    const map = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<
      FeatureCategory,
      number
    >;
    for (const f of features) map[f.category] = (map[f.category] || 0) + 1;
    return map;
  }, [features]);

  const rows = useMemo(() => {
    const list =
      filter === "all" ? features : features.filter((f) => f.category === filter);
    return [...list].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.title.localeCompare(b.title);
    });
  }, [features, filter]);

  if (loading) {
    return (
      <DiscoveryPanel className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading system…
      </DiscoveryPanel>
    );
  }

  if (!inventory || inventory.components.length === 0) {
    return (
      <DiscoveryPanel className="px-4 py-6 text-sm text-muted-foreground">
        No recovered features yet. Run Recover first.
      </DiscoveryPanel>
    );
  }

  const copyBrief = async () => {
    await navigator.clipboard.writeText(inventory.baselineCodingBrief);
    setCopied(true);
    toast.success("Baseline brief copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBrief = () => {
    const blob = new Blob([inventory.baselineCodingBrief], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inventory.projectName.replace(/[^\w.-]+/g, "_")}_baseline.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewToggle = (
    <div className="flex gap-1">
      {(
        [
          ["table", "Table"],
          ["diagram", "Diagram"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setSubView(id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            subView === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const actions = (
    <>
      {viewToggle}
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void copyBrief()}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={downloadBrief}>
        <Download className="h-3.5 w-3.5" />
      </Button>
    </>
  );

  return (
    <DiscoveryPanel>
      {!embedded && (
        <DiscoveryPanelHeader
          title="Current features"
          meta={<DiscoveryStat label="Total" value={features.length} tone="primary" />}
          actions={actions}
        />
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/80">
          <DiscoveryStat label="Features" value={features.length} tone="primary" />
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {subView === "table" &&
          (features.length === 0 ? (
            <p className="text-sm text-muted-foreground">No features recovered yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filter === "all"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  All · {features.length}
                </button>
                {CATEGORY_ORDER.filter((c) => counts[c] > 0).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilter(cat)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      filter === cat
                        ? CATEGORY_TONE[cat].chip
                        : "border-border text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", CATEGORY_TONE[cat].dot)} />
                    {FEATURE_CATEGORY_LABEL[cat]} · {counts[cat]}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-border/80 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium w-10">#</th>
                      <th className="px-3 py-2.5 font-medium w-28">Type</th>
                      <th className="px-3 py-2.5 font-medium min-w-[9rem]">Feature</th>
                      <th className="px-3 py-2.5 font-medium min-w-[12rem]">Description</th>
                      <th className="px-3 py-2.5 font-medium min-w-[10rem]">How identified</th>
                      <th className="px-3 py-2.5 font-medium min-w-[7rem]">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f, i) => (
                      <tr
                        key={f.id}
                        className="border-b last:border-b-0 hover:bg-primary/[0.03] transition-colors"
                      >
                        <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground align-top">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                              CATEGORY_TONE[f.category].chip,
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", CATEGORY_TONE[f.category].dot)}
                            />
                            {FEATURE_CATEGORY_LABEL[f.category]}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium leading-snug align-top">{f.title}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground leading-relaxed align-top">
                          {f.description}
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground/80 leading-relaxed align-top">
                          {f.identifiedHow || "Recovered during reverse engineering."}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono text-muted-foreground leading-snug align-top">
                          {f.evidence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ))}

        {subView === "diagram" && (
          <MermaidDiagram code={inventory.mermaidAsIs} title="Current system" type="system_context" />
        )}
      </div>
    </DiscoveryPanel>
  );
}
