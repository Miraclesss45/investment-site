import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PublicPage } from "../../components/site/SiteChrome";
import { Reveal } from "../../components/site/Reveal";

const plans = [
  { name: "Starter Plan", rate: 2.5, minimum: "$35", maximum: "$3,000" },
  { name: "Regular Plan", rate: 10, minimum: "$35", maximum: "$10,000" },
  { name: "Pro Plan", rate: 20, minimum: "$35", maximum: "$20,000" },
  { name: "Premium Plan", rate: 35, minimum: "$35", maximum: "$UNLIMITED" },
];

export default function BondsPage() {
  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-[#0a1422]/80 px-4 py-12 sm:py-16 lg:py-[94px]">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
            <span className="block h-2.5 w-2.5 bg-sky-400" /> Our packages
          </div>
          <h1 className="mx-auto mb-10 max-w-2xl text-center text-[clamp(2rem,7vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-white sm:mb-14">
            Choose the structure that fits your capital goals.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-center text-sm leading-6 text-slate-300 sm:mb-14">
            Rates are illustrative targets, not guaranteed returns. Requests
            are subject to review, eligibility, and the applicable platform
            terms.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(({ name, rate, minimum, maximum }, index) => (
              <Reveal
                as="article"
                key={name}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1728] p-5 text-slate-100 shadow-[0_18px_45px_rgba(2,8,23,0.18)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(2,8,23,0.3)] motion-reduce:transition-none sm:p-6"
                style={{ "--reveal-delay": `${index * 120}ms` }}
              >
                <div className="mb-5 inline-flex self-start rounded-md border border-sky-300/15 bg-sky-300/[0.08] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-200">
                  {name}
                </div>
                <div className="flex items-start font-['Inter'] text-[clamp(3rem,12vw,4rem)] font-semibold leading-none tracking-[-0.07em] text-white">
                  {rate}
                  <span className="ml-1.5 pt-1.5 text-xl tracking-normal text-slate-400">%</span>
                </div>
                <ul className="mt-8 flex-1 space-y-4 text-left text-xs text-slate-300 sm:mt-9 sm:space-y-5">
                  {[
                    ["Minimum deposit", minimum],
                    ["Maximum deposit", maximum],
                    ["Target daily rate", `${rate}%`],
                    ["Duration", "14 Calendar Days"],
                    ["Plan return", "Subject to terms"],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200">
                        <Check size={12} aria-hidden="true" />
                      </span>
                      <span className="font-medium">
                        {label}: <b>{value}</b>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-sky-300 px-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1728]"
                >
                  Get started
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
    </PublicPage>
  );
}
