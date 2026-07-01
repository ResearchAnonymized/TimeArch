import { ArrowLeft, Clock, LogOut, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";

export default function PendingApproval() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold">TimeArch</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center space-y-6"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-500" />
          </div>

          <div>
            <h1 className="text-2xl font-display font-bold mb-2">Account Pending Approval</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your email has been verified successfully. Your account is now awaiting administrator
              approval. You'll receive an email once your account is approved.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Signed in as</span>
              <span className="font-medium truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Pending admin review
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            If you believe this is an error, please contact the system administrator.
          </p>

          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out & Try Another Account
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
