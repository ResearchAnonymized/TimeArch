/**
 * Domain types + small helpers for the Brownfield Discovery feature.
 * Pure module — no React, no Supabase imports.
 */
import {
  Database,
  FileCode,
  FileText,
  GitBranch,
  Globe,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export type ImportKind = "repo" | "openapi" | "db_schema" | "adr" | "srs" | "diagram" | "other";

export interface ProjectImport {
  id: string;
  project_id: string;
  kind: ImportKind;
  source_label: string;
  storage_path: string | null;
  source_url: string | null;
  status: "pending" | "parsed" | "failed";
  error: string | null;
  parsed_summary: Record<string, number> | null;
  created_at: string;
}

export interface RemotePreset {
  id: string;
  title: string;
  blurb: string;
  source_repo: string;
  license: string;
  scale: "small" | "medium" | "large";
  expected_runtime: string;
  file_count: number;
  kinds: string[];
}

export interface SeededPreset {
  id: string;
  name: string;
  description?: string;
  tag?: string;
  sourceRepo?: string;
}

export interface KindMeta {
  label: string;
  icon: LucideIcon;
}

export const KIND_META: Record<ImportKind, KindMeta> = {
  repo: { label: "Source code", icon: GitBranch },
  openapi: { label: "API spec", icon: Globe },
  db_schema: { label: "Database schema", icon: Database },
  adr: { label: "Decision record", icon: FileCode },
  srs: { label: "Requirements doc", icon: FileText },
  diagram: { label: "Diagram", icon: ImageIcon },
  other: { label: "Other", icon: FileText },
};

/** Auto-detect import kind from filename (mirrors edge `_shared/import-kind.ts`). */
export function detectKind(name: string): ImportKind {
  const n = name.replace(/\\/g, "/").toLowerCase();
  const base = n.split("/").pop() || n;

  if (/\.(zip|tar|gz|tgz)$/.test(n)) return "repo";
  if (/openapi|swagger/.test(n) && /\.(ya?ml|json)$/.test(n)) return "openapi";
  if (/\.(sql|ddl)$/.test(n) || /schema\.prisma$/.test(n) || /\/migrations\/.+\.sql$/.test(n)) {
    return "db_schema";
  }
  if (/adr|decision/.test(n) && /\.md$/.test(n)) return "adr";
  if (/^readme\.md$/.test(base) || /\/(srs|brd|prd|requirements?)\./.test(n)) return "srs";
  if (/\.(png|jpe?g|svg|drawio|puml|mmd)$/.test(n)) return "diagram";
  if (/\.(md|txt)$/.test(n) && /docs\//.test(n)) return "srs";
  if (/\.(py|js|jsx|ts|tsx|java|go|cs|rb|php|vue|svelte|html|htm|css|scss)$/.test(n)) return "repo";
  if (/package\.json$|requirements\.txt$|pyproject\.toml$|\.csproj$|pom\.xml$|go\.mod$/.test(n)) {
    return "other";
  }
  if (/\.ya?ml$|\.json$/.test(n)) return "openapi";
  if (/\.md$/.test(n)) return "srs";
  return "other";
}

export interface DemoPackItem {
  file: string;
  kind: ImportKind;
  label: string;
}

export const DEMO_PACK: DemoPackItem[] = [
  { file: "openapi.yaml", kind: "openapi", label: "ShopFlow legacy OpenAPI" },
  { file: "schema.sql", kind: "db_schema", label: "ShopFlow MySQL schema" },
  { file: "srs.md", kind: "srs", label: "ShopFlow existing-system brief" },
  { file: "adr-0001-monolith.md", kind: "adr", label: "ADR-0001 Keep monolith" },
  { file: "adr-0007-mysql.md", kind: "adr", label: "ADR-0007 Stay on MySQL" },
];
