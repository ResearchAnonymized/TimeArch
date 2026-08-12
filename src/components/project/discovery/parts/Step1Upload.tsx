/**
 * Step 1 — Import system.
 * Demo mode: pick a sample project.
 * Live mode: GitHub URL or ZIP / files.
 */
import { useRef, useState } from "react";
import {
  ArrowRight,
  Github,
  Loader2,
  Package,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  KIND_META,
  type ProjectImport,
  type RemotePreset,
} from "@/features/discovery/types";
import type { BrownfieldMode } from "./ModeToggle";

interface Props {
  mode: BrownfieldMode;
  imports: ProjectImport[];
  uploading: boolean;
  reversing: boolean;
  loadingDemo: string | null;
  hasImports: boolean;
  remotePresets: RemotePreset[];
  onFiles: (files: FileList | File[]) => void;
  onLoadDemoPack: () => void;
  onLoadRemotePreset: (preset: RemotePreset) => void;
  onLoadGithubRepo: (repoUrl: string, ref?: string) => void;
  onDelete: (imp: ProjectImport) => void;
  onNext: () => void;
}

export default function Step1Upload({
  mode,
  imports,
  uploading,
  reversing,
  loadingDemo,
  hasImports,
  remotePresets,
  onFiles,
  onLoadDemoPack,
  onLoadRemotePreset,
  onLoadGithubRepo,
  onDelete,
  onNext,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRef, setGithubRef] = useState("");
  const githubBusy = loadingDemo === "github";
  const busy = !!loadingDemo || reversing || uploading;

  return (
    <section className="rounded-xl border bg-card p-6 animate-in fade-in-50 duration-300 space-y-5">
      <div>
        <h3 className="font-display text-base font-bold mb-1">
          {mode === "demo" ? "Choose a demo project" : "Import your system"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {mode === "demo"
            ? "Pick a sample. We load files and recover the architecture automatically."
            : "Paste a GitHub URL or upload a ZIP / source files. Then we recover the architecture."}
        </p>
      </div>

      {mode === "demo" && (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={onLoadDemoPack}
            className="w-full text-left rounded-xl border p-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                {busy && loadingDemo === "demo" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                ) : (
                  <Package className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold">ShopFlow legacy e-commerce</p>
                  <Badge variant="outline" className="text-[10px]">
                    starter
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Synthetic OpenAPI, schema, SRS, and ADRs — best for a quick walkthrough.
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </button>

          {remotePresets.slice(0, 4).map((p) => {
            const isBusy = loadingDemo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => onLoadRemotePreset(p)}
                className="w-full text-left rounded-xl border p-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {isBusy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Github className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">{p.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {p.scale}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.blurb}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {mode === "live" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="github-repo-url" className="text-sm font-semibold">
                GitHub repository
              </Label>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="github-repo-url"
                placeholder="https://github.com/org/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled={busy}
                className="flex-1 font-mono text-xs"
              />
              <Input
                placeholder="Branch (optional)"
                value={githubRef}
                onChange={(e) => setGithubRef(e.target.value)}
                disabled={busy}
                className="sm:w-36 font-mono text-xs"
              />
              <Button
                type="button"
                onClick={() => onLoadGithubRepo(githubUrl, githubRef || undefined)}
                disabled={!githubUrl.trim() || busy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
              >
                {githubBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Github className="h-3.5 w-3.5 mr-1.5" /> Import
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
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
              "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all",
              dragOver
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-border hover:border-emerald-500/40 hover:bg-emerald-500/5",
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 mx-auto mb-2",
                dragOver ? "text-emerald-600" : "text-muted-foreground",
              )}
            />
            <p className="text-sm font-semibold mb-1">Drop a ZIP or source files</p>
            <p className="text-xs text-muted-foreground">
              ZIP of repo · code · OpenAPI · SQL · Markdown docs
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.py,.js,.ts,.tsx,.jsx,.java,.go,.sql,.yaml,.yml,.json,.md,.txt,.html,.css"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      {hasImports && (
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
            {imports.length} file{imports.length === 1 ? "" : "s"} loaded
          </p>
          <div className="space-y-1 max-h-40 overflow-auto">
            {imports.map((imp) => {
              const meta = KIND_META[imp.kind] || KIND_META.other;
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

      <div className="flex items-center justify-end pt-2 border-t">
        <Button
          onClick={onNext}
          disabled={!hasImports || busy}
          className={cn(
            "text-white",
            mode === "live" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700",
          )}
        >
          {reversing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading system…
            </>
          ) : (
            <>
              Next: Recover architecture <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
