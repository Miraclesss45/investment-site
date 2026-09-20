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
      <main id="main-content" tabIndex="-1" className="bg-[#202125]/70 px-4 py-12 sm:py-16 lg:py-[94px]">
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
                className={`group flex h-full flex-col rounded-xl p-5 text-slate-900 shadow-xl shadow-slate-950/30 transition duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/20 sm:p-6 ${
                  index >= 2 ? "bg-cyan-100" : "bg-white"
                }`}
                style={{ "--reveal-delay": `${index * 120}ms` }}
              >
                <div className="mb-5 inline-flex self-start rounded-full bg-gradient-to-r from-sky-400 to-sky-500 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                  {name}
                </div>
                <div className="flex items-start text-[clamp(3.5rem,15vw,4.5rem)] font-extrabold leading-none tracking-[-0.08em] text-slate-900">
                  {rate}
                  <span className="ml-2 pt-2 text-2xl tracking-normal">%</span>
                </div>
                <ul className="mt-8 flex-1 space-y-5 text-left text-[11px] text-slate-800 sm:mt-9 sm:space-y-6">
                  {[
                    ["Minimum deposit", minimum],
                    ["Maximum deposit", maximum],
                    ["Target daily rate", `${rate}%`],
                    ["Duration", "14 Calendar Days"],
                    ["Plan return", "Subject to terms"],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition group-hover:bg-slate-950">
                        <Check size={12} />
                      </span>
                      <span className="font-medium">
                        {label}: <b>{value}</b>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className="mt-8 inline-flex h-[58px] w-full items-center justify-center rounded-xl bg-slate-900 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white transition duration-300 hover:-translate-y-0.5 hover:bg-sky-500"
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
