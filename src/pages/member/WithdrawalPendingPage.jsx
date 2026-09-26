import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { formatMoney } from "../../lib/financial";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";

function getEmailFailureMessage(code) {
  if (code === "smtp-connection-timeout" || code === "smtp-connection-failed") {
    return "Your withdrawal request was saved, but our email service could not reach the mail provider. Your request is still awaiting review; please do not submit it again. Our team can retry the notification.";
  }
  if (code === "smtp-authentication-failed" || code === "smtp-not-configured") {
    return "Your withdrawal request was saved, but the email service needs attention. Your request is still awaiting review; please do not submit it again. Our team can retry the notification.";
  }
  return "Your withdrawal request was saved, but we could not send the confirmation email. Your request is still awaiting review; please contact support and do not submit another request.";
}

export default function WithdrawalPendingPage() {
  const { state } = useLocation();
  const withdrawalState = state || {};

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111d] px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-3xl" />
      <div className="relative mx-auto w-full max-w-[760px]">
        <header className="flex items-center justify-between">
          <Link to="/dashboard" aria-label="MeridianVests home" className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em]">
            <img className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" src="/meridianvest-logo.svg" alt="MeridianVests logo" width="48" height="48" />
            Meridian<span className="text-sky-400">Vests</span>
          </Link>
          <Link to="/support" className="hidden items-center gap-2 text-sm font-bold text-sky-300 sm:flex">
            <MessageCircle size={16} /> Contact support
          </Link>
        </header>
        <section className="mt-12 rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:mt-16 sm:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-sky-300/25 bg-sky-300/10">
            <img className="h-14 w-14 rounded-xl object-cover" src="/meridianvest-logo.svg" alt="" width="56" height="56" />
          </div>
          <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.22em] text-sky-200">
            Withdrawal request received
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Your withdrawal is awaiting approval.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            Your request has been securely submitted and is now in our review
            queue. An administrator will check the request details before
            approving it. You do not need to submit it again.
          </p>
          <ol aria-label="Withdrawal progress" className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-3">
            <li className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
              <CheckCircle2 size={19} className="text-emerald-300" />
              <p className="mt-3 text-sm font-bold text-white">Request received</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Your request is recorded.</p>
            </li>
            <li aria-current="step" className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-4">
              <Clock3 size={19} className="text-amber-200" />
              <p className="mt-3 text-sm font-bold text-white">Awaiting approval</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Our administrator is reviewing it.</p>
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <ShieldCheck size={19} className="text-slate-400" />
              <p className="mt-3 text-sm font-bold text-slate-200">Payout confirmation</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">We’ll email you when the administrator confirms your withdrawal is complete.</p>
            </li>
          </ol>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-6 text-slate-500">
            We’ll send updates to the email address registered to your account.
            Review and payout times can vary.
          </p>
          {withdrawalState.emailFailed && (
            <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-left text-sm leading-6 text-amber-100">
              {getEmailFailureMessage(withdrawalState.emailFailureCode)}
            </p>
          )}
          {(withdrawalState.asset || withdrawalState.amount) && (
            <div className="mx-auto mt-8 grid max-w-lg gap-3 rounded-2xl border border-white/10 bg-[#081321]/80 p-5 text-left sm:grid-cols-2">
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Asset</p><p className="mt-2 text-sm font-bold">{withdrawalState.asset || "Under review"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Amount</p><p className="mt-2 text-sm font-bold">{withdrawalState.amount ? formatMoney(withdrawalState.amount) : "Under review"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Network fee</p><p className="mt-2 text-sm font-bold">{formatMoney(withdrawalState.fee || 0)}</p></div>
              {withdrawalState.wallet && <div className="sm:col-span-2"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Destination wallet</p><p className="mt-2 break-all font-['IBM_Plex_Mono'] text-xs leading-5 text-slate-200">{withdrawalState.wallet}</p></div>}
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
