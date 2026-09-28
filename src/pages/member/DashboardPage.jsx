import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, Copy, LogOut, Menu, TrendingDown, TrendingUp, X } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import useAccountData from "../../lib/useAccountData";
import { buildEmptyFinancialSummary, CRYPTO_SYMBOLS, formatMoney, formatTransactionType } from "../../lib/financial";
import { CHART_RANGES, CRYPTO_ASSETS, useCryptoChartData, useCryptoMarketData } from "../../lib/cryptoMarket";
import { getAssetAllocation, hasUsableMarketPrice, safeNumber } from "../../lib/cryptoUtils";
import { syncPaperTradingMarket } from "../../lib/firebaseData";
import CryptoPriceChart from "../../components/dashboard/CryptoPriceChart";
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

export default function DashboardPage() {
  const { user, signOutUser } = useAuth();
  const account = useAccountData();
  const refreshAccount = account.refresh;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [chartRange, setChartRange] = useState("1");
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const firstMobileLinkRef = useRef(null);
  const lastPaperTradingSyncRef = useRef(0);
  const marketData = useCryptoMarketData();
  const chartData = useCryptoChartData(selectedAsset, chartRange);

  const loading = account.loading;
  const accountError = account.error;
  const profile =
    Object.keys(account.profile).length > 0
      ? account.profile
      : user
        ? { fullName: user.displayName || "", username: user.displayName || "" }
        : null;
  const summary = account?.summary || buildEmptyFinancialSummary();
  const paperTrading = profile?.paperTrading;
  const depositCryptoCapital = Math.max(safeNumber(summary.totalDeposit, 0), 0);
  const depositCryptoAllocation = depositCryptoCapital / CRYPTO_SYMBOLS.length;
  const persistedPaperTradingProfit = safeNumber(profile?.paperTradingProfit, 0);
  const liveTradingValuation = useMemo(() => {
    let capital = 0;
    let currentValue = 0;
    let hasPosition = false;
    let stale = false;
    for (const asset of CRYPTO_ASSETS) {
      const depositAllocation = depositCryptoAllocation;
      const administratorAllocation = paperTrading?.enabled ? getAssetAllocation(paperTrading.allocations, asset.symbol) : 0;
      const allocation = depositAllocation + administratorAllocation;
      if (!allocation) continue;
      hasPosition = true;
      const liveAsset = marketData[asset.symbol];
      const livePrice = safeNumber(liveAsset?.price, 0);
      const entryPrice = safeNumber(paperTrading?.marketEntryPrices?.[asset.symbol], 0);
      if (!hasUsableMarketPrice(livePrice) || (administratorAllocation > 0 && !hasUsableMarketPrice(entryPrice))) {
        return { capital, currentValue, profit: persistedPaperTradingProfit, ready: false, stale: true };
      }
      capital += allocation;
      currentValue += depositAllocation + (administratorAllocation / entryPrice) * livePrice;
      stale = stale || liveAsset?.stale === true;
    }
    if (!hasPosition || stale) {
      return { capital, currentValue, profit: persistedPaperTradingProfit, ready: false, stale };
    }
    return { capital, currentValue, profit: currentValue - capital, ready: true, stale: false };
  }, [depositCryptoAllocation, marketData, paperTrading, persistedPaperTradingProfit]);
  const livePaperTradingProfit = liveTradingValuation.profit;
  const liveSummary = useMemo(() => {
    const profitDelta = liveTradingValuation.ready
      ? livePaperTradingProfit - persistedPaperTradingProfit
      : 0;
    return {
      ...summary,
      totalEarnings: summary.totalEarnings + profitDelta,
      availableBalance: Math.max(summary.availableBalance + profitDelta, 0),
    };
  }, [livePaperTradingProfit, liveTradingValuation.ready, persistedPaperTradingProfit, summary]);
  const assignedAssets = useMemo(
    () => (depositCryptoCapital > 0 || paperTrading?.enabled
      ? CRYPTO_ASSETS.filter((asset) => depositCryptoAllocation > 0 || Number(paperTrading?.allocations?.[asset.symbol]) > 0)
      : []),
    [depositCryptoAllocation, depositCryptoCapital, paperTrading],
  );
  const selectedAssetData = marketData[selectedAsset] || null;

  const simCapital = depositCryptoAllocation + (paperTrading?.enabled
    ? getAssetAllocation(paperTrading.allocations, selectedAsset)
    : 0);
  const selectedAssetMeta = CRYPTO_ASSETS.find((asset) => asset.symbol === selectedAsset) || CRYPTO_ASSETS[0];

  const positionMetrics = useMemo(() => {
    const livePrice = safeNumber(selectedAssetData?.price, 0);
    const administratorCapital = paperTrading?.enabled ? getAssetAllocation(paperTrading.allocations, selectedAsset) : 0;
    const administratorEntryPrice = safeNumber(paperTrading?.marketEntryPrices?.[selectedAsset], 0);
    const capital = simCapital;

    if (!hasUsableMarketPrice(livePrice) || (administratorCapital > 0 && !hasUsableMarketPrice(administratorEntryPrice))) {
      return {
        quantity: 0,
        currentValue: 0,
        pnl: 0,
        percentChange: 0,
        priceChange: 0,
      };
    }

    const depositQuantity = depositCryptoAllocation / livePrice;
    const administratorQuantity = administratorCapital > 0 ? administratorCapital / administratorEntryPrice : 0;
    const quantity = depositQuantity + administratorQuantity;
    const currentValue = depositCryptoAllocation + administratorQuantity * livePrice;
    const pnl = currentValue - capital;
    const priceChange = capital > 0 ? pnl / capital : 0;

    return {
      quantity,
      currentValue,
      pnl,
      percentChange: priceChange * 100,
      priceChange,
    };
  }, [depositCryptoAllocation, paperTrading, selectedAsset, selectedAssetData, simCapital]);

  const chartPoints = chartData.points.length > 0 ? chartData.points : selectedAssetData?.history || [];
  const priceTrend = chartPoints.length >= 2 ? chartPoints[chartPoints.length - 1].price - chartPoints[0].price : 0;
  const priceTrendPercent = chartPoints.length >= 2 && chartPoints[0].price > 0 ? (priceTrend / chartPoints[0].price) * 100 : 0;

  useEffect(() => {
    if (!paperTrading?.enabled) return undefined;
    const now = Date.now();
    if (now - lastPaperTradingSyncRef.current < 30000) return undefined;
    if (!Object.values(marketData).some((asset) => Number.isFinite(Number(asset?.price)) && Number(asset.price) > 0)) return undefined;
    lastPaperTradingSyncRef.current = now;
    let active = true;
    syncPaperTradingMarket()
      .then(() => {
      if (active) refreshAccount().catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [paperTrading?.enabled, marketData, refreshAccount]);

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

  useEffect(() => {
    if (assignedAssets.length && !assignedAssets.some((asset) => asset.symbol === selectedAsset)) {
      setSelectedAsset(assignedAssets[0].symbol);
    }
  }, [assignedAssets, selectedAsset]);

  const isMarketLoading = Object.values(marketData).some((asset) => asset?.loading);

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

  async function handleSignOut() {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard-font min-h-screen bg-[#07111d] text-white">
      <SkipToContent />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-transparent shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] items-center justify-between gap-4 py-4 sm:w-[min(1280px,calc(100%-3rem))]">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 text-xl font-extrabold tracking-[-0.04em]"
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
                    aria-current={location.pathname === href ? "page" : undefined}
                    className={`block rounded-lg px-3 py-3 text-sm transition hover:bg-white/10 hover:text-sky-400 ${location.pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"}`}
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
                aria-current={location.pathname === href ? "page" : undefined}
                className={`rounded-md px-3 py-3 transition hover:bg-white/10 hover:text-sky-400 ${location.pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="main-content" tabIndex="-1" className="min-w-0 outline-none" aria-busy={loading}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">
                Account summary
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                Welcome, {displayName}.
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Your verified member portal and account activity at a glance.
              </p>
            </div>
            <Link
              to="/deposit"
              className="inline-flex items-center justify-center rounded-md bg-yellow-300 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-950"
            >
              Invest now
            </Link>
          </div>
          {message && <FeedbackMessage className="mt-6" type="warning">{message}</FeedbackMessage>}
          {accountError && (
            <FeedbackMessage className="mt-6" type="error">
              {accountError}
            </FeedbackMessage>
          )}
          {loading ? (
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
                Preparing your account overview...
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-white/10 bg-[#0d1728] p-5"
                    aria-hidden="true"
                  >
                    <div className="motion-safe:animate-pulse h-3 w-28 rounded-full bg-slate-400/10" />
                    <div className="motion-safe:animate-pulse mt-5 h-8 w-32 rounded-md bg-slate-400/10" />
                    <div className="motion-safe:animate-pulse mt-3 h-3 w-36 rounded-full bg-slate-400/10" />
                  </div>
                ))}
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div
                  className="rounded-lg border border-white/10 bg-[#0d1728] p-6"
                  aria-hidden="true"
                >
                  <div className="motion-safe:animate-pulse h-5 w-40 rounded-full bg-slate-400/10" />
                  <div className="mt-7 grid grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item}>
                        <div className="motion-safe:animate-pulse h-3 w-24 rounded-full bg-slate-400/10" />
                        <div className="motion-safe:animate-pulse mt-3 h-6 w-28 rounded-md bg-slate-400/10" />
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="rounded-lg border border-white/10 bg-[#0d1728] p-6"
                  aria-hidden="true"
                >
                  <div className="motion-safe:animate-pulse h-5 w-44 rounded-full bg-slate-400/10" />
                  <div className="motion-safe:animate-pulse mt-4 h-3 w-full rounded-full bg-slate-400/10" />
                  <div className="motion-safe:animate-pulse mt-2 h-3 w-4/5 rounded-full bg-slate-400/10" />
                  <div className="motion-safe:animate-pulse mt-6 h-11 w-full rounded-md bg-slate-400/10" />
                </div>
              </div>
              <div
                className="rounded-lg border border-white/10 bg-[#0d1728] p-6"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between">
                  <div className="motion-safe:animate-pulse h-5 w-44 rounded-full bg-slate-400/10" />
                  <div className="motion-safe:animate-pulse h-3 w-16 rounded-full bg-slate-400/10" />
                </div>
                <div className="mt-5 space-y-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-4 border-b border-white/5 pb-4"
                    >
                      <div className="motion-safe:animate-pulse h-4 w-32 rounded-full bg-slate-400/10" />
                      <div className="motion-safe:animate-pulse h-4 w-24 rounded-full bg-slate-400/10" />
                      <div className="motion-safe:animate-pulse hidden h-3 w-20 rounded-full bg-slate-400/10 sm:block" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Available balance",
                liveSummary.availableBalance,
                liveTradingValuation.ready ? "Includes non-withdrawable crypto capital and live P/L" : "Includes non-withdrawable crypto capital and confirmed P/L",
              ],
              [
                "Total deposit",
                summary.totalDeposit,
                "Completed deposits only; crypto capital excluded",
              ],
              [
                "Total withdrawal",
                summary.totalWithdrawal,
                "Completed ledger withdrawals",
              ],
              [
                "Promotional credit",
                summary.promotionalCredit,
                "Cannot be withdrawn",
              ],
            ].map(([label, value, detail]) => (
              <article
                key={label}
                className="rounded-lg border border-white/10 bg-[#0d1728] p-5"
              >
                <p className="text-xs font-semibold text-slate-400">{label}</p>
                <p className="mt-4 font-['Inter'] text-2xl font-semibold tracking-[-0.04em]">{formatMoney(value)}</p>
                <p className="mt-2 text-xs text-slate-400">{detail}</p>
              </article>
            ))}
          </section>
          {liveSummary.promotionalCredit > 0 && (
            <section className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-6">
              <h2 className="text-lg font-semibold text-cyan-100">
                Referral promotion
              </h2>
              <p className="mt-2 text-sm leading-7 text-cyan-50/80">
                You have {formatMoney(liveSummary.promotionalCredit)} in
                promotional credit. This credit cannot be withdrawn. Purchase
                and complete a qualifying plan to become eligible to withdraw.
              </p>
            </section>
          )}
          <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-lg border border-white/10 bg-[#0d1728] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Earnings summary</h2>
                <Link
                  to="/transactions"
                  className="text-xs font-bold text-sky-400"
                >
                  View transactions
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Total earnings</p>
                  <p className="mt-2 font-['Inter'] text-xl font-semibold">
                    {formatMoney(liveSummary.totalEarnings)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Last deposit</p>
                  <p className="mt-2 font-['Inter'] text-xl font-semibold">
                    {formatMoney(summary.lastDeposit)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Last withdrawal</p>
                  <p className="mt-2 font-['Inter'] text-xl font-semibold">
                    {formatMoney(summary.lastWithdrawal)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Transactions</p>
                  <p className="mt-2 text-xl font-bold">
                    {summary.transactions.length}
                  </p>
                </div>
              </div>
            </article>
            <article className="rounded-lg border border-white/10 bg-[#0d1728] p-6">
              <h2 className="text-xl font-semibold">Invite your friends</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Share your referral link and track your member network.
              </p>
              <div className="mt-5 flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  placeholder="Your referral link is preparing..."
                  className="min-w-0 flex-1 rounded-md bg-[#101d30] px-3 py-3 text-xs text-slate-400"
                />
                <button
                  type="button"
                  onClick={copyReferralLink}
                  disabled={!referralLink}
                  aria-label={copied ? "Referral link copied" : "Copy referral link"}
                  className={`rounded-md px-3 text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    copied ? "bg-green-400" : "bg-sky-400"
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
          <section className="mt-5 rounded-lg border border-white/10 bg-[#0d1728] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">
                  Crypto Position
                </p>
                <h2 className="mt-2 text-xl font-semibold">Crypto position</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#101d30] p-1">
                {assignedAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => setSelectedAsset(asset.symbol)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedAsset === asset.symbol
                        ? "bg-sky-400 text-slate-950"
                        : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {asset.symbol}
                  </button>
                ))}
              </div>
            </div>

            {assignedAssets.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-[#091321] p-8 text-sm text-slate-400">
                Crypto trading has not been assigned to this account by an administrator.
              </div>
            ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#091321] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{selectedAssetMeta.name}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <h3 className="text-3xl font-bold tracking-[-0.04em]">
                      {selectedAssetData?.price != null ? formatMoney(selectedAssetData.price) : "—"}
                    </h3>
                    {selectedAssetData?.price != null && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          positionMetrics.percentChange >= 0
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {positionMetrics.percentChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(positionMetrics.percentChange).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live simulated value</p>
                  <p className="mt-2 font-['Inter'] text-2xl font-semibold tracking-[-0.04em]">
                    {formatMoney(positionMetrics.currentValue)}
                  </p>
                    <p className={`mt-1 text-xs ${liveTradingValuation.ready ? "text-emerald-300" : "text-amber-300"}`}>
                      {liveTradingValuation.ready ? "All assigned prices current" : "Using last confirmed valuation"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#0d1728] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">P/L</p>
                  <p className={`mt-3 font-['Inter'] text-xl font-semibold ${positionMetrics.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {positionMetrics.pnl >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(positionMetrics.pnl))}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0d1728] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Capital</p>
                  <p className="mt-3 font-['Inter'] text-xl font-semibold">{formatMoney(simCapital)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0d1728] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Position</p>
                  <p className="mt-3 font-['Inter'] text-xl font-semibold">
                    {positionMetrics.quantity ? `${positionMetrics.quantity.toFixed(6)} ${selectedAsset}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0d1728] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Portfolio value</p>
                  <p className="mt-3 font-['Inter'] text-xl font-semibold">
                    {liveTradingValuation.ready ? formatMoney(liveTradingValuation.currentValue) : "—"}
                  </p>
                </div>
              </div>

              <CryptoPriceChart
                symbol={selectedAsset}
                name={selectedAssetMeta.name}
                points={chartPoints}
                currentPrice={selectedAssetData?.price}
                ranges={CHART_RANGES}
                selectedRange={CHART_RANGES.find((range) => range.key === chartRange)?.label || "1D"}
                onRangeChange={setChartRange}
                updatedAt={chartData.timestamp || selectedAssetData?.timestamp}
                loading={chartData.loading || selectedAssetData?.loading}
                error={chartData.error}
              />
            </div>
            )}
          </section>
          <section className="mt-5 rounded-lg border border-white/10 bg-[#0d1728] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent transactions</h2>
              <span className="text-xs text-slate-400">
                {summary.transactions.length} found
              </span>
            </div>
            {summary.transactions.length ? (
              <div className="mt-5 space-y-2">
                {summary.transactions.slice(0, 8).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="grid gap-1 border-b border-white/5 py-3 text-sm text-slate-300 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-semibold text-white">
                      {formatTransactionType(transaction.type)}
                    </span>
                    <span className="text-slate-300">
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
              <p className="py-8 text-center text-sm text-slate-400">
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
