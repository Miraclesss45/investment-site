import { ReactNode, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell, CircleUserRound, Gauge, HeadphonesIcon, LayoutList, LogOut, Menu,
  MessageCircle, PiggyBank, Share2, Upload, Wallet, X,
} from "lucide-react";

import { member } from "@/lib/member-data";

const navItems = [
  { to: "/dashboard", label: "Dashboard", Icon: Gauge },
  { to: "/deposit", label: "Make Deposit", Icon: Wallet },
  { to: "/my-deposits", label: "My Deposits", Icon: PiggyBank },
  { to: "/withdraw", label: "Withdraw", Icon: Upload },
  { to: "/transactions", label: "Transactions", Icon: LayoutList },
  { to: "/profile", label: "My Profile", Icon: CircleUserRound },
  { to: "/referral", label: "My Referral", Icon: Share2 },
  { to: "/member-support", label: "Get Support", Icon: HeadphonesIcon },
] as const;

export function MemberLayout({ title, crumb, children }: { title: string; crumb?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`member-shell${open ? " is-open" : ""}`}>
      <aside className="member-sidebar">
        <div className="member-brand">
          <Link to="/" className="member-logo"><strong>LEGACY</strong><span>PRO ALLIANCE</span></Link>
          <button type="button" className="member-close" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="member-card-user">
          <div className="member-avatar">{member.name.charAt(0)}</div>
          <div><strong>{member.name}</strong><span>@{member.username}</span></div>
        </div>
        <nav className="member-nav">
          {navItems.map(({ to, label, Icon }) => (
            <Link key={to} to={to} activeProps={{ className: "is-active" }} onClick={() => setOpen(false)}>
              <Icon /> {label}
            </Link>
          ))}
          <Link to="/login" className="member-logout" onClick={() => setOpen(false)}><LogOut /> Log Out</Link>
        </nav>
      </aside>

      <div className="member-main">
        <header className="member-topbar">
          <button type="button" className="member-burger" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <div className="member-title"><h1>{title}</h1>{crumb && <p>{crumb}</p>}</div>
          <div className="member-topbar-actions">
            <button type="button" className="member-bell" aria-label="Notifications"><Bell /><span>3</span></button>
            <div className="member-avatar sm">{member.name.charAt(0)}</div>
          </div>
        </header>
        <main className="member-content">{children}</main>
        <footer className="member-footer">copyright © 2025, <span>legacyproalliance.org</span> All Rights Reserved</footer>
      </div>

      <button type="button" className="member-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
      <a className="member-chat" href="https://t.me/legacyproalliance" target="_blank" rel="noreferrer"><MessageCircle /> Chat</a>
    </div>
  );
}

export function MemberPanel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="member-panel">
      <div className="member-panel-head"><h2>{title}</h2>{action}</div>
      <div className="member-panel-body">{children}</div>
    </section>
  );
}

export function EmptyTable({ columns, message }: { columns: string[]; message: string }) {
  return (
    <div className="member-table-wrap">
      <table className="member-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className="member-empty">{message}</td></tr></tbody>
      </table>
      <div className="member-pagination"><button type="button" disabled>Previous</button><span>Page 1 of 1</span><button type="button" disabled>Next</button></div>
    </div>
  );
}
