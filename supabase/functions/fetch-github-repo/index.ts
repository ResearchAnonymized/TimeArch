/**
 * Import a public GitHub repository into project_imports + storage.
 * Uses the GitHub API for tree listing and raw.githubusercontent.com for content.
 * Only github.com hosts are allowed (SSRF protection).
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  contentTypeForPath,
  detectImportKind,
  scoreRepoPath,
  shouldSkipRepoPath,
} from "../_shared/import-kind.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || Deno.env.get("GH_TOKEN") || "";

const MAX_FILES = 200;
const MAX_BYTES_PER_FILE = 512 * 1024; // 512 KB per source file
const FETCH_TIMEOUT_MS = 30_000;
const API_TIMEOUT_MS = 20_000;

interface ParsedGithubUrl {
  owner: string;
  repo: string;
  ref?: string;
  subpath?: string;
}

interface TreeBlob {
  path: string;
  size?: number;
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseGithubUrl(input: string): ParsedGithubUrl | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.*))?)?/i,
  );
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return {
    owner,
    repo,
    ref: m[3] || undefined,
    subpath: m[4]?.replace(/\/+$/, "") || undefined,
  };
}

async function githubFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "TimeArch-Brownfield-Importer",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    return await fetch(url, { signal: ctrl.signal, headers });
  } finally {
    clearTimeout(t);
  }
}

async function fetchRaw(owner: string, repo: string, ref: string, path: string): Promise<Uint8Array> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES_PER_FILE) {
      throw new Error(`File too large (${buf.byteLength} bytes): ${path}`);
    }
    return buf;
  } finally {
    clearTimeout(t);
  }
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `GitHub repo not found: ${owner}/${repo}. Check the URL, or make sure the repo is public (private repos need GITHUB_TOKEN in .env.local).`,
      );
    }
    if (res.status === 403) {
      throw new Error(
        `GitHub rate limit or access denied for ${owner}/${repo}. Add GITHUB_TOKEN to .env.local and restart functions:serve.`,
      );
    }
    const body = await res.text();
    throw new Error(`Repository inaccessible (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.default_branch || "main";
}

async function listRepoFiles(
  owner: string,
  repo: string,
  ref: string,
  subpath?: string,
): Promise<TreeBlob[]> {
  const res = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not list repository tree (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const tree = (json.tree || []) as Array<{ path: string; type: string; size?: number }>;
  const prefix = subpath ? `${subpath.replace(/\/+$/, "")}/` : "";

  return tree
    .filter((e) => e.type === "blob")
    .filter((e) => !prefix || e.path.startsWith(prefix))
    .filter((e) => !shouldSkipRepoPath(e.path))
    .map((e) => ({ path: e.path, size: e.size }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return ok({ error: "Missing authorization" }, 401);
    const token = auth.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user) return ok({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { project_id, repo_url, ref: refOverride, max_files } = body;
    if (!project_id || !repo_url) {
      return ok({ error: "project_id and repo_url required" }, 400);
    }

    const parsed = parseGithubUrl(repo_url);
    if (!parsed) {
      return ok({ error: "Invalid GitHub URL. Use https://github.com/owner/repo" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isMember } = await supabase.rpc("is_project_member", {
      _user_id: user.id,
      _project_id: project_id,
    });
    if (!isMember) return ok({ error: "Forbidden" }, 403);

    const ref = refOverride || parsed.ref || await resolveDefaultBranch(parsed.owner, parsed.repo);
    const allBlobs = await listRepoFiles(parsed.owner, parsed.repo, ref, parsed.subpath);

    const limit = Math.min(Number(max_files) || MAX_FILES, MAX_FILES);
    const selected = allBlobs
      .sort((a, b) => scoreRepoPath(b.path) - scoreRepoPath(a.path))
      .slice(0, limit);

    const canonicalUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
    await supabase.from("projects").update({ source_repo_url: canonicalUrl }).eq("id", project_id);

    const results: Array<Record<string, unknown>> = [];
    let uploaded = 0;
    const stamp = Date.now();
    const kinds: Record<string, number> = {};

    for (const blob of selected) {
      try {
        const bytes = await fetchRaw(parsed.owner, parsed.repo, ref, blob.path);
        const textPreview = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
        const kind = detectImportKind(blob.path, textPreview);
        kinds[kind] = (kinds[kind] || 0) + 1;

        const safeName = blob.path.replace(/\//g, "__");
        const storagePath = `${project_id}/github/${parsed.repo}/${stamp}-${safeName}`;
        const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${ref}/${blob.path}`;

        const { error: upErr } = await supabase.storage.from("project-imports").upload(
          storagePath,
          bytes,
          { contentType: contentTypeForPath(blob.path), upsert: false },
        );
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("project_imports").insert({
          project_id,
          kind,
          source_label: blob.path,
          storage_path: storagePath,
          source_url: rawUrl,
          created_by: user.id,
        });
        if (insErr) throw insErr;

        uploaded++;
        results.push({
          path: blob.path,
          kind,
          status: "uploaded",
          bytes: bytes.byteLength,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ path: blob.path, status: "failed", error: msg.slice(0, 300) });
      }
    }

    return ok({
      owner: parsed.owner,
      repo: parsed.repo,
      ref,
      source_repo: canonicalUrl,
      discovered: allBlobs.length,
      selected: selected.length,
      uploaded,
      skipped: allBlobs.length - selected.length,
      kinds,
      results,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return ok({ error: msg }, 200);
  }
});
