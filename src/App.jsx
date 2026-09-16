import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowUp,
  Check,
  ChevronRight,
  CreditCard,
  Gem,
  Mail,
  MapPin,
  Menu,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth, firestoreDb } from "./lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "./lib/auth";
import { LanguageProvider, languageOptions, useLanguage } from "./lib/i18n";
import heroAsset from "./assets/uploads/banner-5.jpg";
import featureAsset from "./assets/uploads/image-1.png";
import featureOneAsset from "./assets/uploads/feature1.png";
import featureTwoAsset from "./assets/uploads/feature2.png";
import featureThreeAsset from "./assets/uploads/feature3.png";
import featureFourAsset from "./assets/uploads/feature4.png";
import stepOneAsset from "./assets/uploads/why1.png";
import stepTwoAsset from "./assets/uploads/why2.png";
import stepThreeAsset from "./assets/uploads/why3.png";
import stepFourAsset from "./assets/uploads/why4.png";
import certificateAsset from "./assets/uploads/aboutusimage.png";
import loginAsset from "./assets/uploads/login-icon.jpg";
import bnbAsset from "./assets/uploads/bnb.png";
import btcAsset from "./assets/uploads/btc.png";
import dashAsset from "./assets/uploads/dash.png";
import dogeAsset from "./assets/uploads/doge.png";
import ethAsset from "./assets/uploads/eth (1).png";
import ltcAsset from "./assets/uploads/ltc.png";
import trxAsset from "./assets/uploads/trx.png";
import usdtAsset from "./assets/uploads/usdt.png";
import usdtbAsset from "./assets/uploads/usdtb.png";
import usdttrAsset from "./assets/uploads/usdttr.png";
import xlmAsset from "./assets/uploads/xlm.png";
import xrpAsset from "./assets/uploads/xrp.png";

const imageSources = {
  hero: heroAsset,
  feature: featureAsset,
  featureOne: featureOneAsset,
  featureTwo: featureTwoAsset,
  featureThree: featureThreeAsset,
  featureFour: featureFourAsset,
  stepOne: stepOneAsset,
  stepTwo: stepTwoAsset,
  stepThree: stepThreeAsset,
  stepFour: stepFourAsset,
  certificate: certificateAsset,
  login: loginAsset,
};

function getAuthErrorMessage(error, fallback) {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/email-already-in-use": "An account already exists with this email address.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
  };

  return error?.code && messages[error.code]
    ? messages[error.code]
    : error instanceof Error
      ? error.message
      : fallback;
}

function normalizeLoginIdentifier(value) {
  return value.trim().toLowerCase();
}

async function resolveLoginEmail(identifier) {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  if (normalizedIdentifier.includes("@")) {
    return normalizedIdentifier;
  }

  if (!firestoreDb) {
    throw new Error("Firestore is not configured.");
  }

  const usernameSnapshot = await getDoc(
    doc(firestoreDb, "usernames", normalizedIdentifier),
  );

  if (!usernameSnapshot.exists()) {
    throw new Error("No account was found with that username.");
  }

  const email = usernameSnapshot.data().email;
  if (typeof email !== "string" || !email) {
    throw new Error("This username is not linked to a valid account.");
  }

  return email;
}

const coinAssets = [
  ["BNB", bnbAsset],
  ["Bitcoin", btcAsset],
  ["Dash", dashAsset],
  ["Dogecoin", dogeAsset],
  ["Ethereum", ethAsset],
  ["Litecoin", ltcAsset],
  ["TRON", trxAsset],
  ["Tether", usdtAsset],
  ["USDTB", usdtbAsset],
  ["USDTTR", usdttrAsset],
  ["Stellar", xlmAsset],
  ["XRP", xrpAsset],
];

const navItems = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Our Packages", to: "/bonds" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact Us", to: "/support" },
];

const featureCards = [
  {
    title: "Advanced Technology",
    description:
      "Utilize our advanced technological tools to effortlessly earn stable long-term profits.",
    icon: WalletCards,
    image: imageSources.featureOne,
    action: "Our Packages",
  },
  {
    title: "Seamless Investments",
    description:
      "Purchase our plans with ease, and start earning without the hassle of setting up complex software.",
    icon: ShieldCheck,
    image: imageSources.featureTwo,
    action: "Register Now",
  },
  {
    title: "Comprehensive Support",
    description:
      "Our dedicated support team is here to assist you 24/7/365 for a premium investing experience.",
    icon: CreditCard,
    image: imageSources.featureThree,
    action: "Contact Us",
  },
  {
    title: "Real-Time Earning Insights",
    description:
      "Stay updated with real-time insights on your daily earnings and investment performance.",
    icon: Sparkles,
    image: imageSources.featureFour,
    action: "Login To Account",
  },
];

const guideSteps = [
  { label: "Sign Up For A Free Account", image: imageSources.stepOne },
  { label: "Choose An Investment Bond", image: imageSources.stepTwo },
  { label: "Check Earnings Daily", image: imageSources.stepThree },
  { label: "Withdraw Anytime You Like", image: imageSources.stepFour },
];

const testimonials = [
  {
    quote:
      "I Like The Different Types Of Investment Bonds Offered At MeridianVest, And The Stable, Regular, Long-Term Returns On My Investments.",
    author: "RICHARD TRUMP",
  },
  {
    quote:
      "It's The Best Online Investment Opportunity I Have Come Across. MeridianVest Is The Best. Keep It Up. Let's Build Our Future Together.",
    author: "SIMONE ROSE",
  },
  {
    quote:
      "Such A Smooth Investment Experience. Your Support Is World Class. Long Live MeridianVest. I Will Recommend MeridianVest To All My Friends And Family.",
    author: "ANDREW PHILLIPS",
  },
];

const plans = [
  {
    name: "Starter Plan",
    rate: 2.5,
    minimum: "$35",
    maximum: "$3,000",
  },
  {
    name: "Regular Plan",
    rate: 10,
    minimum: "$3,001",
    maximum: "$10,000",
  },
  {
    name: "Pro Plan",
    rate: 20,
    minimum: "$10,000",
    maximum: "$20,000",
  },
  {
    name: "Premium Plan",
    rate: 35,
    minimum: "$20,001",
    maximum: "$UNLIMITED",
  },
];

const faqTabs = ["General", "Deposits", "Withdrawals"];

const faqContent = {
  General: [
    {
      question: "Who can register with MeridianVest?",
      answer: "Anyone who is of legal age can register with MeridianVest.",
    },
    {
      question: "How do I create a personal account?",
      answer:
        "Choose Sign Up, enter your personal details, add your wallet information, accept the terms, and submit the registration form.",
    },
    {
      question: "Do you keep the personal data of project participants safe?",
      answer:
        "Participant information is handled through protected account and platform processes. Members should also use strong, unique credentials.",
    },
    {
      question: "Can I create multiple accounts?",
      answer:
        "Create and use one personal account for your activity. Contact support if you need help with an existing account.",
    },
  ],
  Deposits: [
    {
      question: "What deposit currencies are supported?",
      answer:
        "The platform lists Dash, BNB, Tron, Tether TRC20, XRP, XLM, Bitcoin, Ethereum, and Tether ERC20 deposit options.",
    },
    {
      question: "What are the package durations?",
      answer: "The public packages shown in the recording use a 14-calendar-day duration.",
    },
    {
      question: "Will my deposit be returned?",
      answer:
        "The recorded package cards show Deposit Return: Yes. Review current terms carefully before committing funds.",
    },
  ],
  Withdrawals: [
    {
      question: "How long does it take for my withdrawal to be sent?",
      answer:
        "Withdrawal timing depends on account review, network confirmation, and platform processing. Contact support for the current processing window.",
    },
    {
      question: "Are there any withdrawal fees?",
      answer:
        "The recording lists network-specific fees, including approximately $1 for Dash, $10 for BNB, Tron, Tether TRC20, XRP, and XLM, and $25 for Bitcoin, Ethereum, and Tether ERC20.",
    },
    {
      question: "Which wallet addresses can I use?",
      answer:
        "Wallet details should match the selected network. Verify every address before submitting a withdrawal request.",
    },
  ],
};

