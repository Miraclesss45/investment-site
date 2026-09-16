import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Mail, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import banner from "@/assets/uploads/banner-5.jpg.asset.json";
import tradingDesk from "@/assets/uploads/image-1.png.asset.json";
import rocket from "@/assets/uploads/why1.png.asset.json";
import portfolio from "@/assets/uploads/why2.png.asset.json";
import btc from "@/assets/coins/btc.png.asset.json";
import usdt from "@/assets/coins/usdt.png.asset.json";
import usdtb from "@/assets/coins/usdtb.png.asset.json";
import usdttr from "@/assets/coins/usdttr.png.asset.json";
import ltc from "@/assets/coins/ltc.png.asset.json";
import eth from "@/assets/coins/eth.png.asset.json";
import bnb from "@/assets/coins/bnb.png.asset.json";
import doge from "@/assets/uploads/doge.png.asset.json";
import dash from "@/assets/uploads/dash.png.asset.json";
import xrp from "@/assets/uploads/xrp.png.asset.json";
import xlm from "@/assets/uploads/xlm.png.asset.json";
import trx from "@/assets/uploads/trx.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Legacy Pro Alliance | Crypto Management" },
      {
        name: "description",
        content: "Build long-term cryptocurrency earnings with accessible investment plans and expert support.",
      },
      { property: "og:title", content: "Legacy Pro Alliance | Crypto Management" },
      {
        property: "og:description",
        content: "Accessible cryptocurrency management plans designed for steady long-term earnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    title: "Advanced Technology",
    copy: "Utilize our advanced technological tools to effortlessly earn stable long-term profits.",
    action: "Our Packages",
    position: "22% center",
  },
  {
    title: "Seamless Investments",
    copy: "Purchase our plans with ease, and start earning without the hassle of setting up complex software.",
    action: "Register Now",
    position: "46% center",
  },
  {
    title: "Comprehensive Support",
    copy: "Our dedicated support team is here to assist you 24/7/365 to give you the premium investing experience.",
    action: "Contact Us",
    position: "61% center",
  },
  {
    title: "Real-Time Earning Insights",
    copy: "Stay updated with real-time insights on your daily earnings and investment performance.",
    action: "Login To Account",
    position: "86% center",
  },
];

const steps = [
  { image: rocket.url, title: "Sign Up For A Free Account" },
  { image: portfolio.url, title: "Choose An Investment Bond" },
  { symbol: "📊", title: "Check Earnings Daily" },
  { symbol: "💳", title: "Withdraw Anytime You Like" },
];

const testimonials = [
  {
    quote:
      "I Like The Different Types Of Investment Bonds Offered At Legacyproalliance.Org, And The Stable, Regular, Long-Term Returns On My Investments.",
    name: "Richard Trump",
  },
  {
    quote:
      "It's The Best Online Investment Opportunity I Have Come Across. Legacyproalliance.Org Is The Best. Keep It Up. Let's Build Our Future Together.",
    name: "Simone Rose",
  },
  {
    quote:
      "Such A Smooth Investment Experience. Your Support Is World Class. Long Live Legacyproalliance.Org. I Will Recommend Legacyproalliance.Org To All My Friends And Family.",
    name: "Andrew Phillips",
  },
];

const coinIcons = [btc, usdt, usdtb, usdttr, ltc, eth, bnb, trx, doge, dash, xrp, xlm];

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-bar brand-bar-one" />
      <span className="brand-bar brand-bar-two" />
      <span className="brand-cut" />
    </span>
  );
}

