import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, approvalStatus } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [joinReason, setJoinReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (approvalStatus && approvalStatus !== "approved") {
        navigate("/pending-approval");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, loading, approvalStatus, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("login");
      } else if (mode === "signup") {
        if (!joinReason.trim()) {
          toast.error("Please tell us why you want to join TimeArch.");
          setSubmitting(false);
          return;
        }
        if (!consentAccepted) {
          toast.error("You must accept the terms and conditions to create an account.");
          setSubmitting(false);
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, join_reason: joinReason },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          if (error.message?.toLowerCase().includes("already registered")) {
            toast.error(
              "An account with this email already exists. Please sign in or use 'Forgot password' to reset your credentials.",
            );
            setMode("login");
            setSubmitting(false);
            return;
          }
          throw error;
        }
        // If user identity already exists (fake signup), guide to login
        if (signUpData?.user?.identities?.length === 0) {
          toast.error(
            "An account with this email already exists. Please sign in or use 'Forgot password' to reset your credentials.",
          );
          setMode("login");
          setSubmitting(false);
          return;
        }
        // Sign out immediately so user can't access protected routes before approval
        await supabase.auth.signOut();
        toast.success(
          "Account created! Please check your email to verify your address. An admin will review your account.",
        );
        setMode("login");
        setEmail("");
        setPassword("");
        setFullName("");
        setJoinReason("");
        setConsentAccepted(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch {
      toast.error("Google sign-in failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-nav text-nav-foreground p-12">
        <div className="space-y-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-nav-foreground/60 hover:text-nav-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </button>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">TimeArch</span>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-display font-bold mb-4">Architecture-first engineering.</h2>
          <p className="text-nav-foreground/70 text-lg max-w-md">
            Transform requirements into professional, standards-aligned architecture artifacts with
            multi-agent governance and controlled code generation.
          </p>
        </div>
        <p className="text-xs text-nav-foreground/40">
          © {new Date().getFullYear()} TimeArch. All rights reserved.
        </p>
      </div>

      {/* Right auth form */}
      <div className="flex-1 flex flex-col p-8">
        {/* Back button - always visible at top of right panel */}
        <div className="mb-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="lg:hidden space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-display text-xl font-bold">TimeArch</span>
              </div>
            </div>

            <h1 className="text-2xl font-display font-bold mb-2">
              {mode === "login"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : "Reset password"}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {mode === "login"
                ? "Sign in to continue to your workspace"
                : mode === "signup"
                  ? "Get started with TimeArch"
                  : "Enter your email to receive a reset link"}
            </p>

            {mode !== "forgot" && (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-3 h-11 mb-4"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </Button>

                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-4">
                  <strong>Work/university email?</strong> Your organization may block Google
                  sign-in. If it fails, use email &amp; password below instead.
                </p>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="fullName" className="text-xs font-medium">
                    Full Name
                  </Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <Label htmlFor="joinReason" className="text-xs font-medium">
                    Why do you want to join TimeArch?
                  </Label>
                  <textarea
                    id="joinReason"
                    value={joinReason}
                    onChange={(e) => setJoinReason(e.target.value)}
                    placeholder="Tell us about your role, what you plan to use TimeArch for, and why you're interested..."
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-none"
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-xs font-medium">
                  Email
                </Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div>
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-1.5">
                      <p className="font-semibold text-foreground">
                        Terms & Conditions — Please Read
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>
                          <strong>Experimental Software:</strong> TimeArch is currently in an
                          experimental (Beta) stage. Features may change, break, or be removed
                          without notice.
                        </li>
                        <li>
                          <strong>Non-Commercial Use Only:</strong> This platform is provided
                          strictly for evaluation, research, and educational purposes. Commercial
                          use is not permitted.
                        </li>
                        <li>
                          <strong>Data Usage:</strong> Your submitted data (requirements,
                          architecture artifacts, feedback) may be used to improve the platform's AI
                          models and services. No personally identifiable information will be shared
                          with third parties.
                        </li>
                        <li>
                          <strong>AI-Generated Content:</strong> Architecture recommendations and
                          artifacts are AI-generated and should be reviewed by qualified
                          professionals before use in production systems.
                        </li>
                        <li>
                          <strong>No Warranty:</strong> The platform is provided "as is" without
                          warranties of any kind. We are not liable for any decisions made based on
                          the platform's output.
                        </li>
                        <li>
                          <strong>Account Approval:</strong> All accounts require administrator
                          approval. Access may be revoked at any time.
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="consent"
                      checked={consentAccepted}
                      onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                    />
                    <label
                      htmlFor="consent"
                      className="text-xs font-medium cursor-pointer select-none"
                    >
                      I have read and agree to the above terms and conditions
                    </label>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              )}

              <Button type="submit" className="w-full gap-2 h-11" disabled={submitting}>
                {submitting ? (
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                ) : (
                  <>
                    {mode === "login"
                      ? "Sign In"
                      : mode === "signup"
                        ? "Create Account"
                        : "Send Reset Link"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-sm text-center mt-6 text-muted-foreground">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
