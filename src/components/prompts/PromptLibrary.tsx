import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  FileText,
  Loader2,
  Info,
  Copy,
  Check,
  ClipboardList,
  Layers,
  ShieldCheck,
  Rocket,
  Sparkles,
  Pencil,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PromptCatalogItem {
  key: string;
  title: string;
  category: string;
  description: string;
  source: string;
  defaultContent: string;
  currentContent: string;
  hasOverride: boolean;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  tags?: string[];
}

interface PromptLibraryProps {
  embedded?: boolean;
  isAdmin?: boolean;
  onEdit?: (item: PromptCatalogItem) => void;
}

type PhaseMeta = {
  key: string;
  label: string;
  short: string;
  icon: typeof ClipboardList;
  accent: string; // tailwind classes for chip / dot
  tint: string;   // panel tint
  ring: string;   // active row tint
};

const PHASE_ORDER = [
  "Phase 1 — Requirements Engineering",
  "Phase 2 — Architecture Design",
  "Phase 3 — Quality & Validation",
  "Phase 4 — Delivery & Evolution",
  "Cross-Phase — Challenger Agents",
  "Cross-Phase — Editing & Refinement",
];

const PHASE_META: Record<string, PhaseMeta> = {
  "Phase 1 — Requirements Engineering": {
    key: "p1",
    label: "Phase 1 — Requirements Engineering",
    short: "Requirements",
    icon: ClipboardList,
    accent: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
    tint: "from-sky-500/8 to-transparent",
    ring: "bg-sky-500/10 border-l-sky-500",
  },
  "Phase 2 — Architecture Design": {
    key: "p2",
    label: "Phase 2 — Architecture Design",
    short: "Design",
    icon: Layers,
    accent: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
    tint: "from-violet-500/8 to-transparent",
    ring: "bg-violet-500/10 border-l-violet-500",
  },
  "Phase 3 — Quality & Validation": {
    key: "p3",
    label: "Phase 3 — Quality & Validation",
    short: "Validation",
    icon: ShieldCheck,
    accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    tint: "from-emerald-500/8 to-transparent",
    ring: "bg-emerald-500/10 border-l-emerald-500",
  },
  "Phase 4 — Delivery & Evolution": {
    key: "p4",
    label: "Phase 4 — Delivery & Evolution",
    short: "Delivery",
    icon: Rocket,
    accent: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    tint: "from-amber-500/8 to-transparent",
    ring: "bg-amber-500/10 border-l-amber-500",
  },
  "Cross-Phase — Challenger Agents": {
    key: "cx1",
    label: "Cross-Phase — Challenger Agents",
    short: "Challengers",
    icon: Sparkles,
    accent: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30",
    tint: "from-rose-500/8 to-transparent",
    ring: "bg-rose-500/10 border-l-rose-500",
  },
  "Cross-Phase — Editing & Refinement": {
    key: "cx2",
    label: "Cross-Phase — Editing & Refinement",
    short: "Refinement",
    icon: Pencil,
    accent: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
    tint: "from-slate-500/8 to-transparent",
    ring: "bg-slate-500/10 border-l-slate-500",
  },
};

const FALLBACK_META: PhaseMeta = {
  key: "other",
  label: "Other",
  short: "Other",
  icon: FileText,
  accent: "bg-muted text-muted-foreground border-border",
  tint: "from-muted/30 to-transparent",
  ring: "bg-muted/40 border-l-muted-foreground",
};

