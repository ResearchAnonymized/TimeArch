import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UsageRow {
  id: string;
  project_id: string | null;
  stage: number | null;
  agent_name: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  created_at: string;
  projects?: { name: string } | null;
}

interface Props {
  projectId?: string;
}

/**
 * Per-stage model routing log. Reads from public.token_usage, which is
 * appended for every LLM call inside the pipeline (stage agents, critic,
 * challenger, document refinement, playground). Lets any project member
 * verify which model handled each stage during a run.
 */
export default function ModelRoutingLog({ projectId }: Props) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("token_usage")
      .select("id, project_id, stage, agent_name, model, prompt_tokens, completion_tokens, total_tokens, created_at, projects(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (projectId) q = q.eq("project_id", projectId);
    const { data } = await q;
    setRows((data as unknown as UsageRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-sm">
          Every LLM call TimeArch makes is appended to <code className="font-mono text-xs">token_usage</code> with
          its stage, agent name, model ID, and token counts. The most recent {projectId ? "calls for this project" : "calls across your projects"} are shown below — proof of
          per-stage model routing for paper reviewers and auditors.
        </p>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">When</TableHead>
              <TableHead className="w-16">Stage</TableHead>
              <TableHead>Agent</TableHead>
              {!projectId && <TableHead>Project</TableHead>}
              <TableHead>Model</TableHead>
              <TableHead className="text-right w-24">Tokens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={projectId ? 5 : 6} className="text-center text-muted-foreground py-8 text-sm">
                  No LLM calls recorded yet. Run a stage to populate the log.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  {r.stage != null ? (
                    <Badge variant="outline" className="text-[10px]">S{r.stage}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{r.agent_name || "—"}</TableCell>
                {!projectId && (
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {r.projects?.name || "—"}
                  </TableCell>
                )}
                <TableCell>
                  <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{r.model}</code>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {r.total_tokens.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
