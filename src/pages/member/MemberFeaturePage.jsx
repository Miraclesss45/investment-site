import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { createMemberRequest, sendDepositRequestEmail, sendWithdrawalProcessingEmail, updateUserProfile } from "../../lib/firebaseData";
import useAccountData from "../../lib/useAccountData";
import CountrySelect from "../../components/ui/CountrySelect";
import {
  buildEmptyFinancialSummary,
  formatMoney,
  formatTransactionType,
  loadAccountData,
  invalidateAccountData,
} from "../../lib/financial";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";
import FeedbackMessage from "../../components/ui/FeedbackMessage";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Deposit", "/deposit"],
  ["Withdraw", "/withdraw"],
  ["Wallet / Profile", "/profile"],
  ["Transactions", "/transactions"],
  ["Support", "/support"],
  ["My Referral", "/referral"],
];
const packages = {
  Starter: {
    rate: 2.5,
    minimum: 35,
    maximum: 3000,
    description: "Flexible entry plan",
  },
  Regular: {
    rate: 10,
    minimum: 35,
    maximum: 10000,
    description: "Balanced allocation",
  },
  Pro: {
    rate: 20,
    minimum: 35,
    maximum: 20000,
    description: "Advanced strategy",
  },
  Premium: {
    rate: 35,
    minimum: 35,
    maximum: null,
    description: "Priority member support",
  },
};
const depositAssets = [
  "Litecoin",
  "Bitcoin",
  "BNB",
  "Ethereum",
];
const depositWalletAddresses = {
  Litecoin:
    import.meta.env.VITE_DEPOSIT_LITECOIN_ADDRESS ||
    "ltc1qlyg33davwq45jtrwu6zntuuaq9yzj5tfh8llry",
  Bitcoin:
    import.meta.env.VITE_DEPOSIT_BITCOIN_ADDRESS ||
    "bc1qhvylxq67v8k6ksvn8jlg4wekh90tsvnx3dme5e",
  BNB:
    import.meta.env.VITE_DEPOSIT_BNB_ADDRESS ||
    "0x2945Cb6F7A193ea61c63805038900247c10abE7d",
  Ethereum:
    import.meta.env.VITE_DEPOSIT_ETHEREUM_ADDRESS ||
    "0x2945Cb6F7A193ea61c63805038900247c10abE7d",
};
const withdrawalAssets = [
  ["Litecoin", "litecoinWallet", 10],
  ["Bitcoin", "bitcoinWallet", 25],
  ["BNB", "bnbWallet", 10],
  ["Ethereum", "ethereumWallet", 25],
];

function transactionCategory(transaction) {
  const type = String(transaction.type || "").toLowerCase();
  if (type.includes("withdraw") || type.includes("debit") || type.includes("payout")) {
    return "withdrawal";
  }
  if (
    type.includes("deposit") ||
    type.includes("credit") ||
    type.includes("investment")
  ) {
    return "deposit";
  }
  if (
    type.includes("earn") ||
    type.includes("profit") ||
    type.includes("referral") ||
    type.includes("commission")
  ) {
    return "earning";
  }
  return "other";
}

function transactionDate(transaction) {
  if (transaction.date) return String(transaction.date);
  const date = transaction.createdAt?.toDate?.();
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date unavailable";
}

