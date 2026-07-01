import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import LlmEndpointDialog, { type LlmEndpoint } from "./LlmEndpointDialog";

interface Props {
  isAdmin?: boolean;
  filter: "remote" | "local";
}

export default function LlmEndpointsTable({ isAdmin, filter }: Props) {
  const [rows, setRows] = useState<LlmEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LlmEndpoint | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("llm_endpoints")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data || []) as LlmEndpoint[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) =>
    filter === "local" ? r.provider === "local" : r.provider !== "local",
  );

  const remove = async (id: string) => {
    if (!confirm("Delete this endpoint?")) return;
    const { error } = await supabase.from("llm_endpoints").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      load();
    }
  };

  const toggle = async (row: LlmEndpoint) => {
    const { error } = await supabase
      .from("llm_endpoints")
      .update({ enabled: !row.enabled })
      .eq("id", row.id!);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">
            {filter === "local" ? "Local LLMs" : "Custom Endpoints"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {filter === "local"
              ? "Models running on your machine via Ollama, LM Studio, or llama.cpp. Calls happen from your browser — no inbound network required."
              : "OpenAI-compatible providers (Azure OpenAI, OpenRouter, self-hosted vLLM, etc.) callable from the Playground edge function."}
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {filter === "local" && (
        <Card className="p-3 bg-muted/30 border-dashed text-xs space-y-1">
          <div className="font-semibold">Common base URLs</div>
          <div>
            Ollama: <code>http://localhost:11434/v1</code>
          </div>
          <div>
            LM Studio: <code>http://localhost:1234/v1</code>
          </div>
          <div>
            llama.cpp server: <code>http://localhost:8080/v1</code>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No endpoints registered yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Label</th>
                <th className="text-left p-2">Provider</th>
                <th className="text-left p-2">Model</th>
                <th className="text-left p-2">Base URL</th>
                <th className="text-left p-2">Status</th>
                {isAdmin && <th className="w-32" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-medium">{r.label}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]">
                      {r.provider}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs">{r.model_id}</td>
                  <td className="p-2 font-mono text-xs truncate max-w-[200px]">{r.base_url}</td>
                  <td className="p-2">
                    {r.enabled ? (
                      <Badge className="text-[10px]">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Disabled
                      </Badge>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-2 flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => toggle(r)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(r);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id!)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <LlmEndpointDialog
        endpoint={editing}
        defaultLocal={filter === "local"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
