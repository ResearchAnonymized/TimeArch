import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  ArrowLeft,
  ShoppingCart,
  HeartPulse,
  GraduationCap,
  Landmark,
  Truck,
  Gamepad2,
  Building2,
  Leaf,
  Sparkles,
  Compass,
  Rocket,
  ArrowRight,
  GitBranch,
  Database,
  Globe,
  FileCode,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

const DEMO_TEMPLATES = [
  {
    icon: ShoppingCart,
    name: "E-Commerce Marketplace",
    description:
      "Multi-vendor marketplace with product catalog, cart, checkout, payments (Stripe), order tracking, reviews, seller dashboard, and recommendation engine. Must handle 50K concurrent users with sub-200ms response times.",
    color: "from-primary/15 to-primary/5",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
  },
  {
    icon: HeartPulse,
    name: "Healthcare Patient Portal",
    description:
      "HIPAA-compliant patient portal with appointment booking, medical records, lab results, telemedicine video calls, prescription management, and secure messaging with providers. Must integrate with Epic EHR via HL7 FHIR.",
    color: "from-rose-500/15 to-rose-500/5",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-500",
  },
  {
    icon: GraduationCap,
    name: "Learning Management System",
    description:
      "Online education platform with course creation, video streaming, quizzes, progress tracking, certificates, discussion forums, and live classes. Supports SCORM/xAPI standards and 10K concurrent learners.",
    color: "from-violet-500/15 to-violet-500/5",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-500",
  },
  {
    icon: Landmark,
    name: "Banking & Fintech App",
    description:
      "Digital banking platform with account management, fund transfers, bill payments, investment portfolio, KYC verification, fraud detection, and real-time notifications. PCI-DSS compliant with 99.99% uptime SLA.",
    color: "from-emerald-500/15 to-emerald-500/5",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-500",
  },
  {
    icon: Truck,
    name: "Logistics & Fleet Management",
    description:
      "Fleet tracking platform with real-time GPS monitoring, route optimization, delivery scheduling, driver management, fuel analytics, maintenance alerts, and customer delivery notifications. Supports 5K+ vehicles.",
    color: "from-amber-500/15 to-amber-500/5",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-500",
  },
  {
    icon: Building2,
    name: "SaaS Project Management",
    description:
      "Multi-tenant project management tool with Kanban boards, Gantt charts, time tracking, resource allocation, sprint planning, reporting dashboards, Slack/Jira integrations, and role-based access control.",
    color: "from-cyan-500/15 to-cyan-500/5",
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-500",
  },
  {
    icon: Gamepad2,
    name: "Real-Time Multiplayer Game Backend",
    description:
      "Game backend with matchmaking, leaderboards, player profiles, in-app purchases, real-time WebSocket game state sync, anti-cheat system, and analytics. Must handle 100K concurrent connections with <50ms latency.",
    color: "from-pink-500/15 to-pink-500/5",
    iconBg: "bg-pink-500/15",
    iconColor: "text-pink-500",
  },
  {
    icon: Leaf,
    name: "Smart Agriculture IoT Platform",
    description:
      "IoT platform for precision farming with sensor data ingestion (soil, weather, moisture), automated irrigation control, crop health analytics, drone integration, yield prediction, and farmer mobile app. Supports 50K+ edge devices.",
    color: "from-green-600/15 to-green-600/5",
    iconBg: "bg-green-600/15",
    iconColor: "text-green-600 dark:text-green-400",
  },
];