function transactionStatus(transaction) {
  const status = String(transaction.status || "completed").toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function transactionTimestamp(transaction) {
  if (typeof transaction.createdAt?.toMillis === "function") {
    return transaction.createdAt.toMillis();
  }
  const dateValue = transaction.date || transaction.createdAt;
  const timestamp = new Date(dateValue).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function filterTransactionsByDate(transactions, fromDate, toDate) {
  const fromTimestamp = fromDate
    ? new Date(`${fromDate}T00:00:00`).getTime()
    : 0;
  const toTimestamp = toDate
    ? new Date(`${toDate}T23:59:59.999`).getTime()
    : Number.POSITIVE_INFINITY;

  return transactions.filter((transaction) => {
    const timestamp = transactionTimestamp(transaction);
    return timestamp >= fromTimestamp && timestamp <= toTimestamp;
  });
}

function DateRangeControls({
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  onReset,
}) {
  const invalidRange = fromDate && toDate && fromDate > toDate;

  return (
    <div className="border-b border-white/10 bg-[#081321]/60 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
            Find past activity
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Select a date range to find an older deposit or withdrawal.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 text-xs font-semibold text-slate-400">
            From
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              aria-label="Start date"
              className="mt-2 block h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1728] px-3 font-['IBM_Plex_Mono'] text-xs font-medium text-slate-100 shadow-inner shadow-black/10 outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10 [color-scheme:dark] sm:w-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-400">
            To
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              aria-label="End date"
              className="mt-2 block h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1728] px-3 font-['IBM_Plex_Mono'] text-xs font-medium text-slate-100 shadow-inner shadow-black/10 outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10 [color-scheme:dark] sm:w-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </label>
          <button
            type="button"
            onClick={onReset}
            disabled={!fromDate && !toDate}
            className="h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-300 transition hover:border-sky-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear dates
          </button>
        </div>
      </div>
      {invalidRange && (
        <p className="mt-3 text-xs text-yellow-200" role="alert">
          Choose a “From” date that is before the “To” date.
        </p>
      )}
    </div>
  );
}

function AccountPageSkeleton() {
  return (
    <section
      className="mt-8 space-y-5"
      role="status"
      aria-label="Loading your account"
    >
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span
          className="motion-safe:animate-pulse h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.8)]"
          aria-hidden="true"
        />
        Preparing your account...
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/10 bg-[#0d1728] p-6"
            aria-hidden="true"
          >
            <div className="motion-safe:animate-pulse h-5 w-40 rounded-full bg-slate-400/10" />
            <div className="motion-safe:animate-pulse mt-4 h-3 w-full rounded-full bg-slate-400/10" />
            <div className="motion-safe:animate-pulse mt-2 h-3 w-4/5 rounded-full bg-slate-400/10" />
            <div className="motion-safe:animate-pulse mt-7 h-12 w-full rounded-md bg-slate-400/10" />
            <div className="motion-safe:animate-pulse mt-3 h-12 w-full rounded-md bg-slate-400/10" />
          </div>
        ))}
      </div>
      <div
        className="rounded-2xl border border-white/10 bg-[#0d1728] p-6"
        aria-hidden="true"
      >
        <div className="motion-safe:animate-pulse h-5 w-44 rounded-full bg-slate-400/10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item}>
              <div className="motion-safe:animate-pulse h-3 w-24 rounded-full bg-slate-400/10" />
              <div className="motion-safe:animate-pulse mt-3 h-7 w-32 rounded-md bg-slate-400/10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function MemberFeaturePage() {
  const { user, signOutUser } = useAuth();
  const account = useAccountData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [profile, setProfile] = useState({});
  const [summary, setSummary] = useState(buildEmptyFinancialSummary());
  const [message, setMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const firstMobileLinkRef = useRef(null);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    document.body.classList.add("overflow-hidden");
    firstMobileLinkRef.current?.focus();

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    }
    function closeOnOutsideClick(event) {
      if (!mobileMenuRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);
  const [selectedPackage, setSelectedPackage] = useState("Starter");
  const [selectedAsset, setSelectedAsset] = useState("Bitcoin");
  const [depositAddressCopied, setDepositAddressCopied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState("all");
  const [transactionFromDate, setTransactionFromDate] = useState("");
  const [transactionToDate, setTransactionToDate] = useState("");
  const [withdrawalFromDate, setWithdrawalFromDate] = useState("");
  const [withdrawalToDate, setWithdrawalToDate] = useState("");

  const selectedDepositAddress = depositWalletAddresses[selectedAsset] || "";
  const selectedWithdrawal =
    withdrawalAssets.find(([asset]) => asset === selectedAsset) ||
    withdrawalAssets[0];
  const [selectedWithdrawalAsset, selectedWithdrawalWalletField, selectedWithdrawalFee] =
    selectedWithdrawal;
  const selectedWithdrawalWallet = String(
    profile[selectedWithdrawalWalletField] || "",
  ).trim();

  function handleDepositAssetChange(event) {
    setSelectedAsset(event.target.value);
    setDepositAddressCopied(false);
  }

  async function copyDepositAddress() {
    if (!selectedDepositAddress) {
      setMessage("The selected deposit wallet address is unavailable.");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedDepositAddress);
      setDepositAddressCopied(true);
      window.setTimeout(() => setDepositAddressCopied(false), 1600);
    } catch {
      setMessage("Copying is unavailable. Select the wallet address manually.");
    }
  }

  const accountLoading = account.loading;
  const accountError = account.error;
  useEffect(() => {
    if (accountLoading) return;
    setProfile(account.profile);
    setSummary(account.summary);
  }, [account.profile, account.summary, accountLoading]);

  useEffect(() => {
    if (accountError) setMessage(accountError);
  }, [accountError]);

  useEffect(() => {
    if (!profileSaved) return undefined;
    const timeoutId = window.setTimeout(() => setProfileSaved(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [profileSaved]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user)
      return setMessage(
        "Profile saving is unavailable until Firebase is configured.",
      );
    const formData = new FormData(event.currentTarget);
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const values = {
        fullName: formData.get("fullName")?.trim() || "",
        phone: formData.get("phone")?.trim() || "",
        country: formData.get("country")?.trim() || "",
        bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
        bnbWallet: formData.get("bnbWallet")?.trim() || "",
        ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
        litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
      };
      await updateUserProfile(user.uid, values);
      invalidateAccountData(user.uid);
      setProfile((current) => ({ ...current, ...values }));
      setProfileSaved(true);
      const { summary: refreshedSummary } = await loadAccountData(user.uid);
      setSummary(refreshedSummary);
    } catch (error) {
      const code = String(error?.code || "");
      setMessage(
        code.includes("permission-denied")
          ? "Your profile update was denied by Firebase. Check your Firestore rules, then sign in again."
          : "Unable to save your profile right now.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitDepositRequest(event) {
    event.preventDefault();
    setMessage("");

    if (!user) {
      setMessage("Deposit requests are unavailable until Firebase is configured.");
      return;
    }

    const amount = Number(depositAmount);
    const selectedPlan = packages[selectedPackage];
    if (
      !Number.isFinite(amount) ||
      amount < selectedPlan.minimum ||
      (selectedPlan.maximum !== null && amount > selectedPlan.maximum)
    ) {
      setMessage(
        `Enter an amount between ${formatMoney(selectedPlan.minimum)} and ${
          selectedPlan.maximum === null
            ? "no upper limit"
            : formatMoney(selectedPlan.maximum)
        }.`,
      );
      return;
    }

    setDepositSubmitting(true);
    try {
      const depositorName = profile.fullName || user.displayName || "Not provided";
      const request = await createMemberRequest(user.uid, "deposits", {
        plan: selectedPackage,
        amount,
        currency: "USD",
        method: selectedAsset,
        fullName: depositorName,
        email: user.email || "",
      });
      try {
        await sendDepositRequestEmail({
          requestId: request.id,
          name: depositorName,
          email: user.email || "",
          plan: selectedPackage,
          method: selectedAsset,
          amount,
        });
      } catch {
        setMessage("Your deposit was saved, but the Telegram notification could not be sent. Our team can still review it in the portal.");
      }
      setDepositAmount("");
      navigate("/deposit-pending", {
        replace: true,
        state: {
          packageName: selectedPackage,
          amount,
          asset: selectedAsset,
        },
      });
    } catch (error) {
      setMessage("We could not submit your deposit request. Your details were not saved. Please try again.");
    } finally {
      setDepositSubmitting(false);
    }
  }

  async function copyReferral() {
    const link = profile.username
      ? `${window.location.origin}/signup?ref=${encodeURIComponent(profile.username)}`
      : "";
    if (!link) {
      setMessage("Your username is still loading. Please try again shortly.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage("Copying is unavailable. Select the link manually.");
    }
  }

  async function submitWithdrawalRequest(event) {
      event.preventDefault();
      setMessage("");
      if (!user) {
        setMessage("Withdrawal requests are unavailable until Firebase is configured.");
        return;
      }

      const amount = Number(withdrawalAmount);
      const wallet = selectedWithdrawalWallet;
      const fee = selectedWithdrawalFee;

      if (!Number.isFinite(amount) || amount <= 0) {
        setMessage("Enter a valid withdrawal amount.");
        return;
      }
      if (amount > summary.withdrawableBalance) {
        setMessage(
          "The requested amount is greater than your withdrawable balance. Promotional credit cannot be withdrawn.",
        );
        return;
      }
      if (!wallet) {
        setMessage(`Add your ${selectedWithdrawalAsset} wallet address in your profile first.`);
        return;
      }

      setWithdrawalSubmitting(true);
      try {
        const request = await createMemberRequest(user.uid, "withdrawals", { amount, method: selectedAsset, wallet, fee, email: user.email || "" });
        let emailFailed = false;
        let emailFailureCode = "";
        try {
          await sendWithdrawalProcessingEmail(request.id);
        } catch (error) {
          emailFailed = true;
          emailFailureCode = error?.code || "email-delivery-failed";
        }
        navigate("/withdrawal-pending", {
          replace: true,
          state: {
            amount,
            asset: selectedWithdrawalAsset,
            wallet,
            fee,
            emailFailed,
            emailFailureCode,
          },
        });
      } catch {
        setMessage(
          "We could not submit your withdrawal request. Your details were not saved. Please try again.",
        );
      } finally {
        setWithdrawalSubmitting(false);
    }
  }

  async function signOut() {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  const title =
    {
      "/deposit": "Choose an investment package",
      "/withdraw": "Withdrawal overview",
      "/profile": "Wallet and profile",
      "/transactions": "Transactions",
      "/referral": "Referral center",
    }[pathname] || "Member account";

  return (
    <div className="min-h-screen bg-[#07111d] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-transparent shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] items-center justify-between gap-4 py-4 sm:w-[min(1280px,calc(100%-3rem))]">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 text-xl font-extrabold"
          >
            <img
              className="h-9 w-9 rounded-lg object-cover"
              src="/meridianvest-logo.svg"
              alt="MeridianVests logo"
              width="36"
              height="36"
            />
            Meridian<span className="text-sky-400">Vests</span>
          </Link>
          <div className="flex items-center gap-2">
            <div ref={mobileMenuRef} className="relative lg:hidden">
              <button
                type="button"
                ref={mobileMenuButtonRef}
                aria-label="Open member portal menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="member-portal-menu"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-slate-200 transition hover:border-sky-400 hover:text-sky-400"
              >
                {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
              {mobileMenuOpen && (
                <nav
                  id="member-portal-menu"
                  className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-white/10 bg-[#101d30] p-2 shadow-2xl"
                >
                {navigation.map(([label, href], index) => (
                  <Link
                    key={href}
                    to={href}
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`block rounded-lg px-3 py-3 text-sm transition hover:bg-white/10 hover:text-sky-400 ${pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"}`}
                  >
                    {label}
                  </Link>
                ))}
                </nav>
              )}
            </div>
            <button
              type="button"
              aria-label="Sign out"
              onClick={signOut}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.03] text-slate-300 transition hover:border-rose-300/50 hover:bg-rose-400/10 hover:text-rose-200"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-[min(1280px,calc(100%-2rem))] gap-6 py-6 sm:w-[min(1280px,calc(100%-3rem))] lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-lg border border-white/10 bg-[#0d1728] p-3 lg:block">
          <p className="px-3 pb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            Member portal
          </p>
          <nav className="grid gap-1 text-sm">
            {navigation.map(([label, href]) => (
              <Link
                key={href}
                to={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`rounded-md px-3 py-3 hover:bg-white/10 hover:text-sky-400 ${pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">
            Member portal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          {message && !accountLoading && (
            <FeedbackMessage className="mt-4" type="warning">{message}</FeedbackMessage>
          )}
          {accountLoading ? (
            <AccountPageSkeleton />
          ) : (
            <>
          {pathname === "/deposit" && (
            <section className="mt-8 space-y-6">
              <div className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/15 via-[#0d1728] to-[#0d1728] p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
                <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">
                      Start from $35
                    </p>
                    <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
                      Choose a package built around your next move.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Select a plan below, enter your intended amount, and send
                      a request for support review. Your account balance is not
                      changed until the request is verified.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Minimum deposit
                    </p>
                    <p className="mt-1 text-3xl font-extrabold text-white">$35</p>
                  </div>
                </div>
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/10 bg-[#0d1728] p-5 sm:p-6">
                <div className="mb-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
                    01 / Select a plan
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Investment packages
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(packages).map(
                    ([name, { rate, minimum, maximum, description }]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedPackage(name)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selectedPackage === name
                            ? "border-sky-400 bg-sky-400/10"
                            : "border-white/10 bg-[#081321] hover:border-sky-400/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-white">{name} Plan</span>
                          <span className="text-lg font-extrabold text-cyan-300">
                            {rate}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          {formatMoney(minimum)} -{" "}
                          {maximum === null ? "Unlimited" : formatMoney(maximum)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">{description}</p>
                      </button>
                    ),
                  )}
                </div>
                <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-xs text-slate-300 sm:grid-cols-3">
                  <span>Daily yield: <strong className="text-white">{packages[selectedPackage].rate}%</strong></span>
                  <span>Duration: <strong className="text-white">14 days</strong></span>
                  <span>Deposit return: <strong className="text-white">Yes</strong></span>
                </div>
              </div>

              <form
                onSubmit={submitDepositRequest}
                className="rounded-2xl border border-white/10 bg-[#0d1728] p-5 sm:p-6"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
                  02 / Send for review
                </p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  Request a deposit
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Submit your intended amount and asset. Support will confirm
                  the next steps. No funds are credited automatically.
                </p>
                <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-xs leading-5 text-cyan-100">
                  Selected: <strong>{selectedPackage} Plan</strong> ·{" "}
                  {packages[selectedPackage].rate}% daily yield
                </div>
                <label className="mt-5 block text-sm text-slate-300">
                  Deposit amount (USD)
                  <input
                    type="number"
                    min={packages[selectedPackage].minimum}
                    max={packages[selectedPackage].maximum || undefined}
                    step="0.01"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder={formatMoney(packages[selectedPackage].minimum)}
                    required
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-white transition focus:border-sky-400 focus:outline-none"
                  />
                  <span className="mt-2 block text-xs text-slate-500">
                    Minimum deposit: {formatMoney(packages[selectedPackage].minimum)}
                  </span>
                </label>
                <label className="mt-4 block text-sm text-slate-300">
                  Deposit asset
                  <div className="relative mt-2">
                    <select
                      value={selectedAsset}
                      onChange={handleDepositAssetChange}
                      className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-[#081321] px-3 pr-11 text-sm text-slate-100 shadow-inner shadow-black/10 outline-none transition hover:border-white/20 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10 [color-scheme:dark]"
                    >
                      {depositAssets.map((asset) => (
                        <option key={asset} className="bg-[#0d1728] text-white">
                          {asset}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-300"
                    />
                  </div>
                </label>
                <div className="mt-5 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-300">
                        Send {selectedAsset} to this address
                      </p>
                      <p className="mt-2 break-all text-sm font-semibold leading-6 text-white">
                        {selectedDepositAddress || "Address unavailable"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={copyDepositAddress}
                      disabled={!selectedDepositAddress}
                      aria-label={
                        depositAddressCopied
                          ? "Deposit wallet address copied"
                          : "Copy deposit wallet address"
                      }
                      className={`shrink-0 rounded-lg px-3 py-3 text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        depositAddressCopied
                          ? "bg-green-400"
                          : "bg-sky-400 hover:bg-cyan-300"
                      }`}
                    >
                      {depositAddressCopied ? (
                        <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        <Copy size={17} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    Send only {selectedAsset} to this wallet address. Verify
                    the address before submitting your deposit request.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="mt-6 w-full rounded-lg bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(34,211,238,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {depositSubmitting ? (
                    <>
                      <LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" />
                      Submitting...
                    </>
                  ) : (
                    "Submit deposit request"
                  )}
                </button>
                <Link
                  to="/support"
                  className="mt-4 block text-center text-xs font-bold text-sky-300 hover:text-cyan-200"
                >
                  Need help? Contact support
                </Link>
              </form>
              </div>
            </section>
          )}
          {pathname === "/withdraw" && (
            <section className="mt-8 space-y-6">
              <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-400/15 via-[#0d1728] to-[#0d1728] p-6 sm:p-8">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-300">
                  Secure withdrawal review
                </p>
                <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
                      Withdraw with confidence.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Submit a withdrawal request for review. We verify the
                      wallet, balance, and network before anything is sent.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Available balance
                    </p>
                    <p className="mt-1 font-['IBM_Plex_Mono'] text-3xl font-semibold tracking-[-0.05em] text-white">
                      {formatMoney(summary.availableBalance)}
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={submitWithdrawalRequest}
                className="grid gap-6 rounded-2xl border border-white/10 bg-[#0d1728] p-5 sm:p-7 lg:grid-cols-[1fr_0.9fr]"
              >
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
                    01 / Withdrawal details
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Where should we send it?
                  </h2>
                  <label className="mt-6 block text-sm text-slate-300">
                    Withdrawal asset
                    <div className="relative mt-2">
                      <select
                        value={selectedAsset}
                        onChange={(event) => setSelectedAsset(event.target.value)}
                        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-[#081321] px-3 pr-11 text-sm text-slate-100 shadow-inner shadow-black/10 outline-none transition hover:border-white/20 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10 [color-scheme:dark]"
                      >
                        {withdrawalAssets.map(([asset]) => (
                          <option key={asset} className="bg-[#0d1728] text-white">
                            {asset}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-300"
                      />
                    </div>
                  </label>
                  <label className="mt-4 block text-sm text-slate-300">
                    Amount (USD)
                    <input
                      id="withdrawal-amount"
                      type="number"
                      min="0.01"
                      max={summary.withdrawableBalance}
                      step="0.01"
                      value={withdrawalAmount}
                      onChange={(event) => setWithdrawalAmount(event.target.value)}
                      placeholder="0.00"
                      aria-describedby="withdrawal-amount-help"
                      aria-invalid={
                        withdrawalAmount !== "" &&
                        (!Number.isFinite(Number(withdrawalAmount)) ||
                          Number(withdrawalAmount) <= 0 ||
                          Number(withdrawalAmount) > summary.withdrawableBalance)
                      }
                      required
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-white focus:border-sky-400 focus:outline-none"
                    />
                    <span id="withdrawal-amount-help" className="mt-2 block text-xs font-normal normal-case tracking-normal text-slate-500">
                      Available to withdraw: {formatMoney(summary.withdrawableBalance)}
                    </span>
                  </label>
                  <div className={`mt-4 rounded-xl border p-4 text-xs leading-5 ${selectedWithdrawalWallet ? "border-white/10 bg-[#081321] text-slate-300" : "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"}`}>
                    <p className="font-bold text-white">Saved {selectedWithdrawalAsset} wallet</p>
                    {selectedWithdrawalWallet ? (
                      <p className="mt-2 break-all font-['IBM_Plex_Mono'] text-slate-300">{selectedWithdrawalWallet}</p>
                    ) : (
                      <p className="mt-2">
                        Add a {selectedWithdrawalAsset} wallet address in{" "}
                        <Link to="/profile" className="font-bold text-amber-200 underline hover:text-white">
                          Wallet / Profile
                        </Link>{" "}
                        before submitting your request.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#081321] p-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
                    02 / Review
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Request summary
                  </h2>
                  <dl className="mt-6 space-y-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Asset</dt>
                      <dd className="font-bold text-white">{selectedWithdrawalAsset}</dd>
                    </div>
                    <div className="space-y-2">
                      <dt className="text-slate-500">Destination wallet</dt>
                      <dd className="break-all font-['IBM_Plex_Mono'] text-xs leading-5 text-white">
                        {selectedWithdrawalWallet || "Add this wallet in your profile to continue"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Network fee</dt>
                      <dd className="font-['IBM_Plex_Mono'] font-semibold text-white">
                        {formatMoney(selectedWithdrawalFee)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-white/10 pt-4">
                      <dt className="text-slate-500">You request</dt>
                      <dd className="font-['IBM_Plex_Mono'] font-semibold text-cyan-300">
                        {formatMoney(Number(withdrawalAmount) || 0)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="submit"
                    disabled={
                      withdrawalSubmitting ||
                      summary.withdrawableBalance <= 0 ||
                      !selectedWithdrawalWallet
                    }
                    className="mt-7 w-full rounded-lg bg-gradient-to-r from-sky-400 to-cyan-300 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {withdrawalSubmitting ? (
                      <>
                        <LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" />
                        Processing request...
                      </>
                    ) : (
                      "Submit withdrawal request"
                    )}
                  </button>
                  <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                    Requests are reviewed before funds are sent.
                  </p>
                </div>
              </form>
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400 sm:flex-row sm:items-center">
                <span>Need help with a wallet or network?</span>
                <div className="flex flex-wrap items-center gap-4">
                  <Link to="/support" className="font-bold text-sky-300 hover:text-cyan-200">
                    Contact support →
                  </Link>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-green-300 hover:text-green-200">
                    <WhatsAppIcon size={15} /> WhatsApp
                  </a>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1728]">
                <div className="p-5 sm:p-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-400">
                    Withdrawal history
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-white">
                    Find a previous withdrawal
                  </h2>
                </div>
                <DateRangeControls
                  fromDate={withdrawalFromDate}
                  toDate={withdrawalToDate}
                  setFromDate={setWithdrawalFromDate}
                  setToDate={setWithdrawalToDate}
                  onReset={() => {
                    setWithdrawalFromDate("");
                    setWithdrawalToDate("");
                  }}
                />
                {(() => {
                  const withdrawals = filterTransactionsByDate(
                    summary.transactions.filter(
                      (item) => transactionCategory(item) === "withdrawal",
                    ),
                    withdrawalFromDate,
                    withdrawalToDate,
                  );

                  return withdrawals.length ? (
                    <div className="divide-y divide-white/5">
                      {withdrawals.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {formatTransactionType(item.type, "Withdrawal")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {transactionDate(item)} · {transactionStatus(item)}
                            </p>
                          </div>
                          <p className="font-['IBM_Plex_Mono'] font-semibold text-white">
                            −{formatMoney(item.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-5 py-8 text-center text-sm text-slate-400 sm:px-6">
                      No withdrawals match the selected date range.
                    </p>
                  );
                })()}
              </div>
            </section>
          )}
          {pathname === "/profile" && (
            <>
              <section className="mt-8 overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-400/10 via-[#0d1728] to-[#0d1728]">
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-400 text-xl font-extrabold text-slate-950">
                      {(profile.username || user?.displayName || "M")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-300">
                        Member identity
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-white">
                        {profile.fullName || user?.displayName || "Your profile"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Your username is your permanent referral code.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 sm:min-w-[210px]">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                      Username / referral code
                    </p>
                    <p className="mt-1 break-all text-lg font-bold text-cyan-200">
                      {profile.username || user?.displayName || "Unavailable"}
                    </p>
                  </div>
                </div>
              </section>
              <form
                key={profile.username || user?.uid}
                onSubmit={saveProfile}
                className="mt-5 grid gap-4 rounded-xl border border-white/10 bg-[#0d1728] p-6 sm:grid-cols-2"
              >
                {[
                  ["fullName", "Full name"],
                  ["phone", "Phone"],
                  ["country", "Country"],
                  ["litecoinWallet", "Litecoin wallet"],
                  ["bitcoinWallet", "Bitcoin wallet"],
                  ["bnbWallet", "BNB wallet"],
                  ["ethereumWallet", "Ethereum wallet"],
                ].map(([name, label]) => (
                  <label key={name} className="text-sm text-slate-300">
                    {label}
                    {name === "country" ? (
                      <CountrySelect
                        id="profile-country"
                        name={name}
                        defaultValue={profile[name] || ""}
                      />
                    ) : (
                      <input
                        name={name}
                        defaultValue={profile[name] || ""}
                        className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-4 text-white shadow-inner shadow-black/10 outline-none transition hover:border-sky-400/45 focus:border-sky-400 focus:bg-[#0b1a2c] focus:ring-2 focus:ring-sky-400/15"
                      />
                    )}
                  </label>
                ))}
                <button
                  type="submit"
                  disabled={profileSaving}
                  aria-busy={profileSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-sky-400 px-5 py-3 text-xs font-bold uppercase text-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                >
                  {profileSaving ? (
                    <>
                      <LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" />
                      Saving profile...
                    </>
                ) : profileSaved ? (
                  "Profile saved"
                ) : (
                  "Save profile"
                )}
                </button>
              </form>
            </>
          )}
          {pathname === "/transactions" && (
            <section className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Available balance",
                    summary.availableBalance,
                    "Includes non-withdrawable crypto capital and promotional credit",
                  ],
                  ["Total deposited", summary.totalDeposit, "Completed deposits"],
                  ["Total earnings", summary.totalEarnings, "Recorded earnings"],
                  [
                    "Promotional credit",
                    summary.promotionalCredit,
                    "Cannot be withdrawn",
                  ],
                ].map(([label, amount, caption]) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-white/10 bg-[#0d1728] p-5"
                  >
                    <p className="text-xs font-semibold text-slate-400">{label}</p>
                    <p className="mt-3 font-['IBM_Plex_Mono'] text-2xl font-semibold tracking-[-0.04em] text-white">
                      {formatMoney(amount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{caption}</p>
                  </article>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1728]">
                <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">
                      Account ledger
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-white">
                      Transaction history
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      A record of completed activity posted to your account.
                    </p>
                  </div>
                  <Link
                    to="/support"
                    className="text-xs font-bold uppercase tracking-[0.12em] text-sky-300 hover:text-cyan-200"
                  >
                    Need help? Contact support
                  </Link>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-green-300 hover:text-green-200">
                    <WhatsAppIcon size={14} /> WhatsApp
                  </a>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-white/10 p-4 sm:px-6">
                  {[
                    ["all", "All activity"],
                    ["deposit", "Deposits"],
                    ["withdrawal", "Withdrawals"],
                    ["earning", "Earnings"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransactionFilter(value)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        transactionFilter === value
                          ? "border-sky-400 bg-sky-400/10 text-sky-300"
                          : "border-white/10 text-slate-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <DateRangeControls
                  fromDate={transactionFromDate}
                  toDate={transactionToDate}
                  setFromDate={setTransactionFromDate}
                  setToDate={setTransactionToDate}
                  onReset={() => {
                    setTransactionFromDate("");
                    setTransactionToDate("");
                  }}
                />

                {(() => {
                  const filteredTransactions = filterTransactionsByDate(
                    summary.transactions.filter(
                      (item) =>
                        transactionFilter === "all" ||
                        transactionCategory(item) === transactionFilter,
                    ),
                    transactionFromDate,
                    transactionToDate,
                  );

                  return filteredTransactions.length ? (
                    <div className="overflow-x-auto">
                      <div className="min-w-[680px]">
                        <div className="grid grid-cols-[1.35fr_1fr_1fr_0.8fr] gap-4 border-b border-white/10 px-6 py-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                          <span>Activity</span>
                          <span>Date</span>
                          <span>Status</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {filteredTransactions.map((item) => {
                          const category = transactionCategory(item);
                          const isOutgoing = category === "withdrawal";
                          const status = String(
                            item.status || "completed",
                          ).toLowerCase();
                          const statusClass =
                            ["completed", "complete", "approved", "settled", "success"].includes(
                              status,
                            )
                              ? "bg-emerald-400/10 text-emerald-300"
                              : status === "pending"
                                ? "bg-yellow-300/10 text-yellow-200"
                                : "bg-slate-400/10 text-slate-300";

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1.35fr_1fr_1fr_0.8fr] gap-4 border-b border-white/5 px-6 py-4 text-sm last:border-0"
                            >
                              <div>
                                <p className="font-semibold text-white">
                                  {formatTransactionType(item.type, "Account activity")}
                                </p>
                                <p className="mt-1 text-xs capitalize text-slate-500">
                                  {category}
                                  {item.currency ? ` · ${item.currency}` : ""}
                                </p>
                              </div>
                              <span className="self-center text-slate-400">
                                {transactionDate(item)}
                              </span>
                              <span className="self-center">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                  {transactionStatus(item)}
                                </span>
                              </span>
                              <span className={`self-center text-right font-bold ${isOutgoing ? "text-white" : "text-emerald-300"}`}>
                                {isOutgoing ? "−" : "+"}
                                {formatMoney(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-14 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sky-400/10 text-xl text-sky-300">
                        —
                      </div>
                      <h3 className="mt-4 font-semibold text-white">
                        No {transactionFilter === "all" ? "" : `${transactionFilter} `}transactions yet
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                        Completed deposits, withdrawals, and earnings will
                        appear here once they are posted to your ledger.
                      </p>
                      <Link
                        to={transactionFilter === "withdrawal" ? "/withdraw" : "/deposit"}
                        className="mt-5 inline-flex rounded-lg bg-sky-400 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-950"
                      >
                        {transactionFilter === "withdrawal" ? "Request a withdrawal" : "Make a deposit"}
                      </Link>
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-sky-400/15 bg-sky-400/5 p-5 text-sm leading-6 text-slate-300">
                <strong className="text-white">Ledger note:</strong> Transaction
                history reflects entries confirmed by MeridianVests. Pending
                deposit and withdrawal requests are reviewed separately and do
                not change your balance until approved.
              </div>
            </section>
          )}
          {pathname === "/referral" && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-sky-300/20 bg-gradient-to-br from-sky-400/10 via-[#0d1728] to-[#0d1728] p-6 sm:p-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-300">
                Referral center
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-white">
                Invite with your username
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
                Share this link so new members arrive with your username
                automatically filled in on the signup form.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs text-slate-500">Your referral username</p>
                  <p className="mt-2 break-all text-lg font-bold text-cyan-200">
                    {profile.username || "Loading..."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs text-slate-500">Successful referrals</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {summary.referralCount}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm text-slate-400">
                Recorded commission:{" "}
                <span className="font-['IBM_Plex_Mono'] font-semibold text-white">
                  {formatMoney(summary.commission)}
                </span>
              </p>
              <button
                type="button"
                onClick={copyReferral}
                disabled={!profile.username}
                aria-label={copied ? "Referral link copied" : "Copy referral link"}
                className={`mt-5 rounded-lg px-4 py-3 text-xs font-bold text-slate-950 transition ${
                  copied ? "bg-green-400" : "bg-sky-400"
                }`}
              >
                {copied ? (
                  <span className="inline-flex items-center gap-2">
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                    Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Copy size={16} aria-hidden="true" />
                    Copy referral link
                  </span>
                )}
              </button>
            </section>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
