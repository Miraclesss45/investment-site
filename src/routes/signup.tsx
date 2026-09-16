import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Bitcoin, LockKeyhole, Mail, MapPin, Phone, User, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/site-chrome";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [
    { title: "Create Account | MeridianVest" },
    { name: "description", content: "Create your MeridianVest member account." },
    { property: "og:title", content: "Create Account | MeridianVest" },
    { property: "og:description", content: "Register for a MeridianVest member account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: SignupPage,
});

const walletFields = [
  { label: "Bitcoin Wallet Address", name: "btc_wallet", icon: Bitcoin },
  { label: "USDT Wallet Address", name: "usdt_wallet", icon: Wallet },
  { label: "Ethereum Wallet Address", name: "eth_wallet", icon: Wallet },
  { label: "Litecoin Wallet Address", name: "ltc_wallet", icon: Wallet },
];

function Field({ label, icon: Icon, ...props }: { label: string; icon: typeof User } & React.ComponentProps<typeof Input>) {
  return <label className="account-field"><span>{label}</span><div><Icon /><Input placeholder={label.replace(" *", "*")} {...props} /></div></label>;
}

function SignupPage() {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const upline = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("ref") ?? "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    if (data.get("password") !== data.get("confirmPassword")) { toast.error("Passwords do not match"); return; }
    if (email !== String(data.get("confirmEmail")).trim()) { toast.error("E-mail addresses do not match"); return; }
    if (!agreed) { toast.error("Please agree to the terms and conditions"); return; }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: String(data.get("password")),
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: String(data.get("fullName")),
            username: String(data.get("username")),
            phone: String(data.get("phone")),
            country: String(data.get("country")),
            btc_wallet: String(data.get("btc_wallet") ?? ""),
            usdt_wallet: String(data.get("usdt_wallet") ?? ""),
            eth_wallet: String(data.get("eth_wallet") ?? ""),
            ltc_wallet: String(data.get("ltc_wallet") ?? ""),
            referred_by: upline,
          },
        },
      });
      if (error) throw error;
      toast.success("Account created", { description: "Welcome to MeridianVest." });
      void navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error("Sign up failed", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error("Google sign up failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <main className="signup-page">
      <div className="signup-login-prompt">Already have an account? <Button asChild variant="outline"><Link to="/login">Sign In</Link></Button></div>
      <div className="signup-shell">
        <div className="account-logo"><Logo /></div>
        <form className="signup-form" onSubmit={submit}>
          <h1>Hello! Let's get started!</h1>
          <p>Enter your details below.</p>
          <div className="signup-grid">
            <Field label="Full Name *" icon={User} name="fullName" required />
            <Field label="Username *" icon={User} name="username" pattern="[A-Za-z0-9_\-]+" required />
            <Field label="Password *" icon={LockKeyhole} name="password" type="password" minLength={8} required />
            <Field label="Retype Password *" icon={LockKeyhole} name="confirmPassword" type="password" minLength={8} required />
            <Field label="E-mail Address *" icon={Mail} name="email" type="email" required />
            <Field label="Retype E-mail *" icon={Mail} name="confirmEmail" type="email" required />
            <Field label="Phone *" icon={Phone} name="phone" type="tel" required />
            <Field label="Country *" icon={MapPin} name="country" required />
            {walletFields.map((field) => <Field key={field.name} label={`${field.label} *`} icon={field.icon} name={field.name} required />)}
          </div>
          <p className="signup-upline">Your Upline: <b>{upline ? `${upline} (referral)` : "N/A (n/a)"}</b></p>
          <label className="terms-check"><Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} />I agree with <a href="#terms">Terms and conditions</a></label>
          <Button type="submit" className="account-submit" disabled={busy}>{busy ? "Creating account…" : "Sign Up"} <UserPlus /></Button>
        </form>
        <Button type="button" variant="outline" className="login-google" onClick={() => void google()}>Continue with Google</Button>
        <footer className="signup-footer">
          <p>Copyright © 2025 meridianvest.com. All rights reserved.</p>
          <nav><Link to="/about">About Us</Link><span>|</span><a href="#terms">Terms &amp; Conditions</a></nav>
          <LanguageSelect className="signup-language" />
        </footer>
      </div>
    </main>
  );
}
