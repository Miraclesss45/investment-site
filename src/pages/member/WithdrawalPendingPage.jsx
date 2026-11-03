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
    <main className="member-portal relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-50 blur-3xl" />
      <div className="relative mx-auto w-full max-w-[760px]">
        <header className="flex items-center justify-between">
          <Link to="/dashboard" aria-label="MeridianVests home" className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em]">
            <img className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" src="/meridianvest-logo.svg" alt="MeridianVests logo" width="48" height="48" />
            Meridian<span className="text-blue-700">Vests</span>
          </Link>
          <Link to="/support" className="hidden items-center gap-2 text-sm font-bold text-blue-700 sm:flex">
            <MessageCircle size={16} /> Contact support
          </Link>
        </header>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl shadow-blue-950/10 backdrop-blur-xl sm:mt-12 sm:p-7">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-sky-300/25 bg-blue-50">
            <img className="h-14 w-14 rounded-xl object-cover" src="/meridianvest-logo.svg" alt="" width="56" height="56" />
          </div>
          <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-800">
            Withdrawal request received
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
            Your withdrawal is awaiting approval.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-700 sm:text-base">
            Your request has been securely submitted and is now in our review
            queue. An administrator will check the request details before
            approving it. You do not need to submit it again.
          </p>
          <ol aria-label="Withdrawal progress" className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-3">
            <li className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 size={19} className="text-emerald-800" />
              <p className="mt-3 text-sm font-bold text-slate-900">Request received</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Your request is recorded.</p>
            </li>
            <li aria-current="step" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Clock3 size={19} className="text-amber-800" />
              <p className="mt-3 text-sm font-bold text-slate-900">Awaiting approval</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Our administrator is reviewing it.</p>
            </li>
            <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ShieldCheck size={19} className="text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-700">Payout confirmation</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">We’ll email you when the administrator confirms your withdrawal is complete.</p>
            </li>
          </ol>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-6 text-slate-500">
            We’ll send updates to the email address registered to your account.
            Review and payout times can vary.
          </p>
          {withdrawalState.emailFailed && (
            <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-6 text-amber-900">
              {getEmailFailureMessage(withdrawalState.emailFailureCode)}
            </p>
          )}
          {(withdrawalState.asset || withdrawalState.amount) && (
            <div className="mx-auto mt-6 grid max-w-lg gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left sm:grid-cols-2">
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Asset</p><p className="mt-2 text-sm font-bold">{withdrawalState.asset || "Under review"}</p></div>
              <div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Amount</p><p className="mt-2 text-sm font-bold">{withdrawalState.amount ? formatMoney(withdrawalState.amount) : "Under review"}</p></div>
              {withdrawalState.wallet && <div className="sm:col-span-2"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Destination wallet</p><p className="mt-2 break-all font-sans text-xs leading-5 text-slate-700">{withdrawalState.wallet}</p></div>}
            </div>
          )}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link to="/support" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-950">
              <MessageCircle size={16} /> Contact support
            </Link>
            <a href="mailto:meridianvest948@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-blue-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-700">
              <Mail size={16} /> Email support
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-green-800">
              <WhatsAppIcon size={16} /> WhatsApp support
            </a>
          </div>
          <Link to="/dashboard" className="mx-auto mt-7 flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Return to dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
