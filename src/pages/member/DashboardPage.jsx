import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Copy, LogOut, Menu, Sparkles, TrendingUp, WalletCards, X } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { loadOlderMemberHistory } from "../../lib/firebaseData";
import useAccountData from "../../lib/useAccountData";
import { buildEmptyFinancialSummary, formatMoney, formatTransactionType } from "../../lib/financial";
import { hasStoredNonNegativeNumber } from "../../lib/financialMath";
import { getInvestmentPackages } from "../../lib/packageCatalog";
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

const COMPLETED_INVESTMENT_STATUSES = new Set(["completed", "complete", "settled", "matured"]);

function getPackageRate(item) {
  const configured = item.returnRate ?? item.rate;
  if (configured !== null && configured !== undefined) return configured;
  return String(item.name || item.title || "").match(/^\s*(\d+(?:\.\d+)?)\s*%\s*Daily\s+for\s+14\s+Days\s*$/i)?.[1] ?? null;
}

export default function DashboardPage() {
  const { user, signOutUser } = useAuth();
  const account = useAccountData();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [investmentPackages, setInvestmentPackages] = useState(null);
  const [packageError, setPackageError] = useState("");
  const [olderInvestments, setOlderInvestments] = useState([]);
  const [investmentCursor, setInvestmentCursor] = useState(null);
  const [investmentHistoryLoading, setInvestmentHistoryLoading] = useState(false);
  const [investmentHistoryError, setInvestmentHistoryError] = useState("");
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const firstMobileLinkRef = useRef(null);

  const loading = account.loading;
  const accountError = account.error;
  const profile =
    Object.keys(account.profile).length > 0
      ? account.profile
      : user
        ? { fullName: user.displayName || "" }
        : null;
  const summary = account?.summary || buildEmptyFinancialSummary();
  const displayMoney = (value) => account.hasData ? formatMoney(value) : "Unavailable";
  const investmentHistory = [...(summary.investments || []), ...olderInvestments];
  const completedInvestments = investmentHistory.filter((investment) =>
    COMPLETED_INVESTMENT_STATUSES.has(String(investment.status || "").toLowerCase()),
  );
  const activeInvestments = investmentHistory.filter((investment) =>
    String(investment.status || "").toLowerCase() === "active",
  );
  useEffect(() => {
    setOlderInvestments([]);
    setInvestmentCursor(summary.investmentCursor || null);
    setInvestmentHistoryError("");
  }, [user?.uid, summary.investmentCursor, summary.investments]);
  useEffect(() => {
    let active = true;
    const loadPackages = (forceRefresh = false) => getInvestmentPackages({ forceRefresh })
      .then((items) => active && setInvestmentPackages(items))
      .catch(() => active && setPackageError("Investment packages are unavailable right now."));
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
  }, []);
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
  }, [location.pathname]);

  const displayName =
    profile?.fullName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Member";
  const referralLink = profile?.username
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(profile.username)}`
    : "";

  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setMessage("Copying is unavailable. Select the referral link manually.");
    }
  }

  async function loadOlderInvestments() {
    if (investmentHistoryLoading || !investmentCursor?.hasMore) return;
    setInvestmentHistoryLoading(true);
    setInvestmentHistoryError("");
    try {
      const page = await loadOlderMemberHistory("investments", investmentCursor, user);
      setOlderInvestments((current) => [...current, ...(page.items || [])]);
      setInvestmentCursor(page.nextCursor || null);
    } catch (error) {
      setInvestmentHistoryError(error.message || "Older investments could not be loaded.");
    } finally {
      setInvestmentHistoryLoading(false);
    }
  }

  async function handleSignOut() {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="member-portal dashboard-font min-h-screen bg-[radial-gradient(ellipse_at_top,_#eaf3ff,_#f7faff_38%,_#f1f5f9)] text-slate-900">
      <SkipToContent />
      <header className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/90 shadow-sm shadow-blue-950/5 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1440px,calc(100%_-_2rem))] items-center justify-between gap-4 py-3.5 sm:w-[min(1440px,calc(100%_-_3rem))]">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 text-xl font-extrabold tracking-[-0.04em] text-slate-900"
          >
            <img
              className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-blue-100"
              src="/meridianvest-logo.svg"
              alt="MeridianVests logo"
              width="36"
              height="36"
            />
            Meridian<span className="text-blue-600">Vests</span>
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
                className="grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
              >
                {mobileMenuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
              {mobileMenuOpen && (
                <nav
                  id="member-portal-menu"
                  className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-blue-100 bg-white p-2 shadow-xl shadow-blue-950/10"
                >
                {navigation.map(([label, href], index) => (
                  <Link
                    key={href}
                    to={href}
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    aria-current={location.pathname === href ? "page" : undefined}
                    className={`block rounded-xl px-3 py-3 text-sm transition hover:bg-blue-50 hover:text-blue-700 ${location.pathname === href ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600"}`}
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
              onClick={handleSignOut}
              className="grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-[min(1440px,calc(100%_-_2rem))] gap-6 py-6 sm:w-[min(1440px,calc(100%_-_3rem))] lg:grid-cols-[240px_1fr]">
        <aside className="hidden self-start rounded-2xl border border-blue-100 bg-white p-3 shadow-sm shadow-blue-950/[0.04] lg:sticky lg:top-24 lg:block">
          <div className="mb-3 flex items-center gap-2 border-b border-blue-50 px-3 pb-4 pt-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700"><WalletCards size={17} /></span>
            <div><p className="text-xs font-bold text-slate-800">Member portal</p><p className="mt-0.5 text-[10px] text-slate-400">Your account space</p></div>
          </div>
          <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Navigation</p>
          <nav className="grid gap-1 text-sm">
            {navigation.map(([label, href]) => (
              <Link
                key={href}
                to={href}
                aria-current={location.pathname === href ? "page" : undefined}
                className={`rounded-xl px-3 py-2.5 font-medium transition hover:bg-blue-50 hover:text-blue-700 ${location.pathname === href ? "bg-blue-600 font-semibold text-white shadow-md shadow-blue-200" : "text-slate-600"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main-content" tabIndex="-1" className="min-w-0 outline-none" aria-busy={loading}>
          <section className="relative isolate mt-1 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 px-6 py-7 text-white shadow-xl shadow-blue-900/15 sm:px-9 sm:py-9">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 -z-10 h-72 w-72 rounded-full border-[34px] border-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-44 -z-10 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-50">
                  <Sparkles size={13} aria-hidden="true" /> Member overview
                </div>
                <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Welcome back, {displayName}.</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50/90 sm:text-base">Your account activity, investments, and available balance in one clear view.</p>
              </div>
              <Link to="/deposit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg shadow-blue-950/10 transition hover:-translate-y-0.5 hover:bg-blue-50">
                Make a deposit <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </section>
          {message && <FeedbackMessage className="mt-6" type="warning" variant="light">{message}</FeedbackMessage>}
          {accountError && (
            <div className="mt-6 space-y-2">
              <FeedbackMessage type="error" variant="light">
                {accountError}{account.hasData && account.stale ? " Values below are from your last successful refresh." : ""}
              </FeedbackMessage>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => account.refresh()}
                  disabled={loading}
                  className="inline-flex min-h-10 items-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Retrying…" : "Try again"}
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <section
              className="mt-6 space-y-5"
              role="status"
              aria-label="Loading your account"
            >
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span
                  className="motion-safe:animate-pulse h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.8)]"
                  aria-hidden="true"
                />
                Preparing your account overview...
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
                    aria-hidden="true"
                  >
                    <div className="motion-safe:animate-pulse h-3 w-28 rounded-full bg-blue-100" />
                    <div className="motion-safe:animate-pulse mt-5 h-8 w-32 rounded-md bg-blue-100" />
                    <div className="motion-safe:animate-pulse mt-3 h-3 w-36 rounded-full bg-blue-50" />
                  </div>
                ))}
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div
                  className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
                  aria-hidden="true"
                >
                  <div className="motion-safe:animate-pulse h-5 w-40 rounded-full bg-blue-100" />
                  <div className="mt-7 grid grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item}>
                        <div className="motion-safe:animate-pulse h-3 w-24 rounded-full bg-blue-100" />
                        <div className="motion-safe:animate-pulse mt-3 h-6 w-28 rounded-md bg-blue-50" />
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
                  aria-hidden="true"
                >
                  <div className="motion-safe:animate-pulse h-5 w-44 rounded-full bg-blue-100" />
                  <div className="motion-safe:animate-pulse mt-4 h-3 w-full rounded-full bg-blue-50" />
                  <div className="motion-safe:animate-pulse mt-2 h-3 w-4/5 rounded-full bg-blue-50" />
                  <div className="motion-safe:animate-pulse mt-6 h-11 w-full rounded-md bg-blue-100" />
                </div>
              </div>
              <div
                className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between">
                  <div className="motion-safe:animate-pulse h-5 w-44 rounded-full bg-blue-100" />
                  <div className="motion-safe:animate-pulse h-3 w-16 rounded-full bg-blue-50" />
                </div>
                <div className="mt-5 space-y-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-4 border-b border-blue-50 pb-4"
                    >
                      <div className="motion-safe:animate-pulse h-4 w-32 rounded-full bg-blue-50" />
                      <div className="motion-safe:animate-pulse h-4 w-24 rounded-full bg-blue-50" />
                      <div className="motion-safe:animate-pulse hidden h-3 w-20 rounded-full bg-blue-50 sm:block" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              [
                "Available balance",
                summary.availableBalance,
                "Includes promotional credit; pending withdrawals remain until approved",
                WalletCards,
              ],
              [
                "Total deposit",
                summary.totalDeposit,
                "Completed deposits recorded on your account",
                ArrowDownLeft,
              ],
              [
                "Total withdrawal",
                summary.totalWithdrawal,
                "Completed ledger withdrawals",
                ArrowUpRight,
              ],
            ].map(([label, value, detail, Icon]) => {
              const featured = label === "Available balance";
              return (
                <article key={label} className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${featured ? "border-blue-700 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white shadow-blue-900/10 sm:col-span-2 xl:col-span-1" : "border-blue-100 bg-white text-slate-900 shadow-blue-950/[0.04]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold ${featured ? "text-blue-100" : "text-slate-500"}`}>{label}</p>
                      <p className={`mt-3 font-sans text-2xl font-bold tracking-[-0.04em] sm:text-[1.75rem] ${featured ? "text-white" : "text-slate-900"}`}>{displayMoney(value)}</p>
                    </div>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${featured ? "bg-white/15 text-white" : "bg-blue-50 text-blue-700"}`}><Icon size={19} aria-hidden="true" /></span>
                  </div>
                  <p className={`mt-2 max-w-xs text-[11px] leading-5 ${featured ? "text-blue-100" : "text-slate-500"}`}>{detail}</p>
                  {featured && <Link to="/withdraw" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-white/95 transition hover:text-white">Withdrawal options <ArrowRight size={14} /></Link>}
                </article>
              );
            })}
          </section>
          {!account.hasData && (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">Portfolio status</p>
              <h2 className="mt-1 text-lg font-bold">Investment information unavailable</h2>
              <p className="mt-2 text-sm leading-6">We could not confirm your active or completed investments. Retry account data before relying on portfolio totals.</p>
            </section>
          )}
          {account.hasData && activeInvestments.length > 0 && (
            <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6" aria-labelledby="member-investments-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Portfolio</p>
                  <h2 id="member-investments-title" className="mt-1 text-lg font-bold text-slate-900">Active investments</h2>
                  <p className="mt-1 text-xs text-slate-500">Track progress and maturity for your running plans.</p>
                </div>
                <Link to="/transactions" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50">View earnings <ArrowRight size={14} /></Link>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {activeInvestments.map((investment) => {
                  const durationDays = Math.max(Number(investment.durationDays) || 14, 1);
                  const elapsed = Math.min(Number(investment.accruedDays) || 0, durationDays);
                  const completed = investment.status === "completed";
                  const profitPercent = Number(investment.profitPercent) || 0;
                  const principalValid = hasStoredNonNegativeNumber(investment.principal);
                  const accruedProfitValid = hasStoredNonNegativeNumber(investment.accruedProfit);
                  const projectedProfit = profitPercent > 0
                    ? principalValid ? Math.round(Number(investment.principal) * profitPercent) / 100 : null
                    : accruedProfitValid ? Number(investment.accruedProfit) : elapsed === 0 ? 0 : null;
                  const dailyRateValid = hasStoredNonNegativeNumber(investment.dailyRate) && Number(investment.dailyRate) > 0;
                  const maturityValue = investment.maturesAt?.toDate?.() || new Date(investment.maturesAt || NaN);
                  const startValue = investment.startedAt?.toDate?.() || new Date(investment.startedAt || NaN);
                  const durationMs = maturityValue.getTime() - startValue.getTime();
                  const progress = completed
                    ? 100
                    : profitPercent > 0 && Number.isFinite(durationMs) && durationMs > 0
                      ? Math.max(0, Math.min(100, (Date.now() - startValue.getTime()) / durationMs * 100))
                      : elapsed / durationDays * 100;
                  const maturityLabel = Number.isNaN(maturityValue.getTime()) ? "Maturity date pending" : `Matures ${maturityValue.toLocaleString()}`;
                  return (
                    <article key={investment.id} className="rounded-xl border border-blue-100 bg-[#f9fbff] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{investment.packageName || "Investment package"}</h3>
                          <p className="mt-1 text-xs text-slate-500">Principal {formatMoney(investment.principal)} · {profitPercent > 0 ? `${profitPercent}% profit / ${investment.durationHours || durationDays * 24} hours` : dailyRateValid ? `${investment.dailyRate}% simple daily` : "Investment terms unavailable"}</p>
                          {profitPercent <= 0 && <p className="mt-1 text-[11px] text-slate-500">Calculated on the original principal without compounding; profit unlocks at maturity.</p>}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${completed ? "bg-blue-100 text-blue-800" : "bg-sky-50 text-sky-700"}`}>{completed ? "Matured" : "In progress"}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{completed ? "Profit credited" : profitPercent > 0 ? "Profit at maturity" : `Accrued profit · ${elapsed}/${durationDays} days`}</span>
                        <strong className="text-blue-700">{formatMoney(projectedProfit)}{completed ? " · available" : " · locked"}</strong>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className={`h-full w-[var(--investment-progress)] rounded-full transition-all ${completed ? "bg-blue-700" : "bg-gradient-to-r from-blue-600 to-sky-400"}`} style={{ "--investment-progress": `${progress}%` }} /></div>
                      <p className="mt-2 text-[11px] text-slate-500">{completed ? "Profit and principal are available in your balance." : maturityLabel}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {account.hasData && completedInvestments.length > 0 && (
            <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6" aria-labelledby="completed-investments-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Investment history</p>
                  <h2 id="completed-investments-title" className="mt-1 text-lg font-bold text-slate-900">Completed investments</h2>
                  <p className="mt-1 text-xs text-slate-500">Matured plans stay here after their principal and profit are credited.</p>
                </div>
                <Link to="/transactions" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50">View earnings <ArrowRight size={14} /></Link>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {completedInvestments.map((investment) => {
                  const principalValid = hasStoredNonNegativeNumber(investment.principal);
                  const profitValid = hasStoredNonNegativeNumber(investment.accruedProfit);
                  const totalReleased = principalValid && profitValid
                    ? Number(investment.principal) + Number(investment.accruedProfit)
                    : null;
                  const maturityValue = investment.maturedAt?.toDate?.()
                    || investment.maturesAt?.toDate?.()
                    || new Date(investment.maturedAt || investment.maturesAt || NaN);
                  const maturityLabel = Number.isNaN(maturityValue.getTime())
                    ? "Maturity date unavailable"
                    : maturityValue.toLocaleString();
                  return (
                    <article key={investment.id} className="rounded-xl border border-blue-100 bg-[#f9fbff] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{investment.packageName || "Investment package"}</h3>
                          <p className="mt-1 text-xs text-slate-500">Matured {maturityLabel}</p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">Completed</span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-blue-100 pt-3 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-slate-500">Principal</dt>
                          <dd className="mt-1 font-semibold text-slate-900">{formatMoney(investment.principal)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Profit credited</dt>
                          <dd className="mt-1 font-semibold text-blue-700">{formatMoney(investment.accruedProfit)}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <dt className="text-slate-500">Total released</dt>
                          <dd className="mt-1 font-semibold text-slate-900">{formatMoney(totalReleased)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {(investmentCursor?.hasMore || investmentHistoryError) && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {investmentHistoryError && <p className="text-sm text-rose-700" role="alert">{investmentHistoryError}</p>}
              {investmentCursor?.hasMore && (
                <button
                  type="button"
                  onClick={loadOlderInvestments}
                  disabled={investmentHistoryLoading}
                  className="min-h-11 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-800 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {investmentHistoryLoading ? "Loading older investments…" : "Load older investments"}
                </button>
              )}
            </div>
          )}
          <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6" aria-labelledby="available-packages-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Explore plans</p>
                <h2 id="available-packages-title" className="mt-1 text-xl font-bold text-slate-900">Available investment packages</h2>
                <p className="mt-1 text-sm text-slate-500">Review the active programs before you invest.</p>
              </div>
              <Link to="/deposit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">Choose a plan <ArrowRight size={14} /></Link>
            </div>
            {packageError ? <p role="status" className="mt-4 text-sm text-blue-800">{packageError}</p> : investmentPackages === null ? <p className="mt-4 text-sm text-slate-500">Loading available packages…</p> : investmentPackages.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {investmentPackages.map((item) => (
                  <article key={item.id} className="rounded-xl border border-blue-100 bg-[#f9fbff] p-4 transition hover:border-blue-200 hover:shadow-md hover:shadow-blue-950/[0.05]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">{item.name || item.title || "Investment package"}</h3>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700"><TrendingUp size={15} /></span>
                    </div>
                    {String(item.name || item.title || "").trim().toUpperCase() === "PROMO MINI PLAN"
                      ? <p className="mt-3 text-sm font-bold text-blue-700">100% profit after 24 hours</p>
                      : String(item.name || item.title || "").trim().toUpperCase() === "PROMO MEGA PLAN"
                        ? <p className="mt-3 text-sm font-bold text-blue-700">500% profit after 24 hours</p>
                        : getPackageRate(item) !== null && (
                          <>
                            <p className="mt-3 text-sm font-bold text-blue-700">{getPackageRate(item)}% simple daily profit</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">Calculated on the original investment; profit unlocks at maturity.</p>
                          </>
                        )}
                    <div className="mt-3 space-y-1 border-t border-blue-100 pt-3">
                      {item.minimum !== null && item.minimum !== undefined && <p className="text-xs text-slate-600">Minimum: <span className="font-semibold text-slate-800">{formatMoney(item.minimum)}</span></p>}
                      {item.maximum !== null && item.maximum !== undefined && <p className="text-xs text-slate-600">Maximum: <span className="font-semibold text-slate-800">{Number(item.maximum) > 0 ? formatMoney(item.maximum) : "No maximum"}</span></p>}
                      {item.duration ? <p className="text-xs text-slate-500">Duration: {item.duration}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">No investment packages are currently available.</p>}
          </section>
          {summary.promotionalCredit > 0 && (
            <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-blue-950">
              <h2 className="text-lg font-semibold text-blue-900">
                Referral promotion
              </h2>
              <p className="mt-2 text-sm leading-7 text-blue-800">
                You have {formatMoney(summary.promotionalCredit)} in
                promotional credit. This credit cannot be withdrawn. Purchase
                and complete a qualifying plan to become eligible to withdraw.
              </p>
            </section>
          )}
          {!account.hasData ? (
            <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6" aria-labelledby="member-requests-title">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Account activity</p>
              <h2 id="member-requests-title" className="mt-1 text-lg font-bold text-slate-900">Requests &amp; support</h2>
              <p className="mt-2 text-sm text-slate-600">Request status is unavailable because your account data could not be loaded.</p>
            </section>
          ) : summary.requests?.length > 0 && (
            <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6" aria-labelledby="member-requests-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Account activity</p>
                  <h2 id="member-requests-title" className="mt-1 text-lg font-bold text-slate-900">Requests & support</h2>
                  <p className="mt-1 text-xs text-slate-500">All open deposit and withdrawal requests, plus your recent support activity.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{summary.requests.length} recent</span>
              </div>
              <div className="mt-4 divide-y divide-blue-50">
                {summary.requests.slice(0, 6).map((request) => {
                  const status = String(request.status || "pending").toLowerCase();
                  const statusTone = ["rejected", "cancelled"].includes(status)
                    ? "bg-rose-50 text-rose-700"
                    : ["resolved", "closed", "approved"].includes(status)
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-800";
                  const dateValue = request.updatedAt?.toDate?.() || request.createdAt?.toDate?.() || new Date(request.updatedAt || request.createdAt || NaN);
                  const dateLabel = Number.isNaN(dateValue.getTime()) ? "Date unavailable" : dateValue.toLocaleDateString();
                  const title = request.requestType === "deposit"
                    ? `Deposit · ${request.plan || request.packageName || "Investment plan"}`
                    : request.requestType === "withdrawal"
                      ? `Withdrawal · ${request.method || request.asset || "Payout"}`
                      : `Support · ${request.subject || "Support request"}`;
                  return (
                    <div key={`${request.requestType}-${request.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
                        <p className="mt-1 text-xs text-slate-500">{dateLabel}{request.amount ? ` · ${formatMoney(request.amount)}` : ""}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusTone}`}>{status.replaceAll("-", " ")}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Account activity</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Earnings summary</h2>
                </div>
                <Link
                  to="/transactions"
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50"
                >
                  View transactions <ArrowRight size={14} />
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total earnings</p>
                  <p className="mt-2 font-sans text-xl font-bold text-slate-900">
                    {displayMoney(summary.totalEarnings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Last deposit</p>
                  <p className="mt-2 font-sans text-xl font-bold text-slate-900">
                    {displayMoney(summary.lastDeposit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Last withdrawal</p>
                  <p className="mt-2 font-sans text-xl font-bold text-slate-900">
                    {displayMoney(summary.lastWithdrawal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Recent transactions</p>
                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {account.hasData ? summary.transactions.length : "Unavailable"}
                  </p>
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Sparkles size={18} /></span>
              <h2 className="mt-3 text-lg font-bold text-slate-900">Invite your friends</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Share your referral link and track your member network.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  placeholder="Your referral link is preparing..."
                  className="min-w-0 flex-1 rounded-xl border border-blue-100 bg-[#f9fbff] px-3 py-3 text-xs text-slate-600 outline-none"
                />
                <button
                  type="button"
                  onClick={copyReferralLink}
                  disabled={!referralLink}
                  aria-label={copied ? "Referral link copied" : "Copy referral link"}
                  className={`grid min-h-11 min-w-12 place-items-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    copied ? "bg-blue-800" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {copied ? (
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
            </article>
          </section>

          <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm shadow-blue-950/[0.04] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Latest activity</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">Recent transactions</h2>
              </div>
              <Link to="/transactions" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900">See all <ArrowRight size={14} /></Link>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {account.hasData ? `${summary.transactions.length} found` : "Unavailable"}
              </span>
            </div>
            {!account.hasData ? (
              <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">Recent activity is unavailable until your account data loads.</p>
            ) : summary.transactions.length ? (
              <div className="mt-5 space-y-2">
                {summary.transactions.slice(0, 8).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="grid gap-1 border-b border-blue-50 py-3 text-sm text-slate-600 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-semibold text-slate-800">
                      {formatTransactionType(transaction.type)}
                    </span>
                    <span className="font-semibold text-blue-700">
                      {formatMoney(transaction.amount)}{" "}
                      {transaction.currency || "USD"}
                    </span>
                    <span className="text-xs text-slate-500 sm:text-right">
                      {transaction.date ||
                        transaction.createdAt
                          ?.toDate?.()
                          .toLocaleDateString?.() ||
                        "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Your recent deposits, withdrawals, and earnings will appear
                here.
              </p>
            )}
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
