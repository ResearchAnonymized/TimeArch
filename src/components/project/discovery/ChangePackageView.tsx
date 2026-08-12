import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Users, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChangePackage } from "@/lib/changePackage";
import { toast } from "sonner";

interface Props {
  pkg: ChangePackage;
}

export default function ChangePackageView({ pkg }: Props) {
  const [copied, setCopied] = useState<"all" | "llm" | null>(null);

  const parts = useMemo(() => {
    const split = pkg.markdown.split("## Part B — For engineers & coding LLMs");
    return {
      stakeholder: split[0]?.trim() || pkg.markdown,
      llm: split[1] ? `## Part B — For engineers & coding LLMs\n${split[1].trim()}` : pkg.markdown,
    };
  }, [pkg.markdown]);

  const copy = async (which: "all" | "llm") => {
    const text = which === "all" ? pkg.markdown : parts.llm;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success(which === "all" ? "Full package copied" : "LLM coding brief copied");
    setTimeout(() => setCopied(null), 2000);
  };

  const download = () => {
    const blob = new Blob([pkg.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pkg.title.replace(/[^\w.-]+/g, "_").slice(0, 80)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border bg-card overflow-hidden animate-in fade-in-50 duration-300">
      <div className="border-b bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-emerald-600" />
            <h3 className="font-display text-base font-bold truncate">{pkg.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {pkg.stats.workItems} tasks · {pkg.stats.mappings} mappings · {pkg.stats.ripples}{" "}
            ripples · {pkg.stats.alternatives} alternatives
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void copy("llm")}>
            {copied === "llm" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Bot className="h-3.5 w-3.5 mr-1.5" />}
            Copy for coding LLM
          </Button>
          <Button size="sm" variant="outline" onClick={() => void copy("all")}>
            {copied === "all" ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy all
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={download}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download .md
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        <div className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Stakeholders
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground/90 max-h-[28rem] overflow-auto">
            {parts.stakeholder}
          </pre>
        </div>
        <div className="p-5 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3.5 w-3.5" /> Engineers / coding LLMs
          </div>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground/90 max-h-[28rem] overflow-auto">
            {parts.llm}
          </pre>
        </div>
      </div>
    </section>
  );
}
