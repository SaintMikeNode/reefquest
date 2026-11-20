import { useEffect, useState } from "react";
import { fmtDate, fmtNum, useLang, useT } from "../i18n";
import { loadLatest, type Latest } from "../lib/data";
import { ISLAND_ORDER as ORDER, SCENE_ISLANDS as AVAILABLE } from "../lib/islands";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { ArchipelagoMap } from "../ui/ArchipelagoMap";
import { HeatStripes } from "../ui/HeatStripes";
import { Sparkline } from "../ui/Sparkline";
import { levelFor } from "../lib/alert";
import { HAS_WEBGL } from "../webgl";


export function Home() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [latest, setLatest] = useState<Latest | null>(null);
  useEffect(() => {
    loadLatest().then(setLatest).catch(() => {});
  }, []);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="label">{t("home.kicker")}</div>
          <h1 className="hero-title">
            {t("home.title1")}
            <br />
            <em>{t("home.title2")}</em>
          </h1>
          <p className="hero-sub">{t("home.sub")}</p>
          <div className="hero-meta">
            <span className="label">
              {t("home.dataThrough")} <span style={{ color: "var(--cyan)" }}>{latest ? fmtDate(latest.date, lang) : "…"}</span>
            </span>
            <span className="label">15.8–16.6°N · 85.7–87.1°W</span>
          </div>
        </div>
        {latest && <HeroStats latest={latest} />}
        {!HAS_WEBGL && (
          <div className="panel caveat">
            <strong>{t("nowebgl.title")}</strong> {t("nowebgl.body")}
          </div>
        )}
        <ArchipelagoMap latest={latest} />
      </section>

      <section className="section">
        <h2>{t("home.cardsTitle")}</h2>
        <p className="lead">{t("home.cardsLead")}</p>
        <div className="cards">
          {ORDER.map((id) => {
            const s = latest?.islands[id];
            const ok = AVAILABLE.has(id) && HAS_WEBGL;
            const recordIdx = s ? s.year_max_dhw.indexOf(Math.max(...s.year_max_dhw)) : -1;
            const trend = s ? s.dhw - s.dhw_7d_ago : 0;
            return (
              <article className="panel card" key={id}>
                <h3>
                  {s?.name ?? "…"}
                  {s && <AlertChip dhw={s.dhw} />}
                </h3>
                <div className="row">
                  <div className="big">
                    {s ? fmtNum(s.dhw, lang) : "–"}
                    <small>{t("card.unit")}</small>
                  </div>
                  {s && (
                    <span className="mono dim" style={{ fontSize: 13 }} title={t("card.week")}>
                      {trend > 0.05 ? "▲" : trend < -0.05 ? "▼" : "■"} {fmtNum(Math.abs(trend), lang)}
                    </span>
                  )}
                </div>
                {s && <Sparkline values={s.recent_dhw} label={`${s.name}: ${t("card.last120")}`} />}
                {s && (
                  <div className="stats">
                    <div>
                      <span>{t("card.sst")}</span>
                      {fmtNum(s.sst, lang)} °C
                    </div>
                    <div>
                      <span>{t("card.max")}</span>
                      {fmtNum(s.dhw_max, lang)}
                    </div>
                    <div>
                      <span>{t("card.record")}</span>
                      {latest!.years[recordIdx]} · {fmtNum(s.year_max_dhw[recordIdx], lang)}
                    </div>
                    <div>
                      <span>{t("card.last120")}</span>
                      {fmtNum(Math.max(...s.recent_dhw) / 10, lang)} max
                    </div>
                  </div>
                )}
                <div className="actions">
                  {ok ? (
                    <a className="btn primary" href={href.island(id)}>
                      {t("home.enter3d")} →
                    </a>
                  ) : (
                    <span className="btn" aria-disabled="true" style={{ opacity: 0.55, cursor: "default" }}>
                      {t("home.soon3d")}
                    </span>
                  )}
                  <a className="btn ghost" href={href.heat}>
                    {t("home.seeHistory")}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {latest && (
        <section className="section">
          <h2>{t("home.stripesTitle")}</h2>
          <p className="lead">{t("home.stripesLead")}</p>
          <div className="panel" style={{ padding: 16 }}>
            <HeatStripes latest={latest} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="panel caveat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>{t("home.caveat")}</span>
        </div>
      </section>
    </main>
  );
}

/** Instrument-style readout beside the title on wide screens. */
function HeroStats({ latest }: { latest: Latest }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  let rec = { name: "", year: 0, v: 0 };
  for (const isl of Object.values(latest.islands))
    isl.year_max_dhw.forEach((v, i) => {
      if (v > rec.v) rec = { name: isl.name, year: latest.years[i], v };
    });
  const hottest = Object.values(latest.islands).sort((a, b) => b.dhw - a.dhw)[0];
  const rows: [string, string, string?][] = [
    [t("hero.now"), `${hottest.name} · ${fmtNum(hottest.dhw, lang)} DHW`, levelFor(hottest.dhw).color],
    [t("hero.record"), `${rec.year} · ${rec.name} · ${fmtNum(rec.v, lang)} DHW`, levelFor(rec.v).color],
    [t("hero.span"), `${latest.years[0]}–${latest.years[latest.years.length - 1]} · ${latest.years.length} ${t("hero.years")}`],
    [t("hero.res"), "5 km · 5 m · 30 m"],
  ];
  return (
    <aside className="panel hero-stats">
      {rows.map(([k, v, c]) => (
        <div key={k}>
          <span className="label">{k}</span>
          <span className="mono" style={c ? { color: c } : undefined}>
            {v}
          </span>
        </div>
      ))}
    </aside>
  );
}
