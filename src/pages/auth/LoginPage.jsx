import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import {
  firebaseAuth,
  getFirebaseStatus,
} from "../../lib/firebase";
import { firestoreDb } from "../../lib/firebaseFirestore";
import {
  browserLocalPersistence,
  setPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getAuthErrorMessage, resolveLoginEmail } from "../../lib/authHelpers";
import { createReferralReward } from "../../lib/firebaseData";
import FeedbackMessage from "../../components/ui/FeedbackMessage";
import { resolveUserRole } from "../../lib/userRole";

function MeridianLogo() {
  return (
    <svg
      aria-label="MeridianVests logo"
      role="img"
      viewBox="0 0 768 768"
      className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-slate-200"
    >
      <rect width="768" height="768" rx="112" fill="#020A24" />
      <path d="M176 219L252 276V501L176 550V219Z" fill="#FAFAFA" />
      <path d="M252 276L441 429L381 492L252 374V276Z" fill="url(#loginLogoBlueA)" />
      <path d="M592 201L501 244L381 376L441 429L592 269V201Z" fill="url(#loginLogoBlueB)" />
      <path d="M592 290L512 371V501L592 550V290Z" fill="#FAFAFA" />
      <defs>
        <linearGradient id="loginLogoBlueA" x1="252" y1="276" x2="441" y2="492" gradientUnits="userSpaceOnUse">
          <stop stopColor="#20D7F0" />
          <stop offset="1" stopColor="#0879F3" />
        </linearGradient>
        <linearGradient id="loginLogoBlueB" x1="381" y1="429" x2="592" y2="201" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1054E9" />
          <stop offset="1" stopColor="#20D7F0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function isSafeInternalPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    path !== "/control-room/login"
  );
}

function getSafeReturnPath(location) {
  const from = location.state?.from;
  return isSafeInternalPath(from)
    ? from
    : location.pathname.startsWith("/control-room")
      ? "/control-room"
      : "/dashboard";
}

function getDestination(location, role) {
  const requestedPath = getSafeReturnPath(location);
  const isAdminPath =
    requestedPath === "/control-room" ||
    requestedPath.startsWith("/control-room/");
  if (role === "admin") return isAdminPath ? requestedPath : "/control-room";
  return isAdminPath ? "/dashboard" : requestedPath;
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const adminLogin = location.pathname.startsWith("/control-room");
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
      await setPersistence(firebaseAuth, browserLocalPersistence);

      if (!credential.user.emailVerified) {
        await signOut(firebaseAuth);
        setFeedback(
          "Please verify your email before signing in. Check your inbox and spam folder.",
          "error",
        );
        return;
      }

      try {
        const profileSnapshot = firestoreDb
          ? await getDoc(doc(firestoreDb, "users", credential.user.uid))
          : null;
        const referralUsername = profileSnapshot?.data()?.referredBy;
        if (referralUsername) {
          await createReferralReward(referralUsername, credential.user);
        }
      } catch (error) {
        console.error("Referral reward retry failed", error);
      }

      const userRole = await resolveUserRole(credential.user);
      const nextPath = getDestination(location, userRole);
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
      await setPersistence(firebaseAuth, browserLocalPersistence);
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
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute left-[-14rem] top-[-14rem] h-[38rem] w-[38rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-16rem] right-[-10rem] h-[38rem] w-[38rem] rounded-full bg-cyan-50 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(56,189,248,0.08),transparent_38%)]" />

      <div className="relative flex h-[76px] items-center justify-between border-b border-blue-100 bg-slate-50/50 px-5 sm:px-10">
        <Link
          to="/"
          aria-label="Back to home"
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <span className="text-lg">←</span> Back to home
        </Link>
        <Link
          to="/signup"
          className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-sky-200/40 hover:bg-sky-300/15"
        >
          Create account <span className="ml-1">→</span>
        </Link>
      </div>

      <div className="relative mx-auto grid w-full max-w-[1120px] min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20 lg:py-20">
        <div className="hidden transition duration-700 lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Private member access
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-[-0.07em] text-slate-900 xl:text-7xl">
            Your next move starts with clarity.
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-slate-600">
            Enter your member portal to review opportunities, follow your portfolio,
            and keep every important update in one place.
          </p>
        </div>

        <div className="transition duration-700 w-full min-w-0 rounded-[2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_30px_90px_rgba(30,64,175,0.12)] backdrop-blur-2xl sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <MeridianLogo />
            <div>
              <p className="text-sm font-extrabold tracking-[-0.03em]">
                Meridian<span className="text-blue-700">Vests</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {adminLogin ? "Administrator portal" : "Member portal"}
              </p>
            </div>
          </div>

          <form className="min-w-0 space-y-5" onSubmit={handleSubmit}>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-slate-900">
              {adminLogin ? "Administrator sign in" : "Welcome back"}
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              {adminLogin
                ? "Use your authorized Firebase account to access the admin dashboard."
                : "Sign in with the email address used to create your account."}
            </p>

            <label className="block text-[12px] font-bold text-slate-700">
              <span className="mb-2 block">Email address</span>
              <div className="flex h-[58px] w-full min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                <UserRound size={18} className="shrink-0 text-blue-700" />
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  required
                  className="ml-3 h-full min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-600 focus:outline-none autofill:shadow-[inset_0_0_0_1000px_#f8fafc] autofill:[-webkit-text-fill-color:#0f172a]"
                />
              </div>
            </label>

            <label className="block text-[12px] font-bold text-slate-700">
              <span className="mb-2 block">Password</span>
              <div className="flex h-[58px] w-full min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                <ShieldCheck size={18} className="shrink-0 text-blue-700" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  className="ml-3 h-full min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-600 focus:outline-none autofill:shadow-[inset_0_0_0_1000px_#f8fafc] autofill:[-webkit-text-fill-color:#0f172a]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="ml-2 shrink-0 rounded-md p-1 text-slate-600 transition hover:text-blue-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {message && <FeedbackMessage type={messageType} variant="light">{message}</FeedbackMessage>}

            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-[54px] items-center justify-center rounded-xl bg-gradient-to-r from-sky-300 via-cyan-300 to-sky-400 px-6 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#081321] shadow-[0_14px_30px_rgba(34,211,238,0.16)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
                <button type="button" onClick={handlePasswordReset} className="hover:text-blue-700">
                  Reset password
                </button>
                <button type="button" onClick={handleVerificationResend} className="hover:text-blue-700">
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
