import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { DataTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { useProfile, useTransactions } from "@/lib/account";
import { money, shortDate } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({ meta: [
    { title: "My Referral | Legacy Pro Alliance" },
    { name: "description", content: "Share your Legacy Pro Alliance referral link and earn a bonus on every deposit your referrals make." },
    { property: "og:title", content: "My Referral | Legacy Pro Alliance" },
    { property: "og:description", content: "Share your referral link and earn bonuses." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ReferralPage,
});

function ReferralPage() {
  const { data: profile } = useProfile();
  const { data: transactions = [] } = useTransactions();

  const bonuses = transactions.filter((item) => item.type === "referral bonus");
  const total = bonuses.reduce((sum, item) => sum + Number(item.amount), 0);
  const referralLink = typeof window === "undefined" || !profile
    ? ""
    : `${window.location.origin}/signup?ref=${profile.referral_code}`;

  const copyLink = async () => {
    await navigator.clipboard?.writeText(referralLink);
    toast.success("Referral link copied", { description: "Share it to start earning bonuses." });
  };

  return (
    <MemberLayout title="My Referral" crumb="Invite others and earn bonuses">
      <div className="member-stats three">
        <article className="member-stat"><span>Referral Bonuses Paid</span><strong>{bonuses.length}</strong></article>
        <article className="member-stat"><span>Referral Bonus</span><strong>{money(total)}</strong></article>
        <article className="member-stat"><span>Bonus Rate</span><strong>5%</strong></article>
      </div>

      <MemberPanel title="Your Referral Link">
        <code className="member-code">{referralLink || "Loading your link…"}</code>
        <button type="button" className="member-button ghost" onClick={() => void copyLink()}><Copy /> Copy Link</button>
        <p className="member-muted">You earn 5% of every deposit made by a member who signs up through your link.</p>
      </MemberPanel>

      <MemberPanel title="Referral Earnings">
        <DataTable
          columns={["Type", "Amount", "Date", "Status"]}
          empty="No referral earnings yet"
          rows={bonuses.map((item) => [
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
