import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { plans } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/my-deposits")({
  head: () => ({ meta: [
    { title: "My Deposits | Legacy Pro Alliance" },
    { name: "description", content: "Review every active and completed deposit on your Legacy Pro Alliance account." },
    { property: "og:title", content: "My Deposits | Legacy Pro Alliance" },
    { property: "og:description", content: "Review your active and completed deposits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: MyDepositsPage,
});

function MyDepositsPage() {
  return (
    <MemberLayout title="My Deposits" crumb="Active and completed deposits">
      <MemberPanel title="Deposit History" action={<Link to="/deposit" className="member-link">New deposit</Link>}>
        <EmptyTable columns={["Plan", "Amount", "Daily Yield", "Start Date", "End Date", "Status"]} message="No deposits found" />
      </MemberPanel>
      <MemberPanel title="Available Plans">
        <ul className="member-plan-list">
          {plans.map((plan) => <li key={plan.name}><strong>{plan.name}</strong><span>{plan.range}</span><em>{plan.rate} daily · 14 days</em></li>)}
        </ul>
      </MemberPanel>
    </MemberLayout>
  );
}
