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
import { createMemberDepositRequest, createWithdrawalRequest, loadOlderMemberHistory, sendDepositPendingEmail, sendWithdrawalProcessingEmail, updateUserProfile } from "../../lib/firebaseData";
import { getInvestmentPackages } from "../../lib/packageCatalog";
import useAccountData from "../../lib/useAccountData";
import { getPromoTermsForAmount } from "../../lib/promoTerms";
import { normalizeReferralRewardStatus, referralRewardStatusLabel } from "../../lib/referralRewards";
import { hasStoredNonNegativeNumber } from "../../lib/financialMath";
import {
  buildEmptyFinancialSummary,
  formatMoney,
  formatTransactionType,
  loadAccountData,
  invalidateAccountData,
} from "../../lib/financial";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";
import FeedbackMessage from "../../components/ui/FeedbackMessage";
import SkipToContent from "../../components/ui/SkipToContent";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Deposit", "/deposit"],
  ["Withdraw", "/withdraw"],
  ["Wallet / Profile", "/profile"],
  ["Transactions", "/transactions"],
  ["Support", "/support"],
  ["My Referral", "/referral"],
];
const depositAssets = [
  "Litecoin",
  "Bitcoin",
  "Ethereum",
];
const depositWalletAddresses = {
  Litecoin:
    import.meta.env.VITE_DEPOSIT_LITECOIN_ADDRESS ||
    "ltc1qlyg33davwq45jtrwu6zntuuaq9yzj5tfh8llry",
  Bitcoin:
    import.meta.env.VITE_DEPOSIT_BITCOIN_ADDRESS ||
    "bc1qhvylxq67v8k6ksvn8jlg4wekh90tsvnx3dme5e",
  Ethereum:
    import.meta.env.VITE_DEPOSIT_ETHEREUM_ADDRESS ||
    "0x2945Cb6F7A193ea61c63805038900247c10abE7d",
};
const withdrawalAssets = [
  ["Litecoin", "litecoinWallet"],
  ["Bitcoin", "bitcoinWallet"],
  ["Ethereum", "ethereumWallet"],
];

async function getWithdrawalIdempotencyKey(userId, { amount, method, wallet }) {
  const storageKey = `meridianvests:withdrawal-request:${userId}`;
  const fingerprintInput = `${Number(amount).toFixed(2)}\n${method}\n${wallet}`;
  let fingerprint = fingerprintInput;
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprintInput));
      fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (saved?.fingerprint === fingerprint && Date.now() - Number(saved.createdAt) < 24 * 60 * 60 * 1000) {
      return saved.key;
    }
    const key = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key, createdAt: Date.now() }));
    return key;
  } catch {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
}

function clearWithdrawalIdempotencyKey(userId, key) {
  try {
    const storageKey = `meridianvests:withdrawal-request:${userId}`;
    const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "null");
    if (saved?.key === key) window.sessionStorage.removeItem(storageKey);
  } catch {
    // Session storage can be unavailable in private browsing; the request remains safe server-side.
  }
}
const MINIMUM_DEPOSIT = 35;
const MINIMUM_WITHDRAWAL = 35;
const PROMO_MINI_NAME = "PROMO MINI PLAN";
const PROMO_MEGA_NAME = "PROMO MEGA PLAN";
const PROMO_MINIMUM = 1000;
const PROMO_THRESHOLD = 5000;

function getPromoPackageTerms(name) {
  const normalizedName = String(name || "").trim().toUpperCase();
  if (normalizedName === PROMO_MINI_NAME) {
    return { name: PROMO_MINI_NAME, minimum: PROMO_MINIMUM, maximum: PROMO_THRESHOLD - 0.01, profitPercent: 100 };
  }
  if (normalizedName === PROMO_MEGA_NAME) {
    return { name: PROMO_MEGA_NAME, minimum: PROMO_THRESHOLD, maximum: null, profitPercent: 500 };
  }
  return null;
}

function getPromoTierForAmount(amount) {
  if (!Number.isFinite(amount) || amount < PROMO_MINIMUM) return null;
  return amount >= PROMO_THRESHOLD ? PROMO_MEGA_NAME : PROMO_MINI_NAME;
}

