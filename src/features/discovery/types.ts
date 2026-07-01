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

/** Auto-detect import kind from filename. */
export function detectKind(name: string): ImportKind {
  const n = name.toLowerCase();
  if (/\.(zip|tar|gz)$/.test(n)) return "repo";
  if (/openapi|swagger|\.ya?ml$|\.json$/.test(n) && /api|openapi|swagger/.test(n)) return "openapi";
  if (/\.ya?ml$/.test(n) && /openapi|swagger/.test(n)) return "openapi";
  if (/\.(sql|ddl)$/.test(n) || /schema/.test(n)) return "db_schema";
  if (/adr|decision/.test(n)) return "adr";
  if (/srs|brd|prd|requirement|spec/.test(n)) return "srs";
  if (/\.(png|jpe?g|svg|drawio|puml|mmd)$/.test(n)) return "diagram";
  if (/\.ya?ml$|\.json$/.test(n)) return "openapi";
  if (/\.md$|\.txt$|\.docx?$/.test(n)) return "srs";
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
