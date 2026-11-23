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
import { IconArrow, IconPlay } from "../ui/Icons";
import { Sparkline } from "../ui/Sparkline";
import { SpecularButton } from "../ui/SpecularButton";
import { HAS_WEBGL } from "../webgl";

// The dotted sea (hero background) loads after the first paint.
const DottedSea = lazy(() => import("../ui/DottedSea"));
// The demo video's window: its own chunk, loaded (with the video) only when "Watch the demo" is pressed.
const DemoVideo = lazy(() => import("../ui/DemoVideo"));
// The headline's wave (floodtext) too: a plain headline with the same text shows until it loads.
// The headline wave: weight swells (Inter only; the serif line has no weight axis), letters rise
// and settle a few pixels like a passing swell, and they dim only slightly (never below ~88%:
// the library's own opacity effect went down to ~40% and made words hard to read).
const FLOOD_PROPS = [
  { property: "opacity", base: 0.94, amplitude: 0.06, clamp: [0.88, 1] as [number, number] },
  { property: "--ft-y", base: 0, amplitude: 0.035, unit: "em" },
];
const FloodText = lazy(() => import("@overpunch/floodtext").then((m) => ({ default: m.FloodText })));

export function Home() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [latest, setLatest] = useState<Latest | null>(null);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    loadLatest().then(setLatest).catch(() => {});
  }, []);
  const date = latest ? fmtDate(latest.date, lang, { day: "numeric", month: "long", year: "numeric" }) : "…";
  const [isl, setIsl] = useState("roatan");
  // floodtext locks the headline's line breaks while it runs and re-reads them only when its
  // container's width changes; the headline's size follows the window, so re-measure on any
  // change of window width (not height: phones change it while scrolling).
  const [fit, setFit] = useState(0);
  useEffect(() => {
    let last = window.innerWidth, timer = 0;
    const on = () => {
      if (window.innerWidth === last) return;
      last = window.innerWidth;
      clearTimeout(timer);
      timer = window.setTimeout(() => setFit((k) => k + 1), 200);
    };
    addEventListener("resize", on);
    return () => {
      removeEventListener("resize", on);
      clearTimeout(timer);
    };
  }, []);


  return (
    <div className="home">
      <section className="hero-wrap">
        <div className="hero-frame">
          <Suspense fallback={null}>
            <DottedSea />
          </Suspense>
          <div className="hero-guides" aria-hidden="true" />
          <div className="hero-content">
            <p className="hero-badge">
              <Laurel />
              {/* Each half stays whole on phones ("Arrecife Mesoamericano" never splits). */}
              <span>
                {t("home.badge")
                  .split(" · ")
                  .map((part, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      <span className="nw">{part}</span>
                    </span>
                  ))}
              </span>
              <Laurel flip />
            </p>
            {/* The headline breathes: a slow wave of weight (Inter is a variable font), a gentle rise and a slight dimming
                runs through it letter by letter (floodtext, Tulio's pick). Remounted per language and
                window width, since the library rewraps the letters and locks the lines. Static with reduced motion. */}
            <Suspense fallback={<h1>{accent(t("home.title"))}</h1>}>
              <FloodText as="h1" key={`${lang}-${fit}`} effect="wght" amplitude={140} properties={FLOOD_PROPS} period={6} density={1.1} direction="diagonal-down">
                {accent(t("home.title"))}
              </FloodText>
            </Suspense>
            <p className="hero-sub">{t("home.sub")}</p>
            {/* Computers, one row: the demo, the islands (white, the most prominent), Learn. Phones
                stack them Learn, islands, demo (the islands in the middle; Tulio's order). */}
            <div className="hero-actions">
              <button type="button" className="btn primary hero-demo" onClick={() => setDemo(true)}>
                <IconPlay /> {t("home.ctaDemo")}
              </button>
              {HAS_WEBGL && (
                <SpecularButton href={href.islands} className="btn light hero-cta" lineColor="#2f86ff" baseColor="#9cc6ff" intensity={1.8} glow={1.8} thickness={1.8}>
                  {t("home.ctaIslands")} <IconArrow />
                </SpecularButton>
              )}
              <a className="btn primary hero-learn" href={href.lessons}>
                {t("home.ctaLearn")} <IconArrow />
              </a>
            </div>
            {demo && (
              <Suspense fallback={null}>
                <DemoVideo onClose={() => setDemo(false)} />
              </Suspense>
            )}
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
                    <SpecularButton href={href.island(isl)} className="btn primary small" lineColor="#ffffff" baseColor="#bfe0ff">
                      {t("home.open3d")} <IconArrow />
                    </SpecularButton>
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
        </div>
      </section>
    <main className="page">
      {!HAS_WEBGL && (
        <p className="note" style={{ marginTop: 24 }}>
          <b>{t("nowebgl.title")}.</b> {t("nowebgl.body")}
        </p>
      )}

      <section className="section">
        <figure className="figure window">
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

      <section className="section window">
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
                  {/* No 3D link, no label: an island without a 3D scene (Cayos Cochinos: the habitat
                      atlas has no data there) just has an empty cell. It used to say "3D coming
                      soon", which promised something we can't build yet (Tulio). */}
                  <td className="action">
                    {ok && (
                      <a className="arrow-link" href={href.island(id)}>
                        {t("home.enter3d")} <IconArrow />
                      </a>
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
          <figure className="figure window">
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
    </div>
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
