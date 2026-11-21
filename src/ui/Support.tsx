import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { lockScroll } from "../lib/scrollLock";
import { IconClose } from "./Icons";

// Donations to Saint Mike Node: a sentence ("If you want to support the hosting and development of
// this project, click here") whose link opens Ko-fi's donation panel in a window over the page, so
// people can give without leaving (the same approach as Tulio's Pipodojo site; he asked for a
// sentence, not a button, in the footer and on both pages). Nothing from Ko-fi loads until someone
// opens it: visitors who never click get no Ko-fi code and no cookies. This is the site's one third-party embed, and only on
// that click. The window says where the money goes (to Saint Mike Node, not to the reef
// organizations listed on "Cómo ayudar") and that Ko-fi handles the payment.

export const KOFI_URL = "https://ko-fi.com/saintmikenode";
/** Ko-fi's own embeddable donation panel for the page. */
const PANEL_URL = `${KOFI_URL}/?hidefeed=true&widget=true&embed=true&preview=true`;

/**
 * "If you want to support the hosting and development of this project, click here." The starred
 * words of `kofi.line` are the link. It is a real link to the
 * Ko-fi page (open in a new tab, copy the address), and a plain click opens the window instead.
 */
export function SupportLine({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [before, link, after] = t("kofi.line").split("*");
  return (
    <p className={className}>
      {before}
      <a
        className="credit-link"
        href={KOFI_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-haspopup="dialog"
        aria-label={t("kofi.button")}
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab: the Ko-fi page itself
          e.preventDefault();
          setOpen(true);
        }}
      >
        {link}
      </a>
      {after}
      {open && <SupportDialog onClose={() => setOpen(false)} />}
    </p>
  );
}

function SupportDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const done = useRef(onClose);
  done.current = onClose;

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done.current();
    addEventListener("keydown", onKey);
    const release = lockScroll();
    return () => {
      removeEventListener("keydown", onKey);
      release();
    };
  }, []);

  return createPortal(
    <div className="kofi" onClick={onClose}>
      <section className="kofi-card" role="dialog" aria-modal="true" aria-labelledby="kofi-title" onClick={(e) => e.stopPropagation()}>
        <header className="kofi-head">
          <div>
            <h2 id="kofi-title">{t("kofi.title")}</h2>
            <p>{t("kofi.sub")}</p>
          </div>
          <button ref={closeBtn} type="button" className="kofi-close" onClick={onClose} aria-label={t("scene.close")}>
            <IconClose />
          </button>
        </header>
        <div className="kofi-frame">
          {!loaded && (
            <p className="kofi-loading" aria-live="polite">
              {t("kofi.loading")}
            </p>
          )}
          <iframe src={PANEL_URL} title={t("kofi.panel")} allow="payment" onLoad={() => setLoaded(true)} className={loaded ? "in" : undefined} />
        </div>
        <footer className="kofi-foot">
          {/* Some phones won't finish a payment inside a frame: the full page always works. */}
          <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
            {t("kofi.backup")} ↗
          </a>
          <p>
            {t("kofi.where")} {t("kofi.privacy")}
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
