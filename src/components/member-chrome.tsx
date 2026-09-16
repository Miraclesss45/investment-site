import { ReactNode, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, CircleUserRound, Gauge, HeadphonesIcon, LayoutList, LogOut, Menu,
  MessageCircle, Moon, PiggyBank, Share2, Sun, Upload, Wallet, X,
} from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications, useProfile, useUnread } from "@/lib/account";
import { shortDate } from "@/lib/member-data";
import { useTheme } from "@/lib/theme";
import { LanguageSelect } from "@/lib/i18n";

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

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className ?? "member-icon-button"}
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Dark mode" : "Light mode"}
    >
      {theme === "light" ? <Moon /> : <Sun />}
    </Button>
  );
}

function NotificationBell() {
  const items = useNotifications();
  const { unread, markAllRead } = useUnread(items);
  return (
    <DropdownMenu onOpenChange={(open) => open && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="member-bell" aria-label={`Notifications (${unread} unread)`}>
          <Bell />
          {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="member-menu notifications">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="member-menu-empty">You have no notifications yet.</p>
        ) : (
          items.slice(0, 8).map((item) => (
            <div key={item.id} className="member-notification">
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              <em>{shortDate(item.date)}</em>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ initial, name, username }: { initial: string; name: string; username: string }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="member-avatar sm as-button" aria-label="Account menu">{initial}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="member-menu">
        <DropdownMenuLabel>
          <strong>{name}</strong>
          <span className="member-menu-sub">@{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/profile"><CircleUserRound /> My Profile</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/referral"><Share2 /> My Referral</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/member-support"><HeadphonesIcon /> Get Support</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="member-menu-danger"><LogOut /> Log Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MemberLayout({ title, crumb, children }: { title: string; crumb?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: profile } = useProfile();
  const signOut = useSignOut();
  const name = profile?.full_name?.trim() || profile?.username || "Member";
  const username = profile?.username ?? "member";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`member-shell${open ? " is-open" : ""}`}>
      <aside className="member-sidebar">
        <div className="member-brand">
          <Link to="/" className="member-logo"><strong>MERIDIAN</strong><span>VEST</span></Link>
          <button type="button" className="member-close" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
        </div>
        <div className="member-card-user">
          <div className="member-avatar">{initial}</div>
          <div><strong>{name}</strong><span>@{username}</span></div>
        </div>
        <nav className="member-nav">
          {navItems.map(({ to, label, Icon }) => (
            <Link key={to} to={to} activeProps={{ className: "is-active" }} onClick={() => setOpen(false)}>
              <Icon /> {label}
            </Link>
          ))}
          <button type="button" className="member-logout" onClick={() => void signOut()}><LogOut /> Log Out</button>
        </nav>
      </aside>

      <div className="member-main">
        <header className="member-topbar">
          <button type="button" className="member-burger" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <div className="member-title"><h1>{title}</h1>{crumb && <p>{crumb}</p>}</div>
          <div className="member-topbar-actions">
            <LanguageSelect />
            <ThemeToggle />
            <NotificationBell />
            <AccountMenu initial={initial} name={name} username={username} />
          </div>
        </header>
        <main className="member-content">{children}</main>
        <footer className="member-footer">copyright © 2025, <span>meridianvest.com</span> All Rights Reserved</footer>
      </div>

      <button type="button" className="member-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
      <a className="member-chat" href="https://t.me/meridianvest" target="_blank" rel="noreferrer"><MessageCircle /> Chat</a>
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

export function DataTable({ columns, rows, empty }: { columns: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <div className="member-table-wrap">
      <table className="member-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="member-empty">{empty}</td></tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>
      <div className="member-pagination">
        <button type="button" disabled>Previous</button>
        <span>Page 1 of 1</span>
        <button type="button" disabled>Next</button>
      </div>
    </div>
  );
}
