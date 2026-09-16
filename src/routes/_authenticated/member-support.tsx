import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Mail, Send } from "lucide-react";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";

export const Route = createFileRoute("/_authenticated/member-support")({
  head: () => ({ meta: [
    { title: "Get Support | MeridianVest" },
    { name: "description", content: "Open a support ticket or reach the MeridianVest team by e-mail or Telegram from your member area." },
    { property: "og:title", content: "Get Support | MeridianVest" },
    { property: "og:description", content: "Open a support ticket from your member area." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: MemberSupportPage,
});

function MemberSupportPage() {
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Ticket captured in preview mode. Connecting your account service will deliver it to the support team.");
  };
  return (
    <MemberLayout title="Get Support" crumb="We usually reply within a few hours">
      <div className="member-two">
        <MemberPanel title="Open a Ticket">
          <form onSubmit={submit}>
            <label className="member-field"><span>Subject</span><input name="subject" placeholder="What do you need help with?" required /></label>
            <label className="member-field"><span>Category</span>
              <select name="category" defaultValue="Deposits">{["Deposits", "Withdrawals", "Account", "Referrals", "Other"].map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="member-field"><span>Message</span><textarea name="message" rows={6} placeholder="Describe your issue" required /></label>
            <button type="submit" className="member-button"><Send /> Submit Ticket</button>
            {message && <p className="member-status" role="status">{message}</p>}
          </form>
        </MemberPanel>
        <MemberPanel title="Other Ways To Reach Us">
          <p className="member-note"><Mail /> support@meridianvest.com</p>
          <ul className="member-list">
            <li>Telegram: <a href="https://t.me/meridianvest" target="_blank" rel="noreferrer">@meridianvest</a></li>
            <li>The Mount, 47 Castle Bank, Stafford, UK, ST16 1DP</li>
            <li>Support hours: Monday to Friday, 9am – 6pm GMT</li>
          </ul>
        </MemberPanel>
      </div>

      <MemberPanel title="My Tickets">
        <EmptyTable columns={["Subject", "Category", "Date", "Status"]} message="No tickets found" />
      </MemberPanel>
    </MemberLayout>
  );
}
