import { useLang, useT } from "../i18n";

// "An open source project by NerdyPunkDev, part of Todos en la Web", each name a real link.
const REPO = "https://github.com/saintmikenode/reefquest";
const AUTHOR = "https://nerdypunk.dev";
const TEW = "https://todosenlaweb.com";

const CodeIcon = () => (
  <svg className="credit-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.4 4.5l-2.8 15" />
  </svg>
);

/** The project credit; `badge` shows it as a frosted pill with an icon (Data & credits). */
export function Credit({ className, badge }: { className?: string; badge?: boolean }) {
  const lang = useLang((s) => s.lang);
  const a = (href: string, text: string) => (
    <a className="credit-link" href={href} target="_blank" rel="noreferrer">
      {text}
    </a>
  );
  const text =
    lang === "es" ? (
      <>Un proyecto de {a(REPO, "código abierto")} de {a(AUTHOR, "NerdyPunkDev")}, parte de {a(TEW, "Todos en la Web")}.</>
    ) : (
      <>An {a(REPO, "open source")} project by {a(AUTHOR, "NerdyPunkDev")}, part of {a(TEW, "Todos en la Web")}.</>
    );
  return badge ? (
    <p className={`credit-badge ${className ?? ""}`}>
      <CodeIcon />
      <span>{text}</span>
    </p>
  ) : (
    <p className={className}>{text}</p>
  );
}

/** Where to write to the project (Tulio's address for ReefQuest). */
export const CONTACT_EMAIL = "hola@saintmikenode.org";

/** "If you want to support ReefQuest or give feedback, write to …": in the footer, at the end of
 *  the note on "Cómo ayudar" and under the intro of "Datos y créditos". */
export function Contact({ className }: { className?: string }) {
  const t = useT();
  return (
    <p className={className}>
      {t("contact.text")}{" "}
      <a className="credit-link" href={`mailto:${CONTACT_EMAIL}`}>
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  );
}
