import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  getOlderMessages,
  markMessagesAsRead,
  subscribeToMessages,
  subscribeToTyping,
} from "../../lib/supportChat";

function messageTime(value) {
  const date = value?.toDate?.();
  if (!date || Number.isNaN(date.getTime())) return "Sending…";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function statusLabel(status) {
  return ({
    open: "Open",
    in_progress: "In progress",
    waiting: "Waiting for customer",
    resolved: "Resolved",
    closed: "Closed",
  })[status] || "Open";
}

function friendlyThreadError(reason, viewerType, action = "loaded") {
  if (reason?.code?.includes("permission-denied")) {
    return viewerType === "agent"
      ? "Administrator access was denied. Confirm the support chat Firestore rules are deployed."
      : "Chat access could not be verified. Please try again later or contact support by email.";
  }
  if (reason?.code) {
    return `Messages could not be ${action}. Check the connection and try again.`;
  }
  return reason?.message || `Messages could not be ${action}.`;
}

export default function SupportChatThread({
  conversationId,
  conversation,
  user,
  viewerType,
  showHeader = true,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState("");
  const [olderError, setOlderError] = useState("");
  const [readError, setReadError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const messageContainerRef = useRef(null);
  const latestDocsRef = useRef([]);
  const olderDocsRef = useRef([]);
  const handledReadIdsRef = useRef(new Set());
  const firstSnapshotRef = useRef(true);
  const stickToBottomRef = useRef(true);
  const pendingScrollRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    setOlderError("");
    setReadError("");
    setMessages([]);
    setHasOlder(false);
    olderDocsRef.current = [];
    handledReadIdsRef.current = new Set();
    firstSnapshotRef.current = true;

    const unsubscribe = subscribeToMessages(
      conversationId,
      (messageDocs) => {
        latestDocsRef.current = messageDocs;
        setHasOlder(messageDocs.length === 50);
        const combined = [...olderDocsRef.current, ...messageDocs];
        const unique = new Map(combined.map((item) => [item.id, item]));
        setMessages([...unique.values()].sort((a, b) => {
          const left = a.data().createdAt?.toMillis?.() || 0;
          const right = b.data().createdAt?.toMillis?.() || 0;
          return left - right;
        }));
        setLoading(false);

        const isFirstSnapshot = firstSnapshotRef.current;
        firstSnapshotRef.current = false;
        const unreadMessages = messageDocs.filter((item) => (
          item.data().senderType !== viewerType
          && item.data().read !== true
          && !handledReadIdsRef.current.has(item.id)
        ));
        for (const item of unreadMessages) handledReadIdsRef.current.add(item.id);
        if (isFirstSnapshot || unreadMessages.length) {
          markMessagesAsRead(
            conversationId,
            viewerType,
            unreadMessages,
            isFirstSnapshot,
            messageDocs[0]?.id || null,
          )
            .catch((reason) => {
              console.error("Support message read status could not be updated.", reason);
              setReadError("Read status could not be updated yet.");
            });
        }
      },
      (reason) => {
        console.error("Support messages could not be loaded.", reason);
        setLoading(false);
        setError(friendlyThreadError(reason, viewerType));
      },
    );
    return unsubscribe;
  }, [conversationId, viewerType]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return subscribeToTyping(
      conversationId,
      user.uid,
      setTypingUsers,
      (reason) => console.error("Support typing updates could not be loaded.", reason),
    );
  }, [conversationId, user?.uid]);

  useEffect(() => {
    if (!typingUsers.length) return undefined;
    const nextExpiry = Math.min(...typingUsers.map((item) => (
      (item.updatedAt?.toMillis?.() || Date.now()) + 15000
    )));
    const timeout = window.setTimeout(() => {
      const now = Date.now();
      setTypingUsers((current) => current.filter((item) => (
        now - (item.updatedAt?.toMillis?.() || now) < 15000
      )));
    }, Math.max(nextExpiry - Date.now(), 0));
    return () => window.clearTimeout(timeout);
  }, [typingUsers]);

  useLayoutEffect(() => {
    const element = messageContainerRef.current;
    if (!element) return;
    if (pendingScrollRef.current) {
      const { height, top } = pendingScrollRef.current;
      element.scrollTop = element.scrollHeight - height + top;
      pendingScrollRef.current = null;
    } else if (stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  async function loadOlder() {
    if (loadingOlder || !hasOlder) return;
    const cursor = olderDocsRef.current.length
      ? olderDocsRef.current[olderDocsRef.current.length - 1]
      : latestDocsRef.current[latestDocsRef.current.length - 1];
    if (!cursor) return;
    setLoadingOlder(true);
    setOlderError("");
    const element = messageContainerRef.current;
    if (element) pendingScrollRef.current = { height: element.scrollHeight, top: element.scrollTop };
    try {
      const result = await getOlderMessages(conversationId, cursor);
      const older = result.docs.filter((item) => (
        !olderDocsRef.current.some((existing) => existing.id === item.id)
      ));
      olderDocsRef.current = [...olderDocsRef.current, ...older];
      const unreadOlder = older.filter((item) => (
        item.data().senderType !== viewerType
        && item.data().read !== true
        && !handledReadIdsRef.current.has(item.id)
      ));
      for (const item of unreadOlder) handledReadIdsRef.current.add(item.id);
      if (unreadOlder.length) {
        markMessagesAsRead(conversationId, viewerType, unreadOlder)
          .catch((reason) => {
            console.error("Earlier support message read status could not be updated.", reason);
            setReadError("Read status could not be updated yet.");
          });
      }
      setHasOlder(result.docs.length === 50);
      setMessages((current) => {
        const byId = new Map([...older, ...current].map((item) => [item.id, item]));
        return [...byId.values()].sort((a, b) => (
          (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0)
        ));
      });
    } catch (reason) {
      setOlderError(friendlyThreadError(reason, viewerType, "loaded"));
    } finally {
      setLoadingOlder(false);
    }
  }

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return "";
    if (viewerType === "customer") return "Support is typing…";
    return `${conversation?.userName || "Customer"} is typing…`;
  }, [conversation?.userName, typingUsers.length, viewerType]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-blue-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {viewerType === "agent" ? conversation?.userName || "Customer" : "Support"}
            </p>
            <p className="text-xs text-slate-600">{statusLabel(conversation?.status)}</p>
          </div>
          {viewerType === "agent" && conversation?.userEmail ? (
            <a href={`mailto:${encodeURIComponent(conversation.userEmail)}`} className="max-w-[45%] truncate text-xs text-blue-700 hover:text-blue-900">
              {conversation.userEmail}
            </a>
          ) : null}
        </div>
      ) : null}
      <div
        ref={messageContainerRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        {olderError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{olderError}</p> : null}
        {hasOlder ? (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="mx-auto flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
          >
            {loadingOlder ? <LoaderCircle size={14} className="animate-spin" /> : null}
            Load earlier messages
          </button>
        ) : null}
        {loading ? (
          <div className="grid min-h-32 place-items-center text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" />Loading messages…</span>
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>
        ) : messages.length ? (
          <>
          {readError ? <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{readError}</p> : null}
          {messages.map((item) => {
            const message = item.data();
            const own = message.senderId === user?.uid;
            return (
              <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <article className={`support-chat-message max-w-[86%] rounded-2xl px-3.5 py-2.5 sm:max-w-[78%] ${
                  own
                    ? "support-chat-message-own rounded-br-md bg-blue-600 text-white"
                    : "support-chat-message-other rounded-bl-md border border-blue-100 bg-blue-50 text-slate-900"
                }`}>
                  {!own ? <p className="mb-1 text-xs font-bold text-blue-700">{message.senderType === "agent" ? "Support" : conversation?.userName || "Customer"}</p> : null}
                  <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>
                  <div className={`mt-1 flex items-center justify-end gap-2 text-xs ${own ? "text-blue-100" : "text-slate-500"}`}>
                    <time>{messageTime(message.createdAt)}</time>
                    {own && message.read ? <span>Read</span> : null}
                  </div>
                </article>
              </div>
            );
          })}
          </>
        ) : (
          <p className="py-12 text-center text-sm text-slate-600">Start the conversation by sending a message.</p>
        )}
        {typingLabel ? <p className="px-2 text-xs italic text-slate-600">{typingLabel}</p> : null}
      </div>
    </div>
  );
}
