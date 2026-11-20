import { lazy, Suspense, useEffect, useState } from "react";
import { accent, fmtDate, fmtNum, useLang, useT } from "../i18n";
import { levelFor, rampCSS } from "../lib/alert";
import { loadLatest, type Latest } from "../lib/data";
import { ISLAND_ORDER as ORDER, SCENE_ISLANDS as AVAILABLE } from "../lib/islands";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { ArchipelagoMap } from "../ui/ArchipelagoMap";
import { HeatKey } from "../ui/HeatKey";
import { HeatStripes } from "../ui/HeatStripes";
import { IconArrow } from "../ui/Icons";
import { Sparkline } from "../ui/Sparkline";
import { HAS_WEBGL } from "../webgl";

// The braille drone view (and the drawille library) load after the first paint.
const BrailleSea = lazy(() => import("../ui/BrailleSea"));

export function Home() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => {
    loadLatest().then(setLatest).catch(() => {});
  }, []);
  const date = latest ? fmtDate(latest.date, lang, { day: "numeric", month: "long", year: "numeric" }) : "…";
  const [isl, setIsl] = useState("roatan");


  return (
    <>
      <section className="hero-wrap">
        <div className="hero-frame">
          <Suspense fallback={null}>
            <BrailleSea />
          </Suspense>
          <div className="hero-guides" aria-hidden="true" />
          <div className="hero-content">
            {latest && (
              <p className="hero-badge">
                <Laurel />
                {t("home.badge").replace("{a}", String(latest.years[0])).replace("{b}", String(latest.years[latest.years.length - 1]))}
                <Laurel flip />
              </p>
            )}
            <h1>{accent(t("home.title"))}</h1>
            <p className="hero-sub">{t("home.sub")}</p>
            <div className="hero-actions">
              {HAS_WEBGL && (
                <a className="btn primary" href={href.island("roatan")}>
                  {t("home.ctaRoatan")}
                </a>
              )}
              <a className="btn light" href={href.heat}>
                {t("nav.heat")} <IconArrow />
              </a>
            </div>
          </div>

          {latest && (
            <div className="hero-cards">
              <aside className="card alert-card">
                <div className="card-top">
                  <b>{t("home.cardAlert")}</b>
                  <span className="date-chip num">{fmtDate(latest.date, lang)}</span>
                </div>
                <ul>
                  {ORDER.map((id) => {
                    const s = latest.islands[id];
                    if (!s) return null;
                    const lv = levelFor(s.dhw);
                    return (
                      <li key={id} className={`lv-${lv.key}`} style={{ "--c": lv.color } as React.CSSProperties}>
                        <span className="who">{s.name}</span>
                        <span className="what num">
                          {t(`alert.${lv.key}`)} · {fmtNum(s.dhw, lang)} {t("unit.dhw")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <a className="more" href={href.heat}>
                  {t("home.cardMore")} <IconArrow />
                </a>
              </aside>

              <div className="card strip-card">
                <div className="strip-top">
                  <b>{t("home.panelTitle")}</b>
                  <div className="seg" role="group" aria-label={t("table.island")}>
                    {ORDER.filter((id) => latest.islands[id]).map((id) => (
                      <button key={id} aria-pressed={id === isl} onClick={() => setIsl(id)}>
                        {latest.islands[id].name}
                      </button>
                    ))}
                  </div>
                  {AVAILABLE.has(isl) && HAS_WEBGL && (
                    <a className="btn primary small" href={href.island(isl)}>
                      {t("home.open3d")} <IconArrow />
                    </a>
                  )}
                </div>
                <div className="strip" role="img" aria-label={`${latest.islands[isl].name}: ${t("home.panelTitle")}`}>
                  {latest.islands[isl].year_max_dhw.map((v, i) => (
                    <i key={i} style={{ background: rampCSS(v) }} title={`${latest.years[i]}: ${fmtNum(v, lang)} ${t("unit.dhw")}`} />
                  ))}
                </div>
                <div className="strip-axis num">
                  {latest.years.filter((y, i) => i === 0 || y % 10 === 0 || i === latest.years.length - 1).map((y) => (
                    <span key={y} style={{ left: `${((latest.years.indexOf(y) + 0.5) / latest.years.length) * 100}%` }}>
                      {y}
                    </span>
                  ))}
                </div>
                <p className="strip-note">
                  {t("home.panelHint").replace("{a}", String(latest.years[0])).replace("{b}", String(latest.years[latest.years.length - 1]))}
                </p>
              </div>
            </div>
          )}
          <span className="art-credit">{t("home.artCredit")}</span>
        </div>
      </section>
    <main className="page">
      {!HAS_WEBGL && (
        <p className="note" style={{ marginTop: 24 }}>
          <b>{t("nowebgl.title")}.</b> {t("nowebgl.body")}
        </p>
      )}

      <section className="section">
        <figure className="figure">
          <p className="fig-title">
            <span className="fig-n">{t("fig")} 1</span> {t("home.fig1Title")}
          </p>
          <p className="fig-sub">{t("home.fig1Sub").replace("{date}", date)}</p>
          <ArchipelagoMap latest={latest} />
          <div className="fig-foot">
            <HeatKey />
            <p className="fig-caption">{t("home.fig1Caption")}</p>
          </div>
          <p className="fig-source">{t("home.fig1Source")}</p>
        </figure>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{accent(t("home.cardsTitle"))}</h2>
          <p>{t("home.cardsLead")}</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("table.island")}</th>
              <th className="r">{t("table.dhw")}</th>
              <th>{t("table.level")}</th>
              <th className="r">{t("table.sst")}</th>
              <th>{t("table.last120")}</th>
              <th className="r">{t("table.worst")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ORDER.map((id) => {
              const s = latest?.islands[id];
              if (!s) return null;
              const ri = s.year_max_dhw.indexOf(Math.max(...s.year_max_dhw));
              const ok = AVAILABLE.has(id) && HAS_WEBGL;
              return (
                <tr key={id}>
                  <td className="name">{s.name}</td>
                  <td className="r" data-label={t("table.dhw")}>
                    {fmtNum(s.dhw, lang)}
                  </td>
                  <td data-label={t("table.level")}>
                    <AlertChip dhw={s.dhw} />
                  </td>
                  <td className="r" data-label={t("table.sst")}>
                    {fmtNum(s.sst, lang)} °C
                  </td>
                  <td data-label={t("table.last120")}>
                    <Sparkline values={s.recent_dhw} label={`${s.name}: ${t("table.last120")}`} />
                  </td>
                  <td className="r" data-label={t("table.worst")}>
                    {latest!.years[ri]} ({fmtNum(s.year_max_dhw[ri], lang)})
                  </td>
                  <td className="action">
                    {ok ? (
                      <a className="arrow-link" href={href.island(id)}>
                        {t("home.enter3d")} <IconArrow />
                      </a>
                    ) : (
                      <span className="faint" style={{ fontSize: 14 }}>
                        {t("home.soon3d")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="fig-source" style={{ marginTop: 10 }}>
          {t("home.tableNote")}
        </p>
      </section>

      {latest && (
        <section className="section">
          <figure className="figure">
            <p className="fig-title">
              <span className="fig-n">{t("fig")} 2</span> {t("home.stripesTitle")}
            </p>
            <p className="fig-sub">{t("home.stripesLead")}</p>
            <HeatStripes latest={latest} onPick={() => (location.hash = href.heat)} />
            <div style={{ marginTop: 12 }}>
              <HeatKey compact />
            </div>
            <p className="fig-source">{t("home.fig1Source")}</p>
          </figure>
        </section>
      )}

      <section className="section">
        <p className="note">
          <b>{t("home.noteTitle")}</b> {t("home.caveat")}
        </p>
      </section>
    </main>
    </>
  );
}

/** Decorative bathymetric contour lines for the title band (deterministic, no data implied). */

/** A small laurel sprig for the hero badge (drawn, not an icon font). */
function Laurel({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 28" width="14" height="24" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M12 26C6 22 3.5 15 5 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {[5, 10, 15, 20].map((y, i) => (
        <ellipse key={y} cx={i < 2 ? 3.4 : 4.6 + i} cy={y} rx="2.6" ry="1.5" fill="currentColor" transform={`rotate(${-50 + i * 14} ${i < 2 ? 3.4 : 4.6 + i} ${y})`} />
      ))}
    </svg>
  );
}
