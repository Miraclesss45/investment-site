import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Copy, Info } from "lucide-react";

import { MemberLayout, MemberPanel } from "@/components/member-chrome";
import { paymentMethods, plans } from "@/lib/member-data";

export const Route = createFileRoute("/deposit")({
  head: () => ({ meta: [
    { title: "Make a Deposit | Legacy Pro Alliance" },
    { name: "description", content: "Fund your Legacy Pro Alliance account with Bitcoin, Ethereum, USDT, Litecoin or BNB and start earning daily." },
    { property: "og:title", content: "Make a Deposit | Legacy Pro Alliance" },
    { property: "og:description", content: "Fund your account and start earning daily." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DepositPage,
});

function DepositPage() {
  const [method, setMethod] = useState(paymentMethods[0]!);
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Deposit recorded in preview mode. Connecting your account service will make this live.");
  };
  return (
    <MemberLayout title="Make Deposit" crumb="Choose a plan, amount and payment method">
      <form className="member-two" onSubmit={submit}>
        <MemberPanel title="Deposit Details">
          <label className="member-field"><span>Select Plan</span>
            <select name="plan" required defaultValue={plans[0]!.name}>
              {plans.map((plan) => <option key={plan.name}>{plan.name} — {plan.rate} daily ({plan.range})</option>)}
            </select>
          </label>
          <label className="member-field"><span>Amount (USD)</span>
            <input name="amount" type="number" min={35} step="0.01" placeholder="Enter amount" required />
          </label>
          <label className="member-field"><span>Payment Method</span>
            <select value={method.id} onChange={(e) => setMethod(paymentMethods.find((m) => m.id === e.target.value)!)}>
              {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <button type="submit" className="member-button">Confirm Deposit</button>
          {message && <p className="member-status" role="status">{message}</p>}
        </MemberPanel>

        <MemberPanel title="Payment Address">
          <div className="member-method">
            <img src={method.icon} alt={method.name} />
            <div><strong>{method.name}</strong><span>Send the exact amount to the address below.</span></div>
          </div>
          <code className="member-code">{method.address}</code>
          <button type="button" className="member-button ghost" onClick={() => navigator.clipboard?.writeText(method.address)}><Copy /> Copy Address</button>
          <p className="member-note"><Info /> Deposits are credited after 3 network confirmations. Minimum deposit is $35.</p>
        </MemberPanel>
      </form>

      <MemberPanel title="Payment Methods We Accept">
        <div className="member-method-grid">
          {paymentMethods.map((m) => <div key={m.id} className="member-method-chip"><img src={m.icon} alt={m.name} /><span>{m.name}</span></div>)}
        </div>
      </MemberPanel>
    </MemberLayout>
  );
}
