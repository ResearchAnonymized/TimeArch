// Shared LLM API configuration for edge functions.
// Uses an OpenAI-compatible chat completions endpoint.

export function getLlmApiKey(): string {
  const key = Deno.env.get("LLM_API_KEY");
  if (!key) throw new Error("LLM_API_KEY not set");
  return key;
}

export function getLlmApiBaseUrl(): string {
  const base = Deno.env.get("LLM_API_BASE_URL");
  if (!base) throw new Error("LLM_API_BASE_URL not set");
  return base.replace(/\/$/, "");
}

export function getLlmChatCompletionsUrl(): string {
  return `${getLlmApiBaseUrl()}/v1/chat/completions`;
}
