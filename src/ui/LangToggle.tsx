import { useLang, useT } from "../i18n";

export function LangToggle() {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <button className="lang" aria-label={t("lang.switchLabel")} onClick={() => setLang(lang === "es" ? "en" : "es")}>
      {t("lang.switch")}
    </button>
  );
}
