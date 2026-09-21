import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import heroAsset from "../../assets/uploads/banner-5.webp";
import heroAssetMedium from "../../assets/uploads/banner-5-1440.webp";
import heroAssetSmall from "../../assets/uploads/banner-5-960.webp";
import featureAsset from "../../assets/uploads/image-1.webp";
import featureAssetSmall from "../../assets/uploads/image-1-480.webp";
import featureOneAsset from "../../assets/uploads/feature1.webp";
import featureTwoAsset from "../../assets/uploads/feature2.webp";
import featureThreeAsset from "../../assets/uploads/feature3.webp";
import featureFourAsset from "../../assets/uploads/feature4.webp";
import stepOneAsset from "../../assets/uploads/why1.png";
import stepTwoAsset from "../../assets/uploads/why2.png";
import stepThreeAsset from "../../assets/uploads/why3.png";
import stepFourAsset from "../../assets/uploads/why4.png";
import { SiteFooter, SiteHeader } from "../../components/site/SiteChrome";
import { useReveal } from "../../lib/useReveal";

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
};

const testimonials = [
  {
    quote:
      "I Like The Different Types Of Investment Bonds Offered At MeridianVests, And The Stable, Regular, Long-Term Returns On My Investments.",
    author: "RICHARD TRUMP",
  },
  {
    quote:
      "It's The Best Online Investment Opportunity I Have Come Across. MeridianVests Is The Best. Keep It Up. Let's Build Our Future Together.",
    author: "SIMONE ROSE",
  },
  {
    quote:
      "Such A Smooth Investment Experience. Your Support Is World Class. Long Live MeridianVests. I Will Recommend MeridianVests To All My Friends And Family.",
    author: "ANDREW PHILLIPS",
  },
];

const featureCards = [
  {
    title: "Advanced Technology",
    description:
      "Utilize our advanced technological tools to effortlessly earn stable long-term profits.",
    image: imageSources.featureOne,
    action: "Our Packages",
    to: "/bonds",
  },
  {
    title: "Seamless Investments",
    description:
      "Purchase our plans with ease, and start earning without the hassle of setting up complex software.",
    image: imageSources.featureTwo,
    action: "Register Now",
    to: "/signup",
  },
  {
    title: "Comprehensive Support",
    description:
      "Our dedicated support team is here to assist you 24/7/365 for a premium investing experience.",
    image: imageSources.featureThree,
    action: "Contact Us",
    to: "/support",
  },
  {
    title: "Real-Time Earning Insights",
    description:
      "Stay updated with real-time insights on your daily earnings and investment performance.",
    image: imageSources.featureFour,
    action: "Login To Account",
    to: "/login",
  },
];

const guideSteps = [
  { label: "Sign Up For A Free Account", image: imageSources.stepOne },
  { label: "Choose An Investment Bond", image: imageSources.stepTwo },
  { label: "Check Earnings Daily", image: imageSources.stepThree },
  { label: "Request eligible withdrawals", image: imageSources.stepFour },
];

