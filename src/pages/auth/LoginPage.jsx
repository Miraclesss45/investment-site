import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import {
  firebaseAuth,
  firestoreDb,
  getFirebaseStatus,
} from "../../lib/firebase";
import {
  getIdTokenResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getAuthErrorMessage, resolveLoginEmail } from "../../lib/authHelpers";

function getSafeReturnPath(location) {
  const from = location.state?.from;
  return typeof from === "string" && from.startsWith("/")
    ? from
    : location.pathname.startsWith("/admin")
      ? "/admin"
      : "/dashboard";
}

async function resolveUserRole(user) {
  if (!user) return "member";

  try {
    const tokenResult = await getIdTokenResult(user, true);
    const claimRole = String(tokenResult?.claims?.role ?? "").trim().toLowerCase();
    if (claimRole === "admin" || tokenResult?.claims?.admin === true) {
      return "admin";
    }
  } catch {
    // Fall through to Firestore role checks when claims are not available yet.
  }

  if (!firestoreDb) return "member";

  try {
    const userDoc = await getDoc(doc(firestoreDb, "users", user.uid));
    if (userDoc.exists()) {
      const storedRole = String(userDoc.data().role ?? "member").trim().toLowerCase();
      return storedRole === "admin" ? "admin" : "member";
    }
  } catch {
    // Stay conservative and treat unclear role data as member access.
  }

  return "member";
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const adminLogin = location.pathname.startsWith("/admin");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function setFeedback(nextMessage, type = "status") {
    setMessage(nextMessage);
    setMessageType(type);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      if (!firebaseAuth) throw new Error(getFirebaseStatus());

      const email = await resolveLoginEmail(formData.get("identifier") || "");
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        formData.get("password"),
      );

      if (!credential.user.emailVerified) {
        await signOut(firebaseAuth);
        setFeedback(
          "Please verify your email before signing in. Check your inbox and spam folder.",
          "error",
        );
        return;
      }

      const userRole = await resolveUserRole(credential.user);
      const nextPath = userRole === "admin" ? "/admin" : getSafeReturnPath(location);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setFeedback(
        getAuthErrorMessage(error, "Unable to sign in right now."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(event) {
    const identifier = event.currentTarget.form.elements.identifier.value.trim();
    setFeedback("");

    if (!identifier) {
      setFeedback("Enter your email address first.", "error");
      return;
    }
    if (!firebaseAuth) {
      setFeedback(getFirebaseStatus(), "error");
      return;
    }

    setLoading(true);
    try {
      const email = await resolveLoginEmail(identifier);
      await sendPasswordResetEmail(firebaseAuth, email);
    } catch {
      // Keep reset responses intentionally generic to avoid account enumeration.
    } finally {
      setFeedback(
        "If an account exists for that email, reset instructions have been sent.",
      );
      setLoading(false);
    }
  }

  async function handleVerificationResend(event) {
    const form = event.currentTarget.form;
    const identifier = form.elements.identifier.value.trim();
    const password = form.elements.password.value;
    setFeedback("");

    if (!identifier || !password) {
      setFeedback("Enter your email address and password first.", "error");
      return;
    }
    if (!firebaseAuth) {
      setFeedback(getFirebaseStatus(), "error");
      return;
    }

    setLoading(true);
    try {
      const email = await resolveLoginEmail(identifier);
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (credential.user.emailVerified) {
        setFeedback("This email address is already verified.");
      } else {
        await sendEmailVerification(credential.user);
        setFeedback(
          "A new verification email has been sent. Check your inbox and spam folder.",
        );
      }
    } catch (error) {
      setFeedback(
        getAuthErrorMessage(
          error,
          "Unable to resend the verification email right now.",
        ),
        "error",
      );
    } finally {
      await signOut(firebaseAuth);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b14] text-white">
      <div className="pointer-events-none absolute -left-32 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-15rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative flex h-[76px] items-center justify-between border-b border-white/10 px-5 sm:px-10">
        <Link
          to="/"
          aria-label="Back to home"
          className="flex items-center gap-2 text-sm font-bold text-slate-300 transition hover:text-white"
        >
          <span className="text-lg">←</span> Back to home
        </Link>
        <Link
          to="/signup"
          className="text-sm font-bold text-sky-300 transition hover:text-cyan-200"
        >
          Create account <span className="ml-1">→</span>
        </Link>
      </div>

      <div className="relative mx-auto grid w-[min(1120px,calc(100%-2rem))] items-center gap-10 py-12 sm:w-[min(1120px,calc(100%-4rem))] lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
        <div className="hidden motion-safe:transition motion-safe:duration-700 lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Private member access
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-[-0.06em] text-white xl:text-6xl">
            Your next move starts with clarity.
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-slate-400">
            Enter your member portal to review opportunities, follow your portfolio,
            and keep every important update in one place.
          </p>
        </div>

        <div className="motion-safe:transition motion-safe:duration-700 rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <img
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/20"
              src="/meridianvest-logo.svg"
              alt="MeridianVests"
              width="48"
              height="48"
            />
            <div>
              <p className="text-sm font-extrabold tracking-[-0.03em]">
                Meridian<span className="text-sky-400">Vests</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {adminLogin ? "Administrator portal" : "Member portal"}
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">
              {adminLogin ? "Administrator sign in" : "Welcome back"}
            </h2>
            <p className="text-sm leading-6 text-slate-400">
              {adminLogin
                ? "Use your authorized Firebase account to access the admin dashboard."
                : "Sign in with the email address used to create your account."}
            </p>

            <label className="block text-[12px] font-bold text-slate-200">
              <span className="mb-2 block">Email address</span>
              <div className="flex h-[58px] w-full items-center rounded-xl border border-white/10 bg-[#081321] px-4 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <UserRound size={18} className="text-sky-300" />
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  required
                  className="ml-3 h-full w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>

            <label className="block text-[12px] font-bold text-slate-200">
              <span className="mb-2 block">Password</span>
              <div className="flex h-[58px] w-full items-center rounded-xl border border-white/10 bg-[#081321] px-4 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <ShieldCheck size={18} className="text-sky-300" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  className="ml-3 h-full w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="ml-2 rounded-md p-1 text-slate-400 transition hover:text-sky-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {message && (
              <p
                role={messageType === "error" ? "alert" : "status"}
                className={messageType === "error" ? "rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-200" : "rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"}
              >
                {message}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-[52px] items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 px-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#081321] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={16} className="mr-2 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <button type="button" onClick={handlePasswordReset} className="hover:text-sky-300">
                  Reset password
                </button>
                <button type="button" onClick={handleVerificationResend} className="hover:text-sky-300">
                  Resend verification
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
