import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  ClipboardCheck,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import ThemeToggle from "@/components/ThemeToggle";
import logoImg from "@/assets/timearch-logo.png";

// Likert items grounded in established instruments:
//  - Perceived Usefulness & Ease of Use (Davis, TAM, 1989)
//  - User Experience Questionnaire (UEQ) short scale
//  - NASA-TLX (cognitive load, single item)
//  - Trust in Automation (Jian, Bisantz & Drury, 2000)
// Each item maps to a construct so results can be analysed per-construct.
const LIKERT_QUESTIONS: {
  key: string;
  label: string;
  group: string;
  construct: string;
}[] = [
  {
    key: "q1_value",
    group: "Perceived Usefulness",
    construct: "TAM · Usefulness",
    label:
      "Using TimeArch would improve the quality of the architecture work I (or my team) produce.",
  },
  {
    key: "q2_lifecycle",
    group: "Perceived Usefulness",
    construct: "Process fit",
    label:
      "The 18-stage lifecycle reflects a sound, end-to-end view of how architecture should be done.",
  },
  {
    key: "q5_artifacts",
    group: "Perceived Usefulness",
    construct: "Output quality",
    label:
      "The generated artifacts (diagrams, ADRs, documents) were of useful, reviewable quality.",
  },
  {
    key: "q3_agents_trust",
    group: "Trust in AI",
    construct: "Trust in automation",
    label:
      "The AI agents' recommendations felt grounded in evidence and trustworthy enough to act on.",
  },
  {
    key: "q4_critic",
    group: "Trust in AI",
    construct: "Critical reflection",
    label:
      "The Challenger / Critic agent surfaced trade-offs or risks I would not have considered alone.",
  },
  {
    key: "q6_navigation",
    group: "Usability & Effort",
    construct: "TAM · Ease of Use",
    label: "I found TimeArch easy to navigate and interact with.",
  },
  {
    key: "q7_next_step",
    group: "Usability & Effort",
    construct: "Workflow clarity",
    label: "At every stage, it was clear to me what the next meaningful action was.",
  },
  {
    key: "q8_guidance",
    group: "Usability & Effort",
    construct: "Cognitive load (reversed)",
    label:
      "The amount of information and steps felt manageable, not overwhelming.",
  },
  {
    key: "q9_fit",
    group: "Adoption Intent",
    construct: "Behavioural intention",
    label:
      "I can see a tool like TimeArch realistically fitting into my professional or teaching workflow.",
  },
  {
    key: "q10_use_again",
    group: "Adoption Intent",
    construct: "Continued use intent",
    label:
      "If given the opportunity, I would use TimeArch again on a real architecture problem.",
  },
];

const LIKERT_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

const ROLES = [
  "Software architect",
  "Software developer / engineer",
  "Researcher",
  "Professor / lecturer",
  "Student",
  "Product / project manager",
  "Other",
];

const surveySchema = z.object({
  role: z.string().min(1, "Please select your role"),
  workshop_name: z.string().trim().max(120).optional(),
  contact_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  most_valuable: z.string().trim().max(2000).optional(),
  improvements: z.string().trim().max(2000).optional(),
});