function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const selected = languageOptions.find(([code]) => code === language) || languageOptions[0];

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Select language</span>
      <span className="text-lg leading-none" aria-hidden="true">
        {selected[2]}
      </span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        className="cursor-pointer bg-transparent text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-200 outline-none"
        aria-label="Select language"
      >
        {languageOptions.map(([code, label]) => (
          <option key={code} value={code} className="bg-[#101d30] text-white">
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="hidden h-[54px] border-t border-white/10 bg-[#101d30] lg:block">
        <div className="mx-auto flex h-full w-[min(1160px,calc(100%-2rem))] items-center justify-between gap-8 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-200 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
          <div className="flex items-center gap-8">
            <LanguageSelector />
            <span>MeridianVest Crypto Management Group</span>
          </div>
          <div className="flex items-center gap-7">
            <a href="mailto:support@meridianvest.org" className="hover:text-sky-400">
              Support
            </a>
            <span>Group</span>
            <a href="mailto:support@meridianvest.org" className="hover:text-sky-400">
              support@meridianvest.org
            </a>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c1422]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[76px] w-[min(1160px,calc(100%-2rem))] items-center justify-between gap-4 sm:h-[88px] sm:w-[min(1160px,calc(100%-3rem))] lg:h-[96px] lg:w-[min(1160px,calc(100%-5rem))]">
          <Link to="/" className="flex items-center" aria-label="MeridianVest home">
            <span className="text-2xl font-extrabold tracking-[-0.06em] text-white sm:text-3xl">
              Meridian<span className="text-sky-400">Vest</span>
            </span>
          </Link>
          <nav
            className={`absolute left-0 right-0 top-[76px] flex-col gap-5 border-b border-white/10 bg-[#0c1422] p-6 shadow-xl shadow-slate-950/30 sm:top-[88px] md:static md:ml-auto md:flex md:flex-row md:items-center md:gap-9 md:border-0 md:bg-transparent md:p-0 md:shadow-none ${menuOpen ? "flex" : "hidden md:flex"}`}
            aria-label="Main navigation"
          >
            {navItems.map(({ label, to }) => (
              <NavLink
                key={label}
                to={to}
                onClick={() => setMenuOpen(false)}
                className="text-[12px] font-bold tracking-[0.08em] text-slate-200 transition hover:text-sky-400"
              >
                {label}
              </NavLink>
            ))}
            <div className="border-b border-white/10 pb-5 md:hidden">
              <LanguageSelector />
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 md:hidden">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="text-[12px] font-bold tracking-[0.08em] text-slate-200 hover:text-sky-400"
              >
                Login
              </Link>
              <Link
                to="/signup"
                onClick={() => setMenuOpen(false)}
                className="text-[12px] font-bold tracking-[0.08em] text-sky-400"
              >
                Sign up
              </Link>
            </div>
          </nav>
          <div className="ml-6 hidden items-center gap-4 md:flex">
            <Link
              to="/login"
              className="inline-flex h-[34px] min-w-[76px] items-center justify-center rounded-[3px] border border-white/10 bg-white px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-900 transition hover:-translate-y-0.5"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-[34px] min-w-[76px] items-center justify-center rounded-[3px] bg-sky-400 px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5"
            >
              Sign up
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Menu size={18} />
          </button>
        </div>
      </header>
    </>
  );
}

