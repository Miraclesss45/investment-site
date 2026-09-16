import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { member } from "@/lib/member-data";

export const Route = createFileRoute("/referral")({
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
  return (
    <MemberLayout title="My Referral" crumb="Invite others and earn bonuses">
      <div className="member-stats three">
        <article className="member-stat"><span>Total Referrals</span><strong>0</strong></article>
        <article className="member-stat"><span>Referral Bonus</span><strong>$0.00</strong></article>
        <article className="member-stat"><span>Bonus Rate</span><strong>5%</strong></article>
      </div>

      <MemberPanel title="Your Referral Link">
        <code className="member-code">{member.referralLink}</code>
        <button type="button" className="member-button ghost" onClick={() => navigator.clipboard?.writeText(member.referralLink)}><Copy /> Copy Link</button>
        <p className="member-muted">You earn 5% of every deposit made by a member who signs up through your link.</p>
      </MemberPanel>

      <MemberPanel title="Referred Members">
        <EmptyTable columns={["Username", "Joined", "Deposits", "Bonus Earned"]} message="No referrals found" />
      </MemberPanel>
    </MemberLayout>
  );
}
