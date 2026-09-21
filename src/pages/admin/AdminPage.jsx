import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity, ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package,
  ExternalLink, RefreshCw, Search, ShieldCheck, TrendingUp, UserRound, Users, WalletCards, X,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { getAdminResource, requestAdminAction, reauthenticateAdmin } from "../../lib/adminApi";
import { clearAdminLoginSession } from "../../lib/adminSession";
import FeedbackMessage from "../../components/ui/FeedbackMessage";

const nav = [
  ["/control-room", "Overview", LayoutDashboard],
  ["/control-room/users", "Users", Users],
  ["/control-room/deposits", "Deposits", ArrowDownToLine],
  ["/control-room/withdrawals", "Withdrawals", ArrowUpRight],
  ["/control-room/support", "Support tickets", CircleHelp],
  ["/control-room/transactions", "Transactions", WalletCards],
  ["/control-room/packages", "Packages", Package],
  ["/control-room/referrals", "Referrals", TrendingUp],
  ["/control-room/audit", "Audit history", ClipboardList],
];

const resources = {
  users: ["Users", "Review accounts, verification and access."],
  deposits: ["Deposits", "Review incoming funds before they are credited."],
  withdrawals: ["Withdrawals", "Approve or hold outgoing payment requests."],
  support: ["Support tickets", "Keep customer conversations moving."],
  transactions: ["Transactions & investments", "Trace money movement and active investments."],
  packages: ["Investment packages", "Manage the offers displayed to members."],
  referrals: ["Referrals", "Track attribution and referral rewards."],
  audit: ["Audit history", "A read-only trail of privileged activity."],
};

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
    getAdminResource("transactions")
      .then((rows) => {
        if (!active) return;
        const match = rows.find(
          (row) =>
            row.userId === userId &&
            row.id === transactionId &&
            (!collection || row.collection === collection),
        );
        if (!match) {
          setError("The requested transaction could not be found.");
          return;
        }
        setTransaction(match);
      })
      .catch((reason) => active && setError(reason.message || "Unable to load transaction details."));
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
    getAdminResource("support")
      .then((rows) => {
        if (!active) return;
        const match = rows.find((row) => row.userId === userId && row.id === ticketId);
        if (!match) {
          setError("The requested support ticket could not be found.");
          return;
        }
        setTicket(match);
      })
      .catch((reason) => active && setError(reason.message || "Unable to load support ticket details."));
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

function Overview() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminResource("users")
      .then((data) => active && setUsers(data))
      .catch((reason) => active && setError(reason.message || "Unable to load user activity."));
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
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Recent users</h2><p className="mt-1 text-sm text-slate-400">The latest profiles returned from Firebase.</p></div><Users size={19} className="text-slate-400" /></div><div className="mt-5 divide-y divide-white/10">{users?.slice(0, 5).map((user) => <div className="flex items-center justify-between gap-4 py-3" key={user.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{user.displayName || user.username || user.email || user.id}</p><p className="truncate text-xs text-slate-400">{user.email || "No email recorded"}</p></div><Status>{user.status || "Active"}</Status></div>) || <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">{error ? "User activity unavailable." : "Loading user activity…"}</div>}{users?.length === 0 && <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.03] text-sm text-slate-400">No user profiles found.</div>}</div></section>
        <section className="rounded-lg border border-white/10 bg-[#0b1626] p-5 shadow-[0_18px_50px_rgba(2,8,23,0.22)]"><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Admin safeguards</h2><ShieldCheck size={19} className="text-emerald-300" /></div><div className="mt-4 space-y-2 text-sm text-slate-300"><p className="rounded-md bg-white/[0.04] p-3">Admin sign-in is separate from member authentication.</p><p className="rounded-md bg-white/[0.04] p-3">User data stays protected by Firestore rules.</p><p className="rounded-md bg-white/[0.04] p-3">Financial actions remain disabled until a trusted admin API is connected.</p></div></section>
      </div>
    </div>
  );
}

