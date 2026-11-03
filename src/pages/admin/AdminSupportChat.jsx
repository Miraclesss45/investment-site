import { useEffect, useMemo, useRef, useState } from "react";
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
import { getAdminSupportHistoryPage } from "../../lib/adminApi";
import {
  sendAdminMessage,
  getOlderAdminConversations,
  subscribeToAdminConversation,
  setConversationArchived,
  SUPPORT_CONVERSATION_STATUSES,
  updateConversationStatus,
} from "../../lib/supportChat";
import SupportChatComposer from "../../components/support/SupportChatComposer";
import SupportChatThread from "../../components/support/SupportChatThread";
import { conversationMatchesSupportSearch, getSupportSearchQueryTerms } from "../../lib/supportSearch";

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

function matchesConversation(item, { archiveView, filter, search }) {
  if ((item.archived === true) !== archiveView) return false;
  const status = String(item.status || "open").toLowerCase();
  if (!archiveView && filter === "unread" && Number(item.unreadForAgent || 0) <= 0) return false;
  if (!archiveView && filter !== "all" && filter !== "unread" && status !== filter) return false;
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  if (item.serverSearchMatch === true) return true;
  const queryTerms = getSupportSearchQueryTerms(normalized);
  if (queryTerms.length) return conversationMatchesSupportSearch(item, queryTerms);
  return [item.userName, item.userEmail, item.userId, item.lastMessage]
    .filter(Boolean).join(" ").toLowerCase().includes(normalized);
}

