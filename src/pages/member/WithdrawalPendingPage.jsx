import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Clock3, Mail, MessageCircle } from "lucide-react";
import { formatMoney } from "../../lib/financial";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";

export default function WithdrawalPendingPage() {
  const { state = {} } = useLocation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111d] px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative mx-auto w-full max-w-[760px]">
        <header className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em]">
            <img className="h-10 w-10 rounded-lg object-cover" src="/meridianvest-logo.svg" alt="MeridianVests logo" width="40" height="40" />
            Meridian<span className="text-sky-400">Vests</span>
          </Link>
          <Link to="/support" className="hidden items-center gap-2 text-sm font-bold text-sky-300 sm:flex">
            <MessageCircle size={16} /> Contact support
          </Link>
        </header>
        <section className="mt-16 rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-xl motion-safe:transition motion-safe:duration-700 sm:mt-24 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">
            <Clock3 size={38} strokeWidth={1.6} />
          </div>
          <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.22em] text-yellow-200">
            Withdrawal request received
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Your request is being processed.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
            Please wait while we verify your balance and wallet details. Do not
            submit the same request again while it is under review.
          </p>
          {(state.asset || state.amount) && (
            <div className="mx-auto mt-8 grid max-w-lg gap-3 rounded-2xl border border-white/10 bg-[#081321]/80 p-5 text-left sm:grid-cols-3">
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Asset</p><p className="mt-2 text-sm font-bold">{state.asset || "Under review"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Amount</p><p className="mt-2 text-sm font-bold">{state.amount ? formatMoney(state.amount) : "Under review"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Fee</p><p className="mt-2 text-sm font-bold">{formatMoney(state.fee || 0)}</p></div>
            </div>
          )}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link to="/support" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-950">
              <MessageCircle size={16} /> Contact support
            </Link>
            <a href="mailto:meridianvest948@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-200">
              <Mail size={16} /> Email support
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-400/30 bg-green-400/10 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-green-300">
              <WhatsAppIcon size={16} /> WhatsApp support
            </a>
          </div>
          <Link to="/dashboard" className="mx-auto mt-7 flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
            <ArrowLeft size={16} /> Return to dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
