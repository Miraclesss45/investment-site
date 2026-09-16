import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, LogIn, Mail } from "lucide-react";

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
  const navigate = useNavigate();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage("Opening your member area…"); navigate({ to: "/dashboard" }); };
  return <main className="login-page"><div className="login-top"><Link to="/" aria-label="Back to home"><ArrowLeft /></Link><span>Hi! Welcome Back!</span></div><div className="login-panel"><img className="login-icon" src={loginIcon.url} alt="Secure member login" /><form onSubmit={submit}><label><span>Username:</span><div className="login-input"><Mail /><Input name="username" placeholder="Your Username" required /></div></label><label><span>Password:</span><div className="login-input"><LockKeyhole /><Input name="password" type={showPassword ? "text" : "password"} placeholder="Your Password" required /><Button type="button" size="icon" variant="ghost" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label><Button type="submit" className="login-submit"><LogIn />Sign in</Button>{message && <p className="account-message" role="status">{message}</p>}</form><div className="login-links"><p>Not a member yet? <Link to="/signup">Sign Up</Link></p><p>Forgot Password?<a href="#forgot">Reset</a></p></div></div><footer>copyright © 2025, <span>legacyproalliance.org</span> All Rights Reserved</footer></main>;
}