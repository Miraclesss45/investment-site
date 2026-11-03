import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, LoaderCircle, MapPin, MessageCircle } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { saveSupportTicket, sendSupportTicketEmails } from "../../lib/firebaseData";
import { SUPPORT_CHAT_OPEN_EVENT } from "../../lib/supportChatEvents";
import { PublicPage } from "../../components/site/SiteChrome";
import heroAsset from "../../assets/uploads/banner-5.webp";
import heroAssetMedium from "../../assets/uploads/banner-5-1440.webp";
import heroAssetSmall from "../../assets/uploads/banner-5-960.webp";
import FeedbackMessage from "../../components/ui/FeedbackMessage";
import { getSafeErrorMessage } from "../../lib/authHelpers";

const SUPPORT_EMAIL = "meridianvest948@gmail.com";

export default function SupportPage() {
  const { user } = useAuth();
  const canSubmitTicket = Boolean(user && !user.isAnonymous);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [emailRetryAvailable, setEmailRetryAvailable] = useState(false);
  const [emailRetrying, setEmailRetrying] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  async function copySupportAddress() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 1800);
    } catch {
      setEmailCopied(false);
    }
  }

  async function retrySupportEmails() {
    if (!ticketId || emailRetrying) return;
    setEmailRetrying(true);
    setMessage("");
    try {
      await sendSupportTicketEmails(ticketId);
      setEmailRetryAvailable(false);
      setMessage("Your support request was sent and the email notifications were delivered.");
      setMessageType("success");
    } catch (error) {
      setMessageType("error");
      setMessage(getSafeErrorMessage(error, "Your request is saved, but its email notifications could not be sent. Please try again."));
    } finally {
      setEmailRetrying(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmitTicket) return;
    setMessage("");
    setMessageType("status");
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      if (!user)
        throw new Error("Please sign in before sending a support request.");
      const ticket = await saveSupportTicket(user.uid, {
        fullName: formData.get("fullName"),
        email: user.email || formData.get("email"),
        subject: `Support request from ${formData.get("fullName")}`,
        message: formData.get("message"),
      });
      setTicketId(ticket.id);
      form.reset();
      try {
        await sendSupportTicketEmails(ticket.id);
        setEmailRetryAvailable(false);
        setMessage("Your support request was sent. A confirmation email has been sent to your verified email address.");
        setMessageType("success");
      } catch {
        setEmailRetryAvailable(true);
        setMessage("Your support request was saved, but we could not send all email notifications. You can retry the email now.");
        setMessageType("status");
      }
    } catch (error) {
      setMessageType("error");
      setMessage(getSafeErrorMessage(error, "Unable to send your request right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-slate-50/70">
        <section className="relative grid min-h-[clamp(16rem,35vw,20rem)] place-items-center overflow-hidden text-center">
          <img
            className="absolute inset-0 h-full w-full object-cover"
            src={heroAsset}
            srcSet={`${heroAssetSmall} 960w, ${heroAssetMedium} 1440w, ${heroAsset} 1920w`}
            sizes="100vw"
            width="1920"
            height="1080"
            alt="Modern buildings used as the Support Center backdrop"
            fetchPriority="high"
            decoding="async"
          />
          <div
            className="absolute inset-0 bg-blue-950/70"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto w-[min(1160px,calc(100%_-_2rem))] sm:w-[min(1160px,calc(100%_-_3rem))] lg:w-[min(1160px,calc(100%_-_5rem))]">
            <h1 className="mb-6 text-[clamp(2.25rem,7vw,4rem)] font-semibold tracking-[-0.05em] text-white">
              Support Center
            </h1>
            <p className="flex items-center justify-center gap-4 text-sm font-semibold text-blue-100">
              <Link to="/" className="text-cyan-200">
                Home
              </Link>{" "}
              : Request Assistance
            </p>
          </div>
        </section>
        <section className="px-4 py-16 sm:py-[94px]">
          <div className="mx-auto grid w-full max-w-[1160px] gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="transition duration-700">
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-700">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Support
              </div>
              <h2 className="mb-5 text-[clamp(2rem,7vw,2.7rem)] font-semibold tracking-[-0.05em] text-slate-900">
                Request assistance.
              </h2>
              <p className="mb-9 text-sm leading-8 text-slate-700">
                Request assistance with registration, packages, deposits,
                withdrawals, or any other part of your MeridianVests member
                experience.
              </p>
              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(SUPPORT_CHAT_OPEN_EVENT))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-blue-800 transition hover:border-cyan-200 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <MessageCircle size={16} /> Start live chat
                </button>
                <button
                  type="button"
                  onClick={copySupportAddress}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-blue-50 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-blue-800 transition hover:border-sky-300 hover:bg-sky-400/15"
                  aria-live="polite"
                >
                  {emailCopied ? <Check size={16} /> : <Copy size={16} />}
                  {emailCopied ? "Email copied" : "Copy support email"}
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-700">
                <MapPin size={18} /> MeridianVests Crypto Management Group
              </div>
            </div>
            {canSubmitTicket ? (
              <form
                className="transition duration-700 rounded-[0.625rem] border border-slate-200 bg-slate-50 p-5 shadow-[0_20px_45px_rgba(2,8,23,0.28)] sm:p-8"
                onSubmit={handleSubmit}
              >
                <h3 className="mb-7 text-2xl font-semibold text-slate-900">
                  Send a support ticket
                </h3>
                <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-700">
                  Full name
                  <input
                    name="fullName"
                    type="text"
                    placeholder="Your full name"
                    required
                    maxLength={120}
                    className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none"
                  />
                </label>
                <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-700">
                  Email address
                  <input
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    maxLength={254}
                    className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none"
                  />
                </label>
                <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-700">
                  Message
                  <textarea
                    name="message"
                    placeholder="Tell us how we can help"
                    required
                    minLength={10}
                    maxLength={4000}
                    className="mt-2 min-h-[145px] w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-gradient-to-r from-sky-400 to-cyan-400 px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#082032] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={16} className="mr-2 animate-spin" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    "Submit request"
                  )}
                </button>
                {message && <FeedbackMessage className="mt-4" type={messageType} variant="light">{message}</FeedbackMessage>}
                {emailRetryAvailable && (
                  <button
                    type="button"
                    onClick={retrySupportEmails}
                    disabled={emailRetrying}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-200 px-4 text-xs font-bold text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {emailRetrying ? <LoaderCircle size={14} className="animate-spin" /> : null}
                    {emailRetrying ? "Retrying email..." : "Retry email notifications"}
                  </button>
                )}
              </form>
            ) : (
              <section className="transition duration-700 rounded-[0.625rem] border border-slate-200 bg-slate-50 p-5 shadow-[0_20px_45px_rgba(2,8,23,0.28)] sm:p-8">
                <h3 className="text-2xl font-semibold text-slate-900">
                  Choose how to get help
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Start a live chat now, or sign in to submit a support ticket.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/login"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-4 text-xs font-bold text-slate-900 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 px-4 text-xs font-bold text-slate-900 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    Create an account
                  </Link>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
