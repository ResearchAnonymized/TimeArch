import { useState } from "react";
import {
  BookOpen,
  Bug,
  CheckCircle2,
  HelpCircle,
  Link,
  Loader2,
  Lock,
  Shield,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PRIORITY_STYLES } from "../constants";
import type { ExtractedData } from "../types";
import { ProcessingSummary } from "./ProcessingSummary";
import { IssuesPanel } from "./IssuesPanel";
import { ExtractedSection } from "./ExtractedSection";

export function ReviewPanel({
  data,
  projectId,
  onAccepted,
}: {
  data: ExtractedData;
  projectId: string;
  onAccepted: () => void;
}) {
  const { user } = useAuth();
  const [accepting, setAccepting] = useState(false);

  const acceptRequirement = async (
    req: any,
    type: "functional" | "non_functional" | "constraint" | "assumption" | "dependency",
  ) => {
    if (!user) return;
    const { error } = await supabase.from("requirements").insert({
      project_id: projectId,
      requirement_id: req.id,
      title: req.title || req.system || req.name || "Untitled",
      description: req.description || null,
      type: type as any,
      priority: (req.priority || "medium") as any,
      category: req.category || null,
      source: req.source === "inferred" ? "ai-inferred" : "ai-extracted",
      acceptance_criteria: req.acceptance_criteria || null,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(`Accepted: ${req.id}`);
    return true;
  };

  const acceptAll = async (
    items: any[],
    type: "functional" | "non_functional" | "constraint" | "assumption" | "dependency",
  ) => {
    if (!user || !items?.length) return;
    setAccepting(true);
    let count = 0;
    for (const item of items) {
      const ok = await acceptRequirement(item, type);
      if (ok) count++;
    }
    toast.success(`Accepted ${count} ${type} requirements`);
    onAccepted();
    setAccepting(false);
  };

  if (data.parse_error) {
    return (
      <div className="bg-destructive/10 rounded-xl p-5">
        <p className="text-sm text-destructive font-semibold mb-2">Failed to parse AI output</p>
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-x-auto max-h-[300px]">
          {data.raw_output}
        </pre>
      </div>
    );
  }

  return (
    <div>
      <ProcessingSummary data={data} />
      <IssuesPanel data={data} />

      {(data.system_goal || data.business_context) && (
        <div className="rounded-xl border bg-gradient-to-r from-card to-secondary/30 p-5 mb-5">
          {data.system_goal && (
            <div className="mb-2.5">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                System Goal
              </span>
              <p className="text-sm text-muted-foreground mt-1">{data.system_goal}</p>
            </div>
          )}
          {data.business_context && (
            <div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Business Context
              </span>
              <p className="text-sm text-muted-foreground mt-1">{data.business_context}</p>
            </div>
          )}
        </div>
      )}

      <ExtractedSection
        title="Actors & Stakeholders"
        icon={Users}
        color="text-primary"
        items={[...(data.actors || []), ...(data.stakeholders || [])]}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-semibold text-xs">{item.name}</span>
              {item.type && (
                <Badge variant="outline" className="text-[9px]">
                  {item.type}
                </Badge>
              )}
              {item.role && (
                <Badge variant="outline" className="text-[9px]">
                  {item.role}
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
            {item.concerns && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Concerns: {item.concerns.join(", ")}
              </p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Functional Requirements"
        icon={Target}
        color="text-primary"
        items={data.functional_requirements || []}
        onAcceptAll={() => acceptAll(data.functional_requirements || [], "functional")}
        onAcceptItem={(item) => {
          acceptRequirement(item, "functional").then((ok) => ok && onAccepted());
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs flex-1">{item.title}</span>
              <Badge
                className={`text-[9px] ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium}`}
              >
                {item.priority}
              </Badge>
              {item.source === "inferred" && (
                <Badge variant="outline" className="text-[9px] border-warning/50 text-warning">
                  inferred
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
            {item.acceptance_criteria?.length > 0 && (
              <div className="mt-2 pl-3 border-l-2 border-primary/20">
                <p className="text-[10px] font-bold text-muted-foreground mb-0.5 uppercase tracking-wider">
                  Acceptance Criteria
                </p>
                {item.acceptance_criteria.map((c: string, i: number) => (
                  <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 text-success mt-0.5 flex-shrink-0" /> {c}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Non-Functional Requirements"
        icon={Shield}
        color="text-emerald-500"
        items={data.non_functional_requirements || []}
        onAcceptAll={() => acceptAll(data.non_functional_requirements || [], "non_functional")}
        onAcceptItem={(item) => {
          acceptRequirement(item, "non_functional").then((ok) => ok && onAccepted());
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs flex-1">{item.title}</span>
              {item.category && (
                <Badge variant="outline" className="text-[9px]">
                  {item.category}
                </Badge>
              )}
              <Badge
                className={`text-[9px] ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium}`}
              >
                {item.priority}
              </Badge>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Constraints"
        icon={Lock}
        color="text-slate-500"
        items={data.constraints || []}
        onAcceptAll={() => acceptAll(data.constraints || [], "constraint")}
        onAcceptItem={(item) => {
          acceptRequirement(item, "constraint").then((ok) => ok && onAccepted());
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs">{item.title}</span>
              {item.type && (
                <Badge variant="outline" className="text-[9px]">
                  {item.type}
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Assumptions"
        icon={HelpCircle}
        color="text-amber-500"
        items={data.assumptions || []}
        onAcceptAll={() => acceptAll(data.assumptions || [], "assumption")}
        onAcceptItem={(item) => {
          acceptRequirement(item, "assumption").then((ok) => ok && onAccepted());
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs">{item.title}</span>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
            {item.risk_if_wrong && (
              <p className="text-[10px] text-destructive mt-1">
                ⚠️ Risk if wrong: {item.risk_if_wrong}
              </p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Integrations"
        icon={Link}
        color="text-cyan-500"
        items={data.integrations || []}
        onAcceptItem={(item) => {
          acceptRequirement(
            { ...item, id: item.id, title: item.system, description: item.description },
            "dependency",
          ).then((ok) => ok && onAccepted());
        }}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] bg-cyan-500/10 text-cyan-500 px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs">{item.system}</span>
              <Badge variant="outline" className="text-[9px]">
                {item.type}
              </Badge>
              <Badge variant="outline" className="text-[9px]">
                {item.protocol}
              </Badge>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Business Rules"
        icon={BookOpen}
        color="text-foreground"
        items={data.business_rules || []}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs">{item.title}</span>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
          </div>
        )}
      />

      <ExtractedSection
        title="Identified Risks"
        icon={Bug}
        color="text-destructive"
        items={data.risks || []}
        renderItem={(item) => (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span className="font-display font-semibold text-xs">{item.title}</span>
              <Badge
                variant={item.impact === "high" ? "destructive" : "secondary"}
                className="text-[9px]"
              >
                P:{item.probability} I:{item.impact}
              </Badge>
            </div>
            {item.description && (
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            )}
          </div>
        )}
      />

      {accepting && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 flex items-center gap-3 border shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Saving requirements...</span>
          </div>
        </div>
      )}
    </div>
  );
}
