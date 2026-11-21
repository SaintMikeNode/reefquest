import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadZoneIndex, zoneName, type ZoneIndexEntry } from "../boat/zone";
import { SITES } from "../content/sites";
import { fmtNum, rich, useL, useLang, useT } from "../i18n";
import { LEVELS, levelFor, rampCSS } from "../lib/alert";
import { loadYearGrid, type HeatIndex } from "../lib/data";
import { REDUCED_MOTION } from "../lib/device";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { HeatKey } from "../ui/HeatKey";
import { IconArrow, IconBack, IconCheck, IconHelp, IconHome, IconLayers, IconShip } from "../ui/Icons";
import { LangToggle } from "../ui/LangToggle";
import { SpecularButton } from "../ui/SpecularButton";
import { LiquidTabs } from "../ui/LiquidTabs";
import { centeredMotion, fadeMotion, panelMotion } from "../ui/motionPresets";
import { MouseGuide } from "./MouseGuide";
import { dhwAt } from "./heatLookup";
import { BENTHIC, GEOMORPHIC } from "./materials";
import { useScene } from "./sceneStore";
import { fmtLat, fmtLon, SiteCard } from "./SiteCard";
import { homeDistance, uvToLonLat, xzToUV, type TerrainData } from "./terrain";
import { Timeline } from "./Timeline";
import { useBottomInset, useWidthVar } from "./useBottomInset";

/** The boat zone containing a lon/lat, if any. */
export function zoneFor(zones: ZoneIndexEntry[], lon: number, lat: number): ZoneIndexEntry | undefined {
  return zones.find((z) => {
    const dx = (lon - z.lon) * 111320 * Math.cos((lat * Math.PI) / 180);
    const dy = (lat - z.lat) * 110570;
    return Math.abs(dx) < z.size_m[0] / 2 - 120 && Math.abs(dy) < z.size_m[1] / 2 - 120;
  });
}

const HINT_KEY = "rq-guide-1";

