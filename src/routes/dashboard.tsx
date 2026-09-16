import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Megaphone, Wallet } from "lucide-react";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { balances, member, notices, plans } from "@/lib/member-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [
    { title: "Member Dashboard | Legacy Pro Alliance" },
    { name: "description", content: "Track your balance, active deposits, earnings and referral bonus in your Legacy Pro Alliance member area." },
    { property: "og:title", content: "Member Dashboard | Legacy Pro Alliance" },
    { property: "og:description", content: "Track your balance, active deposits and earnings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <MemberLayout title="Dashboard" crumb={`Welcome back, ${member.name}`}>
      <div className="member-stats">
        {balances.map((item) => (
          <article key={item.label} className="member-stat">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <Wallet />
          </article>
        ))}
      </div>

      <div className="member-notice"><Megaphone /><div>{notices.map((n) => <p key={n}>{n}</p>)}</div></div>

      <div className="member-two">
        <MemberPanel title="Investment Plans" action={<Link to="/deposit" className="member-link">Make a deposit <ArrowUpRight /></Link>}>
          <ul className="member-plan-list">
            {plans.map((plan) => (
              <li key={plan.name}><strong>{plan.name}</strong><span>{plan.range}</span><em>{plan.rate} daily</em></li>
            ))}
          </ul>
        </MemberPanel>
        <MemberPanel title="Referral Link">
          <p className="member-muted">Share your link and earn a bonus on every deposit made by your referrals.</p>
          <code className="member-code">{member.referralLink}</code>
          <Link to="/referral" className="member-button">View referral stats</Link>
        </MemberPanel>
      </div>

      <MemberPanel title="Recent Transactions">
        <EmptyTable columns={["Type", "Amount", "Date", "Status"]} message="No transactions found" />
      </MemberPanel>
    </MemberLayout>
  );
}
