import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Mail, MessageCircle } from "lucide-react";
import { formatMoney } from "../../lib/financial";
import { sendDepositPendingEmail } from "../../lib/firebaseData";
import WhatsAppIcon, { WHATSAPP_URL } from "../../components/ui/WhatsAppIcon";

export default function DepositPendingPage() {
  const location = useLocation();
  const request = location.state || {};
  const [emailFailed, setEmailFailed] = useState(request.emailFailed === true);
  const [emailRetrying, setEmailRetrying] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");

  async function retryPendingEmail() {
    if (!request.requestId || emailRetrying) return;
    setEmailRetrying(true);
    setEmailNotice("");
    try {
      await sendDepositPendingEmail(request.requestId);
      setEmailFailed(false);
      setEmailNotice("Deposit confirmation email sent to your verified account email.");
    } catch {
      setEmailNotice("The deposit request is saved, but its email could not be sent. Please contact support if this continues.");
    } finally {
      setEmailRetrying(false);
    }
  }

  return (
    <main className="member-portal relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-blue-50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-cyan-50 blur-3xl" />

      <div className="relative mx-auto w-full max-w-[920px]">
        <header className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 text-lg font-extrabold tracking-[-0.04em]"
          >
            <img
              className="h-10 w-10 rounded-lg object-cover"
              src="/meridianvest-logo.svg"
                          alt="MeridianVests logo"
              width="40"
              height="40"
            />
            Meridian<span className="text-blue-700">Vests</span>
          </Link>
          <Link
            to="/support"
            className="hidden items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-700 sm:flex"
          >
            <MessageCircle size={16} /> Contact support
          </Link>
        </header>

        <section className="mx-auto mt-10 max-w-2xl motion-safe:transition motion-safe:duration-700 sm:mt-14">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/10 backdrop-blur-xl sm:p-7">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
              <Clock3 size={30} strokeWidth={1.6} />
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-800">
                Request received
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-3xl">
                Your deposit is being processed.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Your deposit request is being processed. Please wait while we
                confirm it before trying again. Support will contact you with
                the next steps after review.
              </p>
            </div>

            {(request.packageName || request.amount || request.asset) && (
              <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Package
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {request.packageName || "Selected plan"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Amount
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {request.amount ? formatMoney(request.amount) : "Under review"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Asset
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {request.asset || "Under review"}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3.5">
              <CheckCircle2 className="mt-0.5 shrink-0 text-blue-700" size={19} />
              <p className="text-xs leading-5 text-slate-700">
                Please do not submit the same request again while this one is
                being reviewed. We will update you through your account support
                channel.
              </p>
            </div>

            {emailFailed && (
              <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm leading-6 text-amber-900">
                <p>The request was saved, but we could not send its pending email to your verified account email.</p>
                {request.requestId ? (
                  <button type="button" onClick={retryPendingEmail} disabled={emailRetrying} className="mt-3 rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-60">
                    {emailRetrying ? "Sending…" : "Retry email"}
                  </button>
                ) : null}
                {emailNotice ? <p role="status" className="mt-2">{emailNotice}</p> : null}
              </div>
            )}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                to="/support"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(34,211,238,0.18)]"
              >
                <MessageCircle size={16} /> Contact support
              </Link>
              <a
                href="mailto:meridianvest948@gmail.com"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-blue-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                <Mail size={16} /> Email support
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-green-800 transition hover:border-green-300 hover:bg-green-400/20"
              >
                <WhatsAppIcon size={16} /> WhatsApp support
              </a>
            </div>

            <Link
              to="/dashboard"
              className="mx-auto mt-7 flex w-fit items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft size={16} /> Return to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