export default function HomePage() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [testimonialPaused, setTestimonialPaused] = useState(false);
  const testimonialViewportRef = useRef(null);
  const [whatWeDoRef, whatWeDoVisible] = useReveal();
  const [featuresRef, featuresVisible] = useReveal();
  const [guideRef, guideVisible] = useReveal();
  const [testimonialRef, testimonialVisible] = useReveal();
  const [finalCtaRef, finalCtaVisible] = useReveal();

  function moveTestimonial(step) {
    setTestimonialIndex(
      (current) => (current + step + testimonials.length) % testimonials.length,
    );
  }

  useEffect(() => {
    if (
      testimonialPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      moveTestimonial(1);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [testimonialPaused]);

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-transparent text-white">
      <SiteHeader />

      <main id="main-content" tabIndex="-1">
        <section className="hero-section relative flex min-h-[560px] items-center overflow-hidden bg-[#050b14] sm:min-h-[640px] lg:min-h-[700px]">
          <img
            className="hero-image absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center"
            src={imageSources.hero}
            srcSet={`${heroAssetSmall} 960w, ${heroAssetMedium} 1440w, ${heroAsset} 1920w`}
            sizes="100vw"
            width="1920"
            height="1080"
            alt="Modern glass buildings at night"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050b14]/95 via-[#050b14]/70 to-[#050b14]/30" aria-hidden="true" />
          <div className="hero-content relative mx-auto w-[min(1160px,calc(100%-2rem))] py-20 sm:w-[min(1160px,calc(100%-3rem))] sm:py-28 lg:w-[min(1160px,calc(100%-5rem))]">
            <h1 className="max-w-3xl text-[clamp(2.2rem,7vw,4.25rem)] font-extrabold leading-[1.03] tracking-[-0.04em] text-white text-balance">
              <span className="block">
                Invest With
              </span>
              <span className="block">
                More Clarity
              </span>
              <span className="block">
                And Control
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-[15px] font-medium leading-7 text-slate-200 sm:mt-9 sm:text-xl sm:leading-8">
              Explore straightforward investment plans, review your account
              activity, and get support when you need it.
            </p>
            <div className="mt-9 flex w-full max-w-[620px] flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                to="/signup"
                className="interactive-lift inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-cyan-300 px-5 text-sm font-extrabold uppercase tracking-[0.06em] text-slate-950 shadow-[0_14px_35px_rgba(34,211,238,0.18)] hover:bg-cyan-200 sm:min-w-[210px] sm:w-auto sm:px-7"
              >
                Sign me up <ArrowUpRight size={24} />
              </Link>
              <Link
                to="/login"
                className="interactive-lift inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 px-5 text-sm font-extrabold uppercase tracking-[0.06em] text-white backdrop-blur-sm hover:border-cyan-300/50 hover:bg-white/10 sm:min-w-[210px] sm:w-auto sm:px-7"
              >
                Member login <ArrowUpRight size={24} />
              </Link>
            </div>
            <p className="mt-5 text-xs font-semibold tracking-wide text-slate-300">
              Clear terms&nbsp;&nbsp;·&nbsp;&nbsp;Secure account access&nbsp;&nbsp;·&nbsp;&nbsp;Dedicated support
            </p>
          </div>
        </section>

        <section
          ref={whatWeDoRef}
          className={`px-0 py-16 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none sm:py-[92px] ${whatWeDoVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] items-center gap-10 sm:w-[min(1160px,calc(100%-3rem))] sm:gap-14 lg:w-[min(1160px,calc(100%-5rem))] lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div>
              <div className="mb-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> What we do
              </div>
              <h2 className="text-[clamp(2rem,7vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-white">
                Make clearer decisions with MeridianVests
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300">
                Use our technology, investment plans, support team, and
                real-time insights to make your member experience clear from
                registration through withdrawal.
              </p>
              <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-300">
                <li>
                  MeridianVests is an innovative platform designed to work in a
                  evolving digital-asset landscape.
                </li>
                <li>
                  Our strategies are designed to help members evaluate
                  opportunities across different crypto ecosystems.
                </li>
                <li>
                  Our platform brings account tools, plan details, and support
                  into one straightforward member experience.
                </li>
              </ul>
            </div>
            <img
              className={`aspect-[4/3] h-auto w-full rounded-b-[10px] object-cover transition-[transform,opacity] delay-150 duration-700 ease-out motion-reduce:transition-none sm:aspect-[16/10] lg:aspect-[4/3] ${whatWeDoVisible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"}`}
              src={imageSources.feature}
              srcSet={`${featureAssetSmall} 480w, ${featureAsset} 720w`}
              sizes="(min-width: 1024px) 540px, 100vw"
              width="720"
              height="684"
              alt="Investment professionals reviewing live market charts"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section
          ref={featuresRef}
          className={`px-0 py-16 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none sm:py-[94px] ${featuresVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
              <span className="block h-2.5 w-2.5 bg-sky-400" /> Why MeridianVests
            </div>
            <h2 className="mx-auto mb-10 max-w-2xl text-center text-[clamp(2rem,7vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-white sm:mb-14">
              Built for a simpler investment experience.
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map(
                ({ title, description, image, action, to }, index) => (
                  <article
                    key={title}
                    className={`interactive-lift group flex min-h-[410px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1728]/80 shadow-xl shadow-black/10 transition-[opacity,transform,border-color,box-shadow] duration-500 hover:border-cyan-300/40 hover:shadow-2xl hover:shadow-cyan-500/10 sm:min-h-[450px] ${featuresVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
                  >
                    <div className="mx-2 mt-2 flex h-[128px] items-center justify-center rounded-t-md bg-[#0d1728] transition duration-300 group-hover:bg-gradient-to-r group-hover:from-sky-600 group-hover:to-cyan-400 sm:h-[140px]">
                      <img
                        className="h-[128px] w-[128px] rounded-full object-cover transition duration-300 group-hover:scale-105"
                        src={image}
                                              alt={title}
                        width="128"
                        height="128"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-center px-4 pb-6 pt-10 text-center">
                      <h3 className="mb-4 text-lg font-semibold leading-tight text-white transition duration-300 sm:mb-5">
                        {title}
                      </h3>
                      <p className="text-xs leading-6 text-slate-300 sm:text-[13px] sm:leading-7">
                        {description}
                      </p>
                    </div>
                    <Link
                      to={to}
                      className="mx-3 mb-3 flex min-h-[58px] items-center justify-center gap-2 rounded-md bg-[#24252a] px-3 text-xs font-extrabold uppercase tracking-[0.04em] text-white transition duration-300 hover:-translate-y-0.5 group-hover:bg-gradient-to-r group-hover:from-sky-500 group-hover:to-cyan-400 sm:mx-4 sm:mb-4 sm:min-h-[66px] sm:gap-3 sm:px-4 sm:text-sm"
                    >
                      {action} <ArrowUpRight size={23} />
                    </Link>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section
          ref={guideRef}
          className={`bg-[#202125] px-4 py-16 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none sm:py-[92px] ${guideVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mx-auto w-[min(1160px,calc(100%-2rem))] text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
              <span className="block h-2.5 w-2.5 bg-sky-400" /> Member&apos;s
              Guide
            </div>
            <h2 className="mx-auto mb-10 max-w-[560px] text-[clamp(2rem,7vw,2.45rem)] font-bold leading-[1.15] tracking-[-0.05em] text-white sm:mb-14">
              A Few Simple Steps
              <br />
              To Get Started
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {guideSteps.map(({ label, image }, index) => (
                <article
                  key={label}
                  className={`flex h-[217px] flex-col items-center justify-center rounded-md bg-[#393a3c] px-5 transition hover:-translate-y-1 hover:bg-[#414246] ${guideVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
                >
                  <img
                    className="mb-7 h-[58px] w-[58px] object-contain"
                    src={image}
                                      alt={label}
                    width="58"
                    height="58"
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="max-w-[150px] text-sm font-medium leading-5 text-white">
                    {label}
                  </p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-10 max-w-[560px] text-xs font-medium leading-6 text-white sm:mt-14">
              Review the plans, create your account, and stay in control.
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

        <section
          ref={testimonialRef}
          className={`px-0 py-16 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none sm:py-[82px] ${testimonialVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mx-auto w-[min(1160px,calc(100%-2rem))] text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <div className="mb-6 flex items-center justify-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
              <span className="block h-0.5 w-4 bg-slate-300" /> Testimonial
            </div>
            <h2 className="mx-auto mb-10 max-w-[700px] text-[clamp(1.8rem,6vw,2.45rem)] font-bold leading-[1.15] tracking-[-0.04em] text-white sm:mb-16">
              Our Members Investments &amp; Profits Experience
            </h2>
            <div
              ref={testimonialViewportRef}
              className="relative isolate mx-auto max-w-[1180px] overflow-hidden py-2"
              aria-label="Member testimonials"
              role="region"
              onMouseEnter={() => setTestimonialPaused(true)}
              onMouseLeave={() => setTestimonialPaused(false)}
              onFocus={() => setTestimonialPaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setTestimonialPaused(false);
                }
              }}
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
                    <div className="mx-auto flex min-h-[270px] max-w-[820px] flex-col items-center px-2 sm:min-h-[250px]">
                      <div className="h-[58px] text-6xl leading-none text-yellow-300 sm:h-[70px] sm:text-7xl">
                        “
                      </div>
                      <blockquote className="text-center text-sm leading-7 text-white sm:text-lg sm:leading-8 md:text-xl">
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

        <section
          ref={finalCtaRef}
          className={`bg-[#202125] px-4 py-16 transition-[transform,opacity] duration-700 ease-out motion-reduce:transition-none sm:py-[94px] ${finalCtaVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <div className="mx-auto flex w-[min(1160px,calc(100%-2rem))] flex-col items-center text-center sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <p className="max-w-[740px] text-xl font-medium leading-8 text-white sm:text-2xl sm:leading-10">
              Begin your journey with our crypto management platform today.
              <br />
              It's simple and straightforward.
            </p>
            <Link
              to="/signup"
              className="mt-10 inline-flex h-16 w-full max-w-[310px] items-center justify-center gap-4 rounded-md bg-yellow-300 px-6 text-base font-extrabold uppercase text-slate-900 transition hover:-translate-y-1 sm:mt-14 sm:h-[78px] sm:gap-6 sm:px-8 sm:text-xl"
            >
              Sign me up <ArrowUpRight size={24} />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
