import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Deposit = Tables<"deposits">;
export type Withdrawal = Tables<"withdrawals">;
export type Transaction = Tables<"transactions">;
export type Ticket = Tables<"support_tickets">;

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeposits() {
  return useQuery({
    queryKey: ["deposits"],
    queryFn: async (): Promise<Deposit[]> => {
      const { data, error } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWithdrawals() {
  return useQuery({
    queryKey: ["withdrawals"],
    queryFn: async (): Promise<Withdrawal[]> => {
      const { data, error } = await supabase.from("withdrawals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type Balances = {
  balance: number;
  totalDeposit: number;
  totalWithdrawn: number;
  activeDeposits: number;
  totalEarnings: number;
  referralBonus: number;
};

export function useBalances(): Balances {
  const { data: deposits = [] } = useDeposits();
  const { data: withdrawals = [] } = useWithdrawals();
  const { data: transactions = [] } = useTransactions();

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const totalDeposit = sum(deposits.filter((d) => d.status === "active" || d.status === "completed").map((d) => Number(d.amount)));
  const activeDeposits = sum(deposits.filter((d) => d.status === "active").map((d) => Number(d.amount)));
  const totalWithdrawn = sum(withdrawals.filter((w) => w.status === "completed").map((w) => Number(w.amount)));
  const totalEarnings = sum(transactions.filter((t) => t.type === "earning" && t.status === "completed").map((t) => Number(t.amount)));
  const referralBonus = sum(transactions.filter((t) => t.type === "referral bonus" && t.status === "completed").map((t) => Number(t.amount)));

  return {
    balance: totalEarnings + referralBonus - totalWithdrawn,
    totalDeposit,
    totalWithdrawn,
    activeDeposits,
    totalEarnings,
    referralBonus,
  };
}

export type Notification = { id: string; title: string; body: string; date: string };

/** The bell feed: every real event on the account, newest first. */
export function useNotifications() {
  const { data: profile } = useProfile();
  const { data: deposits = [] } = useDeposits();
  const { data: withdrawals = [] } = useWithdrawals();
  const { data: transactions = [] } = useTransactions();
  const { data: tickets = [] } = useTickets();

  const items: Notification[] = [
    ...deposits.map((d) => ({
      id: `deposit-${d.id}`,
      title: `Deposit ${d.status}`,
      body: `${Number(d.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })} on the ${d.plan}.`,
      date: d.created_at,
    })),
    ...withdrawals.map((w) => ({
      id: `withdrawal-${w.id}`,
      title: `Withdrawal ${w.status}`,
      body: `${Number(w.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })} to your ${w.method} wallet.`,
      date: w.created_at,
    })),
    ...transactions.map((t) => ({
      id: `transaction-${t.id}`,
      title: `${t.type} ${t.status}`,
      body: `${Number(t.amount).toLocaleString("en-US", { style: "currency", currency: "USD" })} recorded on your account.`,
      date: t.created_at,
    })),
    ...tickets.map((t) => ({
      id: `ticket-${t.id}`,
      title: `Support ticket ${t.status}`,
      body: t.subject,
      date: t.created_at,
    })),
  ];

  if (profile) {
    items.push({
      id: "welcome",
      title: "Welcome to MeridianVest",
      body: `Your member account @${profile.username} is ready. Make your first deposit to start earning.`,
      date: profile.created_at,
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

const SEEN_KEY = "lpa-notifications-seen";

export function useUnread(items: Notification[]) {
  const [seenAt, setSeenAt] = useState(0);

  useEffect(() => {
    setSeenAt(Number(localStorage.getItem(SEEN_KEY) ?? 0));
  }, []);

  const unread = items.filter((item) => new Date(item.date).getTime() > seenAt).length;
  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* storage unavailable */
    }
  };

  return { unread, markAllRead };
}

/** Refresh every account query after a write, so the bell and totals stay in step. */
export function useRefreshAccount() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ["profile", "deposits", "withdrawals", "transactions", "tickets"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function notifyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  toast.error(fallback, { description: message });
}