function SiteFooter() {
  return (
    <>
      <footer className="bg-gradient-to-b from-black to-[#17181c]" aria-label="Site footer">
        <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] grid-cols-1 gap-8 py-12 sm:w-[min(1160px,calc(100%-3rem))] sm:grid-cols-2 sm:gap-10 sm:py-14 lg:w-[min(1160px,calc(100%-5rem))] xl:grid-cols-5">
          <div className="space-y-5 text-lg font-semibold text-white">
            <a
              href="mailto:support@meridianvest.org"
              className="flex items-center gap-5 hover:text-sky-400"
            >
              <Mail size={25} className="text-slate-400" /> Email Us
            </a>
            <Link to="/support" className="flex items-center gap-5 hover:text-sky-400">
              <Send size={25} className="text-slate-400" /> Support
            </Link>
            <a
              href="mailto:support@meridianvest.org"
              className="flex items-center gap-5 hover:text-sky-400"
            >
              <Send size={25} className="text-slate-400" /> Telegram Group
            </a>
          </div>
          <div>
            <h3 className="mb-6 text-lg font-semibold">Company</h3>
            <Link
              to="/about"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              About Us
            </Link>
            <Link
              to="/bonds"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              Our Packages
            </Link>
            <Link
              to="/faq"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              FAQ
            </Link>
          </div>
          <div>
            <h3 className="mb-6 text-lg font-semibold">Features</h3>
            <Link
              to="/bonds"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              Our Packages
            </Link>
            <Link
              to="/signup"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              Registration
            </Link>
          </div>
          <div>
            <h3 className="mb-6 text-lg font-semibold">Support</h3>
            <Link
              to="/faq"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              FAQ
            </Link>
            <Link
              to="/support"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              Contact Us
            </Link>
            <Link
              to="/login"
              className="mb-3 block text-sm text-slate-300 transition hover:text-sky-400"
            >
              Login
            </Link>
          </div>
          <div>
            <address className="not-italic text-base leading-7 text-white sm:text-xl sm:leading-8">
              MeridianVest
              <br />
              CRYPTO MANAGEMENT GROUP
              <br />
              The Mount, 47 Castle Bank, Stafford,
              <br />
              United Kingdom, ST16 1DP
            </address>
          </div>
        </div>
        <div className="border-t border-white/10 bg-[#0b1220]">
          <div className="mx-auto flex min-h-[52px] w-[min(1160px,calc(100%-2rem))] flex-col items-start justify-between gap-4 py-4 sm:w-[min(1160px,calc(100%-3rem))] sm:flex-row sm:items-center sm:gap-8 sm:py-3 lg:w-[min(1160px,calc(100%-5rem))]">
            <p className="m-0 text-[11px] font-bold text-slate-300">
              © 2026 MeridianVest. All rights reserved.
            </p>
            <div
              className="flex flex-wrap items-center justify-start gap-2 sm:justify-end"
              aria-label="Supported digital assets"
            >
              <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Networks
              </span>
              {coinAssets.map(([name, source]) => (
                <div
                  key={name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 p-1 transition hover:-translate-y-0.5 hover:border-sky-400"
                  title={name}
                >
                  <img
                    className="h-full w-full object-contain"
                    src={source}
                    alt={name}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>
      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-4 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-slate-900 shadow-xl shadow-slate-950/30 transition hover:-translate-y-1 hover:bg-cyan-400 sm:bottom-8 sm:right-6 sm:h-14 sm:w-14"
      >
        <ArrowUp size={22} className="sm:h-[30px] sm:w-[30px]" />
      </button>
    </>
  );
}

function PublicBackground() {
  return (
    <>
      <img
        className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover"
        src={imageSources.hero}
        alt=""
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#050b14]/[0.58]"
        aria-hidden="true"
      />
    </>
  );
}

function HomePage() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const testimonialViewportRef = useRef(null);

  function moveTestimonial(step) {
    setTestimonialIndex((current) => (current + step + testimonials.length) % testimonials.length);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      moveTestimonial(1);
    }, 3500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <>
      <div className="relative isolate min-h-screen overflow-x-clip bg-transparent text-white">
        <PublicBackground />
        <SiteHeader />

        <main>
          <section className="relative flex min-h-[620px] items-center overflow-hidden bg-[#050b14] sm:min-h-[690px]">
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src={imageSources.hero}
              alt="Modern glass buildings at night"
            />
            <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
            <div className="mx-auto w-[min(1160px,calc(100%-2rem))] relative py-20 sm:w-[min(1160px,calc(100%-3rem))] sm:py-24 lg:w-[min(1160px,calc(100%-5rem))]">
              <h1 className="max-w-[930px] text-[clamp(2.6rem,10vw,4.875rem)] font-bold leading-[1.04] tracking-[-0.06em] text-white">
                <span className="block animate-[fade-in_700ms_ease-out_both]">Experience The</span>
                <span className="block animate-[fade-in_700ms_250ms_ease-out_both]">
                  Convenience
                </span>
                <span className="block animate-[fade-in_700ms_500ms_ease-out_both]">
                  Of Stable Profits
                </span>
              </h1>
              <p className="mt-10 max-w-xl text-base font-bold leading-7 text-white sm:mt-16 sm:text-2xl sm:leading-8">
                Providing long-term solutions for reliable income possibilities!
              </p>
              <div className="mt-9 flex w-full flex-col gap-4 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-6 lg:gap-11">
                <Link
                  to="/signup"
                  className="inline-flex h-16 w-full items-center justify-center gap-4 rounded-md bg-gradient-to-r from-sky-500 to-cyan-400 px-6 text-base font-extrabold uppercase text-white transition hover:-translate-y-1 sm:h-[78px] sm:min-w-[250px] sm:w-auto sm:gap-6 sm:px-8 sm:text-xl"
                >
                  Sign me up <ArrowUpRight size={24} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-16 w-full items-center justify-center gap-4 rounded-md bg-yellow-300 px-6 text-base font-extrabold uppercase text-slate-900 transition hover:-translate-y-1 sm:h-[78px] sm:min-w-[250px] sm:w-auto sm:gap-6 sm:px-8 sm:text-xl"
                >
                  Member login <ArrowUpRight size={24} />
                </Link>
              </div>
            </div>
          </section>

          <section className="motion-safe:animate-[fade-in_700ms_ease-out_both] px-0 py-16 sm:py-[92px]">
            <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] items-center gap-16 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))] lg:grid-cols-[1fr_1.05fr]">
              <div>
                <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                  <span className="block h-2.5 w-2.5 bg-sky-400" /> What we do
                </div>
                <h2 className="text-4xl font-semibold tracking-[-0.05em] text-white md:text-[39px]">
                  Maximize Your Earnings with MeridianVest Today
                </h2>
                <p className="mt-5 text-sm leading-8 text-slate-300">
                  Use our technology, investment plans, support team, and real-time insights to make
                  your member experience clear from registration through withdrawal.
                </p>
                <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-300">
                  <li>
                    MeridianVest is an innovative platform designed to work in a new era of
                    crypto management.
                  </li>
                  <li>
                    Our automated strategies identify profit making opportunities across different
                    crypto ecosystems.
                  </li>
                  <li>
                    Our platform seamlessly integrates advanced technological tools, making
                    sophisticated crypto management strategies accessible.
                  </li>
                </ul>
              </div>
              <img
                className="h-[380px] w-full rounded-b-[10px] object-cover"
                src={imageSources.feature}
                alt="Investment professionals reviewing live market charts"
              />
            </div>
          </section>

          <section className="motion-safe:animate-[fade-in_700ms_150ms_ease-out_both] px-0 py-16 sm:py-[94px]">
            <div className="mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
              <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Why MeridianVest
              </div>
              <h2 className="mb-14 text-center text-4xl font-semibold tracking-[-0.05em] text-white md:text-[39px]">
                Built for a simpler investment experience.
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map(({ title, description, image, action }, index) => (
                  <article
                    key={title}
                    className="group flex min-h-[430px] flex-col overflow-hidden rounded-lg border border-white/10 bg-black transition duration-300 motion-safe:opacity-0 motion-safe:animate-[slide-up_700ms_cubic-bezier(0.22,1,0.36,1)_both] hover:-translate-y-2 hover:border-sky-400/60 hover:shadow-2xl hover:shadow-sky-500/20 sm:min-h-[470px]"
                    style={{ animationDelay: `${index * 180}ms` }}
                  >
                    <div className="mx-2 mt-2 flex h-[140px] items-center justify-center rounded-t-md bg-[#0d1728] transition duration-300 group-hover:bg-gradient-to-r group-hover:from-sky-600 group-hover:to-cyan-400">
                      <img
                        className="h-[128px] w-[128px] rounded-full object-cover transition duration-300 group-hover:scale-105"
                        src={image}
                        alt=""
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-center px-4 pb-6 pt-10 text-center">
                      <h3 className="mb-5 text-lg font-semibold leading-tight text-white transition duration-300 group-hover:text-[26px]">
                        {title}
                      </h3>
                      <p className="text-[11px] leading-7 text-slate-300 transition duration-300 group-hover:text-[16px] group-hover:leading-7">
                        {description}
                      </p>
                    </div>
                    <Link
                      to={
                        action === "Our Packages"
                          ? "/bonds"
                          : action === "Contact Us"
                            ? "/support"
                            : action === "Login To Account"
                              ? "/login"
                              : "/signup"
                      }
                      className="mx-4 mb-4 flex h-[66px] items-center justify-center gap-4 rounded-md bg-[#24252a] text-[18px] font-extrabold uppercase tracking-[0.04em] text-white transition duration-300 hover:-translate-y-0.5 group-hover:bg-gradient-to-r group-hover:from-sky-500 group-hover:to-cyan-400"
                    >
                      {action} <ArrowUpRight size={23} />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="motion-safe:animate-[fade-in_700ms_300ms_ease-out_both] bg-[#202125] px-4 py-16 sm:py-[92px]">
            <div className="mx-auto w-[min(1160px,calc(100%-2rem))] text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
              <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Member&apos;s Guide
              </div>
              <h2 className="mx-auto mb-14 max-w-[560px] text-4xl font-bold leading-[1.15] tracking-[-0.05em] text-white md:text-[39px]">
                A Few Simple Steps
                <br />
                To Start Earning
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {guideSteps.map(({ label, image }) => (
                  <article
                    key={label}
                    className="flex h-[217px] flex-col items-center justify-center rounded-md bg-[#393a3c] px-5 transition hover:-translate-y-1 hover:bg-[#414246]"
                  >
                    <img className="mb-7 h-[58px] w-[58px] object-contain" src={image} alt="" />
                    <p className="max-w-[150px] text-sm font-medium leading-5 text-white">
                      {label}
                    </p>
                  </article>
                ))}
              </div>
              <p className="mx-auto mt-14 max-w-[560px] text-xs font-medium leading-6 text-white">
                Begin your journey with our crypto management platform today.
                <br />
                It&apos;s simple and straightforward.
              </p>
              <Link
                to="/signup"
                className="mt-8 inline-flex h-[40px] min-w-[155px] items-center justify-center gap-4 rounded-md bg-yellow-300 px-6 text-[11px] font-extrabold uppercase text-slate-900 transition hover:-translate-y-0.5"
              >
                Sign me up <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <section className="motion-safe:animate-[fade-in_700ms_ease-out_both] px-0 py-16 sm:py-[82px]">
            <div className="mx-auto w-[min(1160px,calc(100%-2rem))] text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
              <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-0.5 w-4 bg-slate-300" /> Testimonial
              </div>
              <h2 className="mx-auto mb-16 max-w-[700px] text-3xl font-bold leading-[1.15] tracking-[-0.04em] text-white md:text-[39px]">
                Our Members Investments &amp; Profits Experience
              </h2>
              <div
                ref={testimonialViewportRef}
                className="relative isolate mx-auto max-w-[1180px] overflow-hidden py-2"
                aria-label="Member testimonials"
                aria-live="polite"
                role="region"
              >
                <div
                  className="flex items-stretch motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    transform: `translate3d(-${testimonialIndex * 100}%, 0, 0)`,
                  }}
                >
                  {testimonials.map((item, index) => (
                    <article
                      key={item.author}
                      className="w-full shrink-0 px-4 sm:px-10"
                      aria-hidden={index !== testimonialIndex}
                    >
                      <div className="mx-auto flex min-h-[250px] max-w-[820px] flex-col items-center">
                        <div className="h-[70px] text-7xl leading-none text-yellow-300">“</div>
                        <blockquote className="text-center text-base leading-8 text-white sm:text-lg md:text-xl">
                          “{item.quote}”
                        </blockquote>
                        <cite className="mt-8 block text-[10px] font-extrabold uppercase tracking-[0.28em] not-italic text-white">
                          {item.author}
                        </cite>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex justify-center gap-3">
                <button
                  type="button"
                  aria-label="Previous testimonial"
                  onClick={() => moveTestimonial(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-900 transition hover:bg-sky-400"
                >
                  <ChevronRight size={14} className="rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Next testimonial"
                  onClick={() => moveTestimonial(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-900 transition hover:bg-sky-400"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>

          <section className="motion-safe:animate-[fade-in_700ms_150ms_ease-out_both] bg-[#202125] px-4 py-16 sm:py-[94px]">
            <div className="mx-auto flex w-[min(1160px,calc(100%-2rem))] flex-col items-center text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
              <p className="max-w-[740px] text-2xl font-medium leading-10 text-white">
                Begin your journey with our crypto management platform today.
                <br />
                It's simple and straightforward.
              </p>
              <Link
                to="/signup"
                className="mt-14 inline-flex h-[78px] min-w-[310px] items-center justify-center gap-6 rounded-md bg-yellow-300 px-8 text-xl font-extrabold uppercase text-slate-900 transition hover:-translate-y-1"
              >
                Sign me up <ArrowUpRight size={24} />
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

function AboutPage() {
  return (
    <div className="relative isolate min-h-screen bg-transparent text-white">
      <PublicBackground />
      <SiteHeader />
      <main>
        <section className="relative grid min-h-[clamp(16rem,35vw,20rem)] place-items-center overflow-hidden text-center">
          <img
            src={imageSources.hero}
            alt="Modern glass financial district buildings"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#050b14]/[0.72]" aria-hidden="true" />
          <div className="relative z-10 mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <h1 className="mb-6 text-4xl font-semibold tracking-[-0.05em] text-white md:text-[42px]">
              About MeridianVest.
            </h1>
            <p className="flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-200">
              <Link to="/" className="text-sky-400">
                Home
              </Link>{" "}
              / About Us
            </p>
          </div>
        </section>

        <section className="bg-transparent">
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] min-h-[290px] gap-10 py-16 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))] md:grid-cols-3">
            <article className="grid grid-cols-[auto_1fr] items-start gap-5">
              <ShieldCheck size={42} />
              <div>
                <h2 className="mb-5 text-2xl font-semibold">Trust-centered service</h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  Every interaction is shaped around clarity, responsiveness, and long-tail member
                  confidence.
                </p>
              </div>
            </article>
            <article className="grid grid-cols-[auto_1fr] items-start gap-5">
              <CreditCard size={42} />
              <div>
                <h2 className="mb-5 text-2xl font-semibold">Stable capital pathways</h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  We curate options that aim to preserve principal, support income, and maintain
                  operational transparency.
                </p>
              </div>
            </article>
            <article className="grid grid-cols-[auto_1fr] items-start gap-5">
              <Star size={42} />
              <div>
                <h2 className="mb-5 text-2xl font-semibold">Disciplined execution</h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  Members gain access to opportunities supported by research, structure, and a
                  disciplined review process.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-[#050b14]/55 py-[110px]">
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] items-center gap-16 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))] lg:grid-cols-[0.92fr_1.08fr]">
            <div>
              <div className="mb-8 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Our story
              </div>
              <h2 className="mb-14 text-4xl font-semibold tracking-[-0.05em] text-white md:text-[47px]">
                Crypto management made clearer and more intentional.
              </h2>
              <ul className="list-disc space-y-6 pl-5 text-sm leading-8 text-slate-300">
                <li>
                  MeridianVest was designed for members who want a simpler pathway into
                  crypto investment and earning opportunities.
                </li>
                <li>
                  We prioritize clarity in presentation, communication, and onboarding so members
                  can understand each step before they act.
                </li>
                <li>
                  Our public experience brings packages, member support, and account tools together
                  in one place.
                </li>
              </ul>
            </div>
            <img
              className="min-h-[480px] w-full rounded-b-[10px] object-cover"
              src={imageSources.feature}
              alt="Investment professionals reviewing live market charts"
            />
          </div>
        </section>
        <section className="bg-[#101d30]/75 pb-20 pt-0">
          <div className="mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <img
              className="mx-auto w-full max-w-[720px]"
              src={imageSources.certificate}
              alt="Company certificate of incorporation"
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function BondsPage() {
  return (
    <div className="relative isolate min-h-screen bg-transparent text-white">
      <PublicBackground />
      <SiteHeader />

      <main className="bg-[#202125]/70 px-4 py-16 sm:py-[94px]">
        <div className="mx-auto w-full max-w-[1160px]">
          <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
            <span className="block h-2.5 w-2.5 bg-sky-400" /> Our packages
          </div>
          <h2 className="mb-14 text-center text-4xl font-semibold tracking-[-0.05em] text-white md:text-[39px]">
            Choose the structure that fits your capital goals.
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(({ name, rate, minimum, maximum }, index) => (
              <article
                key={name}
                className={`group flex min-h-[510px] flex-col rounded-xl p-6 text-slate-900 shadow-xl shadow-slate-950/30 transition duration-500 ease-out motion-safe:animate-[fade-in_650ms_ease-out_both] hover:-translate-y-3 hover:shadow-2xl hover:shadow-cyan-500/20 ${
                  index >= 2 ? "bg-cyan-100" : "bg-white"
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="mb-5 inline-flex self-start rounded-full bg-gradient-to-r from-sky-400 to-sky-500 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
                  {name}
                </div>
                <div className="flex items-start text-7xl font-extrabold leading-none tracking-[-0.08em] text-slate-900">
                  {rate}
                  <span className="ml-2 pt-2 text-2xl tracking-normal">%</span>
                </div>
                <ul className="mt-9 flex-1 space-y-6 text-left text-[11px] text-slate-800">
                  {[
                    ["Minimum deposit", minimum],
                    ["Maximum deposit", maximum],
                    ["Daily yield", `${rate}%`],
                    ["Duration", "14 Calendar Days"],
                    ["Deposit return", "YES"],
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
              </article>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function FaqPage() {
  const [activeTab, setActiveTab] = useState("General");
  const [openQuestion, setOpenQuestion] = useState(faqContent.General[0].question);

  function selectTab(tab) {
    setActiveTab(tab);
    setOpenQuestion(faqContent[tab][0].question);
  }

  return (
    <div className="relative isolate min-h-screen bg-transparent text-white">
      <PublicBackground />
      <SiteHeader />

      <main className="bg-[#07111d]/70 py-[94px]">
        <div className="mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
          <div className="mb-14 flex flex-wrap justify-center gap-3">
            {faqTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={
                  tab === activeTab
                    ? "h-[42px] min-w-[120px] rounded-full bg-sky-400 px-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-950"
                    : "h-[42px] min-w-[120px] rounded-full border border-white/10 bg-white/5 px-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-100"
                }
                onClick={() => selectTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> FAQ
              </div>
              <h2 className="mb-5 text-4xl font-semibold tracking-[-0.05em] text-white md:text-[42px]">
                Answers for members who value clarity.
              </h2>
              <p className="text-sm leading-7 text-slate-300">
                We focus on straightforward explanations, transparent decision points, and useful
                guidance at each stage of the journey.
              </p>
            </div>
            <div className="space-y-4 border-t border-white/10 pt-4">
              {faqContent[activeTab].map(({ question, answer }) => (
                <div key={question} className="rounded-lg border border-white/10 bg-[#0d1728]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 p-5 text-left text-lg font-semibold text-white transition hover:text-sky-400"
                    aria-expanded={openQuestion === question}
                    onClick={() =>
                      setOpenQuestion((current) => (current === question ? "" : question))
                    }
                  >
                    {question}
                    <ChevronRight
                      size={20}
                      className={`shrink-0 transition-transform ${openQuestion === question ? "rotate-90 text-sky-400" : ""}`}
                    />
                  </button>
                  {openQuestion === question && (
                    <p className="px-5 pb-5 text-sm leading-7 text-slate-300">{answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function SupportPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      if (!user) {
        throw new Error("Please sign in before sending a support request.");
      }

      if (!firestoreDb) {
        throw new Error("Support is unavailable until Firebase is configured.");
      }

      await setDoc(doc(collection(firestoreDb, "users", user.uid, "supportTickets")), {
        fullName: formData.get("fullName"),
        email: user.email || formData.get("email"),
        subject: `Support request from ${formData.get("fullName")}`,
        message: formData.get("message"),
        status: "open",
        createdAt: serverTimestamp(),
      });

      setMessage("Thanks. Your support request was sent successfully.");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send your request right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen bg-transparent text-white">
      <PublicBackground />
      <SiteHeader />

      <main className="bg-[#07111d]/70">
        <section className="relative grid min-h-[clamp(16rem,35vw,20rem)] place-items-center overflow-hidden text-center">
          <img
            src={imageSources.hero}
            alt="Modern buildings used as the Support Center backdrop"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#050b14]/[0.72]" aria-hidden="true" />
          <div className="relative z-10 mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <h1 className="mb-6 text-5xl font-semibold tracking-[-0.05em] text-white md:text-[64px]">
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
        <section className="py-[94px]">
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] gap-12 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))] lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Support
              </div>
              <h2 className="mb-5 text-4xl font-semibold tracking-[-0.05em] text-white md:text-[43px]">
                Request assistance.
              </h2>
              <p className="mb-9 text-sm leading-8 text-slate-300">
                Request assistance with registration, packages, deposits, withdrawals, or any other
                part of your MeridianVest member experience.
              </p>
              <a
                href="mailto:support@meridianvest.org"
                className="mb-5 flex items-center gap-4 text-sm text-slate-200 hover:text-sky-400"
              >
                <Mail size={18} /> support@meridianvest.org
              </a>
              <div className="flex items-center gap-4 text-sm text-slate-200">
                <MapPin size={18} /> MeridianVest Crypto Management Group
              </div>
            </div>
            <form
              className="rounded-[0.625rem] border border-white/10 bg-[#050b14] p-5 shadow-[0_20px_45px_rgba(2,8,23,0.28)] sm:p-8"
              onSubmit={handleSubmit}
            >
              <h3 className="mb-7 text-2xl font-semibold text-white">Send a message</h3>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Full name
                <input
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  required
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#101d30] px-3 text-sm text-white placeholder:text-slate-400 transition hover:border-sky-400/45 focus:border-sky-400 focus:bg-[#132238] focus:outline-none"
                />
              </label>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-[#101d30] px-3 text-sm text-white placeholder:text-slate-400 transition hover:border-sky-400/45 focus:border-sky-400 focus:bg-[#132238] focus:outline-none"
                />
              </label>
              <label className="mb-5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                Message
                <textarea
                  name="message"
                  placeholder="Tell us how we can help"
                  required
                  className="mt-2 min-h-[145px] w-full rounded-md border border-white/10 bg-[#101d30] px-3 py-3 text-sm text-white placeholder:text-slate-400 transition hover:border-sky-400/45 focus:border-sky-400 focus:bg-[#132238] focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-gradient-to-r from-sky-400 to-cyan-400 px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#082032] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(14,165,233,0.2)]"
              >
                {loading ? "Sending..." : "Submit request"}
              </button>
              {message && (
                <p className="mt-4 text-sm text-yellow-300" role="status">
                  {message}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function LoginPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      if (!firebaseAuth) throw new Error("Firebase is not configured.");

      const email = await resolveLoginEmail(formData.get("identifier") || "");
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        formData.get("password"),
      );

      await reload(credential.user);

      if (!credential.user.emailVerified) {
        await signOut(firebaseAuth);
        setMessage(
          "Please verify your email before signing in. Check your inbox and spam folder.",
        );
        return;
      }

      setMessage("Signed in successfully.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error, "Unable to sign in right now."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b14] text-white">
      <div className="pointer-events-none absolute -left-32 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-15rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex h-[76px] items-center justify-between border-b border-white/10 px-5 sm:px-10">
        <Link
          to="/"
          aria-label="Back to home"
          className="flex items-center gap-2 text-sm font-bold text-slate-300 transition hover:text-white"
        >
          <span className="text-lg">←</span> Back to home
        </Link>
        <Link to="/signup" className="text-sm font-bold text-sky-300 transition hover:text-cyan-200">
          Create account <span className="ml-1">↗</span>
        </Link>
      </div>

      <div className="relative mx-auto grid w-[min(1120px,calc(100%-2rem))] items-center gap-10 py-12 sm:w-[min(1120px,calc(100%-4rem))] lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
        <div className="hidden lg:block">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Private member access
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-[-0.06em] text-white xl:text-6xl">
            Your next move starts with clarity.
          </h1>
          <p className="mt-6 max-w-md text-base leading-8 text-slate-400">
            Enter your member portal to review opportunities, follow your portfolio, and keep every important update in one place.
          </p>
          <div className="mt-10 flex items-center gap-4 text-sm text-slate-300">
            <div className="flex -space-x-2">
              <span className="h-9 w-9 rounded-full border-2 border-[#050b14] bg-sky-300" />
              <span className="h-9 w-9 rounded-full border-2 border-[#050b14] bg-cyan-300" />
              <span className="h-9 w-9 rounded-full border-2 border-[#050b14] bg-indigo-300" />
            </div>
            <span>Secure access for every member</span>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <img className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/20" src={imageSources.login} alt="" />
            <div>
              <p className="text-sm font-extrabold tracking-[-0.03em]">Meridian<span className="text-sky-400">Vest</span></p>
              <p className="mt-1 text-xs text-slate-400">Member portal</p>
            </div>
          </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">Welcome back</h2>
          <p className="text-sm leading-6 text-slate-400">
            Sign in to monitor your portfolio and opportunities.
          </p>
          <label className="block text-[12px] font-bold text-slate-200">
            <span className="mb-2 block">Email or username</span>
            <div className="flex h-[58px] w-full items-center rounded-xl border border-white/10 bg-[#081321] px-4 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
              <UserRound size={18} className="text-sky-300" />
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or username"
                required
                className="ml-3 h-full w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={async (event) => {
              const form = event.currentTarget.form;
              const identifier = form.elements.identifier.value.trim();
              setMessage("");

              if (!identifier) {
                setMessage("Enter your email address or username first.");
                return;
              }

              if (!firebaseAuth) {
                setMessage("Firebase is not configured.");
                return;
              }

              setLoading(true);

              try {
                const email = await resolveLoginEmail(identifier);
                await sendPasswordResetEmail(firebaseAuth, email);
                setMessage("Password reset instructions have been sent to your email.");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to send password reset instructions right now.",
                );
              } finally {
                setLoading(false);
              }
            }}
            className="text-left text-sm font-semibold text-sky-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forgot password?
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async (event) => {
              const form = event.currentTarget.form;
              const identifier = form.elements.identifier.value.trim();
              const password = form.elements.password.value;
              setMessage("");

              if (!identifier || !password) {
                setMessage("Enter your email or username and password first.");
                return;
              }

              if (!firebaseAuth) {
                setMessage("Firebase is not configured.");
                return;
              }

              setLoading(true);

              try {
                const email = await resolveLoginEmail(identifier);
                const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);

                if (credential.user.emailVerified) {
                  setMessage("This email address is already verified.");
                } else {
                  await sendEmailVerification(credential.user);
                  setMessage("A new verification email has been sent. Check your inbox and spam folder.");
                }
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Unable to resend the verification email right now.",
                );
              } finally {
                await signOut(firebaseAuth);
                setLoading(false);
              }
            }}
            className="text-left text-sm font-semibold text-sky-400 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Resend verification email
          </button>
          <label className="block text-[12px] font-bold text-slate-200">
            <span className="mb-2 block">Password</span>
            <div className="flex h-[58px] w-full items-center rounded-xl border border-white/10 bg-[#081321] px-4 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
              <ShieldCheck size={18} className="text-sky-300" />
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                className="ml-3 h-full w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </label>
          <button
            type="submit"
            className="mx-auto mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 px-5 text-sm font-extrabold uppercase tracking-[0.14em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,211,238,0.2)]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {message && (
            <p className="text-sm text-yellow-300" role="status">
              {message}
            </p>
          )}
          <div className="mt-6 text-center text-sm text-slate-200">
            <p>
              New here?{" "}
              <Link to="/signup" className="font-bold text-yellow-300">
                Create an account
              </Link>
            </p>
            <p>
              <Link to="/support" className="font-bold text-yellow-300">
                Need help?
              </Link>
            </p>
          </div>
        </form>
        </div>
      </div>

      <footer className="mx-auto mt-20 w-[calc(100%-96px)] border-t border-white/10 pt-8 text-center text-[10px] text-slate-300">
        MeridianVest © 2026 · <span>Private access made clear</span>
      </footer>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#07111d] text-sm text-slate-300">
        Checking your session...
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function DashboardPage() {
  const { user, loading: authLoading, signOutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileMessage, setProfileMessage] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    if (authLoading || !user || !firestoreDb) {
      if (!authLoading) {
        setProfileLoading(false);
      }
      return undefined;
    }

    let isCurrent = true;

    async function loadProfile() {
      try {
        const profileRef = doc(firestoreDb, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);
        let nextProfile = profileSnapshot.exists() ? profileSnapshot.data() : null;

        if (!nextProfile) {
          nextProfile = {
            fullName: user.displayName || "",
            email: user.email || "",
            username: user.displayName || user.email?.split("@")[0].toLowerCase() || "",
            role: "member",
            emailVerified: user.emailVerified,
            bitcoinWallet: "",
            usdtWallet: "",
            ethereumWallet: "",
            litecoinWallet: "",
          };
        } else if (!nextProfile.username) {
          nextProfile = {
            ...nextProfile,
            username: user.displayName || user.email?.split("@")[0].toLowerCase() || "",
          };
        }

        if (isCurrent) {
          setProfile(nextProfile);
        }

        const [notificationSnapshot, transactionSnapshot] = await Promise.all([
          getDocs(query(collection(firestoreDb, "users", user.uid, "notifications"), limit(10))),
          getDocs(query(collection(firestoreDb, "users", user.uid, "transactions"), limit(10))),
        ]);
        if (isCurrent) {
          setNotifications(notificationSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
          setRecentTransactions(transactionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        }
      } catch (error) {
        if (isCurrent) {
          setProfile({
            fullName: user.displayName || "",
            username: user.displayName || user.email?.split("@")[0].toLowerCase() || "",
            email: user.email || "",
            role: "member",
            emailVerified: user.emailVerified,
            bitcoinWallet: "",
            usdtWallet: "",
            ethereumWallet: "",
            litecoinWallet: "",
          });
          setProfileMessage(
            error?.code === "permission-denied"
              ? "Your account is signed in, but profile details are temporarily unavailable."
              : "Unable to load your profile details right now.",
          );
        }
      } finally {
        if (isCurrent) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isCurrent = false;
    };
  }, [authLoading, user]);

  const displayName =
    profile?.fullName || user?.displayName || user?.email?.split("@")[0] || "Member";
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const referralLink = `${window.location.origin}/signup?ref=${encodeURIComponent(
    profile?.username || user?.uid || "",
  )}`;

  async function handleSignOut() {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  async function copyReferralLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-h-screen bg-[#07111d] text-white">
      <header className="border-b border-white/10 bg-[#0d1728]">
        <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] items-center justify-between gap-4 py-4 sm:w-[min(1280px,calc(100%-3rem))]">
          <Link to="/" className="text-xl font-extrabold tracking-[-0.04em]">
            Meridian<span className="text-sky-400">Vest</span>
          </Link>
          <div className="relative flex items-center gap-3">
            <button
              type="button"
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-sky-400 hover:text-sky-400"
            >
              <span aria-hidden="true">🔔</span>
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-yellow-300 px-1 text-[9px] font-bold text-slate-950">
                2
              </span>
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-12 z-30 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#101d30] p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Notifications</h2>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-sky-400">{notifications.length} new</span>
                </div>
                <div className="mt-4 space-y-3 text-xs leading-5 text-slate-300">
                  {notifications.length > 0 ? notifications.map((notification) => (
                    <p key={notification.id} className="rounded-md bg-white/5 p-3">
                      {notification.message || notification.title || "You have a new account notification."}
                    </p>
                  )) : (
                    <p className="rounded-md bg-white/5 p-3">No new notifications.</p>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-white/15 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-400 hover:text-sky-400"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-[min(1280px,calc(100%-2rem))] gap-6 py-6 sm:w-[min(1280px,calc(100%-3rem))] lg:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border border-white/10 bg-[#0d1728] p-3 lg:min-h-[calc(100vh-9rem)]">
          <p className="px-3 pb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            Member portal
          </p>
          <nav className="grid gap-1 text-sm">
            {[
              ["Dashboard", "/dashboard"],
              ["Deposit", "/deposit"],
              ["Withdraw", "/withdraw"],
              ["Wallet / Profile", "/profile"],
              ["Transactions", "/transactions"],
              ["Support", "/support"],
              ["My Referral", "/referral"],
            ].map(([label, href]) => (
              <Link
                key={label}
                to={href}
                className={`rounded-md px-3 py-3 transition hover:bg-white/10 hover:text-sky-400 ${
                  location.pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">
                Account summary
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                Welcome, {displayName}.
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Your verified member portal and account activity at a glance.
              </p>
            </div>
            <Link
              to="/bonds"
              className="inline-flex items-center justify-center rounded-md bg-yellow-300 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5"
            >
              Invest now
            </Link>
          </div>
        {profileLoading && (
          <p className="mt-6 text-sm text-slate-400" role="status">
            Loading your profile...
          </p>
        )}
        {profileMessage && (
          <p className="mt-6 text-sm text-yellow-300" role="alert">
            {profileMessage}
          </p>
        )}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Available balance", "$0.00", "Ready for allocation"],
            ["Active deposit", "$0.00", "No active investments"],
            ["Total deposit", "$0.00", "All-time deposits"],
            ["Total withdrawal", "$0.00", "All-time withdrawals"],
          ].map(([label, value, detail]) => (
            <article key={label} className="rounded-lg border border-white/10 bg-[#0d1728] p-5 transition hover:-translate-y-1 hover:border-sky-400/50">
              <p className="text-xs font-semibold text-slate-400">{label}</p>
              <p className="mt-4 text-2xl font-bold text-white">{value}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
            </article>
          ))}
        </section>
        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-lg border border-white/10 bg-[#0d1728] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Popular market</h2>
              <Link to="/bonds" className="text-xs font-bold text-sky-400 hover:text-cyan-300">View packages</Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Bitcoin", "USDT", "Ethereum", "Litecoin"].map((asset) => (
                <div key={asset} className="flex items-center justify-between rounded-md bg-[#101d30] px-4 py-4">
                  <span className="text-sm font-semibold text-slate-200">{asset}</span>
                  <span className="text-xs text-slate-400">$0.00</span>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-lg border border-white/10 bg-[#0d1728] p-6">
            <h2 className="text-xl font-semibold">Earnings summary</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-400">Total earnings</p><p className="mt-2 text-xl font-bold">$0.00</p></div>
              <div><p className="text-slate-400">Registration date</p><p className="mt-2 text-xl font-bold">Today</p></div>
              <div><p className="text-slate-400">Last deposit</p><p className="mt-2 text-xl font-bold">$0.00</p></div>
              <div><p className="text-slate-400">Last withdrawal</p><p className="mt-2 text-xl font-bold">$0.00</p></div>
            </div>
          </article>
        </section>
        <section id="referral" className="mt-5 rounded-lg border border-white/10 bg-[#0d1728] p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-xl font-semibold">Invite your friends</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                Share your referral link and track referrals and commissions from your member account.
              </p>
            </div>
            <button type="button" onClick={copyReferralLink} className="rounded-md bg-sky-400 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300">
              {copied ? "Copied" : "Copy referral link"}
            </button>
          </div>
          <p className="mt-5 break-all rounded-md bg-[#101d30] px-4 py-3 text-xs text-slate-400">{referralLink}</p>
        </section>
        <section id="transactions" className="mt-5 rounded-lg border border-white/10 bg-[#0d1728] p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Recent transactions</h2>
            <span className="text-xs text-slate-400">
              {recentTransactions.length ? `${recentTransactions.length} found` : "No transactions found"}
            </span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <div className="grid min-w-[520px] grid-cols-3 border-b border-white/10 pb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              <span>Type</span><span>Amount</span><span>Date</span>
            </div>
            {recentTransactions.length ? recentTransactions.map((transaction) => (
              <div key={transaction.id} className="grid min-w-[520px] grid-cols-3 border-b border-white/5 py-3 text-sm text-slate-300">
                <span>{transaction.type || "Transaction"}</span>
                <span>{transaction.amount || "$0.00"} {transaction.currency || ""}</span>
                <span>{transaction.date || transaction.createdAt?.toDate?.().toLocaleDateString?.() || "—"}</span>
              </div>
            )) : <p className="py-8 text-center text-sm text-slate-400">Your recent deposits, withdrawals, and earnings will appear here.</p>}
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}

function MemberFeaturePage() {
 const { user, signOutUser } = useAuth();
 const navigate = useNavigate();
 const { pathname } = useLocation();
 const [copied, setCopied] = useState(false);
 const [saved, setSaved] = useState(false);
 const [profile, setProfile] = useState({});
 const [profileMessage, setProfileMessage] = useState("");
 const [selectedPackage, setSelectedPackage] = useState("Starter");
 const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("Bitcoin");
 const [depositAmount, setDepositAmount] = useState("35");
 const [selectedWithdrawalAsset, setSelectedWithdrawalAsset] = useState("Bitcoin");
 const [transactionType, setTransactionType] = useState("All transactions");
 const [transactionCurrency, setTransactionCurrency] = useState("All currencies");
 const [transactionFrom, setTransactionFrom] = useState("");
 const [transactionTo, setTransactionTo] = useState("");
 const packageDetails = {
   Starter: ["$35 - $499", "Flexible entry plan"],
   Regular: ["$500 - $4,999", "Balanced allocation"],
   Pro: ["$5,000 - $24,999", "Advanced strategy"],
   Premium: ["$25,000+", "Priority member support"],
 };

 useEffect(() => {
   if (pathname !== "/profile" || !user || !firestoreDb) return undefined;
   let active = true;
   getDoc(doc(firestoreDb, "users", user.uid))
     .then((snapshot) => {
       if (active && snapshot.exists()) setProfile(snapshot.data());
     })
     .catch(() => {
       if (active) setProfileMessage("Profile details could not be loaded.");
     });
   return () => {
     active = false;
   };
 }, [pathname, user]);

 async function saveProfile(event) {
   event.preventDefault();
   if (!user || !firestoreDb) {
     setProfileMessage("Profile saving is unavailable until Firebase is configured.");
     return;
   }
   const formData = new FormData(event.currentTarget);
   try {
     await setDoc(doc(firestoreDb, "users", user.uid), {
       fullName: formData.get("fullName")?.trim() || "",
       bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
       usdtWallet: formData.get("usdtWallet")?.trim() || "",
       ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
       litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
     }, { merge: true });
     setProfile((current) => ({
       ...current,
       fullName: formData.get("fullName")?.trim() || "",
       bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
       usdtWallet: formData.get("usdtWallet")?.trim() || "",
       ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
       litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
     }));
     setSaved(true);
     setProfileMessage("");
   } catch (error) {
     setProfileMessage(error?.code === "permission-denied"
       ? "Firestore permissions prevented saving your profile."
       : "Unable to save your profile right now.");
   }
 }

 const content = {
   "/deposit": {
     eyebrow: "Fund your account",
     title: "Choose an investment package",
     description: "Review the available plans and contact support to complete a verified allocation.",
     body: (
       <div className="space-y-5">
         <div className="rounded-xl border border-white/10 bg-[#101d30] p-5">
           <div className="grid gap-4 md:grid-cols-2">
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-300">Investment package</span>
               <select value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)} className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none">
                 {Object.keys(packageDetails).map((name) => <option key={name}>{name}</option>)}
               </select>
             </label>
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-300">Payment method</span>
               <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value)} className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none">
                 {["Bitcoin", "USDT", "Ethereum", "Litecoin"].map((asset) => <option key={asset}>{asset}</option>)}
               </select>
             </label>
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-300">Amount (USD)</span>
               <input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} type="number" min="35" step="0.01" className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none" />
             </label>
           </div>
           <div className="mt-5 flex flex-col justify-between gap-4 rounded-lg bg-[#081321] p-4 sm:flex-row sm:items-center">
             <div><p className="font-semibold">{selectedPackage} plan · {selectedPaymentMethod}</p><p className="mt-1 text-xs text-slate-400">{packageDetails[selectedPackage][0]} · {packageDetails[selectedPackage][1]}</p></div>
             <Link to="/support" className="inline-flex justify-center rounded-lg bg-sky-400 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-950">Continue with support</Link>
           </div>
         </div>
       </div>
     ),
   },
   "/withdraw": {
     eyebrow: "Withdraw funds",
     title: "Withdrawal overview",
     description: "Withdrawals become available when supported funds are credited to your account.",
     body: (
       <div className="space-y-5">
         <div className="rounded-xl border border-white/10 bg-[#101d30] p-5">
           <label className="block max-w-md">
             <span className="mb-2 block text-xs font-semibold text-slate-300">Withdrawal currency</span>
             <select value={selectedWithdrawalAsset} onChange={(event) => setSelectedWithdrawalAsset(event.target.value)} className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none">
               {["Bitcoin", "USDT", "Ethereum", "Litecoin"].map((asset) => <option key={asset}>{asset}</option>)}
             </select>
           </label>
           <div className="mt-5 grid gap-4 sm:grid-cols-3">
             {[["Processing", "$0.00"], ["Available", "$0.00"], ["Pending", "$0.00"]].map(([label, value]) => <article key={label} className="rounded-lg bg-[#081321] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></article>)}
           </div>
           <p className="mt-5 text-sm text-slate-400">Selected wallet: <span className="font-semibold text-slate-200">{selectedWithdrawalAsset}</span>. No withdrawable funds are currently available.</p>
         </div>
       </div>
     ),
   },
   "/transactions": {
     eyebrow: "Account history",
     title: "Transactions",
     description: "Review your deposits, withdrawals, earnings, and referral commissions in one place.",
     body: (
       <div className="space-y-5">
         <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
           {["All transactions", "Deposits", "Withdrawals", "Earnings", "Referral commission"].map((type) => (
             <button
               key={type}
               type="button"
               onClick={() => setTransactionType(type)}
               className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                 transactionType === type
                   ? "bg-sky-400 text-slate-950"
                   : "bg-[#101d30] text-slate-400 hover:text-white"
               }`}
             >
               {type}
             </button>
           ))}
         </div>
         <div className="rounded-xl border border-white/10 bg-[#101d30] p-5">
           <div className="grid gap-3 md:grid-cols-4">
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-400">Currency</span>
               <select
                 value={transactionCurrency}
                 onChange={(event) => setTransactionCurrency(event.target.value)}
                 className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
               >
                 {["All currencies", "Bitcoin", "USDT", "Ethereum", "Litecoin"].map((currency) => (
                   <option key={currency}>{currency}</option>
                 ))}
               </select>
             </label>
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-400">From date</span>
               <input
                 type="date"
                 value={transactionFrom}
                 onChange={(event) => setTransactionFrom(event.target.value)}
                 className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
               />
             </label>
             <label className="block">
               <span className="mb-2 block text-xs font-semibold text-slate-400">To date</span>
               <input
                 type="date"
                 value={transactionTo}
                 onChange={(event) => setTransactionTo(event.target.value)}
                 className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-slate-200 focus:border-sky-400 focus:outline-none"
               />
             </label>
             <div className="flex items-end">
               <button
                 type="button"
                 onClick={() => {
                   setTransactionType("All transactions");
                   setTransactionCurrency("All currencies");
                   setTransactionFrom("");
                   setTransactionTo("");
                 }}
                 className="h-12 w-full rounded-lg border border-white/15 px-4 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:border-sky-400 hover:text-sky-400"
               >
                 Clear filters
               </button>
             </div>
           </div>
         </div>
         <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101d30]">
           <div className="flex flex-col justify-between gap-2 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">
             <h2 className="font-semibold">{transactionType}</h2>
             <span className="text-xs text-slate-500">
               {transactionCurrency} · {transactionFrom || "Any date"} to {transactionTo || "Any date"}
             </span>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full min-w-[560px] text-left text-sm">
               <thead className="border-b border-white/10 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                 <tr>
                   <th className="px-5 py-4 font-extrabold">Type</th>
                   <th className="px-5 py-4 font-extrabold">Amount</th>
                   <th className="px-5 py-4 font-extrabold">Currency</th>
                   <th className="px-5 py-4 font-extrabold">Date</th>
                 </tr>
               </thead>
               <tbody>
                 <tr>
                   <td colSpan="4" className="px-5 py-16 text-center text-sm text-slate-400">
                     No transactions found for the selected filters.
                   </td>
                 </tr>
               </tbody>
             </table>
           </div>
         </div>
       </div>
     ),
   },
   "/referral": {
     eyebrow: "Invite your friends",
     title: "Referral center",
     description: "Share your referral link and track your member network.",
     body: (
       <div className="space-y-5">
         <div className="grid gap-4 sm:grid-cols-3">{[["Total referrals", "0"], ["Active referrals", "0"], ["Commission", "$0.00"]].map(([label, value]) => <article key={label} className="rounded-xl border border-white/10 bg-[#101d30] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></article>)}</div>
         <div className="rounded-xl border border-white/10 bg-[#101d30] p-5"><p className="text-sm font-semibold">Your referral link</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input readOnly value={`${window.location.origin}/signup?ref=${encodeURIComponent(user?.uid || "")}`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#081321] px-3 py-3 text-xs text-slate-300" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${encodeURIComponent(user?.uid || "")}`); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="rounded-lg bg-sky-400 px-4 py-3 text-xs font-bold text-slate-950">{copied ? "Copied" : "Copy link"}</button></div></div>
       </div>
     ),
   },
   "/profile": {
     eyebrow: "Account settings",
     title: "Wallet and profile",
     description: "Keep your contact information and supported wallet addresses up to date.",
     body: (
       <form key={profile.fullName || "profile"} onSubmit={saveProfile} className="grid gap-4 rounded-xl border border-white/10 bg-[#101d30] p-5 sm:grid-cols-2">
         <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">Full name</span><input name="fullName" defaultValue={profile.fullName || ""} className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none" /></label>
         <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">Email address</span><input value={user?.email || ""} readOnly className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-slate-400 focus:outline-none" /></label>
         {[
           ["bitcoinWallet", "Bitcoin wallet"],
           ["usdtWallet", "USDT wallet"],
           ["ethereumWallet", "Ethereum wallet"],
           ["litecoinWallet", "Litecoin wallet"],
         ].map(([name, label]) => <label key={name} className="block"><span className="mb-2 block text-xs font-semibold text-slate-300">{label}</span><input name={name} defaultValue={profile[name] || ""} className="h-12 w-full rounded-lg border border-white/10 bg-[#081321] px-3 text-sm text-white focus:border-sky-400 focus:outline-none" /></label>)}
         <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-sky-400 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-950">Save profile</button>{saved && <span className="ml-4 text-sm text-emerald-300">Profile saved.</span>}{profileMessage && <p className="mt-3 text-sm text-yellow-300" role="alert">{profileMessage}</p>}</div>
       </form>
     ),
   },
 }[pathname] || null;

 async function handleSignOut() {
   await signOutUser();
   navigate("/login", { replace: true });
 }

 return (
   <div className="min-h-screen bg-[#07111d] text-white">
     <header className="border-b border-white/10 bg-[#0d1728]"><div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] items-center justify-between py-4"><Link to="/dashboard" className="text-xl font-extrabold">Meridian<span className="text-sky-400">Vest</span></Link><button type="button" onClick={handleSignOut} className="rounded-md border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-sky-400 hover:text-sky-400">Sign out</button></div></header>
     <div className="mx-auto grid w-[min(1280px,calc(100%-2rem))] gap-6 py-6 lg:grid-cols-[220px_1fr]">
       <aside className="rounded-lg border border-white/10 bg-[#0d1728] p-3"><p className="px-3 pb-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Member portal</p><nav className="grid gap-1 text-sm">{[["Dashboard", "/dashboard"], ["Deposit", "/deposit"], ["Withdraw", "/withdraw"], ["Wallet / Profile", "/profile"], ["Transactions", "/transactions"], ["Support", "/support"], ["My Referral", "/referral"]].map(([label, href]) => <Link key={label} to={href} className={`rounded-md px-3 py-3 transition hover:bg-white/10 hover:text-sky-400 ${pathname === href ? "bg-sky-400/10 font-semibold text-sky-400" : "text-slate-300"}`}>{label}</Link>)}</nav></aside>
       <main><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-400">{content.eyebrow}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{content.title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">{content.description}</p><div className="mt-8">{content.body}</div></main>
     </div>
   </div>
 );
}

function SignupPage() {
  const location = useLocation();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      if (!firebaseAuth) throw new Error("Firebase is not configured.");

      const firstName = formData.get("firstName");
      const lastName = formData.get("lastName");
      const username = formData.get("username")?.trim().toLowerCase();
      const email = formData.get("email")?.trim().toLowerCase();
      const emailConfirmation = formData.get("emailConfirmation")?.trim().toLowerCase();
      const referralFromLink = new URLSearchParams(location.search).get("ref")?.trim() || "";
      const password = formData.get("password");
      const passwordConfirmation = formData.get("passwordConfirmation");

      if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
        throw new Error(
          "Choose a username with 3-30 lowercase letters, numbers, dots, underscores, or hyphens.",
        );
      }

      if (password !== passwordConfirmation) {
        throw new Error("Passwords do not match.");
      }

      if (email !== emailConfirmation) {
        throw new Error("Email addresses do not match.");
      }

      if (!formData.get("terms")) {
        throw new Error("Accept the terms and conditions to continue.");
      }

      if (!firestoreDb) throw new Error("Firestore is not configured.");
      const existingUsername = await getDoc(
        doc(firestoreDb, "usernames", username),
      );
      if (existingUsername.exists()) {
        throw new Error("That username is already in use. Choose another one.");
      }

      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password,
      );
      const fullName = `${firstName} ${lastName}`.trim();
      await updateProfile(credential.user, { displayName: username });
      await setDoc(doc(firestoreDb, "users", credential.user.uid), {
        fullName,
        username,
        email: credential.user.email,
        phone: formData.get("phone"),
        country: formData.get("country"),
        upline: formData.get("upline")?.trim() || referralFromLink,
        bitcoinWallet: formData.get("bitcoinWallet")?.trim() || "",
        usdtWallet: formData.get("usdtWallet")?.trim() || "",
        ethereumWallet: formData.get("ethereumWallet")?.trim() || "",
        litecoinWallet: formData.get("litecoinWallet")?.trim() || "",
        role: "member",
        emailVerified: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(firestoreDb, "usernames", username), {
        uid: credential.user.uid,
        email: credential.user.email,
      });
      await sendEmailVerification(credential.user);
      await signOut(firebaseAuth);
      setMessage("Account created. Check your email to confirm access.");
    } catch (error) {
      setMessage(
        getAuthErrorMessage(error, "Unable to create your account right now."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b14] px-4 pb-16 pt-8 text-slate-200 sm:px-6">
      <div className="pointer-events-none absolute right-[-12rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-sky-500/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-[1120px] items-center justify-between">
        <Link to="/" className="text-lg font-extrabold tracking-[-0.04em] text-white">
          Meridian<span className="text-sky-400">Vest</span>
        </Link>
      <div className="flex items-center gap-3 text-right text-xs font-semibold sm:text-sm">
        <span className="hidden sm:inline">Already a member?</span>
        <Link
          to="/login"
          className="inline-flex h-10 min-w-[86px] items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-200 transition hover:bg-sky-300/20"
        >
          Login
        </Link>
      </div>
      </div>
      <div className="relative mx-auto mt-12 w-full max-w-[900px] rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:mt-16 sm:p-10">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Start your journey
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Create your account</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Access private opportunities, allocation insights, and portfolio updates.
          </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">First name</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  required
                  autoComplete="given-name"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Last name</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  required
                  autoComplete="family-name"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Username</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9._-]{3,30}"
                  autoComplete="username"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <span className="mt-2 block text-xs text-slate-400">
                Use 3-30 letters, numbers, dots, underscores, or hyphens.
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Email address</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Confirm email</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="emailConfirmation"
                  name="emailConfirmation"
                  type="email"
                  placeholder="Confirm email address"
                  required
                  autoComplete="email"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Phone number</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone number"
                  autoComplete="tel"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Country</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <select
                  id="country"
                  name="country"
                  defaultValue=""
                  className="h-[58px] w-full bg-transparent text-white focus:outline-none"
                >
                  <option value="" disabled className="bg-[#1f2937]">
                    Select country
                  </option>
                  <option value="United States" className="bg-[#1f2937]">
                    United States
                  </option>
                  <option value="Canada" className="bg-[#1f2937]">
                    Canada
                  </option>
                  <option value="United Kingdom" className="bg-[#1f2937]">
                    United Kingdom
                  </option>
                  <option value="Nigeria" className="bg-[#1f2937]">
                    Nigeria
                  </option>
                  <option value="Other" className="bg-[#1f2937]">
                    Other
                  </option>
                </select>
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Password</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create password"
                  minLength="8"
                  required
                  autoComplete="new-password"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">
                Confirm password
              </span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  placeholder="Retype your password"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-slate-200">Upline or referral username</span>
              <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                <input
                  id="upline"
                  name="upline"
                  type="text"
                  placeholder="Optional referral username"
                  autoComplete="off"
                  className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </label>
            {[
              ["bitcoinWallet", "Bitcoin wallet address"],
              ["usdtWallet", "USDT wallet address"],
              ["ethereumWallet", "Ethereum wallet address"],
              ["litecoinWallet", "Litecoin wallet address"],
            ].map(([name, label]) => (
              <label key={name} className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-slate-200">{label}</span>
                <div className="w-full rounded-xl border border-white/10 bg-[#081321] px-3 transition hover:border-sky-400/45 focus-within:border-sky-400 focus-within:bg-[#0b1a2c]">
                  <input
                    id={name}
                    name={name}
                    type="text"
                    placeholder={`Optional ${label.toLowerCase()}`}
                    autoComplete="off"
                    className="h-[58px] w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-300">
            <input name="terms" type="checkbox" required className="mt-1 h-4 w-4 accent-sky-400" />
            <span>
              I agree to the{" "}
              <Link to="/support" className="text-sky-400 hover:text-cyan-300">terms and conditions</Link>
              {" "}and understand that investment outcomes are not guaranteed.
            </span>
          </label>
          <div className="mb-5 flex items-center gap-4 text-sm text-slate-200">
            <MapPin size={18} /> MeridianVest Crypto Management Group
          </div>
          <a
            href="mailto:support@meridianvest.org"
            className="flex items-center gap-4 text-sm text-slate-200 hover:text-sky-400"
          >
            <Mail size={18} /> Contact support
          </a>
          <button
            type="submit"
            className="mt-3 h-14 w-full rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 text-sm font-extrabold uppercase tracking-[0.12em] text-slate-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,211,238,0.2)]"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
          {message && (
            <p className="mt-3 text-sm text-yellow-300" role="status">
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/bonds" element={<BondsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        {["deposit", "withdraw", "profile", "transactions", "referral"].map((path) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <ProtectedRoute>
                <MemberFeaturePage />
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<HomePage />} />
      </Routes>
    </LanguageProvider>
  );
}
