import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, FileText, Menu, MessageCircle, Package,
  ExternalLink, RefreshCw, Search, ShieldCheck, TrendingUp, Users, WalletCards,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { changeAdminPassword, getAdminPage, getAdminRecord, getAdminResource, requestAdminAction, reauthenticateAdmin } from "../../lib/adminApi";
import { getAuthErrorMessage, getSafeErrorMessage } from "../../lib/authHelpers";
import { clearAdminLoginSession } from "../../lib/adminSession";
import { formatMoney } from "../../lib/financial";
import { referralRewardStatusLabel } from "../../lib/referralRewards";
import FeedbackMessage from "../../components/ui/FeedbackMessage";
import { firestoreDb } from "../../lib/firebaseFirestore";
import { subscribeToAdminConversations } from "../../lib/supportChat";
import AdminSupportChat from "./AdminSupportChat";
import SkipToContent from "../../components/ui/SkipToContent";

const QUEUE_SECTIONS = {
  withdrawals: "withdrawals",
  deposits: "deposits",
  support: "support",
  "support-chat": "support-chat",
  referrals: "referrals",
};

const navGroups = [
  {
    label: "Plans",
    items: [
      ["/control-room/packages", "Investment programs", Package],
      ["/control-room/transactions?view=expiring", "Maturing investments", ArrowDownToLine],
    ],
  },
  {
    label: "Users",
    items: [
      ["/control-room/users", "Members", Users],
      ["/control-room/users?view=blacklist", "Account restrictions", ShieldCheck],
      ["/control-room/referrals?view=top", "Referral leaders", TrendingUp],
    ],
  },
  {
    label: "Requests",
    items: [
      ["/control-room/withdrawals?view=queue", "Withdrawal queue", ArrowUpRight],
      ["/control-room/withdrawals?view=history", "Withdrawal history", ClipboardList],
      ["/control-room/deposits", "All deposits", ArrowDownToLine],
      ["/control-room/deposits?status=pending", "Pending deposits", ArrowDownToLine],
      ["/control-room/referrals", "Referral rewards", TrendingUp],
    ],
  },
  {
    label: "Transactions",
    items: [
      ["/control-room/transactions", "Transactions & investments", WalletCards],
      ["/control-room/transactions?type=earnings", "Earnings", TrendingUp],
      ["/control-room/transactions?type=referral", "Referral activity", TrendingUp],
      ["/control-room/transactions?type=withdrawal", "Withdrawal ledger activity", ArrowUpRight],
      ["/control-room/transactions/new?entry=bonus", "Add funds", TrendingUp],
    ],
  },
  {
    label: "Settings",
    items: [
      ["/control-room/admins", "Admin profile & security", ShieldCheck],
    ],
  },
  {
    label: "Utils",
    items: [
      ["/control-room/support-chat", "Support chat", MessageCircle],
      ["/control-room/support", "Support tickets", CircleHelp],
      ["/control-room/audit", "Audit history", ClipboardList],
    ],
  },
];

const resources = {
  users: ["Users", "Review accounts, verification and access."],
  admins: ["Admins", "View current administrators and manage your own security."],
  deposits: ["Deposits", "Review incoming funds before they are credited."],
  withdrawals: ["Withdrawals", "Approve or hold outgoing payment requests."],
  support: ["Support tickets", "Keep customer conversations moving."],
  "support-chat": ["Support chat", "Respond to member and guest messages in real time."],
  transactions: ["Transactions & investments", "Trace money movement and active investments."],
  packages: ["Investment packages", "Manage the offers displayed to members."],
  referrals: ["Referrals", "Attributed signups, verification, and referral credit status."],
  "top-referrals": ["Top referrers", "The ten members with the highest verified referral counts."],
  audit: ["Audit history", "A read-only trail of privileged activity."],
};

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function AdminRouteMessage({ title, description }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1626] p-10 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-sm text-slate-400">{description}</p>
      <Link
        to="/control-room"
        className="mt-6 inline-flex rounded-md bg-sky-300 px-4 py-2 text-sm font-bold text-[#081321] hover:bg-sky-200"
      >
        Return to overview
      </Link>
    </div>
  );
}

