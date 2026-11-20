import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadZoneIndex, zoneName, type ZoneIndexEntry } from "../boat/zone";
import { SITES } from "../content/sites";
import { fmtNum, rich, useL, useLang, useT } from "../i18n";
import { levelFor, rampCSS } from "../lib/alert";
import type { HeatIndex } from "../lib/data";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { HeatKey } from "../ui/HeatKey";
import { IconArrow, IconBack, IconCheck, IconHelp, IconHome, IconLayers, IconShip } from "../ui/Icons";
import { LangToggle } from "../ui/LangToggle";
import { MouseGuide } from "./MouseGuide";
import { dhwAt } from "./heatLookup";
import { BENTHIC, GEOMORPHIC } from "./materials";
import { useScene } from "./sceneStore";
import { fmtLat, fmtLon, SiteCard } from "./SiteCard";
import { homeDistance, uvToLonLat, xzToUV, type TerrainData } from "./terrain";
import { Timeline } from "./Timeline";
import { useBottomInset } from "./useBottomInset";

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
  const [open, setOpen] = useState<SectionId | null>("layers");
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
        <div className="kicker">{t("scene.region")}</div>
        <h1>{td.meta.name}</h1>
        <div className="coords">
          {fmtLat(here.lat, lang)} · {fmtLon(here.lon, lang)}
        </div>
        {layers.heat && <HeatStatus dhw={areaDhw} />}
        <a className="back-btn" href={href.home}>
          <IconBack /> {t("scene.back")}
        </a>
      </header>

      <div className="hud tools">
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

      <aside className={showLayers ? "hud hud-left panel" : "hud hud-left panel collapsed"}>
        {/* Two tabs that are always visible: opening one closes the other; the open one closes on a second tap. */}
        <div className="panel-tabs" role="tablist">
          <button role="tab" aria-selected={open === "layers"} onClick={() => setOpen(open === "layers" ? null : "layers")}>
            <IconLayers /> {t("scene.layers")}
          </button>
          {zones.length > 0 && (
            <button role="tab" aria-selected={open === "boat"} onClick={() => setOpen(open === "boat" ? null : "boat")}>
              <IconShip /> {t("boat.zones")}
            </button>
          )}
        </div>
        {open === "layers" && (
          <div className="acc-body" role="tabpanel">
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
              {r.key && layers[r.k] && <div className="layer-key">{r.key}</div>}
            </div>
          ))}
          <p className="panel-note">
            {t("scene.modelNote")} {t("scene.exaggeration")} {td.meta.bathymetry_source !== "aca-bathymetry" && t("scene.depthModel")}{" "}
            <a href={href.about}>{t("scene.aboutData")}</a>
          </p>
          </div>
        )}
        {open === "boat" && zones.length > 0 && (
          <div className="acc-body" role="tabpanel">
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
      </aside>

      {site ? (
        <SiteCard
          site={site}
          onClose={() => setSite(null)}
          actions={
            siteZone && (
              <button className="card-chip" onClick={() => setBoat({ zone: siteZone.id, lon: site.lon, lat: site.lat })}>
                <IconShip /> {t("boat.explore")} <IconArrow />
              </button>
            )
          }
        />
      ) : (
        <aside className="hud hud-right panel readout-panel" aria-live="off">
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
        </aside>
      )}

      {/* First-visit guide: above every other panel, on a dim backdrop (a click on it closes the guide). */}
      {hint && <div className="hud hint-scrim" onClick={closeHint} aria-hidden="true" />}
      {hint && (
        <div className="hud hint panel" role="dialog" aria-modal="true" aria-labelledby="guide-title">
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
        </div>
      )}

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
        <span className="desc">{t(`alert.${lv.key}.desc`)}</span>
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
