import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  browserSessionPersistence,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { LifeBuoy, LoaderCircle, MessageCircle, X } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { firebaseAuth, firebaseApp } from "../../lib/firebase";
import { firestoreDb } from "../../lib/firebaseFirestore";
import {
  SUPPORT_CHAT_OPEN_EVENT,
  sendCustomerMessage,
  subscribeToCustomerConversation,
} from "../../lib/supportChat";
import SupportChatComposer from "./SupportChatComposer";

const SupportChatThread = lazy(() => import("./SupportChatThread"));

function friendlyStartError(error) {
  if (["auth/operation-not-allowed", "auth/admin-restricted-operation"].includes(error?.code)) {
    return "Guest chat is not enabled in Firebase Authentication yet. Enable the Anonymous sign-in provider to allow guest conversations.";
  }
  if (error?.code?.includes("permission-denied")) {
    return "Chat access is not ready. Please try again later or contact support by email.";
  }
  if (error?.code?.startsWith("auth/")) {
    return "A guest support session could not be started. Please try again or contact support by email.";
  }
  if (error?.code) {
    return "The chat could not be started. Check your connection and try again.";
  }
  return error?.message || "The chat could not be started. Please try again.";
}

export default function SupportChatWidget() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const location = useLocation();
  const launcherRef = useRef(null);
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const guestNameRef = useRef(null);
  const wasOpenRef = useRef(false);
  const dismissedOutsideRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [identityLoading, setIdentityLoading] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: "", email: "" });
  const [firstMessage, setFirstMessage] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (isAdmin || location.pathname.startsWith("/control-room")) return undefined;
    const openChat = () => setOpen(true);
    window.addEventListener(SUPPORT_CHAT_OPEN_EVENT, openChat);
    return () => window.removeEventListener(SUPPORT_CHAT_OPEN_EVENT, openChat);
  }, [isAdmin, location.pathname]);

  useEffect(() => {
    if (!user || user.isAnonymous || !firestoreDb) {
      setIdentity({ name: "", email: "" });
      setIdentityLoading(false);
      return undefined;
    }
    let active = true;
    setIdentityLoading(true);
    const fallback = {
      name: user.displayName || user.email?.split("@")[0] || "Member",
      email: user.email || "",
      country: "",
    };
    getDoc(doc(firestoreDb, "users", user.uid))
      .then((snapshot) => {
        if (!active) return;
        const profile = snapshot.exists() ? snapshot.data() : {};
        setIdentity({
          name: profile.fullName || profile.displayName || profile.username || fallback.name,
          email: profile.email || fallback.email,
          country: profile.country || "",
        });
      })
      .catch((error) => {
        console.error("Support could not load the member profile.", error);
        if (active) setIdentity(fallback);
      })
      .finally(() => {
        if (active) setIdentityLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      setConversation(null);
      setConversationError("");
      setConversationLoading(false);
      return undefined;
    }
    if (!firestoreDb) {
      setConversationError("Chat is temporarily unavailable because Firebase is not configured.");
      setConversationLoading(false);
      return undefined;
    }
    setConversationLoading(true);
    setConversationError("");
    return subscribeToCustomerConversation(
      user.uid,
      (nextConversation) => {
        setConversation(nextConversation);
        setConversationLoading(false);
        if (nextConversation?.userType === "guest") {
          setGuestForm({ name: nextConversation.userName || "", email: nextConversation.userEmail || "" });
        }
      },
      (error) => {
        console.error("Support conversation could not be loaded.", error);
        setConversationError("Your conversation could not be loaded. Check your connection and try again.");
        setConversationLoading(false);
      },
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const target = !authLoading && !user ? guestNameRef.current : null;
      (target || closeButtonRef.current)?.focus();
    });
    const handleDialogKey = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleOutsidePointer = (event) => {
      if (!panelRef.current?.contains(event.target)) {
        dismissedOutsideRef.current = true;
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleDialogKey);
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKey);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [authLoading, open, user]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      if (!dismissedOutsideRef.current) {
        launcherRef.current?.focus({ preventScroll: true });
      }
      dismissedOutsideRef.current = false;
    }
    wasOpenRef.current = open;
  }, [open]);

  if (isAdmin || location.pathname.startsWith("/control-room")) return null;

  async function startConversation(event) {
    event.preventDefault();
    setConversationError("");
    setStarting(true);
    try {
      if (!firebaseApp || !firebaseAuth) {
        throw new Error("Chat is temporarily unavailable because Firebase is not configured.");
      }
      let activeUser = user || firebaseAuth.currentUser;
      let customerIdentity = identity;
      if (!activeUser) {
        await setPersistence(firebaseAuth, browserSessionPersistence);
        activeUser = (await signInAnonymously(firebaseAuth)).user;
        customerIdentity = {
          name: guestForm.name.trim(),
          email: guestForm.email.trim(),
        };
      } else if (activeUser.isAnonymous) {
        customerIdentity = {
          name: guestForm.name.trim(),
          email: guestForm.email.trim(),
        };
      }
      await sendCustomerMessage(activeUser, customerIdentity, firstMessage);
      setFirstMessage("");
    } catch (error) {
      setConversationError(friendlyStartError(error));
    } finally {
      setStarting(false);
    }
  }

  const hasUnread = Number(conversation?.unreadForUser || 0) > 0;
  const isGuest = Boolean(user?.isAnonymous);

  return (
    <>
      {open ? (
        <section
          ref={panelRef}
          id="support-chat-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-chat-title"
          className="fixed inset-0 z-[70] flex h-[100dvh] flex-col overflow-hidden bg-[#091522] text-slate-100 shadow-2xl sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(700px,calc(100dvh-8rem))] sm:w-[min(410px,calc(100vw-2.5rem))] sm:rounded-2xl sm:border sm:border-white/10"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0d1b2b] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><LifeBuoy size={20} /></span>
              <div className="min-w-0">
                <h2 id="support-chat-title" className="truncate text-sm font-bold text-white">MeridianVest Support</h2>
                <p className="truncate text-[11px] text-slate-400">Leave a message and we’ll reply here</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X size={19} />
            </button>
          </header>

          {conversationError ? (
            <p role="alert" className="mx-3 mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-200">{conversationError}</p>
          ) : null}

          {conversationLoading || authLoading ? (
            <div className="grid min-h-0 flex-1 place-items-center text-sm text-slate-400">
              <span className="inline-flex items-center gap-2"><LoaderCircle size={17} className="animate-spin" />Connecting to support…</span>
            </div>
          ) : conversation ? (
            <>
              <Suspense fallback={<div className="grid min-h-0 flex-1 place-items-center text-sm text-slate-400">Loading conversation…</div>}>
                <SupportChatThread
                  conversationId={conversation.id}
                  conversation={conversation}
                  user={user}
                  viewerType="customer"
                  showHeader
                />
              </Suspense>
              {conversation.archived === true ? (
                <p className="border-t border-white/10 px-4 py-3 text-center text-xs leading-5 text-slate-400">
                  This conversation has been archived. For further help,{" "}
                  <a href="mailto:meridianvest948@gmail.com" className="text-cyan-200 hover:text-cyan-100">contact support</a>.
                </p>
              ) : (
                <SupportChatComposer
                  conversationId={conversation.id}
                  user={user}
                  onSend={(text) => sendCustomerMessage(
                    user,
                    isGuest
                      ? { name: conversation.userName, email: conversation.userEmail }
                      : identity,
                    text,
                  )}
                />
              )}
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm font-semibold text-white">Hello{user && !isGuest ? `, ${identity.name || "there"}` : ""}.</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Tell us what you need help with. Your messages are private to this support conversation.</p>
              </div>
              <form onSubmit={startConversation} className="space-y-4">
                {!user || isGuest ? (
                  <>
                    <label className="block text-xs font-semibold text-slate-300">
                      Your name
                      <input
                        ref={guestNameRef}
                        required
                        maxLength={120}
                        autoComplete="name"
                        value={guestForm.name}
                        onChange={(event) => setGuestForm((current) => ({ ...current, name: event.target.value }))}
                        className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#101d30] px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-300">
                      Email address
                      <input
                        required
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        value={guestForm.email}
                        onChange={(event) => setGuestForm((current) => ({ ...current, email: event.target.value }))}
                        className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#101d30] px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                      />
                    </label>
                  </>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-[#101d30] px-3 py-2.5 text-xs text-slate-400">
                    Chatting as <span className="font-semibold text-slate-200">{identity.name || user.email}</span>
                    {identityLoading ? " · Loading profile…" : ""}
                  </p>
                )}
                <label className="block text-xs font-semibold text-slate-300">
                  Message
                  <textarea
                    required
                    minLength={1}
                    maxLength={4000}
                    rows={5}
                    value={firstMessage}
                    onChange={(event) => setFirstMessage(event.target.value)}
                    placeholder="How can we help?"
                    className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-[#101d30] px-3 py-3 text-sm leading-5 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60"
                  />
                </label>
                <button
                  type="submit"
                  disabled={starting || identityLoading || !firstMessage.trim()}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting ? <LoaderCircle size={16} className="animate-spin" /> : null}
                  {starting ? "Starting chat…" : "Start conversation"}
                </button>
              </form>
            </div>
          )}
          <div className="shrink-0 border-t border-white/5 px-4 py-2 text-center text-[10px] text-slate-500" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            For urgent help, <a href="mailto:meridianvest948@gmail.com" className="text-cyan-200 hover:text-cyan-100">email support</a>.
          </div>
        </section>
      ) : null}

      {!open && location.pathname.replace(/\/+$/, "") !== "/support" ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          aria-expanded="false"
          aria-controls="support-chat-panel"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-[69] inline-flex min-h-14 items-center gap-2.5 rounded-full border border-cyan-100/20 bg-cyan-300 px-4 text-sm font-bold text-slate-950 shadow-[0_14px_45px_rgba(34,211,238,0.22)] transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:bottom-28 sm:right-6"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-slate-950/10">
            <MessageCircle size={19} />
            {hasUnread ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-cyan-300 bg-rose-500" /> : null}
          </span>
          <span>Support chat</span>
          {hasUnread ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] text-white">{conversation.unreadForUser}</span> : null}
        </button>
      ) : null}
    </>
  );
}
