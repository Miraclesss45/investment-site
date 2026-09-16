import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import loginIcon from "@/assets/uploads/login-icon.jpg.asset.json";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Member Login | MeridianVest" },
    { name: "description", content: "Sign in to your MeridianVest member account." },
    { property: "og:title", content: "Member Login | MeridianVest" },
    { property: "og:description", content: "Access your MeridianVest member account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
      });
      if (error) throw error;
      toast.success("Welcome back", { description: "Opening your member area…" });
      void navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error("Sign in failed", { description: error instanceof Error ? error.message : "Check your e-mail and password." });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error("Google sign in failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const reset = async () => {
    const email = window.prompt("Enter the e-mail address on your account");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error("Reset failed", { description: error.message });
    else toast.success("Reset link sent", { description: "Check your inbox for the password reset e-mail." });
  };

  return (
    <main className="login-page">
      <div className="login-top"><Link to="/" aria-label="Back to home"><ArrowLeft /></Link><span>Hi! Welcome Back!</span></div>
      <div className="login-panel">
        <img className="login-icon" src={loginIcon.url} alt="Secure member login" />
        <form onSubmit={submit}>
          <label><span>E-mail Address:</span><div className="login-input"><Mail /><Input name="email" type="email" autoComplete="email" placeholder="Your E-mail Address" required /></div></label>
          <label><span>Password:</span><div className="login-input"><LockKeyhole /><Input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Your Password" required /><Button type="button" size="icon" variant="ghost" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label>
          <Button type="submit" className="login-submit" disabled={busy}><LogIn />{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <Button type="button" variant="outline" className="login-google" onClick={() => void google()}>Continue with Google</Button>
        <div className="login-links">
          <p>Not a member yet? <Link to="/signup">Sign Up</Link></p>
          <p>Forgot Password? <button type="button" className="login-reset" onClick={() => void reset()}>Reset</button></p>
        </div>
      </div>
      <footer>copyright © 2025, <span>meridianvest.com</span> All Rights Reserved</footer>
    </main>
  );
}
