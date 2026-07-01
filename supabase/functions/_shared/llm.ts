// Unified OpenAI-compatible LLM wrapper.
// Handles auth, JSON-mode requests, retry on 429/5xx, and JSON recovery for
// models that occasionally wrap responses in prose or code fences.
//
// ECSA 2026 Artifact Evaluation note:
// This module supports an LLM_MODE env switch with three values:
//   - "live"   (default): call the configured LLM API as usual.
//   - "replay": serve responses from a static cassette file
//               (cassettes/llm-cassette.json). No network call.
//               Lookup key = sha256(model + JSON(messages) + json-flag).
//               This is what the AE reviewer runs by default — no API key needed.
//   - "record": call live AND append the (key, response) to the cassette so
//               the project maintainer can refresh the bundle.
//
// In "replay" mode a missing key throws a clear error so reviewers know
// which prompt is uncovered.

import { getLlmApiKey, getLlmChatCompletionsUrl } from "./llm-config.ts";

const LLM_MODE = (Deno.env.get("LLM_MODE") ?? "live").toLowerCase();
const CASSETTE_PATH =
  Deno.env.get("LLM_CASSETTE_PATH") ?? "/tmp/llm-cassette.json";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxRetries?: number;
  /** Force JSON object response (where the model supports it). */
  json?: boolean;
}

export interface LlmResponse {
  content: string;
  raw: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Cassette helpers (used in replay/record modes) ────────────────────────
type Cassette = Record<string, { content: string; raw?: unknown }>;
let cassetteCache: Cassette | null = null;

async function loadCassette(): Promise<Cassette> {
  if (cassetteCache) return cassetteCache;
  try {
    const text = await Deno.readTextFile(CASSETTE_PATH);
    cassetteCache = JSON.parse(text) as Cassette;
  } catch {
    cassetteCache = {};
  }
  return cassetteCache!;
}

async function saveCassette(c: Cassette) {
  try {
    await Deno.writeTextFile(CASSETTE_PATH, JSON.stringify(c, null, 2));
  } catch (e) {
    console.warn(`[llm] cassette write failed: ${(e as Error).message}`);
  }
}

async function hashKey(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function callLlm(messages: LlmMessage[], opts: LlmOptions = {}): Promise<LlmResponse> {
  const {
    model = "google/gemini-2.5-flash",
    temperature = 0.2,
    maxRetries = 2,
    json = false,
  } = opts;

  // Compute deterministic cassette key (ignores temperature/maxRetries so the
  // same logical prompt resolves regardless of small caller-side tuning).
  const key = await hashKey(JSON.stringify({ model, json, messages }));

  // ─── replay mode: never hit the network ────────────────────────────────
  if (LLM_MODE === "replay") {
    const cassette = await loadCassette();
    const hit = cassette[key];
    if (!hit) {
      throw new Error(
        `[llm] replay miss for key ${key.slice(0, 12)}… (model=${model}). ` +
          `Re-record the cassette with LLM_MODE=record, or run with LLM_MODE=live.`,
      );
    }
    return { content: hit.content, raw: hit.raw ?? { replay: true } };
  }

  const apiKey = getLlmApiKey();

  const body: Record<string, unknown> = { model, messages, temperature };
  if (json) body.response_format = { type: "json_object" };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(getLlmChatCompletionsUrl(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`LLM ${res.status}: ${await res.text()}`);
        await sleep(400 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "";

      // ─── record mode: append to cassette for reviewer reproducibility ──
      if (LLM_MODE === "record") {
        const cassette = await loadCassette();
        cassette[key] = { content, raw: data };
        cassetteCache = cassette;
        await saveCassette(cassette);
      }

      return { content, raw: data };
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) await sleep(400 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM call failed");
}

/**
 * Recover a JSON object/array from a possibly noisy LLM string
 * (handles ```json fences, leading prose, trailing commas).
 */
export function recoverJSON<T = unknown>(input: string): T | null {
  if (!input) return null;
  const cleaned = input
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through */
  }
  const firstBrace = cleaned.search(/[\[{]/);
  const lastBrace = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  const slice = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([\]}])/g, "$1")) as T;
    } catch {
      return null;
    }
  }
}
