import { useLang } from "../i18n";

/** ES | EN as two 3D chips (Spanish first); the selected one stays pressed in. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang chips" role="group" aria-label="Idioma / Language">
      <button aria-pressed={lang === "es"} onClick={() => setLang("es")} lang="es">
        ES
      </button>
      <button aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en">
        EN
      </button>
    </div>
  );
}
