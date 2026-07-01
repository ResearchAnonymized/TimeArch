import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Layers,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AudioRequirementCollector, {
  AudioAnalysisPanel,
  type AudioExtractionResult,
} from "./AudioRequirementCollector";
import RequirementReviewPanel from "./RequirementReviewPanel";
import StageIntro from "./StageIntro";
import { STAGE_INTROS } from "./stageIntroData";
import { recoverArtifactContent } from "@/lib/artifact-utils";
import { callAuthenticatedFunction } from "@/lib/authenticated-functions";

import type { ExtractedData, SavedRequirement } from "@/features/requirements/intake/types";
import { EXAMPLE_REQUIREMENTS } from "@/features/requirements/intake/constants";
import { normalizeExtractedRequirements } from "@/features/requirements/intake/normalize";
import { InputMethodSelector } from "@/features/requirements/intake/components/InputMethodSelector";
import { DocumentUploadMode } from "@/features/requirements/intake/components/DocumentUploadMode";
import { FreeTextMode } from "@/features/requirements/intake/components/FreeTextMode";
import { StructuredFormMode } from "@/features/requirements/intake/components/StructuredFormMode";
import { ReviewPanel } from "@/features/requirements/intake/components/ReviewPanel";
import { SavedRequirementsList } from "@/features/requirements/intake/components/SavedRequirementsList";
import { StatsDashboard } from "@/features/requirements/intake/components/StatsDashboard";

interface Props {
  projectId: string;
}

