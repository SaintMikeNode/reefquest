import { useEffect, useMemo, useRef, useState } from "react";
import { SITES } from "../content/sites";
import { fmtNum, useL, useLang, useT } from "../i18n";
import { levelFor } from "../lib/alert";
import type { HeatIndex } from "../lib/data";
import { AlertChip } from "../ui/AlertChip";
import { LangToggle } from "../ui/LangToggle";
import { dhwAt } from "../scenes/heatLookup";
import { BENTHIC, GEOMORPHIC } from "../scenes/materials";
import { useScene } from "../scenes/sceneStore";
import { fmtLat, fmtLon, SiteCard } from "../scenes/SiteCard";
import { labelRef } from "../scenes/labels";
import { useBoat } from "./boatStore";

const TOUCH = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export function BoatHud({ index, zoneName }: { index: HeatIndex; zoneName: string }) {
  const t = useT();
  const L = useL();
  const lang = useLang((s) => s.lang);
  const tele = useBoat((s) => s.tele);
  const near = useBoat((s) => s.near);
  const samples = useBoat((s) => s.samples);
  const present = useBoat((s) => s.present);
  const mapColors = useBoat((s) => s.mapColors);
  const estimated = useBoat((s) => s.estimated);
  const loading = useBoat((s) => s.loading);
  const buoys = useBoat((s) => s.buoys);
  const day = useScene((s) => s.day);
  const setBoat = useScene((s) => s.setBoat);
  const [story, setStory] = useState<string | null>(null);
  const [log, setLog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const dhw = tele ? dhwAt(index, tele.lon, tele.lat, day) : null;
  const sampled = useMemo(() => new Set(samples.map((s) => s.benthic).filter((c) => c > 0)), [samples]);
  const done = present.length > 0 && present.every((c) => sampled.has(c));

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const sample = () => {
    if (!tele) return;
    const before = done;
    useBoat.getState().addSample({ t: Date.now(), lat: tele.lat, lon: tele.lon, depth: tele.depth, benthic: tele.benthic, geomorphic: tele.geomorphic, dhw });
    const after = present.every((c) => c === tele.benthic || sampled.has(c));
    flash(!before && after && present.length ? t("boat.missionDone") : `${t("boat.sampled")}: ${habitatName(tele.benthic, tele.depth)}`);
  };

  // Leaving the boat: forget live state so the next trip doesn't start with a stale buoy or target.
  useEffect(() => () => useBoat.setState({ near: null, tele: null, target: null }), []);

  // Space bar takes a sample.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        sample();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  // Open the story card when arriving at a story buoy.
  useEffect(() => {
    const s = SITES.find((x) => x.id === near);
    if (s?.kind === "story" && tele) setStory(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  function habitatName(benthic: number, depth: number) {
    if (depth <= 0) return t("boat.land");
    return BENTHIC[benthic] ? L(BENTHIC[benthic]) : t("boat.open");
  }

  const storySite = SITES.find((s) => s.id === story);
  const nearSite = SITES.find((s) => s.id === near);
  const knots = tele ? Math.abs(tele.speed) * 1.94384 : 0;
  const deg = tele ? (tele.heading * 180) / Math.PI : 0;

  return (
    <>
      <div className="label-layer">
        {buoys.map((id) => {
          const s = SITES.find((x) => x.id === id);
          return s ? (
            <div key={id} className="label-anchor" ref={labelRef(`buoy:${id}`)}>
              <div className={near === id ? "pin on" : "pin"}>
                <span>{s.name}</span>
              </div>
            </div>
          ) : null;
        })}
      </div>
      {loading && (
        <div className="loading-screen" style={{ background: "rgba(2,13,22,.85)" }}>
          <div className="box">
            <div className="label">{t("boat.loading")}</div>
            <div className="bar"><i /></div>
          </div>
        </div>
      )}
      <div className="hud hud-top">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
          <button className="btn" onClick={() => setBoat(null)}>
            ← <span className="hide-sm">{t("boat.back")}</span>
          </button>
          <div className="panel hud-title">
            <div className="label">{t("boat.title")}</div>
            <h1>{zoneName}</h1>
          </div>
        </div>
        <div className="hud-right">
          <div className="panel compass" title={t("boat.heading")}>
            <svg viewBox="-20 -20 40 40" width="40" height="40" aria-hidden="true">
              <circle r="17" fill="none" stroke="#5ff2ff" strokeOpacity=".4" />
              <text y="-9" textAnchor="middle" fontSize="7" fill="#8fb3c7" fontFamily="var(--mono)">N</text>
              <g transform={`rotate(${deg})`}>
                <path d="M0 -13 L4 4 L0 1 L-4 4 Z" fill="#ff6f5e" />
              </g>
            </svg>
            <div className="mono" style={{ fontSize: 12, lineHeight: 1.2 }}>
              {Math.round(deg).toString().padStart(3, "0")}°
              <br />
              <span className="dim">{fmtNum(knots, lang)} {t("boat.knots")}</span>
            </div>
          </div>
          <LangToggle />
        </div>
      </div>

      {storySite ? (
        <SiteCard site={storySite} onClose={() => setStory(null)} />
      ) : (
        <aside className="hud hud-readout panel sounder" aria-live="off">
          <div className="label" style={{ marginBottom: 4 }}>{t("boat.sounder")}</div>
          {tele && (
            <>
              <div className="depth-big mono" title={estimated ? t("scene.depthModel") : undefined}>
                {estimated && tele.depth > 0 ? "≈" : ""}
                {fmtNum(tele.depth, lang, tele.depth < 30 ? 1 : 0)}
                <small> m</small>
              </div>
              <div className="depth-bar">
                <i style={{ height: `${Math.min(100, (tele.depth / 30) * 100)}%` }} />
              </div>
              <div>
                <span className="k">{t("scene.habitat")}</span>{" "}
                <span style={{ color: BENTHIC[tele.benthic]?.color }}>{habitatName(tele.benthic, tele.depth)}</span>
              </div>
              {tele.geomorphic > 0 && (
                <div>
                  <span className="k">{t("scene.zone")}</span> {GEOMORPHIC[tele.geomorphic] ? L(GEOMORPHIC[tele.geomorphic]) : "–"}
                </div>
              )}
              {dhw !== null && (
                <div>
                  <span className="k">{t("scene.dhw")}</span> <span style={{ color: levelFor(dhw).color }}>{fmtNum(dhw, lang)}</span> <AlertChip dhw={dhw} />
                </div>
              )}
              <div className="faint">{fmtLat(tele.lat)} · {fmtLon(tele.lon)}</div>
            </>
          )}
        </aside>
      )}

      {nearSite && !storySite && (
        <div className="hud arrive panel">
          <span className="label">{t("boat.near")}</span> <strong>{nearSite.name}</strong>
          {nearSite.kind === "story" && (
            <button className="btn" onClick={() => setStory(nearSite.id)}>
              {t("boat.readStory")}
            </button>
          )}
        </div>
      )}

      {tele?.aground && <div className="hud toast warn">{t("boat.aground")}</div>}
      {toast && !tele?.aground && <div className="hud toast">{toast}</div>}

      <div className="hud boat-bottom">
        <div className="panel boat-mission">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <span className="label">{done ? "✓ " : ""}{t("boat.samples")} · {sampled.size}/{present.length}</span>
            <button className="btn ghost" onClick={() => setLog(!log)} aria-expanded={log}>
              {log ? "▾" : "▸"}
            </button>
          </div>
          <div className="mission-chips">
            {present.map((c) => (
              <span key={c} className={sampled.has(c) ? "mchip on" : "mchip"} style={{ "--c": BENTHIC[c]?.color ?? "#999" } as React.CSSProperties}>
                <i />
                {BENTHIC[c] ? L(BENTHIC[c]) : c}
              </span>
            ))}
          </div>
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.4 }}>{done ? t("boat.missionDone") : t("boat.mission")}</div>
          {log && (
            <div className="logbook">
              {samples.length === 0 && <div className="faint">{t("boat.empty")}</div>}
              {samples.map((s) => (
                <div key={s.t} className="mono">
                  <span style={{ color: BENTHIC[s.benthic]?.color ?? "#8fb3c7" }}>■</span> {habitatName(s.benthic, s.depth)} · {fmtNum(s.depth, lang)} m
                  {s.dhw !== null && ` · DHW ${fmtNum(s.dhw, lang)}`}
                  <span className="faint"> · {fmtLat(s.lat)} {fmtLon(s.lon)}</span>
                </div>
              ))}
              {samples.length > 0 && (
                <button className="btn ghost" style={{ marginTop: 6 }} onClick={() => useBoat.getState().clearSamples()}>
                  {t("boat.clear")}
                </button>
              )}
            </div>
          )}
          <div className="faint" style={{ fontSize: 10.5, lineHeight: 1.4 }}>
            {TOUCH ? t("boat.hintTouch") : t("boat.hintKeys")} · {t("boat.illustrative")} {t("boat.compressed")} {estimated && t("scene.depthModel")}
          </div>
          <label className="faint" style={{ fontSize: 11.5, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={mapColors} onChange={() => useBoat.getState().toggleMapColors()} /> {t("boat.colors")}
          </label>
        </div>
        <button className="btn primary sample-btn" onClick={sample} disabled={!tele || tele.depth <= 0}>
          ◎ {t("boat.sample")}
        </button>
      </div>
    </>
  );
}