export default function PromptLibrary({ embedded, isAdmin, onEdit }: PromptLibraryProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PromptCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<string>("all");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await callAuthenticatedFunction<{ prompts?: PromptCatalogItem[]; error?: string }>(
        "list-prompts",
        {},
      );
      if (res?.error) throw new Error(res.error);
      const list = res?.prompts ?? [];
      setItems(list);
      setActiveKey((prev) => prev ?? list[0]?.key ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("prompts:reload", handler);
    return () => window.removeEventListener("prompts:reload", handler);
  }, []);

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of items) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, [items]);

  // Tag taxonomy. We bucket tags into meaningful groups and hide noisy ones
  // (per-stage + lifecycle-agent are already conveyed by the list/phase chips).
  const TAG_HIDDEN = (t: string) => /^stage-\d+$/.test(t) || t === "lifecycle-agent";
  const TAG_GROUPS: { key: string; label: string; match: (t: string) => boolean }[] = [
    {
      key: "standards",
      label: "Standards",
      match: (t) =>
        /^iso-/.test(t) || t === "incose" || t === "aws-wa",
    },
    {
      key: "methods",
      label: "Methods",
      match: (t) =>
        ["atam", "c4", "ddd", "quality-scenarios", "reference-architecture", "scientific"].includes(t),
    },
    {
      key: "capabilities",
      label: "Capabilities",
      match: (t) =>
        ["extraction", "validation", "verification", "review", "critic", "challenger",
         "refinement", "editing", "generation", "handoff", "intake", "gap-analysis",
         "discovery", "acceptance", "fallback"].includes(t),
    },
    {
      key: "topics",
      label: "Topics",
      match: () => true, // catch-all
    },
  ];

  // Tag inventory with counts. Reflects the current phase so the chip set
  // narrows as users drill in. Ignores tag selection so they can always add
  // another tag to the filter.
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of items) {
      if (activePhase !== "all" && p.category !== activePhase) continue;
      for (const t of p.tags ?? []) {
        if (TAG_HIDDEN(t)) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [items, activePhase]);

  const groupedTags = useMemo(() => {
    const result: { key: string; label: string; tags: [string, number][] }[] = TAG_GROUPS.map(
      (g) => ({ key: g.key, label: g.label, tags: [] }),
    );
    for (const [tag, count] of tagCounts) {
      const group = TAG_GROUPS.find((g) => g.match(tag))!;
      const target = result.find((r) => r.key === group.key)!;
      target.tags.push([tag, count]);
    }
    return result.filter((g) => g.tags.length > 0);
  }, [tagCounts]);

  const [showAllTags, setShowAllTags] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tags = Array.from(activeTags);
    return items.filter((p) => {
      if (activePhase !== "all" && p.category !== activePhase) return false;
      if (tags.length > 0) {
        const pt = new Set(p.tags ?? []);
        if (!tags.every((t) => pt.has(t))) return false;
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, search, activePhase, activeTags]);

  const groups = useMemo(() => {
    const byCat = new Map<string, PromptCatalogItem[]>();
    for (const p of filtered) {
      if (!byCat.has(p.category)) byCat.set(p.category, []);
      byCat.get(p.category)!.push(p);
    }
    return Array.from(byCat.entries()).sort(([a], [b]) => {
      const ai = PHASE_ORDER.indexOf(a);
      const bi = PHASE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  const active = items.find((p) => p.key === activeKey) ?? null;
  const activeMeta = active ? PHASE_META[active.category] ?? FALLBACK_META : FALLBACK_META;

  const copy = async () => {
    if (!active) return;
    await navigator.clipboard.writeText(active.currentContent || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const containerClass = embedded
    ? "flex h-[calc(100vh-140px)] gap-4"
    : "flex h-screen bg-background";

  return (
    <div className={containerClass}>
      {!embedded && (
        <aside className="w-72 border-r bg-card p-4 flex flex-col">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start mb-3"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="font-display text-lg font-bold mb-1">Prompt Library</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Every system prompt driving a TimeArch agent, grouped by lifecycle phase.
          </p>
        </aside>
      )}

      <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden">
        {/* Phase filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActivePhase("all")}
            className={cn(
              "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors",
              activePhase === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted border-border text-muted-foreground",
            )}
          >
            All <span className="opacity-70 ml-1">{items.length}</span>
          </button>
          {PHASE_ORDER.filter((p) => phaseCounts[p]).map((p) => {
            const meta = PHASE_META[p] ?? FALLBACK_META;
            const Icon = meta.icon;
            const active = activePhase === p;
            return (
              <button
                key={p}
                onClick={() => setActivePhase(p)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] font-medium border inline-flex items-center gap-1.5 transition-colors",
                  active ? meta.accent : "bg-card hover:bg-muted border-border text-muted-foreground",
                )}
                title={meta.label}
              >
                <Icon className="h-3 w-3" />
                {meta.short}
                <span className="opacity-70">{phaseCounts[p]}</span>
              </button>
            );
          })}

          <div className="ml-auto relative w-56">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Feature-tag filter — collapsed by default to give more room to the prompt */}
        {groupedTags.length > 0 && (
          <div className="rounded-md border bg-muted/20">
            <button
              onClick={() => setTagsOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <span className="font-medium uppercase tracking-wider text-[10px]">
                {tagsOpen ? "Hide tag filters" : "Filter by tags"}
              </span>
              {activeTags.size > 0 && (
                <span className="h-4 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] inline-flex items-center">
                  {activeTags.size} active
                </span>
              )}
              <span className="ml-auto text-[10px]">{tagsOpen ? "▴" : "▾"}</span>
              {activeTags.size > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTags(new Set());
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  clear
                </span>
              )}
            </button>
            {tagsOpen && (
              <div className="px-3 pb-2 pt-1 space-y-1.5 border-t">
                {groupedTags.map((group) => {
                  const visible = showAllTags ? group.tags : group.tags.slice(0, 8);
                  const hidden = group.tags.length - visible.length;
                  return (
                    <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">
                        {group.label}
                      </span>
                      {visible.map(([tag, count]) => {
                        const active = activeTags.has(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "h-6 px-2 rounded-full text-[10px] font-medium border transition-colors",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border text-muted-foreground",
                            )}
                          >
                            #{tag}
                            <span className="opacity-70 ml-1">{count}</span>
                          </button>
                        );
                      })}
                      {hidden > 0 && !showAllTags && (
                        <span className="text-[10px] text-muted-foreground">+{hidden}</span>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => setShowAllTags((v) => !v)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {showAllTags ? "Show fewer tags" : "Show all tags"}
                </button>
              </div>
            )}
          </div>
        )}


        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* List — hidden in focus mode */}
          {!focusMode && (
          <Card className="w-[300px] shrink-0 flex flex-col overflow-hidden">
          
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-6 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : groups.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No prompts match the current filter.
                </div>
              ) : (
                <div className="p-2 space-y-3">
                  {groups.map(([cat, list]) => {
                    const meta = PHASE_META[cat] ?? FALLBACK_META;
                    const Icon = meta.icon;
                    return (
                      <div key={cat}>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 rounded-md mb-1 bg-gradient-to-r",
                            meta.tint,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-semibold tracking-wide">
                            {meta.short}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {list.length}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {list.map((p) => {
                            const isActive = activeKey === p.key;
                            return (
                              <button
                                key={p.key}
                                onClick={() => setActiveKey(p.key)}
                                className={cn(
                                  "w-full text-left pl-3 pr-2 py-1.5 rounded-md text-xs flex items-start gap-2 transition-colors border-l-2",
                                  isActive
                                    ? meta.ring
                                    : "border-l-transparent hover:bg-muted",
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="truncate font-medium leading-tight">
                                    {p.title}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                    {p.key}
                                  </div>
                                </div>
                                {p.hasOverride && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600 dark:text-amber-300"
                                  >
                                    edited
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>
          )}

          {/* Detail */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {active ? (
              <>
                <div
                  className={cn(
                    "p-4 border-b bg-gradient-to-br",
                    activeMeta.tint,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] gap-1", activeMeta.accent)}
                        >
                          <activeMeta.icon className="h-3 w-3" />
                          {activeMeta.label}
                        </Badge>
                        {active.hasOverride && (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/15">
                            override active
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-display text-lg font-semibold leading-tight">
                        {active.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {active.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <code className="text-[10px] bg-background/60 px-1.5 py-0.5 rounded border">
                          {active.key}
                        </code>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          {active.source}
                        </span>
                      </div>
                      {(active.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {(active.tags ?? []).map((t) => {
                            const on = activeTags.has(t);
                            return (
                              <button
                                key={t}
                                onClick={() => toggleTag(t)}
                                className={cn(
                                  "h-5 px-1.5 rounded-full text-[10px] border transition-colors",
                                  on
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background/60 hover:bg-muted border-border text-muted-foreground",
                                )}
                                title={`Filter by #${t}`}
                              >
                                #{t}
                              </button>
                            );
                          })}
                        </div>
                      )}

                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {isAdmin && onEdit && (
                        <Button size="sm" onClick={() => onEdit(active)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit override
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={copy}>
                        {copied ? (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFocusMode((v) => !v)}
                        title={focusMode ? "Show prompt list" : "Hide list & focus on prompt"}
                      >
                        {focusMode ? (
                          <Minimize2 className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {focusMode ? "Show list" : "Focus"}
                      </Button>
                    </div>
                  </div>
                  {!isAdmin && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border bg-background/50 p-2 text-[11px] text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Read-only view. Only administrators can modify prompts. Edits propagate
                        to live agents within ~60 seconds.
                      </span>
                    </div>
                  )}
                </div>
                <ScrollArea className="flex-1 bg-muted/20">
                  <pre className="p-4 text-[12px] leading-relaxed whitespace-pre-wrap font-mono">
                    {active.currentContent || "(empty)"}
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a prompt to view its contents.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