export function Hud({ td, index }: { td: TerrainData; index: HeatIndex }) {
  const t = useT();
  const L = useL();
  const lang = useLang((s) => s.lang);
  const layers = useScene((s) => s.layers);
  const toggle = useScene((s) => s.toggle);
  const readout = useScene((s) => s.readout);
  const day = useScene((s) => s.day);
  const siteId = useScene((s) => s.site);
  const setSite = useScene((s) => s.setSite);
  const fly = useScene((s) => s.fly);
  const setBoat = useScene((s) => s.setBoat);
  const areaDhw = useScene((s) => s.areaDhw);
  const [showLayers, setShowLayers] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useWidthVar(toolsRef, "--tools-w");
  const [open, setOpen] = useState<SectionId>("layers");
  const [zones, setZones] = useState<ZoneIndexEntry[]>([]);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });
  useEffect(() => {
    loadZoneIndex(td.meta.island).then(setZones).catch(() => setZones([]));
  }, [td.meta.island]);
  const closeHint = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* storage blocked */
    }
  };
  // Intro: on entering an island, play the current year from 1 January to today (~5 s, a little
  // slower than normal playback so the heat changes ease in), ending on the latest day, so the
  // timeline and the heat on the map are seen moving at once. It waits for
  // the transition curtain and the first-visit guide, preloads the year's grid, and doesn't start
  // if the visitor has already moved the timeline. Skipped with reduced motion.
  useEffect(() => {
    if (hint || REDUCED_MOTION || !useScene.getState().introPending) return;
    const last = index.years[index.years.length - 1];
    const years = [last];
    let live = true, raf = 0;
    const untouched = () => {
      const s = useScene.getState();
      return s.year === last.year && s.day === last.days - 1 && !s.playing && !s.boat;
    };
    const start = () => {
      if (!live) return;
      if (document.querySelector(".curtain, .loading-screen")) {
        raf = requestAnimationFrame(start);
        return;
      }
      useScene.setState(untouched() ? { year: years[0].year, day: 0, playing: true, intro: true, introPending: false } : { introPending: false });
    };
    Promise.all(years.map((y) => loadYearGrid(y.year).catch(() => {}))).then(() => {
      if (live) raf = requestAnimationFrame(start);
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [hint, index]);
  const site = SITES.find((s) => s.id === siteId);
  const siteZone = site ? zoneFor(zones, site.lon, site.lat) : undefined;
  const dhw = readout ? dhwAt(index, readout.lon, readout.lat, day) : null;
  const { u, v } = xzToUV(td, td.center.x, td.center.z);
  const here = uvToLonLat(td, u, v);

  const rows: { k: keyof typeof layers; sw: ReactNode; what: string; key?: ReactNode }[] = [
    {
      k: "habitat",
      sw: <Swatch colors={[BENTHIC[11].color, BENTHIC[14].color, BENTHIC[13].color, BENTHIC[15].color]} />,
      what: t("scene.layer.habitat.what"),
      key: (
        <div className="key-cats">
          {Object.values(BENTHIC).map((c) => (
            <span key={c.color}>
              <i style={{ background: c.color }} />
              {L(c)}
            </span>
          ))}
        </div>
      ),
    },
    {
      k: "heat",
      sw: <Swatch colors={[0, 2, 4, 8, 12, 20].map((d) => rampCSS(d))} />,
      what: t("scene.layer.heat.what"),
      key: <HeatKey compact />,
    },
    {
      k: "contours",
      sw: (
        <svg className="sw" viewBox="0 0 26 18" aria-hidden="true" style={{ background: "#0a3550" }}>
          {[4, 9, 14].map((y) => (
            <path key={y} d={`M-2 ${y} C 6 ${y - 4}, 14 ${y + 4}, 28 ${y - 1}`} stroke="#6fe0ee" strokeWidth="1" fill="none" opacity={0.85} />
          ))}
        </svg>
      ),
      what: t("scene.layer.contours.what"),
    },
    {
      k: "sites",
      sw: (
        <svg className="sw" viewBox="0 0 26 18" aria-hidden="true" style={{ background: "#0a3550" }}>
          <rect x="5" y="5" width="6" height="6" transform="rotate(45 8 8)" fill="#ff8a6e" />
          <circle cx="19" cy="10" r="2.6" fill="#8fc3f0" />
        </svg>
      ),
      what: t("scene.layer.sites.what"),
    },
  ];

  return (
    <>
      <div className="scrim-top" />
      <div className="scrim-bottom" />

      <header className="hud plate">
        {/* The way back comes first, above the name (Tulio: on top of everything). On phones it
            shares its row with the tools and takes only the room they leave (--tools-w). */}
        <a className="back-btn" href={href.islands}>
          <IconBack />
          {/* Screens narrower than 360 px show the short label (styles.css). */}
          <span className="lbl">
            <span className="back-long">{t("scene.back")}</span>
            <span className="back-short">{t("scene.backShort")}</span>
          </span>
        </a>
        <div className="kicker">{t("scene.region")}</div>
        <h1>{td.meta.name}</h1>
        <div className="coords">
          {fmtLat(here.lat, lang)} · {fmtLon(here.lon, lang)}
        </div>
        {layers.heat && <HeatStatus dhw={areaDhw} />}
      </header>

      <div ref={toolsRef} className="hud tools">
        <button className="hbtn icon-only layers-toggle" aria-pressed={showLayers} onClick={() => setShowLayers(!showLayers)} aria-label={t("scene.layers")} title={t("scene.layers")}>
          <IconLayers />
        </button>
        <button className="hbtn icon-only" onClick={() => setHint(true)} aria-label={t("scene.help")} title={t("scene.help")}>
          <IconHelp />
        </button>
        <button className="hbtn icon-only" onClick={() => fly(td.center.x, td.center.z, homeDistance(td), true)} title={t("scene.reset")} aria-label={t("scene.reset")}>
          <IconHome />
        </button>
        <LangToggle />
      </div>

      <aside className={showLayers ? "hud hud-left liquid" : "hud hud-left liquid collapsed"}>
        {/* Liquid tabs: one is always open; switching flows the tab across and slides the content. */}
        <LiquidTabs
          label={t("scene.layers")}
          active={zones.length > 0 ? open : "layers"}
          onSelect={(id) => setOpen(id as SectionId)}
          tabs={[
            { id: "layers", icon: <IconLayers />, label: t("scene.layers") },
            ...(zones.length > 0 ? [{ id: "boat", icon: <IconShip />, label: t("boat.zones") }] : []),
          ]}
        >
          {open === "layers" || zones.length === 0 ? (
            <div className="acc-body">
              {rows.map((r) => (
                <div key={r.k}>
                  <button className="layer" aria-pressed={layers[r.k]} onClick={() => toggle(r.k)}>
                    {r.sw}
                    <span className="name">{t(`scene.layer.${r.k}`)}</span>
                    <span className="check">
                      <IconCheck />
                    </span>
                    <span className="what">{r.what}</span>
                  </button>
                  <div className={r.key && layers[r.k] ? "layer-key-wrap open" : "layer-key-wrap"}>
                    <div className="layer-key-inner">{r.key && <div className="layer-key">{r.key}</div>}</div>
                  </div>
                </div>
              ))}
              <p className="panel-note">
                {t("scene.modelNote")} {t("scene.exaggeration")} {td.meta.bathymetry_source !== "aca-bathymetry" && t("scene.depthModel")}{" "}
                <a href={href.about}>{t("scene.aboutData")}</a>
              </p>
            </div>
          ) : (
            <div className="acc-body">
              <p className="notes" style={{ margin: "0 0 4px" }}>
                {t("boat.zonesLead")}
              </p>
              {zones.map((z) => (
                <button key={z.id} className="zone-row" onClick={() => setBoat({ zone: z.id, lon: z.lon, lat: z.lat })}>
                  {zoneName(z, lang)}
                  <span className="go">
                    <IconShip /> {t("boat.go")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </LiquidTabs>
      </aside>

      <AnimatePresence initial={false}>
      {site ? (
        <SiteCard
          key={site.id}
          site={site}
          onClose={() => setSite(null)}
          actions={
            siteZone && (
              <SpecularButton className="card-chip" onClick={() => setBoat({ zone: siteZone.id, lon: site.lon, lat: site.lat })} lineColor="#ffffff" baseColor="#bfe0ff">
                <IconShip />
                <span className="chip-long">{t("boat.explore")}</span>
                <span className="chip-short">{t("boat.exploreShort")}</span>
                <IconArrow />
              </SpecularButton>
            )
          }
        />
      ) : (
        <motion.aside key="readout" className="hud hud-right panel readout-panel" aria-live="off" {...panelMotion}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            {t("scene.readout")}
          </div>
          {readout ? (
            <dl className="readout">
              <dt>{t("scene.lat")}</dt>
              <dd>{fmtLat(readout.lat, lang)}</dd>
              <dt>{t("scene.lon")}</dt>
              <dd>{fmtLon(readout.lon, lang)}</dd>
              <dt>{readout.h >= 0 ? t("scene.elev") : t("scene.depth")}</dt>
              <dd>{fmtNum(Math.abs(readout.h), lang, readout.h > -30 ? 1 : 0)} m</dd>
              {readout.benthic > 0 && (
                <>
                  <dt>{t("scene.habitat")}</dt>
                  <dd className="txt">{BENTHIC[readout.benthic] ? L(BENTHIC[readout.benthic]) : "–"}</dd>
                </>
              )}
              {readout.geomorphic > 0 && (
                <>
                  <dt>{t("scene.zone")}</dt>
                  <dd className="txt">{GEOMORPHIC[readout.geomorphic] ? L(GEOMORPHIC[readout.geomorphic]) : "–"}</dd>
                </>
              )}
              {dhw !== null && (
                <>
                  <dt>{t("scene.dhw")}</dt>
                  <dd>
                    {fmtNum(dhw, lang)} {t("unit.dhw")}
                  </dd>
                  <dt />
                  <dd>
                    <AlertChip dhw={dhw} />
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="hud-faint" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45 }}>
              {t("scene.hover")}
            </p>
          )}
        </motion.aside>
      )}
      </AnimatePresence>

      {/* First-visit guide: above every other panel, on a dim backdrop (a click on it closes the guide). */}
      <AnimatePresence>
      {hint && <motion.div key="scrim" className="hud hint-scrim" onClick={closeHint} aria-hidden="true" {...fadeMotion} />}
      {hint && (
        <motion.div key="guide" className="hud hint panel" role="dialog" aria-modal="true" aria-labelledby="guide-title" {...centeredMotion}>
          <div>
            <div className="kicker">{td.meta.name}</div>
            <h2 id="guide-title">{t("scene.guideTitle")}</h2>
          </div>
          <ol>
            {(["scene.guide1", "scene.guide2", "scene.guide3", "scene.guide4"] as const).map((k) => (
              <li key={k}>
                <span>{rich(t(k))}</span>
              </li>
            ))}
          </ol>
          <div className="actions">
            <button className="hbtn primary" onClick={closeHint} autoFocus>
              {t("scene.guideStart")} <IconArrow />
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* The mouse controls card waits until the first-visit guide is closed (it covered the guide). */}
      {!siteId && !hint && (
        <MouseGuide
          items={[
            { part: "left", label: t("scene.mouse.move"), how: t("scene.mouse.moveHow") },
            { part: "left", key: "Shift", label: t("scene.mouse.rotate"), how: t("scene.mouse.rotateHow") },
            { part: "wheel", label: t("scene.mouse.zoom"), how: t("scene.mouse.zoomHow") },
          ]}
        />
      )}
      <div className="hud attribution">{t("scene.attribution")}</div>

      <TimeBar>
        <Timeline index={index} island={td.meta.island} />
      </TimeBar>
    </>
  );
}

/** The timeline panel. Its height (which changes with the window width and language) is published
 * as --tb on the scene, so the layers panel, site card and credits always stop above it. */
function TimeBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useBottomInset(ref, "--tb");
  return (
    <div ref={ref} className="hud timebar panel">
      {children}
    </div>
  );
}

/** The alert level in NOAA's words, colored by severity (calm years read calm, bad years read alarming). */
export function HeatStatus({ dhw, prefix }: { dhw: number | null; prefix?: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  if (dhw === null) return null;
  const lv = levelFor(dhw);
  const severe = lv.min >= 4;
  return (
    <div className={severe ? "heat-status severe" : "heat-status"} style={{ "--c": lv.color } as React.CSSProperties} role="status">
      <i />
      <span>
        {prefix && <span className="pre">{prefix} · </span>}
        <b>{t(`alert.${lv.key}`)}</b> · <span className="nw">{fmtNum(dhw, lang)} {t("unit.dhw")}</span>
        {/* Every level's description stacked in one cell, only the current one shown: the line keeps
            the height of the longest, so nothing below it moves while the timeline plays. */}
        <span className="desc">
          {LEVELS.map((l) => (
            <span key={l.key} className={l.key === lv.key ? "on" : undefined} aria-hidden={l.key !== lv.key}>
              {t(`alert.${l.key}.desc`)}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span className="sw" aria-hidden="true" style={{ display: "flex" }}>
      {colors.map((c, i) => (
        <span key={i} style={{ flex: 1, background: c }} />
      ))}
    </span>
  );
}

type SectionId = "layers" | "boat";
