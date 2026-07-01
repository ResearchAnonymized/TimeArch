import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LlmEndpoint {
  id?: string;
  label: string;
  provider: "openai-compatible" | "anthropic" | "azure" | "local" | "other";
  base_url: string;
  model_id: string;
  api_key_secret_name?: string | null;
  enabled?: boolean;
  notes?: string | null;
}

interface Props {
  endpoint: LlmEndpoint | null;
  defaultLocal?: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function LlmEndpointDialog({
  endpoint,
  defaultLocal,
  open,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<LlmEndpoint>({
    label: "",
    provider: defaultLocal ? "local" : "openai-compatible",
    base_url: defaultLocal ? "http://localhost:11434/v1" : "",
    model_id: "",
    api_key_secret_name: "",
    enabled: true,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (endpoint) {
      setForm(endpoint);
    } else {
      setForm({
        label: "",
        provider: defaultLocal ? "local" : "openai-compatible",
        base_url: defaultLocal ? "http://localhost:11434/v1" : "",
        model_id: "",
        api_key_secret_name: "",
        enabled: true,
        notes: "",
      });
    }
  }, [endpoint, defaultLocal, open]);

  const save = async () => {
    if (!form.label || !form.base_url || !form.model_id) {
      toast.error("Label, Base URL and Model ID are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        provider: form.provider,
        base_url: form.base_url,
        model_id: form.model_id,
        api_key_secret_name: form.api_key_secret_name || null,
        enabled: form.enabled ?? true,
        notes: form.notes || null,
      };
      const { error } = endpoint?.id
        ? await supabase.from("llm_endpoints").update(payload).eq("id", endpoint.id)
        : await supabase.from("llm_endpoints").insert(payload);
      if (error) throw error;
      toast.success(endpoint?.id ? "Endpoint updated" : "Endpoint added");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save endpoint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{endpoint?.id ? "Edit endpoint" : "Add LLM endpoint"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Label</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Local Ollama Llama3"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => setForm({ ...form, provider: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                  <SelectItem value="azure">Azure OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="local">Local (Ollama / LM Studio)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Model ID</Label>
              <Input
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="llama3:8b"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Base URL</Label>
            <Input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="http://localhost:11434/v1"
            />
          </div>
          {form.provider !== "local" && (
            <div>
              <Label className="text-xs">API key secret name (optional)</Label>
              <Input
                value={form.api_key_secret_name || ""}
                onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })}
                placeholder="MY_CUSTOM_LLM_KEY"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Name of a Supabase secret holding the API key. The Playground edge function
                reads it via <code>Deno.env.get(name)</code>.
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
