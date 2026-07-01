import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Mail, Clock, Database, UserX, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ThemeToggle from "@/components/ThemeToggle";
import logoImg from "@/assets/timearch-logo.png";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-40 bg-background/90 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logoImg} alt="TimeArch" className="h-8 w-8 object-contain" />
            <span className="font-display font-bold tracking-tight">TimeArch</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-10 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono">
            <Shield className="h-3.5 w-3.5" /> GDPR &middot; EU / Finland
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            Privacy Notice &mdash; Workshop Survey
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This notice explains how TimeArch collects, uses, and protects your personal data when you
            participate in our workshop survey. It is written in accordance with the{" "}
            <span className="font-medium text-foreground">EU General Data Protection Regulation</span>{" "}
            (GDPR, Regulation (EU) 2016/679) and Finnish data protection law (&quot;tietosuojalaki&quot;, 1050/2018).
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-GB")} &middot; Version 1.0
          </p>
        </div>

        {/* Quick cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
          <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-1">
            <Database className="h-4 w-4 text-primary mb-1" />
            <div className="font-mono uppercase tracking-wider text-muted-foreground">Controller</div>
            <div className="font-medium text-foreground leading-snug">
              TimeArch Research Team
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-1">
            <FileText className="h-4 w-4 text-primary mb-1" />
            <div className="font-mono uppercase tracking-wider text-muted-foreground">Lawful basis</div>
            <div className="font-medium text-foreground leading-snug">
              Consent (GDPR Art. 6(1)(a))
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-1">
            <Clock className="h-4 w-4 text-primary mb-1" />
            <div className="font-mono uppercase tracking-wider text-muted-foreground">Retention</div>
            <div className="font-medium text-foreground leading-snug">
              2 years after study closes
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-1">
            <UserX className="h-4 w-4 text-primary mb-1" />
            <div className="font-mono uppercase tracking-wider text-muted-foreground">Your rights</div>
            <div className="font-medium text-foreground leading-snug">
              Access, erasure, rectification
            </div>
          </div>
        </div>

        {/* Full policy accordion */}
        <Accordion type="multiple" defaultValue={["who", "what", "why", "how", "how-long", "rights", "contact"]} className="space-y-3">
          {/* 1. Who we are */}
          <AccordionItem value="who" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              1. Who is the data controller?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>
                The data controller for this research survey is the{" "}
                <strong className="text-foreground">TimeArch Research Team</strong>. TimeArch is
                an academic research prototype investigating multi-agent, AI-assisted software
                architecture tooling.
              </p>
              <p>
                For the purposes of this MVP study, the research team acts as the controller of
                your personal data. If you have questions about how your data is handled, you
                can contact us using the details at the end of this notice.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 2. What we collect */}
          <AccordionItem value="what" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              2. What personal data do we collect?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>We collect only the data you voluntarily provide in the survey:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Survey responses:</strong> Likert-scale
                  ratings (1&ndash;5), free-text answers, and your professional role.
                </li>
                <li>
                  <strong className="text-foreground">Optional identifiers:</strong> Workshop or
                  event name, and an optional email address if you consent to follow-up contact.
                </li>
                <li>
                  <strong className="text-foreground">Technical data:</strong> Timestamp of
                  submission and, if you are logged in, an anonymised user ID reference.
                </li>
              </ul>
              <p>
                We <strong className="text-foreground">do not</strong> collect: names, physical
                addresses, IP addresses for tracking, cookies for profiling, or any special
                category data (e.g. health, ethnicity, political opinions) under GDPR Article 9.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Why we process */}
          <AccordionItem value="why" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              3. Why do we process your data and what is the lawful basis?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>
                We process your data for the following purposes, each with its lawful basis under
                the GDPR:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Research analysis:</strong> Aggregating and
                  analysing survey responses to evaluate the TimeArch prototype.{" "}
                  <em>Lawful basis: your consent</em> (GDPR Article 6(1)(a)). You provide this
                  consent explicitly via the checkbox before submitting the survey.
                </li>
                <li>
                  <strong className="text-foreground">Follow-up contact:</strong> If you provide
                  an email address, we may contact you solely to clarify your responses or invite
                  you to a follow-up interview.{" "}
                  <em>Lawful basis: your consent</em> (GDPR Article 6(1)(a)). Providing an email is
                  entirely optional.
                </li>
                <li>
                  <strong className="text-foreground">Statistical reporting:</strong> Producing
                  anonymised, aggregate statistics (e.g. average Likert scores per construct) for
                  research papers or workshop reports.{" "}
                  <em>Lawful basis: legitimate interest</em> (GDPR Article 6(1)(f)) &mdash; but only
                  after responses are fully anonymised so that no individual can be identified.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 4. How we protect */}
          <AccordionItem value="how" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              4. How do we protect and store your data?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Location:</strong> Your data is stored in
                  secure cloud infrastructure within the European Economic Area (EEA).
                </li>
                <li>
                  <strong className="text-foreground">Encryption:</strong> Data is encrypted in
                  transit (TLS 1.3) and at rest using industry-standard encryption.
                </li>
                <li>
                  <strong className="text-foreground">Access control:</strong> Only authorised
                  research team members (with admin role) can view individual responses.
                  Aggregated results have no access restrictions.
                </li>
                <li>
                  <strong className="text-foreground">No third-party sharing:</strong> We do not
                  sell, rent, or share your personal data with any external marketing, analytics, or
                  advertising platforms. Your data is used exclusively for this research study.
                </li>
                <li>
                  <strong className="text-foreground">No automated decision-making:</strong> We
                  do not use your data for any automated profiling or decision-making that produces
                  legal or similarly significant effects.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 5. How long */}
          <AccordionItem value="how-long" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              5. How long do we keep your data?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>
                We retain your individual survey responses for{" "}
                <strong className="text-foreground">up to 2 years</strong> after the research study
                officially closes. After this period, individual responses are permanently deleted.
                Aggregated, anonymised datasets may be retained indefinitely for research
                reproducibility and archival purposes, but these contain no personal identifiers.
              </p>
              <p>
                If you request erasure of your data before the retention period ends (see Your
                rights below), we will comply within 30 days unless there is a legal obligation to
                retain the data.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Your rights */}
          <AccordionItem value="rights" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              6. Your rights under the GDPR
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>
                As a data subject, you have the following rights. To exercise any of them, contact us
                using the details in Section 7:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-foreground">Right of access (Art. 15):</strong> You can
                  request a copy of all personal data we hold about you.
                </li>
                <li>
                  <strong className="text-foreground">Right to rectification (Art. 16):</strong>{" "}
                  You can ask us to correct inaccurate or incomplete data.
                </li>
                <li>
                  <strong className="text-foreground">Right to erasure (Art. 17 &mdash; right to be
                  forgotten):</strong> You can request deletion of your data. We will erase it
                  unless there is a legal basis for retention.
                </li>
                <li>
                  <strong className="text-foreground">Right to restrict processing (Art. 18):</strong>{" "}
                  You can ask us to temporarily stop processing your data in certain circumstances.
                </li>
                <li>
                  <strong className="text-foreground">Right to data portability (Art. 20):</strong>{" "}
                  You can request your data in a structured, machine-readable format.
                </li>
                <li>
                  <strong className="text-foreground">Right to object (Art. 21):</strong> You can
                  object to processing based on legitimate interest at any time.
                </li>
                <li>
                  <strong className="text-foreground">Right to withdraw consent (Art. 7(3)):</strong>{" "}
                  You can withdraw your consent at any time. This does not affect the lawfulness of
                  processing done before withdrawal. To withdraw, simply contact us.
                </li>
              </ul>
              <p>
                We will respond to all requests within <strong className="text-foreground">30 days</strong>.
                If we cannot comply, we will explain why.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* 7. Contact */}
          <AccordionItem value="contact" className="rounded-xl border bg-card px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-display font-semibold py-4 hover:no-underline">
              7. Contact us and supervisory authority
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3 pb-4">
              <p>
                For questions about this privacy notice, to exercise your rights, or to withdraw
                your consent, please contact the research team:
              </p>
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Mail className="h-3.5 w-3.5" />
                  <span>TimeArch Research Team</span>
                </div>
                <p className="text-xs pl-5.5">
                  Email: privacy [at] timearch-research.org
                </p>
                <p className="text-xs pl-5.5">
                  Response time: within 30 days
                </p>
              </div>
              <p>
                If you believe your data protection rights have been violated, you have the right to
                lodge a complaint with the{" "}
                <strong className="text-foreground">Finnish Data Protection Ombudsman</strong>{" "}
                (&quot;Tietosuojavaltuutettu&quot;) or the supervisory authority in your EU member state of
                residence or work.
              </p>
              <p className="text-xs">
                Finnish DPO: www.tietosuoja.fi &middot; EU Data Protection Board: edpb.europa.eu
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Bottom CTA */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            This notice is provided in fulfilment of GDPR Article 13 &amp; 14 transparency obligations.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/survey")}>
            Return to survey
          </Button>
        </div>
      </main>
    </div>
  );
}
