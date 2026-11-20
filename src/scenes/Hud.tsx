import { useState } from "react";
import { SITES } from "../content/sites";
import { fmtNum, useL, useLang, useT } from "../i18n";
import { levelFor } from "../lib/alert";
import type { HeatIndex } from "../lib/data";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { LangToggle } from "../ui/LangToggle";
import { BENTHIC, GEOMORPHIC } from "./materials";
import { heatRef, useScene } from "./sceneStore";
import { homeDistance, type TerrainData } from "./terrain";
import { Timeline } from "./Timeline";

function dhwAt(index: HeatIndex, lon: number, lat: number, day: number): number | null {
  const g = heatRef.grid;
  if (!g) return null;
  const col = Math.round((lon - index.lon[0]) / index.cell_deg);
  const row = Math.round((index.lat[0] - lat) / index.cell_deg);
  if (col < 0 || row < 0 || col >= index.cols || row >= index.rows) return null;
  const n = index.cols * index.rows;
  const v = g[Math.min(day, g.length / n - 1) * n + row * index.cols + col];
  return v === 255 ? null : v / 10;
}

const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "N" : "S"}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(4)}°${v >= 0 ? "E" : "W"}`;

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
  const site = SITES.find((s) => s.id === siteId);
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
        <div className="label" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5, fontSize: 11 }}>
          {t("scene.modelNote")} {t("scene.exaggeration")} {td.meta.bathymetry_source !== "aca-bathymetry" && t("scene.depthModel")} {layers.heat && t("scene.heatNote")}
        </div>
        <div className="label" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5, fontSize: 10.5 }}>
          Allen Coral Atlas (CC BY 4.0) · NOAA CRW · Copernicus DEM · GEBCO 2023 · © OpenStreetMap
        </div>
      </aside>

      {site ? (
        <aside className="hud site-card panel" aria-live="polite">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span className="label">
              {site.name}
              {site.depth_m ? ` · ${site.depth_m} m` : ""}
            </span>
            <button className="btn ghost" onClick={() => setSite(null)} aria-label={t("scene.close")}>
              ✕
            </button>
          </div>
          {site.title && <h2>{L(site.title)}</h2>}
          {site.body && L(site.body).map((p, i) => <p key={i}>{p}</p>)}
          <p className="mono faint" style={{ fontSize: 11.5 }}>
            {fmtLat(site.lat)} · {fmtLon(site.lon)}
            {site.approx ? ` · ${t("scene.approx")}` : ""}
          </p>
          <div className="label" style={{ marginTop: 8 }}>{t("scene.sources")}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
            {site.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
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
