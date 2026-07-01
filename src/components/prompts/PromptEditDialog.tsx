import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import { toast } from "sonner";
import type { PromptCatalogItem } from "./PromptLibrary";
import { Loader2, RotateCcw } from "lucide-react";

export default function PromptEditDialog({
  prompt,
  onClose,
}: {
  prompt: PromptCatalogItem | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (prompt) {
      setContent(prompt.currentContent || prompt.defaultContent || "");
      setNotes(prompt.notes ?? "");
    }
  }, [prompt]);

  if (!prompt) return null;

  const save = async () => {
    if (!content.trim()) {
      toast.error("Content cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await callAuthenticatedFunction<{ ok?: boolean; error?: string }>(
        "update-prompt",
        { key: prompt.key, content, notes: notes || null },
      );
      if (res?.error) throw new Error(res.error);
      toast.success("Prompt saved. Live agents pick it up within ~60s.");
      window.dispatchEvent(new Event("prompts:reload"));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!confirm("Remove this override and restore the in-code default?")) return;
    setResetting(true);
    try {
      const res = await callAuthenticatedFunction<{ ok?: boolean; error?: string }>(
        "update-prompt",
        { key: prompt.key, reset: true },
      );
      if (res?.error) throw new Error(res.error);
      toast.success("Override removed. Default restored.");
      window.dispatchEvent(new Event("prompts:reload"));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset");
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={!!prompt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{prompt.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            <code className="bg-muted px-1.5 py-0.5 rounded">{prompt.key}</code> ·{" "}
            {prompt.category}
          </p>
          <div>
            <Label className="text-xs">Prompt content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Change note (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this override being applied?"
              className="text-xs"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {prompt.hasOverride && (
            <Button
              variant="outline"
              onClick={resetToDefault}
              disabled={resetting || saving}
            >
              {resetting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Reset to default
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