function PackageWorkspace({ refreshKey, onRefresh }) {
  const [users, setUsers] = useState(null);
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
    Promise.all([getAdminResource("users"), getAdminResource("packages")])
      .then(([userRows, packageRows]) => {
        if (!active) return;
        setUsers(userRows);
        setPackages(packageRows);
      })
      .catch((error) => active && setStatus({ type: "error", message: error.message || "Unable to load users and packages." }));
    return () => { active = false; };
  }, [refreshKey]);

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
      setStatus({ type: "success", message: "Paper-trading assignment saved successfully. The selected user's Crypto Position is now updated." });
      setPassword("");
    } catch (error) {
      setStatus({ type: "error", message: error.message || "The paper-trading allocation could not be saved." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Investment packages</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Package investment workspace</h1>
        <p className="mt-1 text-sm text-slate-400">Select a member, choose a package, and assign their BTC, ETH, LTC or BNB paper-trading capital.</p>
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
                <p className="mt-1 text-[11px] text-slate-500">Active deposit: ${Number(user.activeDeposit || user.totalDeposit || 0).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </section>
        <section className="min-w-0 rounded-lg border border-white/10 bg-[#0b1626] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)] sm:p-5">
          <h2 className="font-semibold text-white">Paper-trading assignment</h2>
          <p className="mt-1 text-sm text-slate-400">{selectedUser ? `Editing ${selectedUser.displayName || selectedUser.email || selectedUser.id}` : "Select a member to begin."}</p>
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
          <button onClick={saveAllocation} disabled={saving || !selectedUser || reason.trim().length < 10 || !password || !Object.values(allocations).some((amount) => Number(amount) > 0)} className="mt-5 w-full rounded-md bg-sky-300 px-4 py-3 text-sm font-bold text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving assignment…" : "Save paper-trading assignment"}</button>
        </section>
      </div>
    </div>
  );
}

function ResourcePage({ resource, onAction, refreshKey, onRefresh }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    getAdminResource(resource).then((data) => active && setRows(data)).catch((reason) => active && setError(reason.message || "The Firebase admin API is unavailable."));
    return () => { active = false; };
  }, [resource, refreshKey]);
  const searchableRows = useMemo(
    () =>
      (rows || []).map((row) => ({
        ...row,
        __searchText: Object.values(row).join(" ").toLowerCase(),
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
      <div><p className="text-xs font-bold uppercase tracking-widest text-sky-300">Resource management</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1><p className="mt-1 text-sm text-slate-400">{description}</p></div>
      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1626] shadow-[0_18px_50px_rgba(2,8,23,0.22)]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"><div className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-2.5 text-slate-500" /><input aria-label={`Search ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title}`} className="w-full rounded-md border border-white/10 bg-[#081321] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/15" /></div><span className="text-xs font-medium text-slate-400">{error ? "Unavailable" : `${filtered.length.toLocaleString()} of ${(rows || []).length.toLocaleString()} records`}</span></div><div className="flex items-center gap-2"><button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06]"><RefreshCw size={15} />Refresh</button>{resource === "packages" && <button onClick={() => onAction("create", {})} className="rounded-md bg-sky-300 px-3 py-2 text-sm font-semibold text-[#081321] hover:bg-sky-200">New package</button>}</div></div>
        {error ? (
          <div className="p-6">
            <FeedbackMessage type="error">{error}</FeedbackMessage>
          </div>
        ) : !rows ? <div className="p-12 text-center text-sm text-slate-400">Loading live {title.toLowerCase()}…</div> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.04]"><tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3 font-bold">Record</th><th className="px-5 py-3 font-bold">Details</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3" /></tr></thead><tbody>{filtered.map((row) => { const isDisabled = row.disabled === true || row.authDisabled === true || row.status === "Disabled"; const isAdmin = row.role === "admin"; const canManageAuth = resource !== "users" || row.authAccount === true;                         const actionPayload = { ...row, userId: resource === "users" ? (row.authUid || row.id) : row.userId, profileId: resource === "users" ? row.id : row.userId }; const depositStatus = String(row.status || "pending").toLowerCase(); const canDeleteDeposit = resource === "deposits" && !["approved", "completed", "settled", "credited"].includes(depositStatus) && !row.settlementId; return <tr className="border-b border-white/10 text-slate-300 last:border-0 hover:bg-white/[0.03]" key={row.id}><td className="px-5 py-4 font-semibold text-white">{row.id}</td><td className="max-w-xl px-5 py-4 text-xs">{resource === "deposits" && <div className="mb-2 grid gap-1 text-[11px]"><span><strong className="text-slate-200">Email:</strong> {row.profileEmail || row.email || "—"}</span><span><strong className="text-slate-200">Username:</strong> {row.profileUsername || row.username || "—"}</span></div>}{Object.entries(row).filter(([key]) => !["id", "__searchText", "authUid", "profileEmail", "profileUsername"].includes(key)).slice(0, 5).map(([key, value]) => <span className="mr-3 inline-block" key={key}><strong className="text-slate-200">{key}:</strong> {String(value ?? "—")}</span>)}{resource === "users" && !canManageAuth && <span className="mt-2 block text-amber-300">Firestore profile only — no Firebase Auth account</span>}</td><td className="px-5 py-4"><Status>{row.status || (canManageAuth ? (isDisabled ? "Suspended" : "Active") : "Profile only")}</Status></td><td className="px-5 py-4">{resource === "users" ? <div className="flex justify-end gap-3"><button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} aria-label={`${isAdmin ? "Remove admin access from" : "Grant admin access to"} ${row.email || row.id}`} onClick={() => onAction("set-role", { ...actionPayload, role: isAdmin ? "member" : "admin" })} className="text-xs font-bold text-slate-200 hover:text-white disabled:cursor-not-allowed disabled:text-slate-600">{isAdmin ? "Remove admin" : "Grant admin"}</button><button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} aria-label={`${isDisabled ? "Enable" : "Disable"} ${row.email || row.id}`} onClick={() => onAction("disable-user", { ...actionPayload, disabled: !isDisabled })} className={`text-xs font-bold ${isDisabled ? "text-emerald-300 hover:text-emerald-200" : "text-rose-300 hover:text-rose-200"} disabled:cursor-not-allowed disabled:text-slate-600`}>{isDisabled ? "Enable" : "Disable"}</button>                <button disabled={!canManageAuth} title={!canManageAuth ? "No Firebase Authentication account exists for this profile" : undefined} onClick={() => onAction("delete-user", actionPayload)} className="text-xs font-bold text-rose-300 hover:text-rose-200 disabled:cursor-not-allowed disabled:text-slate-600">Delete</button></div> : resource === "deposits" ? <div className="flex justify-end gap-3">{["pending", "approved"].includes(depositStatus) && <button onClick={() => onAction("settle-deposit", actionPayload)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">Credit offline payment</button>}{["pending", "rejected", "cancelled"].includes(depositStatus) && <button onClick={() => onAction("review", row)} className="text-xs font-bold text-slate-200 hover:text-white">Review</button>}{canDeleteDeposit && <button onClick={() => onAction("delete-deposit", actionPayload)} className="text-xs font-bold text-rose-300 hover:text-rose-200">Delete request</button>}</div>                 : resource === "transactions" ? <a href={`/control-room/transactions/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}?collection=${encodeURIComponent(row.collection || "transactions")}`} target="_blank" rel="noreferrer" className="float-right inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200">View details <ExternalLink size={13} /></a> : resource === "support" ? <a href={`/control-room/support/${encodeURIComponent(row.userId)}/${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer" className="float-right inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200">View details <ExternalLink size={13} /></a>         : resource === "packages" ? <button onClick={() => onAction("update-package", row)} className="float-right text-xs font-bold text-slate-200 hover:text-white">Edit package <ChevronRight size={14} className="inline" /></button> : resource !== "audit" && <button onClick={() => onAction("review", row)} className="float-right text-xs font-bold text-slate-200 hover:text-white">Review <ChevronRight size={14} className="inline" /></button>}</td></tr>; })}</tbody></table></div> : <div className="p-12 text-center text-sm text-slate-400"><FileText className="mx-auto mb-3 text-slate-500" />No records found.</div>}
      </section>
    </div>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const { user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState(null);
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
  const transactionDetails = resource === "transactions" && pathParts.length >= 4;
  const transactionUserId = transactionDetails ? decodeURIComponent(pathParts[2]) : "";
  const transactionId = transactionDetails ? decodeURIComponent(pathParts[3]) : "";
  const transactionCollection = new URLSearchParams(location.search).get("collection") || "";
  const supportDetails = resource === "support" && pathParts.length >= 4;
  const supportUserId = supportDetails ? decodeURIComponent(pathParts[2]) : "";
  const supportTicketId = supportDetails ? decodeURIComponent(pathParts[3]) : "";

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
    const payload =
      confirm.action === "review"
        ? { ...confirm.payload, nextStatus: actionForm.status, reason: actionForm.reason }
        : confirm.action === "settle-deposit"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              amount: Number(actionForm.amount),
              currency: actionForm.currency,
              reason: actionForm.reason,
            }
        : confirm.action === "delete-deposit"
          ? {
              profileId: confirm.payload.profileId || confirm.payload.userId,
              depositId: confirm.payload.id,
              profileEmail: confirm.payload.profileEmail,
              profileUsername: confirm.payload.profileUsername,
              confirmation: actionForm.confirmation,
              reason: actionForm.reason,
            }
        : confirm.action === "disable-user"
          ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, reason: actionForm.reason, disabled: confirm.payload.disabled === true }
          : confirm.action === "set-role"
            ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, role: confirm.payload.role, reason: actionForm.reason }
            : confirm.action === "delete-user"
              ? { userId: confirm.payload.userId || confirm.payload.id, profileId: confirm.payload.profileId || confirm.payload.id, reason: actionForm.reason, confirmation: actionForm.confirmation }
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
      await reauthenticateAdmin(actionForm.password);
      await requestAdminAction(confirm.action, payload);
      setRefreshKey((current) => current + 1);
      showNotice("success", "Admin request completed successfully.");
      completed = true;
    } catch (error) {
      showNotice(
        "error",
        error instanceof Error ? error.message : "The admin request failed.",
      );
    } finally {
      if (completed) setConfirm(null);
    }
  }
  const onAction = (action, payload) => {
    clearNoticeTimeout();
    setNotice("");
    setActionForm({
      status: payload.status === "pending" ? "approved" : payload.status || "approved",
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
      paperBTC: String(payload.paperTrading?.allocations?.BTC || ""),
      paperETH: String(payload.paperTrading?.allocations?.ETH || ""),
      paperLTC: String(payload.paperTrading?.allocations?.LTC || ""),
      paperBNB: String(payload.paperTrading?.allocations?.BNB || ""),
    });
    setConfirm({ action, payload });
  };
  return (
    <div className="min-h-screen bg-[#07111d] text-slate-100">
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-[#0b1626] transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5"><Link to="/control-room" className="flex items-center gap-2"><img src="/meridianvest-logo.svg" className="h-8 w-8" alt="MeridianVests" /><span className="text-sm font-bold text-white">MeridianVests <span className="font-normal text-slate-400">Admin</span></span></Link><button className="text-slate-400 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
        <nav className="space-y-1 p-3">{nav.map(([path, label, Icon]) => <Link onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${location.pathname === path ? "bg-sky-300 text-[#081321] shadow-sm" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`} to={path} key={path}><Icon size={17} />{label}</Link>)}</nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4"><div className="flex items-center gap-2"><span className="rounded-full bg-white/10 p-2 text-slate-300"><UserRound size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-100">{user?.displayName || "Administrator"}</p><p className="truncate text-[11px] text-slate-400">{user?.email || "Verified admin"}</p></div><button title="Sign out" aria-label="Sign out" onClick={() => { clearAdminLoginSession(); signOutUser(); }} className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300"><LogOut size={16} /></button></div></div>
      </aside>
      <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b1626]/95 px-4 sm:px-7"><button className="text-slate-300 hover:text-white lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-300"><ShieldCheck size={16} className="text-emerald-300" />Firebase admin console</div></header><main className="mx-auto max-w-[1500px] p-4 sm:p-7"><div className="mb-5 flex items-center gap-2 text-xs text-slate-400"><Link to="/control-room" className="hover:text-white">Admin</Link><ChevronRight size={13} /> <span>{transactionDetails ? "Transaction details" : supportDetails ? "Support ticket details" : resource === "overview" ? "Overview" : resources[resource]?.[0] || "Overview"}</span></div>{transactionDetails ? <TransactionDetails userId={transactionUserId} transactionId={transactionId} collection={transactionCollection} /> : supportDetails ? <SupportDetails userId={supportUserId} ticketId={supportTicketId} /> : resource === "overview" ? <Overview /> : resource === "packages" ?             <PackageWorkspace refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} /> : resources[resource] ?       <ResourcePage resource={resource} onAction={onAction} refreshKey={refreshKey} onRefresh={() => setRefreshKey((current) => current + 1)} /> : <Overview />}</main></div>
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
              {confirm.action === "review" ? "Update record status" : confirm.action === "settle-deposit" ? "Credit offline payment" : confirm.action === "delete-deposit" ? "Delete deposit request" : confirm.action === "disable-user" ? (confirm.payload.disabled ? "Enable user access" : "Disable user access") : confirm.action === "set-role" ? "Change user role" : confirm.action === "delete-user" ? "Permanently delete user" : confirm.action === "update-package" ? "Edit investment package" : "Create investment package"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This request will be validated and recorded by the secure Firebase admin API.
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
            ) : confirm.action === "review" ? (
              <label className="mt-5 block text-sm font-semibold text-slate-200">
                New status
                <select
                  value={actionForm.status}
                  onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                >
                  {["pending", "approved", "rejected", "on-hold", "open", "closed", "resolved"].map((status) => (
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
                  <p className="text-sm font-bold text-sky-100">Paper-trading allocation (USD)</p>
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
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Reason (required)
              <textarea value={actionForm.reason} onChange={(event) => setActionForm((current) => ({ ...current, reason: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-200">
              Re-enter administrator password
              <input type="password" autoComplete="current-password" value={actionForm.password} onChange={(event) => setActionForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-md border border-white/15 bg-[#081321] px-3 py-2 text-sm font-normal text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirm(null)} className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white">Cancel</button>
              <button onClick={confirmAction} disabled={!actionForm.reason.trim() || !actionForm.password || (confirm.action === "settle-deposit" && !(Number(actionForm.amount) > 0)) || (confirm.action === "delete-user" && actionForm.confirmation !== "DELETE USER") || (confirm.action === "delete-deposit" && actionForm.confirmation !== "DELETE DEPOSIT") || (["create", "update-package"].includes(confirm.action) && ![actionForm.paperBTC, actionForm.paperETH, actionForm.paperLTC, actionForm.paperBNB].some((amount) => Number(amount) > 0))} className={`rounded-md px-4 py-2 text-sm font-semibold ${["delete-user", "delete-deposit"].includes(confirm.action) ? "bg-rose-500 text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50" : "bg-sky-300 text-[#081321] hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
