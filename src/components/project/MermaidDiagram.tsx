import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  Code2,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  MousePointer,
  Pencil,
  X,
  ImageDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import mermaid from "mermaid";
import { buildMermaidConfig } from "@/lib/mermaid-templates";

let mermaidInitialized = false;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
const activeMermaidRenderIds = new Set<string>();

// Global MutationObserver to catch and suppress Mermaid error elements injected into body
if (typeof window !== "undefined") {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.parentElement !== document.body) continue;
        if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Syntax error")) {
          (node as ChildNode).remove();
          continue;
        }
        if (node instanceof HTMLElement && node.id !== "root") {
          const text = node.textContent || "";
          if (
            text.includes("Syntax error") ||
            text.includes("Parse error") ||
            node.querySelector?.(".error-icon")
          ) {
            node.remove();
          }
        }
        if (node instanceof SVGElement) {
          const text = node.textContent || "";
          if (text.includes("Syntax error") || text.includes("Parse error")) {
            node.remove();
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });
}

function initMermaid(dark: boolean) {
  mermaid.initialize(buildMermaidConfig(dark));
  mermaidInitialized = true;
}

interface Props {
  code: string;
  title?: string;
  type?: string;
}

function isActiveMermaidRenderNode(id: string | null): boolean {
  if (!id) return false;
  if (activeMermaidRenderIds.has(id)) return true;
  if (id.startsWith("d") && activeMermaidRenderIds.has(id.slice(1))) return true;
  return false;
}

async function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const previous = mermaidRenderQueue;
  let release!: () => void;
  mermaidRenderQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

/** Remove Mermaid leftovers without touching in-flight render containers */
function cleanupOrphanedMermaidElements() {
  // Mermaid creates temporary containers with id="d{id}" or the render id
  document.querySelectorAll('[id^="dmermaid-"], [id^="mermaid-"]').forEach((el) => {
    if (el.parentElement === document.body && !isActiveMermaidRenderNode(el.id)) {
      el.remove();
    }
  });
  // Clean up ANY stray nodes mermaid appends to body (error text, error divs, SVGs)
  const body = document.body;
  for (let i = body.childNodes.length - 1; i >= 0; i--) {
    const node = body.childNodes[i];
    // Remove stray text nodes with error messages
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("Syntax error")) {
      node.remove();
      continue;
    }
    // Remove error divs, stray SVGs, and any non-root elements mermaid injects
    if (node instanceof HTMLElement && node.id !== "root") {
      const text = node.textContent || "";
      if (
        text.includes("Syntax error") ||
        text.includes("Parse error") ||
        node.querySelector(".error-icon") ||
        (node.tagName === "SVG" && text.includes("error")) ||
        (node.tagName === "DIV" && !node.id && !node.className && text.includes("mermaid"))
      ) {
        node.remove();
      }
    }
    // Remove stray SVG elements mermaid may inject directly
    if (node instanceof SVGElement && node.parentElement === body) {
      const text = node.textContent || "";
      if (
        text.includes("Syntax error") ||
        text.includes("Parse error") ||
        node.querySelector(".error-icon")
      ) {
        node.remove();
      }
    }
  }
}

