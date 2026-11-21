import { ORGS, SUPPORT_CHECKED, type Org, type Place } from "../content/support";
import { accent, fmtDate, useL, useLang, useT } from "../i18n";
import { IconExternal } from "../ui/Icons";

// "Cómo ayudar": the organizations that work for the islands' reefs, grouped by island, each with
// what it does, how to support it and links to its own site. ReefQuest only links out: it handles
// no donations and is not affiliated with any of them (said on the page).
const PLACES: Place[] = ["roatan", "utila", "guanaja", "cayos-cochinos", "all"];
const PLACE_NAME: Record<Exclude<Place, "all">, string> = { roatan: "Roatán", utila: "Utila", guanaja: "Guanaja", "cayos-cochinos": "Cayos Cochinos" };
const LINK_LABEL = { site: "support.link.site", donate: "support.link.donate", volunteer: "support.link.volunteer", support: "support.link.support" } as const;

export function SupportPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  return (
    <main className="page support">
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

function OrgCard({ org }: { org: Org }) {
  const t = useT();
  const L = useL();
  return (
    <article className="figure org-card">
      <p className="org-kind">{L(org.kind)}</p>
      <h3>{org.name}</h3>
      <p className="org-about">{L(org.about)}</p>
      <ul className="org-does">
        {L(org.does).map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
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
    </article>
  );
}
