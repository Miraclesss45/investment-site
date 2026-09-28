import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Mail, Menu, Send, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../../lib/i18nContext";
import { languageOptions } from "../../lib/i18nData";
import WhatsAppIcon, { WHATSAPP_URL } from "../ui/WhatsAppIcon";
import LanguageFlag from "../ui/LanguageFlag";
import SkipToContent from "../ui/SkipToContent";
import heroAsset from "../../assets/uploads/banner-5.webp";
import heroAssetMedium from "../../assets/uploads/banner-5-1440.webp";
import heroAssetSmall from "../../assets/uploads/banner-5-960.webp";
import bnbAsset from "../../assets/uploads/bnb.png";
import btcAsset from "../../assets/uploads/btc.png";
import ethAsset from "../../assets/uploads/eth.png";
import ltcAsset from "../../assets/uploads/ltc.png";

const navItems = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Our Packages", to: "/bonds" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact Us", to: "/support" },
];

const coinAssets = [
  ["BNB", bnbAsset],
  ["Bitcoin", btcAsset],
  ["Ethereum", ethAsset],
  ["Litecoin", ltcAsset],
];

function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const selected =
    languageOptions.find(([code]) => code === language) || languageOptions[0];

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Select language</span>
      <LanguageFlag countryCode={selected[2]} />
      <span className="relative">
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 py-2 pl-3 pr-8 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-200 outline-none transition hover:border-white/20 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 [color-scheme:dark]"
          aria-label="Select language"
        >
          {languageOptions.map(([code, label]) => (
            <option key={code} value={code} className="bg-[#101d30] text-white">
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-cyan-300"
        />
      </span>
    </label>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const firstMenuLinkRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    document.body.classList.add("overflow-hidden");
    firstMenuLinkRef.current?.focus();
    const closeMenu = () => {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    function closeOnEscape(event) {
      if (event.key === "Escape") closeMenu();
    }

    function closeOnOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuOpen]);

  useEffect(() => () => document.body.classList.remove("overflow-hidden"), []);

  return (
    <>
      <SkipToContent />
      <div className="hidden h-[54px] border-t border-white/10 bg-[#101d30] lg:block">
        <div className="mx-auto flex h-full w-[min(1160px,calc(100%-2rem))] items-center justify-between gap-8 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-200 sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
          <div className="flex items-center gap-8">
            <LanguageSelector />
            <span>MeridianVests Crypto Management Group</span>
          </div>
          <div className="flex items-center gap-7">
            <a
              href="mailto:meridianvest948@gmail.com"
              className="hover:text-sky-400"
            >
              Support
            </a>
            <a
              href="mailto:meridianvest948@gmail.com"
              className="hover:text-sky-400"
            >
              meridianvest948@gmail.com
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-green-400"
            >
              <WhatsAppIcon size={14} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
      <header
        ref={menuRef}
        className="sticky top-0 z-50 border-b border-white/10 bg-[#0c1422]/90 shadow-[0_12px_40px_rgba(2,8,23,0.16)] backdrop-blur-xl"
      >
        <div className="mx-auto flex h-[68px] w-[min(1160px,calc(100%-2rem))] items-center justify-between gap-4 sm:h-[78px] sm:w-[min(1160px,calc(100%-3rem))] lg:h-[86px] lg:w-[min(1160px,calc(100%-5rem))]">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="MeridianVests home"
          >
            <img
              className="h-9 w-9 rounded-lg object-cover sm:h-10 sm:w-10"
              src="/meridianvest-logo.svg"
              alt="MeridianVests logo"
              width="44"
              height="44"
            />
            <span className="text-2xl font-extrabold tracking-[-0.06em] text-white sm:text-3xl">
              Meridian<span className="text-sky-400">Vests</span>
            </span>
          </Link>
          <nav
            id="main-navigation"
            className={`absolute left-0 right-0 top-[68px] flex-col gap-5 overflow-x-hidden overflow-y-auto border-b border-white/10 bg-[#0c1422] px-6 shadow-xl shadow-slate-950/30 transition-[max-height,opacity,padding] duration-300 sm:top-[78px] lg:static lg:ml-auto lg:flex lg:max-h-none lg:flex-row lg:items-center lg:gap-9 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:opacity-100 lg:shadow-none ${menuOpen ? "visible flex max-h-[calc(100dvh-68px)] py-6 opacity-100 sm:max-h-[calc(100dvh-78px)]" : "invisible flex max-h-0 py-0 opacity-0 lg:visible lg:flex"}`}
            aria-label="Main navigation"
          >
            {navItems.map(({ label, to }, index) => (
              <NavLink
                key={label}
                to={to}
                onClick={() => setMenuOpen(false)}
                ref={index === 0 ? firstMenuLinkRef : undefined}
                className={({ isActive }) =>
                  `relative py-2 text-[12px] font-bold tracking-[0.08em] text-slate-200 transition hover:text-sky-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-sky-400 after:transition-all after:content-[''] ${isActive ? "after:w-full text-sky-400" : "after:w-0"}`
                }
              >
                {label}
              </NavLink>
            ))}
            <div className="border-b border-white/10 pb-5 lg:hidden">
              <LanguageSelector />
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 lg:hidden">
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
          {menuOpen && (
            <button
              type="button"
              aria-label="Close navigation overlay"
              className="fixed inset-0 top-[68px] -z-10 bg-slate-950/60 backdrop-blur-[2px] lg:hidden sm:top-[78px]"
              onClick={() => setMenuOpen(false)}
            />
          )}
          <div className="ml-6 hidden items-center gap-4 lg:flex">
            <Link
              to="/login"
              className="interactive-lift inline-flex h-[34px] min-w-[76px] items-center justify-center rounded-[3px] border border-white/10 bg-white px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-900 hover:border-cyan-200"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="interactive-lift inline-flex h-[34px] min-w-[76px] items-center justify-center rounded-[3px] bg-sky-400 px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-950 hover:bg-cyan-300"
            >
              Sign up
            </Link>
          </div>
          <button
            type="button"
            ref={menuButtonRef}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white lg:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => {
              if (menuOpen) menuButtonRef.current?.focus();
              setMenuOpen((current) => !current);
            }}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <>
      <footer
        className="border-t border-white/10 bg-[#050b14]"
        aria-label="Site footer"
      >
        <div className="mx-auto w-[min(1180px,calc(100%-2rem))] py-12 sm:w-[min(1180px,calc(100%-3rem))] sm:py-16 lg:w-[min(1180px,calc(100%-5rem))] lg:py-20">
          <div className="mb-12 grid gap-8 border-b border-white/10 pb-10 lg:mb-14 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:pb-12">
            <div className="max-w-lg">
              <Link
                to="/"
                className="inline-flex items-center gap-3 text-xl font-extrabold tracking-[-0.04em] text-white"
              >
                <img
                  className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-sky-950/20"
                  src="/meridianvest-logo.svg"
                  alt="MeridianVests logo"
                  width="40"
                  height="40"
                />
                Meridian<span className="text-sky-400">Vests</span>
              </Link>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
                A clearer way to stay close to your opportunities, portfolio,
                and next move.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 lg:min-w-[470px]">
              <a
                href="mailto:meridianvest948@gmail.com"
                className="group flex items-center gap-3 transition hover:text-sky-300"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-sky-300 transition group-hover:bg-sky-400/15">
                  <Mail size={17} />
                </span>
                <span>Email us</span>
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 transition hover:text-green-400"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-green-400 transition group-hover:bg-green-400/15">
                  <WhatsAppIcon size={17} />
                </span>
                <span>WhatsApp</span>
              </a>
              <Link
                to="/support"
                className="group flex items-center gap-3 transition hover:text-sky-300"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-sky-300 transition group-hover:bg-sky-400/15">
                  <Send size={17} />
                </span>
                <span>Support</span>
              </Link>
              <a
                href="mailto:meridianvest948@gmail.com?subject=MeridianVests%20community"
                className="group flex items-center gap-3 transition hover:text-sky-300"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-sky-300 transition group-hover:bg-sky-400/15">
                  <Send size={17} />
                </span>
                <span>Community email</span>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_1.4fr] lg:gap-16">
            <FooterNav
              title="Company"
              links={[
                ["About Us", "/about"],
                ["Our Packages", "/bonds"],
                ["FAQ", "/faq"],
              ]}
            />
            <FooterNav
              title="Features"
              links={[
                ["Our Packages", "/bonds"],
                ["Registration", "/signup"],
              ]}
            />
            <FooterNav
              title="Support"
              links={[
                ["FAQ", "/faq"],
                ["Contact Us", "/support"],
                ["Login", "/login"],
              ]}
            />
            <address className="col-span-2 not-italic text-sm leading-6 text-slate-400 sm:col-span-1">
              <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-300">
                Our office
              </p>
              <p className="font-semibold text-white">MeridianVests</p>
              <p className="mt-1">Crypto Management Group</p>
              <p className="mt-3">
                The Mount, 47 Castle Bank
                <br />
                Stafford, United Kingdom
                <br />
                ST16 1DP
              </p>
            </address>
          </div>
        </div>
        <div className="border-t border-white/10 bg-[#081321]">
          <div className="mx-auto flex w-[min(1180px,calc(100%-2rem))] flex-col gap-6 py-6 sm:w-[min(1180px,calc(100%-3rem))] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-5 lg:w-[min(1180px,calc(100%-5rem))]">
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              © 2026 MeridianVests. All rights reserved.
            </p>
            <div
              className="flex flex-wrap items-center gap-2 sm:justify-end"
              aria-label="Supported digital assets"
            >
              <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Supported assets
              </span>
              {coinAssets.map(([name, source]) => (
                <div
                  key={name}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 p-1 transition hover:-translate-y-0.5 hover:border-sky-400"
                  title={name}
                >
                  <img
                    className="h-full w-full object-contain"
                    src={source}
                    alt={name}
                    width="24"
                    height="24"
                    loading="lazy"
                    decoding="async"
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

function FooterNav({ title, links }) {
  return (
    <nav aria-label={`${title} links`}>
      <h3 className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-300">
        {title}
      </h3>
      {links.map(([label, to]) => (
        <Link
          key={label}
          to={to}
          className="mb-3 block text-sm text-slate-400 transition hover:text-white"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicBackground() {
  return (
    <>
      <img
        className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover"
        src={heroAsset}
        srcSet={`${heroAssetSmall} 960w, ${heroAssetMedium} 1440w, ${heroAsset} 1920w`}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="low"
        decoding="async"
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#050b14]/[0.58]"
        aria-hidden="true"
      />
    </>
  );
}

export function PublicPage({ children, className = "" }) {
  return (
    <div
      className={`relative isolate min-h-screen bg-transparent text-white ${className}`}
    >
      <PublicBackground />
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
