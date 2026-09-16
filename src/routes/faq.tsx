import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InnerHero, PublicCta, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "Frequently Asked Questions | MeridianVest" },
    { name: "description", content: "Answers about MeridianVest accounts, deposits, payouts, and referrals." },
    { property: "og:title", content: "Frequently Asked Questions | MeridianVest" },
    { property: "og:description", content: "Find answers about accounts, deposits, payouts, and referrals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: FaqPage,
});

const faqGroups = {
  General: [
    ["What is meridianvest.com?", "MeridianVest is a crypto management platform that uses automated strategies to identify opportunities across different digital asset ecosystems."],
    ["Who can register?", "Anyone of legal age who accepts our terms and can use the supported payment methods may create an account."],
    ["How do I create an account?", "Select Sign Up, complete the registration form, add your payment addresses and accept the terms and conditions."],
    ["Is my data safe?", "The platform uses SSL protection and safeguards designed to protect account information and availability."],
    ["Can I create multiple accounts?", "No. Multiple accounts used to abuse the referral program are not permitted."],
  ],
  Deposits: [
    ["How do I purchase an investment bond?", "Create an account, sign in, choose an available package and follow the deposit instructions shown in your account."],
    ["Which payment methods are accepted?", "Bitcoin, Ethereum, Litecoin, Dogecoin, Dash, Tron, BNB, XRP, XLM and USDT on ERC20, TRC20 and BEP20 networks are accepted."],
    ["Are there transaction fees?", "MeridianVest does not charge a deposit fee. Your payment processor or blockchain network may apply its own fee."],
    ["Can I reinvest my earnings?", "Yes. Available earnings may be used to purchase another eligible investment bond."],
    ["How many deposits can I make?", "You may purchase multiple available plans from one account."],
  ],
  Payouts: [
    ["How do I request a payout?", "Sign in to your account, open the withdrawal area, select an available balance and confirm the destination wallet."],
    ["When can I withdraw?", "Withdrawals can be requested when funds are shown as available in your account."],
    ["How long do payouts take?", "Processing time can vary by currency and network activity. Check your account for the current transaction status."],
    ["Is there a minimum withdrawal?", "Any applicable minimum is shown in the withdrawal form before you submit a request."],
  ],
  Referrals: [
    ["How does the referral program work?", "Share the referral link from your account. Eligible activity from invited members is tracked automatically."],
    ["Where can I find my referral link?", "Your personal referral link is available after signing in to your account."],
    ["Can I refer family and friends?", "Yes. You may share your referral link with people you know, provided each person creates their own account."],
    ["Are self-referrals allowed?", "No. Creating additional accounts to generate referral rewards is not permitted."],
  ],
} as const;

function FaqPage() {
  const [active, setActive] = useState<keyof typeof faqGroups>("General");
  return <div className="site-shell inner-page"><SiteHeader /><main><InnerHero title="Frequently Asked Questions" crumb="Help Center" />
    <section className="faq-section"><div className="site-width">
      <div className="faq-tabs" role="tablist">{Object.keys(faqGroups).map((name) => <Button key={name} type="button" variant={active === name ? "default" : "outline"} onClick={() => setActive(name as keyof typeof faqGroups)}>{name}</Button>)}</div>
      <div className="faq-layout"><div className="faq-intro"><div className="section-label"><span />{active} Questions</div><h2>How Can We Help You?</h2><p>Browse answers to the most common questions from our members.</p></div>
      <Accordion type="single" collapsible className="faq-accordion">{faqGroups[active].map(([question, answer], index) => <AccordionItem value={`${active}-${index}`} key={question}><AccordionTrigger>{question}</AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion></div>
    </div></section><PublicCta /></main><SiteFooter /></div>;
}