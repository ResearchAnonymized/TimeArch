import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Lock,
  Loader2,
  Send,
  RotateCcw,
  Filter,
  HelpCircle,
  Sparkles,
  Eye,
  Shield,
  Target,
  Plus,
  X,
  Zap,
  Download,
  FileJson,
  FileText,
  FileSpreadsheet,
  Archive,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpTip } from "./HelpTip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";

// ── Types ──────────────────────────────────────────
interface Requirement {
  id: string;
  requirement_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  category: string | null;
  source: string | null;
  acceptance_criteria: any;
  locked_at: string | null;
}

interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  options: { label: string; value: string }[];
  affectedRequirements: string[];
  answered: boolean;
  selectedOptions: string[];
  freeText: string;
}

interface Props {
  projectId: string;
  requirements: Requirement[];
  onRefresh: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30 font-semibold",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const TYPE_BORDER: Record<string, string> = {
  functional: "border-l-primary",
  non_functional: "border-l-emerald-500",
  user_story: "border-l-violet-500",
  constraint: "border-l-slate-400",
  assumption: "border-l-amber-500",
  dependency: "border-l-cyan-500",
};

// ── Export Helpers ─────────────────────────────────────
async function exportRequirementsAsZip(requirements: Requirement[], projectId: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // 1. Full JSON
  zip.file("requirements.json", JSON.stringify(requirements, null, 2));

  // 2. Markdown
  let md = `# Requirements Export\n\n`;
  md += `**Project:** ${projectId}\n**Total:** ${requirements.length}\n**Exported:** ${new Date().toISOString()}\n\n---\n\n`;
  const grouped: Record<string, Requirement[]> = {};
  requirements.forEach((r) => {
    const key = r.type || "other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  for (const [type, reqs] of Object.entries(grouped)) {
    md += `## ${type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} (${reqs.length})\n\n`;
    for (const r of reqs) {
      md += `### ${r.requirement_id}: ${r.title}\n\n`;
      md += `- **Priority:** ${r.priority}\n- **Status:** ${r.status}\n- **Category:** ${r.category || "—"}\n- **Source:** ${r.source || "—"}\n\n`;
      if (r.description) md += `${r.description}\n\n`;
      if (
        r.acceptance_criteria &&
        Array.isArray(r.acceptance_criteria) &&
        r.acceptance_criteria.length > 0
      ) {
        md += `**Acceptance Criteria:**\n`;
        r.acceptance_criteria.forEach((ac: string) => {
          md += `- ${ac}\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    }
  }
  zip.file("requirements.md", md);

  // 3. CSV
  const csvHeaders = [
    "ID",
    "Title",
    "Type",
    "Priority",
    "Status",
    "Category",
    "Source",
    "Description",
  ];
  const csvRows = requirements.map((r) =>
    [
      r.requirement_id,
      r.title,
      r.type,
      r.priority,
      r.status,
      r.category || "",
      r.source || "",
      (r.description || "").replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
  zip.file("requirements.csv", [csvHeaders.join(","), ...csvRows].join("\n"));

  // 4. Individual files per requirement
  const reqFolder = zip.folder("individual");
  requirements.forEach((r) => {
    reqFolder?.file(`${r.requirement_id}.json`, JSON.stringify(r, null, 2));
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `requirements_export_${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRequirementsAsJSON(requirements: Requirement[]) {
  const blob = new Blob([JSON.stringify(requirements, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `requirements_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportRequirementsAsCSV(requirements: Requirement[]) {
  const headers = [
    "ID",
    "Title",
    "Type",
    "Priority",
    "Status",
    "Category",
    "Source",
    "Description",
  ];
  const rows = requirements.map((r) =>
    [
      r.requirement_id,
      r.title,
      r.type,
      r.priority,
      r.status,
      r.category || "",
      r.source || "",
      (r.description || "").replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `requirements_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Review Decision Card ──────────────────────────────
function ReviewDecisionCard({
  req,
  onApprove,
  onReject,
  onRequestChange,
  onUnlock,
}: {
  req: Requirement;
  onApprove: () => void;
  onReject: () => void;
  onRequestChange: (comment: string) => void;
  onUnlock?: () => void;
}) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");

  const isFinalized = req.status === "approved" || req.status === "locked";
  const borderColor = TYPE_BORDER[req.type] || TYPE_BORDER.functional;

  const statusBadge =
    req.status === "approved" ? (
      <Badge className="text-[9px] bg-success/15 text-success border-success/30 gap-0.5">
        <CheckCircle2 className="h-2.5 w-2.5" /> Approved
      </Badge>
    ) : req.status === "locked" ? (
      <Badge className="text-[9px] bg-primary/15 text-primary border-primary/30 gap-0.5">
        <Lock className="h-2.5 w-2.5" /> Locked
      </Badge>
    ) : req.status === "reviewed" ? (
      <Badge className="text-[9px] bg-warning/15 text-warning border-warning/30 gap-0.5">
        <Eye className="h-2.5 w-2.5" /> Needs Changes
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[9px]">
        Draft
      </Badge>
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border-l-[3px] ${borderColor} border border-border/60 bg-card overflow-hidden transition-all hover:shadow-sm ${
        isFinalized ? "bg-success/[0.03]" : req.status === "reviewed" ? "bg-warning/[0.03]" : ""
      }`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
              {req.requirement_id}
            </span>
            <h4 className="font-display font-semibold text-sm leading-tight truncate">
              {req.title}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge variant="outline" className="text-[9px] capitalize">
              {req.type.replace(/_/g, " ")}
            </Badge>
            <Badge
              className={`text-[9px] border ${PRIORITY_STYLES[req.priority] || PRIORITY_STYLES.medium}`}
            >
              {req.priority}
            </Badge>
            {statusBadge}
          </div>
        </div>

        {/* Description */}
        {req.description && (
          <p className="text-[11px] text-muted-foreground mb-2.5 line-clamp-3 leading-relaxed">
            {req.description}
          </p>
        )}

        {/* Acceptance Criteria */}
        {req.acceptance_criteria &&
          Array.isArray(req.acceptance_criteria) &&
          req.acceptance_criteria.length > 0 && (
            <div className="mb-3 pl-3 border-l-2 border-primary/20">
              <p className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                Acceptance Criteria
              </p>
              {(req.acceptance_criteria as string[]).map((c, i) => (
                <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success/60 mt-0.5 flex-shrink-0" /> {c}
                </p>
              ))}
            </div>
          )}

        {/* Actions */}
        {!isFinalized && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
            <Button
              size="sm"
              className="h-8 text-[11px] gap-1.5 bg-success hover:bg-success/90 text-success-foreground shadow-sm"
              onClick={onApprove}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Approve
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] gap-1.5 text-warning border-warning/30 hover:bg-warning/10"
              onClick={() => setShowComment(!showComment)}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Request Change
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[11px] gap-1.5 text-destructive hover:bg-destructive/10"
              onClick={onReject}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}

        {/* Unlock action for finalized requirements */}
        {isFinalized && onUnlock && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] gap-1.5 text-warning border-warning/30 hover:bg-warning/10"
              onClick={onUnlock}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Unlock & Re-review
            </Button>
          </div>
        )}

        {/* Comment for change request */}
        <AnimatePresence>
          {showComment && !isFinalized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Describe what needs to be changed..."
                  className="text-xs min-h-[60px]"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-[11px] gap-1"
                    disabled={!comment.trim()}
                    onClick={() => {
                      onRequestChange(comment);
                      setShowComment(false);
                      setComment("");
                    }}
                  >
                    <Send className="h-3 w-3" /> Submit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[11px]"
                    onClick={() => {
                      setShowComment(false);
                      setComment("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Ambiguity Clarification Card ─────────────────────
function ClarificationCard({
  question,
  onAnswer,
}: {
  question: ClarificationQuestion;
  onAnswer: (selectedOptions: string[], freeText: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(question.selectedOptions);
  const [freeText, setFreeText] = useState(question.freeText);
  const [showFreeText, setShowFreeText] = useState(false);

  const toggleOption = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-5 transition-all ${
        question.answered
          ? "border-success/30 bg-success/[0.03]"
          : "border-warning/30 bg-warning/[0.03]"
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            question.answered ? "bg-success/15" : "bg-warning/15"
          }`}
        >
          {question.answered ? (
            <CheckCircle2 className="h-4.5 w-4.5 text-success" />
          ) : (
            <HelpCircle className="h-4.5 w-4.5 text-warning" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-display font-bold leading-tight">{question.question}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            {question.context}
          </p>
          {question.affectedRequirements.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] text-muted-foreground font-medium">Affects:</span>
              {question.affectedRequirements.map((id) => (
                <Badge key={id} variant="outline" className="text-[9px] font-mono">
                  {id}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkbox options */}
      <div className="space-y-2 ml-12 mb-3">
        {question.options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-start gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggleOption(opt.value)}
              disabled={question.answered}
              className="mt-0.5"
            />
            <span
              className={`text-xs leading-relaxed ${question.answered ? "text-muted-foreground" : "text-foreground"}`}
            >
              {opt.label}
            </span>
          </label>
        ))}

        {/* Add custom option */}
        {!question.answered && (
          <button
            onClick={() => setShowFreeText(!showFreeText)}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors ml-2 font-medium"
          >
            <Plus className="h-3 w-3" />
            {showFreeText ? "Hide custom input" : "Add your own clarification"}
          </button>
        )}
      </div>

      {/* Free text input */}
      <AnimatePresence>
        {(showFreeText || (question.answered && question.freeText)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-12 mb-3"
          >
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Provide additional clarification or context..."
              className="text-xs min-h-[50px]"
              disabled={question.answered}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      {!question.answered && (
        <div className="flex gap-2 ml-12">
          <Button
            size="sm"
            className="h-8 text-[11px] gap-1.5"
            disabled={selected.length === 0 && !freeText.trim()}
            onClick={() => onAnswer(selected, freeText)}
          >
            <Send className="h-3 w-3" /> Submit Answer
          </Button>
        </div>
      )}

      {/* Answered indicator */}
      {question.answered && (
        <div className="ml-12 pt-3 border-t border-success/20 mt-3">
          <p className="text-[11px] text-success font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Clarification submitted
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Review & Approve Panel ──────────────────────
export default function RequirementReviewPanel({ projectId, requirements, onRefresh }: Props) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "reviewed">("all");
  const [clarifications, setClarifications] = useState<ClarificationQuestion[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  const draftReqs = requirements.filter((r) => r.status === "draft");
  const approvedReqs = requirements.filter((r) => r.status === "approved" || r.status === "locked");
  const reviewedReqs = requirements.filter((r) => r.status === "reviewed");
  const filtered =
    filter === "all"
      ? requirements
      : filter === "draft"
        ? draftReqs
        : filter === "approved"
          ? approvedReqs
          : reviewedReqs;

  const generateClarifications = async () => {
    if (!user || requirements.length === 0) return;
    setGeneratingQuestions(true);

    try {
      const data = await callAuthenticatedFunction<any>("process-requirements", {
        project_id: projectId,
        user_id: user.id,
        input_text: `CLARIFICATION MODE: Analyze these existing requirements and generate clarifying questions to resolve ambiguities, fill gaps, and validate assumptions.\n\nRequirements:\n${requirements
          .map(
            (r) =>
              `${r.requirement_id}: ${r.title} — ${r.description || "No description"} [Type: ${r.type}, Priority: ${r.priority}]`,
          )
          .join("\n")}`,
        input_mode: "clarification_analysis",
        existing_requirements: requirements.map((r) => ({ id: r.requirement_id, title: r.title })),
      });

      const parsed = data.data;
      const questions: ClarificationQuestion[] = [];

      if (parsed.ambiguities?.length > 0) {
        parsed.ambiguities.forEach((amb: any, i: number) => {
          questions.push({
            id: amb.id || `AMB-${i + 1}`,
            question: amb.suggested_clarification || amb.description,
            context: amb.description,
            options: generateOptionsForAmbiguity(amb),
            affectedRequirements: amb.affected_requirements || [],
            answered: false,
            selectedOptions: [],
            freeText: "",
          });
        });
      }

      if (parsed.missing_information?.length > 0) {
        parsed.missing_information.forEach((mis: any, i: number) => {
          questions.push({
            id: mis.id || `MIS-${i + 1}`,
            question: `How should we address: ${mis.description}?`,
            context: mis.impact || mis.description,
            options: generateOptionsForMissing(mis),
            affectedRequirements: [],
            answered: false,
            selectedOptions: [],
            freeText: "",
          });
        });
      }

      if (parsed.contradictions?.length > 0) {
        parsed.contradictions.forEach((ctr: any, i: number) => {
          questions.push({
            id: ctr.id || `CTR-${i + 1}`,
            question: `How should we resolve: ${ctr.description}?`,
            context: ctr.suggested_resolution || ctr.description,
            options: [
              { label: `Keep ${ctr.between?.[0] || "first"} requirement`, value: "keep_first" },
              { label: `Keep ${ctr.between?.[1] || "second"} requirement`, value: "keep_second" },
              { label: "Merge both into a single requirement", value: "merge" },
              { label: "Keep both — they serve different purposes", value: "keep_both" },
            ],
            affectedRequirements: ctr.between || [],
            answered: false,
            selectedOptions: [],
            freeText: "",
          });
        });
      }

      if (questions.length === 0) {
        toast.info("No ambiguities detected — requirements look well-defined!");
      } else {
        toast.success(`Generated ${questions.length} clarification questions`);
      }

      setClarifications(questions);
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze requirements");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const generateOptionsForAmbiguity = (amb: any): { label: string; value: string }[] => {
    return [
      { label: "This is intentional — leave as is", value: "intentional" },
      { label: "Needs more detail — I'll provide clarification", value: "needs_detail" },
      { label: "Remove this requirement — not needed", value: "remove" },
      { label: "Split into multiple specific requirements", value: "split" },
    ];
  };

  const generateOptionsForMissing = (mis: any): { label: string; value: string }[] => {
    return [
      { label: "This is critical — add as a new requirement", value: "add_critical" },
      { label: "Nice to have — add with low priority", value: "add_low" },
      { label: "Out of scope — skip for now", value: "out_of_scope" },
      { label: "Already covered by existing requirements", value: "already_covered" },
    ];
  };

  const approveRequirement = async (reqId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "approved" as any,
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "requirement",
      entity_id: reqId,
      action: "approved",
      details: { method: "manual_review" },
    });

    toast.success("Requirement approved");
    onRefresh();
  };

  const rejectRequirement = async (reqId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "draft" as any,
        description:
          requirements.find((r) => r.id === reqId)?.description +
          "\n\n[REJECTED — Removed from consideration]",
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "requirement",
      entity_id: reqId,
      action: "rejected",
    });

    toast.success("Requirement rejected");
    onRefresh();
  };

  const requestChange = async (reqId: string, comment: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "reviewed" as any,
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("comments").insert({
      project_id: projectId,
      requirement_id: reqId,
      user_id: user.id,
      content: `[Change Request] ${comment}`,
      stage: 1,
    });

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "requirement",
      entity_id: reqId,
      action: "revision_requested",
      details: { comment },
    });

    toast.success("Change request submitted");
    onRefresh();
  };

  const unlockRequirement = async (reqId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("requirements")
      .update({
        status: "draft" as any,
        locked_at: null,
        locked_by: null,
      })
      .eq("id", reqId);
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "requirement",
      entity_id: reqId,
      action: "unlocked",
      details: { method: "review_panel" },
    });

    toast.success("Requirement unlocked for re-review");
    onRefresh();
  };

  const approveAllDraft = async () => {
    if (!user || draftReqs.length === 0) return;
    setBulkApproving(true);
    let count = 0;
    for (const req of draftReqs) {
      const { error } = await supabase
        .from("requirements")
        .update({
          status: "approved" as any,
        })
        .eq("id", req.id);
      if (!error) count++;
    }

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "requirement",
      action: "bulk_approved",
      details: { count },
    });

    toast.success(`Approved ${count} requirements`);
    setBulkApproving(false);
    onRefresh();
  };

  const handleClarificationAnswer = async (
    questionId: string,
    selectedOptions: string[],
    freeText: string,
  ) => {
    if (!user) return;

    setClarifications((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, answered: true, selectedOptions: selectedOptions, freeText }
          : q,
      ),
    );

    await supabase.from("audit_log").insert({
      project_id: projectId,
      user_id: user.id,
      entity_type: "clarification",
      action: "answered",
      details: {
        question_id: questionId,
        selected_options: selectedOptions,
        free_text: freeText,
      },
    });

    toast.success("Clarification submitted");
  };

  const answeredCount = clarifications.filter((q) => q.answered).length;
  const totalQuestions = clarifications.length;
  const progress =
    requirements.length > 0 ? Math.round((approvedReqs.length / requirements.length) * 100) : 0;

  if (requirements.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-border/60">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <Eye className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h3 className="font-display font-bold text-lg mb-2">No Requirements to Review</h3>
        <p className="text-sm text-muted-foreground">Add requirements via the Collect tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Visual Status Dashboard */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            key: "all" as const,
            label: "Total",
            count: requirements.length,
            color: "text-foreground",
            iconBg: "bg-primary/15",
            icon: Target,
            iconColor: "text-primary",
          },
          {
            key: "draft" as const,
            label: "Pending",
            count: draftReqs.length,
            color: "text-muted-foreground",
            iconBg: "bg-muted",
            icon: Eye,
            iconColor: "text-muted-foreground",
          },
          {
            key: "approved" as const,
            label: "Approved",
            count: approvedReqs.length,
            color: "text-success",
            iconBg: "bg-success/15",
            icon: CheckCircle2,
            iconColor: "text-success",
          },
          {
            key: "reviewed" as const,
            label: "Changes",
            count: reviewedReqs.length,
            color: "text-warning",
            iconBg: "bg-warning/15",
            icon: AlertTriangle,
            iconColor: "text-warning",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-xl border p-4 text-left transition-all ${
                filter === item.key
                  ? "ring-2 ring-primary/30 border-primary/40 shadow-sm"
                  : "border-border/60 hover:border-border hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </span>
                <div
                  className={`h-7 w-7 rounded-lg ${item.iconBg} flex items-center justify-center`}
                >
                  <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${item.color}`}>{item.count}</p>
            </button>
          );
        })}
      </div>

      {/* Progress Bar + Actions */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm">Review Progress</h3>
              <p className="text-[11px] text-muted-foreground">
                {approvedReqs.length}/{requirements.length} approved · {progress}% complete
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    exportRequirementsAsZip(requirements, projectId);
                    toast.success("ZIP export started");
                  }}
                  className="gap-2 text-xs"
                >
                  <Archive className="h-3.5 w-3.5" /> Download as ZIP (All Formats)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    exportRequirementsAsJSON(requirements);
                    toast.success("Exported as JSON");
                  }}
                  className="gap-2 text-xs"
                >
                  <FileJson className="h-3.5 w-3.5" /> Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    exportRequirementsAsCSV(requirements);
                    toast.success("Exported as CSV");
                  }}
                  className="gap-2 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {draftReqs.length > 0 && (
              <Button
                size="sm"
                className="h-9 text-xs gap-1.5 bg-success hover:bg-success/90 shadow-sm"
                disabled={bulkApproving}
                onClick={approveAllDraft}
              >
                {bulkApproving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-3.5 w-3.5" />
                )}
                Approve All ({draftReqs.length})
              </Button>
            )}
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Readiness */}
        {approvedReqs.length === requirements.length && requirements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-center"
          >
            <p className="text-xs text-success font-bold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              All requirements approved — ready for Requirement Analysis (Stage 2)
            </p>
          </motion.div>
        )}
      </div>

      {/* Ambiguity Clarification Section */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/15 flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5 text-warning" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm">Ambiguity Detection</h3>
              <p className="text-[11px] text-muted-foreground">
                AI analyzes requirements for gaps, contradictions, and missing information
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5"
            disabled={generatingQuestions}
            onClick={generateClarifications}
          >
            {generatingQuestions ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {clarifications.length > 0 ? "Re-analyze" : "Detect Ambiguities"}
          </Button>
        </div>

        <div className="p-4">
          {clarifications.length === 0 ? (
            <div className="text-center py-8 rounded-lg border border-dashed border-border/60">
              <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                Click "Detect Ambiguities" to analyze your requirements for quality issues.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {totalQuestions > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-secondary/50">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium">
                    {answeredCount}/{totalQuestions} questions answered
                  </span>
                  {answeredCount === totalQuestions && (
                    <Badge className="text-[9px] bg-success/15 text-success ml-auto">
                      All clarified!
                    </Badge>
                  )}
                </div>
              )}

              {clarifications.map((q) => (
                <ClarificationCard
                  key={q.id}
                  question={q}
                  onAnswer={(opts, text) => handleClarificationAnswer(q.id, opts, text)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Requirement Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-base">
            {filter === "all"
              ? "All Requirements"
              : filter === "draft"
                ? "Pending Review"
                : filter === "approved"
                  ? "Approved Requirements"
                  : "Needs Changes"}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({filtered.length})
            </span>
          </h3>
        </div>

        <div className="space-y-3">
          {filtered.map((req) => (
            <ReviewDecisionCard
              key={req.id}
              req={req}
              onApprove={() => approveRequirement(req.id)}
              onReject={() => rejectRequirement(req.id)}
              onRequestChange={(comment) => requestChange(req.id, comment)}
              onUnlock={() => unlockRequirement(req.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
