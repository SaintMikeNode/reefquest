import { useEffect, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { loadLatest, type Latest } from "../lib/data";
import { ISLAND_ORDER as ORDER, SCENE_ISLANDS as AVAILABLE } from "../lib/islands";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { ArchipelagoMap } from "../ui/ArchipelagoMap";
import { HeroRelief } from "../ui/Bathymetry";
import { HeatKey } from "../ui/HeatKey";
import { HeatStripes } from "../ui/HeatStripes";
import { IconArrow } from "../ui/Icons";
import { Sparkline } from "../ui/Sparkline";
import { HAS_WEBGL } from "../webgl";

export function Home() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => {
    loadLatest().then(setLatest).catch(() => {});
  }, []);
  const date = latest ? fmtDate(latest.date, lang, { day: "numeric", month: "long", year: "numeric" }) : "…";

  let rec = { name: "", year: 0, v: 0 };
  if (latest)
    for (const isl of Object.values(latest.islands))
      isl.year_max_dhw.forEach((v, i) => {
        if (v > rec.v) rec = { name: isl.name, year: latest.years[i], v };
      });

  return (
    <>
      <section className="hero-band">
        <HeroRelief />
        <p className="relief-credit">{t("home.reliefCredit")}</p>
        <div className="inner split">
          <div>
            <p className="eyebrow kicker-page">{t("home.kicker")}</p>
            <h1>{t("home.title")}</h1>
            <p className="standfirst">{t("home.sub")}</p>
            <div className="hero-actions">
              {HAS_WEBGL && (
                <a className="btn primary" href={href.island("roatan")}>
                  {t("home.ctaRoatan")} <IconArrow />
                </a>
              )}
              <a className="btn" href={href.heat}>
                {t("nav.heat")}
              </a>
            </div>
          </div>
          {latest && (
            <dl className="summary">
              <div>
                <dt>{t("home.sumDate")}</dt>
                <dd className="num">{date}</dd>
              </div>
              <div>
                <dt>{t("home.sumRecord")}</dt>
                <dd className="num">
                  {rec.year} · {rec.name} · {fmtNum(rec.v, lang)} {t("unit.dhw")}
                </dd>
              </div>
              <div>
                <dt>{t("home.sumSpan")}</dt>
                <dd className="num">
                  {latest.years[0]}–{latest.years[latest.years.length - 1]}
                </dd>
              </div>
            </dl>
          )}
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
          <h2>{t("home.cardsTitle")}</h2>
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
