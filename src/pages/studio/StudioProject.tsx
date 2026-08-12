import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import InboxWorkspace from "@/components/project/inbox/InboxWorkspace";

interface Project {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  mode?: string;
  [key: string]: unknown;
}

export default function StudioProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const [p, setP] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id, name, description, current_stage, status, mode, owner_id, created_at, updated_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        setP(data as Project | null);
        setLoading(false);
      });
  }, [projectId]);

  if (loading || !p) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <InboxWorkspace project={p} onProjectChange={setP} />;
}

