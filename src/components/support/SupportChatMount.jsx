import { lazy, Suspense, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { SUPPORT_CHAT_OPEN_EVENT } from "../../lib/supportChatEvents";

const SupportChatWidget = lazy(() => import("./SupportChatWidget"));

export default function SupportChatMount() {
  const { pathname } = useLocation();
  const isAdminPath = pathname === "/control-room" || pathname.startsWith("/control-room/");
  const [mounted, setMounted] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(false);

  useEffect(() => {
    const openChat = () => {
      if (isAdminPath) return;
      setOpenOnMount(true);
      setMounted(true);
    };
    window.addEventListener(SUPPORT_CHAT_OPEN_EVENT, openChat);
    return () => window.removeEventListener(SUPPORT_CHAT_OPEN_EVENT, openChat);
  }, [isAdminPath]);

  useEffect(() => {
    if (isAdminPath) {
      setMounted(false);
      setOpenOnMount(false);
    }
  }, [isAdminPath]);

  if (isAdminPath) return null;

  if (mounted) {
    return (
      <Suspense fallback={null}>
        <SupportChatWidget initialOpen={openOnMount} />
      </Suspense>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setOpenOnMount(true);
        setMounted(true);
      }}
      className="support-chat-launcher fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-[69] inline-flex min-h-14 items-center gap-2.5 rounded-full border border-blue-500 bg-blue-600 px-4 text-sm font-bold text-white shadow-[0_14px_45px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:bottom-28 sm:right-6"
      aria-label="Open support chat"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
        <MessageCircle size={18} aria-hidden="true" />
      </span>
      <span>Support chat</span>
    </button>
  );
}
