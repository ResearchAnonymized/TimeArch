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
import RunStageCTA from "../RunStageCTA";

interface DriversWorkspaceProps {
  projectId: string;
  refreshKey?: number;
  onRunStage?: (options?: Record<string, unknown>) => void;
  stageRunning?: boolean;
}

export default function DriversWorkspace({
  projectId,
  refreshKey,
  onRunStage,
  stageRunning,
}: DriversWorkspaceProps) {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    description: "",
    priority: "medium",
    category: "functional",
  });

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from("architecture_drivers")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");
    if (data) setDrivers(data);
  };

  useEffect(() => {
    fetchDrivers();
  }, [projectId, refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("architecture_drivers").insert({
      project_id: projectId,
      label: form.label,
      description: form.description || null,
      priority: form.priority as any,
      category: form.category,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Driver added!");
    setForm({ label: "", description: "", priority: "medium", category: "functional" });
    setShowForm(false);
    fetchDrivers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Identify key architectural drivers from your requirements.
        </p>
        <div className="flex items-center gap-2">
          {onRunStage && (
            <RunStageCTA
              stageLabel="Driver Extraction"
              onRun={onRunStage}
              running={stageRunning}
              className="inline"
            />
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3 w-3" /> Add Driver
          </Button>
        </div>
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
              <Label className="text-xs">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="non_functional">Non-Functional</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
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
            <Label className="text-xs">Label</Label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g., Scalability"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the driver..."
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

      {drivers.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm mb-3">
            No architecture drivers identified yet.
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Run the Driver Extraction agent to auto-generate drivers from your requirements, or add
            them manually.
          </p>
          {onRunStage && (
            <RunStageCTA stageLabel="Driver Extraction" onRun={onRunStage} running={stageRunning} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-display font-semibold text-sm">{d.label}</h4>
                <Badge
                  variant={
                    d.priority === "critical"
                      ? "destructive"
                      : d.priority === "high"
                        ? "default"
                        : "secondary"
                  }
                  className="text-[10px]"
                >
                  {d.priority}
                </Badge>
                {d.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {d.category}
                  </Badge>
                )}
              </div>
              {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
