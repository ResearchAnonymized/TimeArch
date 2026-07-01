// LangChain LLM factory + structured-output recovery helpers.
import { ChatOpenAI } from "npm:@langchain/openai@0.5.10";
import { HumanMessage, SystemMessage } from "npm:@langchain/core@0.3.56/messages";

// ─── LangChain Agent Factory ────────────────────────────────────────────────
export function createLangChainLLM(apiKey: string, model: string = "google/gemini-2.5-flash", maxTokens?: number) {
  const config: any = {
    modelName: model,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: "https://ai.gateway.lovable.dev/v1",
    },
    temperature: 0,
    maxRetries: 2,
    timeout: 120000, // 120 second timeout for AI calls
  };
  if (maxTokens) config.maxTokens = maxTokens;
  return new ChatOpenAI(config);
}

export async function invokeLangChainAgent(
  llm: ChatOpenAI,
  systemPrompt: string,
  userPrompt: string,
  toolSchema: { name: string; description: string; parameters: any },
): Promise<any> {
  const llmWithTools = llm.bind({
    tools: [
      {
        type: "function" as const,
        function: {
          name: toolSchema.name,
          description: toolSchema.description,
          parameters: toolSchema.parameters,
        },
      },
    ],
    tool_choice: { type: "function" as const, function: { name: toolSchema.name } },
  });

  const response = await llmWithTools.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const toolCalls = response.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    const args = toolCalls[0].args;
    console.log(`[LangChain] Tool calling succeeded — extracted structured output via ${toolSchema.name}`);
    return { parsed: args, toolCallingUsed: true };
  }

  // Fallback: parse content as JSON with improved recovery
  const content = normalizeLLMContent(response.content);
  console.warn(`[LangChain] Tool calling unavailable — falling back to JSON recovery from ${Array.isArray(response.content) ? "array" : typeof response.content} content`);
  return { parsed: recoverJSON(content, toolSchema.name), toolCallingUsed: false };
}

export function normalizeLLMContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const candidate = part as Record<string, unknown>;
          if (typeof candidate.text === "string") return candidate.text;
          if (typeof candidate.content === "string") return candidate.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (content && typeof content === "object") {
    const candidate = content as Record<string, unknown>;
    if (typeof candidate.text === "string") return candidate.text;
    if (typeof candidate.content === "string") return candidate.content;
    return JSON.stringify(content);
  }

  return "";
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function recoverCodeGenerationOutput(raw: string) {
  const cleaned = raw
    .replace(/^```(?:json|markdown|md|txt)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines.find((line) => /^#{1,6}\s+/.test(line))?.replace(/^#{1,6}\s+/, "").trim()
    || "Code Generation Scaffold";

  const narrativeLines = lines.filter(
    (line) => !/^#{1,6}\s+/.test(line) && !/^[-*+]\s+/.test(line) && !/^```/.test(line),
  );
  const summary = truncateText(
    narrativeLines.slice(0, 3).join(" ")
      || "Recovered code generation scaffold from non-JSON model output. Review the recovered modules and raw scaffold notes before implementation.",
    320,
  );

  const bulletFindings = lines
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s+/, "").replace(/^\*\*(.*?)\*\*:?\s*/, "$1: ").trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);

  const modules: Array<Record<string, unknown>> = [];
  const seenModules = new Set<string>();

  const addModule = (name: string, responsibility?: string) => {
    const normalizedName = name.trim().replace(/[\s:]+$/, "");
    if (!normalizedName || seenModules.has(normalizedName.toLowerCase())) return;
    seenModules.add(normalizedName.toLowerCase());
    modules.push({
      name: normalizedName,
      responsibility: truncateText(
        responsibility?.trim() || "Recovered from unstructured scaffold output; review and refine before implementation.",
        240,
      ),
      recovered_from_text: true,
    });
  };

  for (const line of lines) {
    if (modules.length >= 8) break;

    const headingMatch = line.match(/^#{2,6}\s+(.+)$/);
    if (headingMatch) {
      addModule(headingMatch[1]);
      continue;
    }

    const boldBulletMatch = line.match(/^[-*+]\s+\*\*([^*]+)\*\*:?\s*(.*)$/);
    if (boldBulletMatch) {
      addModule(boldBulletMatch[1], boldBulletMatch[2]);
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+([^:]{2,80}):\s+(.+)$/);
    if (bulletMatch) {
      addModule(bulletMatch[1], bulletMatch[2]);
    }
  }

  if (modules.length === 0) {
    addModule("Recovered Scaffold", "Primary implementation scaffold recovered from plain-text AI output.");
  }

  const keyFindings = bulletFindings.length > 0
    ? bulletFindings
    : [
        `Recovered ${modules.length} scaffold module${modules.length === 1 ? "" : "s"} from non-JSON output.`,
        "Structured tool output was unavailable, so this artifact was salvaged from plain text.",
        "Review module boundaries, interfaces, and placeholders before locking the stage.",
      ];

  return {
    title,
    summary,
    key_findings: keyFindings,
    project_structure: {
      recovered_from_text: true,
      raw_output_preview: cleaned.substring(0, 4000),
    },
    modules,
    api_implementations: [],
    test_files: [],
    traceability: [],
    _recovered_from_text: true,
  };
}

