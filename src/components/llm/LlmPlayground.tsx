import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATALOG } from "@/lib/llm-catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";

interface EndpointRow {
  id: string;
  label: string;
  provider: string;
  base_url: string;
  model_id: string;
  enabled: boolean;
}

interface Result {
  text: string;
  model: string;
  latencyMs: number;
  tokens?: { prompt?: number; completion?: number; total?: number };
}

export default function LlmPlayground() {
  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [selection, setSelection] = useState<string>(CATALOG[0]?.id || "");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState(
    "Briefly describe what an ATAM evaluation produces.",
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("llm_endpoints")
        .select("id,label,provider,base_url,model_id,enabled")
        .eq("enabled", true);
      setEndpoints((data || []) as EndpointRow[]);
    })();
  }, []);

  const isLocal = useMemo(() => {
    const ep = endpoints.find((e) => `endpoint:${e.id}` === selection);
    return ep?.provider === "local";
  }, [endpoints, selection]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    const started = performance.now();
    try {
      if (selection.startsWith("endpoint:")) {
        const id = selection.slice("endpoint:".length);
        const ep = endpoints.find((e) => e.id === id);
        if (!ep) throw new Error("Endpoint not found");

        if (ep.provider === "local") {
          // Call browser → localhost directly (OpenAI-compatible chat completions).
          const res = await fetch(`${ep.base_url.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: ep.model_id,
              messages: [
                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                { role: "user", content: userPrompt },
              ],
            }),
          });
          if (!res.ok) throw new Error(`Local LLM ${res.status}: ${await res.text()}`);
          const data = await res.json();
          setResult({
            text: data?.choices?.[0]?.message?.content || "(no content)",
            model: ep.model_id,
            latencyMs: Math.round(performance.now() - started),
            tokens: data?.usage
              ? {
                  prompt: data.usage.prompt_tokens,
                  completion: data.usage.completion_tokens,
                  total: data.usage.total_tokens,
                }
              : undefined,
          });
        } else {
          const r = await callAuthenticatedFunction<Result>("llm-playground-run", {
            endpointId: id,
            systemPrompt,
            userPrompt,
          });
          setResult({ ...r, latencyMs: Math.round(performance.now() - started) });
        }
      } else {
        // Catalog model — call via Lovable AI Gateway edge function
        const r = await callAuthenticatedFunction<Result>("llm-playground-run", {
          model: selection,
          systemPrompt,
          userPrompt,
        });
        setResult({ ...r, latencyMs: Math.round(performance.now() - started) });
      }
    } catch (e: any) {
      toast.error(e.message || "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Model</Label>
          <Select value={selection} onValueChange={setSelection}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold">
                Lovable AI Gateway
              </div>
              {CATALOG.filter((m) => m.modality !== "embedding" && m.modality !== "image").map(
                (m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id}
                    {m.isDefault ? " · default" : ""}
                  </SelectItem>
                ),
              )}
              {endpoints.length > 0 && (
                <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold border-t mt-1">
                  Custom / Local
                </div>
              )}
              {endpoints.map((e) => (
                <SelectItem key={e.id} value={`endpoint:${e.id}`}>
                  {e.label} · {e.model_id} ({e.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLocal && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Local endpoint — request goes from your browser to localhost. Ollama / LM Studio must
              be running.
            </p>
          )}
        </div>

        <div>
          <Label className="text-xs">System prompt (optional)</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="You are a senior software architect…"
          />
        </div>
        <div>
          <Label className="text-xs">User prompt</Label>
          <Textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={6}
          />
        </div>
        <Button onClick={run} disabled={running || !userPrompt.trim()} className="w-full">
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run
        </Button>
      </Card>

      <Card className="p-4 space-y-3 min-h-[300px]">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Output</h4>
          {result && (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px] font-mono">
                {result.model}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {result.latencyMs} ms
              </Badge>
              {result.tokens?.total !== undefined && (
                <Badge variant="secondary" className="text-[10px]">
                  {result.tokens.total} tok
                </Badge>
              )}
            </div>
          )}
        </div>
        {result ? (
          <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
            {result.text}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            Pick a model and hit Run to see the response.
          </div>
        )}
      </Card>
    </div>
  );
}
