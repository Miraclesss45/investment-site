import { Link } from "react-router-dom";
import { CreditCard, ShieldCheck, Star } from "lucide-react";
import certificateAsset from "../../assets/uploads/aboutusimage.webp";
import certificateAssetSmall from "../../assets/uploads/aboutusimage-480.webp";
import featureAsset from "../../assets/uploads/image-1.webp";
import featureAssetSmall from "../../assets/uploads/image-1-480.webp";
import heroAsset from "../../assets/uploads/banner-5.webp";
import heroAssetMedium from "../../assets/uploads/banner-5-1440.webp";
import heroAssetSmall from "../../assets/uploads/banner-5-960.webp";
import { PublicPage } from "../../components/site/SiteChrome";
import { Reveal } from "../../components/site/Reveal";

const imageSources = {
  hero: heroAsset,
  feature: featureAsset,
  certificate: certificateAsset,
};

export default function AboutPage() {
  return (
    <PublicPage>
      <main id="main-content" tabIndex="-1">
        <section className="relative grid min-h-[clamp(16rem,35vw,20rem)] place-items-center overflow-hidden text-center">
          <img
            src={imageSources.hero}
            srcSet={`${heroAssetSmall} 960w, ${heroAssetMedium} 1440w, ${heroAsset} 1920w`}
            sizes="100vw"
            width="1920"
            height="1080"
            alt="Modern glass financial district buildings"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 bg-[#050b14]/[0.72]"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <h1 className="motion-safe:transition motion-safe:duration-700 mb-6 text-[clamp(2.25rem,7vw,2.625rem)] font-semibold tracking-[-0.05em] text-white">
              About MeridianVests.
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
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] gap-10 py-12 sm:w-[min(1160px,calc(100%-3rem))] sm:py-16 md:grid-cols-3 lg:w-[min(1160px,calc(100%-5rem))]">
            <Reveal
              as="article"
              className="grid grid-cols-[auto_1fr] items-start gap-4 md:gap-5"
            >
              <ShieldCheck className="mt-1 shrink-0 text-sky-300" size={36} />
              <div>
                <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
                  Trust-centered service
                </h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  Every interaction is shaped around clarity, responsiveness,
                  and long-tail member confidence.
                </p>
              </div>
            </Reveal>
            <Reveal
              as="article"
              className="grid grid-cols-[auto_1fr] items-start gap-4 md:gap-5"
              style={{ "--reveal-delay": "120ms" }}
            >
              <CreditCard className="mt-1 shrink-0 text-sky-300" size={36} />
              <div>
                <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
                  Stable capital pathways
                </h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  We curate options that aim to preserve principal, support
                  income, and maintain operational transparency.
                </p>
              </div>
            </Reveal>
            <Reveal
              as="article"
              className="grid grid-cols-[auto_1fr] items-start gap-4 md:gap-5"
              style={{ "--reveal-delay": "240ms" }}
            >
              <Star className="mt-1 shrink-0 text-sky-300" size={36} />
              <div>
                <h2 className="mb-4 text-xl font-semibold sm:text-2xl">
                  Disciplined execution
                </h2>
                <p className="text-[15px] leading-8 text-slate-300">
                  Members gain access to opportunities supported by research,
                  structure, and a disciplined review process.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#050b14]/55">
          <div className="mx-auto grid w-[min(1160px,calc(100%-2rem))] items-center gap-10 py-16 sm:w-[min(1160px,calc(100%-3rem))] sm:gap-14 sm:py-20 lg:w-[min(1160px,calc(100%-5rem))] lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:py-[110px]">
            <Reveal>
              <div className="mb-8 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-300">
                <span className="block h-2.5 w-2.5 bg-sky-400" /> Our story
              </div>
              <h2 className="mb-10 text-[clamp(2rem,7vw,2.95rem)] font-semibold leading-[1.12] tracking-[-0.05em] text-white sm:mb-14">
                Crypto management made clearer and more intentional.
              </h2>
              <ul className="list-disc space-y-6 pl-5 text-sm leading-8 text-slate-300">
                <li>
                  MeridianVests was designed for members who want a simpler
                  pathway into crypto investment and earning opportunities.
                </li>
                <li>
                  We prioritize clarity in presentation, communication, and
                  onboarding so members can understand each step before they
                  act.
                </li>
                <li>
                  Our public experience brings packages, member support, and
                  account tools together in one place.
                </li>
              </ul>
            </Reveal>
            <Reveal
              as="div"
              className="overflow-hidden rounded-b-[10px]"
              style={{ "--reveal-delay": "140ms" }}
            >
              <img
                className="aspect-[4/3] w-full object-cover transition duration-700 hover:scale-[1.02] sm:aspect-[16/10] lg:aspect-[4/3]"
                src={imageSources.feature}
                srcSet={`${featureAssetSmall} 480w, ${featureAsset} 720w`}
                sizes="(min-width: 1024px) 540px, 100vw"
                width="720"
                height="684"
                alt="Investment professionals reviewing live market charts"
                loading="lazy"
                decoding="async"
              />
            </Reveal>
          </div>
        </section>

        <section className="bg-[#101d30]/75 pb-20 pt-0">
          <div className="mx-auto w-[min(1160px,calc(100%-2rem))] sm:w-[min(1160px,calc(100%-3rem))] lg:w-[min(1160px,calc(100%-5rem))]">
            <Reveal
              as="div"
              className="mx-auto w-full max-w-[720px]"
              style={{ "--reveal-delay": "180ms" }}
            >
              <img
                className="w-full"
                src={imageSources.certificate}
                srcSet={`${certificateAssetSmall} 480w, ${certificateAsset} 768w`}
                sizes="(min-width: 768px) 720px, 100vw"
                width="768"
                height="1080"
                alt="Company certificate of incorporation"
                loading="lazy"
                decoding="async"
              />
              <p className="mt-5 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] px-5 py-4 text-center text-sm leading-7 text-slate-300">
                The certificate reflects <strong className="text-white">Legacy Pro Alliance Ltd</strong>{" "}
                as the registered legal entity associated with this service.
                <strong className="text-white"> MeridianVests</strong> is the
                public-facing brand presented on this website.
              </p>
            </Reveal>
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