// Brownfield real-world starters — `id` must match the catalog served by fetch-demo-source
const BROWNFIELD_STARTERS = [
  {
    id: "petstore-api",
    icon: Globe,
    name: "Swagger Petstore",
    description:
      "Classic OpenAPI 3 reference spec. 20+ endpoints across pet, store, and user domains — perfect to seed an API-first brownfield project.",
    tag: "OpenAPI · small",
    sourceRepo: "https://github.com/OAI/OpenAPI-Specification",
    color: "from-amber-500/15 to-amber-500/5",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "sakila-db",
    icon: Database,
    name: "Sakila Sample DB",
    description:
      "MySQL Sakila schema — 16 tables modelling a DVD rental business. Great for legacy-database discovery and ER reconstruction.",
    tag: "SQL schema · medium",
    sourceRepo: "https://github.com/jOOQ/jOOQ",
    color: "from-blue-500/15 to-blue-500/5",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "realworld-fullstack",
    icon: GitBranch,
    name: "RealWorld Conduit API",
    description:
      "Node/Express reference backend behind the RealWorld 'Medium clone'. JWT auth, articles, comments, follows — a complete small monolith to reverse-engineer.",
    tag: "Node repo · medium",
    sourceRepo: "https://github.com/gothinkster/realworld",
    color: "from-emerald-500/15 to-emerald-500/5",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "spring-petclinic",
    icon: FileCode,
    name: "Spring PetClinic",
    description:
      "Canonical Spring Boot sample app — controllers, JPA entities, Thymeleaf views. The textbook legacy Java codebase to baseline.",
    tag: "Java repo · large",
    sourceRepo: "https://github.com/spring-projects/spring-petclinic",
    color: "from-violet-500/15 to-violet-500/5",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
];

type Phase = "pick-mode" | "configure";
type Mode = "greenfield" | "brownfield";

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("pick-mode");
  const [mode, setMode] = useState<Mode>("greenfield");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const choose = (m: Mode) => {
    setMode(m);
    setName("");
    setDescription("");
    setSelectedStarterId(null);
    setPhase("configure");
  };

  const handleSelectTemplate = (t: { name: string; description: string }) => {
    setName(t.name);
    setDescription(t.description);
  };

  const handleSelectStarter = (s: (typeof BROWNFIELD_STARTERS)[number]) => {
    if (selectedStarterId === s.id) {
      setSelectedStarterId(null);
      return;
    }
    setSelectedStarterId(s.id);
    if (!name.trim()) setName(s.name);
    if (!description.trim()) setDescription(s.description);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name,
          description,
          owner_id: user.id,
          mode,
          current_stage: mode === "brownfield" ? 0 : 1,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("project_members").insert({
        project_id: data.id,
        user_id: user.id,
        role: "architect" as any,
      });

      // Brownfield + starter selected → seed real-world files via edge function
      if (mode === "brownfield" && selectedStarterId) {
        setSeeding(true);
        const starter = BROWNFIELD_STARTERS.find((s) => s.id === selectedStarterId);
        // Persist starter info so Discovery workspace can show context (no repeat gallery)
        try {
          window.localStorage.setItem(
            `timearch.discovery.preset.${data.id}`,
            JSON.stringify({
              id: starter?.id,
              name: starter?.name,
              description: starter?.description,
              tag: starter?.tag,
              sourceRepo: starter?.sourceRepo,
            }),
          );
        } catch {}
        toast.info(`Fetching ${starter?.name}…`, {
          description: "Pulling files from the public source. This can take 10–30s.",
        });
        try {
          const { data: seedResult, error: seedErr } = await supabase.functions.invoke(
            "fetch-demo-source",
            {
              body: { project_id: data.id, preset_id: selectedStarterId },
            },
          );
          if (seedErr) throw seedErr;
          if (seedResult?.error) throw new Error(seedResult.error);
          const uploaded = seedResult?.uploaded ?? 0;
          const total = seedResult?.total ?? 0;
          const failed = total - uploaded;
          if (uploaded > 0) {
            toast.success(
              `Seeded with ${uploaded}/${total} file${total === 1 ? "" : "s"}${failed ? ` (${failed} skipped)` : ""}`,
            );
          } else {
            toast.warning("No files were imported — open Discovery to retry or upload manually.");
          }
        } catch (seedErr: any) {
          toast.error(`Seeding failed: ${seedErr.message || seedErr}`, {
            description:
              "Project was created — you can retry seeding from the Discovery workspace.",
          });
        } finally {
          setSeeding(false);
        }
      } else {
        toast.success("Project created!");
      }
      navigate(`/project/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <button
            onClick={() => (phase === "configure" ? setPhase("pick-mode") : navigate("/dashboard"))}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{phase === "configure" ? "Change project type" : "Back to dashboard"}</span>
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">TimeArch</span>
          </div>
        </div>
      </header>

      <div className="container max-w-4xl py-12">
        {/* STEP 1 — Pick mode */}
        {phase === "pick-mode" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-2xl font-display font-bold mb-2">New project</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Are you starting from a blank slate, or bringing an existing system into TimeArch?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* New project */}
              <motion.button
                whileHover={{ y: -3 }}
                onClick={() => choose("greenfield")}
                className="text-left p-6 rounded-2xl border-2 border-border/60 hover:border-primary/60 bg-gradient-to-br from-primary/5 to-transparent transition-all group"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-display text-lg font-bold">New project</h2>
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    greenfield
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Start from scratch. Design a brand-new system end-to-end through the full 18-stage
                  architecture lifecycle.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-5">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" /> Demo templates to bootstrap
                    requirements
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" /> Begins at Stage 1 — Vision
                    & Scope
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary" /> No code or schema upload
                    needed
                  </li>
                </ul>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all">
                  Set up new project <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </motion.button>

              {/* Existing project */}
              <motion.button
                whileHover={{ y: -3 }}
                onClick={() => choose("brownfield")}
                className="text-left p-6 rounded-2xl border-2 border-border/60 hover:border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent transition-all group"
              >
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                  <Compass className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-display text-lg font-bold">Existing project</h2>
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    brownfield
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Evolve a system that already exists. We add a Discovery stage to read your code,
                  schemas, OpenAPI specs and ADRs.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-5">
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-500" /> Real-world demo systems
                    to try in one click
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-500" /> Begins at Stage 0 —
                    Discovery
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-500" /> Auto gap-analysis &
                    evolution plan
                  </li>
                </ul>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 group-hover:gap-2.5 transition-all">
                  Set up existing project <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* STEP 2 — Configure (mode-specific playground) */}
        {phase === "configure" && mode === "greenfield" && (
          <motion.div
            key="green"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="h-4 w-4 text-primary" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">
                Greenfield · new system
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">Create new project</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Pick a demo template to bootstrap, or describe your new system from scratch.
            </p>

            {/* Demo templates */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-display font-bold">Demo templates</h2>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Click to populate
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DEMO_TEMPLATES.map((t, i) => (
                  <motion.button
                    key={t.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSelectTemplate(t)}
                    className={`relative group p-4 rounded-xl border border-border/60 bg-gradient-to-br ${t.color} text-left transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 ${name === t.name ? "ring-2 ring-primary border-primary/60" : ""}`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg ${t.iconBg} flex items-center justify-center mb-2.5`}
                    >
                      <t.icon className={`h-4 w-4 ${t.iconColor}`} />
                    </div>
                    <h4 className="font-display font-bold text-xs leading-tight">{t.name}</h4>
                  </motion.button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Project name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., E-Commerce Platform"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="desc" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this system is about, its goals, stakeholders, and key requirements..."
                  className="mt-1 min-h-[120px]"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setPhase("pick-mode")}>
                  Back
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting ? "Creating..." : "Create new project"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {phase === "configure" && mode === "brownfield" && (
          <motion.div
            key="brown"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">
                Brownfield · existing system
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold mb-2">Create existing project</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Give your existing system a name. After it's created you'll land in the{" "}
              <strong>Discovery workspace</strong> where you can upload code, schemas, OpenAPI specs
              and ADRs — or seed it with a real open-source system in one click.
            </p>

            {/* Real-world starters */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-display font-bold">Real-world starter systems</h2>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Click to seed on create
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Pick one to fetch its real files from the public source and seed your Discovery
                workspace automatically. You can also skip and upload your own files later.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BROWNFIELD_STARTERS.map((s, i) => {
                  const isSelected = selectedStarterId === s.id;
                  return (
                    <motion.button
                      type="button"
                      key={s.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ y: -2 }}
                      onClick={() => handleSelectStarter(s)}
                      className={`text-left p-4 rounded-xl border bg-gradient-to-br ${s.color} transition-all ${
                        isSelected
                          ? "border-amber-500 ring-2 ring-amber-500/40 shadow-md"
                          : "border-border/60 hover:border-amber-500/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}
                        >
                          <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-display font-bold text-xs">{s.name}</h4>
                            <span className="text-[9px] font-mono text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded">
                              {s.tag}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                                SELECTED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {s.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {selectedStarterId && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  On create, we'll fetch the real files for this starter and drop them into your
                  Discovery workspace.
                </p>
              )}
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">
                  Project name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Legacy Order Platform"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="desc" className="text-sm font-medium">
                  What does this system do today?{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of the existing system — domain, tech stack, known pain points. You can leave this blank; Discovery will infer most of it."
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase("pick-mode")}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {seeding
                    ? "Fetching real files…"
                    : submitting
                      ? "Creating…"
                      : selectedStarterId
                        ? `Create & seed with ${BROWNFIELD_STARTERS.find((s) => s.id === selectedStarterId)?.name}`
                        : "Create existing project & open Discovery"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
