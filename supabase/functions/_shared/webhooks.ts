// Outbound webhook dispatcher. Signs payloads with HMAC-SHA256 and logs every
// delivery (success or failure) to webhook_deliveries.
import { serviceClient } from "./api-auth.ts";

export type WebhookEvent =
  | "reverse_engineer.completed"
  | "drift.detected"
  | "disposition.completed"
  | "stage.locked"
  | "artifact.created"
  | "custom";

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface DispatchInput {
  projectId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
}

export async function dispatchWebhooks({ projectId, event, payload }: DispatchInput) {
  const sb = serviceClient();
  const { data: endpoints } = await sb
    .from("webhook_endpoints")
    .select("id, url, secret, events, active")
    .eq("project_id", projectId)
    .eq("active", true);

  if (!endpoints?.length) return { delivered: 0 };

  const sentAt = new Date().toISOString();
  const timestamp = Math.floor(Date.now() / 1000).toString(); // seconds since epoch
  const body = JSON.stringify({
    event,
    project_id: projectId,
    sent_at: sentAt,
    data: payload,
  });

  let delivered = 0;
  await Promise.all(endpoints.map(async (e: any) => {
    if (!(e.events?.includes("*") || e.events?.includes(event))) return;
    // Signature covers `timestamp.body` to prevent replay attacks. Receivers
    // should reject deliveries where timestamp is older than ~5 minutes.
    const signature = await hmacSha256Hex(e.secret, `${timestamp}.${body}`);
    let status: number | null = null;
    let excerpt: string | null = null;
    let error: string | null = null;
    try {
      const res = await fetch(e.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TimeArch-Event": event,
          "X-TimeArch-Timestamp": timestamp,
          "X-TimeArch-Signature": `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = res.status;
      excerpt = (await res.text()).slice(0, 500);
      if (res.ok) delivered++;
    } catch (e) {
      error = (e as Error).message;
    }
    await sb.from("webhook_deliveries").insert({
      endpoint_id: e.id,
      event,
      payload: JSON.parse(body),
      status_code: status,
      response_excerpt: excerpt,
      error,
    });
  }));

  return { delivered };
}
