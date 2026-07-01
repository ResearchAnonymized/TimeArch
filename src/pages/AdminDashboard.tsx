import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Users,
  Folder,
  Shield,
  ArrowLeft,
  Search,
  MoreVertical,
  UserPlus,
  Trash2,
  Ban,
  CheckCircle2,
  Activity,
  TrendingUp,
  Building2,
  Clock,
  Mail,
  Crown,
  Eye,
  Edit,
  BarChart3,
  UserCheck,
  XCircle,
  MessageSquare,
  Loader2,
  Star,
  LogOut,
  ChevronRight,
  Home,
  Coins,
  ArrowUpRight,
  User,
  ClipboardCheck,
  FileText,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import ThemeToggle from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";
import SurveySection from "@/components/admin/SurveySection";
import PromptLibrary, { type PromptCatalogItem } from "@/components/prompts/PromptLibrary";
import PromptEditDialog from "@/components/prompts/PromptEditDialog";
import LlmModelsPanel from "@/components/llm/LlmModelsPanel";

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  approval_status: string;
  join_reason: string | null;
}

interface UserWithRole extends UserProfile {
  email?: string;
  role: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  status: string;
  current_stage: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner_name?: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  created_at: string;
  member_count?: number;
}

interface TokenUsageRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  stage: number | null;
  agent_name: string | null;
  created_at: string;
}

