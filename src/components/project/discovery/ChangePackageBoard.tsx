import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FileType,
  Loader2,
  Lock,
  Package,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import MermaidDiagram from "@/components/project/MermaidDiagram";
import {
  applyGateApproval,
  rebuildHandoffExports,
  type DevHandoff,
  type GateKey,
} from "@/lib/devHandoff";
import {
  closeDiscoveryCase,
  loadDiscoveryProgress,
  type DiscoveryCaseProgress,
} from "@/lib/discoveryCase";
import {
  buildPackageDocument,
  downloadAgentPackJSON,
  exportPackageDocumentDOCX,
  exportPackageDocumentPDF,
  getPackageDocumentOutline,
  packageDocumentToMarkdown,
  type PackageDocKind,
  type PackageDocument,
} from "@/lib/changePackageDocument";

type DocTab = "proposal" | "plan" | "machine" | "release";

interface Props {
  handoff: DevHandoff;
  projectId: string;
  userId: string;
  userName?: string | null;
  onPersist: (next: DevHandoff) => Promise<void>;
  onHandoffChange: (next: DevHandoff) => void;
  onCaseClosed?: () => void;
}

const TABS: {
  id: DocTab;
  label: string;
  hint: string;
  Icon: typeof FileText;
}[] = [
  { id: "proposal", label: "Proposal", hint: "For humans", Icon: FileText },
  { id: "plan", label: "Build plan", hint: "For agents", Icon: BookOpen },
  { id: "machine", label: "Machine record", hint: "Shared DB", Icon: Braces },
  { id: "release", label: "Release", hint: "Unlock build", Icon: Rocket },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function SectionTitle({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 mt-8 first:mt-0">
      <h2 className="font-display text-lg font-bold text-foreground flex items-baseline gap-2">
        {n ? <span className="font-mono text-sm text-primary/80">{n}</span> : null}
        {children}
      </h2>
      <div className="mt-2 h-0.5 w-12 bg-primary rounded-full" />
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}

function DocumentFigure({
  number,
  title,
  caption,
  children,
}: {
  number: number;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-6 rounded-lg border bg-background overflow-hidden">
      <figcaption className="px-4 py-2.5 border-b bg-muted/30 text-xs font-semibold text-foreground">
        Figure {number} — {title}
      </figcaption>
      <div className="p-3">{children}</div>
      <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t bg-muted/10 leading-relaxed">
        {caption}
      </p>
    </figure>
  );
}

function DocumentSheet({
  children,
  cover = false,
}: {
  children: React.ReactNode;
  cover?: boolean;
}) {
  return (
    <section
      className={cn(
        "mx-auto max-w-3xl border rounded-xl overflow-hidden shadow-sm",
        cover ? "bg-card" : "bg-card",
      )}
    >
      {children}
    </section>
  );
}

/** Long-form A4-style document page (SRS-style layout). */
function DocumentPage({ doc }: { doc: PackageDocument }) {
  const isPlan = doc.kind === "plan";
  const changeItems = doc.meta.changeItems.length ? doc.meta.changeItems : doc.features;
  const toc = getPackageDocumentOutline(doc.kind);
  const findings =
    doc.architectureNarrative?.keyFindings?.length
      ? doc.architectureNarrative.keyFindings
      : [
          `${doc.recoveredFeatures.length} recovered capability(ies) from reverse engineering`,
          `${changeItems.length} proposed change(s) in this package`,
        ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DocumentSheet cover>
        <header className="bg-slate-900 text-slate-50 px-8 py-10 sm:px-12 sm:py-14">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90 mb-3">
          {doc.meta.documentType}
        </p>
        <h1 className="font-display text-2xl sm:text-[1.9rem] font-bold leading-tight tracking-tight max-w-2xl">
          {doc.meta.documentTitle}
        </h1>
        <p className="mt-4 text-sm opacity-90 max-w-2xl leading-relaxed">{doc.meta.revisionSummary}</p>

        <div className="mt-8 rounded-lg border border-slate-200/20 overflow-hidden bg-white/5">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Document ID", doc.meta.documentId],
                ["Project", doc.meta.projectName],
                ...(doc.meta.revisionLabel ? [["Revision", doc.meta.revisionLabel]] : []),
                ["Date", formatDate(doc.meta.exportedAt)],
                ["Status", doc.meta.status.replace("_", " ")],
                [
                  "Release",
                  `${doc.meta.gatesApproved}/${doc.meta.gatesTotal} checks${doc.meta.mayImplement ? " · cleared for build" : ""}`,
                ],
              ].map(([label, value]) => (
                <tr key={label} className="border-t border-slate-200/15 first:border-t-0">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wide opacity-70 w-32 font-medium">
                    {label}
                  </th>
                  <td className="px-3 py-2 font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Badge className="bg-white/10 text-white border-0">
            {changeItems.length} change{changeItems.length === 1 ? "" : "s"}
          </Badge>
          <Badge className="bg-white/10 text-white border-0">
            {doc.recoveredFeatures.length} recovered
          </Badge>
          <Badge className="bg-white/10 text-white border-0">
            {doc.adrs.length} decisions
          </Badge>
          <Badge className="bg-white/10 text-white border-0">
            {doc.acceptance.length} requirements
          </Badge>
          <Badge className="bg-white/10 text-white border-0">
            {doc.tests.length} tests
          </Badge>
        </div>
        </header>
      </DocumentSheet>

      <DocumentSheet>
        <div className="px-8 py-8 sm:px-10 sm:py-10 text-[15px] leading-relaxed">
        <SectionTitle>Table of contents</SectionTitle>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground/90">
          {toc.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ol>
        </div>
      </DocumentSheet>

      <DocumentSheet>
        <div className="px-8 py-8 sm:px-10 sm:py-10 space-y-1 text-[15px] leading-relaxed">
        {!isPlan ? (
          <>
            <SectionTitle n="1.">Introduction and purpose</SectionTitle>
            <p className="text-foreground/90 mb-4">{doc.meta.revisionSummary}</p>
            <ul className="list-disc pl-5 space-y-1.5 text-foreground/90 mb-2">
              {findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <SectionTitle n="2.">Existing system baseline</SectionTitle>
            {doc.recoveredFeatures.length ? (
              <ol className="list-decimal pl-5 space-y-1 text-foreground/90">
                {doc.recoveredFeatures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            ) : (
              <EmptyNote>
                None on this package yet. Re-run Recover / Analyze to refresh, or open Current
                features.
              </EmptyNote>
            )}

            <SectionTitle n="3.">Proposed changes</SectionTitle>
            <ol className="list-decimal pl-5 space-y-1.5 text-foreground/90">
              {changeItems.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
            <h3 className="text-sm font-semibold mt-5 mb-2">3.1 Files in scope</h3>
            {doc.files.length ? (
              <ul className="space-y-1.5">
                {doc.files.map((f) => (
                  <li key={f}>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono">{f}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>Confirm with tech lead.</EmptyNote>
            )}

            {(doc.currentBehavior || doc.desiredBehavior) && (
              <>
                <SectionTitle n="4.">Current vs target behavior</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/20 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Current (as-is)
                    </p>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                      {doc.currentBehavior || "As recovered in inventory."}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 mb-1">
                      Target (to-be)
                    </p>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                      {doc.desiredBehavior || "As proposed in this revision."}
                    </p>
                  </div>
                </div>
              </>
            )}

            <SectionTitle n="5.">System architecture</SectionTitle>
            {doc.architectureNarrative && (
              <div className="space-y-3 mb-4 text-sm text-foreground/90">
                <p>
                  <span className="font-semibold">Pre-change. </span>
                  {doc.architectureNarrative.asIsSummary}
                </p>
                <p>
                  <span className="font-semibold">Post-change. </span>
                  {doc.architectureNarrative.toBeSummary}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground/80">Discussion. </span>
                  {doc.architectureNarrative.diagramDiscussion}
                </p>
              </div>
            )}
            {doc.impactStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-4">
                {(
                  [
                    ["New", doc.impactStats.new, "text-emerald-700 dark:text-emerald-400"],
                    ["Modified", doc.impactStats.modified, "text-amber-700 dark:text-amber-400"],
                    ["Ripple", doc.impactStats.ripple, "text-sky-700 dark:text-sky-400"],
                    ["Unchanged", doc.impactStats.unchanged, "text-muted-foreground"],
                    ["Discarded", doc.impactStats.discarded, "text-rose-700 dark:text-rose-400"],
                  ] as const
                ).map(([label, n, color]) => (
                  <div key={label} className="rounded-lg border px-2.5 py-2 text-center">
                    <p className={`text-lg font-semibold tabular-nums ${color}`}>{n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {doc.mermaidAsIs ? (
              <DocumentFigure
                number={1}
                title="As-is system architecture"
                caption="Recovered architecture before this change package (reverse-engineered baseline)."
              >
                <MermaidDiagram code={doc.mermaidAsIs} title="As-is architecture" />
              </DocumentFigure>
            ) : (
              <EmptyNote>
                Figure 1 not available. Re-analyze after Recover to attach the as-is diagram.
              </EmptyNote>
            )}
            {doc.mermaidProposed ? (
              <DocumentFigure
                number={2}
                title="To-be system architecture"
                caption="Proposed architecture after the approved changes in this document."
              >
                <MermaidDiagram code={doc.mermaidProposed} title="Proposed architecture" />
              </DocumentFigure>
            ) : (
              <EmptyNote>Figure 2 not available — re-analyze once.</EmptyNote>
            )}

            <SectionTitle n="6.">Approved architecture decisions</SectionTitle>
          </>
        ) : (
          <>
            <SectionTitle n="1.">Purpose and authorization</SectionTitle>
            <p className="text-foreground/90 mb-4">{doc.meta.revisionSummary}</p>
            <SectionTitle n="2.">Implementation scope</SectionTitle>
            <ol className="list-decimal pl-5 space-y-1.5 text-foreground/90">
              {changeItems.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
            <h3 className="text-sm font-semibold mt-5 mb-2">2.1 Files in scope</h3>
            {doc.files.length ? (
              <ul className="space-y-1.5">
                {doc.files.map((f) => (
                  <li key={f}>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[13px] font-mono">{f}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>Confirm with tech lead.</EmptyNote>
            )}
            <SectionTitle n="3.">Rules before coding</SectionTitle>
            <ul className="list-disc pl-5 space-y-1.5 text-foreground/90">
              {doc.agentRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <SectionTitle n="4.">Architecture decisions</SectionTitle>
          </>
        )}

        {doc.adrs.length ? (
          <div className="space-y-5">
            {doc.adrs.map((a) => (
              <div key={a.id} className="rounded-lg border bg-muted/20 px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
                  <h3 className="font-semibold text-base">{a.title}</h3>
                </div>
                <p className="text-sm text-foreground/90 mb-2">
                  <span className="font-medium text-foreground">Decision. </span>
                  {a.decision || "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/80">Consequences. </span>
                  {a.consequences || "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>None marked Go yet. Finish Review decisions first.</EmptyNote>
        )}

        <SectionTitle n={isPlan ? "5." : "7."}>
          {isPlan ? "Requirements to satisfy" : "Functional requirements"}
        </SectionTitle>
        {doc.acceptance.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary/10 text-left">
                  <th className="px-3 py-2.5 font-semibold w-20">ID</th>
                  <th className="px-3 py-2.5 font-semibold">Requirement</th>
                </tr>
              </thead>
              <tbody>
                {doc.acceptance.map((a, i) => (
                  <tr key={a.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground align-top">
                      {a.id}
                    </td>
                    <td className="px-3 py-2.5 text-foreground/90">{a.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote>None marked Go yet. Finish Review decisions first.</EmptyNote>
        )}

        <SectionTitle n={isPlan ? "6." : "8."}>
          {isPlan ? "Mandatory verification" : "Verification and definition of done"}
        </SectionTitle>
        {doc.tests.length ? (
          <div className="space-y-3">
            {doc.tests.map((t) => (
              <div key={t.id} className="rounded-lg border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                  <span className="font-semibold text-sm">{t.title}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {t.kind}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground/80">Steps. </span>
                  {t.steps || "—"}
                </p>
                <p className="text-sm text-foreground/90">
                  <span className="font-medium">Expected. </span>
                  {t.expected || "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>None marked Go yet. Finish Build guide first.</EmptyNote>
        )}

        <SectionTitle n={isPlan ? "7." : "9."}>Release approval</SectionTitle>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary/10 text-left">
                <th className="px-3 py-2.5 font-semibold">Check</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {doc.gates.map((g, i) => (
                <tr key={g.key} className={i % 2 ? "bg-muted/30" : ""}>
                  <td className="px-3 py-2.5 font-medium">{g.label}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{g.role}</td>
                  <td className="px-3 py-2.5">
                    {g.approved ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        Released
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(doc.excludedAdrs.length > 0 ||
          doc.excludedAcceptance.length > 0 ||
          doc.excludedTests.length > 0 ||
          doc.pendingAdrs.length > 0 ||
          doc.pendingAcceptance.length > 0 ||
          doc.pendingTests.length > 0) && (
          <>
            <SectionTitle n="A.">Appendix — Out of scope and pending items</SectionTitle>
            {(doc.excludedAdrs.length > 0 ||
              doc.excludedAcceptance.length > 0 ||
              doc.excludedTests.length > 0) && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-2">Out of scope</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {doc.excludedAdrs.map((a) => (
                    <li key={a.id}>
                      ADR {a.id}: {a.title}
                    </li>
                  ))}
                  {doc.excludedAcceptance.map((a) => (
                    <li key={a.id}>
                      {a.id}: {a.text}
                    </li>
                  ))}
                  {doc.excludedTests.map((t) => (
                    <li key={t.id}>
                      {t.id}: {t.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(doc.pendingAdrs.length > 0 ||
              doc.pendingAcceptance.length > 0 ||
              doc.pendingTests.length > 0) && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Pending review</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {doc.pendingAdrs.map((a) => (
                    <li key={a.id}>
                      ADR {a.id}: {a.title}
                    </li>
                  ))}
                  {doc.pendingAcceptance.map((a) => (
                    <li key={a.id}>
                      {a.id}: {a.text}
                    </li>
                  ))}
                  {doc.pendingTests.map((t) => (
                    <li key={t.id}>
                      {t.id}: {t.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <footer className="pt-10 mt-10 border-t text-xs text-muted-foreground">
          End of {doc.meta.documentType} · {doc.meta.documentId} · TimeArch
        </footer>
        </div>
      </DocumentSheet>
    </div>
  );
}

export default function ChangePackageBoard({
  handoff,
  projectId,
  userId,
  userName,
  onPersist,
  onHandoffChange,
  onCaseClosed,
}: Props) {
  const ready = useMemo(() => rebuildHandoffExports(handoff), [handoff]);
  const proposalDoc = useMemo(() => buildPackageDocument(ready, "proposal"), [ready]);
  const planDoc = useMemo(() => buildPackageDocument(ready, "plan"), [ready]);

  const [tab, setTab] = useState<DocTab>("proposal");
  const [copied, setCopied] = useState(false);
  const [savingGate, setSavingGate] = useState<GateKey | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [note, setNote] = useState("");
  const [caseProgress, setCaseProgress] = useState<DiscoveryCaseProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDiscoveryProgress(projectId).then((p) => {
      if (!cancelled) setCaseProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, ready.status]);

  const approvedCount = ready.gates.filter((g) => g.approved).length;

  const machinePreview = useMemo(() => {
    const mj = { ...ready.machineJson };
    if (mj.documents) {
      mj.documents = {
        human_markdown: "[see Proposal]",
        agent_markdown: "[see Build plan]",
      };
    }
    return JSON.stringify(mj, null, 2);
  }, [ready.machineJson]);

  const activeDoc: PackageDocument | null =
    tab === "proposal" ? proposalDoc : tab === "plan" ? planDoc : null;

  const copyCurrent = async () => {
    if (tab === "machine") {
      await navigator.clipboard.writeText(JSON.stringify(ready.machineJson, null, 2));
      toast.success("Machine record copied");
    } else if (activeDoc) {
      await navigator.clipboard.writeText(packageDocumentToMarkdown(activeDoc));
      toast.success(tab === "proposal" ? "Proposal copied" : "Build plan copied");
    } else {
      toast.message("Open Proposal or Build plan to copy");
      return;
    }
    onHandoffChange(ready);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publishPackage = async () => {
    setPublishing(true);
    try {
      const next = rebuildHandoffExports(handoff);
      await onPersist(next);
      onHandoffChange(next);
      toast.success("Change package published to library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish package");
    } finally {
      setPublishing(false);
    }
  };

  const exportDoc = async (format: "pdf" | "docx") => {
    if (!activeDoc) {
      toast.message("Open Proposal or Build plan to save as PDF / Word");
      return;
    }
    setExporting(format);
    try {
      if (format === "pdf") await exportPackageDocumentPDF(activeDoc);
      else await exportPackageDocumentDOCX(activeDoc);
      toast.success(format === "pdf" ? "PDF ready" : "Word document ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const releaseGate = async (key: GateKey) => {
    setSavingGate(key);
    try {
      const next = applyGateApproval(
        ready,
        key,
        { id: userId, name: userName },
        note.trim() || undefined,
      );
      await onPersist(next);
      onHandoffChange(next);
      setNote("");
      const progress = await loadDiscoveryProgress(projectId);
      setCaseProgress(progress);
      toast.success(
        next.status === "approved"
          ? "Released for build — coding systems may implement"
          : "Release check recorded",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save release");
    } finally {
      setSavingGate(null);
    }
  };

  const closeCase = async () => {
    if (ready.status !== "approved") {
      toast.message("Release all checks first, then close the case");
      setTab("release");
      return;
    }
    setClosing(true);
    try {
      const progress = await closeDiscoveryCase(projectId, userId, note.trim() || undefined);
      setCaseProgress(progress);
      onCaseClosed?.();
      toast.success("Case closed — progress will show on your dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close case");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        <div className="min-w-0">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            Change package
          </p>
          <p className="text-[11px] text-muted-foreground">
            Full document view · copy · save as PDF / Word · publish · release
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(tab === "proposal" || tab === "plan" || tab === "machine") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void copyCurrent()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              )}
              Copy
            </Button>
          )}
          {(tab === "proposal" || tab === "plan") && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={!!exporting}
                onClick={() => void exportDoc("pdf")}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                )}
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={!!exporting}
                onClick={() => void exportDoc("docx")}
              >
                {exporting === "docx" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <FileType className="h-3.5 w-3.5 mr-1.5" />
                )}
                Word
              </Button>
            </>
          )}
          {tab === "machine" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                downloadAgentPackJSON(ready);
                toast.success("agent_pack.json downloaded");
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              agent_pack.json
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={publishing}
            onClick={() => void publishPackage()}
          >
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Package className="h-3.5 w-3.5 mr-1.5" />
            )}
            Publish
          </Button>
        </div>
      </div>

      <div className="inline-flex flex-wrap rounded-lg border p-0.5 bg-muted/30 gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
            <span
              className={cn(
                "hidden sm:inline text-[10px] font-normal",
                tab === t.id ? "opacity-80" : "opacity-60",
              )}
            >
              · {t.hint}
            </span>
          </button>
        ))}
      </div>

      {(tab === "proposal" || tab === "plan") && (
        <div className="max-h-[min(70vh,48rem)] overflow-y-auto rounded-xl bg-muted/30 p-3 sm:p-5">
          <DocumentPage doc={tab === "proposal" ? proposalDoc : planDoc} />
        </div>
      )}

      {tab === "machine" && (
        <div className="rounded-xl border overflow-hidden max-h-[min(70vh,48rem)] overflow-y-auto">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Schema v4 · coding systems use <code className="text-[10px]">scope.go_*</code> only
            </p>
            <span className="text-[10px] font-mono text-muted-foreground">
              may_implement:{" "}
              {String(
                (ready.machineJson.authorization as { may_implement?: boolean } | undefined)
                  ?.may_implement ?? false,
              )}
            </span>
          </div>
          <pre className="px-4 py-4 text-[11px] font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
            {machinePreview}
          </pre>
        </div>
      )}

      {tab === "release" && (
        <div className="space-y-3 max-w-3xl">
          <p className="text-xs text-muted-foreground">
            Release for build unlocks coding systems ({approvedCount}/{ready.gates.length}).
            Read Proposal and Build plan first.
          </p>
          {ready.gates.map((g) => (
            <div
              key={g.key}
              className={cn(
                "rounded-lg border px-3 py-3",
                g.approved && "border-emerald-500/40 bg-emerald-500/5",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    {g.approved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-semibold">{g.label}</span>
                    <span className="text-[11px] text-muted-foreground">{g.role}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{g.checks}</p>
                </div>
                {!g.approved && (
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={!!savingGate}
                    onClick={() => void releaseGate(g.key)}
                  >
                    {savingGate === g.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 mr-1" />
                    )}
                    Release
                  </Button>
                )}
              </div>
            </div>
          ))}
          {ready.status !== "approved" && (
            <Textarea
              rows={2}
              placeholder="Optional release note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          )}
          {ready.status === "approved" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 space-y-3">
              <p className="text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Released for build — Go tests are the definition of done.
              </p>
              {caseProgress?.phase === "closed" ? (
                <p className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Case closed · {caseProgress.completed}/{caseProgress.total} milestones
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Final step: close this discovery case so the dashboard shows it complete
                    (not stuck at stage 0).
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={closing}
                    onClick={() => void closeCase()}
                  >
                    {closing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Close case
                  </Button>
                </div>
              )}
            </div>
          )}
          {ready.status !== "approved" && caseProgress && (
            <p className="text-[11px] text-muted-foreground">
              Case progress: {caseProgress.completed}/{caseProgress.total} · {caseProgress.label}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// keep type import used for clarity in future tabs
export type { PackageDocKind };
