/**
 * /integrations — manage API tokens, webhook endpoints, and view deliveries.
 *
 * Plaintext tokens are shown exactly once at issue time; the server only
 * stores SHA-256 hashes. Webhook secrets are likewise shown once.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Trash2, Plus, Loader2 } from "lucide-react";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  project_id: string | null;
  rate_limit_per_min: number | null;
  allowed_ips: string[] | null;
};

type CallLog = {
  id: string; token_id: string | null; op: string | null;
  status_code: number | null; ip: string | null; duration_ms: number | null;
  error: string | null; created_at: string;
};

type Project = { id: string; name: string };

type Webhook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  project_id: string;
  created_at: string;
};

const SCOPES = ["read", "write", "admin"] as const;
const EVENTS = ["reverse_engineer.completed", "drift.detected", "disposition.completed", "stage.locked", "artifact.created"];

function CopyableSecret({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
        {label} — copy now. It will not be shown again.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          size="icon"
          variant="outline"
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [issued, setIssued] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Token form
  const [tName, setTName] = useState("");
  const [tScopes, setTScopes] = useState<string[]>(["read"]);
  const [tProject, setTProject] = useState<string>("");
  const [tRate, setTRate] = useState<number>(60);
  const [tIps, setTIps] = useState<string>("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);

  // Webhook form
  const [wUrl, setWUrl] = useState("");
  const [wProject, setWProject] = useState<string>("");
  const [wEvents, setWEvents] = useState<string[]>(["*"]);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);

  // Recent API call log
  const [logs, setLogs] = useState<CallLog[]>([]);

  async function refresh() {
    setLoading(true);
    const [tRes, wRes, pRes, lRes] = await Promise.all([
      supabase.from("api_tokens").select("*").order("created_at", { ascending: false }),
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("created_at", { ascending: false }),
      supabase.from("api_call_log").select("*").order("created_at", { ascending: false }).limit(25),
    ]);
    setTokens((tRes.data as any) ?? []);
    setWebhooks((wRes.data as any) ?? []);
    setProjects((pRes.data as any) ?? []);
    setLogs((lRes.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id?: string | null) => (id ? map.get(id) ?? id.slice(0, 8) : "All projects");
  }, [projects]);

  async function issueToken() {
    if (!tName.trim()) { toast.error("Name required"); return; }
    const allowed_ips = tIps.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("issue-api-token", {
      body: {
        name: tName, scopes: tScopes, project_id: tProject || null,
        rate_limit_per_min: tRate, allowed_ips: allowed_ips.length ? allowed_ips : null,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? "Failed"); return; }
    setIssued((data as any).token);
    setTName(""); setTScopes(["read"]); setTProject(""); setTRate(60); setTIps("");
    setTokenDialogOpen(false);
    refresh();
  }

  async function revokeToken(id: string) {
    if (!confirm("Revoke this token? Existing callers will stop working immediately.")) return;
    const { error } = await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Revoked"); refresh();
  }
  async function deleteToken(id: string) {
    if (!confirm("Delete this token row?")) return;
    const { error } = await supabase.from("api_tokens").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function createWebhook() {
    if (!wUrl.trim() || !wProject) { toast.error("URL and project required"); return; }
    setBusy(true);
    // Generate a client-side secret (the server stores it; user sees it once).
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    const secret = "whsec_" + btoa(String.fromCharCode(...buf)).replace(/[+/=]/g, "");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("webhook_endpoints").insert({
      url: wUrl, secret, events: wEvents.length ? wEvents : ["*"], project_id: wProject, owner_id: user!.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewWebhookSecret(secret);
    setWUrl(""); setWProject(""); setWEvents(["*"]);
    setWebhookDialogOpen(false);
    refresh();
  }
  async function deleteWebhook(id: string) {
    if (!confirm("Delete this webhook?")) return;
    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          API tokens, MCP access, and webhooks for external tools. See{" "}
          <span className="underline">docs/INTEGRATIONS.md</span>{" "}
          for endpoint references.
        </p>
      </header>

      {issued && <CopyableSecret value={issued} label="New API token" />}
      {newWebhookSecret && <CopyableSecret value={newWebhookSecret} label="New webhook signing secret" />}

      <Tabs defaultValue="guide">
        <TabsList>
          <TabsTrigger value="guide">Getting started</TabsTrigger>
          <TabsTrigger value="tokens">API tokens</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="mcp">MCP &amp; SDK</TabsTrigger>
        </TabsList>

        {/* ─── Getting started guide ──────────────────────────────────── */}
        <TabsContent value="guide">
          <Card>
            <CardHeader>
              <CardTitle>Connect your tools to TimeArch</CardTitle>
              <CardDescription>
                A 5-minute walkthrough for registered users. Pick the integration that matches how you work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 text-sm leading-relaxed">
              <section className="space-y-2">
                <h3 className="font-semibold text-base">Step 1 — Issue an API token</h3>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Open the <strong>API tokens</strong> tab above and click <em>Issue token</em>.</li>
                  <li>Name it after the tool that will use it (e.g. <code>cursor-laptop</code>, <code>github-actions</code>).</li>
                  <li>Pick scopes: <code>read</code> for browsing, <code>write</code> to trigger agents, <code>admin</code> for governance.</li>
                  <li>Optionally scope it to a single project for least privilege.</li>
                  <li>Copy the <code>ta_…</code> token immediately — it is shown only once.</li>
                </ol>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-base">Step 2 — Choose your integration path</h3>

                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">A. IDE assistant (Cursor, Claude Desktop, Windsurf, Zed)</p>
                  <p className="text-muted-foreground">Use the MCP server so your assistant can list projects, read artifacts, and run agents from inside the editor.</p>
                  <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">{`{
  "mcpServers": {
    "timearch": {
      "url": "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/mcp-server",
      "headers": { "Authorization": "Bearer ta_…" }
    }
  }
}`}</pre>
                  <p className="text-muted-foreground text-xs">Paste into <code>~/.cursor/mcp.json</code> or Claude Desktop's config, restart the app, then ask: <em>“List my TimeArch projects.”</em></p>
                </div>

                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">B. CI / CD pipeline (GitHub Actions, GitLab, Jenkins)</p>
                  <p className="text-muted-foreground">Run drift checks on every PR. Store the token as a CI secret named <code>TIMEARCH_TOKEN</code>.</p>
                  <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">{`- run: |
    curl -X POST https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/public-api \\
      -H "Authorization: Bearer $TIMEARCH_TOKEN" \\
      -H "Content-Type: application/json" \\
      -d '{"op":"drift_detect","project_id":"<id>"}'`}</pre>
                </div>

                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">C. Terminal / scripts (CLI &amp; SDK)</p>
                  <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">{`export TIMEARCH_TOKEN=ta_…
