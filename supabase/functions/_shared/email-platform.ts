// Transactional email + webhook helpers.
// Swap this module to integrate Resend, SendGrid, or another provider.

export {
  sendLovableEmail as sendTransactionalEmail,
  parseEmailWebhookPayload,
  type EmailAPIError,
} from "npm:@lovable.dev/email-js";

export {
  WebhookError,
  verifyWebhookRequest as verifyEmailWebhookRequest,
} from "npm:@lovable.dev/webhooks-js";

export function getEmailApiKey(): string {
  const key = Deno.env.get("EMAIL_API_KEY");
  if (!key) throw new Error("EMAIL_API_KEY not set");
  return key;
}

export function getEmailApiUrl(): string | undefined {
  return Deno.env.get("EMAIL_API_URL") ?? undefined;
}