export default function SurveyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [role, setRole] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [email, setEmail] = useState("");
  const [mostValuable, setMostValuable] = useState("");
  const [improvements, setImprovements] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const answered = Object.keys(ratings).length;
  const total = LIKERT_QUESTIONS.length;

  const handleSubmit = async () => {
    if (answered < total) {
      toast.error(`Please answer all ${total} rating questions (${answered}/${total} done).`);
      return;
    }
    if (!privacyConsent) {
      toast.error("Please confirm you have read and agree to the privacy notice before submitting.");
      return;
    }
    const parsed = surveySchema.safeParse({
      role,
      workshop_name: workshopName,
      contact_email: email,
      most_valuable: mostValuable,
      improvements,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check the form");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        user_id: user?.id ?? null,
        role,
        workshop_name: workshopName.trim() || null,
        contact_email: email.trim() || null,
        most_valuable: mostValuable.trim() || null,
        improvements: improvements.trim() || null,
        ...ratings,
      };
      const { error } = await supabase.from("survey_responses").insert(payload);
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold">Thank you!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your response has been recorded. As an MVP research project, every workshop
              participant's input directly shapes what TimeArch becomes next.
            </p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background/90 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logoImg} alt="TimeArch" className="h-8 w-8 object-contain" />
            <span className="font-display font-bold tracking-tight">TimeArch</span>
            <span className="text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 leading-none">
              MVP Research
            </span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-10 space-y-8">
        {/* Intro */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono">
            <ClipboardCheck className="h-3.5 w-3.5" /> Workshop & MVP research study
          </div>
          <h1
            className="text-3xl sm:text-4xl font-display font-bold tracking-tight"
            style={{ textWrap: "balance" }}
          >
            Help us evaluate TimeArch
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            TimeArch is an MVP research prototype investigating whether multi-agent, AI-assisted
            tooling can meaningfully support the software architecture lifecycle. This short
            instrument adapts validated HCI constructs — the{" "}
            <span className="font-medium text-foreground">Technology Acceptance Model</span>{" "}
            (Davis, 1989), <span className="font-medium text-foreground">Trust in Automation</span>{" "}
            (Jian et al., 2000), and cognitive-load principles from NASA-TLX — so your responses
            map directly to measurable research constructs.
          </p>
          <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono uppercase tracking-wider text-muted-foreground">
                Duration
              </div>
              <div className="font-medium">~3 minutes</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono uppercase tracking-wider text-muted-foreground">Scale</div>
              <div className="font-medium">5-point Likert (1–5)</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono uppercase tracking-wider text-muted-foreground">
                Confidentiality
              </div>
              <div className="font-medium">Private · research-only</div>
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">How to answer:</span> Rate each
            statement from <span className="font-mono">1 = Strongly disagree</span> to{" "}
            <span className="font-mono">5 = Strongly agree</span>. There are no right or wrong
            answers — we want your honest perception, including critical ones. Neutral (3) is a
            valid choice when you have no clear opinion.
          </div>
        </div>

        {/* Likert grid */}
        <div className="space-y-6">
          {(
            [
              "Perceived Usefulness",
              "Trust in AI",
              "Usability & Effort",
              "Adoption Intent",
            ] as const
          ).map((group) => (
            <section key={group} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-semibold tracking-wide">{group}</h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {LIKERT_QUESTIONS.filter((q) => q.group === group).length} items
                </span>
              </div>
              <div className="divide-y">
                {LIKERT_QUESTIONS.filter((q) => q.group === group).map((q) => {
                  const qNum = LIKERT_QUESTIONS.findIndex((x) => x.key === q.key) + 1;
                  return (
                    <div key={q.key} className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-relaxed flex-1">
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            Q{qNum}.
                          </span>
                          {q.label}
                        </p>
                        <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/40 border rounded px-1.5 py-0.5">
                          {q.construct}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((v) => {
                          const selected = ratings[q.key] === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setRatings((r) => ({ ...r, [q.key]: v }))}
                              className={`flex-1 min-w-[60px] px-2 py-2 rounded-md border text-xs font-medium transition-all ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              <div className="text-sm font-bold">{v}</div>
                              <div className="text-[9px] leading-tight mt-0.5 opacity-80">
                                {LIKERT_LABELS[v - 1]}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Open questions */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h2 className="font-display text-sm font-semibold tracking-wide">In your own words</h2>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <Label className="text-sm">
                Q11. Which aspect of TimeArch felt{" "}
                <span className="text-primary">most valuable</span> in your context, and why?
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                A concrete example helps — a specific stage, agent, artifact, or workflow moment.
              </p>
              <Textarea
                value={mostValuable}
                onChange={(e) => setMostValuable(e.target.value)}
                placeholder="e.g. The Critic agent in Stage 2 caught a missing non-functional requirement I would have shipped..."
                className="mt-2 min-h-[90px] resize-none"
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {mostValuable.length}/2000
              </p>
            </div>
            <div>
              <Label className="text-sm">
                Q12. What is the single biggest{" "}
                <span className="text-primary">barrier or missing capability</span> that would stop
                you from adopting TimeArch?
              </Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Be blunt — limitations, friction, missing features, trust concerns. This is
                research, not marketing.
              </p>
              <Textarea
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="Be blunt — this is research, not marketing."
                className="mt-2 min-h-[90px] resize-none"
                maxLength={2000}
              />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                {improvements.length}/2000
              </p>
            </div>
          </div>
        </section>

        {/* Metadata */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h2 className="font-display text-sm font-semibold tracking-wide">About you</h2>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Your role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Workshop / event name (optional)</Label>
              <Input
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="e.g. ECSA 2026 Tutorial"
                className="mt-2"
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm">Email (optional — only if you'd like follow-up)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2"
                maxLength={255}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Used only by the research team if we need to clarify a response. Never shared.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy & Consent */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-wide">
              Privacy &amp; Consent
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              We collect and process your survey responses under the{" "}
              <span className="font-medium text-foreground">EU General Data Protection Regulation</span>{" "}
              (GDPR). Your data is stored securely in the EEA, used only for research analysis, and
              retained for up to 2 years. You have the right to access, rectify, or erase your data at
              any time. For full details, please read our{" "}
              <button
                type="button"
                onClick={() => navigate("/privacy")}
                className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium"
              >
                Privacy Notice
              </button>
              .
            </p>
            <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
              <Checkbox
                id="privacy-consent"
                checked={privacyConsent}
                onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="privacy-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                <span className="font-medium text-foreground">
                  I have read and understand the Privacy Notice, and I consent to the processing of
                  my survey responses for research purposes as described therein.
                </span>{" "}
                I understand that my participation is voluntary and that I can withdraw my consent at
                any time by contacting the research team.
                <span className="text-destructive ml-1">*</span>
              </Label>
            </div>
          </div>
        </section>

        {/* Footer / submit */}
        <div className="sticky bottom-0 -mx-4 sm:mx-0 bg-background/95 backdrop-blur border-t sm:border sm:rounded-xl p-4 flex items-center justify-between gap-4 z-30">
          <div className="text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {answered}/{total}
            </span>{" "}
            rating questions answered
            {!privacyConsent && (
              <span className="block text-destructive mt-0.5">
                Consent required to submit
              </span>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !privacyConsent}
            size="lg"
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Submit feedback
          </Button>
        </div>
      </main>
    </div>
  );
}
