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
