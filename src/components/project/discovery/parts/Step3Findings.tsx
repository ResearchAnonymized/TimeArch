/**
 * Step 3 header — compact baseline summary only (no stage jumps).
 */
import { ArrowLeft, Database, FileCode, FileText, Globe, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Findings {
  endpoints: number;
  schemas: number;
  tables: number;
  components: number;
  requirements: number;
  adrs: number;
}

interface Props {
  parsedCount: number;
  hasParsed: boolean;
  findings: Findings;
  onBack: () => void;
  onGoStep2: () => void;
}

export default function Step3Findings({
  parsedCount,
  hasParsed,
  findings,
  onBack,
  onGoStep2,
}: Props) {
  const tiles = [
    { icon: Globe, label: "Endpoints", val: findings.endpoints },
    { icon: Database, label: "Tables", val: findings.tables },
    { icon: Layers, label: "Components", val: findings.components },
    { icon: FileText, label: "Requirements", val: findings.requirements },
    { icon: FileCode, label: "ADRs", val: findings.adrs },
  ].filter((f) => f.val > 0);

  return (
    <section className="rounded-xl border bg-card p-5 animate-in fade-in-50 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-base font-bold mb-1">Architecture recovered</h3>
          <p className="text-xs text-muted-foreground">
            {hasParsed
              ? `${parsedCount} file${parsedCount === 1 ? "" : "s"} parsed. Review the inventory, then describe the new requirement below.`
              : "Nothing parsed yet — go back and let AI read the files."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Import
          </Button>
          {!hasParsed && (
            <Button size="sm" onClick={onGoStep2}>
              Recover architecture
            </Button>
          )}
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tiles.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{f.val}</span>
                <span className="text-muted-foreground">{f.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
