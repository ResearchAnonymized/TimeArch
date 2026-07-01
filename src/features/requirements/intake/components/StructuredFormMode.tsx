import { useState } from "react";
import { ChevronDown, ClipboardList, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function StructuredFormMode({
  projectId,
  onSaved,
  onBack,
}: {
  projectId: string;
  onSaved: () => void;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    requirement_id: "",
    title: "",
    description: "",
    type: "functional" as string,
    priority: "medium" as string,
    category: "",
    source: "manual",
    acceptance_criteria: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("requirements").insert({
      project_id: projectId,
      requirement_id: form.requirement_id || `REQ-${Date.now().toString(36).toUpperCase()}`,
      title: form.title,
      description: form.description || null,
      type: form.type as any,
      priority: form.priority as any,
      category: form.category || null,
      source: form.source || null,
      acceptance_criteria: form.acceptance_criteria
        ? form.acceptance_criteria.split("\n").filter(Boolean)
        : null,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Requirement added!");
    setForm({
      requirement_id: "",
      title: "",
      description: "",
      type: "functional",
      priority: "medium",
      category: "",
      source: "manual",
      acceptance_criteria: "",
    });
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <ChevronDown className="h-3 w-3 rotate-90" /> Back to methods
      </button>

      <div className="rounded-xl border bg-gradient-to-b from-emerald-500/5 to-transparent p-5 mb-2">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="font-display font-bold text-sm mb-0.5">Manual Requirement Entry</h4>
            <p className="text-xs text-muted-foreground">
              Fill in the structured form below to add a single requirement with full metadata.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-semibold">Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="functional">Functional</SelectItem>
              <SelectItem value="non_functional">Non-Functional</SelectItem>
              <SelectItem value="user_story">User Story</SelectItem>
              <SelectItem value="constraint">Constraint</SelectItem>
              <SelectItem value="assumption">Assumption</SelectItem>
              <SelectItem value="dependency">Dependency</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold">Priority</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold">Category</Label>
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="e.g., security, performance"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold">Requirement ID (auto if empty)</Label>
          <Input
            value={form.requirement_id}
            onChange={(e) => setForm({ ...form, requirement_id: e.target.value })}
            placeholder="FR-001"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Source</Label>
          <Input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="e.g., stakeholder interview, SRS doc"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold">Title</Label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g., User Registration & Authentication"
          className="mt-1.5"
          required
        />
      </div>

      <div>
        <Label className="text-xs font-semibold">Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Detailed requirement description..."
          className="mt-1.5 min-h-[80px]"
        />
      </div>

      <div>
        <Label className="text-xs font-semibold">Acceptance Criteria (one per line)</Label>
        <Textarea
          value={form.acceptance_criteria}
          onChange={(e) => setForm({ ...form, acceptance_criteria: e.target.value })}
          placeholder="Users can register with email and password&#10;Password must be at least 8 characters&#10;Email verification is sent on registration"
          className="mt-1.5 min-h-[80px]"
        />
      </div>

      <Button type="submit" size="sm" className="gap-2 h-10">
        <Save className="h-4 w-4" /> Save Requirement
      </Button>
    </form>
  );
}