function Logo() {
  return (
    <a href="#home" className="brand" aria-label="Legacy Pro Alliance home">
      <Mark />
      <span>LEGACY PRO <b>ALLIANCE</b></span>
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label">
      <span />
      {children}
    </div>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [testimonial, setTestimonial] = useState(1);
  const [isExiting, setIsExiting] = useState(false);
  const [isBlank, setIsBlank] = useState(false);
  const [pendingDirection, setPendingDirection] = useState(1);
  const [tick, setTick] = useState(0);
  const [stepsInView, setStepsInView] = useState(false);
  const isTransitioningRef = useRef(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  const activeTestimonial = testimonials[testimonial] ?? testimonials[0];

  useEffect(() => {
    const interval = setInterval(() => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      setPendingDirection(1);
      setIsExiting(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    if (!isExiting || isBlank) return;
    const exitTimeout = setTimeout(() => {
      setTestimonial((current) => (current + pendingDirection + testimonials.length) % testimonials.length);
      setIsBlank(true);
    }, 500);
    return () => clearTimeout(exitTimeout);
  }, [isExiting, isBlank, pendingDirection]);

  useEffect(() => {
    if (!isBlank) return;
    const blankTimeout = setTimeout(() => {
      setIsBlank(false);
      setIsExiting(false);
      isTransitioningRef.current = false;
    }, 800);
    return () => clearTimeout(blankTimeout);
  }, [isBlank]);

  const moveTestimonial = (direction: number) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setPendingDirection(direction);
    setIsExiting(true);
    setTick((t) => t + 1);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell" id="home">
      <header className="site-header">
        <div className="site-width header-inner">
          <Logo />
          <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#about" onClick={closeMenu}>About Us</a>
            <a href="#packages" onClick={closeMenu}>Our Packages</a>
            <a href="#faq" onClick={closeMenu}>FAQ</a>
            <a href="#contact" onClick={closeMenu}>Contact Us</a>
          </nav>
          <div className="header-actions">
            <Button asChild className="header-signup"><a href="#signup">Sign Up</a></Button>
            <Button asChild variant="outline" className="header-login"><a href="#contact">Log In</a></Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <img className="hero-image" src={banner.url} alt="Modern glass financial district buildings" />
          <div className="hero-shade" />
          <div className="site-width hero-content">
            <SectionLabel>Welcome To Legacy Pro Alliance</SectionLabel>
            <h1 id="hero-title">Invest Today.<br />Secure Tomorrow.</h1>
            <p>
              Build a stronger financial future through smart, accessible cryptocurrency management
              plans designed around steady long-term growth.
            </p>
            <Button asChild className="blue-action"><a href="#packages">Our Packages <ArrowRight /></a></Button>
          </div>
        </section>

        <section className="about section-dark" id="about">
          <div className="site-width about-grid">
            <div className="about-copy">
              <SectionLabel>About Our Company</SectionLabel>
              <h2>A Smarter Way To Grow Your Crypto Portfolio</h2>
              <p>
                Legacy Pro Alliance provides a straightforward route into digital asset management,
                pairing secure opportunities with a dedicated support team.
              </p>
              <ul>
                <li>Choose a plan designed around your investment goals.</li>
                <li>Monitor your earnings with clear, real-time insights.</li>
                <li>Our platform seamlessly integrates advanced technological tools, making sophisticated crypto management strategies accessible to all.</li>
              </ul>
              <Button asChild className="blue-action"><a href="#features">Get More Info <ArrowRight /></a></Button>
            </div>
            <img src={tradingDesk.url} alt="Investment professionals reviewing live market charts" />
          </div>
        </section>

        <section className="features section-black" id="features">
          <div className="site-width">
            <SectionLabel>Our Features</SectionLabel>
            <h2>Maximize Your Earnings With<br />Legacyproalliance.Org Today</h2>
            <div className="feature-grid" id="packages">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-top">
                    <img
                      src={tradingDesk.url}
                      alt=""
                      style={{ objectPosition: feature.position }}
                    />
                  </div>
                  <div className="feature-body">
                    <h3>{feature.title}</h3>
                    <p>{feature.copy}</p>
                  </div>
                  <a href={feature.action === "Contact Us" ? "#contact" : "#signup"} className="feature-link">
                    {feature.action} <ArrowRight />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="guide" id="signup">
          <div className="site-width">
            <SectionLabel>Member's Guide</SectionLabel>
            <h2>A Few Simple Steps<br />To Start Earning</h2>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step-card" key={step.title}>
                  {step.image ? <img src={step.image} alt="" /> : <span className="step-symbol" aria-hidden="true">{step.symbol}</span>}
                  <p>{step.title}</p>
                </article>
              ))}
            </div>
            <p className="guide-copy">Begin your journey with our crypto management platform today.<br />It's simple and straightforward.</p>
            <Button className="yellow-action">Sign Me Up <ArrowRight /></Button>
          </div>
        </section>

        <section className="testimonials section-black" id="faq">
          <div className="site-width testimonial-wrap">
            <SectionLabel>Testimonial</SectionLabel>
            <h2>Our Members Investments &amp;<br />Profits Experience</h2>
            <div className={`quote-stage ${isExiting ? "exiting" : ""}`} aria-live="polite">
              <div className="quote-mark">”</div>
              <blockquote>“{activeTestimonial?.quote}”</blockquote>
              <cite>{activeTestimonial?.name}</cite>
            </div>
            <div className="testimonial-controls">
              <Button type="button" size="icon" variant="outline" aria-label="Previous testimonial" onClick={() => moveTestimonial(-1)}><ArrowLeft /></Button>
              <Button type="button" size="icon" variant="outline" aria-label="Next testimonial" onClick={() => moveTestimonial(1)}><ArrowRight /></Button>
            </div>
          </div>
        </section>

        <section className="cta section-black">
          <div className="site-width cta-banner">
            <div className="cta-pattern" />
            <h2>Start Investing Now!</h2>
            <Button asChild className="yellow-action"><a href="#signup">Sign Me Up <ArrowRight /></a></Button>
          </div>
        </section>
      </main>

      <footer id="contact">
        <div className="site-width footer-grid">
          <a href="mailto:support@legacyproalliance.org" className="email-link"><Mail /> Email Us</a>
          <div><h3>Details</h3><a href="#about">About us</a><a href="#">Terms</a></div>
          <div><h3>Opportunity</h3><a href="#packages">Our Packages</a><a href="#signup">Registration</a></div>
          <div><h3>Support</h3><a href="#faq">FAQ</a><a href="#contact">Contact Us</a><a href="#contact">Login</a></div>
          <address>
            Legacyproalliance.Org<br />CRYPTO MANAGEMENT GROUP<br />The Mount, 47 Castle Bank,<br />Stafford, United Kingdom,<br />ST16 1DP
          </address>
        </div>
        <div className="footer-bottom">
          <div className="site-width footer-bottom-inner">
            <p>Copyright © 2026 All Right Reserved.</p>
            <div className="coin-strip" aria-label="Supported cryptocurrencies">
              {coinIcons.map((coin, index) => <img key={`${coin.asset_id}-${index}`} src={coin.url} alt="" />)}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}