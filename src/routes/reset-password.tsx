import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Reset Password | MeridianVest" },
    { name: "description", content: "Choose a new password for your MeridianVest member account." },
    { property: "og:title", content: "Reset Password | MeridianVest" },
    { property: "og:description", content: "Choose a new password for your member account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", { description: "You can now sign in with your new password." });
      void navigate({ to: "/login" });
    } catch (error) {
      toast.error("Reset failed", { description: error instanceof Error ? error.message : "Request a new reset link." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-top"><Link to="/login" aria-label="Back to login"><ArrowLeft /></Link><span>Set A New Password</span><ThemeToggle className="auth-theme-toggle" /></div>
      <div className="login-panel">
        <form onSubmit={submit}>
          <label><span>New Password:</span><div className="login-input"><LockKeyhole /><Input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="New password" required /></div></label>
          <label><span>Retype Password:</span><div className="login-input"><LockKeyhole /><Input name="confirm" type="password" minLength={8} autoComplete="new-password" placeholder="Retype new password" required /></div></label>
          <Button type="submit" className="login-submit" disabled={busy}>{busy ? "Saving…" : "Save Password"}</Button>
        </form>
      </div>
      <footer>copyright © 2025, <span>meridianvest.com</span> All Rights Reserved</footer>
    </main>
  );
}
