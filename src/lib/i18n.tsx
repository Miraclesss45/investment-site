import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Languages } from "lucide-react";

import { translateTexts } from "@/lib/translate.functions";

export type Language = { code: string; label: string; native: string; flag: string; rtl?: boolean };

export const languages: Language[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
  { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italian", native: "Italiano", flag: "🇮🇹" },
  { code: "nl", label: "Dutch", native: "Nederlands", flag: "🇳🇱" },
  { code: "ru", label: "Russian", native: "Русский", flag: "🇷🇺" },
  { code: "tr", label: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦", rtl: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "zh", label: "Chinese (Simplified)", native: "中文", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", native: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "Korean", native: "한국어", flag: "🇰🇷" },
];

const STORAGE_KEY = "mv-language";
const cacheKey = (code: string) => `mv-translations-${code}`;

type Ctx = { language: string; setLanguage: (code: string) => void; busy: boolean };
const LanguageContext = createContext<Ctx>({ language: "en", setLanguage: () => {}, busy: false });

export function useLanguage() {
  return useContext(LanguageContext);
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
const translatable = (value: string) => {
  const text = value.trim();
  if (text.length < 2) return false;
  if (!/[A-Za-z]{2}/.test(text)) return false;
  if (/^[\d\s.,:%$€£+-]+$/.test(text)) return false;
  if (/^[\w.+-]+@[\w.-]+$/.test(text)) return false;
  if (/^https?:\/\//.test(text)) return false;
  return true;
};

type Original = { node: Node; kind: "text" | "attr"; attr?: string; value: string };

function collect(originals?: WeakMap<Node, Map<string, string>>): Original[] {
  const found: Original[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
      const wasTranslated = originals?.get(node)?.has("#text") ?? false;
      return wasTranslated || translatable(node.nodeValue ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  let current = walker.nextNode();
  while (current) {
    found.push({ node: current, kind: "text", value: current.nodeValue ?? "" });
    current = walker.nextNode();
  }
  document.querySelectorAll<HTMLElement>("[placeholder],[aria-label],[title]").forEach((el) => {
    if (el.closest("[data-no-translate]")) return;
    (["placeholder", "aria-label", "title"] as const).forEach((attr) => {
      const value = el.getAttribute(attr);
      const wasTranslated = originals?.get(el)?.has(attr) ?? false;
      if (value && (wasTranslated || translatable(value))) {
        found.push({ node: el, kind: "attr", attr, value });
      }
    });
  });
  return found;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState("en");
  const [busy, setBusy] = useState(false);
  const originals = useRef(new WeakMap<Node, Map<string, string>>());
  const dictionary = useRef<Record<string, Record<string, string>>>({});
  const languageRef = useRef("en");

  const remember = useCallback((entry: Original) => {
    let map = originals.current.get(entry.node);
    if (!map) {
      map = new Map();
      originals.current.set(entry.node, map);
    }
    const slot = entry.kind === "text" ? "#text" : entry.attr!;
    if (!map.has(slot)) map.set(slot, entry.value);
    return map.get(slot)!;
  }, []);

  const apply = useCallback(
    (entry: Original, value: string) => {
      if (entry.kind === "text") {
        if (entry.node.nodeValue !== value) entry.node.nodeValue = value;
      } else {
        const el = entry.node as HTMLElement;
        if (el.getAttribute(entry.attr!) !== value) el.setAttribute(entry.attr!, value);
      }
    },
    [],
  );

  const run = useCallback(
    async (code: string) => {
      if (typeof document === "undefined") return;
      const entries = collect(originals.current);

      // Always return the current DOM to its English source before applying
      // another language. This makes direct switches (for example Arabic to
      // French) reliable instead of attempting to translate translated text.
      entries.forEach((entry) => {
        const map = originals.current.get(entry.node);
        const slot = entry.kind === "text" ? "#text" : entry.attr!;
        const original = map?.get(slot);
        if (original) apply(entry, original);
      });

      if (code === "en") {
        return;
      }

      const dict = (dictionary.current[code] ??= {});
      const missing = new Set<string>();

      entries.forEach((entry) => {
        const source = remember(entry).trim();
        const hit = dict[source];
        if (hit) apply(entry, entry.value.replace(entry.value.trim(), hit));
        else missing.add(source);
      });

      if (!missing.size) return;

      const language = languages.find((item) => item.code === code);
      const list = [...missing];
      setBusy(true);
      try {
        for (let index = 0; index < list.length; index += 60) {
          const chunk = list.slice(index, index + 60);
          const result = await translateTexts({
            data: { lang: code, language: language?.label ?? code, texts: chunk },
          });
          Object.assign(dict, result);
          if (languageRef.current !== code) return;
          collect(originals.current).forEach((entry) => {
            const source = remember(entry).trim();
            const hit = dict[source];
            if (hit) apply(entry, entry.value.replace(entry.value.trim(), hit));
          });
        }
        try {
          localStorage.setItem(cacheKey(code), JSON.stringify(dict));
        } catch {
          /* cache full - ignore */
        }
      } catch (error) {
        console.error("Translation error", error);
      } finally {
        setBusy(false);
      }
    },
    [apply, remember],
  );

  const setLanguage = useCallback(
    (code: string) => {
      if (!languages.some((item) => item.code === code)) return;
      languageRef.current = code;
      setLanguageState(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // restore saved language + cached dictionary
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved || saved === "en" || !languages.some((item) => item.code === saved)) return;
    try {
      const cached = localStorage.getItem(cacheKey(saved));
      if (cached) dictionary.current[saved] = JSON.parse(cached) as Record<string, string>;
    } catch {
      /* ignore */
    }
    languageRef.current = saved;
    setLanguageState(saved);
  }, []);

  // apply on language change, on route content changes, and on new DOM
  useEffect(() => {
    const meta = languages.find((item) => item.code === language);
    document.documentElement.lang = language;
    document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";

    if (!dictionary.current[language]) {
      try {
        const cached = localStorage.getItem(cacheKey(language));
        if (cached) dictionary.current[language] = JSON.parse(cached) as Record<string, string>;
      } catch {
        /* ignore */
      }
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (running) return;
        running = true;
        void run(language).finally(() => {
          running = false;
        });
      }, 250);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [language, run]);

  const value = useMemo(() => ({ language, setLanguage, busy }), [language, setLanguage, busy]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageSelect({ className }: { className?: string }) {
  const { language, setLanguage, busy } = useLanguage();
  const active = languages.find((item) => item.code === language) ?? languages[0]!;
  return (
    <span className={className ? `language-select ${className}` : "language-select"} data-no-translate>
      <Languages className="language-select-icon" aria-hidden="true" />
      <select
        aria-label="Select language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.native}
          </option>
        ))}
      </select>
      <ChevronDown className="language-select-chevron" aria-hidden="true" />
      {busy ? <i className="language-spinner" aria-hidden="true" /> : null}
    </span>
  );
}