interface UserTokenSummary {
  user_id: string;
  display_name: string;
  email?: string;
  role: string;
  avatar_url: string | null;
  total_tokens: number;
  total_cost: number;
  project_count: number;
  projects: { id: string; name: string; tokens: number; cost: number }[];
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  architect: "bg-primary/10 text-primary border-primary/20",
  developer: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  reviewer: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

type AdminSection =
  | "overview"
  | "approvals"
  | "users"
  | "projects"
  | "workspaces"
  | "feedback"
  | "survey"
  | "token-usage"
  | "user-details"
  | "prompts"
  | "llm-models";

const NAV_ITEMS: { key: AdminSection; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
  { key: "token-usage", label: "Token Usage", icon: <Coins className="h-4 w-4" /> },
  { key: "user-details", label: "User Analytics", icon: <User className="h-4 w-4" /> },
  { key: "approvals", label: "Approvals", icon: <UserCheck className="h-4 w-4" /> },
  { key: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { key: "projects", label: "Projects", icon: <Folder className="h-4 w-4" /> },
  { key: "workspaces", label: "Workspaces", icon: <Building2 className="h-4 w-4" /> },
  { key: "feedback", label: "Feedback", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "survey", label: "Survey", icon: <ClipboardCheck className="h-4 w-4" /> },
  { key: "prompts", label: "Prompts", icon: <FileText className="h-4 w-4" /> },
  { key: "llm-models", label: "LLM Models", icon: <Cpu className="h-4 w-4" /> },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [editRoleDialog, setEditRoleDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
  }>({ open: false, user: null });
  const [newRole, setNewRole] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [surveyWorkshopFilter, setSurveyWorkshopFilter] = useState<string>("all");
  const [editingPrompt, setEditingPrompt] = useState<PromptCatalogItem | null>(null);

  useEffect(() => {
    if (!user) return;
    checkAdminAndLoad();
  }, [user]);

  const checkAdminAndLoad = async () => {
    if (!user) return;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (roleData?.role !== "admin") {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }
    setIsAdmin(true);
    await Promise.all([
      loadUsers(),
      loadProjects(),
      loadWorkspaces(),
      loadFeedback(),
      loadTokenUsage(),
      loadSurvey(),
    ]);
    setLoading(false);
  };

  const loadSurvey = async () => {
    const { data } = await supabase
      .from("survey_responses" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSurveyResponses(data as any[]);
  };

  const loadFeedback = async () => {
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map((f: any) => f.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));
      setFeedbackList(
        data.map((f: any) => ({ ...f, user_name: nameMap.get(f.user_id) || "Unknown" })),
      );
    }
  };

  const loadUsers = async () => {
    // approval_status / join_reason / bio are revoked from the authenticated
    // role at the column level; admins read them via SECURITY DEFINER RPC.
    const { data: profiles } = await supabase.rpc("admin_list_profiles");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    let emailMap: Record<string, string> = {};
    try {
      const emailData = await callAuthenticatedFunction<{ emails?: Record<string, string> }>(
        "admin-list-users",
        {},
      );
      if (emailData?.emails) emailMap = emailData.emails;
    } catch (e) {
      console.error("Failed to fetch user emails:", e);
    }
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    setUsers(
      ((profiles as any[]) || []).map((p: any) => ({
        ...p,
        email: emailMap[p.user_id] || undefined,
        role: roleMap.get(p.user_id) || "viewer",
      })),
    );
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) {
      const ownerIds = [...new Set(data.map((p) => p.owner_id))];
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ownerIds);
      const ownerMap = new Map(
        (ownerProfiles || []).map((p) => [p.user_id, p.display_name || "Unknown"]),
      );
      setProjects(data.map((p) => ({ ...p, owner_name: ownerMap.get(p.owner_id) || "Unknown" })));
    }
  };

  const loadWorkspaces = async () => {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const wsData: WorkspaceInfo[] = [];
      for (const org of data) {
        const { count: memberCount } = await supabase
          .from("organization_members")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", org.id);
        wsData.push({ ...org, member_count: memberCount || 0 });
      }
      setWorkspaces(wsData);
    }
  };

  const loadTokenUsage = async () => {
    const { data } = await supabase
      .from("token_usage")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTokenUsage(data as TokenUsageRecord[]);
  };

  const handleUpdateRole = async () => {
    if (!editRoleDialog.user || !newRole) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", editRoleDialog.user.user_id);
      if (error) throw error;
      toast.success(`Role updated to ${newRole}`);
      setEditRoleDialog({ open: false, user: null });
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleApproval = async (userId: string, action: "approved" | "rejected") => {
    setApprovingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: action })
        .eq("user_id", userId);
      if (error) throw error;
      await callAuthenticatedFunction("notify-approval", { user_id: userId, action });
      toast.success(`User ${action === "approved" ? "approved" : "rejected"} successfully`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update approval status");
    } finally {
      setApprovingId(null);
    }
  };

  const [bulkApproving, setBulkApproving] = useState(false);
  const handleBulkApprove = async () => {
    const ids = users.filter((u) => u.approval_status === "pending").map((u) => u.user_id);
    if (ids.length === 0) return;
    if (!confirm(`Approve all ${ids.length} pending users? Approval emails will be sent.`)) return;
    setBulkApproving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: "approved" })
        .in("user_id", ids);
      if (error) throw error;
      // Fire notifications in parallel; don't block on individual failures.
      await Promise.allSettled(
        ids.map((id) =>
          callAuthenticatedFunction("notify-approval", { user_id: id, action: "approved" }),
        ),
      );
      toast.success(`Approved ${ids.length} user${ids.length !== 1 ? "s" : ""}.`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Bulk approval failed");
    } finally {
      setBulkApproving(false);
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.display_name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.email || "").toLowerCase().includes(userSearch.toLowerCase()),
      ),
    [users, userSearch],
  );

  const pendingUsers = useMemo(() => users.filter((u) => u.approval_status === "pending"), [users]);

  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
          (p.owner_name || "").toLowerCase().includes(projectSearch.toLowerCase()),
      ),
    [projects, projectSearch],
  );

  // Token usage aggregations
  const tokenStats = useMemo(() => {
    const totalTokens = tokenUsage.reduce((sum, t) => sum + t.total_tokens, 0);
    const totalCost = tokenUsage.reduce((sum, t) => sum + Number(t.cost_estimate || 0), 0);
    const totalPrompt = tokenUsage.reduce((sum, t) => sum + t.prompt_tokens, 0);
    const totalCompletion = tokenUsage.reduce((sum, t) => sum + t.completion_tokens, 0);

    // Per-project aggregation
    const projectMap = new Map<
      string,
      { name: string; tokens: number; cost: number; runs: number }
    >();
    tokenUsage.forEach((t) => {
      if (!t.project_id) return;
      const existing = projectMap.get(t.project_id) || { name: "", tokens: 0, cost: 0, runs: 0 };
      existing.tokens += t.total_tokens;
      existing.cost += Number(t.cost_estimate || 0);
      existing.runs += 1;
      const proj = projects.find((p) => p.id === t.project_id);
      if (proj) existing.name = proj.name;
      projectMap.set(t.project_id, existing);
    });
    const projectBreakdown = Array.from(projectMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.tokens - a.tokens);

    // Per-model aggregation
    const modelMap = new Map<string, { tokens: number; cost: number; count: number }>();
    tokenUsage.forEach((t) => {
      const existing = modelMap.get(t.model) || { tokens: 0, cost: 0, count: 0 };
      existing.tokens += t.total_tokens;
      existing.cost += Number(t.cost_estimate || 0);
      existing.count += 1;
      modelMap.set(t.model, existing);
    });
    const modelBreakdown = Array.from(modelMap.entries())
      .map(([model, data]) => ({ model, ...data }))
      .sort((a, b) => b.tokens - a.tokens);

    return {
      totalTokens,
      totalCost,
      totalPrompt,
      totalCompletion,
      projectBreakdown,
      modelBreakdown,
    };
  }, [tokenUsage, projects]);

  // Per-user token summaries
  const userTokenSummaries = useMemo((): UserTokenSummary[] => {
    const userMap = new Map<
      string,
      {
        tokens: number;
        cost: number;
        projects: Map<string, { name: string; tokens: number; cost: number }>;
      }
    >();

    tokenUsage.forEach((t) => {
      const existing = userMap.get(t.user_id) || { tokens: 0, cost: 0, projects: new Map() };
      existing.tokens += t.total_tokens;
      existing.cost += Number(t.cost_estimate || 0);
      if (t.project_id) {
        const projData = existing.projects.get(t.project_id) || { name: "", tokens: 0, cost: 0 };
        projData.tokens += t.total_tokens;
        projData.cost += Number(t.cost_estimate || 0);
        const proj = projects.find((p) => p.id === t.project_id);
        if (proj) projData.name = proj.name;
        existing.projects.set(t.project_id, projData);
      }
      userMap.set(t.user_id, existing);
    });

    // Also include users with 0 tokens
    const allUserIds = new Set([...users.map((u) => u.user_id), ...userMap.keys()]);

    return Array.from(allUserIds)
      .map((userId) => {
        const u = users.find((usr) => usr.user_id === userId);
        const data = userMap.get(userId);
        const projectsList = data
          ? Array.from(data.projects.entries())
              .map(([id, d]) => ({ id, ...d }))
              .sort((a, b) => b.tokens - a.tokens)
          : [];
        return {
          user_id: userId,
          display_name: u?.display_name || "Unknown",
          email: u?.email,
          role: u?.role || "viewer",
          avatar_url: u?.avatar_url || null,
          total_tokens: data?.tokens || 0,
          total_cost: data?.cost || 0,
          project_count: projectsList.length,
          projects: projectsList,
        };
      })
      .sort((a, b) => b.total_tokens - a.total_tokens);
  }, [tokenUsage, users, projects]);

  const selectedUserDetail = useMemo(() => {
    if (!selectedUserId) return null;
    return userTokenSummaries.find((u) => u.user_id === selectedUserId) || null;
  }, [selectedUserId, userTokenSummaries]);

  // User's projects (owned)
  const selectedUserProjects = useMemo(() => {
    if (!selectedUserId) return [];
    return projects.filter((p) => p.owner_id === selectedUserId);
  }, [selectedUserId, projects]);

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status === "active").length,
      totalWorkspaces: workspaces.length,
      pendingApprovals: pendingUsers.length,
      totalTokens: tokenStats.totalTokens,
    }),
    [users, projects, workspaces, pendingUsers, tokenStats],
  );

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "?";

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center">
              <Shield className="h-4 w-4 text-destructive-foreground" />
            </div>
            <div>
              <p className="font-display text-sm font-bold tracking-tight">Admin Console</p>
              <p className="text-[10px] text-muted-foreground">TimeArch Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-3"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="h-px bg-border mb-3" />

          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.key;
            const badge =
              item.key === "approvals" && stats.pendingApprovals > 0
                ? stats.pendingApprovals
                : item.key === "feedback" && feedbackList.length > 0
                  ? feedbackList.length
                  : null;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {badge && (
                  <span className="h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center px-1.5 font-semibold">
                    {badge}
                  </span>
                )}
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/60" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-display font-semibold text-primary overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{profile?.display_name || user?.email}</p>
              <Badge
                variant="outline"
                className="text-[9px] mt-0.5 px-1.5 py-0 border-destructive/30 text-destructive"
              >
                Admin
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl space-y-6">
          {/* Section title */}
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight capitalize">
              {activeSection === "overview"
                ? "Dashboard Overview"
                : activeSection === "token-usage"
                  ? "Token Usage & Cost Tracking"
                  : activeSection === "user-details"
                    ? "User Analytics"
                    : activeSection}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeSection === "overview" && "System-wide metrics and activity"}
              {activeSection === "approvals" &&
                `${stats.pendingApprovals} pending approval${stats.pendingApprovals !== 1 ? "s" : ""}`}
              {activeSection === "users" &&
                `${users.length} registered user${users.length !== 1 ? "s" : ""}`}
              {activeSection === "projects" &&
                `${projects.length} total project${projects.length !== 1 ? "s" : ""}`}
              {activeSection === "workspaces" &&
                `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}`}
              {activeSection === "feedback" &&
                `${feedbackList.length} feedback entr${feedbackList.length !== 1 ? "ies" : "y"}`}
              {activeSection === "token-usage" &&
                `${formatTokens(stats.totalTokens)} total tokens consumed across all projects`}
              {activeSection === "user-details" &&
                "Detailed per-user token consumption and project ownership"}
              {activeSection === "survey" &&
                `${surveyResponses.length} survey response${surveyResponses.length !== 1 ? "s" : ""} collected`}
              {activeSection === "prompts" &&
                "Inspect and override every system prompt that drives a TimeArch agent"}
              {activeSection === "llm-models" &&
                "Every model TimeArch can call, plus custom and local LLM endpoints"}
            </p>
          </div>

          {/* ── Overview ── */}
          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  {
                    label: "Total Users",
                    value: stats.totalUsers,
                    icon: <Users className="h-4 w-4" />,
                    color: "text-primary",
                    bg: "bg-primary/10",
                  },
                  {
                    label: "Pending",
                    value: stats.pendingApprovals,
                    icon: <Clock className="h-4 w-4" />,
                    color: "text-amber-500",
                    bg: "bg-amber-500/10",
                  },
                  {
                    label: "Projects",
                    value: stats.totalProjects,
                    icon: <Folder className="h-4 w-4" />,
                    color: "text-violet-500",
                    bg: "bg-violet-500/10",
                  },
                  {
                    label: "Active",
                    value: stats.activeProjects,
                    icon: <Activity className="h-4 w-4" />,
                    color: "text-emerald-500",
                    bg: "bg-emerald-500/10",
                  },
                  {
                    label: "Total Tokens",
                    value: formatTokens(stats.totalTokens),
                    icon: <Coins className="h-4 w-4" />,
                    color: "text-orange-500",
                    bg: "bg-orange-500/10",
                  },
                ].map((s, i) => (
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

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-display font-semibold mb-4">Role Distribution</h3>
                  <div className="space-y-3">
                    {["admin", "architect", "developer", "reviewer", "viewer"].map((role) => {
                      const count = users.filter((u) => u.role === role).length;
                      const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                      return (
                        <div key={role} className="flex items-center gap-3">
                          <span className="text-xs font-medium capitalize w-20">{role}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-display font-semibold mb-4">Project Status</h3>
                  <div className="space-y-3">
                    {["active", "review", "locked", "archived"].map((status) => {
                      const count = projects.filter((p) => p.status === status).length;
                      const pct = projects.length ? Math.round((count / projects.length) * 100) : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className="text-xs font-medium capitalize w-20">{status}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Token Consumers - quick view */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold">Top Token Consumers</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => setActiveSection("token-usage")}
                    >
                      View All <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {userTokenSummaries.slice(0, 5).map((u) => (
                      <div
                        key={u.user_id}
                        className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors"
                        onClick={() => {
                          setSelectedUserId(u.user_id);
                          setActiveSection("user-details");
                        }}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            (u.display_name || "?").charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {u.project_count} project{u.project_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-display font-bold text-orange-500">
                            {formatTokens(u.total_tokens)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            ${u.total_cost.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {userTokenSummaries.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No token usage recorded yet
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-display font-semibold mb-4">Recent Projects</h3>
                  <div className="space-y-3">
                    {projects.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors"
                        onClick={() => navigate(`/project/${p.id}`)}
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Folder className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            by {p.owner_name} · Stage {p.current_stage}/18
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Token Usage ── */}
          {activeSection === "token-usage" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total Tokens",
                    value: formatTokens(tokenStats.totalTokens),
                    icon: <Coins className="h-4 w-4" />,
                    color: "text-orange-500",
                    bg: "bg-orange-500/10",
                  },
                  {
                    label: "Prompt Tokens",
                    value: formatTokens(tokenStats.totalPrompt),
                    icon: <ArrowUpRight className="h-4 w-4" />,
                    color: "text-blue-500",
                    bg: "bg-blue-500/10",
                  },
                  {
                    label: "Completion Tokens",
                    value: formatTokens(tokenStats.totalCompletion),
                    icon: <Zap className="h-4 w-4" />,
                    color: "text-emerald-500",
                    bg: "bg-emerald-500/10",
                  },
                  {
                    label: "Est. Cost",
                    value: `$${tokenStats.totalCost.toFixed(4)}`,
                    icon: <TrendingUp className="h-4 w-4" />,
                    color: "text-destructive",
                    bg: "bg-destructive/10",
                  },
                ].map((s, i) => (
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

              <div className="grid md:grid-cols-2 gap-4">
                {/* Per-project breakdown */}
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-display font-semibold mb-4">Token Usage by Project</h3>
                  <div className="space-y-3">
                    {tokenStats.projectBreakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No token usage recorded yet
                      </p>
                    ) : (
                      tokenStats.projectBreakdown.map((p) => {
                        const pct = tokenStats.totalTokens
                          ? Math.round((p.tokens / tokenStats.totalTokens) * 100)
                          : 0;
                        return (
                          <div key={p.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate max-w-[200px]">
                                {p.name || "Unknown Project"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTokens(p.tokens)} ({pct}%)
                              </span>
                            </div>
                            <Progress value={pct} className="h-2" />
                            <p className="text-[10px] text-muted-foreground">
                              {p.runs} runs · Est. ${p.cost.toFixed(4)}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Per-model breakdown */}
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-display font-semibold mb-4">Token Usage by Model</h3>
                  <div className="space-y-3">
                    {tokenStats.modelBreakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No token usage recorded yet
                      </p>
                    ) : (
                      tokenStats.modelBreakdown.map((m) => {
                        const pct = tokenStats.totalTokens
                          ? Math.round((m.tokens / tokenStats.totalTokens) * 100)
                          : 0;
                        return (
                          <div key={m.model} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium font-mono truncate max-w-[200px]">
                                {m.model}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTokens(m.tokens)} ({pct}%)
                              </span>
                            </div>
                            <Progress value={pct} className="h-2" />
                            <p className="text-[10px] text-muted-foreground">
                              {m.count} calls · Est. ${m.cost.toFixed(4)}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Recent token usage log */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-display font-semibold">Recent Token Usage Log</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokenUsage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No token usage records yet. Usage will appear as AI agents process tasks.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tokenUsage.slice(0, 20).map((t) => {
                        const u = users.find((usr) => usr.user_id === t.user_id);
                        const p = projects.find((pr) => pr.id === t.project_id);
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-xs">
                              {u?.display_name || "Unknown"}
                            </TableCell>
                            <TableCell className="text-xs truncate max-w-[150px]">
                              {p?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{t.model}</TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {formatTokens(t.total_tokens)}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              ${Number(t.cost_estimate || 0).toFixed(4)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* ── User Analytics / Details ── */}
          {activeSection === "user-details" && (
            <>
              {!selectedUserId ? (
                /* User list with token summary */
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Projects</TableHead>
                          <TableHead className="text-right">Total Tokens</TableHead>
                          <TableHead className="text-right">Est. Cost</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userTokenSummaries
                          .filter(
                            (u) =>
                              u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                              (u.email || "").toLowerCase().includes(userSearch.toLowerCase()),
                          )
                          .map((u) => (
                            <TableRow
                              key={u.user_id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedUserId(u.user_id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden shrink-0">
                                    {u.avatar_url ? (
                                      <img
                                        src={u.avatar_url}
                                        alt=""
                                        className="h-9 w-9 rounded-full object-cover"
                                      />
                                    ) : (
                                      (u.display_name || "?").charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{u.display_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {u.email || "—"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] capitalize ${ROLE_COLORS[u.role] || ""}`}
                                >
                                  {u.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {u.project_count}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`text-sm font-display font-bold ${u.total_tokens > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                                >
                                  {formatTokens(u.total_tokens)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                ${u.total_cost.toFixed(4)}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                /* Selected user detail view */
                <div className="space-y-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 -ml-2"
                    onClick={() => setSelectedUserId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to all users
                  </Button>

                  {selectedUserDetail && (
                    <>
                      {/* User header card */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border bg-card p-6"
                      >
                        <div className="flex items-start gap-4">
                          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-display font-bold text-primary overflow-hidden shrink-0">
                            {selectedUserDetail.avatar_url ? (
                              <img
                                src={selectedUserDetail.avatar_url}
                                alt=""
                                className="h-14 w-14 rounded-full object-cover"
                              />
                            ) : (
                              (selectedUserDetail.display_name || "?").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-xl font-display font-bold">
                                {selectedUserDetail.display_name}
                              </h2>
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize ${ROLE_COLORS[selectedUserDetail.role] || ""}`}
                              >
                                {selectedUserDetail.role}
                              </Badge>
                            </div>
                            {selectedUserDetail.email && (
                              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" /> {selectedUserDetail.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                            <p className="text-2xl font-display font-bold text-orange-500">
                              {formatTokens(selectedUserDetail.total_tokens)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Total Tokens</p>
                          </div>
                          <div className="rounded-lg bg-destructive/10 p-3 text-center">
                            <p className="text-2xl font-display font-bold text-destructive">
                              ${selectedUserDetail.total_cost.toFixed(4)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Est. Cost</p>
                          </div>
                          <div className="rounded-lg bg-primary/10 p-3 text-center">
                            <p className="text-2xl font-display font-bold text-primary">
                              {selectedUserProjects.length}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Projects Owned
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      {/* User's projects */}
                      <div className="rounded-xl border bg-card p-6">
                        <h3 className="font-display font-semibold mb-4">Projects Created</h3>
                        {selectedUserProjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No projects created by this user
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {selectedUserProjects.map((p) => {
                              const projTokens = selectedUserDetail.projects.find(
                                (tp) => tp.id === p.id,
                              );
                              return (
                                <div
                                  key={p.id}
                                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                  onClick={() => navigate(`/project/${p.id}`)}
                                >
                                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Folder className="h-5 w-5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Stage {p.current_stage}/18 ·{" "}
                                      {format(new Date(p.created_at), "MMM d, yyyy")}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-display font-bold text-orange-500">
                                      {formatTokens(projTokens?.tokens || 0)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      ${(projTokens?.cost || 0).toFixed(4)}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] capitalize shrink-0"
                                  >
                                    {p.status}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Token usage by project for this user */}
                      {selectedUserDetail.projects.length > 0 && (
                        <div className="rounded-xl border bg-card p-6">
                          <h3 className="font-display font-semibold mb-4">
                            Token Consumption Breakdown
                          </h3>
                          <div className="space-y-3">
                            {selectedUserDetail.projects.map((p) => {
                              const pct = selectedUserDetail.total_tokens
                                ? Math.round((p.tokens / selectedUserDetail.total_tokens) * 100)
                                : 0;
                              return (
                                <div key={p.id} className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium truncate max-w-[250px]">
                                      {p.name || "Unknown"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTokens(p.tokens)} ({pct}%)
                                    </span>
                                  </div>
                                  <Progress value={pct} className="h-2" />
                                  <p className="text-[10px] text-muted-foreground">
                                    Est. ${p.cost.toFixed(4)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Approvals ── */}
          {activeSection === "approvals" &&
            (pendingUsers.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-lg font-display font-semibold">No Pending Approvals</p>
                <p className="text-sm text-muted-foreground">
                  All user requests have been processed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border bg-card p-3">
                  <p className="text-sm text-muted-foreground">
                    {pendingUsers.length} pending user{pendingUsers.length !== 1 ? "s" : ""} — use bulk approve for workshops/events.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={bulkApproving}
                    onClick={handleBulkApprove}
                  >
                    {bulkApproving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Approve all {pendingUsers.length}
                  </Button>
                </div>
                {pendingUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border bg-card p-5 space-y-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {(u.display_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{u.display_name || "Unnamed"}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          >
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        </div>
                        {u.email && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Registered{" "}
                          {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {u.join_reason && (
                      <div className="rounded-lg bg-muted/50 border p-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                          <MessageSquare className="h-3.5 w-3.5" /> Why they want to join
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{u.join_reason}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={approvingId === u.user_id}
                        onClick={() => handleApproval(u.user_id, "approved")}
                      >
                        {approvingId === u.user_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        disabled={approvingId === u.user_id}
                        onClick={() => handleApproval(u.user_id, "rejected")}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}

          {/* ── Users ── */}
          {activeSection === "users" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Joined</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden shrink-0">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt=""
                                  className="h-9 w-9 rounded-full object-cover"
                                />
                              ) : (
                                (u.display_name || "?").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {u.display_name || "Unnamed"}
                              </p>
                              {u.bio && (
                                <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  {u.bio}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {u.email || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${ROLE_COLORS[u.role] || ""}`}
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${
                              u.approval_status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : u.approval_status === "pending"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {u.approval_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {format(new Date(u.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditRoleDialog({ open: true, user: u });
                                  setNewRole(u.role);
                                }}
                              >
                                <Edit className="h-3.5 w-3.5 mr-2" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedUserId(u.user_id);
                                  setActiveSection("user-details");
                                }}
                              >
                                <BarChart3 className="h-3.5 w-3.5 mr-2" /> View Analytics
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Projects ── */}
          {activeSection === "projects" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="hidden md:table-cell">Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="hidden lg:table-cell">Updated</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((p) => {
                      const projTokenData = tokenStats.projectBreakdown.find(
                        (tb) => tb.id === p.id,
                      );
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/project/${p.id}`)}
                        >
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {p.description || "No description"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{p.owner_name}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs font-mono">
                            {p.current_stage}/18
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-xs font-display font-bold ${(projTokenData?.tokens || 0) > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                            >
                              {formatTokens(projTokenData?.tokens || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/project/${p.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ── Workspaces ── */}
          {activeSection === "workspaces" && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="hidden md:table-cell">Members</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No workspaces created yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    workspaces.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-amber-500" />
                            </div>
                            <span className="text-sm font-medium">{w.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {w.slug}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {w.member_count} members
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {format(new Date(w.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Feedback ── */}
          {activeSection === "feedback" &&
            (feedbackList.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-display font-semibold">No Feedback Yet</p>
                <p className="text-sm text-muted-foreground">
                  Feedback from testers will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackList.map((fb: any) => (
                  <div key={fb.id} className="rounded-xl border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {(fb.user_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{fb.user_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(fb.created_at), { addSuffix: true })}
                            {fb.page_url && <span> · {fb.page_url}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {fb.category}
                        </Badge>
                        {fb.rating && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${s <= fb.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{fb.message}</p>
                  </div>
                ))}
              </div>
            ))}

          {/* ── Survey Responses ── */}
          {activeSection === "survey" && <SurveySection responses={surveyResponses} workshopFilter={surveyWorkshopFilter} setWorkshopFilter={setSurveyWorkshopFilter} />}

          {/* ── Prompt Library ── */}
          {activeSection === "prompts" && (
            <PromptLibrary
              embedded
              isAdmin
              onEdit={(p) => setEditingPrompt(p)}
            />
          )}

          {/* ── LLM Models ── */}
          {activeSection === "llm-models" && <LlmModelsPanel isAdmin />}
        </div>
      </main>

      {/* Edit Role Dialog */}
      <Dialog
        open={editRoleDialog.open}
        onOpenChange={(open) =>
          setEditRoleDialog({ open, user: open ? editRoleDialog.user : null })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Update role for <strong>{editRoleDialog.user?.display_name || "Unknown"}</strong>
            </p>
            <div>
              <Label className="text-xs">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRoleDialog({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt edit dialog */}
      <PromptEditDialog prompt={editingPrompt} onClose={() => setEditingPrompt(null)} />
    </div>
  );
}
