import { useEffect, useMemo, useRef, useState } from "react";
import { SITES } from "../content/sites";
import { fmtNum, useL, useLang, useT } from "../i18n";
import type { HeatIndex } from "../lib/data";
import { dhwAt } from "../scenes/heatLookup";
import { labelRef } from "../scenes/labels";
import { BENTHIC, GEOMORPHIC } from "../scenes/materials";
import { useScene } from "../scenes/sceneStore";
import { fmtLat, fmtLon, SiteCard } from "../scenes/SiteCard";
import { AlertChip } from "../ui/AlertChip";
import { IconBack, IconCast } from "../ui/Icons";
import { LangToggle } from "../ui/LangToggle";
import { useBoat } from "./boatStore";
import { Echogram } from "./Echogram";

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
  const sonar = useBoat((s) => s.sonar);
  const grid = useBoat((s) => s.grid);
  const surveyPct = useBoat((s) => s.surveyPct);
  const surveyHa = useBoat((s) => s.surveyHa);
  const cast = useBoat((s) => s.cast);
  const day = useScene((s) => s.day);
  const setBoat = useScene((s) => s.setBoat);
  const [story, setStory] = useState<string | null>(null);
  // On phones the instruments and the logbook start folded so the scene stays visible.
  const [instOpen, setInstOpen] = useState(!SMALL);
  const [logOpen, setLogOpen] = useState(!SMALL);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const prevSamples = useRef(samples.length);

  const dhw = tele ? dhwAt(index, tele.lon, tele.lat, day) : null;
  const sampled = useMemo(() => new Set(samples.map((s) => s.benthic).filter((c) => c > 0)), [samples]);
  const done = present.length > 0 && present.every((c) => sampled.has(c));
  const casting = cast.phase !== "idle";

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };

  function habitatName(benthic: number, depth: number) {
    if (depth <= 0) return t("boat.land");
    return BENTHIC[benthic] ? L(BENTHIC[benthic]) : t("boat.open");
  }

  // A cast finished: announce the sample (and the mission, if this completed it).
  useEffect(() => {
    if (samples.length > prevSamples.current && samples[0]) {
      const s = samples[0];
      flash(done ? t("boat.missionDone") : `${t("boat.sampled")}: ${habitatName(s.benthic, s.depth)}, ${fmtNum(s.depth, lang)} m`);
    }
    prevSamples.current = samples.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples.length]);

  const startCast = () => {
    if (!tele || tele.depth <= 1 || casting) return;
    useBoat.setState({ castReq: Date.now() });
  };

  useEffect(() => () => useBoat.setState({ near: null, tele: null, target: null }), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        startCast();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  useEffect(() => {
    const s = SITES.find((x) => x.id === near);
    if (s?.kind === "story" && tele) setStory(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  const storySite = SITES.find((s) => s.id === story);
  const nearSite = SITES.find((s) => s.id === near);
  const knots = tele ? Math.abs(tele.speed) * 1.94384 : 0;
  const deg = tele ? (tele.heading * 180) / Math.PI : 0;
  const toggle = (k: "sonar" | "grid") => useBoat.setState((s) => ({ [k]: !s[k] }) as never);

  return (
    <>
      <div className="label-layer">
        {buoys.map((id) => {
          const s = SITES.find((x) => x.id === id);
          return s ? (
            <div key={id} className="label-anchor" ref={labelRef(`buoy:${id}`)}>
              <div className={[near === id ? "pin on" : "pin", s.kind === "dive" ? "dive" : ""].join(" ")}>
                <span>{s.name}</span>
              </div>
            </div>
          ) : null;
        })}
      </div>
      {loading && (
        <div className="loading-screen" style={{ background: "rgba(10,26,46,.92)" }}>
          <div className="box">
            <div>{t("boat.loading")}</div>
            <div className="bar">
              <i />
            </div>
          </div>
        </div>
      )}

      <div className="hud hud-top">
        <div className="group">
          <button className="hbtn" onClick={() => setBoat(null)}>
            <IconBack /> <span className="hide-sm">{t("boat.back")}</span>
          </button>
          <div className="panel title-block">
            <div className="hud-label">{t("boat.title")}</div>
            <h1>{zoneName}</h1>
          </div>
        </div>
        <div className="group">
          <div className="panel instrument" title={t("boat.heading")}>
            <svg viewBox="-20 -20 40 40" width="38" height="38" aria-hidden="true">
              <circle r="17" fill="none" stroke="rgba(255,255,255,.3)" />
              {[0, 90, 180, 270].map((a) => (
                <line key={a} x1="0" y1="-17" x2="0" y2="-13" stroke="rgba(255,255,255,.55)" transform={`rotate(${a})`} />
              ))}
              <text y="-6" textAnchor="middle" fontSize="7" fill="#9fb0c2" fontFamily="var(--sans)">
                N
              </text>
              <g transform={`rotate(${deg})`}>
                <path d="M0 -12 L3.5 3 L0 0.5 L-3.5 3 Z" fill="#eef2f5" />
              </g>
            </svg>
            <div>
              <div className="big">{Math.round(deg).toString().padStart(3, "0")}°</div>
              <div className="hud-label num">
                {fmtNum(knots, lang)} {t("boat.knots")}
              </div>
            </div>
          </div>
          <div className="hide-sm">
            <LangToggle />
          </div>
        </div>
      </div>

      {storySite ? (
        <SiteCard site={storySite} onClose={() => setStory(null)} />
      ) : (
        <aside className={instOpen ? "hud hud-right panel sounder open" : "hud hud-right panel sounder"} aria-live="off">
          <div className="hud-section">
            <button className="fold-head" aria-expanded={instOpen} onClick={() => setInstOpen(!instOpen)}>
              <h4>{t("boat.sounder")}</h4>
              <Chevron open={instOpen} />
            </button>
            {tele && !instOpen && (
              <div className="depth" title={estimated ? t("scene.depthModel") : undefined}>
                {estimated && tele.depth > 0 ? "≈ " : ""}
                {fmtNum(tele.depth, lang, tele.depth < 30 ? 1 : 0)}
                <small>m</small>
              </div>
            )}
            {tele && instOpen && (
              <>
                <div className="depth" title={estimated ? t("scene.depthModel") : undefined}>
                  {estimated && tele.depth > 0 ? "≈ " : ""}
                  {fmtNum(tele.depth, lang, tele.depth < 30 ? 1 : 0)}
                  <small>m</small>
                </div>
                <Echogram />
                <dl className="readout">
                  <dt>{t("scene.habitat")}</dt>
                  <dd>{habitatName(tele.benthic, tele.depth)}</dd>
                  {tele.geomorphic > 0 && (
                    <>
                      <dt className="wide">{t("scene.zone")}</dt>
                      <dd className="wide">{GEOMORPHIC[tele.geomorphic] ? L(GEOMORPHIC[tele.geomorphic]) : "–"}</dd>
                    </>
                  )}
                  {dhw !== null && (
                    <>
                      <dt>{t("scene.dhw")}</dt>
                      <dd>
                        <AlertChip dhw={dhw} />
                      </dd>
                    </>
                  )}
                  <dt className="wide">{t("boat.position")}</dt>
                  <dd className="wide" style={{ fontWeight: 400 }}>
                    {fmtLat(tele.lat, lang)}
                    <br />
                    {fmtLon(tele.lon, lang)}
                  </dd>
                </dl>
              </>
            )}
          </div>
          {instOpen && (
          <div className="hud-section">
            <h4>{t("boat.survey")}</h4>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span className="hud-faint">{t("boat.surveyed")}</span>
              <span className="hud-value">
                {fmtNum(surveyHa, lang, surveyHa < 100 ? 1 : 0)} ha · {fmtNum(surveyPct, lang, surveyPct < 1 ? 2 : 1)} %
              </span>
            </div>
            <div className="progress">
              <i style={{ width: `${Math.min(100, surveyPct)}%` }} />
            </div>
            {sonar && (
              <div className="depth-key" aria-label={t("boat.depthKey")}>
                <span className="bar" />
                <span className="ticks num">
                  <span>0</span>
                  <span>10</span>
                  <span>20</span>
                  <span>30 m</span>
                </span>
              </div>
            )}
            <button className="toggle" aria-pressed={sonar} onClick={() => toggle("sonar")}>
              {t("boat.multibeam")}
              <span className="sw" />
            </button>
            <button className="toggle" aria-pressed={grid} onClick={() => toggle("grid")}>
              {t("boat.grid")}
              <span className="sw" />
            </button>
            <button className="toggle" aria-pressed={mapColors} onClick={() => useBoat.getState().toggleMapColors()}>
              {t("boat.colors")}
              <span className="sw" />
            </button>
          </div>
          )}
        </aside>
      )}

      {nearSite && !storySite && (
        <div className="hud arrive panel">
          <span className="hud-faint">{t("boat.near")}</span> <strong>{nearSite.name}</strong>
          {nearSite.kind === "story" && (
            <button className="hbtn" onClick={() => setStory(nearSite.id)}>
              {t("boat.readStory")}
            </button>
          )}
        </div>
      )}

      {tele?.aground && <div className="hud toast warn">{t("boat.aground")}</div>}
      {toast && !tele?.aground && <div className="hud toast">{toast}</div>}

      <div className="hud boat-bottom">
        <div className="panel logbook-panel">
          <button className="fold-head" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
            <h4>{t("boat.samples")}</h4>
            <span className="hud-faint num" style={{ fontSize: 12.5, marginLeft: "auto" }}>
              {sampled.size} / {present.length} {t("boat.habitats")}
            </span>
            <Chevron open={logOpen} />
          </button>
          {logOpen && (
          <>
          <div className="hud-faint" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            {done ? t("boat.missionDone") : t("boat.mission")}
          </div>
          <div className="checklist">
            {present.map((c) => (
              <span key={c} className={sampled.has(c) ? "done" : undefined} style={{ "--c": BENTHIC[c]?.color ?? "#999" } as React.CSSProperties}>
                <i />
                {BENTHIC[c] ? L(BENTHIC[c]) : c}
              </span>
            ))}
          </div>
          {samples.length > 0 && (
            <div className="samples">
              {samples.slice(0, 5).map((s) => (
                <div key={s.t}>
                  <span className="sq" style={{ background: BENTHIC[s.benthic]?.color ?? "#6f8297" }} />
                  <span>{habitatName(s.benthic, s.depth)}</span>
                  <span className="hud-faint">
                    {fmtNum(s.depth, lang)} m · {fmtLat(s.lat, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="notes">
            {t("boat.illustrative")} {t("boat.compressed")} {estimated && t("scene.depthModel")}
          </div>
          </>
          )}
        </div>
        <div className="controls-hint">{TOUCH ? t("boat.hintTouch") : t("boat.hintKeys")}</div>
        <button className="hbtn primary cast-btn" onClick={startCast} disabled={!tele || tele.depth <= 1 || casting}>
          <IconCast />
          {casting
            ? `${t(cast.phase === "up" ? "boat.castUp" : cast.phase === "hold" ? "boat.castHold" : "boat.castDown")} ${fmtNum(cast.depth, lang)} m`
            : t("boat.cast")}
        </button>
      </div>
    </>
  );
}

const SMALL = typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 760px)").matches;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: open ? "rotate(180deg)" : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
