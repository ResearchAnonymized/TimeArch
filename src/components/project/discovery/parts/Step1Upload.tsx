import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  KIND_META,
  type ProjectImport,
  type RemotePreset,
  type SeededPreset,
} from "@/features/discovery/types";

interface Props {
  imports: ProjectImport[];
  uploading: boolean;
  reversing: boolean;
  loadingDemo: string | null;
  hasImports: boolean;
  seededPreset: SeededPreset | null;
  remotePresets: RemotePreset[];
  onFiles: (files: FileList | File[]) => void;
  onLoadDemoPack: () => void;
  onLoadRemotePreset: (preset: RemotePreset) => void;
  onDelete: (imp: ProjectImport) => void;
  onNext: () => void;
}

export default function Step1Upload({
  imports,
  uploading,
  reversing,
  loadingDemo,
  hasImports,
  seededPreset,
  remotePresets,
  onFiles,
  onLoadDemoPack,
  onLoadRemotePreset,
  onDelete,
  onNext,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <section className="rounded-xl border bg-card p-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold mb-1">
          What do you have from the existing system?
        </h3>
        <p className="text-xs text-muted-foreground">
          Drop in anything — code, schemas, API specs, requirement docs, old ADRs. We'll figure out
          what each file is.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all",
          dragOver
            ? "border-amber-500 bg-amber-500/10 scale-[1.01]"
            : "border-border hover:border-amber-500/50 hover:bg-amber-500/5",
        )}
      >
        <Upload
          className={cn(
            "h-10 w-10 mx-auto mb-3",
            dragOver ? "text-amber-500" : "text-muted-foreground",
          )}
        />
        <p className="text-sm font-semibold mb-1">Drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">
          SQL · OpenAPI · ZIP of source · Markdown ADRs · SRS / PRD · Diagrams
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {seededPreset && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-sm font-semibold truncate">
                  {hasImports ? "Seeded from" : "Selected starter:"} {seededPreset.name}
                </p>
                {seededPreset.tag && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300"
                  >
                    {seededPreset.tag}
                  </Badge>
                )}
                {hasImports && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> {imports.length} file
                    {imports.length === 1 ? "" : "s"} loaded
                  </Badge>
                )}
              </div>
              {seededPreset.description && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {seededPreset.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {seededPreset.sourceRepo && (
                  <a
                    href={seededPreset.sourceRepo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    {seededPreset.sourceRepo.replace("https://github.com/", "")} ↗
                  </a>
                )}
                {!hasImports && (
                  <Button
                    size="sm"
                    onClick={() =>
                      onLoadRemotePreset({
                        id: seededPreset.id,
                        title: seededPreset.name,
                        blurb: seededPreset.description || "",
                        source_repo: seededPreset.sourceRepo || "",
                        license: "",
                        scale: "small",
                        expected_runtime: "",
                        file_count: 1,
                        kinds: [],
                      })
                    }
                    disabled={!!loadingDemo || reversing}
                    className="ml-auto h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {loadingDemo || reversing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Fetching…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1.5" /> Fetch files now
                      </>
                    )}
                  </Button>
                )}
              </div>
              {!hasImports && (
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Seeding didn't complete during project creation — click "Fetch files now" to retry.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasImports && !seededPreset && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Package className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold">No files handy?</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Try the ShopFlow legacy e-commerce demo (5 synthetic artifacts).
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onLoadDemoPack}
              disabled={!!loadingDemo || reversing}
            >
              {loadingDemo || reversing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "One-click demo"
              )}
            </Button>
          </div>

          {remotePresets.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  Or pull a real open-source project
                </p>
                <span className="text-[10px] text-muted-foreground">live from GitHub</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {remotePresets.map((p) => {
                  const isBusy = loadingDemo === p.id;
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border bg-background p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {p.blurb}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] flex-shrink-0",
                            p.scale === "small" &&
                              "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                            p.scale === "medium" &&
                              "border-amber-500/40 text-amber-700 dark:text-amber-300",
                            p.scale === "large" &&
                              "border-rose-500/40 text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {p.scale}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.kinds.map((k) => (
                          <span
                            key={k}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                          >
                            {k}
                          </span>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {p.expected_runtime} · {p.license}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <a
                          href={p.source_repo}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-amber-600 truncate"
                        >
                          {p.source_repo.replace("https://github.com/", "")}
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!loadingDemo || reversing}
                          onClick={() => onLoadRemotePreset(p)}
                          className="flex-shrink-0"
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Pulling…
                            </>
                          ) : (
                            <>Use this demo</>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {(uploading || hasImports) && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              {imports.length} file{imports.length === 1 ? "" : "s"} added
            </p>
            {uploading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-1 max-h-48 overflow-auto">
            {imports.map((imp) => {
              const meta = KIND_META[imp.kind];
              const Icon = meta.icon;
              return (
                <div
                  key={imp.id}
                  className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-medium truncate flex-1">{imp.source_label}</span>
                  <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(imp)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end mt-6 pt-4 border-t">
        <Button
          onClick={onNext}
          disabled={!hasImports}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          Next: Let AI read them <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </section>
  );
}
