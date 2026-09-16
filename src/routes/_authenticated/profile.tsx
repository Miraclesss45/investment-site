import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { MemberLayout, MemberPanel } from "@/components/member-chrome";
import { supabase } from "@/integrations/supabase/client";
import { notifyError, useProfile, useRefreshAccount } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "My Profile | Legacy Pro Alliance" },
    { name: "description", content: "Update your Legacy Pro Alliance contact details, payout wallets and account password." },
    { property: "og:title", content: "My Profile | Legacy Pro Alliance" },
    { property: "og:description", content: "Update your details, wallets and password." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const refresh = useRefreshAccount();
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    const data = new FormData(event.currentTarget);
    setSavingDetails(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: String(data.get("full_name")),
        phone: String(data.get("phone")),
        country: String(data.get("country")),
        btc_wallet: String(data.get("btc_wallet")),
        usdt_wallet: String(data.get("usdt_wallet")),
        eth_wallet: String(data.get("eth_wallet")),
        ltc_wallet: String(data.get("ltc_wallet")),
      }).eq("id", profile.id);
      if (error) throw error;
      refresh();
      toast.success("Profile updated", { description: "Your details and wallets were saved." });
    } catch (error) {
      notifyError(error, "We could not save your profile");
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) {
      toast.error("Passwords do not match", { description: "Retype the new password exactly." });
      return;
    }
    setSavingPassword(true);
    try {
      const current = String(data.get("current") ?? "");
      const { error } = await supabase.auth.updateUser(
        current ? { password, current_password: current } as never : { password },
      );
      if (error) throw error;
      form.reset();
      toast.success("Password changed", { description: "Use your new password next time you sign in." });
    } catch (error) {
      notifyError(error, "We could not change your password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <MemberLayout title="My Profile" crumb="Your details, wallets and password">
      {isLoading ? (
        <MemberPanel title="Account Details"><p className="member-muted">Loading your profile…</p></MemberPanel>
      ) : (
        <div className="member-two">
          <MemberPanel title="Account Details">
            <form onSubmit={saveDetails}>
              <label className="member-field"><span>Full Name</span><input name="full_name" defaultValue={profile?.full_name ?? ""} required /></label>
              <label className="member-field"><span>Username</span><input value={profile?.username ?? ""} readOnly /></label>
              <label className="member-field"><span>E-mail Address</span><input value={profile?.email ?? ""} readOnly /></label>
              <label className="member-field"><span>Phone</span><input name="phone" defaultValue={profile?.phone ?? ""} /></label>
              <label className="member-field"><span>Country</span><input name="country" defaultValue={profile?.country ?? ""} /></label>
              <label className="member-field"><span>Bitcoin Wallet</span><input name="btc_wallet" defaultValue={profile?.btc_wallet ?? ""} /></label>
              <label className="member-field"><span>USDT Wallet</span><input name="usdt_wallet" defaultValue={profile?.usdt_wallet ?? ""} /></label>
              <label className="member-field"><span>Ethereum Wallet</span><input name="eth_wallet" defaultValue={profile?.eth_wallet ?? ""} /></label>
              <label className="member-field"><span>Litecoin Wallet</span><input name="ltc_wallet" defaultValue={profile?.ltc_wallet ?? ""} /></label>
              <button type="submit" className="member-button" disabled={savingDetails}>{savingDetails ? "Saving…" : "Update Profile"}</button>
            </form>
          </MemberPanel>

          <MemberPanel title="Change Password">
            <form onSubmit={savePassword}>
              <label className="member-field"><span>Current Password</span><input name="current" type="password" autoComplete="current-password" /></label>
              <label className="member-field"><span>New Password</span><input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
              <label className="member-field"><span>Retype New Password</span><input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>
              <button type="submit" className="member-button" disabled={savingPassword}><KeyRound /> {savingPassword ? "Updating…" : "Change Password"}</button>
            </form>
            <p className="member-note"><ShieldCheck /> Your referral code is <strong>{profile?.referral_code}</strong>. Keep your password private — support will never ask for it.</p>
          </MemberPanel>
        </div>
      )}
    </MemberLayout>
  );
}