export default function RequirementIntake({ projectId }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("collect");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [prefillText, setPrefillText] = useState("");
  const [requirements, setRequirements] = useState<SavedRequirement[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [audioData, setAudioData] = useState<AudioExtractionResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchRequirements = useCallback(async () => {
    const { data } = await supabase
      .from("requirements")
      .select(
        "id, requirement_id, title, description, type, priority, status, category, source, acceptance_criteria, locked_at",
      )
      .eq("project_id", projectId)
      .order("requirement_id");
    if (data) setRequirements(data as SavedRequirement[]);
  }, [projectId]);

  const loadLatestExtraction = useCallback(async () => {
    const { data } = await supabase
      .from("architecture_artifacts")
      .select("content")
      .eq("project_id", projectId)
      .eq("stage", 1)
      .eq("title", "Requirement Extraction Snapshot")
      .eq("generated_by", "Requirement Extraction")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.content) {
      let content = data.content as any;
      if (content?.parse_error) {
        const recovered = recoverArtifactContent(content);
        if (recovered) content = recovered;
      }
      setExtractedData(content as ExtractedData);
    }
  }, [projectId]);

  const persistExtractionSnapshot = useCallback(
    async (data: ExtractedData, mode: string) => {
      if (!user) return;

      const { error } = await supabase.from("architecture_artifacts").insert({
        project_id: projectId,
        stage: 1,
        title: "Requirement Extraction Snapshot",
        type: "executive_summary",
        status: "generated",
        generated_by: "Requirement Extraction",
        created_by: user.id,
        content: {
          ...data,
          _meta: {
            input_mode: mode,
            saved_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
    },
    [projectId, user],
  );

  const persistExtractedRequirements = useCallback(
    async (data: ExtractedData) => {
      if (!user) return { savedCount: 0, skippedCount: 0 };

      const normalized = normalizeExtractedRequirements(data);
      const existingIds = new Set(requirements.map((req) => req.requirement_id));
      const rows = normalized
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          project_id: projectId,
          requirement_id: item.id,
          title: item.title,
          description: item.description,
          type: item.type as any,
          priority: item.priority as any,
          category: item.category,
          source: item.source,
          acceptance_criteria: item.acceptance_criteria,
          status: "draft" as any,
          created_by: user.id,
        }));

      if (rows.length === 0) {
        return { savedCount: 0, skippedCount: normalized.length };
      }

      const { error } = await supabase.from("requirements").insert(rows);
      if (error) throw error;

      return {
        savedCount: rows.length,
        skippedCount: normalized.length - rows.length,
      };
    },
    [projectId, requirements, user],
  );

  useEffect(() => {
    void Promise.all([fetchRequirements(), loadLatestExtraction()]);
  }, [fetchRequirements, loadLatestExtraction]);

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      void Promise.all([fetchRequirements(), loadLatestExtraction()]);
    },
    [fetchRequirements, loadLatestExtraction],
  );

  const handleProcess = async (inputText: string, mode: string) => {
    if (!user) return;
    setProcessing(true);
    try {
      const data = await callAuthenticatedFunction<{ data: ExtractedData }>(
        "process-requirements",
        {
          project_id: projectId,
          user_id: user.id,
          input_text: inputText,
          input_mode: mode,
          existing_requirements: requirements.map((r) => ({
            id: r.requirement_id,
            title: r.title,
          })),
        },
      );

      let extracted = data.data as ExtractedData;
      if (extracted?.parse_error) {
        const recovered = recoverArtifactContent(extracted);
        if (recovered) extracted = recovered as ExtractedData;
      }
      setExtractedData(extracted);

      const [snapshotResult, persistenceResult] = await Promise.allSettled([
        persistExtractionSnapshot(extracted, mode),
        persistExtractedRequirements(extracted),
      ]);

      if (snapshotResult.status === "rejected") throw snapshotResult.reason;
      if (persistenceResult.status === "rejected") throw persistenceResult.reason;

      await Promise.all([fetchRequirements(), loadLatestExtraction()]);
      setActiveTab("extract");

      const { savedCount, skippedCount } = persistenceResult.value;
      if (savedCount > 0 && skippedCount > 0) {
        toast.success(
          `Extracted requirements saved: ${savedCount} new, ${skippedCount} already existed.`,
        );
      } else if (savedCount > 0) {
        toast.success(`Extracted requirements saved as draft items (${savedCount}).`);
      } else {
        toast.success("Extraction loaded. Matching requirements already existed in the pipeline.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process requirements");
    } finally {
      setProcessing(false);
    }
  };

  const lockedCount = requirements.filter(
    (r) => r.status === "locked" || r.status === "approved",
  ).length;
  const totalCount = requirements.length;

  const handleLockAll = async () => {
    if (!user) return;
    const unlocked = requirements.filter((r) => r.status !== "locked" && r.status !== "approved");
    if (unlocked.length === 0) {
      toast.info("All requirements are already locked");
      return;
    }

    for (const req of unlocked) {
      await supabase
        .from("requirements")
        .update({
          status: "locked" as any,
          locked_at: new Date().toISOString(),
          locked_by: user.id,
        })
        .eq("id", req.id);
    }
    toast.success(`Locked ${unlocked.length} requirements`);
    fetchRequirements();
  };

  return (
    <div className="space-y-6">
      <StageIntro {...STAGE_INTROS[1]} title="Requirement Collection" />

      {totalCount > 0 && <StatsDashboard requirements={requirements} />}

      {totalCount > 0 && lockedCount < totalCount && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-foreground">
              <strong>Next Step:</strong> Review and lock all requirements before proceeding to
              Analysis (Stage 2).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 flex-shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            onClick={handleLockAll}
          >
            <Lock className="h-3 w-3" /> Lock All ({totalCount - lockedCount})
          </Button>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4 h-11 rounded-xl bg-secondary/70 p-1">
          <TabsTrigger
            value="collect"
            className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Collect
          </TabsTrigger>
          <TabsTrigger
            value="requirements"
            className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:shadow-sm"
          >
            <Layers className="h-3.5 w-3.5" /> Requirements
            {totalCount > 0 && (
              <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-mono">
                {totalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="extract"
            className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:shadow-sm"
            disabled={!extractedData && !audioData}
          >
            <Sparkles className="h-3.5 w-3.5" /> Extract
            {(extractedData || audioData) && (
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Review
            {totalCount > 0 && lockedCount < totalCount && (
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collect" className="mt-5">
          <AnimatePresence mode="wait">
            {!selectedMethod ? (
              <motion.div
                key="selector"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {totalCount === 0 ? (
                  <div className="text-center mb-8">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-primary/60" />
                    </div>
                    <h3 className="font-display font-bold text-xl mb-2">
                      Start Your Requirement Collection
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                      Choose an input method below, or try a demo example to see the AI in action.
                    </p>
                  </div>
                ) : (
                  <div className="mb-5">
                    <h3 className="font-display font-bold text-base mb-1">Add More Requirements</h3>
                    <p className="text-xs text-muted-foreground">
                      Choose an input method to collect additional requirements.
                    </p>
                  </div>
                )}

                {totalCount === 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-display font-bold">Try a Demo Example</span>
                      <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        Auto-fills free text
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {EXAMPLE_REQUIREMENTS.map((ex) => (
                        <motion.button
                          key={ex.label}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setPrefillText(ex.text);
                            setSelectedMethod("freetext");
                          }}
                          className={`flex items-center gap-2.5 p-3 rounded-lg border bg-gradient-to-br ${ex.color} text-left transition-all`}
                        >
                          <div className="h-7 w-7 rounded-md bg-background/50 flex items-center justify-center flex-shrink-0">
                            <ex.icon className="h-3.5 w-3.5 text-foreground/70" />
                          </div>
                          <span className="text-xs font-semibold">{ex.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                <InputMethodSelector onSelect={setSelectedMethod} />
              </motion.div>
            ) : selectedMethod === "document" ? (
              <motion.div
                key="document"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <DocumentUploadMode
                  onProcess={handleProcess}
                  processing={processing}
                  onBack={() => setSelectedMethod(null)}
                />
              </motion.div>
            ) : selectedMethod === "freetext" ? (
              <motion.div
                key="freetext"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <FreeTextMode
                  onProcess={handleProcess}
                  processing={processing}
                  onBack={() => {
                    setSelectedMethod(null);
                    setPrefillText("");
                  }}
                  initialText={prefillText}
                />
              </motion.div>
            ) : selectedMethod === "audio" ? (
              <motion.div
                key="audio"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => setSelectedMethod(null)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors mb-4"
                >
                  <ChevronDown className="h-3 w-3 rotate-90" /> Back to methods
                </button>
                <AudioRequirementCollector
                  projectId={projectId}
                  existingRequirements={requirements.map((r) => ({
                    id: r.requirement_id,
                    title: r.title,
                  }))}
                  onResult={(data) => {
                    setAudioData(data);
                    setExtractedData(data as any);
                    setActiveTab("extract");
                  }}
                  processing={processing}
                  setProcessing={setProcessing}
                />
              </motion.div>
            ) : (
              <motion.div
                key="structured"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <StructuredFormMode
                  projectId={projectId}
                  onSaved={() => {
                    fetchRequirements();
                    setActiveTab("requirements");
                  }}
                  onBack={() => setSelectedMethod(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="requirements" className="mt-5">
          {totalCount === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-border/60">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Layers className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">No Requirements Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                Start by collecting requirements from the Collect tab.
              </p>
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab("collect")}>
                <Plus className="h-4 w-4" /> Go to Collect
              </Button>
            </div>
          ) : (
            <SavedRequirementsList requirements={requirements} onRefresh={fetchRequirements} />
          )}
        </TabsContent>

        <TabsContent value="extract" className="mt-5">
          {extractedData || audioData ? (
            <div>
              {audioData && <AudioAnalysisPanel data={audioData} />}
              {extractedData && (
                <ReviewPanel
                  data={extractedData}
                  projectId={projectId}
                  onAccepted={fetchRequirements}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-16 rounded-xl border border-dashed border-border/60">
              <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">No Extraction Results</h3>
              <p className="text-sm text-muted-foreground">
                Process requirements from the Collect tab first using Document, Free Text, or Audio
                input.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="review" className="mt-5">
          <RequirementReviewPanel
            projectId={projectId}
            requirements={requirements}
            onRefresh={fetchRequirements}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
