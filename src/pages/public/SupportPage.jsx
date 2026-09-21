import { useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Mail, MapPin, Send } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { saveSupportTicket } from "../../lib/firebaseData";
import { PublicPage } from "../../components/site/SiteChrome";
import heroAsset from "../../assets/uploads/banner-5.webp";
import heroAssetMedium from "../../assets/uploads/banner-5-1440.webp";
import heroAssetSmall from "../../assets/uploads/banner-5-960.webp";
import FeedbackMessage from "../../components/ui/FeedbackMessage";

const SUPPORT_EMAIL = "meridianvest948@gmail.com";
const SUPPORT_TELEGRAM_URL = "https://t.me/meridianvests";

export default function SupportPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setMessageType("status");
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      if (!user)
        throw new Error("Please sign in before sending a support request.");
      await saveSupportTicket(user.uid, {
        fullName: formData.get("fullName"),
        email: user.email || formData.get("email"),
        subject: `Support request from ${formData.get("fullName")}`,
        message: formData.get("message"),
      });

      const subject = `Support request from ${formData.get("fullName")}`;
      const body = [
        `Name: ${formData.get("fullName")}`,
        `Email: ${user.email || formData.get("email")}`,
        "",
        String(formData.get("message")),
      ].join("\n");

      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setMessage("Your email app is opening with the support message addressed to MeridianVests.");
      setMessageType("success");
      form.reset();
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send your request right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1" className="bg-[#07111d]/70">
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
            className="absolute inset-0 bg-[#050b14]/[0.72]"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <h1 className="mb-6 text-[clamp(2.25rem,7vw,4rem)] font-semibold tracking-[-0.05em] text-white">
              Support Center
            </h1>
            <p className="flex items-center justify-center gap-4 text-sm font-semibold text-white">
              <Link to="/" className="text-sky-400">
                Home
              </Link>{" "}
              : Request Assistance
            </p>
          </div>
        </section>
        <section className="px-4 py-16 sm:py-[94px]">
          <div className="mx-auto grid w-full max-w-[1160px] gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="motion-safe:transition motion-safe:duration-700">
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Support
              </div>
              <h2 className="mb-5 text-[clamp(2rem,7vw,2.7rem)] font-semibold tracking-[-0.05em] text-white">
                Request assistance.
              </h2>
              <p className="mb-9 text-sm leading-8 text-slate-300">
                Request assistance with registration, packages, deposits,
                withdrawals, or any other part of your MeridianVests member
                experience.
              </p>
              <div className="mb-6 flex flex-wrap gap-3">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-sky-200 transition hover:border-sky-300 hover:bg-sky-400/15"
                >
                  <Mail size={16} /> Email
                </a>
                <a
                  href={SUPPORT_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-400/15"
                >
                  <Send size={16} /> Telegram
                </a>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-200">
                <MapPin size={18} /> MeridianVests Crypto Management Group
              </div>
            </div>
            <form
              className="motion-safe:transition motion-safe:duration-700 rounded-[0.625rem] border border-white/10 bg-[#050b14] p-5 shadow-[0_20px_45px_rgba(2,8,23,0.28)] sm:p-8"
              onSubmit={handleSubmit}
            >
              <h3 className="mb-7 text-2xl font-semibold text-white">
                Send a message
              </h3>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Full name
                <input
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  required
                  maxLength={120}
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#101d30] px-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </label>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#101d30] px-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </label>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Message
                <textarea
                  name="message"
                  placeholder="Tell us how we can help"
                  required
                  minLength={10}
                  maxLength={4000}
                  className="mt-2 min-h-[145px] w-full rounded-md border border-white/10 bg-[#101d30] px-3 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
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
              {message && <FeedbackMessage className="mt-4" type={messageType}>{message}</FeedbackMessage>}
            </form>
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
