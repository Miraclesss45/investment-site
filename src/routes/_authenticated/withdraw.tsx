import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { DataTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { supabase } from "@/integrations/supabase/client";
import { notifyError, useBalances, useProfile, useRefreshAccount, useWithdrawals } from "@/lib/account";
import { money, paymentMethods, shortDate } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/withdraw")({
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
  const { data: profile } = useProfile();
  const { data: withdrawals = [] } = useWithdrawals();
  const balances = useBalances();
  const refresh = useRefreshAccount();
  const [saving, setSaving] = useState(false);

  const stats = [
    { label: "Account Balance", value: money(balances.balance) },
    { label: "Total Earnings", value: money(balances.totalEarnings) },
    { label: "Total Withdrawn", value: money(balances.totalWithdrawn) },
  ];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount"));
    if (amount > balances.balance) {
      toast.error("Not enough funds", { description: `Your available balance is ${money(balances.balance)}.` });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Your session expired. Please sign in again.");

      const { error } = await supabase.from("withdrawals").insert({
        user_id: userId, amount, method: String(data.get("method")), wallet: String(data.get("wallet")),
      });
      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: userId, type: "withdrawal", amount, status: "pending",
      });
      if (txError) throw txError;

      refresh();
      event.currentTarget.reset();
      toast.success("Withdrawal requested", { description: `${money(amount)} is queued for processing within 24 hours.` });
    } catch (error) {
      notifyError(error, "We could not submit your withdrawal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MemberLayout title="Withdraw" crumb="Request a payout to your wallet">
      <div className="member-stats three">
        {stats.map((item) => (
          <article key={item.label} className="member-stat"><span>{item.label}</span><strong>{item.value}</strong></article>
        ))}
      </div>

      <div className="member-two">
        <MemberPanel title="Withdrawal Request">
          <form onSubmit={submit}>
            <label className="member-field"><span>Amount (USD)</span><input name="amount" type="number" min={10} step="0.01" placeholder="Enter amount" required /></label>
            <label className="member-field"><span>Payout Method</span>
              <select name="method" defaultValue={paymentMethods[0]!.name}>{paymentMethods.map((item) => <option key={item.id}>{item.name}</option>)}</select>
            </label>
            <label className="member-field"><span>Wallet Address</span><input name="wallet" defaultValue={profile?.btc_wallet ?? ""} placeholder="Your wallet address" required /></label>
            <button type="submit" className="member-button" disabled={saving}>{saving ? "Sending…" : "Request Withdrawal"}</button>
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
        <DataTable
          columns={["Amount", "Method", "Wallet", "Date", "Status"]}
          empty="No withdrawals found"
          rows={withdrawals.map((item) => [
            money(Number(item.amount)),
            item.method,
            <code className="member-inline-code">{item.wallet}</code>,
            shortDate(item.created_at),
            <span className={`member-badge ${item.status}`}>{item.status}</span>,
          ])}
        />
      </MemberPanel>
    </MemberLayout>
  );
}
