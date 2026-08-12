import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import InboxWorkspace from "@/components/project/inbox/InboxWorkspace";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  mode?: string;
  [key: string]: unknown;
}

export default function ProjectWorkspace() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !user) return;
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate("/dashboard");
          return;
        }
        setProject(data as ProjectData);
        setLoading(false);
      });
  }, [projectId, user, navigate]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <InboxWorkspace project={project} onProjectChange={setProject} />
      {isAdmin && projectId && (
        <Link
          to={`/experiments/${projectId}`}
          title="Open Experiment Ground (admin)"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 shadow-lg backdrop-blur hover:bg-amber-500/20 dark:text-amber-300"
        >
          <FlaskConical className="h-4 w-4" />
          Experiment Ground
        </Link>
      )}
    </>
  );
}
