import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";
import { getAuthErrorMessage } from "../../lib/authHelpers";

function maskEmail(email) {
  if (!email || !email.includes("@")) return "your email address";
  const [name, domain] = email.split("@");
  const visibleName = name.length > 2 ? `${name.slice(0, 2)}•••` : `${name[0]}•••`;
  return `${visibleName}@${domain}`;
}

export default function VerifyEmailPage() {
  const location = useLocation();
  const normalizeEmail = (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const stateEmail = normalizeEmail(location.state?.email);
  const queryEmail = normalizeEmail(new URLSearchParams(location.search).get("email"));
  const currentUserEmail = normalizeEmail(firebaseAuth?.currentUser?.email);
  const email = stateEmail || queryEmail || currentUserEmail || "";
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function resendVerification() {
    if (!firebaseAuth?.currentUser) {
      setFeedback("Sign in from the member login page to request a new verification email.");
      return;
    }
    setResending(true);
    setFeedback("");
    try {
      await sendEmailVerification(firebaseAuth.currentUser);
      setFeedback("A new verification email has been sent.");
    } catch (error) {
      setFeedback(getAuthErrorMessage(error, "We could not resend the verification email."));
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-8 text-slate-700 sm:px-6">
      <div className="pointer-events-none absolute left-[-12rem] top-[-16rem] h-[36rem] w-[36rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-18rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-50 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em] text-slate-900"
        >
          <img className="h-10 w-10 rounded-lg object-cover" src="/meridianvest-logo.svg" alt="MeridianVests logo" width="40" height="40" />
          Meridian<span className="text-blue-700">Vests</span>
        </Link>
        <Link
          to="/login"
          className="text-xs font-extrabold uppercase tracking-[0.12em] text-blue-700 transition hover:text-blue-700 sm:text-sm"
        >
          Member login <ArrowRight className="ml-1 inline-block" size={15} />
        </Link>
      </div>

      <section className="relative mx-auto mt-16 w-full max-w-[720px] transition duration-700 sm:mt-24">
        <div className="rounded-[2rem] border border-blue-100 bg-white/90 p-6 shadow-[0_30px_90px_rgba(30,64,175,0.12)] backdrop-blur-2xl sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-200 bg-cyan-50 text-blue-700 shadow-[0_0_40px_rgba(34,211,238,0.12)]">
            <Mail size={36} strokeWidth={1.6} />
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-700">
              One last step
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-900 sm:text-5xl">
              Verify your email to continue.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
              MeridianVests sent a verification link to{" "}
              <strong className="font-semibold text-slate-700">{maskEmail(email)}</strong>.
              Open the message and confirm your email address to activate your member access.
            </p>
          </div>

          <a
            href="https://mail.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto mt-8 flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,211,238,0.22)]"
          >
            Open Gmail <ExternalLink size={16} />
          </a>

          <div className="mt-10 grid gap-3 border-t border-slate-200 pt-8 sm:grid-cols-3">
            {[
              ["01", "Check your inbox", "Find the verification email from MeridianVests."],
              ["02", "Verify your address", "Use the link in the email to confirm it is yours."],
              ["03", "Sign in", "Return to MeridianVests and open your member account."],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-2xl border border-blue-100 bg-slate-50/70 p-4">
                <span className="text-xs font-extrabold tracking-[0.16em] text-blue-700">{number}</span>
                <h2 className="mt-3 text-sm font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
            <ShieldCheck className="mt-0.5 shrink-0 text-amber-800" size={18} />
            <p className="text-xs leading-5 text-slate-700">
              Can&apos;t find it? Check your <strong className="text-amber-900">Spam</strong> or{" "}
              <strong className="text-amber-900">Promotions</strong> folder, then search for
              &quot;MeridianVests&quot;.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 text-sm sm:flex-row">
            <button type="button" onClick={resendVerification} disabled={resending} className="inline-flex items-center gap-2 font-bold text-blue-700 disabled:opacity-60">
              {resending && <LoaderCircle className="animate-spin" size={16} />}
              Resend verification
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-bold text-blue-700 transition hover:text-blue-700"
            >
              Go to sign in <ArrowRight size={16} />
            </Link>
            <span className="hidden text-slate-600 sm:inline">•</span>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-slate-600 transition hover:text-slate-900"
            >
              Use a different email <Check size={16} />
            </Link>
          </div>
          {feedback && <p role="status" className="mt-5 text-center text-xs text-blue-700">{feedback}</p>}
          {firebaseAuth?.currentUser && (
            <button type="button" onClick={() => signOut(firebaseAuth)} className="mx-auto mt-4 block text-xs text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Need help?{" "}
          <a href="mailto:meridianvest948@gmail.com" className="text-blue-700 hover:text-blue-700">
            Contact support
          </a>
          {" or "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-800 hover:text-green-800">
            <WhatsAppIcon size={13} /> WhatsApp
          </a>
        </p>
      </section>
    </main>
  );
}