function packageDailyRate(item) {
  if (getPromoPackageTerms(item?.name || item?.title)) return null;
  const namedRate = String(item?.name || item?.title || "").match(/^\s*(\d+(?:\.\d+)?)\s*%\s*Daily\s+for\s+14\s+Days\s*$/i);
  const configuredRate = Number(item?.returnRate ?? item?.rate);
  const rate = namedRate ? Number(namedRate[1]) : configuredRate;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function transactionCategory(transaction) {
  const type = String(transaction.type || "").toLowerCase();
  if (["admin-adjustment", "promotional-credit"].includes(transaction.category)
    && !(transaction.category === "promotional-credit" && type.includes("referral"))) {
    return "other";
  }
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

function referralRewardDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Date unavailable";
}

function referralRewardTone(status) {
  const tones = {
    pending: "border-amber-200 bg-amber-50 text-amber-900",
    promotional: "border-blue-200 bg-blue-50 text-blue-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    paid: "border-slate-200 bg-slate-100 text-slate-700",
    completed: "border-slate-200 bg-slate-100 text-slate-700",
    complete: "border-slate-200 bg-slate-100 text-slate-700",
    settled: "border-slate-200 bg-slate-100 text-slate-700",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return tones[normalizeReferralRewardStatus(status)] || "border-slate-200 bg-slate-100 text-slate-700";
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
    <div className="border-b border-slate-200 bg-slate-50/60 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
            Find past activity
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Date filters cover loaded account activity. Load older entries below to continue further back.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 text-xs font-semibold text-slate-600">
            From
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              aria-label="Start date"
              className="mt-2 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 font-sans text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-600 hover:border-blue-200 focus:border-blue-600 [color-scheme:light] sm:w-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600">
            To
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              aria-label="End date"
              className="mt-2 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 font-sans text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-600 hover:border-blue-200 focus:border-blue-600 [color-scheme:light] sm:w-40 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
            />
          </label>
          <button
            type="button"
            onClick={onReset}
            disabled={!fromDate && !toDate}
            className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700 transition hover:border-blue-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear dates
          </button>
        </div>
      </div>
      {invalidRange && (
        <p className="mt-3 text-xs text-amber-800" role="alert">
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
      <div className="flex items-center gap-3 text-sm text-slate-600">
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
            className="rounded-2xl border border-slate-200 bg-white p-6"
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
        className="rounded-2xl border border-slate-200 bg-white p-6"
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
  const [olderTransactions, setOlderTransactions] = useState([]);
  const [historyCursor, setHistoryCursor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [message, setMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const firstMobileLinkRef = useRef(null);
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState("");

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

  useEffect(() => {
    if (pathname !== "/deposit") return undefined;
    let active = true;
    setPackagesLoading(true);
    setPackagesError("");
    const loadPackages = (forceRefresh = false) => getInvestmentPackages({ forceRefresh })
      .then((items) => {
        if (!active) return;
        const normalized = items.map((item) => {
          const name = String(item.name || item.title || item.id);
          const promoTerms = getPromoPackageTerms(name);
          return {
            ...item,
            name,
            rate: packageDailyRate(item),
            minimum: promoTerms ? promoTerms.minimum : item.minimum ?? null,
            maximum: promoTerms ? promoTerms.maximum : item.maximum ?? null,
            duration: promoTerms ? "24 Hours" : item.duration || "",
          };
        });
        setPackages(normalized);
        setSelectedPackage((current) => normalized.some((item) => item.id === current) ? current : normalized[0]?.id || "");
      })
      .catch(() => active && setPackagesError("Investment packages could not be loaded. Please try again later."))
      .finally(() => active && setPackagesLoading(false));
    void loadPackages();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPackages(true);
    }, 60000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadPackages(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname]);
  const [selectedPackage, setSelectedPackage] = useState("");
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

  useEffect(() => {
    setOlderTransactions([]);
    setHistoryCursor(summary.transactionCursor || null);
    setHistoryError("");
  }, [user?.uid, summary.transactionCursor, summary.transactions]);

  const memberTransactions = [...(summary.transactions || []), ...olderTransactions];

  const manuallySelectedPlan = packages.find((item) => item.id === selectedPackage) || packages[0] || null;
  const enteredDepositAmount = Number(depositAmount);
  const amountSelectedPromoName = getPromoTierForAmount(enteredDepositAmount);
  const selectedPlan = getPromoPackageTerms(manuallySelectedPlan?.name) && amountSelectedPromoName
    ? packages.find((item) => item.name.trim().toUpperCase() === amountSelectedPromoName) || manuallySelectedPlan
    : manuallySelectedPlan;
  const selectedPromoTerms = getPromoPackageTerms(selectedPlan?.name);
  const promoCalculation = selectedPromoTerms ? getPromoTermsForAmount(enteredDepositAmount) : null;
  const requiredDepositMinimum = Math.max(
    MINIMUM_DEPOSIT,
    Number(selectedPlan?.minimum) || 0,
  );
  const selectedDepositAddress = depositWalletAddresses[selectedAsset] || "";
  const selectedWithdrawal =
    withdrawalAssets.find(([asset]) => asset === selectedAsset) ||
    withdrawalAssets[0];
  const [selectedWithdrawalAsset, selectedWithdrawalWalletField] =
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

  async function loadOlderTransactions() {
    if (historyLoading || !historyCursor?.hasMore) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const page = await loadOlderMemberHistory("transactions", historyCursor, user);
      setOlderTransactions((current) => [...current, ...(page.items || [])]);
      setHistoryCursor(page.nextCursor || null);
    } catch (error) {
      setHistoryError(error.message || "Older account activity could not be loaded.");
    } finally {
      setHistoryLoading(false);
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
    if (!profileSaved) return undefined;
    const timeoutId = window.setTimeout(() => setProfileSaved(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [profileSaved]);

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    if (!account.hasData) {
      setMessage("Your profile could not be verified. Reload account data before saving changes.");
      return;
    }
    if (!user)
      return setMessage(
        "Profile saving is unavailable until Firebase is configured.",
      );
    const formData = new FormData(event.currentTarget);
    const values = {
      fullName: formData.get("fullName")?.trim() || "",
      bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
      ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
      litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
    };
    if (!values.fullName) {
      setMessage("Full name is required.");
      return;
    }
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await updateUserProfile(user.uid, values);
      invalidateAccountData(user.uid);
      setProfile((current) => ({ ...current, ...values }));
      setProfileSaved(true);
    } catch (error) {
      const code = String(error?.code || "");
      setMessage(
        code.includes("permission-denied")
          ? "Firebase rejected the profile update. Refresh the page and try again; contact support if it keeps happening."
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
    if (!selectedPlan) {
      setMessage("There are no investment packages available right now.");
      return;
    }
    if (!selectedPromoTerms && !selectedPlan.rate) {
      setMessage("This package has no daily profit rate configured. Please choose another plan or contact support.");
      return;
    }
    const belowMinimum = amount < requiredDepositMinimum;
    const aboveMaximum = selectedPlan.maximum !== null && selectedPlan.maximum > 0 && amount > selectedPlan.maximum;
    if (!Number.isFinite(amount) || amount <= 0 || belowMinimum || aboveMaximum) {
      const minimumGuidance = `at least ${formatMoney(requiredDepositMinimum)}`;
      const maximumGuidance = selectedPlan.maximum !== null && selectedPlan.maximum > 0
        ? ` and no more than ${formatMoney(selectedPlan.maximum)}`
        : "";
      setMessage(`Enter ${minimumGuidance}${maximumGuidance}.`);
      return;
    }

    setDepositSubmitting(true);
    try {
      const request = await createMemberDepositRequest({
        packageId: selectedPlan.id,
        amount,
        method: selectedAsset,
      });
      let emailFailed = false;
      let emailFailureCode = "";
      try {
        await sendDepositPendingEmail(request.id);
      } catch (error) {
        emailFailed = true;
        emailFailureCode = error?.code || "deposit-email-failed";
      }
      setDepositAmount("");
      navigate("/deposit-pending", {
        replace: true,
        state: {
          packageName: selectedPlan.name,
          amount,
          asset: selectedAsset,
          requestId: request.id,
          emailFailed,
          emailFailureCode,
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
      if (!account.hasData) {
        setMessage("Your balance could not be verified. Reload account data before requesting a withdrawal.");
        return;
      }
      if (!user) {
        setMessage("Withdrawal requests are unavailable until Firebase is configured.");
        return;
      }

      const amount = Number(withdrawalAmount);
      const wallet = selectedWithdrawalWallet;

      if (!Number.isFinite(amount) || amount < MINIMUM_WITHDRAWAL) {
        setMessage(`The minimum withdrawal is ${formatMoney(MINIMUM_WITHDRAWAL)}.`);
        return;
      }
      if (amount > summary.withdrawalRequestableBalance) {
        setMessage(
          "The requested amount is greater than your withdrawable balance. Promotional credit cannot be withdrawn.",
        );
        return;
      }

      setWithdrawalSubmitting(true);
      try {
        const requestValues = { amount, method: selectedWithdrawalAsset, wallet };
        const idempotencyKey = await getWithdrawalIdempotencyKey(user.uid, requestValues);
        const request = await createWithdrawalRequest({ ...requestValues, idempotencyKey, email: user.email || "" });
        clearWithdrawalIdempotencyKey(user.uid, idempotencyKey);
        let emailFailed = false;
        let emailFailureCode = "";
        if (!request.idempotent) {
          try {
            await sendWithdrawalProcessingEmail(request.id);
          } catch (error) {
            emailFailed = true;
            emailFailureCode = error?.code || "email-delivery-failed";
          }
        }
        navigate("/withdrawal-pending", {
          replace: true,
          state: {
            amount,
            asset: selectedWithdrawalAsset,
            wallet,
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
    <div className="member-portal min-h-screen bg-slate-50 text-slate-900">
      <SkipToContent />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-transparent shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1360px,calc(100%_-_2rem))] items-center justify-between gap-4 py-3 sm:w-[min(1360px,calc(100%_-_3rem))]">
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
            Meridian<span className="text-blue-700">Vests</span>
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
                className="grid h-10 w-10 place-items-center rounded-full border border-blue-200 text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
              >
                {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
              {mobileMenuOpen && (
                <nav
                  id="member-portal-menu"
                  className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
                >
                {navigation.map(([label, href], index) => (
                  <Link
                    key={href}
                    to={href}
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    aria-current={pathname === href ? "page" : undefined}
                    className={`block rounded-lg px-3 py-3 text-sm transition hover:bg-blue-50 hover:text-blue-700 ${pathname === href ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700"}`}
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
              className="grid h-10 w-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-slate-700 transition hover:border-rose-300/50 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-[min(1360px,calc(100%_-_2rem))] gap-5 py-5 sm:w-[min(1360px,calc(100%_-_3rem))] lg:grid-cols-[200px_1fr]">
        <aside className="hidden self-start rounded-lg border border-slate-200 bg-white p-2.5 lg:sticky lg:top-20 lg:block">
          <p className="px-3 pb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-600">
            Member portal
          </p>
          <nav className="grid gap-1 text-sm">
            {navigation.map(([label, href]) => (
              <Link
                key={href}
                to={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`rounded-md px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700 ${pathname === href ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main-content" tabIndex="-1" className="min-w-0 outline-none">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">
            Member portal
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">
            {title}
          </h1>
          {accountError && !accountLoading && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
              <p>{accountError}{account.hasData && account.stale ? " Values below are from your last successful refresh." : ""}</p>
              <button
                type="button"
                onClick={() => account.refresh()}
                disabled={accountLoading}
                className="mt-3 min-h-10 rounded-lg border border-rose-300 bg-white px-4 py-2 font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
              >
                Retry account data
              </button>
            </div>
          )}
          {message && !accountLoading && (
            <FeedbackMessage className="mt-4" type="warning" variant="light">{message}</FeedbackMessage>
          )}
          {accountLoading ? (
            <AccountPageSkeleton />
          ) : (
            <>
          {pathname === "/deposit" && (
            <section className="mt-6 max-w-3xl">
              <form
                onSubmit={submitDepositRequest}
                className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
              >
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedPromoTerms ? "Request a promotional deposit" : "Fund your account"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {selectedPromoTerms
                    ? "Choose a promotional plan and submit your deposit request. The 24-hour term starts when an administrator confirms the payment."
                    : "Enter an amount, choose how to pay and select a plan. Your request is reviewed before your balance is updated."}
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Amount (USD)
                  <input
                    type="number"
                    min={requiredDepositMinimum}
                    max={selectedPlan?.maximum > 0 ? selectedPlan.maximum : undefined}
                    step="0.01"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder={formatMoney(requiredDepositMinimum)}
                    required
                    disabled={!selectedPlan || packagesLoading}
                    className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 transition focus:border-blue-600 focus:outline-none"
                  />
                  <span className="mt-1.5 block text-xs text-slate-500">
                    Minimum deposit: {formatMoney(requiredDepositMinimum)}{selectedPlan?.maximum > 0 ? ` · Maximum: ${formatMoney(selectedPlan.maximum)}` : ""}
                  </span>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  How would you like to pay?
                  <div className="relative mt-2">
                    <select
                      value={selectedAsset}
                      onChange={handleDepositAssetChange}
                      className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-11 text-sm text-slate-800 outline-none transition hover:border-blue-200 focus:border-blue-600 [color-scheme:light]"
                    >
                      {depositAssets.map((asset) => (
                        <option key={asset} className="bg-white text-slate-900">
                          {asset}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-700"
                    />
                  </div>
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                  Select investment plan
                  <div className="relative mt-2">
                    <select
                      value={selectedPlan?.id || ""}
                      onChange={(event) => setSelectedPackage(event.target.value)}
                      disabled={packagesLoading || packages.length === 0}
                      aria-describedby="deposit-plan-details"
                      className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-11 text-sm text-slate-800 outline-none transition hover:border-blue-200 focus:border-blue-600 disabled:opacity-60 [color-scheme:light]"
                    >
                      {packagesLoading ? <option value="">Loading plans…</option> : packages.length ? packages.map((item) => (
                        <option key={item.id} value={item.id} className="bg-white text-slate-900">{item.name}</option>
                      )) : <option value="">No plans available</option>}
                    </select>
                    <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-700" />
                  </div>
                  {packagesError && <span role="alert" className="mt-2 block text-xs text-rose-700">{packagesError}</span>}
                  {selectedPlan && !selectedPlan.rate && !selectedPromoTerms && <span role="status" className="mt-2 block text-xs text-amber-800">This plan needs a daily profit rate in the admin package catalog before deposits can be accepted.</span>}
                  {selectedPlan && !selectedPromoTerms && selectedPlan.rate && <span className="mt-1 block text-xs text-slate-600">Daily profit is calculated on the original deposit amount without compounding, and unlocks at maturity.</span>}
                  {selectedPlan && <span id="deposit-plan-details" className="mt-2 block text-xs text-slate-600">
                    {selectedPromoTerms ? "24-hour calculation preview · amount determines promo tier" : [selectedPlan.rate ? `${selectedPlan.rate}% daily profit` : null, selectedPlan.duration, "profit unlocks at maturity"].filter(Boolean).join(" · ") || "Package terms are subject to review."}
                  </span>}
                </label>
                {selectedPromoTerms && (
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:col-span-2" aria-label="Promotional calculation preview">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">24-hour promotional calculation</h3>
                      <span className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">24-hour term</span>
                    </div>
                    {promoCalculation ? (
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <div><dt className="text-xs text-slate-600">Promotion</dt><dd className="mt-1 font-semibold text-slate-900">{selectedPromoTerms.name === PROMO_MEGA_NAME ? "Mega · 500% profit" : "Mini · 100% profit"}</dd></div>
                        <div><dt className="text-xs text-slate-600">Projected profit</dt><dd className="mt-1 font-semibold text-amber-900">{formatMoney(promoCalculation.profit)}</dd></div>
                        <div><dt className="text-xs text-slate-600">Projected total at maturity</dt><dd className="mt-1 font-semibold text-slate-900">{formatMoney(promoCalculation.total)}</dd></div>
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm text-slate-700">Enter at least {formatMoney(PROMO_MINIMUM)} to see projected values. Amounts from {formatMoney(PROMO_THRESHOLD)} route to Mega.</p>
                    )}
                  </section>
                )}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {selectedAsset} wallet address
                      </p>
                      <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-900 sm:text-sm">
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
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
                  <p className="mt-2 text-xs leading-5 text-slate-600">Send only {selectedAsset} to this address. Check the network and address carefully before sending.</p>
                </div>
                </div>
                  <button
                    type="submit"
                    disabled={depositSubmitting || !selectedPlan || (!selectedPromoTerms && !selectedPlan.rate) || packagesLoading}
                    className="mt-5 h-11 w-full rounded-lg bg-gradient-to-r from-sky-400 to-cyan-300 px-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-950 transition hover:shadow-[0_12px_28px_rgba(34,211,238,0.18)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-48"
                  >
                    {depositSubmitting ? (
                      <>
                        <LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" />
                        Submitting...
                      </>
                    ) : (
                      "Make deposit request"
                    )}
                  </button>
              </form>

            </section>
          )}
          {pathname === "/withdraw" && (
            <section className="mt-8 space-y-6">
              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-sky-400/15 via-white to-blue-50 p-5 sm:p-6">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-700">
                  Secure withdrawal review
                </p>
                <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-xl font-bold tracking-[-0.04em] text-slate-900 sm:text-2xl">
                      Withdraw with confidence.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                      Submit a withdrawal request for review. Payouts are arranged
                      offline, so a wallet address is optional.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg border border-slate-200 bg-blue-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      Withdrawable balance
                    </p>
                    <p className="mt-1 font-sans text-2xl font-semibold tracking-[-0.05em] text-slate-900">
                      {account.hasData ? formatMoney(summary.withdrawalRequestableBalance) : "Unavailable"}
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={submitWithdrawalRequest}
                className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:grid-cols-[1fr_0.9fr]"
              >
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
                    01 / Withdrawal details
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">
                    Withdrawal details
                  </h2>
                  <label className="mt-6 block text-sm text-slate-700">
                    Withdrawal asset
                    <div className="relative mt-2">
                      <select
                        value={selectedAsset}
                        onChange={(event) => setSelectedAsset(event.target.value)}
                        className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-11 text-sm text-slate-800 shadow-sm outline-none transition hover:border-blue-200 focus:border-blue-600 [color-scheme:light]"
                      >
                        {withdrawalAssets.map(([asset]) => (
                          <option key={asset} className="bg-white text-slate-900">
                            {asset}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-blue-700"
                      />
                    </div>
                  </label>
                  <label className="mt-4 block text-sm text-slate-700">
                    Amount (USD)
                    <input
                      id="withdrawal-amount"
                      type="number"
                      min={MINIMUM_WITHDRAWAL}
                      max={account.hasData ? summary.withdrawalRequestableBalance : undefined}
                      step="0.01"
                      value={withdrawalAmount}
                      onChange={(event) => setWithdrawalAmount(event.target.value)}
                      placeholder="0.00"
                      aria-describedby="withdrawal-amount-help"
                      aria-invalid={
                        withdrawalAmount !== "" &&
                        (!Number.isFinite(Number(withdrawalAmount)) ||
                          Number(withdrawalAmount) < MINIMUM_WITHDRAWAL ||
                          (account.hasData && Number(withdrawalAmount) > summary.withdrawalRequestableBalance))
                      }
                      required
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <span id="withdrawal-amount-help" className="mt-2 block text-xs font-normal normal-case tracking-normal text-slate-500">
                      Minimum withdrawal: {formatMoney(MINIMUM_WITHDRAWAL)} · Available for a new request: {account.hasData ? formatMoney(summary.withdrawalRequestableBalance) : "Unavailable until account data loads"}
                    </span>
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
                    02 / Review
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">
                    Request summary
                  </h2>
                  <dl className="mt-6 space-y-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Asset</dt>
                      <dd className="font-bold text-slate-900">{selectedWithdrawalAsset}</dd>
                    </div>
                    <div className="space-y-2">
                      <dt className="text-slate-500">Optional wallet address</dt>
                      <dd className="break-all font-sans text-xs leading-5 text-slate-900">
                        {selectedWithdrawalWallet || "No wallet provided — payout will be arranged offline"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-4">
                      <dt className="text-slate-500">You request</dt>
                      <dd className="font-sans font-semibold text-blue-700">
                        {formatMoney(Number(withdrawalAmount) || 0)}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="submit"
                    disabled={
                      withdrawalSubmitting ||
                      !account.hasData ||
                      summary.withdrawalRequestableBalance <= 0
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
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-blue-50 p-5 text-sm text-slate-600 sm:flex-row sm:items-center">
                <span>Need help with a wallet or network?</span>
                <div className="flex flex-wrap items-center gap-4">
                  <Link to="/support" className="font-bold text-blue-700 hover:text-blue-700">
                    Contact support →
                  </Link>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-green-800 hover:text-green-800">
                    <WhatsAppIcon size={15} /> WhatsApp
                  </a>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="p-5 sm:p-6">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-700">
                    Withdrawal history
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">
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
                    memberTransactions.filter(
                      (item) => transactionCategory(item) === "withdrawal",
                    ),
                    withdrawalFromDate,
                    withdrawalToDate,
                  );

                  return !account.hasData ? (
                    <p className="px-5 py-8 text-center text-sm text-amber-900" role="status">Withdrawal history is unavailable until account data loads successfully.</p>
                  ) : withdrawals.length ? (
                    <div className="divide-y divide-white/5">
                      {withdrawals.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {formatTransactionType(item.type, "Withdrawal")}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {transactionDate(item)} · {transactionStatus(item)}
                            </p>
                          </div>
                          <p className="font-sans font-semibold text-slate-900">
                            −{formatMoney(item.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center sm:px-6">
                      <p className="text-sm text-slate-600">
                        {historyCursor?.hasMore
                          ? "No withdrawals match in the records loaded so far. Load older activity to check the rest of your history."
                          : "No withdrawals match the selected date range."}
                      </p>
                    </div>
                  );
                })()}
                {historyError && <p className="border-t border-slate-100 p-4 text-center text-sm text-rose-700" role="alert">{historyError}</p>}
                {historyCursor?.hasMore && <div className="border-t border-slate-100 p-4 text-center"><button type="button" onClick={loadOlderTransactions} disabled={historyLoading} className="min-h-11 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-800 disabled:opacity-60">{historyLoading ? "Loading older activity…" : "Load older withdrawal history"}</button></div>}
              </div>
            </section>
          )}
          {pathname === "/profile" && (
            <>
              <section className="mt-8 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-sky-400/10 via-white to-blue-50">
                {!account.hasData && <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900" role="status">Profile fields are unavailable until your account data loads successfully.</p>}
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-400 text-xl font-extrabold text-slate-950">
                      {(profile.username || user?.displayName || "M")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">
                        Member identity
                      </p>
                      <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-900">
                        {profile.fullName || user?.displayName || "Your profile"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Your username is your permanent referral code.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-blue-50 px-4 py-3 sm:min-w-[210px]">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                      Username / referral code
                    </p>
                    <p className="mt-1 break-all text-lg font-bold text-blue-700">
                      {account.hasData ? profile.username || "Not set" : "Unavailable"}
                    </p>
                  </div>
                </div>
              </section>
              <form
                key={profile.username || user?.uid}
                onSubmit={saveProfile}
                className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
              >
                {[
                  ["fullName", "Full name", true],
                  ["phone", "Phone", false],
                  ["country", "Country", false],
                  ["litecoinWallet", "Litecoin wallet", true],
                  ["bitcoinWallet", "Bitcoin wallet", true],
                  ["ethereumWallet", "Ethereum wallet", true],
                ].map(([name, label, editable]) => (
                  <label key={name} className="text-sm text-slate-700">
                    <span className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      {!editable && <span className="text-xs font-medium text-slate-500">Read only</span>}
                    </span>
                    {editable ? (
                      <input
                        name={name}
                        defaultValue={profile[name] || ""}
                        disabled={!account.hasData}
                        autoComplete={name === "fullName" ? "name" : "off"}
                        required={name === "fullName"}
                        maxLength={name === "fullName" ? 120 : 200}
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-slate-900 shadow-sm outline-none transition hover:border-blue-300 focus:border-blue-600 focus:bg-blue-50"
                      />
                    ) : (
                      <div className="mt-2 flex min-h-12 items-center rounded-lg border border-slate-200 bg-slate-100 px-4 text-slate-600">
                        {account.hasData ? profile[name] || "Not provided" : "Unavailable"}
                      </div>
                    )}
                  </label>
                ))}
                <button
                  type="submit"
                  disabled={profileSaving || !account.hasData}
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
                    "Includes withdrawable funds and promotional credit",
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
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <p className="text-xs font-semibold text-slate-600">{label}</p>
                    <p className="mt-3 font-sans text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                      {account.hasData ? formatMoney(amount) : "Unavailable"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{caption}</p>
                  </article>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">
                      Account ledger
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">
                      Transaction history
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Completed activity posted to your account. Filters cover the records loaded so far.
                    </p>
                  </div>
                  <Link
                    to="/support"
                    className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 hover:text-blue-700"
                  >
                    Need help? Contact support
                  </Link>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-green-800 hover:text-green-800">
                    <WhatsAppIcon size={14} /> WhatsApp
                  </a>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4 sm:px-6">
                  {[
                    ["all", "All activity"],
                    ["deposit", "Deposits"],
                    ["withdrawal", "Withdrawals"],
                    ["earning", "Earnings"],
                    ["other", "Adjustments & bonuses"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTransactionFilter(value)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        transactionFilter === value
                          ? "border-sky-400 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"
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
                    memberTransactions.filter(
                      (item) =>
                        transactionFilter === "all" ||
                        transactionCategory(item) === transactionFilter,
                    ),
                    transactionFromDate,
                    transactionToDate,
                  );

                  return !account.hasData ? (
                    <div className="px-6 py-14 text-center" role="status">
                      <h3 className="font-semibold text-slate-900">Transaction data unavailable</h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">We could not confirm your transaction history. Retry account data before relying on balances or records.</p>
                    </div>
                  ) : filteredTransactions.length ? (
                    <div>
                      <div className="hidden grid-cols-[1.35fr_1fr_1fr_0.8fr] gap-4 border-b border-slate-200 px-6 py-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 sm:grid">
                          <span>Activity</span>
                          <span>Date</span>
                          <span>Status</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {filteredTransactions.map((item) => {
                          const category = transactionCategory(item);
                          const amountIsValid = hasStoredNonNegativeNumber(item.amount);
                          const isOutgoing = category === "withdrawal"
                            || Number(item.balanceDelta) < 0
                            || Number(item.bonusDelta) < 0;
                          const categoryLabel = item.category === "promotional-credit"
                            ? "Promotional credit"
                            : item.category === "admin-adjustment"
                              ? "Account adjustment"
                              : category;
                          const status = String(
                            item.status || "completed",
                          ).toLowerCase();
                          const statusClass =
                            ["completed", "complete", "approved", "settled", "success"].includes(
                              status,
                            )
                              ? "bg-emerald-400/10 text-emerald-800"
                              : status === "pending"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-slate-400/10 text-slate-700";

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-slate-100 bg-slate-50 px-4 py-4 text-sm last:border-0 sm:grid-cols-[1.35fr_1fr_1fr_0.8fr] sm:gap-4 sm:bg-transparent sm:px-6"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {formatTransactionType(item.type, "Account activity")}
                                </p>
                                <p className="mt-1 text-xs capitalize text-slate-500">
                                  {categoryLabel}
                                  {item.currency ? ` · ${item.currency}` : ""}
                                </p>
                              </div>
                              <span className="order-3 self-center text-xs text-slate-600 sm:order-none sm:text-sm">
                                {transactionDate(item)}
                              </span>
                              <span className="order-4 self-center sm:order-none">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                  {transactionStatus(item)}
                                </span>
                              </span>
                              <span className={`order-2 self-center text-right font-bold sm:order-none ${!amountIsValid ? "text-slate-500" : isOutgoing ? "text-slate-900" : "text-emerald-800"}`}>
                                {amountIsValid ? isOutgoing ? "−" : "+" : ""}
                                {formatMoney(item.amount)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="px-6 py-14 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-xl text-blue-700">
                        —
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-900">
                        {historyCursor?.hasMore
                          ? `No matching ${transactionFilter === "all" ? "" : `${transactionFilter} `}transactions in the activity loaded so far`
                          : `No ${transactionFilter === "all" ? "" : `${transactionFilter} `}transactions yet`}
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
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

              <div className="flex flex-col items-center gap-3 py-5">
                {historyError && <p className="text-sm font-medium text-rose-700" role="alert">{historyError}</p>}
                {historyCursor?.hasMore ? (
                  <button
                    type="button"
                    onClick={loadOlderTransactions}
                    disabled={historyLoading}
                    className="min-h-11 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-800 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {historyLoading ? "Loading older activity…" : "Load older transaction history"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-500">All account activity has been loaded.</p>
                )}
              </div>

              <div className="rounded-xl border border-sky-400/15 bg-blue-50 p-5 text-sm leading-6 text-slate-700">
                <strong className="text-slate-900">Ledger note:</strong> Transaction
                history reflects entries confirmed by MeridianVests. Pending
                deposit and withdrawal requests are reviewed separately and do
                not change your balance until approved.
              </div>
            </section>
          )}
          {pathname === "/referral" && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-sky-400/10 via-white to-blue-50 p-6 sm:p-8">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">
                Referral center
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-900">
                Invite with your username
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Share this link so new members arrive with your username
                automatically filled in on the signup form.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Your referral username</p>
                  <p className="mt-2 break-all text-lg font-bold text-blue-700">
                    {account.hasData ? profile.username || "Not set" : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Verified referrals</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {account.hasData ? summary.referralCount : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Referral credit</p>
                  <p className="mt-2 text-lg font-bold text-blue-800">
                    {account.hasData ? formatMoney(summary.referralCredit) : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-blue-50 p-4">
                  <p className="text-xs text-slate-500">Total promotional credit</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {account.hasData ? formatMoney(summary.promotionalCredit) : "Unavailable"}
                  </p>
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-blue-100 bg-white/80 p-4 text-sm leading-6 text-slate-600">
                A referral counts after the new member verifies their email and signs in. The $5 referral credit is promotional, is included in your total promotional credit, and is not withdrawable.
              </p>
              <div className="mt-7">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Recent referral activity</h3>
                    <p className="mt-1 text-sm text-slate-600">The most recent verification and credit status updates for members who used your referral link.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{account.hasData ? `${summary.referralRewardItems.length} records` : "Unavailable"}</span>
                </div>
                {!account.hasData ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Referral activity could not be loaded. Retry account data before relying on these totals.</p>
                ) : summary.referralRewardItems.length ? (
                  <ul className="mt-3 divide-y divide-blue-100 overflow-hidden rounded-xl border border-blue-100 bg-white">
                    {summary.referralRewardItems.map((reward) => (
                      <li key={reward.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {reward.referredUsername || "Referred member"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{referralRewardDate(reward.creditedAt || reward.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900">{formatMoney(reward.amount)}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${referralRewardTone(reward.status)}`}>
                            {referralRewardStatusLabel(reward.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-600">No referrals have been attributed to your username yet.</p>
                )}
              </div>
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
