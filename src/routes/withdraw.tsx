import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Info } from "lucide-react";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { balances, member, paymentMethods } from "@/lib/member-data";

export const Route = createFileRoute("/withdraw")({
  head: () => ({ meta: [
    { title: "Withdraw Funds | Legacy Pro Alliance" },
    { name: "description", content: "Request a withdrawal from your Legacy Pro Alliance balance to your crypto wallet." },
    { property: "og:title", content: "Withdraw Funds | Legacy Pro Alliance" },
    { property: "og:description", content: "Request a withdrawal to your crypto wallet." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: WithdrawPage,
});

function WithdrawPage() {
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Withdrawal request captured in preview mode. Connecting your account service will make this live.");
  };
  return (
    <MemberLayout title="Withdraw" crumb="Request a payout to your wallet">
      <div className="member-stats three">
        {balances.slice(0, 3).map((item) => (
          <article key={item.label} className="member-stat"><span>{item.label}</span><strong>{item.value}</strong></article>
        ))}
      </div>

      <div className="member-two">
        <MemberPanel title="Withdrawal Request">
          <form onSubmit={submit}>
            <label className="member-field"><span>Amount (USD)</span><input name="amount" type="number" min={10} step="0.01" placeholder="Enter amount" required /></label>
            <label className="member-field"><span>Payout Method</span>
              <select name="method" defaultValue={paymentMethods[0]!.name}>{paymentMethods.map((m) => <option key={m.id}>{m.name}</option>)}</select>
            </label>
            <label className="member-field"><span>Wallet Address</span><input name="wallet" defaultValue={member.wallets.bitcoin} required /></label>
            <button type="submit" className="member-button">Request Withdrawal</button>
            {message && <p className="member-status" role="status">{message}</p>}
          </form>
        </MemberPanel>
        <MemberPanel title="Payout Information">
          <p className="member-note"><Info /> Minimum withdrawal is $10. Requests are processed within 24 hours on business days.</p>
          <ul className="member-list">
            <li>No withdrawal fees on referral bonuses.</li>
            <li>Funds are sent to the wallet saved on your profile.</li>
            <li>Update your wallets any time from My Profile.</li>
          </ul>
        </MemberPanel>
      </div>

      <MemberPanel title="Withdrawal History">
        <EmptyTable columns={["Amount", "Method", "Wallet", "Date", "Status"]} message="No withdrawals found" />
      </MemberPanel>
    </MemberLayout>
  );
}
