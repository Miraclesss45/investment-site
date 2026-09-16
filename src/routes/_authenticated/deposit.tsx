import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Copy, Info } from "lucide-react";
import { toast } from "sonner";

import { MemberLayout, MemberPanel } from "@/components/member-chrome";
import { supabase } from "@/integrations/supabase/client";
import { notifyError, useRefreshAccount } from "@/lib/account";
import { money, paymentMethods, plans } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/deposit")({
  head: () => ({ meta: [
    { title: "Make a Deposit | MeridianVest" },
    { name: "description", content: "Fund your MeridianVest account with Bitcoin, Ethereum, USDT, Litecoin or BNB and start earning daily." },
    { property: "og:title", content: "Make a Deposit | MeridianVest" },
    { property: "og:description", content: "Fund your account and start earning daily." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DepositPage,
});

function DepositPage() {
  const [method, setMethod] = useState(paymentMethods[0]!);
  const [planName, setPlanName] = useState<string>(plans[0]!.name);
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshAccount();
  const navigate = useNavigate();

  const plan = plans.find((item) => item.name === planName)!;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get("amount"));
    if (amount < plan.min) {
      toast.error("Amount too low", { description: `The ${plan.name} starts at ${money(plan.min)}.` });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Your session expired. Please sign in again.");

      const { error } = await supabase.from("deposits").insert({
        user_id: userId, plan: plan.name, amount, daily_rate: plan.rate, method: method.name,
      });
      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: userId, type: "deposit", amount, status: "pending",
      });
      if (txError) throw txError;

      refresh();
      toast.success("Deposit request created", {
        description: `${money(amount)} on the ${plan.name}. Send the funds to the address shown and it will be credited after 3 confirmations.`,
      });
      void navigate({ to: "/my-deposits" });
    } catch (error) {
      notifyError(error, "We could not create your deposit");
    } finally {
      setSaving(false);
    }
  };

  const copyAddress = async () => {
    await navigator.clipboard?.writeText(method.address);
    toast.success("Address copied", { description: method.name });
  };

  return (
    <MemberLayout title="Make Deposit" crumb="Choose a plan, amount and payment method">
      <form className="member-two" onSubmit={submit}>
        <MemberPanel title="Deposit Details">
          <label className="member-field"><span>Select Plan</span>
            <select name="plan" required value={planName} onChange={(event) => setPlanName(event.target.value)}>
              {plans.map((item) => <option key={item.name} value={item.name}>{item.name} — {item.rate}% daily ({item.range})</option>)}
            </select>
          </label>
          <label className="member-field"><span>Amount (USD)</span>
            <input name="amount" type="number" min={plan.min} step="0.01" placeholder={`Minimum ${money(plan.min)}`} required />
          </label>
          <label className="member-field"><span>Payment Method</span>
            <select value={method.id} onChange={(event) => setMethod(paymentMethods.find((item) => item.id === event.target.value)!)}>
              {paymentMethods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="submit" className="member-button" disabled={saving}>{saving ? "Submitting…" : "Confirm Deposit"}</button>
        </MemberPanel>

        <MemberPanel title="Payment Address">
          <div className="member-method">
            <img src={method.icon} alt={method.name} />
            <div><strong>{method.name}</strong><span>Send the exact amount to the address below.</span></div>
          </div>
          <code className="member-code">{method.address}</code>
          <button type="button" className="member-button ghost" onClick={() => void copyAddress()}><Copy /> Copy Address</button>
          <p className="member-note"><Info /> Deposits are credited after 3 network confirmations. Minimum deposit is $35.</p>
        </MemberPanel>
      </form>

      <MemberPanel title="Payment Methods We Accept">
        <div className="member-method-grid">
          {paymentMethods.map((item) => <div key={item.id} className="member-method-chip"><img src={item.icon} alt={item.name} /><span>{item.name}</span></div>)}
        </div>
      </MemberPanel>
    </MemberLayout>
  );
}
