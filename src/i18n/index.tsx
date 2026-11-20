import { create } from "zustand";
import es from "./es.json";
import en from "./en.json";

// Spanish first, English as a full second language. Every key must exist in both files:
// the type below makes a key missing from en.json a compile error.
export type Lang = "es" | "en";
export type StringKey = keyof typeof es;
const STRINGS: Record<Lang, Record<StringKey, string>> = { es, en };

const STORAGE_KEY = "rq-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* storage blocked */
  }
  // First visit: Spanish unless the browser prefers English.
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "es";
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage blocked */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

document.documentElement.lang = useLang.getState().lang;

/** Returns the translator for the current language; re-renders when it changes. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: StringKey) => STRINGS[lang][key];
}

/** Picks the right language from a { es, en } pair (long-form content lives in src/content/). */
export function useL() {
  const lang = useLang((s) => s.lang);
  return <T,>(pair: { es: T; en: T }) => pair[lang];
}

export function fmtNum(n: number, lang: Lang, digits = 1) {
  return n.toLocaleString(lang === "es" ? "es-HN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString(lang === "es" ? "es-HN" : "en-US", { ...opts, timeZone: "UTC" });
}

/** Renders a UI string that marks its lead-in with <b>…</b> (no other markup is interpreted). */
export function rich(s: string) {
  const m = /^<b>(.*?)<\/b>\s*(.*)$/s.exec(s);
  return m ? [<b key="b">{m[1]}</b>, " ", m[2]] : [s];
}

/** Renders the *marked* words of a headline in the italic display serif (the accent of the type system). */
export function accent(s: string) {
  return s.split("*").map((part, i) =>
    i % 2 ? (
      <em key={i} className="it">
        {part}
      </em>
    ) : (
      part
    ),
  );
}
