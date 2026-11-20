import { useEffect, useState } from "react";
import { SITES } from "../content/sites";
import { fmtNum, useL, useLang, useT } from "../i18n";
import { levelFor } from "../lib/alert";
import type { HeatIndex } from "../lib/data";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { LangToggle } from "../ui/LangToggle";
import { BENTHIC, GEOMORPHIC } from "./materials";
import { dhwAt } from "./heatLookup";
import { useScene } from "./sceneStore";
import { homeDistance, type TerrainData } from "./terrain";
import { loadZoneIndex, zoneName, type ZoneIndexEntry } from "../boat/zone";
import { fmtLat, fmtLon, SiteCard } from "./SiteCard";
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
  const [showLayers, setShowLayers] = useState(false);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem("rq-hint");
    } catch {
      return true;
    }
  });
  const closeHint = () => {
    setHint(false);
    try {
      localStorage.setItem("rq-hint", "1");
    } catch {
      /* storage blocked */
    }
  };
  const setBoat = useScene((s) => s.setBoat);
  const [zones, setZones] = useState<ZoneIndexEntry[]>([]);
  useEffect(() => {
    loadZoneIndex(td.meta.island).then(setZones).catch(() => setZones([]));
  }, [td.meta.island]);
  const site = SITES.find((s) => s.id === siteId);
  const siteZone = site ? zoneFor(zones, site.lon, site.lat) : undefined;
  const b = td.meta.bounds_lonlat;

  const layerRows: { k: keyof typeof layers; label: string; sw: string }[] = [
    { k: "habitat", label: t("scene.layer.habitat"), sw: "linear-gradient(90deg,#ff6161 0 33%,#78a63e 0 66%,#ffffbe 0)" },
    { k: "heat", label: t("scene.layer.heat"), sw: "linear-gradient(90deg,#3a9bb5,#f2e14b,#ef3b2c,#a50f15,#8b1fc9)" },
    { k: "contours", label: t("scene.layer.contours"), sw: "repeating-linear-gradient(90deg,transparent 0 5px,#5ff2ff 5px 6px)" },
    { k: "sites", label: t("scene.layer.sites"), sw: "radial-gradient(circle,#ff6f5e 0 4px,transparent 5px)" },
  ];

  const dhw = readout ? dhwAt(index, readout.lon, readout.lat, day) : null;

  return (
    <>
      <div className="hud hud-top">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
          <a className="btn" href={href.home} aria-label={t("scene.back")}>
            ← <span className="hide-sm">{t("scene.back")}</span>
          </a>
          <div className="panel hud-title">
            <div className="label">
              {((b.north + b.south) / 2).toFixed(2)}°N · {Math.abs((b.east + b.west) / 2).toFixed(2)}°W
            </div>
            <h1>{td.meta.name}</h1>
          </div>
        </div>
        <div className="hud-right">
          <button className="btn layers-toggle" aria-pressed={showLayers} onClick={() => setShowLayers(!showLayers)}>
            {t("scene.layers")}
          </button>
          <button className="btn" onClick={() => fly(td.center.x, td.center.z, homeDistance(td), true)} title={t("scene.reset")} aria-label={t("scene.reset")}>
            ⟲
          </button>
          <LangToggle />
        </div>
      </div>

      <aside className={showLayers ? "hud hud-left panel" : "hud hud-left panel collapsed"}>
        <div className="label">{t("scene.layers")}</div>
        {layerRows.map((r) => (
          <button key={r.k} className="layer" aria-pressed={layers[r.k]} onClick={() => toggle(r.k)}>
            <span className="sw" style={{ background: r.sw }} />
            {r.label}
          </button>
        ))}
        {layers.habitat && (
          <div className="habitat-legend">
            {Object.values(BENTHIC).map((c) => (
              <span key={c.color}>
                <i style={{ background: c.color }} />
                {L(c)}
              </span>
            ))}
          </div>
        )}
        {zones.length > 0 && (
          <>
            <div className="label">{t("boat.zones")}</div>
            {zones.map((z) => (
              <button key={z.id} className="layer" aria-pressed="true" onClick={() => setBoat({ zone: z.id, lon: z.lon, lat: z.lat })}>
                <span className="sw" style={{ display: "grid", placeItems: "center", fontSize: 12 }}>⛴</span>
                {zoneName(z, lang)}
              </button>
            ))}
          </>
        )}
        <div className="label" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5, fontSize: 11 }}>
          {t("scene.modelNote")} {t("scene.exaggeration")} {td.meta.bathymetry_source !== "aca-bathymetry" && t("scene.depthModel")} {layers.heat && t("scene.heatNote")}
        </div>
        <div className="label" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5, fontSize: 10.5 }}>
          Allen Coral Atlas (CC BY 4.0) · NOAA CRW · Copernicus DEM · GEBCO 2023 · © OpenStreetMap
        </div>
      </aside>

      {site ? (
        <SiteCard
          site={site}
          onClose={() => setSite(null)}
          actions={
            siteZone && (
              <button className="btn primary" onClick={() => setBoat({ zone: siteZone.id, lon: site.lon, lat: site.lat })}>
                ⛴ {t("boat.explore")}
              </button>
            )
          }
        />
      ) : (
        <aside className="hud hud-readout panel" aria-live="off">
          <div className="label" style={{ marginBottom: 4 }}>{t("scene.readout")}</div>
          {readout ? (
            <>
              <div><span className="k">{t("scene.lat")}</span> {fmtLat(readout.lat)}</div>
              <div><span className="k">{t("scene.lon")}</span> {fmtLon(readout.lon)}</div>
              <div>
                <span className="k">{readout.h >= 0 ? t("scene.elev") : t("scene.depth")}</span> {fmtNum(Math.abs(readout.h), lang, readout.h > -30 ? 1 : 0)} m
              </div>
              {readout.benthic > 0 && (
                <div>
                  <span className="k">{t("scene.habitat")}</span>{" "}
                  <span style={{ color: BENTHIC[readout.benthic]?.color }}>{BENTHIC[readout.benthic] ? L(BENTHIC[readout.benthic]) : "–"}</span>
                </div>
              )}
              {readout.geomorphic > 0 && (
                <div>
                  <span className="k">{t("scene.zone")}</span> {GEOMORPHIC[readout.geomorphic] ? L(GEOMORPHIC[readout.geomorphic]) : "–"}
                </div>
              )}
              {dhw !== null && (
                <div>
                  <span className="k">{t("scene.dhw")}</span>{" "}
                  <span style={{ color: levelFor(dhw).color }}>{fmtNum(dhw, lang)}</span> <AlertChip dhw={dhw} />
                </div>
              )}
            </>
          ) : (
            <div className="faint">{t("scene.hover")}</div>
          )}
        </aside>
      )}

      {hint && (
        <div className="hud hint panel" role="note">
          <span>{t("scene.hint")}</span>
          <button className="btn" onClick={closeHint}>
            {t("scene.hintOk")}
          </button>
        </div>
      )}

      <div className="hud hud-bottom panel">
        <Timeline index={index} island={td.meta.island} />
      </div>
    </>
  );
}
