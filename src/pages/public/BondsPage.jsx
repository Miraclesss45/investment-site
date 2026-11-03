import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, RefreshCw } from "lucide-react";
import { PublicPage } from "../../components/site/SiteChrome";
import { Reveal } from "../../components/site/Reveal";
import { formatMoney } from "../../lib/financial";
import { getInvestmentPackages } from "../../lib/packageCatalog";

export default function BondsPage() {
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setPackages(null);
    setError("");
    getInvestmentPackages()
      .then((items) => active && setPackages(items))
      .catch((reason) => active && setError(reason.message || "Investment packages are temporarily unavailable."));
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-slate-50/80 px-4 py-12 sm:py-16 lg:py-[94px]">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-700">
            <span className="block h-2.5 w-2.5 bg-sky-400" /> Our packages
          </div>
          <h1 className="mx-auto mb-10 max-w-2xl text-center text-[clamp(2rem,7vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-slate-900 sm:mb-14">
            Choose the structure that fits your capital goals.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm leading-6 text-slate-700 sm:mb-14">
            Rates are illustrative targets, not guaranteed returns. Requests
            are subject to review, eligibility, and the applicable platform
            terms.
          </p>
          {packages === null && !error ? (
            <p className="py-12 text-center text-sm text-slate-700" role="status">Loading available packages…</p>
          ) : error ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="alert">
              <p className="text-sm text-amber-900">{error}</p>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-slate-900 hover:bg-blue-50">
                <RefreshCw size={15} aria-hidden="true" />Try again
              </button>
            </div>
          ) : packages.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-700">There are no investment packages available right now. Please check back later.</p>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((item, index) => {
              const rate = item.returnRate ?? item.rate;
              const details = [
                Number.isFinite(Number(item.minimum)) && item.minimum !== null ? ["Minimum deposit", formatMoney(item.minimum)] : null,
                item.maximum !== null && item.maximum !== undefined ? ["Maximum deposit", Number(item.maximum) > 0 ? formatMoney(item.maximum) : "No maximum"] : null,
                rate !== null && rate !== undefined ? ["Simple daily profit", `${rate}%`] : null,
                item.duration ? ["Duration", item.duration] : null,
              ].filter(Boolean);
              return (
              <Reveal
                as="article"
                key={item.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-[0_18px_45px_rgba(2,8,23,0.18)] hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(2,8,23,0.3)] sm:p-6"
                style={{ "--reveal-delay": `${index * 120}ms` }}
              >
                <div className="mb-5 inline-flex self-start rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-800">
                  {item.name}
                </div>
                {rate !== null && rate !== undefined && <p className="font-sans text-4xl font-semibold tracking-[-0.06em] text-slate-900">{rate}<span className="ml-1 text-xl text-slate-600">%</span></p>}
                {item.description && <p className="mt-4 text-sm leading-6 text-slate-700">{item.description}</p>}
                <ul className="mt-8 flex-1 space-y-4 text-left text-xs text-slate-700 sm:mt-9 sm:space-y-5">
                  {details.length ? details.map(([label, value]) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800">
                        <Check size={12} aria-hidden="true" />
                      </span>
                      <span className="font-medium">
                        {label}: <b>{value}</b>
                      </span>
                    </li>
                  )) : <li className="text-slate-600">Package details are not currently listed.</li>}
                </ul>
                <Link
                  to="/signup"
                  className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-sky-300 px-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Get started
                </Link>
              </Reveal>
              );
            })}
          </div>
          )}
        </div>
      </main>
    </PublicPage>
  );
}
