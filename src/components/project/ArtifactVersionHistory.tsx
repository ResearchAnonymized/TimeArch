import { useEffect, useState } from "react";
import { History, Eye, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Snapshot {
  id: string;
  version: number;
  title: string | null;
  status: string | null;
  generated_by: string | null;
  created_at: string;
  content: any;
}

interface Props {
  projectId: string;
  stage: number;
  /** Optional filter to only show snapshots matching a title/type prefix. */
  titleFilter?: (title: string | null) => boolean;
  /** Called after a restore succeeds so the parent can refresh. */
  onRestored?: () => void;
}

export default function ArtifactVersionHistory({
  projectId,
  stage,
  titleFilter,
  onRestored,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("architecture_artifacts")
      .select("id,version,title,status,generated_by,created_at,content")
      .eq("project_id", projectId)
      .eq("stage", stage)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load history", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data || []) as Snapshot[];
    setSnapshots(titleFilter ? rows.filter((r) => titleFilter(r.title)) : rows);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, stage]);

  const restore = async (snap: Snapshot) => {
    setRestoringId(snap.id);
    const maxVersion = snapshots.reduce((m, s) => Math.max(m, s.version || 0), 0);
    const { error } = await supabase.from("architecture_artifacts").insert({
      project_id: projectId,
      stage,
      version: maxVersion + 1,
      title: snap.title ?? `Stage ${stage} artifact`,
      content: snap.content,
      status: "draft" as any,
      type: "documentation" as any,
      generated_by: `Restored from v${snap.version}`,
    } as any);
    setRestoringId(null);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Restored v${snap.version} as v${maxVersion + 1}` });
    setOpen(false);
    onRestored?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Version history
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Stage {stage} — Saved versions</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No saved versions yet.
              </p>
            ) : (
              snapshots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        v{s.version}
                      </Badge>
                      {s.status && (
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {s.status}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs font-medium truncate">{s.title || "Untitled"}</p>
                    {s.generated_by && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {s.generated_by}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(s)}
                    className="gap-1"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore(s)}
                    disabled={restoringId === s.id}
                    className="gap-1"
                  >
                    {restoringId === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {preview?.title} — v{preview?.version}
            </DialogTitle>
          </DialogHeader>
          <pre className="flex-1 overflow-auto text-[11px] bg-muted/40 rounded-lg p-3 font-mono">
            {preview ? JSON.stringify(preview.content, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
