/**
 * Admin-only landing page that lists every project the current user can access
 * and lets them jump straight into that project's Experiment Ground.
 *
 * Added because the floating pill on ProjectWorkspace was easy to miss and
 * Studio mode doesn't render it at all.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export default function ExperimentsHub() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("projects")
      .select("id,name,description,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setProjects((data as ProjectRow[]) ?? []));
  }, [user]);

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Admins only</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The Experiment Ground is restricted to admin accounts.
            </p>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-1" />Dashboard
            </Button>
            <div className="flex items-center gap-2 pl-3 border-l">
              <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold">Experiment Ground</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold">Empirical validation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a project to open its Experiment Ground — seed the corpus, run the
            6-stage brownfield loop, and export the aggregated report.
          </p>
        </div>

        {projects === null ? (
          <div className="text-sm text-muted-foreground">Loading projects…</div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You don't have any projects yet. Create one from the dashboard first.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to={`/experiments/${p.id}`} className="block">
                <Card className="h-full transition hover:border-primary hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{p.name}</span>
                      <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {p.description || "No description."}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
