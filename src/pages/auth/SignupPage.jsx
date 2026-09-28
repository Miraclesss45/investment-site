import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, Mail, MapPin } from "lucide-react";
import { firebaseAuth, getFirebaseStatus } from "../../lib/firebase";
import { firestoreDb } from "../../lib/firebaseFirestore";
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getAuthErrorMessage } from "../../lib/authHelpers";
import { createAccount } from "../../lib/firebaseData";
import CountrySelect from "../../components/ui/CountrySelect";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";
import FeedbackMessage from "../../components/ui/FeedbackMessage";

export default function SignupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const referralUsernameFromLink =
    new URLSearchParams(location.search).get("ref")?.trim().toLowerCase() || "";
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirmationValue, setPasswordConfirmationValue] =
    useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setMessageType("status");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    let createdUser = null;
    let accountProvisioned = false;

    try {
      if (!firebaseAuth || !firestoreDb) throw new Error(getFirebaseStatus());

      const firstName = formData.get("firstName");
      const lastName = formData.get("lastName");
      const username = formData.get("username")?.trim().toLowerCase();
      const email = formData.get("email")?.trim().toLowerCase();
      const emailConfirmation = formData
        .get("emailConfirmation")
        ?.trim()
        .toLowerCase();
      const referralUsername =
        formData.get("upline")?.trim().toLowerCase() || referralUsernameFromLink;
      const password = formData.get("password");
      const passwordConfirmation = formData.get("passwordConfirmation");

      if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
        throw new Error(
          "Choose a username with 3-30 lowercase letters, numbers, dots, underscores, or hyphens.",
        );
      }

      if (password !== passwordConfirmation) {
        throw new Error("Passwords do not match.");
      }

      if (email !== emailConfirmation) {
        throw new Error("Email addresses do not match.");
      }

      if (!formData.get("terms")) {
        throw new Error("Accept the terms and conditions to continue.");
      }

      await createAccount({
        fullName: `${firstName} ${lastName}`.trim(),
        username,
        email,
        password,
        termsAccepted: true,
        phone: formData.get("phone") || "",
        country: formData.get("country")?.trim() || "",
        bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
        bnbWallet: formData.get("bnbWallet")?.trim() || "",
        ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
        litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
        referredBy: referralUsername,
      });
      accountProvisioned = true;
      const signupData = await signInWithEmailAndPassword(firebaseAuth, email, password);
      createdUser = signupData.user;
      if (!createdUser) throw new Error("Unable to create your account right now.");
      await sendEmailVerification(createdUser);
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
        replace: true,
        state: { email },
      });
    } catch (error) {
      const signupError =
        error?.code === "already-exists" ||
        error?.code === "username-already-in-use"
          ? new Error("That username is already in use. Choose another one.")
          : error?.code === "invalid-referral"
            ? new Error("That referral username does not exist or is not valid.")
          : error;
      if (createdUser) {
        try {
          await signOut(firebaseAuth);
        } catch {
          // The account remains recoverable through login and verification resend.
        }
      }
      setMessageType("error");
      setMessage(
        accountProvisioned
          ? error?.code === "referral-reward-failed" ||
            error?.code === "referral-reward-not-configured"
            ? "Your account was created, but the referral reward is still pending. Please contact support before continuing."
            : "Your account was created, but we could not send the verification email. Sign in to resend it."
          : getAuthErrorMessage(
              signupError,
              "Unable to create your account right now.",
            ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b14] px-4 pb-16 pt-8 text-slate-200 sm:px-6">
      <div className="pointer-events-none absolute right-[-12rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em] text-white"
        >
          <img
            className="h-10 w-10 rounded-lg object-cover"
            src="/meridianvest-logo.svg"
                      alt="MeridianVests logo"
            width="40"
            height="40"
          />
          Meridian<span className="text-sky-400">Vests</span>
        </Link>
        <div className="flex items-center gap-3 text-right text-xs font-semibold sm:text-sm">
          <span className="hidden sm:inline">Already a member?</span>
          <Link
            to="/login"
            className="inline-flex h-10 min-w-[86px] items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-200 transition hover:bg-sky-300/20"
          >
            Login
          </Link>
        </div>
      </div>
      <div className="relative mx-auto mt-12 w-full max-w-[900px] rounded-[2rem] border border-white/[0.12] bg-[#0b1626]/80 p-6 shadow-[0_30px_90px_rgba(2,8,23,0.45)] backdrop-blur-2xl sm:mt-16 sm:p-10">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="mb-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Start
              your journey
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
              Create your account
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Access private opportunities, allocation insights, and portfolio
              updates.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                First name
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  required
                  autoComplete="given-name"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Last name
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  required
                  autoComplete="family-name"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Username
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9._-]{3,30}"
                  autoComplete="username"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <span className="mt-2 block text-xs text-slate-400">
                Use 3-30 letters, numbers, dots, underscores, or hyphens.
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Email address
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Confirm email
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="emailConfirmation"
                  name="emailConfirmation"
                  type="email"
                  placeholder="Confirm email address"
                  required
                  autoComplete="email"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Phone number
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone number"
                  autoComplete="tel"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Country
              </span>
              <CountrySelect id="country" name="country" required />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Password
              </span>
              <div className="flex w-full items-center rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={passwordValue}
                  onChange={(event) => setPasswordValue(event.target.value)}
                  placeholder="Create password"
                  minLength="8"
                  required
                  autoComplete="new-password"
                  aria-describedby="password-requirement"
                  aria-invalid={
                    passwordValue.length > 0 && passwordValue.length < 8
                  }
                  className={`h-[58px] min-w-0 flex-1 bg-transparent text-white placeholder:text-slate-400 focus:outline-none ${
                    passwordValue.length > 0 && passwordValue.length < 8
                      ? "text-red-100"
                      : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-l border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              <p
                id="password-requirement"
                className={`mt-2 text-xs ${
                  passwordValue.length > 0 && passwordValue.length < 8
                    ? "text-red-400"
                    : "text-slate-400"
                }`}
              >
                {passwordValue.length > 0 && passwordValue.length < 8
                  ? `Password must be at least 8 characters (${passwordValue.length}/8).`
                  : "Use at least 8 characters for a stronger password."}
              </p>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Confirm password
              </span>
              <div className="flex w-full items-center rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type={showPasswordConfirmation ? "text" : "password"}
                  value={passwordConfirmationValue}
                  onChange={(event) =>
                    setPasswordConfirmationValue(event.target.value)
                  }
                  placeholder="Retype your password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  aria-describedby="password-confirmation-status"
                  aria-invalid={
                    passwordConfirmationValue.length > 0 &&
                    passwordConfirmationValue !== passwordValue
                  }
                  className="h-[58px] min-w-0 flex-1 bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPasswordConfirmation((visible) => !visible)
                  }
                  aria-label={
                    showPasswordConfirmation
                      ? "Hide password confirmation"
                      : "Show password confirmation"
                  }
                  aria-pressed={showPasswordConfirmation}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-l border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                >
                  {showPasswordConfirmation ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {passwordConfirmationValue.length > 0 && (
                <p
                  id="password-confirmation-status"
                  className={`mt-2 text-xs ${
                    passwordConfirmationValue === passwordValue
                      ? "text-emerald-300"
                      : "text-red-400"
                  }`}
                  role="status"
                >
                  {passwordConfirmationValue === passwordValue
                    ? "Passwords match."
                    : "Passwords do not match yet."}
                </p>
              )}
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Referral username
              </span>
              {referralUsernameFromLink && (
                <p className="mb-2 text-xs text-cyan-200">
                  Referral link detected. The username has been filled in for
                  you.
                </p>
              )}
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="upline"
                  name="upline"
                  type="text"
                  placeholder="Optional referral username"
                  defaultValue={referralUsernameFromLink}
                  autoComplete="off"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>

            <div className="md:col-span-2 border-t border-white/10 pt-6">
              <h2 className="text-lg font-semibold text-white">Wallet setup</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Optional for now. Add supported wallet addresses to make future
                deposit and withdrawal requests easier.
              </p>
            </div>
            {[
              ["litecoinWallet", "Litecoin wallet address"],
              ["bitcoinWallet", "Bitcoin wallet address"],
              ["bnbWallet", "BNB wallet address"],
              ["ethereumWallet", "Ethereum wallet address"],
            ].map(([name, label]) => (
              <label key={name} className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-slate-200">
                  {label}
                </span>
                <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                  <input
                    id={name}
                    name={name}
                    type="text"
                    placeholder={`Optional ${label.toLowerCase()}`}
                    autoComplete="off"
                    className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </label>
            ))}
          </div>

          <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
            <input
              name="terms"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 accent-sky-400"
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="text-sky-400 hover:text-cyan-300">
                terms and conditions
              </Link>{" "}
              and understand that investment outcomes are not guaranteed.
            </span>
          </label>

          <div className="mb-5 flex items-center gap-4 text-sm text-slate-200">
            <MapPin size={18} /> MeridianVests Crypto Management Group
          </div>
          <a
            href="mailto:meridianvest948@gmail.com"
            className="flex items-center gap-4 text-sm text-slate-200 hover:text-sky-400"
          >
            <Mail size={18} /> Contact support
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-4 text-sm text-slate-200 hover:text-green-400"
          >
            <WhatsAppIcon size={18} /> Chat on WhatsApp
          </a>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="mt-3 h-14 w-full rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,211,238,0.2)]"
          >
            {loading ? (
              <>
                <LoaderCircle size={17} className="mr-2 animate-spin" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </button>

          {message && <FeedbackMessage type={messageType}>{message}</FeedbackMessage>}
        </form>
      </div>
    </div>
  );
}
