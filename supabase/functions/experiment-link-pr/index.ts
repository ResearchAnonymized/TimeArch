// Retrospective track: fetch a merged GitHub PR's file list and store it on
// the proposal as ground truth. The list is merged into `expected_hints.files`
// so existing scoring code (ripple Jaccard, mapping kernel matches) picks it
// up without changes.
//
// Contract:
//   POST { proposal_id, pr_url }
//   → { ok: true, files: string[], pr_number, repo, merged_at, title }
//
// pr_url accepts either the web URL (https://github.com/owner/repo/pull/123)
// or the API URL. Public repos work without a token; a GITHUB_TOKEN secret is
// used automatically if present to raise the rate limit.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";

const ok = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parsePrUrl(input: string): { owner: string; repo: string; number: number } | null {
  const m = input.match(/github\.com\/([^/]+)\/([^/]+)\/(?:pull|pulls)\/(\d+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), number: Number(m[3]) };
}

async function gh(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "TimeArch-Experiment/1.0",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return await fetch(`https://api.github.com${path}`, { headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return ok({ error: "unauthorized" }, 401);

  const authed = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user }, error: userErr } = await authed.auth.getUser();
  if (userErr || !user) return ok({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const proposal_id: string | undefined = body.proposal_id;
  const pr_url: string | undefined = body.pr_url;
  if (!proposal_id || !pr_url) return ok({ error: "proposal_id and pr_url required" }, 400);

  const parsed = parsePrUrl(pr_url);
  if (!parsed) return ok({ error: "unrecognized PR URL; expected https://github.com/<owner>/<repo>/pull/<n>" }, 400);

  // Load proposal + membership check.
  const { data: proposal } = await admin.from("experiment_proposals")
    .select("id, project_id, expected_hints").eq("id", proposal_id).maybeSingle();
  if (!proposal) return ok({ error: "proposal not found" }, 404);

  const { data: memberOk } = await admin.rpc("is_project_member", {
    _user_id: user.id, _project_id: proposal.project_id,
  });
  if (!memberOk) return ok({ error: "forbidden" }, 403);

  // Fetch PR metadata.
  const prRes = await gh(`/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`);
  if (!prRes.ok) {
    const text = await prRes.text();
    return ok({ error: `GitHub PR fetch failed: HTTP ${prRes.status}`, details: text.slice(0, 300) }, 502);
  }
  const pr = await prRes.json();
  if (!pr.merged_at) {
    return ok({ error: "PR is not merged; retrospective ground truth requires a merged PR" }, 400);
  }

  // Paginate files (GitHub caps at 100 per page, 3000 files total).
  const files: string[] = [];
  for (let page = 1; page <= 30; page++) {
    const fRes = await gh(`/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/files?per_page=100&page=${page}`);
    if (!fRes.ok) break;
    const rows = await fRes.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) if (typeof r?.filename === "string") files.push(r.filename);
    if (rows.length < 100) break;
  }

  // Merge PR files into expected_hints.files (dedup, case-preserving).
  const existingHints = (proposal.expected_hints ?? {}) as Record<string, unknown>;
  const existingFiles = Array.isArray(existingHints.files) ? (existingHints.files as string[]) : [];
  const mergedFiles = Array.from(new Set([...existingFiles, ...files]));
  const nextHints = { ...existingHints, files: mergedFiles };

  const { error: updErr } = await admin.from("experiment_proposals").update({
    pr_url,
    pr_repo: `${parsed.owner}/${parsed.repo}`,
    pr_number: parsed.number,
    pr_source: "github",
    pr_files: files,
    pr_fetched_at: new Date().toISOString(),
    pr_merged_at: pr.merged_at,
    pr_title: pr.title ?? null,
    source: "retrospective",
    expected_hints: nextHints,
  }).eq("id", proposal_id);
  if (updErr) return ok({ error: `update failed: ${updErr.message}` }, 500);

  return ok({
    ok: true,
    files,
    file_count: files.length,
    pr_number: parsed.number,
    repo: `${parsed.owner}/${parsed.repo}`,
    merged_at: pr.merged_at,
    title: pr.title ?? null,
  });
});