node sdk/cli.mjs projects
node sdk/cli.mjs reverse-engineer <projectId> ./openapi.yaml
node sdk/cli.mjs disposition <projectId>`}</pre>
                </div>

                <div className="rounded-md border p-3 space-y-1">
                  <p className="font-medium">D. Push events into Slack / Jira / n8n (Webhooks)</p>
                  <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
                    <li>Open the <strong>Webhooks</strong> tab → <em>Add endpoint</em>.</li>
                    <li>Paste the receiver URL (e.g. Slack incoming webhook, n8n trigger).</li>
                    <li>Pick events (<code>drift.detected</code>, <code>disposition.completed</code>, <code>stage.locked</code>, …).</li>
                    <li>Copy the <code>whsec_…</code> signing secret and verify <code>X-TimeArch-Signature</code> (HMAC-SHA256) on the receiver.</li>
                  </ol>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-base">Step 3 — Verify the connection</h3>
                <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">{`curl -H "Authorization: Bearer $TIMEARCH_TOKEN" \\
  -X POST https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/public-api \\
  -d '{"op":"health"}'`}</pre>
                <p className="text-muted-foreground">A <code>{`{"ok":true}`}</code> response means your tool is wired in.</p>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-base">Security checklist</h3>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Treat <code>ta_…</code> tokens like passwords — never commit to git.</li>
                  <li>Use one token per tool/machine so you can revoke independently.</li>
                  <li>Prefer project-scoped <code>read</code> tokens unless the tool must trigger agents.</li>
                  <li>Rotate tokens every 90 days; revoke immediately if a device is lost.</li>
                  <li>Always verify webhook signatures before acting on payloads.</li>
                </ul>
              </section>

              <p className="text-xs text-muted-foreground">
                Full reference: <code className="text-xs">docs/INTEGRATIONS.md</code> in the repository
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tokens ──────────────────────────────────────────────────── */}
        <TabsContent value="tokens">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>API tokens</CardTitle>
                <CardDescription>
                  Bearer tokens for the REST API and MCP server. Stored as SHA-256 hashes.
                </CardDescription>
              </div>
              <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Issue token</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Issue a new API token</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="CI pipeline" /></div>
                    <div>
                      <Label>Scopes</Label>
                      <div className="flex gap-3 mt-1">
                        {SCOPES.map((s) => (
                          <label key={s} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={tScopes.includes(s)} onCheckedChange={(v) =>
                              setTScopes(v ? [...new Set([...tScopes, s])] : tScopes.filter((x) => x !== s))} />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Project (optional — scopes token to one project)</Label>
                      <select className="w-full mt-1 rounded-md border bg-background h-9 px-2 text-sm"
                        value={tProject} onChange={(e) => setTProject(e.target.value)}>
                        <option value="">All my projects</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Rate limit (req / min)</Label>
                        <Input type="number" min={1} max={6000} value={tRate}
                          onChange={(e) => setTRate(Number(e.target.value) || 60)} />
                      </div>
                      <div>
                        <Label>Allowed IPs / CIDRs (optional)</Label>
                        <Input value={tIps} onChange={(e) => setTIps(e.target.value)}
                          placeholder="1.2.3.4, 10.0.0.0/8" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave IPs empty to allow any source. Limits are enforced atomically per token.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button onClick={issueToken} disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Issue
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && tokens.length === 0 && <p className="text-sm text-muted-foreground">No tokens yet.</p>}
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <code className="text-xs text-muted-foreground">{t.prefix}…</code>
                      {t.scopes.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                      {t.revoked_at && <Badge variant="destructive">revoked</Badge>}
                      {t.project_id && <Badge variant="outline">{projectName(t.project_id)}</Badge>}
                      {t.rate_limit_per_min && <Badge variant="outline">{t.rate_limit_per_min}/min</Badge>}
                      {t.allowed_ips?.length ? <Badge variant="outline">IP-locked ({t.allowed_ips.length})</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(t.created_at).toLocaleDateString()} ·{" "}
                      {t.last_used_at ? `last used ${new Date(t.last_used_at).toLocaleString()}` : "never used"}
                      {t.last_used_ip && ` from ${t.last_used_ip}`}
                      {t.expires_at && ` · expires ${new Date(t.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!t.revoked_at && <Button size="sm" variant="outline" onClick={() => revokeToken(t.id)}>Revoke</Button>}
                    <Button size="icon" variant="ghost" onClick={() => deleteToken(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Recent API activity</CardTitle>
              <CardDescription>Last 25 calls across all your tokens — for audit and debugging.</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-1 pr-3">When</th>
                        <th className="py-1 pr-3">Op</th>
                        <th className="py-1 pr-3">Status</th>
                        <th className="py-1 pr-3">IP</th>
                        <th className="py-1 pr-3">Latency</th>
                        <th className="py-1 pr-3">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-t">
                          <td className="py-1 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                          <td className="py-1 pr-3 font-mono">{l.op ?? "—"}</td>
                          <td className="py-1 pr-3">
                            <Badge variant={l.status_code && l.status_code < 400 ? "secondary" : "destructive"}>
                              {l.status_code ?? "—"}
                            </Badge>
                          </td>
                          <td className="py-1 pr-3 font-mono">{l.ip ?? "—"}</td>
                          <td className="py-1 pr-3">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</td>
                          <td className="py-1 pr-3 text-destructive">{l.error ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Webhooks ───────────────────────────────────────────────── */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Outbound webhooks</CardTitle>
                <CardDescription>
                  HMAC-signed POST callbacks to external systems. Verify with the secret shown at creation.
                </CardDescription>
              </div>
              <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add endpoint</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add webhook endpoint</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>URL</Label><Input value={wUrl} onChange={(e) => setWUrl(e.target.value)} placeholder="https://hooks.example.com/timearch" /></div>
                    <div>
                      <Label>Project</Label>
                      <select className="w-full mt-1 rounded-md border bg-background h-9 px-2 text-sm"
                        value={wProject} onChange={(e) => setWProject(e.target.value)}>
                        <option value="">Select a project…</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Events</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <label className="flex items-center gap-1 text-sm">
                          <Checkbox checked={wEvents.includes("*")}
                            onCheckedChange={(v) => setWEvents(v ? ["*"] : [])} />
                          all events
                        </label>
                        {EVENTS.map((e) => (
                          <label key={e} className="flex items-center gap-1 text-sm">
                            <Checkbox checked={wEvents.includes(e)}
                              onCheckedChange={(v) => setWEvents(v
                                ? [...new Set([...wEvents.filter((x) => x !== "*"), e])]
                                : wEvents.filter((x) => x !== e))} />
                            {e}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createWebhook} disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {webhooks.length === 0 && <p className="text-sm text-muted-foreground">No webhooks configured.</p>}
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs">{w.url}</code>
                      {w.events.map((e) => <Badge key={e} variant="secondary">{e}</Badge>)}
                      <Badge variant="outline">{projectName(w.project_id)}</Badge>
                      {!w.active && <Badge variant="destructive">disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Created {new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteWebhook(w.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── MCP & SDK ──────────────────────────────────────────────── */}
        <TabsContent value="mcp">
          <Card>
            <CardHeader>
              <CardTitle>MCP &amp; SDK quickstart</CardTitle>
              <CardDescription>Wire IDE assistants and local scripts to TimeArch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Cursor / Claude Desktop</h4>
                <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">{`{
  "mcpServers": {
    "timearch": {
      "url": "https://yyqbxzcjnpsijkjbfjcg.supabase.co/functions/v1/mcp-server",
      "headers": { "Authorization": "Bearer ta_…" }
    }
  }
}`}</pre>
              </div>
              <div>
                <h4 className="font-medium mb-1">CLI</h4>
                <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">{`export TIMEARCH_TOKEN=ta_…
node sdk/cli.mjs projects
node sdk/cli.mjs disposition <projectId>`}</pre>
              </div>
              <div>
                <h4 className="font-medium mb-1">TypeScript SDK</h4>
                <pre className="rounded-md bg-muted p-3 overflow-x-auto text-xs">{`import { TimeArch } from "@/sdk/timearch";
const t = new TimeArch({ token: process.env.TIMEARCH_TOKEN! });
await t.disposition(projectId);`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
