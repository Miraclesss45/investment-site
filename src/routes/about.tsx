import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Bot, Coins, Rocket } from "lucide-react";

import tradingDesk from "@/assets/uploads/image-1.png.asset.json";
import certificate from "@/assets/uploads/legacy-pro-alliance-certificate.jpg.asset.json";
import { InnerHero, PublicCta, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About Us | Legacy Pro Alliance" },
    { name: "description", content: "Learn about Legacy Pro Alliance and our secure, automated cryptocurrency management solutions." },
    { property: "og:title", content: "About Us | Legacy Pro Alliance" },
    { property: "og:description", content: "Learn about Legacy Pro Alliance and our secure, automated cryptocurrency management solutions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AboutPage,
});

const benefits = [
  { icon: Rocket, title: "It's Free To Start", copy: "Unlock your earning potential: open your free account" },
  { icon: Bot, title: "Automated Strategies", copy: "Secure your future: smart strategies to make your money grow" },
  { icon: Coins, title: "Stable Profits", copy: "Competitive returns with our sophisticated AI-driven bots." },
];

function AboutPage() {
  return (
    <div className="site-shell about-page" id="top">
      <SiteHeader />
      <main>
        <InnerHero title="About Us" crumb="Who we are?" />
        <section className="about-benefits"><div className="site-width benefit-grid">{benefits.map(({ icon: Icon, title, copy }) => <article key={title}><Icon /><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div></section>
        <section className="about-story"><div className="site-width about-story-grid"><div><div className="section-label"><span />WHAT IS LEGACYPROALLIANCE.ORG?</div><h2>Secure, Innovative, And User-Friendly Crypto Management Solutions.</h2><ul><li>legacyproalliance.org is an innovative platform designed to work in a new era of crypto management.</li><li>Our automated strategies identify profit making opportunities across different crypto ecosystems.</li><li>Our platform seamlessly integrates advanced technological tools, making sophisticated crypto management strategies accessible to all.</li></ul></div><img src={tradingDesk.url} alt="Investment professionals reviewing cryptocurrency markets" /></div></section>
        <section className="certificate-section"><div className="site-width"><img src={certificate.url} alt="Legacy Pro Alliance Ltd certificate of incorporation, company number 12184006" /></div></section>
        <PublicCta />
      </main>
      <SiteFooter />
      <a className="back-to-top" href="#top" aria-label="Back to top"><ArrowUp /></a>
    </div>
  );
}