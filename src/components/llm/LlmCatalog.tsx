import { CATALOG, CATALOG_GROUPS, COST_LABEL, type CatalogModel } from "@/lib/llm-catalog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Sparkles, Image as ImageIcon, Database } from "lucide-react";

const FAMILY_ICON: Record<string, React.ReactNode> = {
  gemini: <Sparkles className="h-4 w-4" />,
  openai: <Cpu className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  embedding: <Database className="h-4 w-4" />,
};

function ModelCard({ m }: { m: CatalogModel }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
            {FAMILY_ICON[m.family]}
          </div>
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold truncate">{m.id}</div>
            <div className="text-xs text-muted-foreground">{m.provider}</div>
          </div>
        </div>
        {m.isDefault && (
          <Badge variant="default" className="shrink-0 text-[10px]">
            DEFAULT
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {m.modality}
        </Badge>
        {m.contextWindow && (
          <Badge variant="outline" className="text-[10px]">
            {m.contextWindow}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px]">
          {COST_LABEL[m.cost]}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{m.rationale}</p>

      {m.usedFor.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Used in TimeArch for
          </div>
          <ul className="text-xs space-y-0.5">
            {m.usedFor.map((u) => (
              <li key={u} className="flex gap-1.5">
                <span className="text-primary">·</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function LlmCatalog() {
  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-sm">
          TimeArch routes every agent call through the <strong>Lovable AI Gateway</strong>. The
          catalog below lists every model the pipeline can invoke, the rationale for each, and
          which lifecycle stages or agents use it by default. Admins can register additional
          OpenAI-compatible or local endpoints under <em>Custom Endpoints</em> and <em>Local LLMs</em>.
        </p>
      </Card>

      {CATALOG_GROUPS.map((g) => {
        const items = CATALOG.filter((m) => m.family === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key} className="space-y-3">
            <div>
              <h3 className="font-display font-semibold">{g.label}</h3>
              <p className="text-xs text-muted-foreground">{g.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((m) => (
                <ModelCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
