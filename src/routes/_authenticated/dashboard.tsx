import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Copy, Megaphone, Wallet } from "lucide-react";
import { toast } from "sonner";

import { DataTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { useBalances, useProfile, useTransactions } from "@/lib/account";
import { money, notices, plans, shortDate } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Member Dashboard | MeridianVest" },
    { name: "description", content: "Track your balance, active deposits, earnings and referral bonus in your MeridianVest member area." },
    { property: "og:title", content: "Member Dashboard | MeridianVest" },
    { property: "og:description", content: "Track your balance, active deposits and earnings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: profile } = useProfile();
  const balances = useBalances();
  const { data: transactions = [] } = useTransactions();

  const name = profile?.full_name?.trim() || profile?.username || "Member";
  const referralLink = typeof window === "undefined" || !profile
    ? ""
    : `${window.location.origin}/signup?ref=${profile.referral_code}`;

  const stats = [
    { label: "Account Balance", value: money(balances.balance) },
    { label: "Total Deposit", value: money(balances.totalDeposit) },
    { label: "Total Withdrawn", value: money(balances.totalWithdrawn) },
    { label: "Active Deposits", value: money(balances.activeDeposits) },
    { label: "Total Earnings", value: money(balances.totalEarnings) },
    { label: "Referral Bonus", value: money(balances.referralBonus) },
  ];

  const copyLink = async () => {
    await navigator.clipboard?.writeText(referralLink);
    toast.success("Referral link copied", { description: "Share it to start earning bonuses." });
  };

  return (
    <MemberLayout title="Dashboard" crumb={`Welcome back, ${name}`}>
      <div className="member-stats">
        {stats.map((item) => (
          <article key={item.label} className="member-stat">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <Wallet />
          </article>
        ))}
      </div>

      <div className="member-notice"><Megaphone /><div>{notices.map((notice) => <p key={notice}>{notice}</p>)}</div></div>

      <div className="member-two">
        <MemberPanel title="Investment Plans" action={<Link to="/deposit" className="member-link">Make a deposit <ArrowUpRight /></Link>}>
          <ul className="member-plan-list">
            {plans.map((plan) => (
              <li key={plan.name}><strong>{plan.name}</strong><span>{plan.range}</span><em>{plan.rate}% daily</em></li>
            ))}
          </ul>
        </MemberPanel>
        <MemberPanel title="Referral Link">
          <p className="member-muted">Share your link and earn a bonus on every deposit made by your referrals.</p>
          <code className="member-code">{referralLink || "Loading your link…"}</code>
          <button type="button" className="member-button ghost" onClick={() => void copyLink()}><Copy /> Copy Referral Link</button>
          <Link to="/referral" className="member-button">View referral stats</Link>
        </MemberPanel>
      </div>

      <MemberPanel title="Recent Transactions">
        <DataTable
          columns={["Type", "Amount", "Date", "Status"]}
          empty="No transactions found"
          rows={transactions.slice(0, 5).map((item) => [
            <span className="member-capitalise">{item.type}</span>,
            money(Number(item.amount)),
            shortDate(item.created_at),
            <span className={`member-badge ${item.status}`}>{item.status}</span>,
          ])}
        />
      </MemberPanel>
    </MemberLayout>
  );
}
