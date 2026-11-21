import { useId, useLayoutEffect, useRef, useState } from "react";
import { ORGS, SUPPORT_CHECKED, type Org, type Place } from "../content/support";
import { accent, fmtDate, useL, useLang, useT } from "../i18n";
import { Contact } from "../ui/Credit";
import { IconExternal } from "../ui/Icons";
import { SupportLine } from "../ui/Support";

// "Cómo ayudar": the organizations that work for the islands' reefs, grouped by island, each with
// what it does, how to support it and links to its own site. ReefQuest only links out: it handles
// no donations and is not affiliated with any of them (said on the page).
const PLACES: Place[] = ["roatan", "utila", "guanaja", "cayos-cochinos", "all"];
const PLACE_NAME: Record<Exclude<Place, "all">, string> = { roatan: "Roatán", utila: "Utila", guanaja: "Guanaja", "cayos-cochinos": "Cayos Cochinos" };
const LINK_LABEL = { site: "support.link.site", donate: "support.link.donate", volunteer: "support.link.volunteer", support: "support.link.support" } as const;

export function SupportPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  // Every card is as tall as the tallest one, closed (Tulio: same sizes, consistent): the
  // buttons and "Ver más" then sit on the same line in every card. Measured again when the width or
  // the language changes; an open card adds its details on top of that height.
  const page = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty("--org-h", "auto");
      let tallest = 0;
      for (const card of el.querySelectorAll<HTMLElement>(".org-card")) {
        const more = card.querySelector<HTMLElement>(".org-more");
        tallest = Math.max(tallest, card.getBoundingClientRect().height - (more?.getBoundingClientRect().height ?? 0));
      }
      el.style.setProperty("--org-h", `${Math.ceil(tallest)}px`);
    };
    let width = el.clientWidth;
    fit();
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return; // a card opening changes the height, not the width
      width = el.clientWidth;
      fit();
    });
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [lang]);
  return (
    <main ref={page} className="page support">
      <header className="page-head page-band-head">
        <p className="eyebrow">{t("support.kicker")}</p>
        <h1>{accent(t("support.title"))}</h1>
        <p className="standfirst">{t("support.lead")}</p>
        {/* Right under the intro (Tulio), in small print: read before any card. */}
        <div className="org-note">
          <p>
            <b>{t("support.noteTitle")}</b> {t("support.note").replace("{date}", fmtDate(SUPPORT_CHECKED, lang, { day: "numeric", month: "long", year: "numeric" }))}
          </p>
          <p>{t("support.missing")}</p>
          <Contact />
          {/* A sentence here, not the button (Tulio): the button pushed the organizations down. */}
          <SupportLine />
        </div>
      </header>

      {PLACES.map((place) => {
        const orgs = ORGS.filter((o) => o.place === place);
        if (!orgs.length) return null;
        return (
          <section className="section" key={place}>
            <div className="section-head">
              <h2>{place === "all" ? accent(t("support.allTitle")) : PLACE_NAME[place]}</h2>
              {place === "all" && <p>{t("support.allLead")}</p>}
            </div>
            <div className="org-grid">
              {orgs.map((o) => (
                <OrgCard key={o.id} org={o} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

/** A compact card: who they are, how to support them and their links. What they do (and the
 *  sources) opens under "Ver más" (Tulio: the cards were too big with everything showing). How to
 *  support stays visible, since it carries the caveats a donor needs before clicking. */
function OrgCard({ org }: { org: Org }) {
  const t = useT();
  const L = useL();
  const [open, setOpen] = useState(false);
  const moreId = useId();
  return (
    <article className="figure org-card">
      <p className="org-kind">{L(org.kind)}</p>
      <h3>{org.name}</h3>
      <p className="org-about">{L(org.about)}</p>
      <p className="org-how">
        <b>{t("support.how")}</b> {L(org.support)}
      </p>
      <div className="org-links">
        {org.links.map((l, i) => (
          <a key={l.url} className={i === 0 ? "btn primary small" : "btn small"} href={l.url} target="_blank" rel="noreferrer">
            {t(LINK_LABEL[l.kind])}
            <IconExternal />
          </a>
        ))}
      </div>
      {/* The card's footer: "Ver más" in the same place on every card, the details opening above it. */}
      <div id={moreId} className={open ? "org-more open" : "org-more"} inert={!open}>
        <div className="org-more-inner">
          <ul className="org-does">
            {L(org.does).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
          <p className="sources">
            {t("scene.sources")}:{" "}
            {org.sources.map((s, k) => (
              <span key={s.url}>
                {k > 0 && "; "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>
      <button type="button" className={open ? "org-toggle open" : "org-toggle"} aria-expanded={open} aria-controls={moreId} onClick={() => setOpen(!open)}>
        {t(open ? "support.less" : "support.more")}
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </article>
  );
}
