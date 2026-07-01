import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_NAME = "TimeArch";
const SENDER_DOMAIN = "notify.sda-assistant.com";
const FROM_DOMAIN = "notify.sda-assistant.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate caller and require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, action } = await req.json();
    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, user_id")
      .eq("user_id", user_id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user_id);
    if (!authUser?.email) {
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id,
      entity_type: "user_approval",
      action,
      details: {
        email: authUser.email,
        display_name: profile.display_name,
        timestamp: new Date().toISOString(),
      },
    });

    // Render email template
    const templateModule = action === "approved"
      ? await import("../_shared/transactional-email-templates/account-approved.tsx")
      : await import("../_shared/transactional-email-templates/account-rejected.tsx");

    const templateData = { name: profile.display_name || undefined };
    const html = await renderAsync(React.createElement(templateModule.template.component, templateData));
    const plainText = await renderAsync(
      React.createElement(templateModule.template.component, templateData),
      { plainText: true }
    );
    const resolvedSubject = typeof templateModule.template.subject === "function"
      ? templateModule.template.subject(templateData)
      : templateModule.template.subject;

    // Get or create unsubscribe token
    const normalizedEmail = authUser.email.toLowerCase();
    let unsubscribeToken: string;

    const { data: existingToken } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token;
    } else if (!existingToken) {
      unsubscribeToken = generateToken();
      await supabase.from("email_unsubscribe_tokens")
        .upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: "email", ignoreDuplicates: true });
      const { data: stored } = await supabase
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (stored) unsubscribeToken = stored.token;
    } else {
      console.log("User unsubscribed, skipping email", { email: normalizedEmail });
      return new Response(
        JSON.stringify({ success: true, message: "User unsubscribed, email skipped" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = crypto.randomUUID();
    const idempotencyKey = `${action}-${user_id}-${Date.now()}`;

    // Log pending
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: `account-${action}`,
      recipient_email: authUser.email,
      status: "pending",
    });

    // Enqueue email
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: authUser.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: resolvedSubject,
        html,
        text: plainText,
        purpose: "transactional",
        label: `account-${action}`,
        idempotency_key: idempotencyKey,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue email:", enqueueError);
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: `account-${action}`,
        recipient_email: authUser.email,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
    } else {
      console.log("Approval email enqueued", { email: authUser.email, action });
    }

    return new Response(
      JSON.stringify({ success: true, message: `User ${action} notification sent`, email: authUser.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-approval error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
