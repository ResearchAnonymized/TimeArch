import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw, BookOpen, GitBranch } from "lucide-react";

interface Stats {
  chunks: number;
  frameworks: string[];
  lastUpdated: string | null;
}

/**
 * Documents the embedding model and RAG refresh process used by TimeArch's
 * pgvector knowledge base. Read-only — surfaces live counts so reviewers
 * can verify the index is populated and current.
 */
export default function EmbeddingsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const { data, count } = await supabase
        .from("knowledge_chunks")
        .select("framework, updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(500);
      const frameworks = Array.from(new Set((data || []).map((d: any) => d.framework))).sort();
      setStats({
        chunks: count || 0,
        frameworks,
        lastUpdated: data && data.length ? (data[0] as any).updated_at : null,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold">Embedding Model</h3>
            <p className="text-xs text-muted-foreground">Used for all RAG retrieval over the architecture knowledge base.</p>
          </div>
          <Badge variant="default" className="text-[10px]">DEFAULT</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Model ID</div>
            <code className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">
              google/gemini-embedding-001
            </code>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Vector store</div>
            <div className="font-mono text-xs">pgvector · <code>knowledge_chunks.embedding</code></div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Dimensionality</div>
            <div className="text-xs">1536 (truncated via <code className="font-mono">dimensions</code> param to match column type)</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Hybrid retrieval</div>
            <div className="text-xs">pgvector cosine + Postgres <code className="font-mono">tsvector</code> full-text (weighted)</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
          Embeddings are computed server-side through the LLM gateway. The query and corpus vectors must come from
          the same model — switching embedding model requires a full re-embed and is treated as a knowledge-base
          migration, not a configuration toggle.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold">Index Contents</h3>
            <p className="text-xs text-muted-foreground">Live counts from the pgvector index.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-3 bg-muted/30">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Chunks indexed</div>
            <div className="text-2xl font-bold tabular-nums">{stats?.chunks ?? "…"}</div>
          </Card>
          <Card className="p-3 bg-muted/30">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Frameworks</div>
            <div className="text-2xl font-bold tabular-nums">{stats?.frameworks.length ?? "…"}</div>
          </Card>
          <Card className="p-3 bg-muted/30">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last updated</div>
            <div className="text-xs pt-1.5">
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : "—"}
            </div>
          </Card>
        </div>

        {stats?.frameworks.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {stats.frameworks.map((f) => (
              <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold">Refresh Process</h3>
            <p className="text-xs text-muted-foreground">How the RAG index is rebuilt and kept current.</p>
          </div>
        </div>

        <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
          <li>
            <span className="text-foreground">Curated source bundle</span> — ISO/IEC 25010, 27001, ATAM, AWS / Azure Well-Architected,
            and NFR catalogues are maintained as versioned chunks in <code className="font-mono text-xs">supabase/functions/seed-knowledge</code>.
          </li>
          <li>
            <span className="text-foreground">Seed function</span> — invoking the <code className="font-mono text-xs">seed-knowledge</code> edge
            function upserts each chunk; the <code className="font-mono text-xs">trg_knowledge_search_vector</code> trigger refreshes
            the full-text vector, and embeddings are recomputed for any new or changed content.
          </li>
          <li>
            <span className="text-foreground">Atomic swap</span> — upserts are keyed by stable chunk identity, so retrieval continues to serve the
            previous version while new vectors are written. No downtime window.
          </li>
          <li>
            <span className="text-foreground">Audit</span> — every refresh is recorded with framework, chunk count, and timestamp;
            the counts above reflect the most recent successful run.
          </li>
        </ol>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold">Retrieval Settings</h3>
            <p className="text-xs text-muted-foreground">Defaults applied by <code className="font-mono">search_knowledge()</code> on every stage prompt.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div><span className="text-muted-foreground">Top-K:</span> <strong>5</strong> chunks per query</div>
          <div><span className="text-muted-foreground">Distance metric:</span> <strong>cosine</strong> (<code className="font-mono">vector_cosine_ops</code>)</div>
          <div><span className="text-muted-foreground">Stage filter:</span> <strong>relevant_stages @&gt; current stage</strong></div>
          <div><span className="text-muted-foreground">Framework filter:</span> optional, per-agent</div>
        </div>
      </Card>
    </div>
  );
}