/** Sanitize AI-generated Mermaid code for compatibility with Mermaid v11 */
function sanitizeMermaidCode(raw: string): string {
  let s = raw
    .replace(/\r\n?/g, "\n")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/^```(?:mermaid)?\s*/i, "")
    .replace(/```\s*$/i, "");
  const isC4Diagram = /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/m.test(s);
  const isErDiagram = /^\s*erDiagram\b/m.test(s);
  const isFlowchartDiagram = /^\s*(?:flowchart|graph)\b/m.test(s);

  // erDiagram fixes
  if (isErDiagram) {
    // ER relationship operator pattern
    const ER_REL_OP = /[|o{}]{1,2}--[|o{}]{1,2}/;
    const ER_REL_OP_G = /[|o{}]{1,2}--[|o{}]{1,2}/g;

    // First pass: split lines that have multiple relationships concatenated
    // e.g. "Entity1 ||--o{ Entity2 : label Entity3 ||--o{ Entity4 : label2"
    const expandedLines: string[] = [];
    for (const line of s.split("\n")) {
      const trimmed = line.trim();
      const relMatches = trimmed.match(ER_REL_OP_G);
      if (relMatches && relMatches.length >= 2) {
        // Find all relationship operator positions and split between them
        let remaining = trimmed;
        const parts: string[] = [];
        let safety = 0;
        while (safety++ < 20) {
          const firstMatch = remaining.match(ER_REL_OP);
          if (!firstMatch || firstMatch.index === undefined) break;
          // Find the end of this relationship (after "EntityB : label")
          const afterOp = remaining.substring(firstMatch.index + firstMatch[0].length);
          // Look for the next relationship operator in the remaining text
          const nextMatch = afterOp.match(ER_REL_OP);
          if (!nextMatch || nextMatch.index === undefined) {
            parts.push(remaining.trim());
            remaining = "";
            break;
          }
          // The next operator starts at some position in afterOp
          // We need to find where the next entity name starts before it
          // Pattern: "... : label NextEntity ||--o{"
          // Find the entity name before the next operator
          const beforeNextOp = afterOp.substring(0, nextMatch.index);
          // The entity name is the last word before the operator
          const entityMatch = beforeNextOp.match(/\s+([A-Za-z_][\w]*)\s*$/);
          if (entityMatch && entityMatch.index !== undefined) {
            const splitPoint = firstMatch.index + firstMatch[0].length + entityMatch.index;
            parts.push(remaining.substring(0, splitPoint).trim());
            remaining = remaining.substring(splitPoint).trim();
          } else {
            parts.push(remaining.trim());
            remaining = "";
            break;
          }
        }
        if (remaining) parts.push(remaining.trim());
        for (const part of parts) {
          if (part) expandedLines.push("    " + part);
        }
      } else {
        expandedLines.push(line);
      }
    }

    s = expandedLines
      .map((line) => {
        const trimmed = line.trim();

        // Fix field types with Enum('...', '...') → replace with string
        if (/Enum\s*\(/i.test(trimmed)) {
          return line.replace(/Enum\s*\([^)]*\)/gi, "string");
        }

        // Fix field types with parentheses like Varchar(255) → Varchar255
        if (/\w\(/.test(trimmed) && !trimmed.includes("--") && !trimmed.includes("||")) {
          let fixed = line.replace(/(\w+)\(([^)]*)\)/g, (_m, type, inner) => {
            const cleaned = inner
              .replace(/[',\s]/g, "_")
              .replace(/_+/g, "_")
              .replace(/^_|_$/g, "");
            return `${type}_${cleaned}`;
          });
          return fixed;
        }

        // Fix field types with single quotes like 'Draft' → remove quotes
        if (!ER_REL_OP.test(trimmed) && /'[^']*'/.test(trimmed)) {
          return line.replace(/'([^']*)'/g, "$1");
        }

        const isRelationshipLine =
          ER_REL_OP.test(trimmed) &&
          !trimmed.endsWith("{") &&
          !/^[A-Za-z_][\w-]*\s*\{$/.test(trimmed);

        if (!isRelationshipLine) return line;

        // For relationship lines, ensure the label doesn't contain another entity+operator
        // e.g. "UserRole : assigned to Role ||--o{" → truncate label to "assigned to"
        let fixed = line;
        const labelMatch = fixed.match(/^(.*?:\s*)(.*)$/);
        if (labelMatch) {
          let label = labelMatch[2];
          // If label contains a relationship operator, truncate before the entity name preceding it
          const opInLabel = label.match(/\s+[A-Za-z_][\w]*\s*[|o{}]{1,2}--/);
          if (opInLabel && opInLabel.index !== undefined) {
            label = label.substring(0, opInLabel.index).trim();
          }
          // Also truncate if label just ends with what looks like an operator
          const trailingOp = label.match(/\s*[|o{}]{1,2}--[|o{}]{0,2}\s*$/);
          if (trailingOp && trailingOp.index !== undefined) {
            label = label.substring(0, trailingOp.index).trim();
          }
          fixed = labelMatch[1] + label;
        }

        return fixed
          .replace(/\s*\{[^}]*\}(?=\s*[|o{}]+--)/g, "")
          .replace(/(?<=--[|o{}]+\s+[A-Za-z_][\w-]*)\s*\{[^}]*\}/g, "")
          .replace(/\s*:\s*[^\n{]*\{[^}]*\}\s*$/g, "")
          .replace(/\s{2,}/g, " ")
          .trimEnd();
      })
      .join("\n");
  }

  // Fix ALL unicode arrow variants that AI generates instead of ASCII
  s = s.replace(/[\u27F6\u2192\u2794\u279C\u21E8\u2B95]/g, "-->");
  s = s.replace(/\u2014+>/g, "-->"); // em-dash arrows
  s = s.replace(/\u2013+>/g, "-->"); // en-dash arrows
  s = s.replace(/—+>/g, "-->");
  s = s.replace(/–+>/g, "-->");
  s = s.replace(/[^\x00-\x7F]+>/g, "-->");

  // Fix "--->" (triple dash or more) which is invalid
  s = s.replace(/-{3,}>/g, "-->");

  // Clean parentheses inside |...| edge labels — they confuse the parser
  s = s.replace(/\|([^|]*)\|/g, (_m, inner) => {
    const cleaned = inner.replace(/[()]/g, "").trim();
    return `|${cleaned}|`;
  });

  // Remove ALL parenthetical annotations from relationship lines
  s = s.replace(/^(\s*\S+\s+[-|.><]+\s+\S+)\s*:.*\(.*\).*$/gm, "$1");

  // Strip trailing parenthetical notes only from arrow relationship labels, never from function-style nodes like C4 Person(...)
  if (!isC4Diagram) {
    s = s.replace(
      /^(\s*[^\n]*?(?:-->|---|==>|-.->|-\.->|==o|o==|--x|x--|<--|<->|<-->)[^\n]*?:\s*[^()\n]*?)\s+\([^()\n]*\)\s*$/gm,
      "$1",
    );
  }

  // Normalize subgraph declarations into explicit, unique ids with quoted labels.
  // This avoids Mermaid crashes from spaces/colons in labels and node/subgraph id collisions.
  const normalizedSubgraphIds = new Map<string, string>();
  let subgraphCount = 0;
  s = s
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*)subgraph\s+(.+)$/);
      if (!match) return line;

      const [, indent, rawDescriptor] = match;
      const descriptor = rawDescriptor.trim();
      if (!descriptor) return line;

      const existingLabeledMatch = descriptor.match(/^([A-Za-z_][\w]*)\s*\[(.*)\]$/);
      if (existingLabeledMatch) {
        const [, id, rawLabel] = existingLabeledMatch;
        const label = rawLabel.replace(/^\"|\"$/g, "").trim() || id;
        const safeId = normalizedSubgraphIds.get(id) || `sg_${toMermaidId(id) || ++subgraphCount}`;
        normalizedSubgraphIds.set(id, safeId);
        return `${indent}subgraph ${safeId}[\"${escapeMermaidLabel(label)}\"]`;
      }

      const bareIdMatch = descriptor.match(/^([A-Za-z_][\w]*)$/);
      if (bareIdMatch) {
        const originalId = bareIdMatch[1];
        const safeId =
          normalizedSubgraphIds.get(originalId) ||
          `sg_${toMermaidId(originalId) || ++subgraphCount}`;
        normalizedSubgraphIds.set(originalId, safeId);
        return `${indent}subgraph ${safeId}[\"${escapeMermaidLabel(originalId)}\"]`;
      }

      const safeId = `sg_${toMermaidId(descriptor).replace(/^_+|_+$/g, "") || ++subgraphCount}`;
      normalizedSubgraphIds.set(descriptor, safeId);
      return `${indent}subgraph ${safeId}[\"${escapeMermaidLabel(descriptor)}\"]`;
    })
    .join("\n");

  // Remove empty subgraph blocks after normalization.
  s = s.replace(/subgraph\s+[A-Za-z_][\w]*\[[^\]]*\]\s*\n\s*end/g, "");

  // Fix invalid style properties: remove "text-align: left" and similar CSS-only properties
  // Mermaid style directives use semicolons as separators but "text-align" is not a valid SVG property
  s = s.replace(/[;,]?\s*text-align:\s*\w+/gi, "");

  // Fix style lines with semicolons used as property separators WITHIN the value
  // e.g. "style C fill:#fda,stroke:#000,stroke-width:2px; color:#000"
  // The semicolon should be a comma in Mermaid style directives
  s = s.replace(/^(\s*style\s+\S+\s+.*)$/gm, (line) => {
    // Replace semicolons between style properties with commas
    return line.replace(/;\s*(?=\w+-?\w*:)/g, ",");
  });

  // Pre-pass: convert "NodeA -- label with (parens) --> NodeB" to proper syntax
  // and "NodeA -- label --> NodeB" bare double-dash edge labels
  if (isFlowchartDiagram) {
    s = s
      .split("\n")
      .map((line) => {
        // Match: ID -- some label text (possibly with parens) --> ID
        const dashLabelMatch = line.match(
          /^(\s*)([A-Za-z_][\w]*)\s+--\s+([^-].*?)\s*-->\s*([A-Za-z_][\w]*)\s*$/,
        );
        if (dashLabelMatch) {
          const [, indent, src, rawLabel, tgt] = dashLabelMatch;
          const label = rawLabel.replace(/[()]/g, "").trim();
          return label
            ? `${indent}${src} -->|"${escapeMermaidLabel(label)}"| ${tgt}`
            : `${indent}${src} --> ${tgt}`;
        }
        // Match: ID -- some label text (possibly with parens) --- ID (triple dash)
        const tripleDashMatch = line.match(
          /^(\s*)([A-Za-z_][\w]*)\s+---?\s+([^-].*?)\s*--->\s*([A-Za-z_][\w]*)\s*$/,
        );
        if (tripleDashMatch) {
          const [, indent, src, rawLabel, tgt] = tripleDashMatch;
          const label = rawLabel.replace(/[()]/g, "").trim();
          return label
            ? `${indent}${src} -->|"${escapeMermaidLabel(label)}"| ${tgt}`
            : `${indent}${src} --> ${tgt}`;
        }
        return line;
      })
      .join("\n");
  }

  if (isFlowchartDiagram) {
    // Pre-pass A: re-quote node labels that contain unsafe chars (parens, commas, colons,
    // slashes, ampersands, quotes). Mermaid's lexer breaks on `B[Foo (Bar, Baz)]`, but
    // `B["Foo (Bar, Baz)"]` parses fine. We detect unquoted label wrappers and rewrap them
    // with `escapeMermaidLabel`, which neutralizes the offending characters via HTML entities.
    s = s.replace(
      /\b([A-Za-z_][\w]*)(\[|\(|\{\{|\{)([^"\n][^\n]*?)(\]|\)|\}\}|\})/g,
      (match, id, open, label, close) => {
        // Skip already-quoted labels and shape pairs that don't match
        if (/^["']/.test(label.trim())) return match;
        const pairs: Record<string, string> = { "[": "]", "(": ")", "{": "}", "{{": "}}" };
        if (pairs[open] !== close) return match;
        // Only rewrite when the label actually contains a problematic char
        if (!/[(){}\[\]"|,:;\/&]/.test(label)) return match;
        return `${id}${open}"${escapeMermaidLabel(label)}"${close}`;
      },
    );

    // Pre-pass B: drop orphan single-token lines (bare `F`, `H`, etc.) that the AI sometimes
    // emits when generating risk/flow diagrams. These trigger "no diagram type detected" or
    // silent parse failures.
    s = s
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        // Keep keywords, edges, declarations, styles
        if (
          /^(flowchart|graph|subgraph|direction|end|%%|style\b|classDef\b|class\b|linkStyle\b|click\b)/i.test(
            t,
          )
        )
          return true;
        if (/[\[\](){}]/.test(t)) return true; // has shape
        if (/(?:-->|<--|---|==>|-\.->|<->|--x|x--|o--|--o|<-|->|:)/.test(t)) return true; // edge or relation
        // A lone identifier (or a couple of identifiers without any edge/shape) is noise — drop it
        return !/^[A-Za-z_][\w]*(?:\s+[A-Za-z_][\w]*)*$/.test(t);
      })
      .join("\n");

    const hoistedNodeDeclarations = new Map<string, string>();
    const edgePattern = /(?:<-->|<--|-->|---|==>|-\.->|<->|--x|x--|o--|--o|<-|->)/;

    s = s
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (/^(%%|style\b|classDef\b|class\b|linkStyle\b|click\b) /i.test(trimmed)) return line;
        if (/^(subgraph|direction|end)\b/i.test(trimmed)) return line;

        // Fix bare multi-word node names used in edges, e.g.:
        // "Document Management Module -- internal API --> User & Access Module"
        // Convert to: DM_id["Document Management Module"] -->|internal API| UA_id["User & Access Module"]
        const bareEdgeMatch = trimmed.match(
          /^([A-Za-z][A-Za-z0-9 &_-]+?)\s+--\s*([^->|]*?)\s*-->\s*([A-Za-z][A-Za-z0-9 &_-]+?)\s*$/,
        );
        if (bareEdgeMatch) {
          const [, src, label, tgt] = bareEdgeMatch;
          const srcId = toMermaidId(src.trim());
          const tgtId = toMermaidId(tgt.trim());
          hoistedNodeDeclarations.set(srcId, `${srcId}["${escapeMermaidLabel(src.trim())}"]`);
          hoistedNodeDeclarations.set(tgtId, `${tgtId}["${escapeMermaidLabel(tgt.trim())}"]`);
          const lbl = label.trim();
          return lbl
            ? `${srcId} -->|${escapeMermaidLabel(lbl)}| ${tgtId}`
            : `${srcId} --> ${tgtId}`;
        }

        // Fix bare multi-word names without labels: "ModA --> ModB" where names have spaces
        const bareSimpleEdgeMatch = trimmed.match(
          /^([A-Za-z][A-Za-z0-9 &_-]*\s[A-Za-z0-9 &_-]+)\s*(-->|---|==>|-\.->)\s*([A-Za-z][A-Za-z0-9 &_-]*\s[A-Za-z0-9 &_-]+)\s*$/,
        );
        if (bareSimpleEdgeMatch) {
          const [, src, arrow, tgt] = bareSimpleEdgeMatch;
          const srcId = toMermaidId(src.trim());
          const tgtId = toMermaidId(tgt.trim());
          hoistedNodeDeclarations.set(srcId, `${srcId}["${escapeMermaidLabel(src.trim())}"]`);
          hoistedNodeDeclarations.set(tgtId, `${tgtId}["${escapeMermaidLabel(tgt.trim())}"]`);
          return `${srcId} ${arrow} ${tgtId}`;
        }

        const inlineReverseEdgeMatch = line.match(
          /^\s*([A-Za-z_][\w]*)\s*<--\s*([A-Za-z_][\w]*)\(([^()\n"]+?)\)\s*$/,
        );
        if (inlineReverseEdgeMatch) {
          const [, targetId, sourceId, sourceLabel] = inlineReverseEdgeMatch;
          hoistedNodeDeclarations.set(
            sourceId,
            `${sourceId}["${escapeMermaidLabel(sourceLabel.trim())}"]`,
          );
          return `${sourceId} --> ${targetId}`;
        }

        let next = line;

        const normalizeNode = (id: string, label: string) =>
          `${id}["${escapeMermaidLabel(label.trim())}"]`;
        const hoistIfNeeded = (id: string, label: string) => {
          const declaration = normalizeNode(id, label);
          if (edgePattern.test(trimmed)) {
            hoistedNodeDeclarations.set(id, declaration);
            return id;
          }
          return declaration;
        };

        next = next.replace(/\b([A-Za-z_][\w]*)\[\(([^\]\n]+)\)\]/g, (_match, id, label) => {
          return hoistIfNeeded(id, label);
        });

        next = next.replace(/\b([A-Za-z_][\w]*)\(\(([^\)\n]+)\)\)/g, (_match, id, label) => {
          return hoistIfNeeded(id, label);
        });

        next = next.replace(/\b([A-Za-z_][\w]*)\(([^()\n"]+?)\)/g, (_match, id, label) => {
          return hoistIfNeeded(id, label);
        });

        next = next.replace(/\b([A-Za-z_][\w]*)\[([^\[\]\n"]+?)\]/g, (_match, id, label) => {
          return hoistIfNeeded(id, label);
        });

        next = next.replace(/\b([A-Za-z_][\w]*)\{\{([^{}\n"]+?)\}\}/g, (_match, id, label) => {
          return hoistIfNeeded(id, label);
        });

        if (edgePattern.test(trimmed) && hoistedNodeDeclarations.size > 0) {
          const declarations = Array.from(hoistedNodeDeclarations.values()).filter(
            (declaration) => !next.includes(declaration),
          );
          if (declarations.length > 0) {
            return `${declarations.join("\n")}\n${next}`;
          }
        }

        return next;
      })
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (
          /^(flowchart|graph|subgraph|direction|end|%%|style\b|classDef\b|class\b|linkStyle\b|click\b)/i.test(
            trimmed,
          )
        ) {
          return true;
        }

        const hasDanglingArrow =
          /(?:<-->|<--|-->|---|==>|-\.->|<->|--x|x--|o--|--o|<-|->|<|>)\s*$/.test(trimmed);
        const hasNoTarget =
          /(?:-->|<--|---|==>|-\.->|<->|--x|x--|o--|--o|<-|->|<|>)/.test(trimmed) &&
          hasDanglingArrow;
        return !hasNoTarget;
      })
      .join("\n");
  }

  return s;
}

function createFlowchartFallback(raw: string): string {
  const sanitized = sanitizeMermaidCode(raw);
  const lines = sanitized.split("\n");
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^(flowchart|graph)\b/i.test(trimmed)) {
      output.push(
        trimmed.startsWith("graph") ? trimmed.replace(/^graph\b/i, "flowchart") : trimmed,
      );
      continue;
    }

    if (/^(subgraph|direction|end|%%)/i.test(trimmed)) {
      output.push(line);
      continue;
    }

    if (/^(style\b|classDef\b|class\b|linkStyle\b|click\b)/i.test(trimmed)) {
      continue;
    }

    const isMalformed = /(?:-->|<--|---|==>|-\.->|<->|--x|x--|o--|--o|<-|->|<|>)\s*$/.test(trimmed);
    if (isMalformed) continue;

    output.push(line);
  }

  return output.join("\n");
}

/**
 * Last-resort fallback: salvage any node IDs and edges via regex and rebuild a
 * minimal flowchart. Drops subgraphs, styles, classDefs, edge labels — anything
 * that could trip the parser. As long as the source has identifiable arrows,
 * this produces *some* renderable diagram instead of an empty error card.
 */
function createMinimalFlowchartFallback(raw: string): string {
  const ARROW =
    /([A-Za-z_][\w]*)\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(?:--+>|--+|==+>|-\.->|<--|<-\.-|--x|x--|--o|o--)\s*(?:\|[^|]*\|\s*)?([A-Za-z_][\w]*)/g;
  const NODE_LABEL = /\b([A-Za-z_][\w]*)\s*(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})/g;

  const nodes = new Map<string, string>();
  const edges: Array<[string, string]> = [];

  let m: RegExpExecArray | null;
  while ((m = NODE_LABEL.exec(raw))) {
    const id = m[1];
    if (!nodes.has(id)) {
      // Strip the wrapper chars and quotes; truncate long labels
      const inner = m[2]
        .slice(1, -1)
        .replace(/^["']|["']$/g, "")
        .trim();
      nodes.set(id, inner.length > 50 ? inner.slice(0, 47) + "..." : inner || id);
    }
  }
  while ((m = ARROW.exec(raw))) {
    const [, from, to] = m;
    if (from && to && from !== to) {
      edges.push([from, to]);
      if (!nodes.has(from)) nodes.set(from, from);
      if (!nodes.has(to)) nodes.set(to, to);
    }
  }

  if (nodes.size === 0 || edges.length === 0) return "";

  const lines = ["flowchart TD"];
  for (const [id, label] of nodes) {
    lines.push(`    ${id}["${escapeMermaidLabel(label)}"]`);
  }
  const seen = new Set<string>();
  for (const [from, to] of edges) {
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`    ${from} --> ${to}`);
  }
  return lines.join("\n");
}

function escapeMermaidLabel(value: string): string {
  return (
    String(value ?? "")
      // Neutralize quotes & line breaks
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "<br/>")
      // Neutralize characters that break the Mermaid lexer when nested inside [ ] ( ) { }
      .replace(/\(/g, "&#40;")
      .replace(/\)/g, "&#41;")
      .replace(/\[/g, "&#91;")
      .replace(/\]/g, "&#93;")
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;")
      // Pipe is the edge-label delimiter
      .replace(/\|/g, "&#124;")
      // Backticks/semicolons sometimes confuse the parser
      .replace(/;/g, ",")
      .replace(/`/g, "'")
      .trim()
  );
}

function toMermaidId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, "_");
}

function parseC4Args(input: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== "\\") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, "").trim());
}

/** Convert a failed ER diagram into a simple flowchart showing entities and relationships */
function convertErToFlowchart(raw: string): string {
  const lines = raw.split("\n");
  const entities: string[] = [];
  const relationships: { from: string; to: string; label: string }[] = [];
  const ER_REL = /^\s*(\S+)\s+[|o{}]{1,2}--[|o{}]{1,2}\s+(\S+)\s*(?::\s*(.*))?$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "erDiagram") continue;
    const relMatch = trimmed.match(ER_REL);
    if (relMatch) {
      const [, from, to, label] = relMatch;
      if (!entities.includes(from)) entities.push(from);
      if (!entities.includes(to)) entities.push(to);
      relationships.push({ from, to, label: (label || "").trim() });
    } else if (/^[A-Za-z_][\w]*\s*\{/.test(trimmed)) {
      const name = trimmed.replace(/\s*\{.*/, "").trim();
      if (!entities.includes(name)) entities.push(name);
    }
  }

  const out = ["flowchart LR"];
  for (const e of entities) {
    out.push(`    ${e}["${e}"]`);
  }
  for (const r of relationships) {
    const lbl = r.label ? ` -->|${r.label.replace(/[|"]/g, "")}|` : " -->";
    out.push(`    ${r.from}${lbl} ${r.to}`);
  }
  return out.join("\n");
}

/** Convert a failed sequence diagram into a simple flowchart showing participants and message flow */
function convertSequenceToFlowchart(raw: string): string {
  const lines = raw.split("\n");
  const participants: string[] = [];
  const participantLabels = new Map<string, string>();
  const messages: { from: string; to: string; label: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "sequenceDiagram") continue;
    if (
      /^(?:activate|deactivate|Note|loop|alt|else|opt|par|and|end|rect|critical|break)\b/.test(
        trimmed,
      )
    )
      continue;

    const partMatch = trimmed.match(/^(?:participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/);
    if (partMatch) {
      const id = partMatch[1];
      const label = partMatch[2] || id;
      if (!participants.includes(id)) participants.push(id);
      participantLabels.set(id, label);
      continue;
    }

    const msgMatch = trimmed.match(/^(\S+?)\s*-?->>?\+?\s*(\S+?)\s*:\s*(.*)$/);
    if (msgMatch) {
      const [, from, to, label] = msgMatch;
      if (!participants.includes(from)) participants.push(from);
      if (!participants.includes(to)) participants.push(to);
      messages.push({ from, to, label: label.trim() });
    }
  }

  if (participants.length === 0) return 'flowchart LR\n    A["No participants found"]';

  const out = ["flowchart LR"];
  for (const p of participants) {
    const label = participantLabels.get(p) || p;
    const safeId = toMermaidId(p);
    out.push(`    ${safeId}["${escapeMermaidLabel(label)}"]`);
  }

  const seenEdges = new Set<string>();
  for (const m of messages) {
    const fromId = toMermaidId(m.from);
    const toId = toMermaidId(m.to);
    const edgeKey = `${fromId}-${toId}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);
    const lbl = m.label ? ` -->|"${escapeMermaidLabel(m.label)}"| ` : " --> ";
    out.push(`    ${fromId}${lbl}${toId}`);
  }

  return out.join("\n");
}

function convertC4ToFlowchart(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const titleLine = lines.find((line) => line.startsWith("title "));
  const title = titleLine?.replace(/^title\s+/, "").trim();
  const body = lines.filter((line) => line !== "{" && line !== "}");

  const nodes = new Map<string, { label: string; shape: string }>();
  const relations: Array<{ from: string; to: string; label?: string }> = [];
  const boundaries: Array<{ id: string; label: string; members: string[] }> = [];
  let currentBoundary: { id: string; label: string; members: string[] } | null = null;

  for (const line of body) {
    if (
      /^C4(?:Context|Container|Component|Dynamic|Deployment)\b/.test(line) ||
      /^title\b/.test(line)
    ) {
      continue;
    }

    const boundaryMatch = line.match(/^System_Boundary\((.+)\)\s*\{$/);
    if (boundaryMatch) {
      const [id, label] = parseC4Args(boundaryMatch[1]);
      currentBoundary = {
        id: toMermaidId(id || label || "boundary"),
        label: label || id || "System Boundary",
        members: [],
      };
      boundaries.push(currentBoundary);
      continue;
    }

    if (line === "}") {
      currentBoundary = null;
      continue;
    }

    const entityMatch = line.match(
      /^(Person|System|System_Ext|SystemDb|Container|ContainerDb|Component)\((.+)\)$/,
    );
    if (entityMatch) {
      const kind = entityMatch[1];
      const [id, label, description] = parseC4Args(entityMatch[2]);
      const nodeId = toMermaidId(id || label || kind.toLowerCase());
      const text = [label || id || kind, description].filter(Boolean).join("<br/>");
      const shape = /Db$/.test(kind)
        ? `[("${escapeMermaidLabel(text)}")]`
        : `["${escapeMermaidLabel(text)}"]`;
      nodes.set(nodeId, { label: text, shape });
      if (currentBoundary) currentBoundary.members.push(nodeId);
      continue;
    }

    const relMatch = line.match(/^Rel(?:_[A-Z]+)?\((.+)\)$/);
    if (relMatch) {
      const [from, to, label] = parseC4Args(relMatch[1]);
      if (from && to) {
        relations.push({ from: toMermaidId(from), to: toMermaidId(to), label });
      }
    }
  }

  const nodeLines: string[] = [];
  const seen = new Set<string>();

  for (const boundary of boundaries) {
    nodeLines.push(`subgraph ${boundary.id}["${escapeMermaidLabel(boundary.label)}"]`);
    for (const member of boundary.members) {
      const node = nodes.get(member);
      if (node) {
        nodeLines.push(`  ${member}${node.shape}`);
        seen.add(member);
      }
    }
    nodeLines.push("end");
  }

  for (const [id, node] of nodes.entries()) {
    if (!seen.has(id)) nodeLines.push(`${id}${node.shape}`);
  }

  const relationLines = relations.map(({ from, to, label }) =>
    label ? `${from} -->|${escapeMermaidLabel(label)}| ${to}` : `${from} --> ${to}`,
  );

  return ["flowchart TD", ...(title ? [`%% ${title}`] : []), ...nodeLines, ...relationLines].join(
    "\n",
  );
}

type InteractionMode = "pan" | "edit";

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
  variant,
}: {
  icon: typeof ZoomIn;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : variant === "primary"
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function MermaidDiagram({ code: initialCode, title, type }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(initialCode);
  const [mode, setMode] = useState<InteractionMode>("pan");

  // Pan & zoom state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Inline edit state
  const [editingNode, setEditingNode] = useState<{ original: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editPos, setEditPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark =
    typeof window !== "undefined" && document.documentElement.classList.contains("dark");

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const renderDiagram = useCallback(
    async (retryCount = 0) => {
      if (!code?.trim()) return;
      const primaryId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      let fallbackIds: string[] = [];

      activeMermaidRenderIds.add(primaryId);
      try {
        initMermaid(isDark);
        const sanitized = sanitizeMermaidCode(code.trim());
        const isC4Diagram = /^\s*C4(?:Context|Container|Component|Dynamic|Deployment)\b/m.test(
          sanitized,
        );
        const isFlowchartDiagram = /^\s*(?:flowchart|graph)\b/m.test(sanitized);
        const isErDiagram = /^\s*erDiagram\b/m.test(sanitized);
        const isSequenceDiagram = /^\s*sequenceDiagram\b/m.test(sanitized);
        const rendered = await enqueueMermaidRender(async () => {
          const attempts = [{ id: primaryId, code: sanitized }];

          if (isC4Diagram) {
            const c4FallbackId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
            fallbackIds.push(c4FallbackId);
            activeMermaidRenderIds.add(c4FallbackId);
            attempts.push({ id: c4FallbackId, code: convertC4ToFlowchart(sanitized) });
          }

          if (isFlowchartDiagram || isC4Diagram) {
            const flowFallbackId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
            fallbackIds.push(flowFallbackId);
            activeMermaidRenderIds.add(flowFallbackId);
            attempts.push({ id: flowFallbackId, code: createFlowchartFallback(sanitized) });
          }

          // ER diagram fallback: convert to a simple flowchart showing entities and relationships
          if (isErDiagram) {
            const erFallbackId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
            fallbackIds.push(erFallbackId);
            activeMermaidRenderIds.add(erFallbackId);
            attempts.push({ id: erFallbackId, code: convertErToFlowchart(sanitized) });
          }

          // Sequence diagram fallback: convert to a simple flowchart showing participants and messages
          if (isSequenceDiagram) {
            const seqFallbackId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
            fallbackIds.push(seqFallbackId);
            activeMermaidRenderIds.add(seqFallbackId);
            attempts.push({ id: seqFallbackId, code: convertSequenceToFlowchart(sanitized) });
          }

          // Last-resort: regex-salvage nodes & edges into a minimal flowchart.
          // Always tried last so we never show an empty diagram if the source
          // contains any identifiable arrows.
          const minimal = createMinimalFlowchartFallback(sanitized);
          if (minimal) {
            const minId = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
            fallbackIds.push(minId);
            activeMermaidRenderIds.add(minId);
            attempts.push({ id: minId, code: minimal });
          }

          let lastError: unknown = null;
          const seenCodes = new Set<string>();

          for (const attempt of attempts) {
            if (seenCodes.has(attempt.code.trim())) continue;
            seenCodes.add(attempt.code.trim());

            try {
              const result = await mermaid.render(attempt.id, attempt.code);
              return result.svg;
            } catch (attemptError) {
              lastError = attemptError;
            }
          }

          throw lastError;
        });

        setSvg(rendered);
        setError(null);
      } catch (e: any) {
        const errorMsg = e?.message || String(e) || "";
        // If dynamic import failed (stale chunks), retry once after re-init
        if (
          retryCount < 1 &&
          (errorMsg.includes("dynamically imported module") || errorMsg.includes("Failed to fetch"))
        ) {
          console.warn("[MermaidDiagram] Dynamic import failed, retrying with re-init...");
          mermaidInitialized = false;
          activeMermaidRenderIds.delete(primaryId);
          fallbackIds.forEach((id) => activeMermaidRenderIds.delete(id));
          cleanupOrphanedMermaidElements();
          return renderDiagram(retryCount + 1);
        }
        console.error("Mermaid render error:", e);
        setError(errorMsg || "Failed to render diagram");
        setSvg("");
      } finally {
        activeMermaidRenderIds.delete(primaryId);
        fallbackIds.forEach((id) => activeMermaidRenderIds.delete(id));
        cleanupOrphanedMermaidElements();
      }
    },
    [code, isDark],
  );

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  // Re-render when global Mermaid templates change so updates propagate live.
  useEffect(() => {
    const handler = () => {
      mermaidInitialized = false;
      renderDiagram();
    };
    window.addEventListener("mermaid-templates-change", handler);
    return () => window.removeEventListener("mermaid-templates-change", handler);
  }, [renderDiagram]);

  // Add hover highlights for editable text when in edit mode
  useEffect(() => {
    if (!containerRef.current || !svg) return;
    const container = containerRef.current;
    const textEls = container.querySelectorAll(
      "text, tspan, foreignObject, .nodeLabel, .edgeLabel, .label, .cluster-label",
    );

    if (mode === "edit") {
      textEls.forEach((el) => {
        (el as HTMLElement).style.cursor = "text";
        (el as HTMLElement).style.transition = "opacity 0.15s";
      });
      const handleOver = (e: Event) => {
        const t = (e.target as Element).closest(
          "text, foreignObject, .nodeLabel, .edgeLabel, .label, .cluster-label",
        );
        if (t) (t as HTMLElement).style.opacity = "0.7";
      };
      const handleOut = (e: Event) => {
        const t = (e.target as Element).closest(
          "text, foreignObject, .nodeLabel, .edgeLabel, .label, .cluster-label",
        );
        if (t) (t as HTMLElement).style.opacity = "1";
      };
      container.addEventListener("mouseover", handleOver);
      container.addEventListener("mouseout", handleOut);
      return () => {
        container.removeEventListener("mouseover", handleOver);
        container.removeEventListener("mouseout", handleOut);
        textEls.forEach((el) => {
          (el as HTMLElement).style.cursor = "";
          (el as HTMLElement).style.opacity = "1";
        });
      };
    } else {
      textEls.forEach((el) => {
        (el as HTMLElement).style.cursor = "";
      });
    }
  }, [svg, mode]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(Math.max(0.3, s + delta), 3));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (mode === "edit") return; // don't pan in edit mode
      const target = e.target as Element;
      if (target.closest("input")) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
    },
    [translate, mode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setTranslate({
        x: translateStart.current.x + (e.clientX - panStart.current.x),
        y: translateStart.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  // Click text to edit (only in edit mode)
  const handleDiagramClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== "edit") return;
      const target = e.target as Element;

      // Try SVG <text> first, then foreignObject content (spans/divs inside nodes)
      let textEl: Element | null = target.closest("text");
      let textContent = textEl?.textContent || "";

      if (!textEl || !textContent.trim()) {
        // Mermaid often renders node labels inside foreignObject > div > span
        const foParent = target.closest("foreignObject");
        if (foParent) {
          textEl = foParent;
          textContent = foParent.textContent || "";
        }
      }

      // Also try clicking directly on a span/div inside a node group
      if (!textEl || !textContent.trim()) {
        const nodeGroup = target.closest(".node, .label, .nodeLabel, .edgeLabel, .cluster-label");
        if (nodeGroup) {
          textEl = nodeGroup;
          textContent = nodeGroup.textContent || "";
        }
      }

      if (!textEl || !textContent.trim()) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const textRect = textEl.getBoundingClientRect();

      setEditingNode({ original: textContent });
      setEditValue(textContent);
      setEditPos({
        x: textRect.left - rect.left + textRect.width / 2,
        y: textRect.top - rect.top + textRect.height / 2,
      });

      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [mode],
  );

  const commitEdit = useCallback(() => {
    if (!editingNode || editValue === editingNode.original) {
      setEditingNode(null);
      return;
    }

    const oldText = editingNode.original.trim();
    const newText = editValue.trim();
    if (oldText && newText && oldText !== newText) {
      setCode((prev) => prev.split(oldText).join(newText));
      toast.success("Diagram updated");
    }
    setEditingNode(null);
  }, [editingNode, editValue]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Mermaid code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as SVG");
  };

  const handleDownloadPNG = async () => {
    if (!svg) return;
    try {
      // Ensure SVG has explicit xmlns for standalone rendering
      let svgString = svg;
      if (!/xmlns=/.test(svgString)) {
        svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      // Determine intrinsic dimensions
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svgEl = doc.documentElement as unknown as SVGSVGElement;
      const viewBox = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
      const baseW = Number(svgEl.getAttribute("width")) || (viewBox?.[2] ?? 1200);
      const baseH = Number(svgEl.getAttribute("height")) || (viewBox?.[3] ?? 800);

      // 2x scale for crisp output in reports
      const scale = 2;
      const width = Math.max(1, Math.round(baseW * scale));
      const height = Math.max(1, Math.round(baseH * scale));

      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas not supported"));
            return;
          }
          // White background so PNG is usable in light report templates
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              reject(new Error("PNG conversion failed"));
              return;
            }
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `${(title || "diagram").replace(/\s+/g, "_").toLowerCase()}.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
            URL.revokeObjectURL(url);
            resolve();
          }, "image/png");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG"));
        };
        img.src = url;
      });

      toast.success("Downloaded as PNG");
    } catch (err: any) {
      toast.error(err?.message || "PNG export failed");
    }
  };

  const typeLabel = type?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Diagram";

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-display font-semibold text-sm text-foreground">Diagram</span>
          {title && <span className="text-xs text-muted-foreground">— {title}</span>}
          <button
            onClick={() => {
              setError(null);
              setSvg("");
              renderDiagram();
            }}
            className="ml-auto text-[11px] px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
          >
            Retry render
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          This diagram could not be rendered automatically. The source is shown below for reference.
        </p>
        <details className="mb-2">
          <summary className="text-[11px] text-destructive cursor-pointer hover:underline list-none select-none">
            ▶ Show parser error
          </summary>
          <pre className="mt-2 text-[10px] font-mono bg-destructive/5 border border-destructive/20 rounded p-2 overflow-x-auto text-destructive whitespace-pre-wrap">
            {error}
          </pre>
        </details>
        <details className="group">
          <summary className="text-[11px] text-primary cursor-pointer hover:underline mb-2 list-none inline-flex items-center gap-1 select-none">
            <span className="group-open:hidden">▶ Show diagram source</span>
            <span className="hidden group-open:inline">▼ Hide diagram source</span>
          </summary>
          <pre className="text-[10px] font-mono bg-secondary/50 rounded p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap">
            {code}
          </pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-lg border bg-card p-6 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const cursorStyle = mode === "edit" ? "crosshair" : isPanning ? "grabbing" : "grab";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={`rounded-xl border bg-card overflow-hidden transition-shadow ${
          expanded ? "shadow-lg ring-1 ring-primary/20" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-secondary/30">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {typeLabel}
          </span>
          {title && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs font-display font-semibold text-foreground truncate flex-1">
                {title}
              </span>
            </>
          )}

          {/* Toolbar — right side */}
          <div className="flex items-center gap-px ml-auto">
            {/* Mode toggle */}
            <div className="flex items-center bg-secondary/60 rounded-md p-0.5 mr-1">
              <ToolbarButton
                icon={Move}
                label="Pan mode (drag to move)"
                onClick={() => setMode("pan")}
                active={mode === "pan"}
              />
              <ToolbarButton
                icon={Pencil}
                label="Edit mode (click text to rename)"
                onClick={() => setMode("edit")}
                active={mode === "edit"}
              />
            </div>

            {/* Zoom controls */}
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-center">
              {Math.round(scale * 100)}%
            </span>
            <ToolbarButton
              icon={ZoomIn}
              label="Zoom in"
              onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            />
            <ToolbarButton
              icon={ZoomOut}
              label="Zoom out"
              onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}
            />
            <ToolbarButton icon={RotateCcw} label="Reset view" onClick={resetView} />

            <div className="w-px h-4 bg-border mx-1" />

            {/* View/Export controls */}
            <ToolbarButton
              icon={showCode ? Eye : Code2}
              label={showCode ? "Show diagram" : "Show code"}
              onClick={() => setShowCode(!showCode)}
            />
            <ToolbarButton
              icon={copied ? Check : Copy}
              label="Copy Mermaid code"
              onClick={handleCopy}
              variant={copied ? "primary" : undefined}
            />
            <ToolbarButton icon={ImageDown} label="Download PNG" onClick={handleDownloadPNG} />
            <ToolbarButton icon={Download} label="Download SVG" onClick={handleDownload} />
            <ToolbarButton
              icon={Maximize2}
              label="Open fullscreen"
              onClick={() => setExpanded(true)}
            />
          </div>
        </div>

        {/* Mode indicator bar */}
        {!showCode && (
          <div
            className={`flex items-center gap-3 px-4 py-1.5 border-b text-[10px] transition-colors ${
              mode === "edit" ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"
            }`}
          >
            {mode === "pan" ? (
              <>
                <span className="flex items-center gap-1">
                  <Move className="h-3 w-3" /> Drag to pan
                </span>
                <span>Scroll to zoom</span>
                <span className="ml-auto opacity-60">Switch to ✏️ Edit mode to rename nodes</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <MousePointer className="h-3 w-3" /> Click any text to edit
                </span>
                <span>Press Enter to save, Escape to cancel</span>
                <span className="ml-auto opacity-60">Switch to ✋ Pan mode to move around</span>
              </>
            )}
          </div>
        )}

        {/* Inline Content (collapsed view) */}
        {showCode ? (
          <div className="p-4">
            <pre className="text-[11px] font-mono bg-secondary/50 rounded-lg p-4 overflow-x-auto text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {code}
            </pre>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-background/50 min-h-[420px] max-h-[720px]"
            style={{ cursor: cursorStyle }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="w-full h-full flex items-center justify-center p-4 transition-transform duration-75"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
              onClick={handleDiagramClick}
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            {/* Inline text editor overlay */}
            {editingNode && (
              <div
                className="absolute z-50 flex items-center gap-1"
                style={{
                  left: editPos.x,
                  top: editPos.y,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingNode(null);
                  }}
                  className="px-3 py-1.5 text-xs rounded-l-md border-2 border-primary bg-card text-foreground shadow-xl min-w-[140px] text-center focus:outline-none"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitEdit();
                  }}
                  className="h-[30px] px-2 rounded-r-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Zoom badge bottom-right */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-card/80 backdrop-blur-sm border rounded-md px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {Math.round(scale * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">{title || "Diagram"}</DialogTitle>
          {/* Fullscreen header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-secondary/30 shrink-0">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {typeLabel}
            </span>
            {title && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm font-display font-semibold text-foreground truncate flex-1">
                  {title}
                </span>
              </>
            )}
            <div className="flex items-center gap-px ml-auto">
              <div className="flex items-center bg-secondary/60 rounded-md p-0.5 mr-1">
                <ToolbarButton
                  icon={Move}
                  label="Pan mode"
                  onClick={() => setMode("pan")}
                  active={mode === "pan"}
                />
                <ToolbarButton
                  icon={Pencil}
                  label="Edit mode"
                  onClick={() => setMode("edit")}
                  active={mode === "edit"}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-8 text-center">
                {Math.round(scale * 100)}%
              </span>
              <ToolbarButton
                icon={ZoomIn}
                label="Zoom in"
                onClick={() => setScale((s) => Math.min(3, s + 0.2))}
              />
              <ToolbarButton
                icon={ZoomOut}
                label="Zoom out"
                onClick={() => setScale((s) => Math.max(0.3, s - 0.2))}
              />
              <ToolbarButton icon={RotateCcw} label="Reset view" onClick={resetView} />
              <div className="w-px h-4 bg-border mx-1" />
              <ToolbarButton
                icon={showCode ? Eye : Code2}
                label={showCode ? "Show diagram" : "Show code"}
                onClick={() => setShowCode(!showCode)}
              />
              <ToolbarButton
                icon={copied ? Check : Copy}
                label="Copy code"
                onClick={handleCopy}
                variant={copied ? "primary" : undefined}
              />
              <ToolbarButton icon={ImageDown} label="Download PNG" onClick={handleDownloadPNG} />
              <ToolbarButton icon={Download} label="Download SVG" onClick={handleDownload} />
              <ToolbarButton
                icon={Minimize2}
                label="Close fullscreen"
                onClick={() => setExpanded(false)}
              />
            </div>
          </div>

          {/* Fullscreen mode bar */}
          {!showCode && (
            <div
              className={`flex items-center gap-3 px-4 py-1.5 border-b text-[10px] transition-colors shrink-0 ${
                mode === "edit" ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"
              }`}
            >
              {mode === "pan" ? (
                <>
                  <span className="flex items-center gap-1">
                    <Move className="h-3 w-3" /> Drag to pan
                  </span>
                  <span>Scroll to zoom</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <MousePointer className="h-3 w-3" /> Click any text to edit
                  </span>
                  <span>Press Enter to save, Escape to cancel</span>
                </>
              )}
            </div>
          )}

          {/* Fullscreen content */}
          {showCode ? (
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-[11px] font-mono bg-secondary/50 rounded-lg p-4 overflow-x-auto text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {code}
              </pre>
            </div>
          ) : (
            <div
              className="relative overflow-hidden bg-background/50 flex-1"
              style={{ cursor: cursorStyle }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                className="w-full h-full flex items-center justify-center p-8 transition-transform duration-75"
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                }}
                onClick={handleDiagramClick}
                dangerouslySetInnerHTML={{ __html: svg }}
              />

              {editingNode && (
                <div
                  className="absolute z-50 flex items-center gap-1"
                  style={{ left: editPos.x, top: editPos.y, transform: "translate(-50%, -50%)" }}
                >
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingNode(null);
                    }}
                    className="px-3 py-1.5 text-xs rounded-l-md border-2 border-primary bg-card text-foreground shadow-xl min-w-[140px] text-center focus:outline-none"
                  />
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitEdit();
                    }}
                    className="h-[30px] px-2 rounded-r-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              )}

              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/80 backdrop-blur-sm border rounded-md px-2 py-1 text-[10px] font-mono text-muted-foreground">
                {Math.round(scale * 100)}%
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

/** Extracts mermaid diagram blocks from artifact content.
 *  Handles three cases:
 *   1. Structured `mermaid_diagrams` / `diagrams` / `generated_diagrams` arrays.
 *   2. Fenced ```mermaid blocks embedded inside any string field (agents
 *      occasionally drop diagrams into free-form fields like `system_context`,
 *      `summary`, or nested rationale strings).
 *   3. A bare string field that itself starts with `flowchart`, `graph`,
 *      `sequenceDiagram`, `erDiagram`, `classDiagram`, etc. — treated as raw mermaid.
 */
export function extractMermaidDiagrams(
  content: any,
): { code: string; title?: string; type?: string }[] {
  if (!content || typeof content !== "object") return [];

  const diagrams: { code: string; title?: string; type?: string }[] = [];
  const seen = new Set<string>();
  const push = (d: { code: string; title?: string; type?: string }) => {
    const key = d.code.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    diagrams.push({ ...d, code: key });
  };

  const mermaidDiagrams =
    content.mermaid_diagrams || content.diagrams || content.generated_diagrams;
  if (Array.isArray(mermaidDiagrams)) {
    for (const d of mermaidDiagrams) {
      if (d?.code || d?.mermaid_code || d?.mermaid) {
        push({
          code: d.code || d.mermaid_code || d.mermaid,
          title: d.title || d.name,
          type: d.type || d.diagram_type,
        });
      }
    }
  }

  // Recursively scan strings for embedded ```mermaid fences or bare mermaid syntax.
  const FENCE_RE = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi;
  const BARE_HEAD_RE =
    /^(?:flowchart|graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram(?:-v2)?|journey|gantt|pie|mindmap|timeline)\b/i;

  const visit = (node: any, path: string) => {
    if (node == null) return;
    if (typeof node === "string") {
      let m: RegExpExecArray | null;
      while ((m = FENCE_RE.exec(node)) !== null) {
        push({ code: m[1], title: path || "Diagram" });
      }
      const trimmed = node.trim();
      if (BARE_HEAD_RE.test(trimmed) && trimmed.length > 30 && trimmed.includes("\n")) {
        push({ code: trimmed, title: path || "Diagram" });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k === "mermaid_diagrams" || k === "diagrams" || k === "generated_diagrams") continue;
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };
  visit(content, "");

  return diagrams;
}
