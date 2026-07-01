import { useMemo, useState } from "react";
import { ClipboardCheck, Mail, Calendar, User as UserIcon, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";

const QUESTIONS: { key: string; label: string; group: string }[] = [
  { key: "q1_value", group: "Value", label: "Idea is valuable" },
  { key: "q2_lifecycle", group: "Value", label: "Lifecycle reflects reality" },
  { key: "q3_agents_trust", group: "Value", label: "Agents trustworthy" },
  { key: "q4_critic", group: "Value", label: "Critic improved thinking" },
  { key: "q5_artifacts", group: "Value", label: "Artifacts useful" },
  { key: "q6_navigation", group: "Usability", label: "Easy to navigate" },
  { key: "q7_next_step", group: "Usability", label: "Knew what's next" },
  { key: "q8_guidance", group: "Usability", label: "Guidance clear" },
  { key: "q9_fit", group: "Research", label: "Fits my workflow" },
  { key: "q10_use_again", group: "Research", label: "Would use again" },
];

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function downloadCsv(rows: any[]) {
  const headers = [
    "created_at",
    "role",
    "workshop_name",
    "contact_email",
    ...QUESTIONS.map((q) => q.key),
    "most_valuable",
    "improvements",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timearch-survey-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SurveySection({
  responses,
  workshopFilter,
  setWorkshopFilter,
}: {
  responses: any[];
  workshopFilter: string;
  setWorkshopFilter: (v: string) => void;
}) {
  const workshops = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.workshop_name) set.add(r.workshop_name);
    });
    return Array.from(set).sort();
  }, [responses]);

  const filtered = useMemo(() => {
    if (workshopFilter === "all") return responses;
    if (workshopFilter === "__none__")
      return responses.filter((r) => !r.workshop_name);
    return responses.filter((r) => r.workshop_name === workshopFilter);
  }, [responses, workshopFilter]);

  const aggregates = useMemo(() => {
    return QUESTIONS.map((q) => {
      const vals = filtered.map((r) => r[q.key]).filter((v) => v !== null && v !== undefined);
      const n = vals.length;
      const avg = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
      const dist = [1, 2, 3, 4, 5].map((v) => vals.filter((x) => x === v).length);
      return { ...q, n, avg, dist };
    });
  }, [filtered]);

  const roleBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const k = r.role || "Unknown";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  if (responses.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-lg font-display font-semibold">No Survey Responses Yet</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Share the <code className="px-1.5 py-0.5 rounded bg-muted text-xs">/survey</code> link
          at the end of a workshop. Responses will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter + export */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
            <SelectTrigger className="h-9 w-[240px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workshops ({responses.length})</SelectItem>
              <SelectItem value="__none__">No workshop tag</SelectItem>
              {workshops.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filtered.length}</strong> responses
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(filtered)}>
          Export CSV
        </Button>
      </div>

      {/* Likert averages */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">Likert averages (1–5)</h3>
          <span className="text-[10px] font-mono text-muted-foreground">
            n = {filtered.length}
          </span>
        </div>
        <div className="divide-y">
          {(["Value", "Usability", "Research"] as const).map((group) => (
            <div key={group} className="p-4 space-y-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {aggregates
                .filter((a) => a.group === group)
                .map((a) => {
                  const pct = (a.avg / 5) * 100;
                  const color =
                    a.avg >= 4
                      ? "bg-success"
                      : a.avg >= 3
                        ? "bg-primary"
                        : a.avg >= 2
                          ? "bg-warning"
                          : "bg-destructive";
                  return (
                    <div key={a.key} className="grid grid-cols-[1fr_60px_120px] gap-3 items-center">
                      <p className="text-sm truncate">{a.label}</p>
                      <p className="text-sm font-mono font-bold text-right">
                        {a.n ? a.avg.toFixed(2) : "—"}
                      </p>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Role breakdown */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-display text-sm font-semibold mb-3">Respondent roles</h3>
        <div className="flex flex-wrap gap-2">
          {roleBreakdown.map(([role, count]) => (
            <Badge key={role} variant="outline" className="gap-1.5 py-1">
              <UserIcon className="h-3 w-3" />
              {role}
              <span className="font-mono text-[10px] opacity-70">×{count}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Open responses */}
      <div className="space-y-3">
        <h3 className="font-display text-sm font-semibold">Open responses ({filtered.length})</h3>
        {filtered.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {r.role || "Unknown role"}
                </Badge>
                {r.workshop_name && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Calendar className="h-3 w-3" /> {r.workshop_name}
                  </Badge>
                )}
                {r.contact_email && (
                  <a
                    href={`mailto:${r.contact_email}`}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <Mail className="h-3 w-3" /> {r.contact_email}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
                <span className="font-mono font-semibold text-foreground">
                  avg{" "}
                  {(
                    QUESTIONS.reduce((acc, q) => acc + (r[q.key] || 0), 0) /
                    QUESTIONS.filter((q) => r[q.key]).length
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            {/* tiny rating chips */}
            <div className="flex flex-wrap gap-1">
              {QUESTIONS.map((q, idx) => {
                const v = r[q.key];
                const color =
                  v >= 4
                    ? "bg-success/15 text-success border-success/30"
                    : v >= 3
                      ? "bg-primary/10 text-primary border-primary/30"
                      : v >= 2
                        ? "bg-warning/15 text-warning border-warning/30"
                        : "bg-destructive/10 text-destructive border-destructive/30";
                return (
                  <span
                    key={q.key}
                    title={q.label}
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${color}`}
                  >
                    Q{idx + 1}:{v ?? "—"}
                  </span>
                );
              })}
            </div>

            {r.most_valuable && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  Most valuable
                </p>
                <p className="text-sm leading-relaxed">{r.most_valuable}</p>
              </div>
            )}
            {r.improvements && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  Improvements
                </p>
                <p className="text-sm leading-relaxed">{r.improvements}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
