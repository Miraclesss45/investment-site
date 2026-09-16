import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InnerHero, PublicCta, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useReveal } from "@/lib/use-reveal";

export const Route = createFileRoute("/bonds")({
  head: () => ({ meta: [
    { title: "Our Packages | MeridianVest" },
    { name: "description", content: "Compare MeridianVest investment packages and choose a plan for your goals." },
    { property: "og:title", content: "Our Packages | MeridianVest" },
    { property: "og:description", content: "Compare four stable investment packages from Starter to Premium." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BondsPage,
});

const plans = [
  { name: "Starter Plan", rate: "2.5", minimum: "$35", maximum: "$3,000" },
  { name: "Regular Plan", rate: "10", minimum: "$3,001", maximum: "$10,000" },
  { name: "Pro Plan", rate: "20", minimum: "$10,000", maximum: "$20,000" },
  { name: "Premium Plan", rate: "35", minimum: "$20,001", maximum: "$UNLIMITED", premium: true },
];

function BondsPage() {
  return <div className="site-shell inner-page">
    <SiteHeader />
    <main>
      <InnerHero title="Our Packages" crumb="Stable Investment Earnings" />
      <section className="plans-section"><div className="site-width">
        <div className="section-label"><span />Investment Bonds</div>
        <h2>Choose The Plan That Works For You</h2>
        <div className="plans-grid">{plans.map((plan) => <article className={plan.premium ? "plan-card plan-card-premium" : "plan-card"} key={plan.name}>
          <p className="plan-name">{plan.name}</p><div className="plan-rate">{plan.rate}</div><p className="plan-period">Daily Yield</p>
          <ul><li><Check />Minimum Deposit: <b>{plan.minimum}</b></li><li><Check />Maximum Deposit: <b>{plan.maximum}</b></li><li><Check />Daily Yield: <b>{plan.rate}%</b></li><li><Check />Duration: <b>14 Calendar Days</b></li><li><Check />Deposit Return: <b>YES</b></li></ul>
          <Button asChild className="blue-action"><Link to="/signup">Get Started</Link></Button>
        </article>)}</div>
      </div></section>
      <PublicCta />
    </main>
    <SiteFooter />
  </div>;
}