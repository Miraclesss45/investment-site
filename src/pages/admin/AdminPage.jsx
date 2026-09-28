import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Package,
  ExternalLink, RefreshCw, Search, ShieldCheck, TrendingUp, UserRound, Users, WalletCards, X,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { changeAdminPassword, getAdminPage, getAdminRecord, getAdminResource, requestAdminAction, reauthenticateAdmin } from "../../lib/adminApi";
import { getAuthErrorMessage, getSafeErrorMessage } from "../../lib/authHelpers";
import { clearAdminLoginSession } from "../../lib/adminSession";
import { formatMoney } from "../../lib/financial";
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
    label: "Workspace",
    items: [["/control-room", "Overview", LayoutDashboard]],
  },
  {
    label: "Plans",
    items: [["/control-room/packages", "Investment packages", Package]],
  },
  {
    label: "Members",
    items: [
      ["/control-room/users", "Users", Users],
      ["/control-room/admins", "Administrators", ShieldCheck],
      ["/control-room/referrals", "Referrals", TrendingUp],
    ],
  },
  {
    label: "Transactions",
    items: [
      ["/control-room/transactions", "Transactions", WalletCards],
      ["/control-room/withdrawals", "Withdrawals", ArrowUpRight],
      ["/control-room/deposits", "Deposits", ArrowDownToLine],
    ],
  },
  {
    label: "Support & oversight",
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
  referrals: ["Referrals", "Track attribution and referral rewards."],
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
      <h1 className="text-xl font-bold text-white">{title}</h1>
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
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminRecord("referrals", userId, rewardId, "referralRewards")
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
  }, [rewardId, userId]);

  const detailEntries = reward
    ? Object.entries(reward).filter(([key]) => !["id", "userId", "collection"].includes(key))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Referral review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Referral reward details</h1>
          <p className="mt-1 text-sm text-slate-400">Read-only attribution and reward information.</p>
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
              <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Reward record</p>
              <h2 className="mt-2 break-all font-semibold text-white">{reward.id}</h2>
            </div>
            <Status>{reward.status || "Recorded"}</Status>
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
    Active: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    Approved: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    Completed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    Open: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
    Pending: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    Review: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    Suspended: "bg-rose-400/10 text-rose-300 ring-rose-400/20",
  };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${tones[children] || "bg-white/10 text-slate-300 ring-white/15"}`}>{children || "—"}</span>;
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1626] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}<Icon size={17} className="text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-white">{value}</p>
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Transaction record</h1>
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
                <p className="mt-3 break-all text-sm font-bold text-white">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Full record</p>
                <h2 className="mt-2 font-semibold text-white">{transaction.id}</h2>
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Support request</h1>
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
                <p className="mt-3 break-all text-sm font-bold text-white">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Full ticket record</p>
                <h2 className="mt-2 font-semibold text-white">{ticket.id}</h2>
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
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Deposit review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Deposit request</h1>
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
                <p className="mt-3 break-all text-sm font-bold text-white">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Payment request details</p>
                <h2 className="mt-2 break-all font-semibold text-white">{deposit.id}</h2>
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
  const canDelete = withdrawal
    && !withdrawal.settlementId
    && !withdrawal.settledAt
    && !withdrawal.completedAt
    && !withdrawal.paidAt
    && !["complete", "completed", "settled", "paid", "success"].includes(status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Withdrawal review</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Withdrawal request</h1>
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
                <p className="mt-3 break-all text-sm font-bold text-white">{String(value)}</p>
              </div>
            ))}
          </div>
          <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Request details</p>
                <h2 className="mt-2 font-semibold text-white">{withdrawal.id}</h2>
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
        <h2 className="mt-2 text-lg font-bold text-white">Requests awaiting a decision or completion</h2>
        <p className="mt-1 text-sm text-slate-400">Send the payout to the saved wallet outside the website before approving. Approval then completes the request and sends the member an email.</p>
      </div>
      {error ? (
        <div className="p-5"><FeedbackMessage type="error">{error}</FeedbackMessage></div>
      ) : !rows ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading withdrawal requests…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">There are no withdrawal requests awaiting approval or completion.</div>
      ) : (
        <div className="divide-y divide-white/10">
          {rows.map((withdrawal) => (
            <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" key={`${withdrawal.userId}:${withdrawal.id}`}>
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-white">{withdrawal.profileUsername || withdrawal.username || "Member"} · {withdrawal.profileEmail || withdrawal.email || "No email recorded"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Request {withdrawal.id} · {withdrawal.asset || withdrawal.method || "Payment method not recorded"} · {Number.isFinite(Number(withdrawal.amount)) ? formatMoney(withdrawal.amount) : "Amount not recorded"}
                </p>
                <div className="mt-2"><Status>{withdrawal.status || "Pending"}</Status></div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
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

function Overview() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminResource("users")
      .then((data) => active && setUsers(data))
      .catch((reason) => active && setError(getSafeErrorMessage(reason, "Unable to load user activity.")));
    return () => {
      active = false;
    };
  }, []);

  const activeUsers = users?.filter((user) => user.status !== "Suspended" && user.status !== "Disabled").length;
  const verifiedUsers = users?.filter((user) => user.emailVerified === true || user.verified === true).length;
  const pendingUsers = users?.filter((user) => ["Pending", "Review"].includes(user.status)).length;
  const formatMetric = (value) => (value === undefined ? "—" : value.toLocaleString());

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-widest text-sky-300">Operations</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Platform overview</h1><p className="mt-1 text-sm text-slate-400">Monitor account activity and operational queues.</p></div>
      {error && (
        <FeedbackMessage type="error">
          {error} Check that the admin data endpoint is available and your Firestore rules permit the intended admin access.
        </FeedbackMessage>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active users" value={formatMetric(activeUsers)} detail="Current Firebase profiles" icon={Users} />
        <Metric label="Verified users" value={formatMetric(verifiedUsers)} detail="Profiles marked verified" icon={CheckCircle2} />
        <Metric label="Needs review" value={formatMetric(pendingUsers)} detail="Pending or review status" icon={ClipboardList} />
        <Metric label="Last refresh" value={users ? "Just now" : error ? "Unavailable" : "Loading"} detail="Live users collection" icon={Activity} />
      </div>
      <section aria-labelledby="admin-shortcuts-title" className="rounded-xl border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.16)]">
        <div className="mb-4">
          <h2 id="admin-shortcuts-title" className="font-semibold text-white">Quick access</h2>
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
              className="group flex min-h-24 items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-sky-300/30 hover:bg-sky-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-300/10 text-sky-200 transition group-hover:bg-sky-300/15"><Icon size={17} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100 group-hover:text-white">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
              </span>
              <ChevronRight size={15} className="ml-auto mt-1 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-sky-200" />
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Recent users</h2><p className="mt-1 text-sm text-slate-400">The latest profiles returned from Firebase.</p></div><Users size={19} className="text-slate-400" /></div><div className="mt-5 divide-y divide-white/10">{users?.slice(0, 5).map((user) => <div className="flex items-center justify-between gap-4 py-3" key={user.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{user.displayName || user.username || user.email || user.id}</p><p className="truncate text-xs text-slate-400">{user.email || "No email recorded"}</p></div><Status>{user.status || "Active"}</Status></div>) || <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">{error ? "User activity unavailable." : "Loading user activity…"}</div>}{users?.length === 0 && <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">No user profiles found.</div>}</div></section>
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Admin safeguards</h2><ShieldCheck size={19} className="text-emerald-300" /></div><div className="mt-4 space-y-2 text-sm text-slate-300"><p className="rounded-md bg-white/[0.04] p-3">Admin sign-in is separate from member authentication.</p><p className="rounded-md bg-white/[0.04] p-3">User data stays protected by Firestore rules.</p><p className="rounded-md bg-white/[0.04] p-3">Sensitive changes require confirmation and are recorded in the audit history.</p></div></section>
      </div>
    </div>
  );
}

function PackageWorkspace({ refreshKey, onRefresh }) {
  const [users, setUsers] = useState(null);
  const [userCursor, setUserCursor] = useState("");
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [packages, setPackages] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [allocations, setAllocations] = useState({ BTC: "", ETH: "", LTC: "", BNB: "" });
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus({ type: "", message: "" });
    Promise.all([getAdminPage("users"), getAdminPage("packages")])
      .then(([userPage, packagePage]) => {
        if (!active) return;
        setUsers(userPage.items);
        setUserCursor(userPage.nextCursor);
        setHasMoreUsers(userPage.hasMore);
        setPackages(packagePage.items);
      })
      .catch((error) => active && setStatus({ type: "error", message: getSafeErrorMessage(error, "Unable to load users and packages.") }));
    return () => { active = false; };
  }, [refreshKey]);

  async function loadMoreUsers() {
    if (!userCursor || loadingMoreUsers) return;
    setLoadingMoreUsers(true);
    try {
      const page = await getAdminPage("users", userCursor);
      setUsers((current) => [...(current || []), ...page.items]);
      setUserCursor(page.nextCursor);
      setHasMoreUsers(page.hasMore);
    } catch (error) {
      setStatus({ type: "error", message: getSafeErrorMessage(error, "Unable to load more members.") });
    } finally {
      setLoadingMoreUsers(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (users || []).filter((user) => !normalized || [user.displayName, user.username, user.email, user.id].join(" ").toLowerCase().includes(normalized));
  }, [query, users]);
  const selectedUser = users?.find((user) => user.id === selectedUserId);
  const selectedPackage = packages?.find((item) => item.id === selectedPackageId);

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    const assignedPackage = packages?.find((item) => item.name === user.paperTrading?.packageName);
    setSelectedPackageId(assignedPackage?.id || "");
    const current = user.paperTrading?.allocations || {};
    setAllocations({ BTC: String(current.BTC || ""), ETH: String(current.ETH || ""), LTC: String(current.LTC || ""), BNB: String(current.BNB || "") });
  };
  const selectPackage = (event) => {
    const packageId = event.target.value;
    setSelectedPackageId(packageId);
    const current = packages?.find((item) => item.id === packageId)?.paperTrading?.allocations || {};
    setAllocations({ BTC: String(current.BTC || ""), ETH: String(current.ETH || ""), LTC: String(current.LTC || ""), BNB: String(current.BNB || "") });
  };
  const saveAllocation = async () => {
    if (!selectedUserId || !reason.trim() || !password || !Object.values(allocations).some((amount) => Number(amount) > 0)) return;
    setStatus({ type: "", message: "" });
    setSaving(true);
    try {
      await reauthenticateAdmin(password);
      const result = await requestAdminAction("set-paper-trading", {
        profileId: selectedUserId,
        packageName: selectedPackage?.name,
        allocations,
        reason: reason.trim(),
      });
      setUsers((current) => (current || []).map((user) => user.id === selectedUserId
        ? { ...user, paperTrading: result.paperTrading }
        : user));
      setStatus({ type: "success", message: "Crypto trading assignment saved successfully. The selected user's Crypto Position is now updated." });
      setPassword("");
    } catch (error) {
      setStatus({ type: "error", message: getSafeErrorMessage(error, "The crypto trading allocation could not be saved.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Investment packages</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Package investment workspace</h1>
        <p className="mt-1 text-sm text-slate-400">Select a member, choose a package, and assign their BTC, ETH, LTC or BNB crypto trading capital.</p>
      </div>
      {status.message && <FeedbackMessage type={status.type === "success" ? "success" : "error"}>{status.message}</FeedbackMessage>}
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-[#0b1626] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-white">Members</h2><p className="mt-1 text-xs text-slate-400">{users ? `${users.length} users` : "Loading users…"}</p></div>
            <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.06]"><RefreshCw size={14} />Refresh</button>
          </div>
          <div className="relative mt-4">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or ID" className="w-full rounded-md border border-white/10 bg-[#081321] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-400/60" />
          </div>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {(filteredUsers || []).map((user) => (
              <button key={user.id} onClick={() => selectUser(user)} className={`w-full rounded-md border p-3 text-left transition ${selectedUserId === user.id ? "border-sky-300/60 bg-sky-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
                <div className="flex min-w-0 items-center justify-between gap-3"><span className="truncate text-sm font-semibold text-white">{user.displayName || user.username || user.email || user.id}</span><Status>{user.paperTrading?.enabled ? "Assigned" : "Not assigned"}</Status></div>
                <p className="mt-1 truncate text-xs text-slate-400">{user.email || user.id}</p>
                <p className="mt-1 text-[11px] text-slate-500">Total deposits (reference): ${Number(user.totalDeposit || 0).toLocaleString()}</p>
              </button>
            ))}
          </div>
          {hasMoreUsers && <button type="button" onClick={loadMoreUsers} disabled={loadingMoreUsers} className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-60">{loadingMoreUsers ? "Loading…" : "Load more members"}</button>}
        </section>
        <section className="min-w-0 rounded-lg border border-white/10 bg-[#0b1626] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)] sm:p-5">
          <h2 className="font-semibold text-white">Crypto trading assignment</h2>
          <p className="mt-1 text-sm text-slate-400">{selectedUser ? `Editing ${selectedUser.displayName || selectedUser.email || selectedUser.id}. Crypto trading capital is managed separately from completed deposits.` : "Select a member to begin."}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-200">Package
              <select value={selectedPackageId} onChange={selectPackage} disabled={!selectedUser} className="mt-1 w-full rounded-md border border-white/10 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300 disabled:opacity-50">
                <option value="">Custom assignment</option>
                {(packages || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">Selected user: <strong className="break-all text-slate-200">{selectedUser?.email || selectedUser?.id || "None"}</strong></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.keys(allocations).map((currency) => <label className="text-sm font-semibold text-slate-200" key={currency}>{currency} capital (USD)<input type="number" min="0" step="0.01" value={allocations[currency]} disabled={!selectedUser} onChange={(event) => setAllocations((current) => ({ ...current, [currency]: event.target.value }))} className="mt-1 w-full rounded-md border border-white/10 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300 disabled:opacity-50" /></label>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-200 sm:col-span-2">Reason<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={!selectedUser} className="mt-1 w-full rounded-md border border-white/10 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300 disabled:opacity-50" /></label>
            <label className="text-sm font-semibold text-slate-200 sm:col-span-2">Admin password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={!selectedUser} className="mt-1 w-full rounded-md border border-white/10 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300 disabled:opacity-50" /></label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Enter at least 10 characters explaining this assignment.</p>
          <button onClick={saveAllocation} disabled={saving || !selectedUser || reason.trim().length < 10 || !password || !Object.values(allocations).some((amount) => Number(amount) > 0)} className="mt-5 w-full rounded-md bg-sky-300 px-4 py-3 text-sm font-bold text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving assignment…" : "Save crypto trading assignment"}</button>
        </section>
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
      <h2 className="mt-2 text-xl font-bold text-white">Change administrator password</h2>
      <p className="mt-1 text-sm text-slate-400">Re-enter your current password to update the password for your signed-in Firebase account.</p>
      {feedback.message && <FeedbackMessage type={feedback.type} className="mt-5">{feedback.message}</FeedbackMessage>}
      <form onSubmit={submit} className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200 sm:col-span-2">Current password
          <input type="password" autoComplete="current-password" required value={form.current} onChange={(event) => setForm((current) => ({ ...current, current: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
        </label>
        <label className="text-sm font-semibold text-slate-200">New password
          <input type="password" autoComplete="new-password" minLength={8} required value={form.next} onChange={(event) => setForm((current) => ({ ...current, next: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
        </label>
        <label className="text-sm font-semibold text-slate-200">Confirm new password
          <input type="password" autoComplete="new-password" minLength={8} required value={form.confirmation} onChange={(event) => setForm((current) => ({ ...current, confirmation: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
        </label>
        <button type="submit" disabled={saving || !form.current || !form.next || !form.confirmation} className="rounded-md bg-sky-300 px-4 py-3 text-sm font-bold text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:w-fit">
          {saving ? "Updating password…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function ResourcePage({ resource, onAction, refreshKey, onRefresh }) {
  const [rows, setRows] = useState(null);
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows(null);
    setNextCursor("");
    setHasMore(false);
    setError("");
    getAdminPage(resource).then((page) => {
      if (!active) return;
      setRows(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    }).catch((reason) => active && setError(getSafeErrorMessage(reason, "The admin data service is unavailable.")));
    return () => { active = false; };
  }, [resource, refreshKey]);

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await getAdminPage(resource, nextCursor);
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
  const filtered = useMemo(
    () =>
      searchableRows.filter(
        (row) => !normalizedQuery || row.__searchText.includes(normalizedQuery),
      ),
    [normalizedQuery, searchableRows],
  );
  const [title, description] = resources[resource];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Resource management</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
        <p className="mt-1 text-xs text-slate-500">Search covers the records loaded so far. Load more to include older records.</p>
      </div>
      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626] shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"><div className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-2.5 text-slate-500" /><input aria-label={`Search ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title}`} className="w-full rounded-md border border-white/10 bg-[#081321] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/15" /></div><span className="text-xs font-medium text-slate-400">{error ? "Unavailable" : `${filtered.length.toLocaleString()} of ${(rows || []).length.toLocaleString()} records`}</span></div><div className="flex items-center gap-2"><button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><RefreshCw size={15} />Refresh</button>{resource === "packages" && <button onClick={() => onAction("create", {})} className="rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-[#081321] hover:bg-sky-200">New package</button>}</div></div>
        {error ? (
          <div className="p-6">
            <FeedbackMessage type="error">{error}</FeedbackMessage>
          </div>
        ) : !rows ? <div className="p-12 text-center text-sm text-slate-400">Loading live {title.toLowerCase()}…</div> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.04]"><tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3 font-bold">Record</th><th className="px-5 py-3 font-bold">Details</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3" /></tr></thead><tbody>{filtered.map((row) => { const isDisabled = row.disabled === true || row.authDisabled === true || row.status === "Disabled"; const isAdmin = row.role === "admin"; const canManageAuth = resource !== "users" || row.authAccount === true;                         const actionPayload = { ...row, userId: resource === "users" ? (row.authUid || row.id) : row.userId, profileId: resource === "users" ? row.id : row.userId }; const depositStatus = String(row.status || "pending").toLowerCase(); const canDeleteDeposit = resource === "deposits" && !["approved", "completed", "settled", "credited"].includes(depositStatus) && !row.settlementId; const canDeleteWithdrawal = resource === "withdrawals" && !row.settlementId && !row.settledAt && !row.completedAt && !row.paidAt && !["complete", "completed", "settled", "paid", "success"].includes(depositStatus); return <tr className="border-b border-white/10 text-slate-300 last:border-0 hover:bg-white/[0.03]" key={row.id}><td className="px-5 py-4 font-semibold text-white">{row.id}</td><td className="max-w-xl px-5 py-4 text-xs">{resource === "deposits" && <div className="mb-2 grid gap-1 text-[11px]"><span><strong className="text-slate-200">Email:</strong> {row.profileEmail || row.email || "—"}</span><span><strong className="text-slate-200">Username:</strong> {row.profileUsername || row.username || "—"}</span></div>}{Object.entries(row).filter(([key]) => !["id", "__searchText", "emailNotifications", "authUid", "profileEmail", "profileUsername"].includes(key)).slice(0, 5).map(([key, value]) => <span className="mr-3 inline-block" key={key}><strong className="text-slate-200">{key}:</strong> {String(value ?? "—")}</span>)}{resource === "users" && !canManageAuth && <span className="mt-2 block text-amber-300">Firestore profile only — no Firebase Auth account</span>}</td><td className="px-5 py-4"><Status>{row.status || (canManageAuth ? (isDisabled ? "Suspended" : "Active") : "Profile only")}</Status></td><td className="px-5 py-4">{resource === "admins" ? null : resource === "users" ? <div className="flex justify-end gap-3"><button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} aria-label={`${isAdmin ? "Remove admin access from" : "Grant admin access to"} ${row.email || row.id}`} onClick={() => onAction("set-role", { ...actionPayload, role: isAdmin ? "member" : "admin" })} className="text-xs font-bold text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:text-slate-600">{isAdmin ? "Remove admin" : "Grant admin"}</button><button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} aria-label={`${isDisabled ? "Enable" : "Disable"} ${row.email || row.id}`} onClick={() => onAction("disable-user", { ...actionPayload, disabled: !isDisabled })} className={`text-xs font-bold ${isDisabled ? "text-emerald-300 hover:text-emerald-200" : "text-rose-300 hover:text-rose-200"} disabled:cursor-not-allowed disabled:text-slate-600`}>{isDisabled ? "Enable" : "Disable"}</button>                <button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} onClick={() => onAction("delete-user", actionPayload)} className="text-xs font-bold text-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:text-slate-600">Delete</button></div> : resource === "deposits" ? <div className="flex justify-end gap-3">{["pending", "approved"].includes(depositStatus) && <button onClick={() => onAction("settle-deposit", actionPayload)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">Credit offline payment</button>}{["pending", "rejected", "cancelled"].includes(depositStatus) && <button onClick={() => onAction("review", row)} className="text-xs font-bold text-slate-200 hover:text-white">Review</button>}{canDeleteDeposit && <button onClick={() => onAction("delete-deposit", actionPayload)} className="text-xs font-bold text-rose-300 hover:text-rose-200">Delete request</button>}{resource === "deposits" && depositStatus === "completed" && row.emailNotifications?.successful?.status === "failed" && <button onClick={() => onAction("retry-deposit-email", actionPayload)} className="text-xs font-bold text-amber-200 hover:text-amber-100">Retry confirmation email</button>}</div>                                         : resource === "withdrawals" ? <div className="flex justify-end gap-3"><Link to={`/control-room/withdrawals/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}`} className="text-xs font-bold text-sky-300 hover:text-sky-200">Details</Link>{canDeleteWithdrawal && <button onClick={() => onAction("delete-withdrawal", actionPayload)} className="text-xs font-bold text-rose-300 hover:text-rose-200">Delete request</button>}</div> : resource === "transactions" ? <a href={`/control-room/transactions/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}?collection=${encodeURIComponent(row.collection || "transactions")}`} target="_blank" rel="noreferrer" className="float-right inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200">View details <ExternalLink size={13} /></a> : resource === "support" ? <a href={`/control-room/support/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer" className="float-right inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200">View details <ExternalLink size={13} /></a>         : resource === "packages" ? <button onClick={() => onAction("update-package", row)} className="float-right text-xs font-bold text-slate-200 hover:text-white">Edit package <ChevronRight size={14} className="inline" /></button> : resource !== "audit" && <button onClick={() => onAction("review", row)} className="float-right text-xs font-bold text-slate-200 hover:text-white">Review <ChevronRight size={14} className="inline" /></button>}</td></tr>; })}</tbody></table></div> : <div className="p-12 text-center text-sm text-slate-400"><FileText className="mx-auto mb-3 text-slate-500" />No records found.</div>}
      </section>
      {hasMore && <div className="flex justify-center"><button type="button" onClick={loadMore} disabled={loadingMore} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-60">{loadingMore ? <><RefreshCw size={14} className="animate-spin" />Loading…</> : "Load more records"}</button></div>}
      {resource === "admins" && <AdminSecurityPanel />}
    </div>
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
  const [queueCounts, setQueueCounts] = useState({ deposits: 0, withdrawals: 0, support: 0, referrals: 0 });
  const [supportConversations, setSupportConversations] = useState(null);
  const [queueSummaryError, setQueueSummaryError] = useState("");
  const [supportQueueError, setSupportQueueError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
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
    paperBTC: "",
    paperETH: "",
    paperLTC: "",
    paperBNB: "",
    reason: "",
    password: "",
    confirmation: "",
  });
  const pathParts = location.pathname.split("/").filter(Boolean);
  const resource = pathParts[1] || "overview";
  const supportChatArchive = resource === "support-chat" && pathParts[2] === "archive";
  const transactionDetails = resource === "transactions" && pathParts.length >= 4;
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
    .find(([path]) =>
      path === "/control-room"
        ? location.pathname === path
        : location.pathname === path || location.pathname.startsWith(`${path}/`),
    );
  const currentPageTitle = transactionDetails
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

  useEffect(() => {
    if (!user?.uid) return undefined;
    let active = true;
    async function refreshQueueRows() {
      try {
        const counts = await getAdminResource("admin-queue-counts");
        if (!active) return;
        setQueueCounts(counts);
        setQueueSummaryError("");
      } catch (error) {
        if (!active) return;
        console.error("Admin queue counts could not be refreshed.", error);
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
      (conversations) => {
        setSupportConversations(conversations);
        setSupportQueueError("");
      },
      (error) => {
        console.error("Support chat badge count could not be refreshed.", error);
        setSupportQueueError("Support chat activity could not be refreshed.");
      },
    );
  }, [user?.uid]);

  const queueBadgeCounts = useMemo(() => {
    const outstandingChats = (supportConversations || []).filter((item) => (
      item.archived !== true && !["resolved", "closed"].includes(String(item.status || "open").toLowerCase())
    )).length;
    return { ...queueCounts, "support-chat": outstandingChats };
  }, [queueCounts, supportConversations]);

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
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    confirmDialogRef.current?.focus();

    function closeOnEscape(event) {
      if (event.key === "Escape") setConfirm(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
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
        ? { ...confirm.payload, nextStatus: actionForm.status, reason: actionForm.reason }
        : confirm.action === "settle-deposit"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              amount: Number(actionForm.amount),
              currency: actionForm.currency,
              reason: actionForm.reason,
            }
        : confirm.action === "retry-deposit-email"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              reason: actionForm.reason,
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
          ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, reason: actionForm.reason, disabled: confirm.payload.disabled === true }
          : confirm.action === "set-role"
            ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, role: confirm.payload.role, reason: actionForm.reason }
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
            paperTrading: {
              allocations: {
                BTC: Number(actionForm.paperBTC),
                ETH: Number(actionForm.paperETH),
                LTC: Number(actionForm.paperLTC),
                BNB: Number(actionForm.paperBNB),
              },
            },
            reason: actionForm.reason,
          };
    let completed = false;
    try {
      setActionSubmitting(true);
      await reauthenticateAdmin(actionForm.password);
      const result = await requestAdminAction(confirm.action === "withdrawal-decision" ? "review" : confirm.action, payload);
      setRefreshKey((current) => current + 1);
      const depositEmailFailed = ["settle-deposit", "retry-deposit-email"].includes(confirm.action)
        && result.email?.status === "failed";
      showNotice(
        (confirm.action === "approve-withdrawal" && result.email?.status === "failed") || depositEmailFailed ? "error" : "success",
        depositEmailFailed
          ? "Deposit was credited, but the member confirmation email failed. The deposit remains recorded."
          : confirm.action === "retry-deposit-email"
          ? result.email?.status === "sent"
            ? "Deposit confirmation email sent to the member."
            : result.email?.status === "sending"
              ? "A deposit confirmation email is already being sent."
              : "The deposit confirmation email could not be sent."
          : confirm.action === "approve-withdrawal" && result.email?.status === "failed"
          ? "Withdrawal completed, but the success email failed. The failure is recorded; do not send the payout again."
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
          : confirm.action === "withdrawal-decision"
            ? `Withdrawal ${confirm.payload.nextStatus}.`
            : confirm.action === "settle-deposit"
              ? result.email?.status === "sent"
                ? "Deposit credited. The member confirmation email was sent."
                : "Deposit credited. The member confirmation email is being processed."
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
      reason: "",
      password: "",
      confirmation: "",
      amount: "",
      currency: "USD",
      payoutConfirmed: false,
      paperBTC: String(payload.paperTrading?.allocations?.BTC || ""),
      paperETH: String(payload.paperTrading?.allocations?.ETH || ""),
      paperLTC: String(payload.paperTrading?.allocations?.LTC || ""),
      paperBNB: String(payload.paperTrading?.allocations?.BNB || ""),
    });
    setConfirm({ action, payload });
  };
  return (
    <div className="dashboard-font min-h-screen bg-[#07111d] text-slate-100">
      <SkipToContent targetId="admin-main" />
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside ref={mobileMenuRef} id="admin-navigation" aria-label="Admin navigation panel" className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-white/10 bg-[#091522] shadow-2xl shadow-black/30 transition-transform duration-200 lg:w-72 lg:translate-x-0 lg:shadow-none ${menuOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}>
        <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link to="/control-room" onClick={() => setMenuOpen(false)} className="flex min-w-0 items-center gap-3">
            <img src="/meridianvest-logo.svg" className="h-9 w-9 rounded-xl ring-1 ring-white/10" alt="MeridianVests" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">MeridianVests</span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Admin workspace</span>
            </span>
          </Link>
          <button type="button" aria-label="Close navigation" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>
        <nav aria-label="Admin navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.17em] text-slate-500">{group.label}</h2>
              <div className="space-y-1">
                {group.items.map(([path, label, Icon]) => {
                  const active = activeNavigationItem?.[0] === path;
                  const queueSection = Object.keys(QUEUE_SECTIONS).find(
                    (section) => path === `/control-room/${section}`,
                  );
                  const badgeCount = queueSection ? queueBadgeCounts[queueSection] : 0;
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition ${badgeCount > 0 ? "pr-10" : ""} ${
                        active
                          ? "bg-sky-300 text-[#07111d] shadow-[0_8px_24px_rgba(34,211,238,0.12)]"
                          : "text-slate-300 hover:bg-white/[0.055] hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-cyan-600" aria-hidden="true" />}
                      <Icon size={17} strokeWidth={active ? 2.4 : 1.9} className={active ? "shrink-0" : "shrink-0 text-slate-500 transition group-hover:text-sky-300"} />
                      <span className="truncate">{label}</span>
                      {badgeCount > 0 && (
                        <span
                          aria-label={`${badgeCount} outstanding ${label.toLowerCase()} items`}
                          className="absolute right-2 top-1/2 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-full border-2 border-[#091522] bg-rose-500 px-1 text-[10px] font-extrabold leading-none text-white shadow"
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
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-200 ring-1 ring-inset ring-sky-300/15"><UserRound size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-100">{user?.displayName || "Administrator"}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email || "Verified admin"}</p>
            </div>
            <button type="button" title="Sign out" aria-label="Sign out" onClick={() => { clearAdminLoginSession(); signOutUser(); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#0b1626]/95 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={menuOpen} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:border-sky-300/30 hover:bg-sky-300/10 hover:text-white lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{currentPageTitle}</p>
              <p className="hidden truncate text-[11px] text-slate-500 sm:block">{resources[resource]?.[1] || "Manage MeridianVests operations and member services."}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2 text-[11px] font-bold text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" /><span className="hidden sm:inline">Secure admin console</span><span className="sm:hidden">Secure</span></div>
        </header>
        <main id="admin-main" tabIndex="-1" className="mx-auto max-w-[1600px] p-4 outline-none sm:p-6 lg:p-8">
          <div className="mb-5 flex items-center gap-2 text-xs text-slate-400">
            <Link to="/control-room" className="hover:text-white">Admin</Link>
            <ChevronRight size={13} />
            <span>{transactionDetails ? "Transaction details" : depositDetails ? "Deposit review" : supportDetails ? "Support ticket details" : withdrawalDetails ? "Withdrawal review" : referralDetails ? "Referral details" : supportChatArchive ? "Archived support chats" : resource === "overview" ? "Overview" : resources[resource]?.[0] || "Not found"}</span>
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
            <Overview />
          ) : resource === "support-chat" ? (
            <AdminSupportChat archiveView={supportChatArchive} sharedConversations={supportConversations} sharedError={supportQueueError} />
          ) : resource === "packages" ? (
            <PackageWorkspace refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
          ) : resource === "withdrawals" ? (
            <>
              <WithdrawalDecisionQueue onAction={onAction} refreshKey={refreshKey} />
              <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
            </>
          ) : (
            <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} />
          )}
        </main>
      </div>
      {notice && <div role={noticeType === "error" ? "alert" : "status"} className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border bg-[#0b1626] px-4 py-3 text-sm shadow-lg ${noticeType === "error" ? "border-rose-400/30 text-rose-300" : "border-emerald-400/30 text-emerald-300"}`}><CheckCircle2 size={17} />{notice}</div>}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            tabIndex="-1"
            className="w-full max-w-md rounded-lg border border-white/10 bg-[#0b1626] p-6 text-slate-100 shadow-2xl"
          >
            <h2 id="admin-confirm-title" className="text-lg font-bold text-white">
              {confirm.action === "approve-withdrawal" ? "Approve and complete withdrawal" : confirm.action === "withdrawal-decision" ? `${confirm.payload.nextStatus === "approved" ? "Approve" : "Reject"} withdrawal request` : confirm.action === "review" ? "Update record status" : confirm.action === "settle-deposit" ? "Credit offline payment" : confirm.action === "retry-deposit-email" ? "Retry deposit confirmation email" : confirm.action === "delete-deposit" ? "Delete deposit request" : confirm.action === "delete-withdrawal" ? "Delete withdrawal request" : confirm.action === "disable-user" ? (confirm.payload.disabled ? "Enable user access" : "Disable user access") : confirm.action === "set-role" ? "Change user role" : confirm.action === "delete-user" ? "Permanently delete user" : confirm.action === "update-package" ? "Edit investment package" : "Create investment package"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {confirm.action === "approve-withdrawal"
                ? "This action completes the withdrawal, updates the balance and ledger, and sends the success email. Only continue after you have sent the payout externally."
                : confirm.action === "withdrawal-decision"
                ? `Confirm that you want to ${confirm.payload.nextStatus === "approved" ? "approve" : "reject"} this withdrawal request.`
                : ["delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action)
                ? "To confirm this deletion, re-enter your administrator password. The action will be recorded in the audit history."
                : "Re-enter your administrator password to confirm. This action will be recorded in the audit history."}
            </p>
            {confirm.action === "delete-deposit" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Delete deposit request</p>
                <p>Requester: {confirm.payload.profileEmail || "No email"} · @{confirm.payload.profileUsername || "No username"}</p>
                <p>This removes only the request. It cannot be undone and does not change any balance or ledger history. Approved or credited requests are locked.</p>
                <label className="block font-semibold">
                  Type DELETE DEPOSIT to confirm
                  <input value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-300/20" />
                </label>
              </div>
            ) : confirm.action === "delete-withdrawal" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Delete withdrawal request</p>
                <p>Requester: {confirm.payload.profileEmail || confirm.payload.email || "No email"} · @{confirm.payload.profileUsername || confirm.payload.username || "No username"}</p>
                <p>This removes only the request and cannot be undone. Paid or settled withdrawals are locked. The deletion is recorded in the audit history.</p>
                <label className="block font-semibold">
                  Type DELETE WITHDRAWAL to confirm
                  <input value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-300/20" />
                </label>
              </div>
            ) : confirm.action === "settle-deposit" ? (
              <div className="mt-5 space-y-3 rounded-md border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <p className="font-bold">Offline confirmation required</p>
                <p>The user must have paid outside the website. Enter only the amount you personally confirmed. This immediately adds it to the user's available balance and cannot be credited twice.</p>
                <p className="text-xs text-emerald-200/80">Payment method: {confirm.payload.method || confirm.payload.asset || "Not recorded"} · Balance currency: USD</p>
                <label className="block font-semibold">
                  Amount received (USD)
                  <input type="number" min="0.01" step="0.01" value={actionForm.amount} onChange={(event) => setActionForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 font-normal text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20" />
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
                <p className="break-all font-mono text-xs leading-5">{confirm.payload.wallet || "No destination wallet was saved on this request."}</p>
                <label className="flex items-start gap-2 pt-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={actionForm.payoutConfirmed}
                    onChange={(event) => setActionForm((current) => ({ ...current, payoutConfirmed: event.target.checked }))}
                    className="mt-1 accent-emerald-300"
                  />
                  <span>I have already sent the payout to the wallet address shown above.</span>
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
                  className="mt-2 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
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
                  ["returnRate", "Return rate (%)", "number"],
                  ["duration", "Duration", "text"],
                ].map(([field, label, type]) => (
                  <label key={field} className="text-sm font-semibold text-slate-200">
                    {label}
                    <input
                      type={type}
                      value={actionForm[field]}
                      onChange={(event) => setActionForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                    />
                  </label>
                ))}
                <div className="rounded-md border border-sky-400/25 bg-sky-400/10 p-4">
                  <p className="text-sm font-bold text-sky-100">Crypto trading allocation (USD)</p>
                  <p className="mt-1 text-xs text-sky-200/80">This package controls which crypto positions are assigned when a member deposit using this package is credited.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["BTC", "paperBTC"],
                      ["ETH", "paperETH"],
                      ["LTC", "paperLTC"],
                      ["BNB", "paperBNB"],
                    ].map(([currency, field]) => (
                      <label className="text-sm font-semibold text-slate-200" key={currency}>
                        {currency}
                        <input type="number" min="0" step="0.01" value={actionForm[field]} onChange={(event) => setActionForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20" />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : confirm.action === "delete-user" ? (
              <div className="mt-5 space-y-3 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-100">
                <p className="font-bold">Permanent deletion</p>
                <p className="break-all font-semibold">{confirm.payload.email || confirm.payload.displayName || confirm.payload.id}</p>
                <p>This permanently deletes the Firebase account, profile, and all nested profile records. This cannot be undone.</p>
                <label className="block font-semibold">
                  Type DELETE USER to confirm
                  <input value={actionForm.confirmation} onChange={(event) => setActionForm((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="off" className="mt-1 w-full rounded-md border border-rose-400/40 bg-[#081321] px-3 py-2 font-normal text-white outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-300/20" />
                </label>
              </div>
            ) : <p className={`mt-5 rounded-md p-3 text-sm ${confirm.action === "disable-user" && confirm.payload.disabled ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{confirm.action === "set-role" ? "This changes Firebase custom claims and the profile role. The target must sign in again." : confirm.payload.disabled ? "This restores the target Firebase account and allows the user to sign in again." : "This disables the target Firebase account and its access until an administrator enables it."}</p>}
            {!(confirm.action === "review" && confirm.payload.resource === "withdrawals")
              && !["approve-withdrawal", "withdrawal-decision", "delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action) && (
              <label className="mt-4 block text-sm font-semibold text-slate-200">
                Reason (required)
                <textarea value={actionForm.reason} onChange={(event) => setActionForm((current) => ({ ...current, reason: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
              </label>
            )}
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Re-enter administrator password
              <input type="password" autoComplete="current-password" value={actionForm.password} onChange={(event) => setActionForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button disabled={actionSubmitting} onClick={() => setConfirm(null)} className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
              <button onClick={confirmAction} disabled={actionSubmitting || (confirm.action === "review" && confirm.payload.resource !== "withdrawals" && actionForm.reason.trim().length < 10) || (!["review", "approve-withdrawal", "withdrawal-decision", "delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action) && actionForm.reason.trim().length < 10) || !actionForm.password || (confirm.action === "approve-withdrawal" && !actionForm.payoutConfirmed) || (confirm.action === "settle-deposit" && !(Number(actionForm.amount) > 0)) || (confirm.action === "delete-user" && actionForm.confirmation !== "DELETE USER") || (confirm.action === "delete-deposit" && actionForm.confirmation !== "DELETE DEPOSIT") || (confirm.action === "delete-withdrawal" && actionForm.confirmation !== "DELETE WITHDRAWAL") || (["create", "update-package"].includes(confirm.action) && ![actionForm.paperBTC, actionForm.paperETH, actionForm.paperLTC, actionForm.paperBNB].some((amount) => Number(amount) > 0))} className={`rounded-md px-4 py-2 text-sm font-semibold ${["delete-user", "delete-deposit", "delete-withdrawal"].includes(confirm.action) ? "bg-rose-500 text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50" : "bg-sky-300 text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"}`}>{actionSubmitting ? "Processing…" : confirm.action === "approve-withdrawal" ? "Approve and complete" : confirm.action === "withdrawal-decision" ? (confirm.payload.nextStatus === "approved" ? "Approve request" : "Reject request") : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
