import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCheck,
  CircleHelp,
  LoaderCircle,
  MessageCircle,
  Search,
} from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { getSafeErrorMessage } from "../../lib/authHelpers";
import {
  sendAdminMessage,
  setConversationArchived,
  SUPPORT_CONVERSATION_STATUSES,
  updateConversationStatus,
} from "../../lib/supportChat";
import SupportChatComposer from "../../components/support/SupportChatComposer";
import SupportChatThread from "../../components/support/SupportChatThread";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

function formatTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status) {
  if (status === "resolved" || status === "closed") return "border-slate-500/30 bg-slate-400/10 text-slate-300";
  if (status === "waiting") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  if (status === "in_progress") return "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200";
  return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200";
}

export default function AdminSupportChat({ archiveView = false, sharedConversations = null, sharedError = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversations = sharedConversations;
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (conversations || []).filter((item) => {
      const archived = item.archived === true;
      const matchesFilter = archiveView
        ? archived
        : !archived && (filter === "all"
          || (filter === "unread" ? Number(item.unreadForAgent || 0) > 0 : item.status === filter));
      const text = [item.userName, item.userEmail, item.userId, item.lastMessage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!normalized || text.includes(normalized));
    });
  }, [archiveView, conversations, filter, query]);

  useEffect(() => {
    if (archiveView) {
      if (!filtered.some((item) => item.id === selectedId)) setSelectedId("");
      return;
    }
    if (!filtered.length) {
      setSelectedId("");
      return;
    }
    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(archiveView || isMobile ? "" : filtered[0].id);
    }
  }, [archiveView, filtered, isMobile, selectedId]);

  const selected = conversations?.find((item) => item.id === selectedId) || null;
  const unreadTotal = (conversations || []).reduce((sum, item) => (
    item.archived === true ? sum : sum + (Number(item.unreadForAgent) || 0)
  ), 0);

  async function changeStatus(status) {
    if (!selected || statusSaving || selected.status === status) return;
    setStatusSaving(true);
    setError("");
    try {
      await updateConversationStatus(selected.id, status);
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "The conversation status could not be updated."));
    } finally {
      setStatusSaving(false);
    }
  }

  async function toggleArchive() {
    if (!selected || archiveSaving) return;
    const archive = selected.archived !== true;
    if (archive && !["resolved", "closed"].includes(selected.status)) {
      setError("Resolve or close the conversation before archiving it.");
      return;
    }
    if (archive && !window.confirm(
      `Archive the conversation with ${selected.userName || "this customer"}? Messages will be retained, and you can restore it later.`,
    )) return;

    setArchiveSaving(true);
    setError("");
    try {
      await setConversationArchived(user, selected.id, archive);
      if (archive) {
        setSelectedId("");
        navigate("/control-room/support-chat/archive");
      } else {
        navigate("/control-room/support-chat");
      }
    } catch (reason) {
      setError(getSafeErrorMessage(reason, `The conversation could not be ${archive ? "archived" : "restored"}.`));
    } finally {
      setArchiveSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Member communications</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{archiveView ? "Archived support chats" : "Support chat"}</h1>
          <p className="mt-1 text-sm text-slate-400">{archiveView ? "Browse archived conversations and open their retained message history." : "Reply to customer messages in real time."}</p>
        </div>
        <div className="flex items-center gap-2">
          {archiveView ? (
            <button type="button" onClick={() => navigate("/control-room/support-chat")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/5">
              <ArrowLeft size={14} /> Back to inbox
            </button>
          ) : (
            <button type="button" onClick={() => navigate("/control-room/support-chat/archive")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/5">
              <Archive size={14} /> Archive
            </button>
          )}
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs text-slate-300">
            {archiveView ? <><span className="font-bold text-white">{filtered.length}</span> archived chat{filtered.length === 1 ? "" : "s"}</> : <><span className="font-bold text-white">{unreadTotal}</span> unread message{unreadTotal === 1 ? "" : "s"}</>}
          </div>
        </div>
      </header>

      {(error || sharedError) ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm leading-5 text-rose-200">{error || sharedError}</p> : null}

      <section className="admin-support-workspace grid overflow-hidden rounded-2xl border border-white/10 bg-[#0b1626] shadow-[0_18px_50px_rgba(2,8,23,0.2)] md:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.5fr)]">
        <aside className={`${selectedId ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-white/10`}>
          <div className="space-y-3 border-b border-white/10 p-3 sm:p-4">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search size={15} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, message"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#081321] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />
            </label>
            {!archiveView ? (
              <>
                <label className="sr-only" htmlFor="support-chat-filter">Filter conversations</label>
                <select
                  id="support-chat-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#081321] px-3 text-xs text-slate-200 outline-none focus:border-cyan-300/50"
                >
                  <option value="all">All conversations</option>
                  <option value="unread">Unread</option>
                  {SUPPORT_CONVERSATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </>
              ) : (
                <p className="px-1 text-xs font-semibold text-slate-400">Archived conversations</p>
              )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations === null ? (
              <div className="grid min-h-40 place-items-center text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin" /></div>
            ) : filtered.length ? filtered.map((item) => {
              const unread = item.archived === true ? 0 : Number(item.unreadForAgent || 0);
              const active = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={active ? "true" : undefined}
                  className={`block w-full border-b border-white/[0.06] px-3 py-3 text-left transition sm:px-4 ${
                    active ? "bg-cyan-300/[0.08]" : "hover:bg-white/[0.035]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">{item.userName || "Guest"}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.userEmail || item.userId}</span>
                    </span>
                    {unread ? <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-slate-950">{unread}</span> : null}
                  </span>
                  <span className="mt-2 block truncate text-xs text-slate-300">{item.lastMessage || "No messages yet"}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold ${statusTone(item.status)}`}>{STATUS_LABELS[item.status] || "Open"}</span>
                      {item.archived === true ? <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400"><Archive size={11} /> Archived</span> : null}
                    </span>
                    <time className="truncate text-[10px] text-slate-500">{formatTime(item.lastMessageAt || item.updatedAt)}</time>
                  </span>
                </button>
              );
            }) : (
              <div className="px-5 py-12 text-center">
                <MessageCircle className="mx-auto text-slate-600" size={24} />
                <p className="mt-3 text-sm font-semibold text-slate-300">{error ? "Inbox unavailable" : archiveView ? "No archived conversations" : "No conversations found"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{error ? "Check Firebase access and reload." : archiveView ? "Resolved chats will appear here after they are archived." : "New messages will appear here automatically."}</p>
              </div>
            )}
          </div>
          <p className="border-t border-white/10 px-4 py-2 text-center text-[10px] text-slate-500">
            Showing up to 100 most recently updated conversations
          </p>
        </aside>

        <div className={`${selectedId ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
          {selected ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d1b2b] px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId("")}
                    aria-label="Back to conversations"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-white/10 md:hidden"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-white">{selected.userName || "Guest"}</h2>
                    <a href={`mailto:${encodeURIComponent(selected.userEmail || "")}`} className="block truncate text-[11px] text-cyan-200 hover:text-cyan-100">
                      {selected.userEmail || "No email recorded"}
                    </a>
                    <p className="truncate text-[10px] text-slate-500">
                      {selected.userType === "guest" ? "Guest" : `UID ${selected.userId}`}
                      {selected.userCountry ? ` · ${selected.userCountry}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                    <span className="sr-only">Conversation status</span>
                    <select
                      aria-label="Conversation status"
                      value={selected.status || "open"}
                      disabled={statusSaving || selected.archived === true}
                      onChange={(event) => changeStatus(event.target.value)}
                      className="h-9 max-w-36 rounded-lg border border-white/10 bg-[#081321] px-2 text-xs text-slate-200 outline-none focus:border-cyan-300/50 disabled:opacity-60"
                    >
                      {SUPPORT_CONVERSATION_STATUSES.map((status) => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                    {statusSaving ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  </label>
                  <button
                    type="button"
                    onClick={toggleArchive}
                    disabled={archiveSaving || (
                      selected.archived !== true
                      && !["resolved", "closed"].includes(selected.status)
                    )}
                    title={selected.archived === true
                      ? "Restore this conversation to the active inbox"
                      : "Resolve or close this conversation before archiving"}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {archiveSaving ? <LoaderCircle size={14} className="animate-spin" /> : selected.archived === true ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    {selected.archived === true ? "Restore" : "Archive"}
                  </button>
                </div>
              </header>
              {selected.archived === true ? (
                <div className="border-b border-amber-300/10 bg-amber-300/[0.05] px-4 py-2 text-xs text-amber-100">
                  <p>Archived history is retained. Restore this conversation to reply or return it to the active inbox.</p>
                  {selected.archivedAt ? (
                    <p className="mt-1 text-[10px] text-amber-100/70">
                      Archived {formatTime(selected.archivedAt)} · administrator {selected.archivedBy || "unknown"}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col">
                <SupportChatThread
                  conversationId={selected.id}
                  conversation={selected}
                  user={user}
                  viewerType="agent"
                  showHeader={false}
                />
                {selected.archived === true ? null : (
                  <SupportChatComposer
                    conversationId={selected.id}
                    user={user}
                    onSend={(text) => sendAdminMessage(user, selected.id, text)}
                    disabled={["resolved", "closed"].includes(selected.status)}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-[10px] text-slate-500">
                <CheckCheck size={13} />
                Replies update for the customer immediately.
                <CircleHelp size={13} className="ml-auto" />
                <span className="sr-only">Realtime support chat</span>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <MessageCircle className="mx-auto text-slate-600" size={30} />
                <p className="mt-3 text-sm font-semibold text-slate-300">Select a conversation</p>
                <p className="mt-1 text-xs text-slate-500">{archiveView ? "Choose an archived conversation to read its retained messages." : "Choose a customer from the inbox to read and reply."}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