export default function AdminSupportChat({ archiveView = false, sharedConversations = null, conversationPage = null, sharedCounts = null, onCountsRefresh, sharedError = "" }) {
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
  const [olderConversations, setOlderConversations] = useState([]);
  const [olderCursor, setOlderCursor] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [searchIndexComplete, setSearchIndexComplete] = useState(false);
  const [searchIndexTruncatedCount, setSearchIndexTruncatedCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const paginationInitialized = useRef(false);
  const previousRemoteMode = useRef(archiveView || filter !== "all" || Boolean(query.trim()));
  const selectedOlderConversationRef = useRef(null);
  const olderConversationsRef = useRef(olderConversations);
  const remoteMode = archiveView || filter !== "all" || Boolean(query.trim());
  const selectedIsLive = Boolean(conversations?.some((item) => item.id === selectedId));
  const conversationsLoading = remoteMode ? historyLoading : conversations === null;

  useEffect(() => {
    if (remoteMode || !conversationPage || paginationInitialized.current) return;
    paginationInitialized.current = true;
    setOlderCursor(conversationPage.nextCursor || null);
    setHasOlder(conversationPage.hasMore === true);
  }, [conversationPage, remoteMode]);

  useEffect(() => {
    olderConversationsRef.current = olderConversations;
  }, [olderConversations]);

  useEffect(() => {
    const selectedOlder = olderConversationsRef.current.find((item) => item.id === selectedId);
    if (!selectedOlder || selectedIsLive) return undefined;
    selectedOlderConversationRef.current = selectedOlder;
    let firstSnapshot = true;
    const unsubscribe = subscribeToAdminConversation(selectedId, (fresh) => {
      if (!fresh) {
        olderConversationsRef.current = olderConversationsRef.current.filter((item) => item.id !== selectedId);
        setOlderConversations((current) => current.filter((item) => item.id !== selectedId));
        return;
      }
      const previous = selectedOlderConversationRef.current;
      const changedQueueState = previous && (
        Number(previous.unreadForAgent || 0) !== Number(fresh.unreadForAgent || 0)
        || String(previous.status || "open") !== String(fresh.status || "open")
        || Boolean(previous.archived) !== Boolean(fresh.archived)
      );
      selectedOlderConversationRef.current = fresh;
      olderConversationsRef.current = olderConversationsRef.current.map((item) => (
        item.id === fresh.id ? { ...item, ...fresh } : item
      ));
      setOlderConversations((current) => current.map((item) => (
        item.id === fresh.id ? { ...item, ...fresh } : item
      )));
      if (firstSnapshot || changedQueueState) onCountsRefresh?.();
      firstSnapshot = false;
    }, (reason) => console.error("An older support conversation could not be refreshed.", reason));
    return () => {
      unsubscribe();
      if (selectedOlderConversationRef.current?.id === selectedId) {
        selectedOlderConversationRef.current = null;
      }
    };
  }, [onCountsRefresh, selectedId, selectedIsLive]);

  useEffect(() => {
    if (previousRemoteMode.current !== remoteMode) {
      previousRemoteMode.current = remoteMode;
      paginationInitialized.current = false;
      setOlderConversations([]);
      setOlderCursor(null);
      setHasOlder(false);
      if (!remoteMode) setHistoryLoading(false);
    }
  }, [remoteMode]);

  useEffect(() => {
    if (!remoteMode) return undefined;
    const controller = new AbortController();
    setOlderConversations([]);
    setOlderCursor(null);
    setHasOlder(false);
    setSearchIndexComplete(false);
    setSearchIndexTruncatedCount(0);
    setHistoryLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      getAdminSupportHistoryPage({
        search: query,
        filter,
        archived: archiveView,
        signal: controller.signal,
      }).then((page) => {
        if (controller.signal.aborted) return;
        setOlderConversations(page.items);
        setOlderCursor(page.nextCursor || null);
        setHasOlder(page.hasMore === true);
        setSearchIndexComplete(page.searchIndexComplete === true);
        setSearchIndexTruncatedCount(Number(page.searchIndexTruncatedCount) || 0);
      }).catch((reason) => {
        if (!controller.signal.aborted) setError(getSafeErrorMessage(reason, "Support history could not be searched."));
      }).finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    }, query.trim() ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [archiveView, filter, query, remoteMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const allConversations = useMemo(() => {
    const live = conversations || [];
    const liveIds = new Set(live.map((item) => item.id));
    return [...live, ...olderConversations.filter((item) => !liveIds.has(item.id))];
  }, [conversations, olderConversations]);

  const filtered = useMemo(() => {
    return allConversations.filter((item) => matchesConversation(item, { archiveView, filter, search: query }));
  }, [allConversations, archiveView, filter, query]);

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

  const selected = allConversations.find((item) => item.id === selectedId) || null;
  const loadedUnreadTotal = allConversations.reduce((sum, item) => (
    item.archived === true ? sum : sum + (Number(item.unreadForAgent) || 0)
  ), 0);
  const unreadTotal = Number.isFinite(Number(sharedCounts?.unreadMessageCount))
    ? Number(sharedCounts.unreadMessageCount)
    : loadedUnreadTotal;
  const hasGlobalCounts = Number.isFinite(Number(sharedCounts?.unreadMessageCount));

  async function loadOlderConversations() {
    if (!hasOlder || !olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    setError("");
    try {
      const page = remoteMode
        ? await getAdminSupportHistoryPage({ search: query, filter, archived: archiveView, cursor: olderCursor })
        : await getOlderAdminConversations(olderCursor);
      setOlderConversations((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !known.has(item.id))];
      });
      setOlderCursor(page.nextCursor || null);
      setHasOlder(page.hasMore === true);
      if (remoteMode && query.trim()) {
        setSearchIndexComplete(page.searchIndexComplete === true);
        setSearchIndexTruncatedCount(Number(page.searchIndexTruncatedCount) || 0);
      }
    } catch (reason) {
      setError(getSafeErrorMessage(reason, "Older conversations could not be loaded."));
    } finally {
      setLoadingOlder(false);
    }
  }

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
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{archiveView ? "Archived support chats" : "Support chat"}</h1>
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
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs text-slate-300" role={conversationsLoading ? "status" : undefined} aria-live={conversationsLoading ? "polite" : undefined}>
            {conversationsLoading ? "Loading conversations…" : archiveView ? <><span className="font-bold text-slate-900">{filtered.length}</span> archived chats loaded</> : hasGlobalCounts ? <><span className="font-bold text-slate-900">{unreadTotal}</span> unread messages across all chats</> : <><span className="font-bold text-slate-900">{loadedUnreadTotal}</span> unread messages in {allConversations.length} loaded chats</>}
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
                name="admin-chat-search"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, ID or latest message"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#081321] pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-300 focus:border-cyan-300/50"
              />
            </label>
            {!archiveView ? (
              <>
                <label className="sr-only" htmlFor="support-chat-filter">Filter conversations</label>
                <select
                  id="support-chat-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#081321] px-3 text-sm text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus:border-cyan-300/50"
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
            {historyLoading || (!remoteMode && conversations === null) ? (
              <div className="grid min-h-40 place-items-center gap-2 text-sm text-slate-400" role="status" aria-live="polite"><LoaderCircle size={17} className="animate-spin" /><span>Loading conversations…</span></div>
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
                    active ? "admin-support-conversation-selected" : "hover:bg-white/[0.035]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="admin-support-conversation-name block truncate text-sm font-bold text-slate-900">{item.userName || "Guest"}</span>
                      <span className="admin-support-conversation-email mt-0.5 block truncate text-xs text-slate-400">{item.userEmail || item.userId}</span>
                    </span>
                    {unread ? <span className="admin-support-conversation-unread grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 text-xs font-bold">{unread}</span> : null}
                  </span>
                  <span className="admin-support-conversation-preview mt-2 block truncate text-sm text-slate-300">{item.lastMessage || "No messages yet"}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`admin-support-conversation-status rounded-md border px-2 py-1 text-xs font-bold ${statusTone(item.status)}`}>{STATUS_LABELS[item.status] || "Open"}</span>
                      {item.archived === true ? <span className="admin-support-conversation-archived inline-flex items-center gap-1 text-xs font-semibold text-slate-400"><Archive size={12} /> Archived</span> : null}
                    </span>
                    <time className="admin-support-conversation-time truncate text-xs text-slate-500">{formatTime(item.lastMessageAt || item.updatedAt)}</time>
                  </span>
                </button>
              );
            }) : (
              <div className="px-5 py-12 text-center">
                <MessageCircle className="mx-auto text-slate-600" size={24} />
                <p className="mt-3 text-sm font-semibold text-slate-300">{error || sharedError ? "Inbox unavailable" : remoteMode && hasOlder ? "No matches in this batch" : query.trim() ? "No conversations match your search" : archiveView ? "No archived conversations found" : "No conversations found"}</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">{error || sharedError ? "Check Firebase access and reload." : hasOlder ? "More history remains. Load the next batch to continue searching." : archiveView ? "Resolved chats will appear here after they are archived." : query.trim() ? "Try a different name, email, ID, or latest message." : "New messages will appear here automatically."}</p>
              </div>
            )}
          </div>
          <div className="admin-support-pagination border-t border-white/10 px-3 py-3 text-center text-sm text-slate-400" aria-live="polite">
            <span>{conversationsLoading ? "Loading conversation history…" : remoteMode ? query.trim() ? `Search checks participant details and indexed message text across conversation history. ${searchIndexComplete ? "Historical indexing is complete." : "Older messages are still being indexed, so results may be incomplete."} ${filtered.length} matching chats loaded${hasOlder ? "; more matching records are available" : "; no more matching records are available"}.` : `This server-side filter is paginated across conversation history. ${filtered.length} conversations loaded${hasOlder ? "; older records remain" : "; history is fully loaded"}.` : `Search and filters cover the ${allConversations.length} conversations loaded so far.`}</span>
            {remoteMode && query.trim() && searchIndexTruncatedCount > 0 && <p className="mt-2 text-amber-200">{searchIndexTruncatedCount} unusually long conversation{searchIndexTruncatedCount === 1 ? " has" : "s have"} reached the search index limit; older message terms may be missing from results.</p>}
            {hasOlder && <button type="button" onClick={loadOlderConversations} disabled={loadingOlder || historyLoading} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60">{loadingOlder ? <><LoaderCircle size={15} className="animate-spin" />Loading older conversations…</> : remoteMode ? "Load more search results" : "Load older conversations"}</button>}
          </div>
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
                    <h2 className="truncate text-sm font-bold text-slate-900">{selected.userName || "Guest"}</h2>
                    <a href={`mailto:${encodeURIComponent(selected.userEmail || "")}`} className="block truncate text-xs text-cyan-200 hover:text-cyan-100">
                      {selected.userEmail || "No email recorded"}
                    </a>
                    <p className="truncate text-xs text-slate-500">
                      {selected.userType === "guest" ? "Guest" : `UID ${selected.userId}`}
                      {selected.userCountry ? ` · ${selected.userCountry}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400">
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
                    <p className="mt-1 text-xs text-amber-100/70">
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
              <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-xs text-slate-400">
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
