import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Mail, MapPin, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InnerHero, PublicCta, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [
    { title: "Support Center | MeridianVest" },
    { name: "description", content: "Contact MeridianVest support for assistance with your account or investments." },
    { property: "og:title", content: "Support Center | MeridianVest" },
    { property: "og:description", content: "Request assistance from the MeridianVest support team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: SupportPage,
});

function SupportPage() {
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  return <div className="site-shell inner-page"><SiteHeader /><main><InnerHero title="Support Center" crumb="Request Assistance" />
    <section className="support-section"><div className="site-width support-grid"><div className="support-copy"><div className="section-label"><span />Contact</div><h2>Don't Hesitate To Reach Out To Us</h2><p>Our dedicated support team is available around the clock to help answer your questions.</p>
      <a href="mailto:support@meridianvest.com"><Mail /><span><small>Email</small>support@meridianvest.com</span></a><a href="https://t.me/meridianvest"><Send /><span><small>Telegram</small>@meridianvest</span></a><div className="support-address"><MapPin /><span><small>Address</small>The Mount, 47 Castle Bank, Stafford, United Kingdom, ST16 1DP</span></div></div>
      <form className="support-form" onSubmit={submit}><h3>Send Us A Message</h3><label>Your Name<Input name="name" required placeholder="Enter your name" /></label><label>Your Email<Input name="email" type="email" required placeholder="Enter your email" /></label><label>Message<Textarea name="message" required rows={6} placeholder="How can we help?" /></label><Button type="submit" className="blue-action">Send <Send /></Button>{sent && <p className="form-note" role="status">Your message is ready. Connect a mail service to enable delivery.</p>}</form>
    </div></section><PublicCta /></main><SiteFooter /></div>;
}