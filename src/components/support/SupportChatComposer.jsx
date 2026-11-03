import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { setSupportTyping } from "../../lib/supportChat";

function getFriendlySendError(reason) {
  if (reason?.code) {
    return "Your message could not be sent. Check your connection and try again.";
  }
  return reason?.message || "Your message could not be sent. Please try again.";
}

export default function SupportChatComposer({
  conversationId,
  user,
  onSend,
  disabled = false,
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const typingRef = useRef(false);
  const idleTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);

  const stopTyping = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    window.clearInterval(heartbeatTimerRef.current);
    idleTimerRef.current = null;
    heartbeatTimerRef.current = null;
    if (typingRef.current && conversationId && user?.uid) {
      typingRef.current = false;
      setSupportTyping(conversationId, user.uid, false).catch((reason) => {
        console.error("Support typing state could not be cleared.", reason);
      });
    }
  }, [conversationId, user?.uid]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  function handleChange(event) {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    if (!nextDraft.trim() || disabled || !conversationId || !user?.uid) {
      stopTyping();
      return;
    }

    if (!typingRef.current) {
      typingRef.current = true;
      setSupportTyping(conversationId, user.uid, true).catch((reason) => {
        console.error("Support typing state could not be updated.", reason);
      });
      heartbeatTimerRef.current = window.setInterval(() => {
        setSupportTyping(conversationId, user.uid, true).catch((reason) => {
          console.error("Support typing state could not be refreshed.", reason);
        });
      }, 8000);
    }
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(stopTyping, 1800);
  }

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || disabled) return;
    setError("");
    setSending(true);
    stopTyping();
    try {
      await onSend(text);
      setDraft("");
    } catch (reason) {
      setError(getFriendlySendError(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="border-t border-blue-100 bg-white p-3 sm:p-4">
      {disabled ? (
        <p className="mb-2 text-xs text-amber-800">Reopen this conversation to send a reply.</p>
      ) : null}
      {error ? <p role="alert" className="mb-2 text-xs text-rose-700">{error}</p> : null}
      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400">
        <label className="sr-only" htmlFor={`support-message-${conversationId}`}>Type a message</label>
        <textarea
          id={`support-message-${conversationId}`}
          value={draft}
          onChange={handleChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          maxLength={4000}
          rows={1}
          placeholder={disabled ? "Conversation closed" : "Write a message…"}
          disabled={disabled || sending}
          className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={disabled || sending || !draft.trim()}
          aria-label={sending ? "Sending message" : "Send message"}
          className="admin-blue-action grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <p className="mt-2 px-1 text-[10px] text-slate-500">
        Enter to send · Shift + Enter for a new line · {draft.length}/4000
      </p>
    </form>
  );
}
