import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Coins, Rocket, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import banner from "@/assets/uploads/banner-5.jpg.asset.json";
import tradingDesk from "@/assets/uploads/image-1.png.asset.json";
import rocket from "@/assets/uploads/why1.png.asset.json";
import portfolio from "@/assets/uploads/why2.png.asset.json";
import featureOne from "@/assets/uploads/feature1.png.asset.json";
import featureTwo from "@/assets/uploads/feature2.png.asset.json";
import featureThree from "@/assets/uploads/feature3.png.asset.json";
import featureFour from "@/assets/uploads/feature4.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MeridianVest | Crypto Management" },
      {
        name: "description",
        content: "Build long-term cryptocurrency earnings with accessible investment plans and expert support.",
      },
      { property: "og:title", content: "MeridianVest | Crypto Management" },
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

const highlights = [
  {
    icon: Rocket,
    title: "It's Free To Start",
    copy: "Unlock your earning potential: open your free account",
  },
  {
    icon: Settings,
    title: "Automated Strategies",
    copy: "Secure your future: smart strategies to make your money grow",
  },
  {
    icon: Coins,
    title: "Stable Profits",
    copy: "Competitive returns with our sophisticated AI-driven bots.",
  },
];

const features = [
  {
    title: "Advanced Technology",
    copy: "Utilize our advanced technological tools to effortlessly earn stable long-term profits.",
    action: "Our Packages",
    image: featureOne.url,
  },
  {
    title: "Seamless Investments",
    copy: "Purchase our plans with ease, and start earning without the hassle of setting up complex software.",
    action: "Register Now",
    image: featureTwo.url,
  },
  {
    title: "Comprehensive Support",
    copy: "Our dedicated support team is here to assist you 24/7/365 to give you the premium investing experience.",
    action: "Contact Us",
    image: featureThree.url,
  },
  {
    title: "Real-Time Earning Insights",
    copy: "Stay updated with real-time insights on your daily earnings and investment performance.",
    action: "Login To Account",
    image: featureFour.url,
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
      "I Like The Different Types Of Investment Bonds Offered At MeridianVest.com, And The Stable, Regular, Long-Term Returns On My Investments.",
    name: "Richard Trump",
  },
  {
    quote:
      "It's The Best Online Investment Opportunity I Have Come Across. MeridianVest.com Is The Best. Keep It Up. Let's Build Our Future Together.",
    name: "Simone Rose",
  },
  {
    quote:
      "Such A Smooth Investment Experience. Your Support Is World Class. Long Live MeridianVest.com. I Will Recommend MeridianVest.com To All My Friends And Family.",
    name: "Andrew Phillips",
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label">
      <span />
      {children}
    </div>
  );
}

function Index() {
  const [testimonial, setTestimonial] = useState(1);
  const [isExiting, setIsExiting] = useState(false);
  const [isBlank, setIsBlank] = useState(false);
  const [pendingDirection, setPendingDirection] = useState(1);
  const [tick, setTick] = useState(0);
  const [stepsInView, setStepsInView] = useState(false);
  const [featuresInView, setFeaturesInView] = useState(false);
  const isTransitioningRef = useRef(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const grid = stepsRef.current;
    if (!grid) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStepsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const grid = featuresRef.current;
    if (!grid) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setFeaturesInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="site-shell" id="home">
      <SiteHeader />

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <img className="hero-image" src={banner.url} alt="Modern glass financial district buildings" />
          <div className="hero-shade" />
          <div className="site-width hero-content">
            <h1 id="hero-title">Experience The<br />Convenience<br />Of Stable Profits</h1>
            <p>Providing long-term solutions for reliable income possibilities!</p>
            <div className="hero-actions">
              <Button asChild className="blue-action"><Link to="/signup">Sign Me Up <ArrowRight /></Link></Button>
              <Button asChild className="yellow-action hero-yellow"><Link to="/login">Member Login <ArrowRight /></Link></Button>
            </div>
          </div>
          <div className="site-width hero-highlights-wrap">
            <div className="hero-highlights">
              {highlights.map(({ icon: Icon, title, copy }) => (
                <div className="hero-highlight" key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h2>{title}</h2>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        <section className="about section-dark" id="about">
          <div className="site-width about-grid">
            <div className="about-copy">
              <SectionLabel>About Our Company</SectionLabel>
              <h2>A Smarter Way To Grow Your Crypto Portfolio</h2>
              <p>
                MeridianVest provides a straightforward route into digital asset management,
                pairing secure opportunities with a dedicated support team.
              </p>
              <ul>
                <li>Choose a plan designed around your investment goals.</li>
                <li>Monitor your earnings with clear, real-time insights.</li>
                <li>Our platform seamlessly integrates advanced technological tools, making sophisticated crypto management strategies accessible to all.</li>
              </ul>
              <Button asChild className="blue-action"><Link to="/about">Get More Info <ArrowRight /></Link></Button>
            </div>
            <img src={tradingDesk.url} alt="Investment professionals reviewing live market charts" />
          </div>
        </section>

        <section className="features section-black" id="features">
          <div className="site-width">
            <SectionLabel>Our Features</SectionLabel>
            <h2>Maximize Your Earnings With<br />MeridianVest.com Today</h2>
            <div className={`feature-grid ${featuresInView ? "is-visible" : ""}`} id="packages" ref={featuresRef}>
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-top">
                    <img
                      src={feature.image}
                      alt=""
                    />
                  </div>
                  <div className="feature-body">
                    <h3>{feature.title}</h3>
                    <p>{feature.copy}</p>
                  </div>
                  <Link to={feature.action === "Our Packages" ? "/bonds" : feature.action === "Contact Us" ? "/support" : feature.action === "Login To Account" ? "/login" : "/signup"} className="feature-link">
                    {feature.action} <ArrowRight />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="guide" id="signup">
          <div className="site-width">
            <SectionLabel>Member's Guide</SectionLabel>
            <h2>A Few Simple Steps<br />To Start Earning</h2>
            <div className={`steps-grid ${stepsInView ? "is-visible" : ""}`} ref={stepsRef}>
              {steps.map((step) => (
                <article className="step-card" key={step.title}>
                  {step.image ? <img src={step.image} alt="" /> : <span className="step-symbol" aria-hidden="true">{step.symbol}</span>}
                  <p>{step.title}</p>
                </article>
              ))}
            </div>
            <p className="guide-copy">Begin your journey with our crypto management platform today.<br />It's simple and straightforward.</p>
            <Button asChild className="yellow-action"><Link to="/signup">Sign Me Up <ArrowRight /></Link></Button>
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
            <Button asChild className="yellow-action"><Link to="/signup">Sign Me Up <ArrowRight /></Link></Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}