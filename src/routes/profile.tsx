import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";

import { MemberLayout, MemberPanel } from "@/components/member-chrome";
import { member } from "@/lib/member-data";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [
    { title: "My Profile | Legacy Pro Alliance" },
    { name: "description", content: "Update your personal details, password and crypto wallet addresses on Legacy Pro Alliance." },
    { property: "og:title", content: "My Profile | Legacy Pro Alliance" },
    { property: "og:description", content: "Update your details, password and wallet addresses." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [message, setMessage] = useState("");
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("Changes saved in preview mode. Connecting your account service will make this live.");
  };
  return (
    <MemberLayout title="My Profile" crumb={`Member since ${member.joined}`}>
      <form className="member-two" onSubmit={save}>
        <MemberPanel title="Account Details">
          <label className="member-field"><span>Full Name</span><input name="name" defaultValue={member.name} /></label>
          <label className="member-field"><span>Username</span><input name="username" defaultValue={member.username} readOnly /></label>
          <label className="member-field"><span>E-mail Address</span><input name="email" type="email" defaultValue={member.email} /></label>
          <label className="member-field"><span>Phone</span><input name="phone" defaultValue={member.phone} /></label>
          <label className="member-field"><span>Country</span><input name="country" defaultValue={member.country} /></label>
          <p className="member-muted">Your Upline: {member.upline}</p>
        </MemberPanel>

        <MemberPanel title="Wallet Addresses">
          <label className="member-field"><span>Bitcoin Wallet</span><input name="btc" defaultValue={member.wallets.bitcoin} /></label>
          <label className="member-field"><span>USDT Wallet</span><input name="usdt" defaultValue={member.wallets.usdt} /></label>
          <label className="member-field"><span>Ethereum Wallet</span><input name="eth" defaultValue={member.wallets.ethereum} /></label>
          <label className="member-field"><span>Litecoin Wallet</span><input name="ltc" defaultValue={member.wallets.litecoin} /></label>
        </MemberPanel>

        <MemberPanel title="Change Password">
          <label className="member-field"><span>Current Password</span><input name="current" type="password" placeholder="••••••••" /></label>
          <label className="member-field"><span>New Password</span><input name="new" type="password" placeholder="••••••••" /></label>
          <label className="member-field"><span>Retype New Password</span><input name="retype" type="password" placeholder="••••••••" /></label>
          <button type="submit" className="member-button">Save Changes</button>
          {message && <p className="member-status" role="status">{message}</p>}
        </MemberPanel>
      </form>
    </MemberLayout>
  );
}
