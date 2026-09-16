import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Bitcoin, LockKeyhole, Mail, Phone, User, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/site-chrome";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [
    { title: "Create Account | Legacy Pro Alliance" },
    { name: "description", content: "Create your Legacy Pro Alliance member account." },
    { property: "og:title", content: "Create Account | Legacy Pro Alliance" },
    { property: "og:description", content: "Register for a Legacy Pro Alliance member account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: SignupPage,
});

const walletFields = ["Bitcoin Wallet Address", "USDT Wallet Address", "Ethereum Wallet Address", "Litecoin Wallet Address"];

function Field({ label, icon: Icon, ...props }: { label: string; icon: typeof User } & React.ComponentProps<typeof Input>) {
  return <label className="account-field"><span>{label}</span><div><Icon /><Input {...props} /></div></label>;
}

function SignupPage() {
  const [agreed, setAgreed] = useState(false); const [message, setMessage] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (data.get("password") !== data.get("confirmPassword")) return setMessage("Passwords do not match."); if (data.get("email") !== data.get("confirmEmail")) return setMessage("Email addresses do not match."); if (!agreed) return setMessage("Please agree to the terms and conditions."); setMessage("Registration is ready. Account creation requires the original account service."); };
  return <main className="signup-page"><div className="signup-shell"><div className="account-logo"><Logo /></div><form className="signup-form" onSubmit={submit}><h1>Hello! Let's Get Started</h1><p>Create your account to begin investing.</p><div className="signup-grid">
    <Field label="Full Name *" icon={User} name="fullName" required /><Field label="Username *" icon={User} name="username" pattern="[A-Za-z0-9_-]+" required />
    <Field label="Password *" icon={LockKeyhole} name="password" type="password" required /><Field label="Retype Password *" icon={LockKeyhole} name="confirmPassword" type="password" required />
    <Field label="E-mail Address *" icon={Mail} name="email" type="email" required /><Field label="Retype E-mail *" icon={Mail} name="confirmEmail" type="email" required />
    <Field label="Phone *" icon={Phone} name="phone" type="tel" required /><Field label="Country *" icon={User} name="country" required />
    {walletFields.map((label) => <Field key={label} label={`${label} *`} icon={label.startsWith("Bitcoin") ? Bitcoin : Wallet} name={label} required />)}
    </div><label className="terms-check"><Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} />I agree with <a href="#terms">Terms and conditions</a></label><Button type="submit" className="account-submit"><User /> Sign Up</Button>{message && <p className="account-message" role="status">{message}</p>}<p className="account-switch">Already have an account? <Link to="/login">Log In</Link></p></form></div></main>;
}