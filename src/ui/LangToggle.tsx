import { useLang } from "../i18n";

/** ES | EN segmented switch (Spanish first). */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang" role="group" aria-label="Idioma / Language">
      <button aria-pressed={lang === "es"} onClick={() => setLang("es")} lang="es">
        ES
      </button>
      <button aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en">
        EN
      </button>
    </div>
  );
}
