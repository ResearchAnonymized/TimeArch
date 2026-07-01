import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Zap, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<
    "loading" | "valid" | "already" | "invalid" | "success" | "error"
  >("loading");
  const [processing, setProcessing] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else if (data.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold">TimeArch</h1>

        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Validating your request…</p>
          </div>
        )}

        {status === "valid" && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to unsubscribe from TimeArch emails?
            </p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="gap-2">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Unsubscribe
            </Button>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-foreground font-medium">You've been unsubscribed.</p>
            <p className="text-sm text-muted-foreground">
              You will no longer receive app emails from TimeArch.
            </p>
          </div>
        )}

        {status === "already" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-foreground font-medium">Already unsubscribed.</p>
            <p className="text-sm text-muted-foreground">
              You've already opted out of these emails.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Invalid or expired link.</p>
            <p className="text-sm text-muted-foreground">
              This unsubscribe link is no longer valid.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-foreground font-medium">Something went wrong.</p>
            <p className="text-sm text-muted-foreground">Please try again later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
