import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Save } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function RequirementsWorkspace({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    requirement_id: "",
    title: "",
    description: "",
    type: "functional" as string,
    priority: "medium" as string,
  });

  const fetchRequirements = async () => {
    const { data } = await supabase
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("requirement_id");
    if (data) setRequirements(data);
  };

  useEffect(() => {
    fetchRequirements();
  }, [projectId]);

  const getNextId = () => {
    const prefix =
      form.type === "functional" ? "FR" : form.type === "non_functional" ? "NFR" : "REQ";
    const existing = requirements.filter((r) => r.requirement_id.startsWith(prefix));
    return `${prefix}-${String(existing.length + 1).padStart(3, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const reqId = form.requirement_id || getNextId();
    const { error } = await supabase.from("requirements").insert({
      project_id: projectId,
      requirement_id: reqId,
      title: form.title,
      description: form.description || null,
      type: form.type as any,
      priority: form.priority as any,
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
    });
    setShowForm(false);
    fetchRequirements();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define functional and non-functional requirements for your system.
        </p>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3" /> Add Requirement
        </Button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="rounded-lg border p-4 bg-card space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1">
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
              <Label className="text-xs">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger className="mt-1">
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
          </div>
          <div>
            <Label className="text-xs">Requirement ID (auto-generated if empty)</Label>
            <Input
              value={form.requirement_id}
              onChange={(e) => setForm({ ...form, requirement_id: e.target.value })}
              placeholder={getNextId()}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., User Registration & Authentication"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description, acceptance criteria..."
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="gap-2">
              <Save className="h-3 w-3" /> Save
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </motion.form>
      )}

      {requirements.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm mb-2">No requirements defined yet.</p>
          <p className="text-xs text-muted-foreground">Click "Add Requirement" to start.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requirements.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 rounded-lg border bg-card"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {req.requirement_id}
                  </span>
                  <h4 className="font-display font-semibold text-sm">{req.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      req.priority === "critical"
                        ? "destructive"
                        : req.priority === "high"
                          ? "default"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {req.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {req.status}
                  </Badge>
                </div>
              </div>
              {req.description && (
                <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
