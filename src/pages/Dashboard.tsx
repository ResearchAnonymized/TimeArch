import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Folder,
  Search,
  LayoutGrid,
  List,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Archive,
  X,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUiMode } from "@/contexts/UiModeContext";
import FeedbackWidget from "@/components/FeedbackWidget";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProjectCard from "@/components/dashboard/ProjectCard";
import ProjectRow from "@/components/dashboard/ProjectRow";
import {
  type Project,
  type StatusFilter,
  type SortKey,
} from "@/components/dashboard/dashboardConstants";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, profile } = useAuth();
  const { mode, loading: modeLoading } = useUiMode();
  useEffect(() => {
    if (!modeLoading && mode === "studio") navigate("/studio/dashboard", { replace: true });
  }, [mode, modeLoading, navigate]);
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"delete" | "archive" | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelected(new Set());
  };

  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, current_stage, status, updated_at, created_at")
        .order("updated_at", { ascending: false });
      if (!error && data) setProjects(data as Project[]);
      setLoading(false);
    };
    fetchProjects();
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.role === "admin") setIsAdmin(true);
      });
  }, [user]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("projects").delete().eq("id", deleteId);
    if (error) {
      toast.error("Failed to delete project");
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success("Project deleted");
    }
    setDeleteId(null);
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);

    if (bulkAction === "delete") {
      let deleted = 0;
      for (const id of ids) {
        const { error } = await supabase.from("projects").delete().eq("id", id);
        if (!error) deleted++;
      }
      setProjects((prev) => prev.filter((p) => !selected.has(p.id)));
      toast.success(`${deleted} project${deleted !== 1 ? "s" : ""} deleted`);
    } else if (bulkAction === "archive") {
      let archived = 0;
      for (const id of ids) {
        const { error } = await supabase
          .from("projects")
          .update({ status: "archived" as any })
          .eq("id", id);
        if (!error) archived++;
      }
      setProjects((prev) =>
        prev.map((p) => (selected.has(p.id) ? { ...p, status: "archived" } : p)),
      );
      toast.success(`${archived} project${archived !== 1 ? "s" : ""} archived`);
    }

    setBulkAction(null);
    exitSelectionMode();
  };

  const handleArchive = async (id: string) => {
    const { error } = await supabase
      .from("projects")
      .update({ status: "archived" as any })
      .eq("id", id);
    if (error) {
      toast.error("Failed to archive project");
    } else {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "archived" } : p)));
      toast.success("Project archived");
    }
  };

  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === "active").length,
      review: projects.filter((p) => p.status === "review").length,
      locked: projects.filter((p) => p.status === "locked").length,
    }),
    [projects],
  );

  const filtered = useMemo(() => {
    let result = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || "").toLowerCase().includes(search.toLowerCase()),
    );
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    result.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "progress") return b.current_stage - a.current_stage;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return result;
  }, [projects, search, statusFilter, sortKey]);

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "?";

  const statCards = [
    {
      label: "Total Projects",
      value: stats.total,
      icon: <Folder className="h-4 w-4" />,
      color: "text-foreground",
      bg: "bg-muted",
    },
    {
      label: "Active",
      value: stats.active,
      icon: <Activity className="h-4 w-4" />,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "In Review",
      value: stats.review,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Completed",
      value: stats.locked,
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: projects.length },
    { key: "active", label: "Active", count: stats.active },
    { key: "review", label: "Review", count: stats.review },
    { key: "locked", label: "Locked", count: stats.locked },
    {
      key: "archived",
      label: "Archived",
      count: projects.filter((p) => p.status === "archived").length,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Beta Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-sm">
        <div className="container flex items-center justify-center gap-2 py-1.5 text-xs font-medium">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>
            <strong>Beta</strong> — TimeArch is experimental. For evaluation and research only.
          </span>
        </div>
      </div>

      <FeedbackWidget />

      <DashboardHeader
        displayName={profile?.display_name}
        email={user?.email}
        avatarUrl={profile?.avatar_url}
        initials={initials}
        isAdmin={isAdmin}
        onSignOut={signOut}
      />

      <div className="container py-8 space-y-6 max-w-7xl">
        {/* Title + Action */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your architecture portfolio
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!selectionMode && filtered.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSelectionMode(true)}
              >
                <CheckSquare className="h-4 w-4" /> Select
              </Button>
            )}
            <Button
              variant="hero"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigate("/project/new")}
            >
              <Plus className="h-4 w-4" /> New project
            </Button>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <AnimatePresence>
          {selectionMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
            >
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={selectAll}>
                <CheckSquare className="h-3.5 w-3.5" />
                {selected.size === filtered.length ? "Deselect All" : "Select All"}
              </Button>

              <span className="text-xs text-muted-foreground">
                {selected.size} of {filtered.length} selected
              </span>

              <div className="flex-1" />

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={selected.size === 0}
                onClick={() => setBulkAction("archive")}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={selected.size === 0}
                onClick={() => setBulkAction("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exitSelectionMode}>
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {projects.length > 0 && !selectionMode && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border bg-card p-4 flex items-center gap-3"
              >
                <div
                  className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}
                >
                  {s.icon}
                </div>
                <div>
                  <p className="text-2xl font-display font-bold leading-none">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-10 pr-4 bg-card border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-body"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    statusFilter === t.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        statusFilter === t.key
                          ? "bg-primary/10 text-primary"
                          : "bg-muted-foreground/10"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 px-3 bg-card border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="updated">Last Updated</option>
              <option value="name">Name</option>
              <option value="progress">Progress</option>
            </select>

            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 border border-dashed rounded-xl bg-card/50"
          >
            <Folder className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-display font-semibold mb-1">
              {projects.length === 0 ? "No projects yet" : "No matching projects"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              {projects.length === 0
                ? "Create your first architecture project to begin."
                : "Try adjusting your search or filters."}
            </p>
            {projects.length === 0 && (
              <Button onClick={() => navigate("/project/new")} className="gap-2">
                <Plus className="h-4 w-4" /> Create Project
              </Button>
            )}
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={i}
                onOpen={(id) => navigate(`/project/${id}`)}
                onDelete={(id) => setDeleteId(id)}
                onArchive={handleArchive}
                selectionMode={selectionMode}
                isSelected={selected.has(project.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((project, i) => (
              <ProjectRow
                key={project.id}
                project={project}
                index={i}
                onOpen={(id) => navigate(`/project/${id}`)}
                onDelete={(id) => setDeleteId(id)}
                onArchive={handleArchive}
                selectionMode={selectionMode}
                isSelected={selected.has(project.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Single Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All project data, requirements, and artifacts will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "delete"
                ? `Delete ${selected.size} project${selected.size !== 1 ? "s" : ""}?`
                : `Archive ${selected.size} project${selected.size !== 1 ? "s" : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "delete"
                ? "This action cannot be undone. All selected projects and their data will be permanently removed."
                : "Selected projects will be moved to the archive. You can find them under the Archived filter."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              className={
                bulkAction === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {bulkAction === "delete" ? "Delete All" : "Archive All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
