import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import StudioLayout from "@/layouts/StudioLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUiMode } from "@/contexts/UiModeContext";
import { cn } from "@/lib/utils";
import {
  loadDiscoveryProgressMap,
  type DiscoveryCaseProgress,
} from "@/lib/discoveryCase";

interface P {
  id: string;
  name: string;
  description: string | null;
  current_stage: number;
  status: string;
  mode: string;
  updated_at: string;
}

const STAGE_LABEL: Record<number, string> = {
  1: "setting up",
  2: "reviewing requirements",
  3: "critiquing requirements",
  4: "identifying drivers",
  5: "picking an architecture style",
  15: "waiting for stakeholder approval",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function StudioDashboard() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { mode, loading: modeLoading } = useUiMode();
  const [projects, setProjects] = useState<P[]>([]);
  const [discoveryMap, setDiscoveryMap] = useState<Record<string, DiscoveryCaseProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!modeLoading && mode === "classic") nav("/dashboard", { replace: true });
  }, [mode, modeLoading, nav]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, description, current_stage, status, mode, updated_at")
        .neq("status", "archived")
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const list = (data as P[]) ?? [];
      setProjects(list);
      const brownfieldIds = list
        .filter((p) => p.mode === "brownfield" || p.mode === "hybrid")
        .map((p) => p.id);
      if (brownfieldIds.length) {
        const map = await loadDiscoveryProgressMap(brownfieldIds);
        if (!cancelled) setDiscoveryMap(map);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = useMemo(
    () => (profile?.display_name || user?.email || "").split(/[ @]/)[0],
    [profile, user],
  );

  return (
    <StudioLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">
          <Sparkles className="inline h-3 w-3 mr-1 text-primary" /> Studio
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
          {greeting()}
          {firstName && <span className="text-muted-foreground">, {firstName}</span>}.
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
          Design one architecture at a time. TimeArch guides you stage by stage — you decide when
          to move forward.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mb-10"
      >
        <button
          onClick={() => nav("/project/new")}
          className="group relative w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-left transition hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">
                Start something new
              </p>
              <h2 className="font-display text-2xl font-semibold">Begin a new architecture</h2>
              <p className="text-sm text-muted-foreground mt-1">
                From a blank canvas or an existing codebase — TimeArch takes it from here.
              </p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-110">
              <Plus className="h-5 w-5" />
            </span>
          </div>
        </button>
      </motion.div>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Continue where you left off</h2>
          <p className="text-xs text-muted-foreground">{projects.length} active</p>
        </div>

        {loading ? (
          <div className="h-40 rounded-2xl border border-dashed animate-pulse bg-muted/30" />
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No projects yet. Start your first one above.
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p, i) => (
              <ProjectJourneyCard
                key={p.id}
                p={p}
                index={i}
                discovery={discoveryMap[p.id]}
                onOpen={() => nav(`/studio/project/${p.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    </StudioLayout>
  );
}

function ProjectJourneyCard({
  p,
  index,
  discovery,
  onOpen,
}: {
  p: P;
  index: number;
  discovery?: DiscoveryCaseProgress;
  onOpen: () => void;
}) {
  const isBrownfield = p.mode === "brownfield" || p.mode === "hybrid";
  const closed = p.status === "locked" || discovery?.phase === "closed";

  const pct = isBrownfield
    ? discovery?.pct ?? 0
    : Math.round((p.current_stage / 18) * 100);

  const ringLabel = isBrownfield
    ? `${discovery?.completed ?? 0}`
    : String(p.current_stage);
  const ringSub = isBrownfield ? `of ${discovery?.total ?? 5}` : "of 18";

  const label = closed
    ? "case closed"
    : isBrownfield
      ? discovery?.label || "starting discovery"
      : STAGE_LABEL[p.current_stage] ?? `working on stage ${p.current_stage}`;

  const stageTone = closed
    ? "text-emerald-700 bg-emerald-500/10"
    : isBrownfield
      ? discovery?.phase === "released"
        ? "text-emerald-700 bg-emerald-500/10"
        : discovery?.phase === "change"
          ? "text-primary bg-primary/10"
          : "text-sky-700 bg-sky-500/10"
      : p.current_stage <= 3
        ? "text-primary bg-primary/10"
        : p.current_stage <= 10
          ? "text-violet-600 bg-violet-500/10"
          : p.current_stage <= 14
            ? "text-amber-600 bg-amber-500/10"
            : "text-emerald-600 bg-emerald-500/10";

  const updated = new Date(p.updated_at);
  const rel = relTime(updated);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      onClick={onOpen}
      className="group relative w-full text-left rounded-2xl border bg-card/70 backdrop-blur-sm p-5 transition hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-center gap-5">
        <div className="relative h-16 w-16 shrink-0">
          <svg className="-rotate-90" width={64} height={64}>
            <circle
              cx={32}
              cy={32}
              r={26}
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              className="text-muted opacity-30"
            />
            <circle
              cx={32}
              cy={32}
              r={26}
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 26}
              strokeDashoffset={2 * Math.PI * 26 * (1 - pct / 100)}
              className={cn(
                "transition-all duration-700",
                closed ? "text-emerald-500" : "text-primary",
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {closed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <>
                <span className="text-sm font-bold font-display">{ringLabel}</span>
                <span className="text-[8px] text-muted-foreground -mt-0.5">{ringSub}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold truncate">{p.name}</h3>
            {isBrownfield && (
              <span className="text-[9px] uppercase tracking-wide rounded border px-1.5 py-0.5 text-muted-foreground">
                Brownfield
              </span>
            )}
            {closed && (
              <span className="text-[9px] uppercase tracking-wide rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
                Closed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3" /> Updated {rel}
            {isBrownfield && discovery?.detail ? ` · ${discovery.detail}` : ""}
          </p>
          <p className="text-sm text-foreground/80 mt-2">
            You're{" "}
            <span className={cn("px-1.5 py-0.5 rounded font-medium text-xs", stageTone)}>
              {label}
            </span>
          </p>
        </div>

        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </motion.button>
  );
}

function relTime(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
