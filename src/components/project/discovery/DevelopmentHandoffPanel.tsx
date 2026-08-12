import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { type DevHandoff } from "@/lib/devHandoff";
import DecisionReviewBoard from "@/components/project/discovery/DecisionReviewBoard";
import BuildGuideBoard from "@/components/project/discovery/BuildGuideBoard";
import ChangePackageBoard from "@/components/project/discovery/ChangePackageBoard";

export type HandoffSection = "decide" | "implement" | "package";

interface Props {
  handoff: DevHandoff;
  projectId: string;
  userId: string;
  userName?: string | null;
  onHandoffChange: (next: DevHandoff) => void;
  /** Parent owns navigation — only render one section, no duplicate chrome */
  embedded?: boolean;
  section?: HandoffSection;
  /** Unused when embedded; kept for standalone panel */
  hideActions?: boolean;
  onCaseClosed?: () => void;
}

export default function DevelopmentHandoffPanel({
  handoff,
  projectId,
  userId,
  userName,
  onHandoffChange,
  embedded,
  section: controlledSection,
  onCaseClosed,
}: Props) {
  const [tab, setTab] = useState<HandoffSection>("decide");

  const active = embedded ? controlledSection || "decide" : tab;

  const statusColor =
    handoff.status === "approved"
      ? "bg-emerald-600 text-white"
      : handoff.status === "in_review"
        ? "bg-amber-500 text-white"
        : "bg-muted text-muted-foreground";

  const approvedCount = useMemo(
    () => handoff.gates.filter((g) => g.approved).length,
    [handoff.gates],
  );

  const persistHandoff = async (next: DevHandoff) => {
    const approvals: Record<string, { approvedBy?: string; approvedAt?: string; note?: string }> =
      {};
    for (const g of next.gates) {
      if (g.approved && g.approvedAt) {
        approvals[g.key] = {
          approvedBy: g.approvedBy || undefined,
          approvedAt: g.approvedAt,
          note: g.note || undefined,
        };
      }
    }

    await supabase
      .from("feature_changes")
      .update({
        status: next.status === "approved" ? "approved" : "in_review",
        is_active: next.status === "approved",
      })
      .eq("id", next.featureChangeId);

    await supabase.from("architecture_artifacts").insert({
      project_id: projectId,
      stage: 15,
      type: "executive_summary",
      title: next.title,
      content: {
        _meta: {
          kind: "dev_handoff",
          feature_change_id: next.featureChangeId,
          generated_at: next.generatedAt,
          status: next.status,
          approvals,
        },
        human_markdown: next.humanMarkdown,
        machine_markdown: next.machineMarkdown,
        full_markdown: next.fullMarkdown,
        machine_json: next.machineJson,
        acceptance_criteria: next.acceptanceCriteria,
        test_cases: next.testCases,
        adrs: next.adrs,
        files_to_touch: next.filesToTouch,
        mermaid_proposed: next.mermaidProposed,
        mermaid_as_is: next.mermaidAsIs || "",
        recovered_features: next.recoveredFeatures || [],
        current_behavior: next.currentBehavior || "",
        desired_behavior: next.desiredBehavior || "",
        architecture_narrative: next.architectureNarrative || null,
        impact_stats: next.impactStats || null,
        stats: next.stats,
        summary_markdown: next.summaryMarkdown,
        impact_checklist_markdown: next.impactChecklistMarkdown,
        plan_markdown: next.planMarkdown,
        adr_markdown: next.adrMarkdown,
        test_plan_markdown: next.testPlanMarkdown,
        implementation_brief: next.implementationBrief,
        proposed_features: next.proposedFeatures,
      },
      status: next.status === "approved" ? "approved" : "draft",
      generated_by: "Development Handoff",
      created_by: userId,
      locked_at: next.status === "approved" ? new Date().toISOString() : null,
      locked_by: next.status === "approved" ? userId : null,
    });
  };

  const decideBody = (
    <DecisionReviewBoard
      handoff={handoff}
      onPersist={persistHandoff}
      onHandoffChange={onHandoffChange}
      readOnly={handoff.status === "approved"}
    />
  );

  const implementBody = (
    <BuildGuideBoard
      handoff={handoff}
      onPersist={persistHandoff}
      onHandoffChange={onHandoffChange}
      readOnly={handoff.status === "approved"}
    />
  );

  const packageBody = (
    <ChangePackageBoard
      handoff={handoff}
      projectId={projectId}
      userId={userId}
      userName={userName}
      onPersist={persistHandoff}
      onHandoffChange={onHandoffChange}
      onCaseClosed={onCaseClosed}
    />
  );

  const body =
    active === "decide" ? decideBody : active === "implement" ? implementBody : packageBody;

  if (embedded) {
    return <div className="p-4 space-y-3">{body}</div>;
  }

  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="text-sm font-semibold">Change package</h3>
            <Badge className={statusColor}>{handoff.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {handoff.stats.tests ?? 0} tests · {handoff.stats.adrs ?? 0} ADRs · {approvedCount}/
            {handoff.gates.length} release checks
          </p>
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-3">
        {(
          [
            ["decide", "Review decisions"],
            ["implement", "Build guide"],
            ["package", "Change package"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-[36rem] overflow-auto">{body}</div>
    </section>
  );
}
