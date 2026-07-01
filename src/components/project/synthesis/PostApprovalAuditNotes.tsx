import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileCheck2,
  UserCheck,
  Lock,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Fingerprint,
  Copy,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Compute a deterministic SHA-256 hash over a canonical JSON payload.
 * Keys are sorted so the same logical content always produces the same hash.
 */
async function computeAuditHash(payload: unknown): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Props {
  projectId: string;
}

interface ApprovalRow {
  id: string;
  stage: number;
  action: string;
  approved_by: string;
  comment: string | null;
  created_at: string;
}

interface ArtifactRow {
  id: string;
  stage: number;
  type: string;
  title: string;
  status: string;
  version: number;
  locked_at: string | null;
  locked_by: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

const STAGE_LABELS: Record<number, string> = {
  1: "Requirement Collection",
  2: "Requirement Analysis",
  3: "Architecture Drivers",
  4: "Style Selection",
  5: "Tradeoff Evaluation",
  6: "System Decomposition",
  7: "Data Architecture",
  8: "API & Integration",
  9: "Cross-Cutting Concerns",
  10: "Infrastructure & Deployment",
  11: "Quality Attributes",
  12: "Risk Assessment",
  13: "Architecture Validation",
  14: "Documentation & ADRs",
};

// Stages whose locked artifacts are mandatory inputs to Code Generation (Stage 16).
const REQUIRED_FOR_CODEGEN = [3, 4, 6, 7, 8, 9, 10, 13, 14];

/**
 * Post-Approval Audit Notes
 *
 * Renders a tamper-evident summary after Stage 15 approval that documents:
 *  1. WHAT was approved — every locked architecture artifact (stage, title, version)
 *  2. WHO approved it — the approver display name + UTC timestamp per stage lock
 *  3. WHAT IS LOCKED before code generation — readiness checklist for Stage 16 gate
 *
 * This is read-only and meant to be exportable evidence for governance/compliance.
 */
export default function PostApprovalAuditNotes({ projectId }: Props) {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(true);
  const [auditHash, setAuditHash] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [appRes, artRes] = await Promise.all([
        supabase
          .from("stage_approvals")
          .select("id, stage, action, approved_by, comment, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase
          .from("architecture_artifacts")
          .select("id, stage, type, title, status, version, locked_at, locked_by")
          .eq("project_id", projectId)
          .order("stage", { ascending: true }),
      ]);

      if (cancelled) return;

      const apps = (appRes.data ?? []) as ApprovalRow[];
      const arts = (artRes.data ?? []) as ArtifactRow[];
      setApprovals(apps);
      setArtifacts(arts);

      // Resolve approver display names
      const approverIds = Array.from(
        new Set([
          ...apps.map((a) => a.approved_by).filter(Boolean),
          ...arts.map((a) => a.locked_by).filter((v): v is string => !!v),
        ]),
      );
      if (approverIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", approverIds);
        if (!cancelled && profs) {
          const map: Record<string, string> = {};
          (profs as ProfileRow[]).forEach((p) => {
            map[p.user_id] = p.display_name || "Unknown user";
          });
          setProfiles(map);
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const lockedApprovals = approvals.filter((a) => a.action === "locked");
  const stage15Approvals = approvals.filter(
    (a) => a.stage === 15 && (a.action === "approved" || a.action === "locked"),
  );
  const lockedArtifacts = artifacts.filter((a) => a.status === "locked");

  // Codegen readiness — does each required upstream stage have at least one locked artifact?
  const lockedStageSet = new Set(lockedArtifacts.map((a) => a.stage));
  const missingForCodegen = REQUIRED_FOR_CODEGEN.filter((s) => !lockedStageSet.has(s));
  const readyForCodegen = stage15Approvals.length > 0 && missingForCodegen.length === 0;

  // Canonical payload used for the tamper-evident hash.
  // Sorting + minimal field selection ensures determinism across reloads/clients.
  const hashPayload = useMemo(
    () => ({
      project_id: projectId,
      locked_artifacts: [...lockedArtifacts]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((a) => ({
          id: a.id,
          stage: a.stage,
          type: a.type,
          title: a.title,
          version: a.version,
          status: a.status,
          locked_at: a.locked_at,
          locked_by: a.locked_by,
        })),
      stage15_approvals: [...stage15Approvals]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((a) => ({
          id: a.id,
          action: a.action,
          approved_by: a.approved_by,
          created_at: a.created_at,
          comment: a.comment,
        })),
    }),
    [projectId, lockedArtifacts, stage15Approvals],
  );

  useEffect(() => {
    let cancelled = false;
    computeAuditHash(hashPayload).then((h) => {
      if (!cancelled) setAuditHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [hashPayload]);

  const shortHash = auditHash ? `${auditHash.slice(0, 12)}…${auditHash.slice(-8)}` : "";

  const copyHash = async () => {
    if (!auditHash) return;
    try {
      await navigator.clipboard.writeText(auditHash);
      setCopied(true);
      toast.success("Audit hash copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Failed to copy hash");
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Group locked artifacts by stage for the "what was approved" section
  const artifactsByStage = lockedArtifacts.reduce<Record<number, ArtifactRow[]>>((acc, a) => {
    (acc[a.stage] ||= []).push(a);
    return acc;
  }, {});
  const stagesWithLocks = Object.keys(artifactsByStage)
    .map(Number)
    .sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
        Loading audit notes…
      </div>
    );
  }

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <FileCheck2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-display font-semibold">Post-Approval Audit Notes</h4>
          <p className="text-[10.5px] text-muted-foreground">
            Tamper-evident record of what was approved, by whom, and what's locked before code
            generation.
          </p>
        </div>
        <Badge
          className={cn(
            "text-[9px] border gap-1",
            readyForCodegen
              ? "bg-success/10 text-success border-success/30"
              : "bg-warning/10 text-warning border-warning/30",
          )}
        >
          {readyForCodegen ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              Ready for code generation
            </>
          ) : (
            <>
              <AlertTriangle className="h-3 w-3" />
              {stage15Approvals.length === 0 ? "Awaiting Stage 15 approval" : "Locks incomplete"}
            </>
          )}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse audit notes" : "Expand audit notes"}
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="p-4 space-y-5">
          {/* Why this exists */}
          <div className="flex gap-2 text-[10.5px] text-muted-foreground bg-muted/30 border border-border/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>
              These notes freeze the architectural baseline at approval time. Every entry below is
              pulled directly from the project's lock and approval records — nothing is regenerated
              by AI. Use this as the formal handoff evidence for downstream code generation.
            </p>
          </div>

          {/* Tamper-evident hash signature */}
          <div className="rounded-md border border-primary/30 bg-primary/5 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/20 bg-primary/10">
              <Fingerprint className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-display font-semibold">
                Tamper-Evident Audit Hash
              </span>
              <Badge className="ml-auto text-[9px] bg-background/60 text-muted-foreground border border-border/60">
                SHA-256
              </Badge>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[10.5px] text-muted-foreground">
                Deterministic fingerprint computed over every locked artifact (id, stage, version,
                lock metadata) and Stage 15 approval. If anything changes downstream, this hash will
                change. Verify it matches before running code generation.
              </p>
              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2">
                <code
                  className="flex-1 text-[10.5px] font-mono break-all leading-relaxed"
                  title={auditHash}
                  aria-label="Full audit hash"
                >
                  {auditHash || "Computing…"}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={copyHash}
                  disabled={!auditHash}
                  aria-label="Copy audit hash"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="font-mono">short: {shortHash || "—"}</span>
                <span>·</span>
                <span>
                  covers {lockedArtifacts.length} artifact(s) + {stage15Approvals.length} Stage 15
                  approval(s)
                </span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCheck className="h-3 w-3" />
              Approval Authority (Stage 15)
            </h5>
            {stage15Approvals.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 px-3 py-3 text-[11px] text-muted-foreground">
                No Stage 15 approval has been recorded yet. Lock Stage 15 once stakeholders sign
                off.
              </div>
            ) : (
              <div className="space-y-1.5">
                {stage15Approvals.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-md border bg-success/5 border-success/20 text-[11px]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    <span className="font-semibold capitalize">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">by</span>
                    <span className="font-mono">{profiles[a.approved_by] || "Unknown user"}</span>
                    <span className="text-muted-foreground ml-auto tabular-nums">
                      {fmtDate(a.created_at)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 2. WHAT was approved — locked artifacts grouped by stage */}
          <div>
            <h5 className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileCheck2 className="h-3 w-3" />
              Locked Artifacts ({lockedArtifacts.length})
            </h5>
            {stagesWithLocks.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 px-3 py-3 text-[11px] text-muted-foreground">
                No artifacts are locked yet.
              </div>
            ) : (
              <div className="space-y-2">
                {stagesWithLocks.map((stage) => (
                  <div key={stage} className="rounded-md border bg-background/40">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20">
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {String(stage).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] font-display font-semibold">
                        {STAGE_LABELS[stage] || `Stage ${stage}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {artifactsByStage[stage].length} artifact
                        {artifactsByStage[stage].length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/40">
                      {artifactsByStage[stage].map((art) => (
                        <li
                          key={art.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
                        >
                          <Lock className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="truncate flex-1">{art.title}</span>
                          <span className="text-[9.5px] font-mono text-muted-foreground">
                            v{art.version}
                          </span>
                          {art.locked_by && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              · {profiles[art.locked_by] || "Unknown"}
                            </span>
                          )}
                          {art.locked_at && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              · {fmtDate(art.locked_at)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Inputs locked before code generation */}
          <div>
            <h5 className="text-[11px] font-display font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Inputs Locked Before Code Generation
            </h5>
            <p className="text-[10.5px] text-muted-foreground mb-2">
              The following stages must have at least one locked artifact before Stage 16 (Code
              Generation) can run.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {REQUIRED_FOR_CODEGEN.map((stage) => {
                const isLocked = lockedStageSet.has(stage);
                return (
                  <div
                    key={stage}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[11px]",
                      isLocked
                        ? "bg-success/5 border-success/20"
                        : "bg-warning/5 border-warning/30",
                    )}
                  >
                    {isLocked ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-success flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    )}
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {String(stage).padStart(2, "0")}
                    </span>
                    <span className="font-display font-medium truncate flex-1">
                      {STAGE_LABELS[stage]}
                    </span>
                    <span
                      className={cn(
                        "text-[9.5px] font-semibold",
                        isLocked ? "text-success" : "text-warning",
                      )}
                    >
                      {isLocked ? "Locked" : "Missing"}
                    </span>
                  </div>
                );
              })}
            </div>
            {missingForCodegen.length > 0 && (
              <p className="text-[10.5px] text-warning mt-2">
                {missingForCodegen.length} required input
                {missingForCodegen.length === 1 ? "" : "s"} still need to be locked before code
                generation can proceed.
              </p>
            )}
          </div>

          {/* Footer summary line */}
          <div className="text-[10px] text-muted-foreground border-t pt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>{lockedApprovals.length} stage lock(s) recorded</span>
            <span>·</span>
            <span>{lockedArtifacts.length} artifact(s) locked</span>
            <span>·</span>
            <span>{stage15Approvals.length} Stage 15 approval(s)</span>
          </div>
        </div>
      )}
    </section>
  );
}
