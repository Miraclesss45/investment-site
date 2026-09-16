import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import loginIcon from "@/assets/uploads/login-icon.jpg.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Member Login | Legacy Pro Alliance" },
    { name: "description", content: "Sign in to your Legacy Pro Alliance member account." },
    { property: "og:title", content: "Member Login | Legacy Pro Alliance" },
    { property: "og:description", content: "Access your Legacy Pro Alliance member account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false); const [message, setMessage] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage("Sign in requires the original account service."); };
  return <main className="login-page"><div className="login-top"><Link to="/" aria-label="Back to home"><ArrowLeft /></Link><span>Hi! Welcome Back!</span></div><div className="login-panel"><img className="login-icon" src={loginIcon.url} alt="Secure member login" /><h1>Sign In</h1><p>Enter your details to access your account</p><form onSubmit={submit}><label><span>Username:</span><div className="login-input"><Mail /><Input name="username" placeholder="Your Username" required /></div></label><label><span>Password:</span><div className="login-input"><LockKeyhole /><Input name="password" type={showPassword ? "text" : "password"} placeholder="Your Password" required /><Button type="button" size="icon" variant="ghost" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label><Button type="submit" className="login-submit">Sign In</Button>{message && <p className="account-message" role="status">{message}</p>}</form><div className="login-links"><p>Not a member yet? <Link to="/signup">Sign Up</Link></p><p>Forgot Password? <a href="#forgot">Reset</a></p></div></div><footer>Copyright © 2026, legacyproalliance.org. All Rights Reserved.</footer></main>;
}