function ReferralDetails({ userId, rewardId }) {
  const location = useLocation();
  const collection = new URLSearchParams(location.search).get("collection") || "referralRewards";
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminRecord("referrals", userId, rewardId, collection)
      .then((match) => {
        if (!active) return;
        if (!match) {
          setError("The requested referral reward could not be found.");
          return;
        }
        setReward(match);
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load referral details.")));
    return () => {
      active = false;
    };
  }, [collection, rewardId, userId]);

  const detailEntries = reward
    ? Object.entries(reward).filter(([key]) => !["id", "userId", "collection"].includes(key))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Referral details</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{collection === "referralAttributions" ? "Referral attribution" : "Referral reward details"}</h1>
          <p className="mt-1 text-sm text-slate-400">Referral credits are promotional and become available after the referred member verifies their account and signs in.</p>
        </div>
        <Link to="/control-room/referrals" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Back to referrals</Link>
      </div>
      {error ? (
        <FeedbackMessage type="error">{error}</FeedbackMessage>
      ) : !reward ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1626] p-12 text-center text-sm text-slate-400">Loading referral details…</div>
      ) : (
        <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-sky-300">{collection === "referralAttributions" ? "Attributed member" : "Reward record"}</p>
              <h2 className="mt-2 break-all font-semibold text-slate-900">{reward.id}</h2>
            </div>
            <Status>{collection === "referralAttributions" ? referralRewardStatusLabel(reward.rewardStatus) : referralRewardStatusLabel(reward.status)}</Status>
          </div>
          <dl className="divide-y divide-white/10">
            <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Reward owner</dt>
              <dd className="break-all text-sm text-slate-200">{userId}</dd>
            </div>
            {detailEntries.map(([key, value]) => (
              <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]" key={key}>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="break-all text-sm text-slate-200">{value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function Status({ children }) {
  const tones = {
    active: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    approved: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    paid: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    completed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    credited: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    promotional: "bg-blue-400/10 text-blue-200 ring-blue-300/25",
    "promotional credit": "bg-blue-400/10 text-blue-200 ring-blue-300/25",
    "pending verification": "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    open: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    pending: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    review: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    suspended: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
    rejected: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
    disabled: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
  };
  const tone = tones[String(children || "").toLowerCase()] || "bg-white/10 text-slate-300 ring-white/15";
  return <span className={`admin-status inline-flex rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${tone}`}>{children || "—"}</span>;
}

function Metric({ label, value, detail, icon: Icon }) {
  const loading = String(value).toLowerCase().startsWith("loading");
  return (
    <div className="admin-metric rounded-lg border border-white/10 bg-[#0b1626] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}<Icon size={17} className="text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900" role={loading ? "status" : undefined}>
        {loading ? <><span className="admin-count-skeleton" aria-hidden="true" /><span className="sr-only">Loading {label.toLowerCase()}</span></> : value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function TransactionDetails({ userId, transactionId, collection }) {
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminRecord("transactions", userId, transactionId, collection || "transactions")
      .then((match) => {
        if (!active) return;
        if (!match) {
          setError("The requested transaction could not be found.");
          return;
        }
        setTransaction(match);
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load transaction details.")));
    return () => {
      active = false;
    };
  }, [collection, transactionId, userId]);

  const detailEntries = transaction
    ? Object.entries(transaction).filter(([key]) => !["id", "userId", "collection", "__searchText"].includes(key))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Transaction details</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Transaction record</h1>
          <p className="mt-1 text-sm text-slate-400">Read-only details for this financial record.</p>
        </div>
        <Link to="/control-room/transactions" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Back to transactions</Link>
      </div>
      {error ? (
        <FeedbackMessage type="error">{error}</FeedbackMessage>
      ) : !transaction ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1626] p-12 text-center text-sm text-slate-400">Loading transaction details…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["User", transaction.userId],
              ["Record type", transaction.collection || "transactions"],
              ["Status", transaction.status || "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[#0b1626] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-3 break-all text-sm font-bold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Full record</p>
                <h2 className="mt-2 font-semibold text-slate-900">{transaction.id}</h2>
              </div>
              <Status>{transaction.status || "—"}</Status>
            </div>
            <dl className="divide-y divide-white/10">
              {detailEntries.map(([key, value]) => (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]" key={key}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key}</dt>
                  <dd className="break-words text-sm text-slate-200">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function SupportDetails({ userId, ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminRecord("support", userId, ticketId, "supportTickets")
      .then((match) => {
        if (!active) return;
        if (!match) {
          setError("The requested support ticket could not be found.");
          return;
        }
        setTicket(match);
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load support ticket details.")));
    return () => {
      active = false;
    };
  }, [ticketId, userId]);

  const detailEntries = ticket
    ? Object.entries(ticket).filter(([key]) => !["id", "userId", "collection", "__searchText"].includes(key))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Support ticket details</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Support request</h1>
          <p className="mt-1 text-sm text-slate-400">Read-only information for this member support request.</p>
        </div>
        <Link to="/control-room/support" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Back to support tickets</Link>
      </div>
      {error ? (
        <FeedbackMessage type="error">{error}</FeedbackMessage>
      ) : !ticket ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1626] p-12 text-center text-sm text-slate-400">Loading support ticket details…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Requester email", ticket.profileEmail || ticket.email || "Not recorded"],
              ["Username", ticket.profileUsername || ticket.username || "Not recorded"],
              ["User ID", ticket.userId],
              ["Status", ticket.status || "Open"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[#0b1626] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-3 break-all text-sm font-bold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Full ticket record</p>
                <h2 className="mt-2 font-semibold text-slate-900">{ticket.id}</h2>
              </div>
              <Status>{ticket.status || "Open"}</Status>
            </div>
            <dl className="divide-y divide-white/10">
              {detailEntries.map(([key, value]) => (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]" key={key}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function DepositDetails({ userId, depositId, onAction, refreshKey }) {
  const [deposit, setDeposit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setDeposit(null);
    setError("");
    getAdminRecord("deposits", userId, depositId, "deposits")
      .then((match) => {
        if (!active) return;
        if (!match) {
          setError("The requested deposit could not be found.");
          return;
        }
        setDeposit(match);
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load deposit details.")));
    return () => {
      active = false;
    };
  }, [depositId, refreshKey, userId]);

  const status = String(deposit?.status || "pending").toLowerCase();
  const detailEntries = deposit
    ? Object.entries(deposit).filter(([key]) => !["id", "userId", "collection", "__searchText", "profileEmail", "profileUsername", "emailNotifications"].includes(key))
    : [];
  const canCredit = deposit && ["pending", "approved"].includes(status);
  const canDelete = deposit
    && !["approved", "completed", "settled", "credited"].includes(status)
    && !deposit.settlementId;
  const failedSuccessEmail = deposit?.emailNotifications?.successful?.status === "failed";

  return (
    <div className="admin-review-page admin-review-deposit space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Deposit review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Deposit request</h1>
          <p className="mt-1 text-sm text-slate-400">Confirm the member, payment details, and status before taking action.</p>
        </div>
        <Link to="/control-room/deposits" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Back to deposits</Link>
      </div>
      {error ? (
        <FeedbackMessage type="error">{error}</FeedbackMessage>
      ) : !deposit ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1626] p-12 text-center text-sm text-slate-400">Loading deposit details…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Username", deposit.profileUsername || deposit.username || "Not recorded"],
              ["Member email", deposit.profileEmail || deposit.email || "Not recorded"],
              ["Member ID", deposit.userId],
              ["Status", deposit.status || "Pending"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[#0b1626] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-3 break-all text-sm font-bold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Payment request details</p>
                <h2 className="mt-2 break-all font-semibold text-slate-900">{deposit.id}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Status>{deposit.status || "Pending"}</Status>
                {canCredit && (
                  <button onClick={() => onAction("settle-deposit", deposit)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">
                    Credit offline payment
                  </button>
                )}
                {failedSuccessEmail && (
                  <button onClick={() => onAction("retry-deposit-email", deposit)} className="text-xs font-bold text-amber-200 hover:text-amber-100">
                    Retry confirmation email
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onAction("delete-deposit", deposit)} className="text-xs font-bold text-rose-300 hover:text-rose-200">
                    Delete request
                  </button>
                )}
              </div>
            </div>
            <dl className="divide-y divide-white/10">
              {detailEntries.map(([key, value]) => (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]" key={key}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
                </div>
              ))}
              {deposit.emailNotifications && (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Email notifications</dt>
                  <dd className="break-words text-sm text-slate-200">{JSON.stringify(deposit.emailNotifications)}</dd>
                </div>
              )}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function WithdrawalDetails({ userId, withdrawalId, onAction, refreshKey }) {
  const [withdrawal, setWithdrawal] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminRecord("withdrawals", userId, withdrawalId, "withdrawals")
      .then((match) => {
        if (!active) return;
        if (!match) {
          setError("The requested withdrawal could not be found.");
          return;
        }
        setWithdrawal(match);
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load withdrawal details.")));
    return () => {
      active = false;
    };
  }, [refreshKey, userId, withdrawalId]);

  const detailEntries = withdrawal
    ? Object.entries(withdrawal).filter(([key]) => !["id", "__searchText", "emailNotifications"].includes(key))
    : [];
  const status = String(withdrawal?.status || "pending").toLowerCase();
  const completionEmail = withdrawal?.emailNotifications?.completed || null;
  const canRetryCompletionEmail = status === "completed" && completionEmail?.status === "failed";
  const canDelete = withdrawal
    && !withdrawal.settlementId
    && !withdrawal.settledAt
    && !withdrawal.completedAt
    && !withdrawal.paidAt
    && !["complete", "completed", "settled", "paid", "success"].includes(status);

  return (
    <div className="admin-review-page admin-review-withdrawal space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Withdrawal review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Withdrawal request</h1>
          <p className="mt-1 text-sm text-slate-400">Review the member identity, requested payout, and current processing status.</p>
        </div>
        <Link to="/control-room/withdrawals" className="text-sm font-semibold text-sky-300 hover:text-sky-200">Back to withdrawals</Link>
      </div>
      {error ? (
        <FeedbackMessage type="error">{error}</FeedbackMessage>
      ) : !withdrawal ? (
        <div className="rounded-lg border border-white/10 bg-[#0b1626] p-12 text-center text-sm text-slate-400">Loading withdrawal details…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Username", withdrawal.profileUsername || withdrawal.username || "Not recorded"],
              ["Member email", withdrawal.profileEmail || withdrawal.email || "Not recorded"],
              ["Member ID", withdrawal.userId],
              ["Status", withdrawal.status || "Pending"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-[#0b1626] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-3 break-all text-sm font-bold text-slate-900">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Request details</p>
                <h2 className="mt-2 font-semibold text-slate-900">{withdrawal.id}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Status>{withdrawal.status || "Pending"}</Status>
                {["pending", "on-hold"].includes(status) && (
                  <>
                    <button
                      onClick={() => onAction("approve-withdrawal", withdrawal)}
                      className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Approve and complete
                    </button>
                    {String(withdrawal.status || "pending").toLowerCase() !== "approved" && (
                      <button
                        onClick={() => onAction("withdrawal-decision", { ...withdrawal, resource: "withdrawals", nextStatus: "rejected" })}
                        className="text-xs font-bold text-rose-300 hover:text-rose-200"
                      >
                        Reject
                      </button>
                    )}
                  </>
                )}
                {status === "approved" && (
                  <button onClick={() => onAction("approve-withdrawal", withdrawal)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">Complete withdrawal</button>
                )}
                {canRetryCompletionEmail && (
                  <button
                    onClick={() => onAction("retry-withdrawal-email", withdrawal)}
                    className="text-xs font-bold text-amber-300 hover:text-amber-200"
                  >
                    Retry success email
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onAction("delete-withdrawal", withdrawal)} className="text-xs font-bold text-rose-300 hover:text-rose-200">Delete request</button>
                )}
              </div>
            </div>
            <dl className="divide-y divide-white/10">
              {detailEntries.map(([key, value]) => (
                <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(140px,0.35fr)_1fr]" key={key}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key}</dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
          </section>
          {completionEmail && (
            <section className={`rounded-lg border p-4 ${completionEmail.status === "failed" ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-[#0b1626]"}`}>
              <h2 className="text-sm font-bold text-slate-900">Success email: {completionEmail.status}</h2>
              <p className="mt-2 text-sm text-slate-300">Attempts: {Number(completionEmail.attemptCount) || 0}</p>
              {completionEmail.errorMessage && (
                <p className="mt-2 text-sm text-amber-100">{completionEmail.errorMessage} {completionEmail.errorCode ? `(${completionEmail.errorCode})` : ""}</p>
              )}
              {completionEmail.status === "failed" && (
                <p className="mt-2 text-xs text-amber-100/80">The withdrawal is already completed. Retrying this email will not send or repeat the payout.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function WithdrawalDecisionQueue({ onAction, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminPage("withdrawal-decisions")
      .then((page) => {
        if (!active) return;
        setRows(page.items);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError("");
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load pending withdrawals.")));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getAdminPage("withdrawal-decisions", nextCursor);
      setRows((current) => [...(current || []), ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "Unable to load more withdrawal requests."));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Withdrawal decisions</p>
        <h2 className="mt-2 text-lg font-bold text-slate-900">Requests awaiting a decision or completion</h2>
        <p className="mt-1 text-sm text-slate-400">Complete the payout through your offline process before approving. Approval then completes the request and sends the member an email.</p>
      </div>
      {error && !rows ? (
        <div className="p-5"><FeedbackMessage type="error">{error}</FeedbackMessage></div>
      ) : !rows ? (
        <div className="admin-resource-loading" role="status" aria-live="polite"><span className="admin-skeleton admin-skeleton-heading" /><span className="admin-skeleton admin-skeleton-line" /><span className="sr-only">Loading withdrawal requests</span></div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">There are no withdrawal requests awaiting approval or completion.</div>
      ) : (
        <div className="divide-y divide-white/10">
          {error && <div className="p-4"><FeedbackMessage type="error">{error} Previously loaded requests are still shown.</FeedbackMessage></div>}
          {rows.map((withdrawal) => (
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" key={`${withdrawal.userId}:${withdrawal.id}`}>
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-slate-900">{withdrawal.profileUsername || withdrawal.username || "Member"} · {withdrawal.profileEmail || withdrawal.email || "No email recorded"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Request {withdrawal.id} · {withdrawal.asset || withdrawal.method || "Payment method not recorded"} · {Number.isFinite(Number(withdrawal.amount)) ? formatMoney(withdrawal.amount) : "Amount not recorded"}
                </p>
                <div className="mt-2"><Status>{withdrawal.status || "Pending"}</Status></div>
              </div>
              <div className="admin-withdrawal-actions flex shrink-0 items-center gap-4">
                <button
                  onClick={() => onAction("approve-withdrawal", withdrawal)}
                  className="text-xs font-bold text-emerald-300 hover:text-emerald-200"
                >
                  {String(withdrawal.status || "pending").toLowerCase() === "approved" ? "Complete withdrawal" : "Approve and complete"}
                </button>
                <button
                  onClick={() => onAction("withdrawal-decision", { ...withdrawal, resource: "withdrawals", nextStatus: "rejected" })}
                  className="text-xs font-bold text-rose-300 hover:text-rose-200"
                >
                  Reject
                </button>
                <Link to={`/control-room/withdrawals/${encodeURIComponent(withdrawal.userId)}/${encodeURIComponent(withdrawal.id)}`} className="text-xs font-bold text-sky-300 hover:text-sky-200">
                  Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {hasMore && <div className="flex justify-center border-t border-white/10 p-4"><button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-60">{loadingMore ? "Loading…" : "Load more withdrawal requests"}</button></div>}
    </section>
  );
}

function Overview({ queueCounts, queueCountsLoading, queueCountsError, refreshKey }) {
  const [overview, setOverview] = useState(null);
  const [packages, setPackages] = useState(null);
  const [accrualStatus, setAccrualStatus] = useState(null);
  const [error, setError] = useState("");
  const [packagesError, setPackagesError] = useState("");
  const [accrualStatusError, setAccrualStatusError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminResource("admin-overview")
      .then((data) => active && setOverview(data[0] || null))
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load user activity.")));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    getAdminResource("packages")
      .then((items) => active && setPackages(items))
      .catch((reason) => active && setPackagesError(getSafeErrorMessage(reason, "Unable to load investment packages.")));
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    const loadAccrualStatus = () => getAdminResource("investment-accrual-status")
      .then((items) => {
        if (!active) return;
        setAccrualStatus(items[0] || null);
        setAccrualStatusError("");
      })
      .catch((reason) => active && setAccrualStatusError(getSafeErrorMessage(reason, "Unable to load investment accrual status.")));
    void loadAccrualStatus();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadAccrualStatus();
    }, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadAccrualStatus();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshKey]);

  const formatMetric = (value) => (value === undefined || value === null ? (error ? "Unavailable" : "Loading…") : Number(value).toLocaleString());

  const formatTimestamp = (value) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
  };
  const accrualStateLabel = accrualStatusError
    ? "Unavailable"
    : !accrualStatus
      ? "Loading status..."
      : accrualStatus.lastErrorAt
        ? "Last batch failed"
        : accrualStatus.openFailureCount > 0
          ? "Investment records need review"
        : accrualStatus.leaseActive
          ? "Batch running"
          : accrualStatus.resumable
            ? "More batches needed"
            : accrualStatus.hasRun
              ? "Backlog caught up"
              : "Waiting for first run";

  return (
    <div className="admin-overview space-y-4">
      {error && (
        <FeedbackMessage type="error">
          {error} Check that the admin data endpoint is available and your Firestore rules permit the intended admin access.
        </FeedbackMessage>
      )}
      {overview && !overview.accountStatusSyncComplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          Firebase account-status reconciliation has not completed yet. Disabled-account totals may be incomplete until its first scheduled run finishes.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total profiles" value={formatMetric(overview?.totalUsers)} detail="Member profiles in Firebase" icon={Users} />
        <Metric label="Other profiles" value={formatMetric(overview?.activeUsers)} detail="Profiles not flagged disabled or pending review" icon={Activity} />
        <Metric label="Needs review" value={formatMetric(overview?.pendingUsers)} detail="Pending or review status" icon={ClipboardList} />
        <Metric label="Disabled profiles" value={formatMetric(overview?.disabledUsers)} detail="Disabled or suspended" icon={CheckCircle2} />
      </div>
      <section className="rounded-xl border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.16)]" aria-labelledby="admin-review-queues-title">
        <div className="mb-4">
          <h2 id="admin-review-queues-title" className="font-semibold text-slate-900">Work queues</h2>
          <p className="mt-1 text-sm text-slate-400">Open items awaiting an admin review.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["/control-room/deposits", "Deposit requests", queueCounts?.deposits, ArrowDownToLine],
            ["/control-room/withdrawals", "Withdrawal requests", queueCounts?.withdrawals, ArrowUpRight],
            ["/control-room/support", "Support tickets", queueCounts?.support, CircleHelp],
            ["/control-room/referrals", "Referral rewards", queueCounts?.referrals, TrendingUp],
          ].map(([to, label, count, Icon]) => (
            <Link key={to} to={to} className="admin-overview-queue flex min-h-20 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-sky-300/30 hover:bg-sky-300/[0.06]">
              <span className="admin-overview-icon-tile grid h-9 w-9 shrink-0 place-items-center rounded-lg"><Icon size={17} /></span>
              <span className="admin-overview-queue-copy min-w-0"><span className="admin-overview-queue-label block text-sm font-semibold text-slate-100">{label}</span><span className="admin-overview-queue-count mt-1 block text-xs text-slate-400" aria-live="polite">{queueCountsLoading ? <><span className="admin-count-skeleton" aria-hidden="true" /><span className="sr-only">Loading {label.toLowerCase()} count</span></> : queueCountsError ? "Unavailable" : `${formatMetric(count)} open`}</span></span>
              <ChevronRight size={15} className="admin-overview-queue-chevron ml-auto shrink-0 text-slate-500" />
            </Link>
          ))}
        </div>
      </section>
      <section className="admin-accrual-status-card rounded-xl border border-blue-100 bg-white p-4 sm:p-5" aria-labelledby="admin-accrual-status-title" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="admin-accrual-status-title" className="font-semibold text-slate-900">Investment accrual</h2>
          <p className="mt-1 text-sm text-slate-600">Daily updates run in resumable batches. A malformed investment is recorded and skipped so it cannot block other accounts; failed records retry on later runs.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${accrualStatusError || accrualStatus?.lastErrorAt || accrualStatus?.openFailureCount > 0 ? "bg-rose-50 text-rose-800" : accrualStatus?.resumable ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{accrualStateLabel}</span>
        </div>
        {accrualStatusError ? <p className="mt-3 text-sm text-rose-700" role="alert">{accrualStatusError}</p> : (
          <>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <div><dt className="font-semibold text-slate-600">Last completed cycle</dt><dd className="mt-1 text-slate-900">{formatTimestamp(accrualStatus?.lastCompletedAt)}</dd></div>
              <div><dt className="font-semibold text-slate-600">Records handled in last invocation</dt><dd className="mt-1 text-slate-900">{accrualStatus?.resumable ? accrualStatus.lastPartialCount ?? "—" : accrualStatus?.hasRun ? accrualStatus.lastCompletedCount : "—"}</dd></div>
              <div><dt className="font-semibold text-slate-600">Last error recorded</dt><dd className="mt-1 text-slate-900">{formatTimestamp(accrualStatus?.lastErrorAt)}</dd></div>
              <div><dt className="font-semibold text-slate-600">Investment records needing review</dt><dd className="mt-1 text-slate-900">{Number(accrualStatus?.openFailureCount) || 0}</dd></div>
            </dl>
            {accrualStatus?.recentFailures?.length > 0 && <ul className="mt-4 space-y-2" aria-label="Recent investment accrual failures">{accrualStatus.recentFailures.map((failure) => <li key={failure.id} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-950"><p className="font-semibold">{failure.investmentPath || "Investment record"} · {failure.attempts || 1} attempts</p><p className="mt-1 break-words">{failure.error || "Accrual failed."}</p></li>)}</ul>}
          </>
        )}
      </section>
      <section aria-labelledby="admin-shortcuts-title" className="admin-overview-shortcuts rounded-xl border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.16)]">
        <div className="mb-4">
          <h2 id="admin-shortcuts-title" className="font-semibold text-slate-900">Quick access</h2>
          <p className="mt-1 text-sm text-slate-400">Go straight to a frequently used admin area.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["/control-room/withdrawals", "Review withdrawals", "Review or complete member withdrawal requests.", ArrowUpRight],
            ["/control-room/deposits", "Review deposits", "Check incoming payment requests.", ArrowDownToLine],
            ["/control-room/users", "Manage members", "Find member accounts and access controls.", Users],
            ["/control-room/support-chat", "Open support chat", "Reply to customer messages in real time.", MessageCircle],
          ].map(([to, label, description, Icon]) => (
            <Link
              key={to}
              to={to}
              className="admin-overview-shortcut group flex min-h-24 items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-sky-300/30 hover:bg-sky-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <span className="admin-overview-icon-tile grid h-9 w-9 shrink-0 place-items-center rounded-lg transition"><Icon size={17} /></span>
              <span className="min-w-0">
                <span className="admin-overview-shortcut-label block text-sm font-semibold text-slate-100 group-hover:text-slate-900">{label}</span>
                <span className="admin-overview-shortcut-detail mt-1 block text-xs leading-5 text-slate-400">{description}</span>
              </span>
              <ChevronRight size={15} className="admin-overview-shortcut-chevron ml-auto mt-1 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-sky-200" />
            </Link>
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]" aria-labelledby="admin-packages-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <h2 id="admin-packages-title" className="font-semibold text-slate-900">Investment packages</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">The same active Firebase catalog members see when they deposit. Daily plans use simple profit on the original principal, without compounding; profit unlocks at maturity. Promo plans use their fixed 24-hour terms.</p>
          </div>
          <Link to="/control-room/packages" className="text-xs font-bold text-sky-300">Manage packages</Link>
        </div>
        {packagesError ? <div className="p-4"><FeedbackMessage type="error">{packagesError}</FeedbackMessage></div> : packages === null ? <p className="p-4 text-sm text-slate-400">Loading investment packages…</p> : packages.length ? (
          <div className="overflow-x-auto">
            <table className="admin-data-table admin-data-table-packages">
              <thead><tr><th>Program</th><th>Minimum</th><th>Maximum</th><th>Daily rate</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>{packages.map((item) => <tr key={item.id}>
                <td>{item.name || item.title || item.id}</td>
                <td>{formatMoney(item.minimum)}</td>
                <td>{Number(item.maximum) > 0 ? formatMoney(item.maximum) : "No maximum"}</td>
                <td>{item.returnRate ?? item.rate ?? "—"}%</td>
                <td>{item.duration || "—"}</td>
                <td><Status>{item.status || (item.enabled === false ? "Disabled" : "Active")}</Status></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <p className="p-4 text-sm text-slate-400">No investment packages are configured yet. <Link to="/control-room/packages" className="font-semibold text-sky-300">Add a package</Link>.</p>}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Recent users</h2><p className="mt-1 text-sm text-slate-400">The latest profiles returned from Firebase.</p></div><Users size={19} className="text-slate-400" /></div><div className="mt-5 divide-y divide-white/10">{overview?.recentUsers?.map((user) => <div className="flex items-center justify-between gap-4 py-3" key={user.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{user.displayName || user.username || user.email || user.id}</p><p className="truncate text-xs text-slate-400">{user.email || "No email recorded"}</p></div><Status>{user.status || "Active"}</Status></div>) || <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">{error ? "User activity unavailable." : "Loading user activity…"}</div>}{overview?.recentUsers?.length === 0 && <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">No user profiles found.</div>}</div></section>
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Admin safeguards</h2><ShieldCheck size={19} className="text-emerald-300" /></div><div className="mt-4 space-y-2 text-sm text-slate-300"><p className="rounded-md bg-white/[0.04] p-3">Admin sign-in is separate from member authentication.</p><p className="rounded-md bg-white/[0.04] p-3">User data stays protected by Firestore rules.</p><p className="rounded-md bg-white/[0.04] p-3">Sensitive changes require confirmation and are recorded in the audit history.</p></div></section>
      </div>
    </div>
  );
}

function AdminSecurityPanel() {
  const [form, setForm] = useState({ current: "", next: "", confirmation: "" });
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setFeedback({ type: "", message: "" });
    if (form.next.length < 8) {
      setFeedback({ type: "error", message: "Your new password must be at least 8 characters." });
      return;
    }
    if (form.next !== form.confirmation) {
      setFeedback({ type: "error", message: "The new password and confirmation do not match." });
      return;
    }
    setSaving(true);
    try {
      await changeAdminPassword(form.current, form.next);
      setForm({ current: "", next: "", confirmation: "" });
      setFeedback({ type: "success", message: "Your administrator password was changed successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: getAuthErrorMessage(error, "Your password could not be changed.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-sky-300/20 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Your security</p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">Change administrator password</h2>
      <p className="mt-1 text-sm text-slate-400">Re-enter your current password to update the password for your signed-in Firebase account.</p>
      {feedback.message && <FeedbackMessage type={feedback.type} className="mt-5">{feedback.message}</FeedbackMessage>}
      <form onSubmit={submit} className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200 sm:col-span-2">Current password
          <input type="password" autoComplete="current-password" required value={form.current} onChange={(event) => setForm((current) => ({ ...current, current: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400" />
        </label>
        <label className="text-sm font-semibold text-slate-200">New password
          <input type="password" autoComplete="new-password" minLength={8} required value={form.next} onChange={(event) => setForm((current) => ({ ...current, next: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400" />
        </label>
        <label className="text-sm font-semibold text-slate-200">Confirm new password
          <input type="password" autoComplete="new-password" minLength={8} required value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400" />
        </label>
        <button type="submit" disabled={saving || !form.current || !form.next || !form.confirmation} className="rounded-md bg-sky-300 px-4 py-3 text-sm font-bold text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:w-fit">
          {saving ? "Updating password…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function recordDate(value) {
  if (!value) return "—";
  if (typeof value?.toDate === "function") value = value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function userAccountStatus(row) {
  if (row.authDisabled === true || row.disabled === true) return "Disabled";
  const profileStatus = String(row.status || "").trim();
  return profileStatus || (row.authAccount ? "Active" : "No auth account");
}

function userJoinedDate(row) {
  return recordDate(row.createdAt || row.creationTime);
}

function recordCell(row, field) {
  const value = field(row);
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function depositTerms(row) {
  const name = String(row.plan || row.packageName || "").trim();
  const normalizedName = name.toUpperCase();
  const savedTerms = row.packageTermsSnapshot;
  if (savedTerms?.version === 1) {
    if (Number(savedTerms.profitPercent) > 0) return `${savedTerms.profitPercent}% profit · ${savedTerms.duration || "24 hours"}`;
    if (Number(savedTerms.dailyRate) > 0) return `${savedTerms.dailyRate}% simple daily · ${savedTerms.duration || "package term"}`;
  }
  if (normalizedName === "PROMO MINI PLAN" || normalizedName === "PROMO MEGA PLAN") {
    return normalizedName === "PROMO MINI PLAN" ? "100% profit · 24 hours" : "500% profit · 24 hours";
  }
  const hours = Number(row.durationHours);
  if (Number.isFinite(hours) && hours > 0) {
    return hours % 24 === 0
      ? `${hours / 24} ${hours === 24 ? "day" : "days"}`
      : `${hours} hours`;
  }
  const namedDuration = name.match(/\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|days?|d|weeks?|w|months?|mos?)/i)?.[0];
  return namedDuration || row.duration || "Set in package settings";
}

const RECORD_COLUMNS = {
  users: [
    ["Member", (row) => row.fullName || row.displayName || row.username || row.email || row.id],
    ["Email", (row) => row.email],
    ["Joined", userJoinedDate],
    ["Email verified", (row) => row.emailVerified ? "Verified" : "Unverified"],
    ["Account status", userAccountStatus],
    ["Last sign in", (row) => recordDate(row.lastSignInTime)],
    ["Available balance", (row) => row.availableBalance],
    ["Withdrawable", (row) => row.withdrawableBalance],
    ["Promo credit", (row) => row.promotionalCredit],
    ["Pending withdrawal", (row) => row.pendingWithdrawalAmount],
    ["Active principal", (row) => row.activeInvestmentPrincipal],
    ["Funded", (row) => row.totalDeposit],
    ["Withdrawn", (row) => row.totalWithdrawal],
    ["Earnings", (row) => row.totalEarnings],
    ["Verified referrals", (row) => row.referralCount],
    ["Referral credit", (row) => formatMoney(row.referralCredit)],
  ],
  admins: [["Administrator", (row) => row.displayName || row.email || row.id], ["Email", (row) => row.email], ["Role", (row) => row.role], ["Last sign in", (row) => recordDate(row.lastSignInTime)]],
  packages: [["Investment program", (row) => row.name || row.title || row.id], ["Minimum", (row) => row.minimum], ["Maximum", (row) => Number(row.maximum) > 0 ? row.maximum : "No maximum"], ["Return", (row) => row.returnRate ?? row.rate], ["Duration", (row) => row.duration], ["Status", (row) => row.status || (row.enabled === false ? "Disabled" : "Active")]],
  deposits: [["Member", (row) => row.profileUsername || row.username || row.profileEmail || row.email || row.userId], ["Requested", (row) => recordDate(row.createdAt)], ["Program", (row) => row.plan || row.packageName], ["Terms", depositTerms], ["Amount", (row) => row.amount], ["Payment asset", (row) => row.method || row.asset], ["Status", (row) => row.status || "pending"]],
  withdrawals: [["Member", (row) => row.profileUsername || row.username || row.profileEmail || row.email || row.userId], ["Requested", (row) => recordDate(row.createdAt)], ["Amount", (row) => row.amount], ["Payout asset", (row) => row.method || row.asset], ["Destination wallet", (row) => row.wallet || "Offline processing"], ["Status", (row) => row.status || "pending"]],
  transactions: [["Member", (row) => row.profileUsername || row.username || row.profileEmail || row.userId], ["Activity", (row) => row.description || row.type || row.transactionType || row.collection], ["Record type", (row) => row.collection || row.category || row.kind], ["Amount", (row) => row.amount], ["Date", (row) => recordDate(row.createdAt || row.date)], ["Status", (row) => row.status || "completed"]],
  referrals: [["Referrer", (row) => row.profileUsername || row.profileEmail || row.referrerId || row.userId], ["Referred member", (row) => row.referredUsername || row.referredEmail || row.referredUserId], ["Email", (row) => row.referredEmail], ["Joined", (row) => recordDate(row.createdAt)], ["Credit amount", (row) => row.amount == null ? "—" : formatMoney(row.amount)], ["Reward status", (row) => referralRewardStatusLabel(row.rewardStatus)]],
  "top-referrals": [["Referrer", (row) => row.username || row.fullName || row.email || row.userId], ["Email", (row) => row.email], ["Verified referrals", (row) => row.referralCount], ["Referral credit", (row) => formatMoney(row.referralCredit)]],
  support: [["Member", (row) => row.profileUsername || row.username || row.profileEmail || row.userId], ["Subject", (row) => row.subject || row.message || row.id], ["Date", (row) => recordDate(row.updatedAt || row.createdAt)], ["Status", (row) => row.status || "open"]],
  audit: [["Action", (row) => row.action], ["Administrator", (row) => row.adminEmail || row.adminId], ["Details", (row) => row.details?.resource || row.details?.userId || row.details?.id], ["Date", (row) => recordDate(row.createdAt)]],
};

function ResourceActions({ resource, row, onAction }) {
  const isDisabled = row.disabled === true || row.authDisabled === true || ["Disabled", "Suspended", "blocked"].includes(row.status);
  const canManageAuth = resource !== "users" || row.authAccount === true;
  const actionPayload = { ...row, userId: resource === "users" ? (row.authUid || row.id) : row.userId, profileId: resource === "users" ? row.id : row.userId };
  const status = String(row.status || "pending").toLowerCase();
  const canDeleteDeposit = resource === "deposits" && !["approved", "completed", "settled", "credited"].includes(status) && !row.settlementId;
  const canDeleteWithdrawal = resource === "withdrawals" && !row.settlementId && !row.settledAt && !row.completedAt && !row.paidAt && !["complete", "completed", "settled", "paid", "success"].includes(status);
  const canRetryWithdrawalEmail = resource === "withdrawals" && status === "completed" && row.emailNotifications?.completed?.status === "failed";
  if (["admins", "audit", "top-referrals"].includes(resource)) return null;
  if (resource === "users") return <div className="admin-row-actions"><button disabled={!canManageAuth} onClick={() => onAction("disable-user", { ...actionPayload, disabled: !isDisabled })}>{isDisabled ? "Enable" : "Disable"}</button><button disabled={!canManageAuth} className="is-danger" onClick={() => onAction("delete-user", actionPayload)}>Delete</button></div>;
  if (resource === "deposits") return <div className="admin-row-actions">{["pending", "approved"].includes(status) && <button onClick={() => onAction("settle-deposit", actionPayload)}>Credit</button>}{["pending", "rejected", "cancelled"].includes(status) && <button onClick={() => onAction("review", row)}>Review</button>}{canDeleteDeposit && <button className="is-danger" onClick={() => onAction("delete-deposit", actionPayload)}>Delete</button>}{status === "completed" && row.emailNotifications?.successful?.status === "failed" && <button onClick={() => onAction("retry-deposit-email", actionPayload)}>Retry email</button>}</div>;
  if (resource === "withdrawals") return <div className="admin-row-actions"><Link to={`/control-room/withdrawals/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}`}>Details</Link>{canRetryWithdrawalEmail && <button onClick={() => onAction("retry-withdrawal-email", actionPayload)}>Retry email</button>}{canDeleteWithdrawal && <button className="is-danger" onClick={() => onAction("delete-withdrawal", actionPayload)}>Delete</button>}</div>;
  if (resource === "transactions") return <Link className="admin-row-link" to={`/control-room/transactions/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}?collection=${encodeURIComponent(row.collection || "transactions")}`}>View details</Link>;
  if (resource === "referrals") {
    const collection = row.collection === "referralRewards" ? "referralRewards" : "referralAttributions";
    const recordId = row.referredUserId || row.id;
    return <Link className="admin-row-link" to={`/control-room/referrals/${encodeURIComponent(row.userId)}/${encodeURIComponent(recordId)}?collection=${collection}`}>View details</Link>;
  }
  if (resource === "support") return <Link className="admin-row-link" to={`/control-room/support/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}`}>View details</Link>;
  if (resource === "packages") return <button className="admin-row-link" onClick={() => onAction("update-package", row)}>Edit program</button>;
  return <button className="admin-row-link" onClick={() => onAction("review", row)}>Review details</button>;
}

const MONEY_COLUMNS = new Set(["Available balance", "Withdrawable", "Promo credit", "Pending withdrawal", "Active principal", "Funded", "Withdrawn", "Earnings", "Minimum", "Maximum", "Amount", "Reward"]);
const DATE_COLUMNS = new Set(["Joined", "Last sign in", "Requested", "Date", "Expires"]);
const STATUS_COLUMNS = new Set(["Status", "Account status", "Email verified", "Reward status"]);
const MOBILE_PREVIEW_COLUMNS = {
  users: ["Email", "Account status", "Available balance", "Joined"],
  admins: ["Email", "Role", "Last sign in"],
  packages: ["Minimum", "Maximum", "Return", "Duration", "Status"],
  deposits: ["Amount", "Status", "Requested", "Program", "Payment asset"],
  withdrawals: ["Amount", "Status", "Requested", "Payout asset", "Destination wallet"],
  transactions: ["Activity", "Amount", "Date", "Status", "Record type"],
  referrals: ["Referred member", "Reward status", "Reward", "Joined"],
  "top-referrals": ["Verified referrals", "Email"],
  support: ["Subject", "Status", "Date"],
  audit: ["Administrator", "Details", "Date"],
};

function ResourceValue({ row, label, getter }) {
  const value = getter(row);
  const text = recordCell(row, getter);
  if (STATUS_COLUMNS.has(label)) return <Status>{text}</Status>;
  if (DATE_COLUMNS.has(label)) return text;
  if (label === "Return" && value !== undefined && value !== null) return `${text}%`;
  if (MONEY_COLUMNS.has(label) && value !== "" && Number.isFinite(Number(value))) return formatMoney(value);
  return text;
}

function ResourceMobileCard({ resource, row, columns, onAction, expiring = false }) {
  const showActions = resource !== "top-referrals";
  const primary = columns[0];
  const secondary = columns.slice(1);
  const previewOrder = expiring ? ["Member", "Amount", "Expires", "Status"] : (MOBILE_PREVIEW_COLUMNS[resource] || []);
  const preview = previewOrder
    .map((label) => secondary.find(([columnLabel]) => columnLabel === label))
    .filter(Boolean)
    .slice(0, 4);
  const previewLabels = new Set(preview.map(([label]) => label));
  const more = secondary.filter(([label]) => !previewLabels.has(label));

  return (
    <article className="admin-mobile-record" key={row.id}>
      <div className="admin-mobile-record-title">
        <span className="admin-mobile-field-label">{primary[0]}</span>
        <strong><ResourceValue row={row} label={primary[0]} getter={primary[1]} /></strong>
      </div>
      {preview.length > 0 && (
        <dl className="admin-mobile-fields">
          {preview.map(([label, getter]) => (
            <div className="admin-mobile-field" key={label}>
              <dt>{label}</dt>
              <dd><ResourceValue row={row} label={label} getter={getter} /></dd>
            </div>
          ))}
        </dl>
      )}
      {more.length > 0 && (
        <details className="admin-mobile-more">
          <summary>Open full record details ({more.length} additional {more.length === 1 ? "field" : "fields"})</summary>
          <dl className="admin-mobile-fields">
            {more.map(([label, getter]) => (
              <div className="admin-mobile-field" key={label}>
                <dt>{label}</dt>
                <dd><ResourceValue row={row} label={label} getter={getter} /></dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {showActions && <div className="admin-mobile-actions"><ResourceActions resource={resource} row={row} onAction={onAction} /></div>}
    </article>
  );
}

function ResourceTable({ resource, rows, onAction, expiring = false }) {
  const columns = expiring
    ? [["Investment plan", (row) => row.plan || row.packageName || row.description || row.name], ["Member", (row) => row.profileUsername || row.username || row.profileEmail || row.userId], ["Amount", (row) => row.amount], ["Expires", (row) => recordDate(row.expiresAt || row.expiryDate || row.expirationDate || row.expireAt || row.expiresOn || row.endAt || row.endDate || row.maturityDate || row.maturesAt)], ["Status", (row) => row.status || "Active"]]
    : RECORD_COLUMNS[resource] || [["Record", (row) => row.id], ["Details", (row) => row.description || row.type], ["Status", (row) => row.status]];
  const showActions = resource !== "top-referrals";
  return (
    <>
      <div className="admin-desktop-table overflow-x-auto">
        <table className={`admin-data-table admin-data-table-${resource}`}>
          <thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}{showActions && <th>Actions</th>}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id}>
              {columns.map(([label, getter]) => <td key={label}><ResourceValue row={row} label={label} getter={getter} /></td>)}
              {showActions && <td><ResourceActions resource={resource} row={row} onAction={onAction} /></td>}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="admin-mobile-records">
        {rows.map((row) => <ResourceMobileCard key={row.id} resource={resource} row={row} columns={columns} onAction={onAction} expiring={expiring} />)}
      </div>
    </>
  );
}

function ResourceLoadingState({ title }) {
  return (
    <div className="admin-resource-loading" role="status" aria-live="polite" aria-label={`Loading ${title}`}>
      <span className="admin-skeleton admin-skeleton-heading" />
      <span className="admin-skeleton admin-skeleton-line" />
      <span className="admin-skeleton admin-skeleton-line admin-skeleton-line-short" />
      <span className="sr-only">Loading {title}…</span>
    </div>
  );
}

function ResourcePage({ resource, onAction, refreshKey, onRefresh }) {
  const location = useLocation();
  const [rows, setRows] = useState(null);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const viewParams = new URLSearchParams(location.search);
  const statusView = viewParams.get("status") || "";
  const typeView = viewParams.get("type") || "";
  const blacklistView = viewParams.get("view") === "blacklist";
  const topReferralView = viewParams.get("view") === "top";
  const dataResource = resource === "referrals" && topReferralView ? "top-referrals" : resource;
  const expiringView = viewParams.get("view") === "expiring";
  useEffect(() => {
    let active = true;
    setRows(null);
    setNextCursor("");
    setHasMore(false);
    setError("");
    getAdminPage(dataResource).then((page) => {
      if (!active) return;
      setRows(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    }).catch((reason) => active && setError(getSafeErrorMessage(reason, "The admin data service is unavailable.")));
    return () => { active = false; };
  }, [dataResource, refreshKey]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await getAdminPage(dataResource, nextCursor);
      setRows((current) => [...(current || []), ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "The next page could not be loaded."));
    } finally {
      setLoadingMore(false);
    }
  }
  const searchableRows = useMemo(
    () =>
      (rows || []).map((row) => ({
        ...row,
        __searchText: Object.entries(row)
          .filter(([key]) => key !== "emailNotifications")
          .map(([, value]) => value)
          .join(" ")
          .toLowerCase(),
      })),
    [rows],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const visible = searchableRows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      const blacklisted = row.disabled === true || row.authDisabled === true || ["blocked", "suspended", "disabled", "blacklisted"].includes(status);
      const typeText = [row.type, row.transactionType, row.category, row.kind, row.description].filter(Boolean).join(" ").toLowerCase();
      const matchesStatus = !statusView || status === statusView;
      const matchesBlacklist = !blacklistView || blacklisted;
      const matchesType = !typeView || (typeView === "earnings"
        ? /earn|profit|income/.test(typeText)
        : typeView === "referral"
          ? /referr|commission/.test(typeText)
          : typeView === "deposit"
            ? /deposit|fund/.test(typeText)
            : typeView === "withdrawal"
              ? /withdraw|payout/.test(typeText)
            : typeText.includes(typeView));
      const expiryValue = row.expiresAt || row.expiryDate || row.expirationDate || row.expireAt || row.expiresOn || row.endAt || row.endDate || row.maturityDate || row.maturesAt;
      const expiryTime = expiryValue ? new Date(expiryValue).getTime() : NaN;
      const matchesExpiring = !expiringView || (Number.isFinite(expiryTime) && expiryTime >= Date.now() && expiryTime <= Date.now() + 30 * 24 * 60 * 60 * 1000);
      return matchesStatus && matchesBlacklist && matchesType && matchesExpiring && (!normalizedQuery || row.__searchText.includes(normalizedQuery));
    });
    return visible;
  }, [blacklistView, expiringView, normalizedQuery, searchableRows, statusView, typeView]);
  useEffect(() => setCurrentPage(1), [location.search, normalizedQuery]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const [title] = resources[dataResource] || resources[resource];
  const hasActiveViewFilter = Boolean(normalizedQuery || statusView || typeView || blacklistView || expiringView);
  return (
    <div className="admin-resource-page space-y-3" aria-busy={rows === null}>
      <section className="admin-resource-panel overflow-hidden rounded-lg border border-white/10 bg-[#0b1626] shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
        <div className="admin-resource-toolbar flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search size={16} className="absolute left-3 top-3 text-slate-500" />
              <input type="search" id={`admin-search-${dataResource}`} name={`admin-search-${dataResource}`} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label={`Search ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title}`} className="w-full rounded-md border border-white/10 bg-[#081321] py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-sky-400/60" />
            </div>
            <div className="admin-resource-count" role="status" aria-live="polite">
              {!rows ? (error ? "Unavailable" : `Loading ${title.toLowerCase()}…`) : `${filtered.length.toLocaleString()} matching · ${rows.length.toLocaleString()} loaded`}
              {hasMore && rows && <span className="admin-search-scope">Search includes loaded records. Load more to include older records.</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><RefreshCw size={15} />Refresh</button>
            {resource === "packages" && <button type="button" onClick={() => onAction("create", {})} className="rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-[#081321] hover:bg-sky-200">Add new investment package</button>}
          </div>
        </div>
        {error && !rows ? (
          <div className="p-6">
            <FeedbackMessage type="error">{error}</FeedbackMessage>
          </div>
        ) : !rows ? (
          <ResourceLoadingState title={title.toLowerCase()} />
        ) : filtered.length ? (
          <>
            {error && <div className="p-4"><FeedbackMessage type="error">{error} Previously loaded records are still shown.</FeedbackMessage></div>}
            <ResourceTable resource={dataResource} rows={pageRows} onAction={onAction} expiring={expiringView} />
          </>
        ) : (
          <div className="admin-empty-state admin-empty-state-with-action" role="status">
            {error && <FeedbackMessage type="error">{error} Previously loaded records are still shown.</FeedbackMessage>}
            <FileText size={18} />
            <span>{rows.length === 0 && !hasActiveViewFilter ? `No ${title.toLowerCase()} have been recorded yet.` : normalizedQuery ? `No records match “${query.trim()}” in the loaded results.` : "No records match the selected filters in the loaded results."}</span>
            {normalizedQuery && <button type="button" onClick={() => setQuery("")}>Clear search</button>}
            {hasMore && <span>Load more records to check older entries.</span>}
          </div>
        )}
      </section>
      {hasMore && <div className="flex justify-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60">{loadingMore ? <><RefreshCw size={14} className="animate-spin" />Loading…</> : "Load more records"}</button></div>}
      {rows && filtered.length > 0 && <div className="admin-pagination"><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>‹ Prev</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => page + 1)}>Next ›</button></div>}
      {resource === "admins" && <AdminSecurityPanel />}
    </div>
  );
}

function BlacklistPage({ onAction, refreshKey }) {
  const [users, setUsers] = useState(null);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setUsers(null);
    setNextCursor("");
    setHasMore(false);
    setError("");
    getAdminPage("users").then((page) => {
      if (!active) return;
      setUsers(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load member accounts.")));
    return () => { active = false; };
  }, [refreshKey]);
  async function loadMoreUsers() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await getAdminPage("users", nextCursor);
      setUsers((current) => [...(current || []), ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "More member accounts could not be loaded."));
    } finally {
      setLoadingMore(false);
    }
  }
  const blacklisted = (users || []).filter((user) => user.disabled === true || user.authDisabled === true || ["blocked", "suspended", "disabled", "blacklisted"].includes(String(user.status || "").toLowerCase()));
  const normalized = query.trim().toLowerCase();
  const filtered = blacklisted.filter((user) => [user.username, user.displayName, user.email, user.id].some((value) => String(value || "").toLowerCase().includes(normalized)));
  const eligible = (users || []).filter((user) => user.authAccount && !user.authDisabled);
  return <section className="admin-resource-panel admin-blacklist-panel">
    <div className="admin-page-subtitle">Accounts Blacklist</div>
    {users && <div className="admin-empty-state"><span>Search covers {users.length} loaded member accounts.</span>{hasMore && <button type="button" onClick={loadMoreUsers} disabled={loadingMore} className="admin-row-link">{loadingMore ? "Loading more members" : "Load more member accounts"}</button>}</div>}
    <form className="admin-blacklist-add" onSubmit={(event) => { event.preventDefault(); const user = eligible.find((item) => (item.authUid || item.id) === selected); if (user) onAction("disable-user", { ...user, userId: user.authUid || user.id, profileId: user.id, disabled: true }); }}>
      <strong>Add account:</strong><select aria-label="Select account to blacklist" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select a member</option>{eligible.map((user) => <option key={user.authUid || user.id} value={user.authUid || user.id}>{user.username || user.displayName || user.email || user.id} — {user.email || user.id}</option>)}</select><button type="submit" disabled={!selected}>Add account</button>
    </form>
    <div className="admin-blacklist-search"><label htmlFor="blacklist-search">Search account:</label><input id="blacklist-search" name="admin-blacklist-search" type="search" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username, email, or account ID" /><span>{filtered.length} accounts</span></div>
    {error ? <div className="p-3"><FeedbackMessage type="error">{error}</FeedbackMessage></div> : !users ? <div className="admin-empty-state">Loading member accounts…</div> : <div className="overflow-x-auto"><table className="admin-data-table"><thead><tr><th>Account</th><th>Email</th><th>Access status</th><th>Action</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id}><td>{user.username || user.displayName || user.id}</td><td>{user.email || "—"}</td><td><Status>{user.authDisabled || user.disabled ? "Suspended" : user.status || "Blocked"}</Status></td><td><button className="admin-row-link" onClick={() => onAction("disable-user", { ...user, userId: user.authUid || user.id, profileId: user.id, disabled: false })}>Remove from blacklist</button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="admin-empty-state">No blacklisted accounts match this search.</div>}</div>}
  </section>;
}

function AdminLedgerEntry() {
  const [users, setUsers] = useState(null);
  const [usersCursor, setUsersCursor] = useState("");
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const idempotencyAttempt = useRef(null);
  const [form, setForm] = useState({ userId: "", amount: "", password: "" });

  useEffect(() => {
    let active = true;
    getAdminPage("users")
      .then((page) => {
        if (!active) return;
        const eligible = page.items.filter((record) => record.authAccount && !record.authDisabled);
        setUsers(eligible);
        setUsersCursor(page.nextCursor);
        setHasMoreUsers(page.hasMore);
        setForm((current) => ({ ...current, userId: current.userId || eligible[0]?.authUid || eligible[0]?.id || "" }));
      })
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load member accounts.")))
      .finally(() => active && setLoadingUsers(false));
    return () => { active = false; };
  }, []);

  async function loadMoreMembers() {
    if (!hasMoreUsers || !usersCursor || loadingMoreUsers) return;
    setLoadingMoreUsers(true);
    setError("");
    try {
      const page = await getAdminPage("users", usersCursor);
      const eligible = page.items.filter((record) => record.authAccount && !record.authDisabled);
      setUsers((current) => [...(current || []), ...eligible]);
      setUsersCursor(page.nextCursor);
      setHasMoreUsers(page.hasMore);
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "More member accounts could not be loaded."));
    } finally {
      setLoadingMoreUsers(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSavedId("");
    if (!form.userId || !(Number(form.amount) > 0) || !form.password) {
      setError("Select a member, enter an amount, and provide your administrator password.");
      return;
    }
    setSaving(true);
    try {
      await reauthenticateAdmin(form.password);
      const amount = Math.round((Number(form.amount) + Number.EPSILON) * 100) / 100;
      const category = "admin-adjustment";
      const signature = `${form.userId}:credit:${amount}:${category}`;
      if (idempotencyAttempt.current?.signature !== signature) {
        idempotencyAttempt.current = {
          signature,
          key: globalThis.crypto?.randomUUID?.() || `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      }
      const idempotencyKey = idempotencyAttempt.current.key;
      const result = await requestAdminAction("ledger", {
        userId: form.userId,
        kind: "credit",
        amount,
        currency: "USD",
        category,
        idempotencyKey,
      });
      setSavedId(result.entry?.id || idempotencyKey);
      idempotencyAttempt.current = null;
      setForm((current) => ({ ...current, amount: "", password: "" }));
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "The transaction could not be recorded."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-ledger-entry">
      <div className="admin-ledger-caption"><strong>Add funds</strong><span>Credit withdrawable funds to the member account.</span></div>
      {error && <div className="p-3"><FeedbackMessage type="error">{error}</FeedbackMessage></div>}
      {savedId && <div className="admin-ledger-success" role="status">Funds credited. Ledger entry {savedId}. <Link to="/control-room/audit">Open audit history</Link></div>}
      <form onSubmit={submit} className="admin-ledger-form">
        {hasMoreUsers && <div className="flex items-center gap-3 text-sm"><span>Member picker is paged.</span><button type="button" className="admin-row-link" onClick={loadMoreMembers} disabled={loadingMoreUsers}>{loadingMoreUsers ? "Loading more members…" : "Load more members"}</button></div>}
        <label><span>Send to</span><div><select value={form.userId} onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))} disabled={loadingUsers || !users?.length}><option value="">{loadingUsers ? "Loading member accounts…" : "Select a member"}</option>{users?.map((member) => <option key={member.authUid || member.id} value={member.authUid || member.id}>{member.username || member.displayName || member.email || member.id}{member.email ? ` — ${member.email}` : ""}</option>)}</select><small>Only active Firebase member accounts are available.</small></div></label>
        <label><span>Currency</span><div><input value="USD" readOnly /></div></label>
        <label><span>Amount</span><div><input type="number" min="0.01" max="100000000" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div></label>
        <label><span>Admin alternative password</span><div><input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></div></label>
        <div className="admin-ledger-actions"><button type="submit" disabled={saving || loadingUsers || !users?.length}>{saving ? "Recording…" : "Send transaction"}</button><Link to="/control-room/transactions">Cancel</Link></div>
      </form>
      <p className="admin-ledger-note">This credit is recorded in the ledger and included in the member’s withdrawable balance. No email is sent.</p>
    </section>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [refreshKey, setRefreshKey] = useState(0);
  const [queueCounts, setQueueCounts] = useState(null);
  const [queueCountsLoading, setQueueCountsLoading] = useState(true);
  const [supportConversations, setSupportConversations] = useState(null);
  const [supportConversationPage, setSupportConversationPage] = useState(null);
  const [supportConversationCounts, setSupportConversationCounts] = useState(null);
  const supportConversationsRef = useRef(null);
  const [queueSummaryError, setQueueSummaryError] = useState("");
  const [supportQueueError, setSupportQueueError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const actionSubmittingRef = useRef(false);
  actionSubmittingRef.current = actionSubmitting;
  const mobileMenuRef = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const confirmDialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [actionForm, setActionForm] = useState({
    status: "approved",
    name: "",
    description: "",
    minimum: "",
    maximum: "",
    returnRate: "",
    duration: "",
    password: "",
    confirmation: "",
  });
  const pathParts = location.pathname.split("/").filter(Boolean);
  const resource = pathParts[1] || "overview";
  const transactionTypeView = new URLSearchParams(location.search).get("type") || "";
  const accountBlacklistView = resource === "users" && new URLSearchParams(location.search).get("view") === "blacklist";
  const supportChatArchive = resource === "support-chat" && pathParts[2] === "archive";
  const withdrawalView = resource === "withdrawals"
    ? new URLSearchParams(location.search).get("view") || "queue"
    : "";
  const transactionDetails = resource === "transactions" && pathParts.length >= 4;
  const transactionCreate = resource === "transactions" && pathParts[2] === "new";
  const bonusCreate = transactionCreate && new URLSearchParams(location.search).get("entry") === "bonus";
  const invalidTransactionCreate = transactionCreate && !bonusCreate;
  const removedExchangeView = resource === "transactions" && transactionTypeView === "exchange";
  const transactionUserId = transactionDetails ? decodePathPart(pathParts[2]) : "";
  const transactionId = transactionDetails ? decodePathPart(pathParts[3]) : "";
  const transactionCollection = new URLSearchParams(location.search).get("collection") || "";
  const depositDetails = resource === "deposits" && pathParts.length >= 4;
  const depositUserId = depositDetails ? decodePathPart(pathParts[2]) : "";
  const depositId = depositDetails ? decodePathPart(pathParts[3]) : "";
  const supportDetails = resource === "support" && pathParts.length >= 4;
  const supportUserId = supportDetails ? decodePathPart(pathParts[2]) : "";
  const supportTicketId = supportDetails ? decodePathPart(pathParts[3]) : "";
  const withdrawalDetails = resource === "withdrawals" && pathParts.length >= 4;
  const withdrawalUserId = withdrawalDetails ? decodePathPart(pathParts[2]) : "";
  const withdrawalId = withdrawalDetails ? decodePathPart(pathParts[3]) : "";
  const referralDetails = resource === "referrals" && pathParts.length >= 4;
  const referralUserId = referralDetails ? decodePathPart(pathParts[2]) : "";
  const referralRewardId = referralDetails ? decodePathPart(pathParts[3]) : "";
  const invalidTransactionDetails =
    transactionDetails && (!transactionUserId || !transactionId);
  const invalidDepositDetails =
    depositDetails && (!depositUserId || !depositId);
  const invalidSupportDetails =
    supportDetails && (!supportUserId || !supportTicketId);
  const invalidWithdrawalDetails =
    withdrawalDetails && (!withdrawalUserId || !withdrawalId);
  const invalidReferralDetails =
    referralDetails && (!referralUserId || !referralRewardId);
  const unknownResource =
    resource !== "overview" && !Object.prototype.hasOwnProperty.call(resources, resource);
  const activeNavigationItem = navGroups
    .flatMap((group) => group.items)
    .find(([target]) => {
      const [path, query] = target.split("?");
      const matchesPath = path === "/control-room"
        ? location.pathname === path
        : location.pathname === path || location.pathname.startsWith(`${path}/`);
      return matchesPath && query && location.search === `?${query}`;
    }) || navGroups
      .flatMap((group) => group.items)
      .find(([target]) => {
        const path = target.split("?")[0];
        return (path === "/control-room"
          ? location.pathname === path
          : location.pathname === path || location.pathname.startsWith(`${path}/`));
      });
  const currentPageTitle = transactionCreate
    ? "Add bonus"
    : transactionDetails
    ? "Transaction details"
    : depositDetails
      ? "Deposit review"
    : supportDetails
      ? "Support ticket details"
      : withdrawalDetails
        ? "Withdrawal review"
        : referralDetails
          ? "Referral details"
          : supportChatArchive
            ? "Archived support chats"
      : activeNavigationItem?.[1] || "Admin";

  const refreshSupportCounts = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const records = await getAdminResource("admin-support-chat-counts");
      setSupportConversationCounts(records[0] || null);
    } catch (error) {
      console.error("Support chat totals could not be refreshed.", error);
      setSupportConversationCounts(null);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    let active = true;
    async function refreshQueueRows() {
      try {
        const counts = await getAdminResource("admin-queue-counts");
        if (!active) return;
        setQueueCounts(counts);
        setQueueCountsLoading(false);
        setQueueSummaryError("");
      } catch (error) {
        if (!active) return;
        console.error("Admin queue counts could not be refreshed.", error);
        setQueueCountsLoading(false);
        setQueueSummaryError(getSafeErrorMessage(error, "Pending-operation counts could not be refreshed."));
      }
    }

    void refreshQueueRows();
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshQueueRows();
    }
    const intervalId = window.setInterval(() => {
      refreshWhenVisible();
    }, 120_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshKey, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    if (!firestoreDb) {
      setSupportConversations([]);
      setSupportQueueError("Support chat activity is unavailable because Firebase is not configured.");
      return undefined;
    }
    return subscribeToAdminConversations(
      (conversations, page) => {
        const previous = supportConversationsRef.current;
        const previousIds = new Set((previous || []).map((item) => item.id));
        const nextIds = new Set(conversations.map((item) => item.id));
        const queueStateChanged = !previous
          || previousIds.size !== nextIds.size
          || [...previousIds].some((id) => !nextIds.has(id))
          || conversations.some((item) => {
            const prior = previous.find((entry) => entry.id === item.id);
            const isActive = (value) => value.archived !== true
              && !["resolved", "closed"].includes(String(value.status || "open").toLowerCase());
            return !prior
              || isActive(prior) !== isActive(item)
              || Boolean(prior.archived) !== Boolean(item.archived)
              || Number(prior.unreadForAgent || 0) !== Number(item.unreadForAgent || 0);
          });
        supportConversationsRef.current = conversations;
        setSupportConversations(conversations);
        setSupportConversationPage(page);
        setSupportQueueError("");
        if (queueStateChanged) void refreshSupportCounts();
      },
      (error) => {
        console.error("Support chat badge count could not be refreshed.", error);
        setSupportConversationPage(null);
        setSupportQueueError("Support chat activity could not be refreshed.");
      },
    );
  }, [refreshSupportCounts, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    void refreshSupportCounts();
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshSupportCounts();
    }
    const intervalId = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshKey, refreshSupportCounts, user?.uid]);

  const queueBadgeCounts = useMemo(() => {
    return { ...queueCounts, "support-chat": supportConversationCounts?.activeCount ?? 0 };
  }, [queueCounts, supportConversationCounts]);

  function clearNoticeTimeout() {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }

  function showNotice(type, message) {
    clearNoticeTimeout();
    setNoticeType(type);
    setNotice(message);

    if (type === "success") {
      noticeTimeoutRef.current = window.setTimeout(() => {
        setNotice("");
        noticeTimeoutRef.current = null;
      }, 3000);
    }
  }

  useEffect(() => () => clearNoticeTimeout(), []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenuRef.current?.querySelector("a")?.focus();

    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    function closeOnDesktopResize() {
      if (window.matchMedia("(min-width: 1024px)").matches) setMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktopResize);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktopResize);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirm) {
      if (previousFocusRef.current) {
        if (previousFocusRef.current.isConnected) previousFocusRef.current.focus();
        else document.getElementById("admin-main")?.focus();
      }
      previousFocusRef.current = null;
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const autofocusTarget = confirmDialogRef.current?.querySelector("[data-dialog-autofocus]");
    (autofocusTarget || confirmDialogRef.current)?.focus();

    function closeOnEscape(event) {
      if (event.key === "Escape" && !actionSubmittingRef.current) setConfirm(null);
      if (event.key !== "Tab") return;

      const focusable = [...(confirmDialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        confirmDialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      const dialogHasFocus = document.activeElement === confirmDialogRef.current;
      if (event.shiftKey && (document.activeElement === first || dialogHasFocus || !confirmDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || dialogHasFocus || !confirmDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [confirm]);

  async function confirmAction() {
    if (actionSubmitting) return;
    const payload =
      confirm.action === "approve-withdrawal"
        ? {
            profileId: confirm.payload.profileId || confirm.payload.userId,
            withdrawalId: confirm.payload.id,
            payoutSent: actionForm.payoutConfirmed,
          }
        : confirm.action === "withdrawal-decision"
        ? {
            ...confirm.payload,
            resource: "withdrawals",
            nextStatus: confirm.payload.nextStatus,
          }
        : confirm.action === "review"
        ? { ...confirm.payload, nextStatus: actionForm.status }
        : confirm.action === "settle-deposit"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              amount: Number(actionForm.amount),
              currency: actionForm.currency,
            }
        : confirm.action === "retry-deposit-email"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
            }
        : confirm.action === "retry-withdrawal-email"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              withdrawalId: confirm.payload.id,
            }
        : confirm.action === "delete-deposit"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              profileEmail: confirm.payload.profileEmail,
              profileUsername: confirm.payload.profileUsername,
              confirmation: actionForm.confirmation,
            }
        : confirm.action === "delete-withdrawal"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              withdrawalId: confirm.payload.id,
              confirmation: actionForm.confirmation,
            }
        : confirm.action === "disable-user"
          ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, disabled: confirm.payload.disabled === true }
          : confirm.action === "delete-user"
              ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, confirmation: actionForm.confirmation }
        : {
            id: confirm.payload.id,
            name: actionForm.name.trim(),
            description: actionForm.description.trim(),
            minimum: Number(actionForm.minimum),
            maximum: Number(actionForm.maximum),
            returnRate: Number(actionForm.returnRate),
            duration: actionForm.duration.trim(),
          };
    let completed = false;
    try {
      setActionSubmitting(true);
      await reauthenticateAdmin(actionForm.password);
      const result = await requestAdminAction(confirm.action === "withdrawal-decision" ? "review" : confirm.action, payload);
      setRefreshKey((current) => current + 1);
      const promoDeposit = confirm.action === "settle-deposit"
        && ["PROMO MINI PLAN", "PROMO MEGA PLAN"].includes(String(confirm.payload.plan || confirm.payload.packageName || "").trim().toUpperCase());
      const depositEmailFailed = ["settle-deposit", "retry-deposit-email"].includes(confirm.action)
        && result.email?.status === "failed";
      const withdrawalEmailRetryFailed = confirm.action === "retry-withdrawal-email"
        && result.email?.status === "failed";
      showNotice(
        (confirm.action === "approve-withdrawal" && result.email?.status === "failed") || depositEmailFailed || withdrawalEmailRetryFailed ? "error" : "success",
        depositEmailFailed
          ? promoDeposit ? "Promo deposit credited and its 24-hour investment started, but the member email failed. The credit remains recorded." : "Deposit was credited, but the member confirmation email failed. The deposit remains recorded."
          : confirm.action === "retry-deposit-email"
          ? result.email?.status === "sent"
            ? "Deposit confirmation email sent to the member."
            : result.email?.status === "sending"
              ? "A deposit confirmation email is already being sent."
              : "The deposit confirmation email could not be sent."
          : confirm.action === "retry-withdrawal-email"
          ? result.email?.status === "sent"
            ? "Withdrawal success email sent. The completed payout was not changed."
            : result.email?.status === "sending"
              ? "The withdrawal success email is already being sent. The completed payout was not changed."
              : `Withdrawal email retry failed${result.email?.code ? ` (${result.email.code})` : ""}. The payout remains completed; do not send it again.`
          : confirm.action === "approve-withdrawal" && result.email?.status === "failed"
          ? `Withdrawal completed, but the success email failed${result.email?.code ? ` (${result.email.code})` : ""}. Retry the email from withdrawal details; do not send the payout again.`
          : confirm.action === "approve-withdrawal"
          ? result.alreadyCompleted
            ? result.email?.status === "sent"
              ? "This withdrawal was already completed and the success email is confirmed as sent."
              : "This withdrawal was already completed."
            : result.email?.status === "sent"
              ? "Withdrawal approved and completed. The member has been notified."
              : "Withdrawal approved and completed. Email delivery is being processed."
          : confirm.action === "delete-withdrawal"
          ? "Withdrawal request deleted."
          : confirm.action === "delete-user"
            ? result.complete
              ? "The member account and its profile records have been deleted."
              : "Account access is disabled. Profile cleanup is queued and will continue in resumable batches."
          : confirm.action === "withdrawal-decision"
            ? `Withdrawal ${confirm.payload.nextStatus}.`
            : confirm.action === "settle-deposit"
              ? result.email?.status === "sent"
                ? promoDeposit ? "Promo deposit credited and the 24-hour investment started. Confirmation email sent." : "Deposit credited. The member confirmation email was sent."
                : promoDeposit ? "Promo deposit credited and the 24-hour investment started. Confirmation email is being processed." : "Deposit credited. The member confirmation email is being processed."
            : "Admin request completed successfully.",
      );
      completed = true;
    } catch (error) {
      showNotice(
        "error",
        getSafeErrorMessage(error, "The admin request failed."),
      );
    } finally {
      setActionSubmitting(false);
      if (completed) setConfirm(null);
    }
  }
  const onAction = (action, payload) => {
    if (action === "review" && payload.collection === "deposits") {
      navigate(`/control-room/deposits/${encodeURIComponent(payload.userId)}/${encodeURIComponent(payload.id)}`);
      return;
    }
    if (action === "review" && payload.collection === "withdrawals") {
      navigate(`/control-room/withdrawals/${encodeURIComponent(payload.userId)}/${encodeURIComponent(payload.id)}`);
      return;
    }
    if (action === "review" && payload.collection === "referralRewards") {
      navigate(`/control-room/referrals/${encodeURIComponent(payload.userId)}/${encodeURIComponent(payload.id)}`);
      return;
    }
    clearNoticeTimeout();
    setNotice("");
    setActionForm({
      status: payload.nextStatus || (payload.status === "pending" ? "approved" : payload.status || "approved"),
      name: String(payload.name || ""),
      description: String(payload.description || ""),
      minimum: String(payload.minimum || ""),
      maximum: String(payload.maximum || ""),
      returnRate: String(payload.returnRate || ""),
      duration: String(payload.duration || ""),
      password: "",
      confirmation: "",
      amount: "",
      currency: "USD",
      payoutConfirmed: false,
    });
    setConfirm({ action, payload });
  };
  const confirmationPayload = confirm?.payload || {};
  const confirmationAction = confirm?.action || "";
  const targetMember = confirmationPayload.profileUsername
    || confirmationPayload.username
    || confirmationPayload.profileEmail
    || confirmationPayload.email
    || confirmationPayload.userId
    || confirmationPayload.id
    || "Member not identified";
  const targetEmail = confirmationPayload.profileEmail || confirmationPayload.email;
  const targetRecordId = confirmationPayload.id;
  const targetAmount = confirmationPayload.amount;
  const hasTargetAmount = targetAmount !== undefined && targetAmount !== null && targetAmount !== "" && Number.isFinite(Number(targetAmount));
  const isPackageAction = ["create", "update-package"].includes(confirmationAction);
  const targetPlan = isPackageAction ? "" : confirmationPayload.plan || confirmationPayload.packageName;
  const targetAsset = confirmationPayload.method || confirmationPayload.asset;
  const targetMinimum = isPackageAction ? actionForm.minimum : confirmationPayload.minimum;
  const targetMaximum = isPackageAction ? actionForm.maximum : confirmationPayload.maximum;
  const targetReturnRate = isPackageAction ? actionForm.returnRate : null;
  const targetDuration = isPackageAction ? actionForm.duration : null;
  const showTargetFacts = [
    "approve-withdrawal", "withdrawal-decision", "settle-deposit", "delete-deposit",
    "delete-withdrawal", "delete-user", "disable-user", "retry-deposit-email", "retry-withdrawal-email", "review", "create", "update-package",
  ].includes(confirmationAction);
  const confirmationConsequence = confirmationAction === "approve-withdrawal"
    ? "Completes this request, debits the member balance, records the ledger change, and queues the success email. The external payout must already have been sent."
    : confirmationAction === "withdrawal-decision"
      ? confirmationPayload.nextStatus === "approved"
        ? "Approves this withdrawal request. The request will move into the completion workflow; this decision alone does not send money."
        : "Rejects this withdrawal request. The member balance and ledger remain unchanged."
      : confirmationAction === "settle-deposit"
        ? "Credits the confirmed amount to this member and starts the package term. Confirm the received amount and plan before continuing."
        : isPackageAction
          ? "Saves the package terms shown here to the investment catalog. Verify the amount limits, return rate, and duration before confirming."
        : confirmationAction === "review"
          ? confirmationPayload.resource === "withdrawals"
            ? "Changes this withdrawal request’s status and releases its reserved amount when the new status leaves the active queue. It does not send a payout."
            : confirmationPayload.resource === "deposits"
              ? "Changes this deposit request’s status only. It does not credit funds or start investment accrual."
              : "Changes the selected support or referral record status and records the review in admin history."
        : confirmationAction === "delete-user"
          ? "Disables this account immediately, then permanently removes its profile and nested records in restartable batches. This cannot be undone."
          : confirmationAction === "delete-deposit" || confirmationAction === "delete-withdrawal"
            ? "Deletes only this eligible request; it does not change a balance or ledger. This cannot be undone."
            : confirmationAction === "disable-user"
              ? confirmationPayload.disabled
                ? "Restores this member’s account access so they can sign in again."
                : "Blocks this member from signing in until an administrator restores access."
              : confirmationAction.startsWith("retry-")
                ? "Retries the notification email only. It does not change account balances, ledger entries, or a payout."
                : "Re-enter your administrator password to confirm this audited action.";
  return (
    <div className="admin-console dashboard-font">
      <SkipToContent targetId="admin-main" inert={Boolean(confirm)} />
      <header className="admin-masthead" inert={Boolean(confirm)}>
        <div className="admin-masthead-brand">
          <button type="button" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={menuOpen} className="admin-menu-trigger lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <Link to="/control-room" className="admin-brand-link">
            <img src="/meridianvest-logo.svg" alt="MeridianVests" />
            <span><strong>MeridianVests</strong><small>Administration</small></span>
          </Link>
        </div>
        <div className="admin-masthead-actions">
          <Link to="/" className="admin-top-link">Home</Link>
          <span aria-hidden="true" className="admin-top-divider">·</span>
          <button type="button" className="admin-top-link" onClick={() => { clearAdminLoginSession(); signOutUser(); }}>Logout</button>
          <span className="admin-top-user">{user?.displayName || user?.email || "Administrator"}</span>
        </div>
      </header>
      <div className="admin-layout" inert={Boolean(confirm)}>
      {menuOpen && <button aria-label="Close navigation" className="admin-nav-backdrop lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside ref={mobileMenuRef} id="admin-navigation" aria-label="Admin navigation panel" className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="Admin navigation" className="admin-nav">
          {navGroups.map((group) => (
            <section className="admin-nav-group" key={group.label} aria-label={group.label}>
              <h2 className="admin-nav-title">{group.label}</h2>
              <div className="admin-nav-items">
                {group.items.map(([path, label, Icon]) => {
                  const navPath = path.split("?")[0];
                  const active = activeNavigationItem?.[0] === path;
                  const queueSection = ["Withdrawal history", "All deposits", "Referral leaders"].includes(label)
                    ? null
                    : Object.keys(QUEUE_SECTIONS).find(
                      (section) => navPath === `/control-room/${section}`,
                    );
                  const badgeCount = queueSection ? queueBadgeCounts[queueSection] : 0;
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`admin-nav-link group ${active ? "is-active" : ""} ${badgeCount > 0 ? "has-badge" : ""} ${
                        active
                          ? "bg-sky-300 text-[#07111d]"
                          : "text-slate-300"
                      }`}
                    >
                      <Icon size={14} strokeWidth={active ? 2.4 : 1.9} className="admin-nav-icon" />
                      <span className="truncate">{label}</span>
                      {badgeCount > 0 && (
                        <span
                          aria-label={`${badgeCount} outstanding ${label.toLowerCase()} items`}
                          className="admin-count-badge"
                        >
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <main id="admin-main" tabIndex="-1" className="admin-main outline-none">
          <div className="admin-page-heading">
            <div><h1>{currentPageTitle}</h1><p>{resources[resource]?.[1] || "Manage MeridianVests operations and member services."}</p></div>
            <div className="admin-breadcrumb">
            <Link to="/control-room" className="hover:text-slate-900">Admin</Link>
            <ChevronRight size={13} />
            <span>{transactionDetails ? "Transaction details" : depositDetails ? "Deposit review" : supportDetails ? "Support ticket details" : withdrawalDetails ? "Withdrawal review" : referralDetails ? "Referral details" : supportChatArchive ? "Archived support chats" : resource === "overview" ? "Overview" : resources[resource]?.[0] || "Not found"}</span>
          </div>
          </div>
          {(queueSummaryError || supportQueueError) && (
            <FeedbackMessage type="error" className="mb-5">
              {[queueSummaryError, supportQueueError].filter(Boolean).join(" ")}
            </FeedbackMessage>
          )}
          {invalidTransactionDetails ? (
            <AdminRouteMessage title="Invalid transaction link" description="The transaction URL contains an invalid record identifier." />
          ) : invalidDepositDetails ? (
            <AdminRouteMessage title="Invalid deposit link" description="The deposit URL contains an invalid record identifier." />
          ) : invalidSupportDetails ? (
            <AdminRouteMessage title="Invalid support link" description="The support URL contains an invalid ticket identifier." />
          ) : invalidWithdrawalDetails ? (
            <AdminRouteMessage title="Invalid withdrawal link" description="The withdrawal URL contains an invalid record identifier." />
          ) : invalidReferralDetails ? (
            <AdminRouteMessage title="Invalid referral link" description="The referral URL contains an invalid reward identifier." />
          ) : unknownResource ? (
            <AdminRouteMessage title="Admin page not found" description="That admin resource does not exist." />
          ) : invalidTransactionCreate ? (
            <AdminRouteMessage title="Admin option unavailable" description="This legacy transaction screen is unavailable. Use Add funds to issue a withdrawable administrator credit or review a member deposit request." />
          ) : removedExchangeView ? (
            <AdminRouteMessage title="Exchange page removed" description="Exchange activity is not available in this admin panel." />
          ) : transactionCreate ? (
            <AdminLedgerEntry />
          ) : transactionDetails ? (
            <TransactionDetails userId={transactionUserId} transactionId={transactionId} collection={transactionCollection} />
          ) : depositDetails ? (
            <DepositDetails userId={depositUserId} depositId={depositId} onAction={onAction} refreshKey={refreshKey} />
          ) : supportDetails ? (
            <SupportDetails userId={supportUserId} ticketId={supportTicketId} />
          ) : withdrawalDetails ? (
            <WithdrawalDetails userId={withdrawalUserId} withdrawalId={withdrawalId} onAction={onAction} refreshKey={refreshKey} />
          ) : referralDetails ? (
            <ReferralDetails userId={referralUserId} rewardId={referralRewardId} />
          ) : resource === "overview" ? (
            <Overview queueCounts={queueCounts} queueCountsLoading={queueCountsLoading} queueCountsError={queueSummaryError} refreshKey={refreshKey} />
          ) : resource === "support-chat" ? (
            <AdminSupportChat archiveView={supportChatArchive} sharedConversations={supportConversations} conversationPage={supportConversationPage} sharedCounts={supportConversationCounts} onCountsRefresh={refreshSupportCounts} sharedError={supportQueueError} />
          ) : accountBlacklistView ? (
            <BlacklistPage onAction={onAction} refreshKey={refreshKey} />
          ) : resource === "packages" ? (
            <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
          ) : resource === "withdrawals" ? (
            withdrawalView === "history"
              ? <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
              : <WithdrawalDecisionQueue onAction={onAction} refreshKey={refreshKey} />
          ) : (
            <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
          )}
        </main>
      </div>
      <footer className="admin-footer" inert={Boolean(confirm)}>MeridianVests · Administration</footer>
      {notice && <div inert={Boolean(confirm)} role={noticeType === "error" ? "alert" : "status"} className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border bg-[#0b1626] px-4 py-3 text-sm shadow-lg ${noticeType === "error" ? "border-rose-400/30 text-rose-300" : "border-emerald-400/30 text-emerald-300"}`}><CheckCircle2 size={17} />{notice}</div>}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            aria-describedby={showTargetFacts ? "admin-confirm-description admin-confirm-target" : "admin-confirm-description"}
            tabIndex="-1"
            className="w-full max-w-md rounded-lg border border-white/10 bg-[#0b1626] p-6 text-slate-100 shadow-2xl"
          >
            <h2 id="admin-confirm-title" className="text-lg font-bold text-slate-900">
              {confirm.action === "approve-withdrawal" ? "Approve and complete withdrawal" : confirm.action === "withdrawal-decision" ? `${confirm.payload.nextStatus === "approved" ? "Approve" : "Reject"} withdrawal request` : confirm.action === "review" ? "Update record status" : confirm.action === "settle-deposit" ? "Credit offline payment" : confirm.action === "retry-deposit-email" ? "Retry deposit confirmation email" : confirm.action === "retry-withdrawal-email" ? "Retry withdrawal success email" : confirm.action === "delete-deposit" ? "Delete deposit request" : confirm.action === "delete-withdrawal" ? "Delete withdrawal request" : confirm.action === "disable-user" ? (confirm.payload.disabled ? "Enable user access" : "Disable user access")  : confirm.action === "delete-user" ? "Permanently delete user" : confirm.action === "update-package" ? "Edit investment package" : "Create investment package"}
            </h2>
            <p id="admin-confirm-description" className="mt-2 text-sm leading-6 text-slate-400">
              {confirm.action === "approve-withdrawal"
                ? "This action completes the withdrawal, updates the balance and ledger, and sends the success email. Only continue after you have sent the payout externally."
                : confirm.action === "retry-withdrawal-email"
                ? "This retries only the success notification for an already-completed withdrawal. It does not change the balance, ledger, or payout."
                : confirm.action === "withdrawal-decision"
                ? `Confirm that you want to ${confirm.payload.nextStatus === "approved" ? "approve" : "reject"} this withdrawal request.`
                : ["delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action)
                ? "To confirm this deletion, re-enter your administrator password. Account access is disabled first; profile cleanup may continue in the background. The action will be recorded in the audit history."
                : "Re-enter your administrator password to confirm. This action will be recorded in the audit history."}
            </p>
            {showTargetFacts && (
              <section id="admin-confirm-target" className="admin-confirm-context mt-4" aria-label="Action target and consequence">
                <dl className="admin-confirm-facts">
                  <div><dt>{isPackageAction ? "Package" : "Member"}</dt><dd>{isPackageAction ? actionForm.name || "New package" : targetMember}</dd></div>
                  {targetEmail && targetEmail !== targetMember && <div><dt>Email</dt><dd>{targetEmail}</dd></div>}
                  {targetRecordId && <div><dt>Request / record</dt><dd>{targetRecordId}</dd></div>}
                  {hasTargetAmount && <div><dt>{confirmationAction === "settle-deposit" ? "Requested amount" : "Amount"}</dt><dd>{formatMoney(targetAmount)} USD</dd></div>}
                  {targetPlan && <div><dt>Investment plan</dt><dd>{targetPlan}</dd></div>}
                  {targetMinimum !== undefined && targetMinimum !== null && targetMinimum !== "" && <div><dt>Minimum</dt><dd>{formatMoney(targetMinimum)} USD</dd></div>}
                  {(isPackageAction || (targetMaximum !== undefined && targetMaximum !== null && targetMaximum !== "")) && <div><dt>Maximum</dt><dd>{Number(targetMaximum) > 0 ? `${formatMoney(targetMaximum)} USD` : "No maximum"}</dd></div>}
                  {targetReturnRate !== null && targetReturnRate !== "" && <div><dt>Return rate</dt><dd>{targetReturnRate}%</dd></div>}
                  {targetDuration && <div><dt>Duration</dt><dd>{targetDuration}</dd></div>}
                  {confirmationAction === "settle-deposit" && actionForm.amount && <div><dt>Amount to credit</dt><dd>{formatMoney(actionForm.amount)} USD</dd></div>}
                  {targetAsset && <div><dt>Asset / method</dt><dd>{targetAsset}</dd></div>}
                  {confirmationAction === "approve-withdrawal" && confirmationPayload.wallet && <div><dt>Destination wallet</dt><dd>{confirmationPayload.wallet}</dd></div>}
                  <div className="admin-confirm-consequence"><dt>What happens</dt><dd>{confirmationConsequence}</dd></div>
                </dl>
              </section>
            )}
            {confirm.action === "delete-deposit" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Delete deposit request</p>
                <p>Requester: {confirm.payload.profileEmail || "No email"} · @{confirm.payload.profileUsername || "No username"}</p>
                <p>This removes only the request. It cannot be undone and does not change any balance or ledger history. Approved or credited requests are locked.</p>
                <label className="block font-semibold">
                  Type DELETE DEPOSIT to confirm
                  <input data-dialog-autofocus="true" value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-slate-900 outline-none focus:border-rose-300" />
                </label>
              </div>
            ) : confirm.action === "delete-withdrawal" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Delete withdrawal request</p>
                <p>Requester: {confirm.payload.profileEmail || confirm.payload.email || "No email"} · @{confirm.payload.profileUsername || confirm.payload.username || "No username"}</p>
                <p>This removes only the request and cannot be undone. Paid or settled withdrawals are locked. The deletion is recorded in the audit history.</p>
                <label className="block font-semibold">
                  Type DELETE WITHDRAWAL to confirm
                  <input data-dialog-autofocus="true" value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-slate-900 outline-none focus:border-rose-300" />
                </label>
              </div>
            ) : confirm.action === "settle-deposit" ? (
              <div className="mt-5 space-y-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <p className="font-bold">Offline confirmation required</p>
                <p>The user must have paid outside the website. Enter only the amount you personally confirmed. Crediting starts the investment term and locks the principal until maturity. The deposit cannot be credited twice.</p>
                {String(confirm.payload.plan || confirm.payload.packageName || "").toUpperCase() === "PROMO MINI PLAN" && <p>Promo Mini: 100% profit after 24 hours. The term starts when this credit is confirmed.</p>}
                {String(confirm.payload.plan || confirm.payload.packageName || "").toUpperCase() === "PROMO MEGA PLAN" && <p>Promo Mega: 500% profit after 24 hours. The term starts when this credit is confirmed.</p>}
                <p className="text-xs text-emerald-200/80">Payment method: {confirm.payload.method || confirm.payload.asset || "Not recorded"} · Balance currency: USD</p>
                <label className="block font-semibold">
                  Amount received (USD)
                  <input data-dialog-autofocus="true" aria-label="Amount received in USD" type="number" min="0.01" step="0.01" value={actionForm.amount} onChange={(event) => setActionForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 font-normal text-slate-900 outline-none focus:border-emerald-300" />
                </label>
              </div>
            ) : confirm.action === "approve-withdrawal" ? (
              <div className="mt-5 space-y-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <p className="font-bold">Confirm external payout</p>
                <p>
                  {confirm.payload.profileUsername || confirm.payload.username || "Member"} ·{" "}
                  {confirm.payload.profileEmail || confirm.payload.email || "No email recorded"}
                </p>
                <p>
                  {confirm.payload.method || confirm.payload.asset || "Payout asset"} ·{" "}
                  {Number.isFinite(Number(confirm.payload.amount))
                    ? `${formatMoney(confirm.payload.amount)} USD`
                    : "Amount not recorded"}
                </p>
                <p className="break-all font-mono text-xs leading-5">{confirm.payload.wallet || "No wallet was provided; arrange payout through the offline process."}</p>
                <label className="flex items-start gap-2 pt-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={actionForm.payoutConfirmed}
                    onChange={(event) => setActionForm((current) => ({ ...current, payoutConfirmed: event.target.checked }))}
                    className="mt-1 accent-emerald-300"
                  />
                  <span>I have already completed the payout through the offline process.</span>
                </label>
              </div>
            ) : confirm.action === "withdrawal-decision" ? (
              <div className={`mt-5 rounded-md border p-4 text-sm ${confirm.payload.nextStatus === "approved" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-rose-400/25 bg-rose-400/10 text-rose-100"}`}>
                <p className="font-bold">{confirm.payload.nextStatus === "approved" ? "Approve request" : "Reject request"}</p>
                <p className="mt-2">Member: {confirm.payload.profileUsername || confirm.payload.username || "No username"} · {confirm.payload.profileEmail || confirm.payload.email || "No email"}</p>
                <p className="mt-2">Rejecting this request does not change the member’s balance or ledger.</p>
              </div>
            ) : confirm.action === "review" ? (
              <label className="mt-5 block text-sm font-semibold text-slate-200">
                New status
                <select
                  value={actionForm.status}
                  onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400"
                >
                  {(confirm.payload.resource === "support"
                    ? ["open", "on-hold"].includes(String(confirm.payload.status || "open").toLowerCase())
                      ? ["open", "on-hold", "resolved", "closed"]
                      : [String(confirm.payload.status || "open").toLowerCase()]
                    : ["pending", "approved", "rejected", "on-hold", "open", "closed", "resolved"]
                  ).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            ) : ["create", "update-package"].includes(confirm.action) ? (
              <div className="mt-5 grid gap-3">
                {[
                  ["name", "Package name", "text"],
                  ["description", "Description", "text"],
                  ["minimum", "Minimum amount", "number"],
                  ["maximum", "Maximum amount", "number"],
                  ["returnRate", "Daily simple profit rate (%)", "number"],
                  ["duration", "Duration", "text"],
                ].map(([field, label, type]) => (
                  <label key={field} className="text-sm font-semibold text-slate-200">
                    {label}
                    <input
                      type={type}
                      value={actionForm[field]}
                      onChange={(event) => setActionForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400"
                    />
                  </label>
                ))}
              </div>
            ) : confirm.action === "delete-user" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Permanent deletion</p>
                <p className="break-all font-semibold">{confirm.payload.email || confirm.payload.displayName || confirm.payload.id}</p>
                <p>Account access is disabled immediately. The Firebase account, profile, and nested records are then removed in restartable batches. This cannot be undone.</p>
                <label className="block font-semibold">
                  Type DELETE USER to confirm
                  <input value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-slate-900 outline-none focus:border-rose-300" />
                </label>
              </div>
            ) : <p className={`mt-5 rounded-md p-3 text-sm ${confirm.action === "disable-user" && confirm.payload.disabled ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{confirm.payload.disabled ? "This restores the target Firebase account and allows the user to sign in again." : "This disables the target Firebase account and its access until an administrator enables it."}</p>}
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Re-enter administrator password
              <input type="password" autoComplete="current-password" value={actionForm.password} onChange={(event) => setActionForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-sky-400" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button disabled={actionSubmitting} onClick={() => setConfirm(null)} className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button onClick={confirmAction} disabled={actionSubmitting || !actionForm.password || (confirm.action === "approve-withdrawal" && !actionForm.payoutConfirmed) || (confirm.action === "settle-deposit" && !(Number(actionForm.amount) > 0)) || (confirm.action === "delete-user" && actionForm.confirmation !== "DELETE USER") || (confirm.action === "delete-deposit" && actionForm.confirmation !== "DELETE DEPOSIT") || (confirm.action === "delete-withdrawal" && actionForm.confirmation !== "DELETE WITHDRAWAL") || (["create", "update-package"].includes(confirm.action) && !actionForm.name.trim())} className={`rounded-md px-4 py-2 text-sm font-semibold ${["delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action) ? "bg-rose-500 text-slate-900 hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50" : "bg-sky-300 text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"}`}>{actionSubmitting ? "Processing…" : confirm.action === "approve-withdrawal" ? "Approve and complete" : confirm.action === "withdrawal-decision" ? (confirm.payload.nextStatus === "approved" ? "Approve request" : "Reject request") : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
