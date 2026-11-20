import { useEffect, useState } from "react";
import { loadZoneIndex, zoneName, type ZoneIndexEntry } from "../boat/zone";
import { SITES } from "../content/sites";
import { fmtNum, useL, useLang, useT } from "../i18n";
import type { HeatIndex } from "../lib/data";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { HeatKey } from "../ui/HeatKey";
import { IconBack, IconHome, IconLayers, IconShip } from "../ui/Icons";
import { LangToggle } from "../ui/LangToggle";
import { dhwAt } from "./heatLookup";
import { BENTHIC, GEOMORPHIC } from "./materials";
import { useScene } from "./sceneStore";
import { fmtLat, fmtLon, SiteCard } from "./SiteCard";
import { homeDistance, type TerrainData } from "./terrain";
import { Timeline } from "./Timeline";

/** The boat zone containing a lon/lat, if any. */
export function zoneFor(zones: ZoneIndexEntry[], lon: number, lat: number): ZoneIndexEntry | undefined {
  return zones.find((z) => {
    const dx = (lon - z.lon) * 111320 * Math.cos((lat * Math.PI) / 180);
    const dy = (lat - z.lat) * 110570;
    return Math.abs(dx) < z.size_m[0] / 2 - 120 && Math.abs(dy) < z.size_m[1] / 2 - 120;
  });
}

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
  const [showLayers, setShowLayers] = useState(false);
  const [open, setOpen] = useState<"layers" | "legend" | "boat">("layers");
  const [zones, setZones] = useState<ZoneIndexEntry[]>([]);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem("rq-hint");
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
      localStorage.setItem("rq-hint", "1");
    } catch {
      /* storage blocked */
    }
  };
  const site = SITES.find((s) => s.id === siteId);
  const siteZone = site ? zoneFor(zones, site.lon, site.lat) : undefined;
  const dhw = readout ? dhwAt(index, readout.lon, readout.lat, day) : null;

  const rows: { k: keyof typeof layers; label: string }[] = [
    { k: "habitat", label: t("scene.layer.habitat") },
    { k: "heat", label: t("scene.layer.heat") },
    { k: "contours", label: t("scene.layer.contours") },
    { k: "sites", label: t("scene.layer.sites") },
  ];

  return (
    <>
      <div className="hud hud-top">
        <div className="group">
          <a className="hbtn" href={href.home}>
            <IconBack /> <span className="hide-sm">{t("scene.back")}</span>
          </a>
          <div className="panel title-block">
            <div className="hud-label">{t("scene.region")}</div>
            <h1>{td.meta.name}</h1>
          </div>
        </div>
        <div className="group">
          <button className="hbtn layers-toggle" aria-pressed={showLayers} onClick={() => setShowLayers(!showLayers)} aria-label={t("scene.layers")}>
            <IconLayers />
          </button>
          <button className="hbtn icon-only" onClick={() => fly(td.center.x, td.center.z, homeDistance(td), true)} title={t("scene.reset")} aria-label={t("scene.reset")}>
            <IconHome />
          </button>
          <LangToggle />
        </div>
      </div>

      <aside className={showLayers ? "hud hud-left panel" : "hud hud-left panel collapsed"}>
        <Section id="layers" title={t("scene.layers")} open={open} setOpen={setOpen}>
          {rows.map((r) => (
            <button key={r.k} className="toggle" aria-pressed={layers[r.k]} onClick={() => toggle(r.k)}>
              {r.label}
              <span className="sw" />
            </button>
          ))}
        </Section>
        <Section id="legend" title={t("scene.legend")} open={open} setOpen={setOpen}>
          <div className="key" style={{ marginBottom: 10 }}>
            <span className="key-title">{t("key.habitatTitle")}</span>
            <div className="key-cats">
              {Object.values(BENTHIC).map((c) => (
                <span key={c.color}>
                  <i style={{ background: c.color }} />
                  {L(c)}
                </span>
              ))}
            </div>
          </div>
          <HeatKey compact />
          <p className="notes" style={{ margin: "10px 0 0" }}>
            {t("scene.modelNote")} {t("scene.exaggeration")} {td.meta.bathymetry_source !== "aca-bathymetry" && t("scene.depthModel")} {t("scene.heatNote")}
          </p>
        </Section>
        {zones.length > 0 && (
          <Section id="boat" title={t("boat.zones")} open={open} setOpen={setOpen}>
            <p className="notes" style={{ margin: "0 0 6px" }}>{t("boat.zonesLead")}</p>
            {zones.map((z) => (
              <button key={z.id} className="toggle" onClick={() => setBoat({ zone: z.id, lon: z.lon, lat: z.lat })}>
                {zoneName(z, lang)}
                <IconShip />
              </button>
            ))}
          </Section>
        )}
      </aside>

      {site ? (
        <SiteCard
          site={site}
          onClose={() => setSite(null)}
          actions={
            siteZone && (
              <button className="hbtn primary" onClick={() => setBoat({ zone: siteZone.id, lon: site.lon, lat: site.lat })}>
                <IconShip /> {t("boat.explore")}
              </button>
            )
          }
        />
      ) : (
        <aside className="hud hud-right panel readout-panel" aria-live="off">
          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>{t("scene.readout")}</h4>
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
                  <dd>{BENTHIC[readout.benthic] ? L(BENTHIC[readout.benthic]) : "–"}</dd>
                </>
              )}
              {readout.geomorphic > 0 && (
                <>
                  <dt>{t("scene.zone")}</dt>
                  <dd>{GEOMORPHIC[readout.geomorphic] ? L(GEOMORPHIC[readout.geomorphic]) : "–"}</dd>
                </>
              )}
              {dhw !== null && (
                <>
                  <dt>{t("scene.dhw")}</dt>
                  <dd>{fmtNum(dhw, lang)}</dd>
                  <dt />
                  <dd>
                    <AlertChip dhw={dhw} />
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="hud-faint" style={{ margin: 0, fontSize: 13.5 }}>
              {t("scene.hover")}
            </p>
          )}
        </aside>
      )}

      {hint && (
        <div className="hud hint panel" role="note">
          <span>{t("scene.hint")}</span>
          <div>
            <button className="hbtn primary" onClick={closeHint}>
              {t("scene.hintOk")}
            </button>
          </div>
        </div>
      )}

      <div className="hud attribution">{t("scene.attribution")}</div>

      <div className="hud timebar panel">
        <Timeline index={index} island={td.meta.island} />
      </div>
    </>
  );
}

type SectionId = "layers" | "legend" | "boat";
function Section({ id, title, open, setOpen, children }: { id: SectionId; title: string; open: SectionId; setOpen: (s: SectionId) => void; children: React.ReactNode }) {
  const isOpen = open === id;
  return (
    <div className="hud-section acc">
      <button className="acc-head" aria-expanded={isOpen} onClick={() => setOpen(id)}>
        {title}
        <svg viewBox="0 0 24 24" className="icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: isOpen ? "rotate(180deg)" : undefined }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && <div className="acc-body">{children}</div>}
    </div>
  );
}