/**
 * Robust JSON recovery from AI output — handles markdown fences, trailing commas, partial JSON
 */
export function recoverJSON(raw: string, schemaName: string): any {
  // Strip markdown code fences (handle multiple fence patterns)
  let cleaned = raw
    .replace(/^```(?:json|JSON|javascript|js|typescript|ts)?\s*\n?/gim, "")
    .replace(/\n?```\s*$/gim, "")
    .trim();
  
  // Try direct parse
  try { return JSON.parse(cleaned); } catch {}
  
  // Try removing leading/trailing non-JSON text (common when model wraps JSON in explanation)
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let candidate = cleaned.substring(firstBrace, lastBrace + 1);
    // Fix trailing commas before closing brackets
    candidate = candidate.replace(/,\s*([\]}])/g, "$1");
    // Fix single-quoted strings to double-quoted
    // Remove control characters that break JSON
    candidate = candidate.replace(/[\x00-\x1F\x7F]/g, (ch) => ch === "\n" || ch === "\r" || ch === "\t" ? ch : "");
    try { return JSON.parse(candidate); } catch {}
    
    // Try progressively trimming from the end to fix truncated JSON
    const step = Math.max(1, Math.floor(candidate.length / 200));
    for (let i = candidate.length; i > candidate.length * 0.4; i -= step) {
      const truncated = candidate.substring(0, i);
      const opens = (truncated.match(/{/g) || []).length;
      const closes = (truncated.match(/}/g) || []).length;
      const openBrackets = (truncated.match(/\[/g) || []).length;
      const closeBrackets = (truncated.match(/\]/g) || []).length;
      if (opens > closes || openBrackets > closeBrackets) {
        // Close any open strings first
        let fixed = truncated;
        // Remove any trailing incomplete string value
        fixed = fixed.replace(/,\s*"[^"]*$/, "");
        fixed = fixed.replace(/:\s*"[^"]*$/, ': ""');
        // Close brackets
        fixed += "]".repeat(Math.max(0, openBrackets - closeBrackets));
        fixed += "}".repeat(Math.max(0, opens - closes));
        fixed = fixed.replace(/,\s*([\]}])/g, "$1");
        try { return JSON.parse(fixed); } catch {}
      }
    }
  }

  if (schemaName === "generate_code") {
    console.warn("[recoverJSON] Falling back to stage 16 text recovery");
    return recoverCodeGenerationOutput(raw);
  }

  // Generic text recovery for any stage — extract what we can rather than failing
  console.warn(`[recoverJSON] Falling back to generic text recovery for ${schemaName}`);
  return recoverGenericOutput(raw, schemaName);
}

/**
 * Generic fallback recovery: extracts structured information from unstructured AI text output
 * so stages don't hard-fail when tool calling and JSON parsing both fail.
 */
export function recoverGenericOutput(raw: string, schemaName: string): any {
  const cleaned = raw
    .replace(/^```(?:json|markdown|md|txt)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const title = lines.find(l => /^#{1,6}\s+/.test(l))?.replace(/^#{1,6}\s+/, "").trim()
    || `Recovered ${schemaName} Output`;

  const narrativeLines = lines.filter(l => !/^#{1,6}\s+/.test(l) && !/^[-*+]\s+/.test(l) && !/^```/.test(l));
  const summary = truncateText(
    narrativeLines.slice(0, 4).join(" ") || "Output recovered from non-structured AI response. Review carefully.",
    400,
  );

  const bulletFindings = lines
    .filter(l => /^[-*+]\s+/.test(l))
    .map(l => l.replace(/^[-*+]\s+/, "").replace(/^\*\*(.*?)\*\*:?\s*/, "$1: ").trim())
    .filter(l => l.length > 0)
    .slice(0, 5);

  const key_findings = bulletFindings.length > 0
    ? bulletFindings
    : ["Output was recovered from unstructured text — structured tool calling was unavailable.",
       "Review the raw content carefully before approving this stage.",
       "Consider retrying this stage for a properly structured output."];

  return {
    title,
    summary,
    key_findings,
    _recovered_from_text: true,
    _raw_output_preview: cleaned.substring(0, 4000),
    _recovery_note: "This output was recovered from unstructured AI text because structured parsing failed. The content may be incomplete. Please retry or review manually.",
  };
}
