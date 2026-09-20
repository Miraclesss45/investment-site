import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity, ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronRight,
  CircleHelp, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Package,
  Search, ShieldCheck, TrendingUp, UserRound, Users, WalletCards, X,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { getAdminResource, requestAdminAction, reauthenticateAdmin } from "../../lib/adminApi";
import { clearAdminLoginSession } from "../../lib/adminSession";

const nav = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/users", "Users", Users],
  ["/admin/deposits", "Deposits", ArrowDownToLine],
  ["/admin/withdrawals", "Withdrawals", ArrowUpRight],
  ["/admin/support", "Support tickets", CircleHelp],
  ["/admin/transactions", "Transactions", WalletCards],
  ["/admin/packages", "Packages", Package],
  ["/admin/referrals", "Referrals", TrendingUp],
  ["/admin/audit", "Audit history", ClipboardList],
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
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Open: "bg-blue-50 text-blue-700 ring-blue-600/20",
    Pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    Review: "bg-amber-50 text-amber-700 ring-amber-600/20",
    Suspended: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  return <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${tones[children] || "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>{children || "—"}</span>;
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}<Icon size={17} className="text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
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
      <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Operations</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Platform overview</h1><p className="mt-1 text-sm text-slate-500">Monitor account activity and operational queues.</p></div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} Check that the admin data endpoint is available and your Firestore rules permit the intended admin access.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active users" value={formatMetric(activeUsers)} detail="Current Firebase profiles" icon={Users} />
        <Metric label="Verified users" value={formatMetric(verifiedUsers)} detail="Profiles marked verified" icon={CheckCircle2} />
        <Metric label="Needs review" value={formatMetric(pendingUsers)} detail="Pending or review status" icon={ClipboardList} />
        <Metric label="Last refresh" value={users ? "Just now" : "Loading"} detail="Live users collection" icon={Activity} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Recent users</h2><p className="mt-1 text-sm text-slate-500">The latest profiles returned from Firebase.</p></div><Users size={19} className="text-slate-400" /></div><div className="mt-5 divide-y divide-slate-100">{users?.slice(0, 5).map((user) => <div className="flex items-center justify-between gap-4 py-3" key={user.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.displayName || user.username || user.email || user.id}</p><p className="truncate text-xs text-slate-500">{user.email || "No email recorded"}</p></div><Status>{user.status || "Active"}</Status></div>) || <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">Loading user activity…</div>}{users?.length === 0 && <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">No user profiles found.</div>}</div></section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Admin safeguards</h2><ShieldCheck size={19} className="text-emerald-600" /></div><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="rounded-md bg-slate-50 p-3">Admin sign-in is separate from member authentication.</p><p className="rounded-md bg-slate-50 p-3">User data stays protected by Firestore rules.</p><p className="rounded-md bg-slate-50 p-3">Financial actions remain disabled until a trusted admin API is connected.</p></div></section>
      </div>
    </div>
  );
}

