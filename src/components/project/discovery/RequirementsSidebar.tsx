/**
 * Requirements rail: checkbox = in revision, click = detail in workspace.
 */
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DiscoveryPanel, DiscoveryPanelHeader, DiscoveryStat } from "./parts/discoveryUi";

export interface RequirementItem {
  id: string;
  title: string;
  description: string | null;
  desired_behavior: string | null;
  current_behavior: string | null;
  status?: string;
  analyzed?: boolean;
}

/** Strip prompt scaffolding that often lands in stored titles */
export function cleanFeatureTitle(title: string): string {
  return title
    .replace(/\s*What should happen\s*:?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Props {
  items: RequirementItem[];
  selectedId: string | null;
  revisionIds: Set<string>;
  loading?: boolean;
  onSelect: (id: string) => void;
  onToggleRevision: (id: string, included: boolean) => void;
  onIncludeAll?: () => void;
  onClearRevision?: () => void;
  onDelete?: (id: string) => void;
  onNew?: () => void;
  /** Inside a parent Propose workspace — no outer card chrome */
  embedded?: boolean;
  /** Hide New when parent header already has it */
  hideNew?: boolean;
}

export default function RequirementsSidebar({
  items,
  selectedId,
  revisionIds,
  loading,
  onSelect,
  onToggleRevision,
  onIncludeAll,
  onClearRevision,
  onDelete,
  onNew,
  embedded,
  hideNew,
}: Props) {
  const revisionCount = revisionIds.size;
  const showNew = onNew && !hideNew;

  const list = (
    <>
      {items.length > 1 && (
        <div className="px-3 py-1.5 flex gap-3 border-b border-border/80 text-[11px]">
          {onIncludeAll && (
            <button
              type="button"
              onClick={onIncludeAll}
              className="text-primary hover:text-primary/80 font-medium"
            >
              Select all
            </button>
          )}
          {onClearRevision && revisionCount > 0 && (
            <button
              type="button"
              onClick={onClearRevision}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Loading
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            No features yet. Create one to start.
          </div>
        ) : (
          <ul className="py-1.5 px-1">
            {items.map((item) => {
              const active = item.id === selectedId;
              const checked = revisionIds.has(item.id);
              const title = cleanFeatureTitle(item.title);
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                      active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50",
                    )}
                    onClick={() => onSelect(item.id)}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Include ${title} in revision`}
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                      checked={checked}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleRevision(item.id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <p
                      className={cn(
                        "min-w-0 flex-1 text-[13px] leading-snug line-clamp-2",
                        active ? "font-semibold text-primary" : "font-medium text-foreground",
                      )}
                    >
                      {title}
                    </p>
                    {onDelete && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0 border-r border-border/80 bg-card">
        <div className="px-3 py-2.5 border-b border-border/80 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Features</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {revisionCount > 0 ? `${revisionCount} selected` : `${items.length} total`}
            </p>
          </div>
          {showNew && (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          )}
        </div>
        {list}
      </div>
    );
  }

  return (
    <DiscoveryPanel className="flex flex-col min-h-[28rem]">
      <DiscoveryPanelHeader
        title="Proposed features"
        meta={
          <DiscoveryStat
            label="Selected"
            value={revisionCount > 0 ? `${revisionCount}/${items.length}` : items.length}
            tone="emerald"
          />
        }
        actions={
          showNew ? (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          ) : undefined
        }
      />
      {list}
    </DiscoveryPanel>
  );
}

export const REVISION_BUNDLE_PREFIX = '{"kind":"revision_bundle"';

export function isRevisionBundle(description: string | null | undefined): boolean {
  return (
    !!description?.startsWith(REVISION_BUNDLE_PREFIX) ||
    !!description?.includes('"kind":"revision_bundle"')
  );
}

export function buildRevisionDescription(sourceIds: string[], findings?: string | null): string {
  return JSON.stringify({
    kind: "revision_bundle",
    source_ids: sourceIds,
    findings: findings || null,
  });
}

export function parseRevisionSourceIds(description: string | null | undefined): string[] {
  if (!description) return [];
  try {
    const parsed = JSON.parse(description) as { kind?: string; source_ids?: string[] };
    if (parsed.kind === "revision_bundle" && Array.isArray(parsed.source_ids)) {
      return parsed.source_ids.map(String);
    }
  } catch {
    /* ignore */
  }
  return [];
}
