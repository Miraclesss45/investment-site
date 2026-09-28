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
    <main className="relative min-h-screen overflow-hidden bg-[#07111d] px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-cyan-400/10 blur-3xl" />

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
            Meridian<span className="text-sky-400">Vests</span>
          </Link>
          <Link
            to="/support"
            className="hidden items-center gap-2 text-sm font-bold text-sky-300 transition hover:text-cyan-200 sm:flex"
          >
            <MessageCircle size={16} /> Contact support
          </Link>
        </header>

        <section className="mx-auto mt-16 max-w-2xl motion-safe:transition motion-safe:duration-700 sm:mt-24">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-300/25 bg-yellow-300/10 text-yellow-200">
              <Clock3 size={38} strokeWidth={1.6} />
            </div>

            <div className="mt-8 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-yellow-200">
                Request received
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                Your deposit is being processed.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                Your deposit request is being processed. Please wait while we
                confirm it before trying again. Support will contact you with
                the next steps after review.
              </p>
            </div>

            {(request.packageName || request.amount || request.asset) && (
              <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-[#081321]/80 p-5 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Package
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {request.packageName || "Selected plan"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Amount
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {request.amount ? formatMoney(request.amount) : "Under review"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    Asset
                  </p>
                  <p className="mt-2 text-sm font-bold text-white">
                    {request.asset || "Under review"}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
              <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={19} />
              <p className="text-xs leading-5 text-slate-300">
                Please do not submit the same request again while this one is
                being reviewed. We will update you through your account support
                channel.
              </p>
            </div>

            {emailFailed && (
              <div role="alert" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-left text-sm leading-6 text-amber-100">
                <p>The request was saved, but we could not send its pending email to your verified account email.</p>
                {request.requestId ? (
                  <button type="button" onClick={retryPendingEmail} disabled={emailRetrying} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-2 text-xs font-bold text-amber-50 hover:bg-amber-100/10 disabled:opacity-60">
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-200 transition hover:border-sky-400/50 hover:text-sky-300"
              >
                <Mail size={16} /> Email support
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-green-400/30 bg-green-400/10 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.1em] text-green-300 transition hover:border-green-300 hover:bg-green-400/20"
              >
                <WhatsAppIcon size={16} /> WhatsApp support
              </a>
            </div>

            <Link
              to="/dashboard"
              className="mx-auto mt-7 flex w-fit items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} /> Return to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