function ResourcePage({ resource, onAction }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    getAdminResource(resource).then((data) => active && setRows(data)).catch((reason) => active && setError(reason.message || "The Firebase admin API is unavailable."));
    return () => { active = false; };
  }, [resource]);
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
      <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Resource management</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input aria-label={`Search ${title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title}`} className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" /></div>{resource === "packages" && <button onClick={() => onAction("create", {})} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">New package</button>}</div>
        {error ? <div role="alert" className="p-12 text-center text-sm text-rose-700"><CircleHelp className="mx-auto mb-3" />{error}</div> : !rows ? <div className="p-12 text-center text-sm text-slate-500">Loading live {title.toLowerCase()}…</div> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-bold">Record</th><th className="px-5 py-3 font-bold">Details</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3" /></tr></thead><tbody>{filtered.map((row) => <tr className="border-b border-slate-100 text-slate-600 last:border-0 hover:bg-slate-50" key={row.id}><td className="px-5 py-4 font-semibold text-slate-900">{row.id}</td><td className="max-w-xl px-5 py-4 text-xs">{Object.entries(row).filter(([key]) => key !== "id" && key !== "__searchText").slice(0, 5).map(([key, value]) => <span className="mr-3 inline-block" key={key}><strong className="text-slate-700">{key}:</strong> {String(value ?? "—")}</span>)}</td><td className="px-5 py-4"><Status>{row.status}</Status></td><td className="px-5 py-4">{resource === "users" ? <div className="flex justify-end gap-3"><button onClick={() => onAction("set-role", { ...row, role: row.role === "admin" ? "member" : "admin" })} className="text-xs font-bold text-slate-700 hover:text-slate-950">Make {row.role === "admin" ? "member" : "admin"}</button><button onClick={() => onAction("disable-user", row)} className="text-xs font-bold text-rose-700 hover:text-rose-950">Disable</button></div> : resource !== "audit" && <button onClick={() => onAction("review", row)} className="float-right text-xs font-bold text-slate-700 hover:text-slate-950">Review <ChevronRight size={14} className="inline" /></button>}</td></tr>)}</tbody></table></div> : <div className="p-12 text-center text-sm text-slate-500"><FileText className="mx-auto mb-3 text-slate-300" />No records found.</div>}
      </section>
    </div>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const { user, signOutUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [actionForm, setActionForm] = useState({
    status: "approved",
    name: "",
    description: "",
    minimum: "",
    maximum: "",
    returnRate: "",
    duration: "",
    reason: "",
    password: "",
  });
  const resource = location.pathname.split("/")[2] || "overview";
  async function confirmAction() {
    const payload =
      confirm.action === "review"
        ? { ...confirm.payload, nextStatus: actionForm.status, reason: actionForm.reason }
        : confirm.action === "disable-user"
          ? { userId: confirm.payload.id, reason: actionForm.reason, disabled: true }
          : confirm.action === "set-role"
            ? { userId: confirm.payload.id, role: confirm.payload.role, reason: actionForm.reason }
        : {
            name: actionForm.name.trim(),
            description: actionForm.description.trim(),
            minimum: Number(actionForm.minimum),
            maximum: Number(actionForm.maximum),
            returnRate: Number(actionForm.returnRate),
            duration: actionForm.duration.trim(),
            reason: actionForm.reason,
          };
    try {
      await reauthenticateAdmin(actionForm.password);
      await requestAdminAction(confirm.action, payload);
      setNotice("Admin request completed successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The admin request failed.");
    } finally {
      setConfirm(null);
      window.setTimeout(() => setNotice(""), 3500);
    }
  }
  const onAction = (action, payload) => {
    setActionForm({
      status: payload.status === "pending" ? "approved" : payload.status || "approved",
      name: "",
      description: "",
      minimum: "",
      maximum: "",
      returnRate: "",
      duration: "",
      reason: "",
      password: "",
    });
    setConfirm({ action, payload });
  };
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-slate-50 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5"><Link to="/admin" className="flex items-center gap-2"><img src="/meridianvest-logo.svg" className="h-8 w-8" alt="MeridianVests" /><span className="text-sm font-bold text-slate-900">MeridianVests <span className="font-normal text-slate-500">Admin</span></span></Link><button className="text-slate-500 lg:hidden" onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
        <nav className="space-y-1 p-3">{nav.map(([path, label, Icon]) => <Link onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${location.pathname === path ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200 hover:text-slate-950"}`} to={path} key={path}><Icon size={17} />{label}</Link>)}</nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4"><div className="flex items-center gap-2"><span className="rounded-full bg-slate-200 p-2 text-slate-600"><UserRound size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{user?.displayName || "Administrator"}</p><p className="truncate text-[11px] text-slate-500">{user?.email || "Verified admin"}</p></div><button title="Sign out" onClick={() => { clearAdminLoginSession(); signOutUser(); }} className="text-slate-500 hover:text-slate-900"><LogOut size={16} /></button></div></div>
      </aside>
      <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7"><button className="text-slate-600 lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500"><ShieldCheck size={16} className="text-emerald-600" />Firebase admin console</div></header><main className="mx-auto max-w-[1500px] p-4 sm:p-7"><div className="mb-5 flex items-center gap-2 text-xs text-slate-500"><Link to="/admin" className="hover:text-slate-900">Admin</Link><ChevronRight size={13} /> <span>{resource === "overview" ? "Overview" : resources[resource]?.[0] || "Overview"}</span></div>{resource === "overview" ? <Overview /> : resources[resource] ? <ResourcePage resource={resource} onAction={onAction} /> : <Overview />}</main></div>
      {notice && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700 shadow-lg"><CheckCircle2 size={17} />{notice}</div>}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-950">
              {confirm.action === "review" ? "Update record status" : confirm.action === "disable-user" ? "Disable user access" : confirm.action === "set-role" ? "Change user role" : "Create investment package"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This request will be validated and recorded by the secure Firebase admin API.
            </p>
            {confirm.action === "review" ? (
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                New status
                <select
                  value={actionForm.status}
                  onChange={(event) => setActionForm((current) => ({ ...current, status: event.target.value }))}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {["pending", "approved", "rejected", "on-hold", "open", "closed", "resolved"].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            ) : confirm.action === "create" ? (
              <div className="mt-5 grid gap-3">
                {[
                  ["name", "Package name", "text"],
                  ["description", "Description", "text"],
                  ["minimum", "Minimum amount", "number"],
                  ["maximum", "Maximum amount", "number"],
                  ["returnRate", "Return rate (%)", "number"],
                  ["duration", "Duration", "text"],
                ].map(([field, label, type]) => (
                  <label key={field} className="text-sm font-semibold text-slate-700">
                    {label}
                    <input
                      type={type}
                      value={actionForm[field]}
                      onChange={(event) => setActionForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                ))}
              </div>
            ) : <p className="mt-5 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{confirm.action === "set-role" ? "This changes Firebase custom claims and the profile role. The target must sign in again." : "This disables the target Firebase account and its access. It cannot be undone casually."}</p>}
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason (required)
              <textarea value={actionForm.reason} onChange={(event) => setActionForm((current) => ({ ...current, reason: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Re-enter administrator password
              <input type="password" autoComplete="current-password" value={actionForm.password} onChange={(event) => setActionForm((current) => ({ ...current, password: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirm(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmAction} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
