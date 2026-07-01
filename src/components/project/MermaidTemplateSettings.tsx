import { useEffect, useState } from "react";
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DEFAULT_MERMAID_TEMPLATES,
  getMermaidTemplates,
  setMermaidTemplates,
  type MermaidTemplates,
} from "@/lib/mermaid-templates";

/**
 * Lightweight editor for the platform-wide Mermaid templates.
 *
 * Persists overrides to localStorage and broadcasts a change event so every
 * mounted MermaidDiagram re-renders with the new spacing / typography.
 */
export default function MermaidTemplateSettings({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MermaidTemplates>(getMermaidTemplates);

  useEffect(() => {
    if (open) setDraft(getMermaidTemplates());
  }, [open]);

  const save = () => {
    // Persist as deep override (full template object — small enough).
    setMermaidTemplates(draft);
    toast.success("Diagram templates updated");
    setOpen(false);
  };

  const reset = () => {
    setDraft(DEFAULT_MERMAID_TEMPLATES);
    setMermaidTemplates(null);
    toast.success("Reverted to default templates");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Diagram templates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Diagram templates</DialogTitle>
          <DialogDescription>
            Tune spacing and typography once — every flowchart, ER diagram, and sequence diagram
            across your projects will follow these settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="typography" className="mt-2">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="flowchart">Flowchart</TabsTrigger>
            <TabsTrigger value="er">ER diagram</TabsTrigger>
            <TabsTrigger value="sequence">Sequence</TabsTrigger>
          </TabsList>

          {/* TYPOGRAPHY */}
          <TabsContent value="typography" className="space-y-4 pt-4">
            <Field label="Font family">
              <Input
                value={draft.typography.fontFamily}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    typography: { ...draft.typography, fontFamily: e.target.value },
                  })
                }
              />
            </Field>
            <NumberSlider
              label="Node label size"
              suffix="px"
              min={10}
              max={20}
              step={1}
              value={draft.typography.nodeFontSize}
              onChange={(v) =>
                setDraft({ ...draft, typography: { ...draft.typography, nodeFontSize: v } })
              }
            />
            <NumberSlider
              label="Edge label size"
              suffix="px"
              min={9}
              max={18}
              step={1}
              value={draft.typography.edgeFontSize}
              onChange={(v) =>
                setDraft({ ...draft, typography: { ...draft.typography, edgeFontSize: v } })
              }
            />
            <NumberSlider
              label="Cluster label size"
              suffix="px"
              min={9}
              max={18}
              step={1}
              value={draft.typography.clusterFontSize}
              onChange={(v) =>
                setDraft({ ...draft, typography: { ...draft.typography, clusterFontSize: v } })
              }
            />
            <NumberSlider
              label="Font weight"
              min={400}
              max={700}
              step={100}
              value={draft.typography.fontWeight}
              onChange={(v) =>
                setDraft({ ...draft, typography: { ...draft.typography, fontWeight: v } })
              }
            />
          </TabsContent>

          {/* FLOWCHART */}
          <TabsContent value="flowchart" className="space-y-4 pt-4">
            <NumberSlider
              label="Node spacing"
              suffix="px"
              min={20}
              max={120}
              step={5}
              value={draft.flowchart.nodeSpacing}
              onChange={(v) =>
                setDraft({ ...draft, flowchart: { ...draft.flowchart, nodeSpacing: v } })
              }
            />
            <NumberSlider
              label="Rank spacing"
              suffix="px"
              min={30}
              max={160}
              step={5}
              value={draft.flowchart.rankSpacing}
              onChange={(v) =>
                setDraft({ ...draft, flowchart: { ...draft.flowchart, rankSpacing: v } })
              }
            />
            <NumberSlider
              label="Node padding"
              suffix="px"
              min={4}
              max={40}
              step={2}
              value={draft.flowchart.padding}
              onChange={(v) =>
                setDraft({ ...draft, flowchart: { ...draft.flowchart, padding: v } })
              }
            />
            <NumberSlider
              label="Stroke width"
              suffix="px"
              min={1}
              max={3}
              step={0.5}
              value={draft.flowchart.strokeWidth}
              onChange={(v) =>
                setDraft({ ...draft, flowchart: { ...draft.flowchart, strokeWidth: v } })
              }
            />
            <Field label="Edge curve">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={draft.flowchart.curve}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    flowchart: {
                      ...draft.flowchart,
                      curve: e.target.value as MermaidTemplates["flowchart"]["curve"],
                    },
                  })
                }
              >
                <option value="basis">basis (smooth)</option>
                <option value="linear">linear (straight)</option>
                <option value="cardinal">cardinal</option>
                <option value="step">step (right-angle)</option>
                <option value="monotoneX">monotoneX</option>
              </select>
            </Field>
          </TabsContent>

          {/* ER */}
          <TabsContent value="er" className="space-y-4 pt-4">
            <NumberSlider
              label="Entity padding"
              suffix="px"
              min={6}
              max={40}
              step={2}
              value={draft.er.entityPadding}
              onChange={(v) => setDraft({ ...draft, er: { ...draft.er, entityPadding: v } })}
            />
            <NumberSlider
              label="Entity font size"
              suffix="px"
              min={10}
              max={20}
              step={1}
              value={draft.er.fontSize}
              onChange={(v) => setDraft({ ...draft, er: { ...draft.er, fontSize: v } })}
            />
            <NumberSlider
              label="Stroke width"
              suffix="px"
              min={1}
              max={3}
              step={0.5}
              value={draft.er.strokeWidth}
              onChange={(v) => setDraft({ ...draft, er: { ...draft.er, strokeWidth: v } })}
            />
          </TabsContent>

          {/* SEQUENCE */}
          <TabsContent value="sequence" className="space-y-4 pt-4">
            <NumberSlider
              label="Actor margin"
              suffix="px"
              min={20}
              max={160}
              step={5}
              value={draft.sequence.actorMargin}
              onChange={(v) =>
                setDraft({ ...draft, sequence: { ...draft.sequence, actorMargin: v } })
              }
            />
            <NumberSlider
              label="Message margin"
              suffix="px"
              min={15}
              max={120}
              step={5}
              value={draft.sequence.messageMargin}
              onChange={(v) =>
                setDraft({ ...draft, sequence: { ...draft.sequence, messageMargin: v } })
              }
            />
            <NumberSlider
              label="Box margin"
              suffix="px"
              min={4}
              max={40}
              step={2}
              value={draft.sequence.boxMargin}
              onChange={(v) =>
                setDraft({ ...draft, sequence: { ...draft.sequence, boxMargin: v } })
              }
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save templates
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function NumberSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr_60px] items-center gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <span className="text-xs tabular-nums text-right text-muted-foreground">
        {value}
        {suffix ?? ""}
      </span>
    </div>
  );
}
