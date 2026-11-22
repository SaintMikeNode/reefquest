import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { REEF_LIFE, REEF_LIFE_NOTE, REEF_LIFE_SOURCES } from "../content/reefLife";
import { siteName, SITES } from "../content/sites";
import { fmtDate, fmtNum, useL, useLang, useT } from "../i18n";
import { HeatStatus } from "../scenes/Hud";
import { BLEACH } from "./corals";
import type { HeatIndex } from "../lib/data";
import { dhwAt } from "../scenes/heatLookup";
import { labelRef } from "../scenes/labels";
import { BENTHIC, GEOMORPHIC } from "../scenes/materials";
import { useScene } from "../scenes/sceneStore";
import { fmtLat, fmtLon, SiteCard } from "../scenes/SiteCard";
import { AlertChip } from "../ui/AlertChip";
import { IconBack, IconBook, IconCamera, IconCast, IconCheck, IconClose, IconDive, IconDownload, IconShark, IconPhotos, IconSonar, IconSurface, IconTools, IconTurtle, IconWhaleShark, IconWreck, IconDiver, IconStingray } from "../ui/Icons";
import { PhotoStrip, usePhotos } from "../ui/PhotoStrip";
import { panelMotion } from "../ui/motionPresets";
import { Fold } from "../ui/Fold";
import { LangToggle } from "../ui/LangToggle";
import { MouseGuide } from "../scenes/MouseGuide";
import { useBottomInset, useInsetRef, useMedia, useWidthVar } from "../scenes/useBottomInset";
import { transition } from "../ui/SceneTransition";
import { useBoat, type MissionType } from "./boatStore";
import { requestShot, useRoll } from "./photos";
import { Echogram } from "./Echogram";

const TOUCH = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

export function BoatHud({ index, zoneName, islandName, island }: { index: HeatIndex; zoneName: string; islandName: string; island: string }) {
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
  const under = useBoat((s) => s.under);
  const mission = useBoat((s) => s.mission);
  const notice = useBoat((s) => s.notice);
  const wild = useBoat((s) => s.wild);
  const placePos = useBoat((s) => s.placePos);
  const sightings = useBoat((s) => s.sightings);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Diving and surfacing are animated: a water line sweeping down going under, up coming back, with bubbles.
  const camOn = useRoll((s) => s.camera);
  const shots = useRoll((s) => s.photos);
  const [logTab, setLogTab] = useState<"habitats" | "photos">("habitats");
  // The shutter: a photo of what is in frame, which completes that place's mission.
  const shoot = () => {
    const roll = useRoll.getState();
    useRoll.setState({ flash: Date.now() });
    const id = roll.aim;
    if (!id) {
      flash(t("shot.none"));
      return;
    }
    const had = !!roll.photos[id];
    const s = SITES.find((x) => x.id === id);
    requestShot((url) => {
      useRoll.getState().add(id, url);
      flash(t(had ? "shot.again" : "shot.saved").replace("{name}", s ? siteName(s, lang) : ""));
      window.setTimeout(() => useRoll.getState().last === id && useRoll.setState({ last: null }), 2600);
    });
  };
  const toggleCamera = () => useRoll.getState().setCamera(!useRoll.getState().camera);
  const toggleDive = () => {
    const goUnder = !useBoat.getState().under;
    transition({
      kind: goUnder ? "dive" : "surface",
      label: goUnder ? t("boat.dive") : t("boat.surfaceShort"),
      apply: () => {
        useBoat.setState({ under: goUnder });
        if (goUnder) setGallery(false);
        if (!goUnder) useRoll.getState().setCamera(false); // the camera is for under the water
      },
    });
  };
  useBottomInset(bottomRef, "--bb"); // the sounder and arrival bar stack above the bottom bar
  const toolsRef = useRef<HTMLDivElement>(null);
  useWidthVar(toolsRef, "--tools-w"); // phones: the way back takes only the room beside the tools
  const day = useScene((s) => s.day);
  const setBoat = useScene((s) => s.setBoat);
  const [story, setStory] = useState<string | null>(null);
  // On phones the instruments and the logbook start folded so the scene stays visible.
  const [instOpen, setInstOpen] = useState(!SMALL);
  // Phones: an app-style bar at the bottom (the way back, tools, photos, sonda). The tools (the
  // dock: arrival, logbook or field guide, actions) and the sonda open as sheets right above it, one
  // at a time; the tools start open. Computers ignore `sheet`.
  const phone = useMedia("(max-width: 760px)");
  const [sheet, setSheet] = useState<"tools" | "sonda" | null>("tools");
  const sonarOpen = phone ? sheet === "sonda" : instOpen;
  const navRef = useRef<HTMLElement>(null);
  useBottomInset(navRef, "--nb");
  const sbRef = useInsetRef("--sb"); // the sonda sheet's height, for the messages above it
  const [logOpen, setLogOpen] = useState(!SMALL);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);
  // "Too shallow": shown for a few seconds after each time the boat runs aground (and as long as it
  // keeps pushing into the shallows), however briefly it touched.
  const groundedAt = useBoat((s) => s.groundedAt);
  const groundEdge = useBoat((s) => s.groundEdge);
  const [aground, setAground] = useState(false);
  useEffect(() => {
    if (!groundedAt) return;
    setAground(true);
    const timer = window.setTimeout(() => setAground(false), 2800);
    return () => clearTimeout(timer);
  }, [groundedAt]);
  const prevSamples = useRef(samples.length);

  const dhw = tele ? dhwAt(index, tele.lon, tele.lat, day) : null;
  const year = useScene((s) => s.year);
  const yi = index.years.find((y) => y.year === year);
  const dateISO = yi ? new Date(Date.parse(yi.first + "T12:00:00Z") + Math.min(day, yi.days - 1) * 864e5).toISOString().slice(0, 10) : null;
  // Corals whiten with the heat of this 5 km cell on the selected date (from ~4 °C-weeks; most by ~10).
  const bleach = dhw === null ? 0 : Math.min(1, Math.max(0, (dhw - 3.5) / 6.5));
  useEffect(() => {
    BLEACH.value = bleach * bleach * (3 - 2 * bleach);
  }, [bleach]);
  useEffect(() => () => void (BLEACH.value = 0), []);
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

  // Wildlife (boat/wildlife.tsx) asks for a message: flash it.
  useEffect(() => {
    if (notice) flash(t(notice.key as "boat.sight.saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

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

  useEffect(
    () => () => {
      useBoat.setState({ near: null, tele: null, target: null, under: false });
      useRoll.getState().setCamera(false);
    },
    [],
  );

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.code === "KeyU" && (e.target as HTMLElement)?.tagName !== "INPUT") toggleDive();
      // F: camera (under the water); with the viewfinder up, F or Enter takes the photo, Esc closes.
      if (useBoat.getState().under && (e.code === "KeyF" || (e.code === "Enter" && useRoll.getState().camera))) {
        e.preventDefault();
        if (useRoll.getState().camera) shoot();
        else toggleCamera();
      }
      if (e.code === "Escape" && useRoll.getState().camera) useRoll.getState().setCamera(false);
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
    if (!s || !tele) return;
    // Phones: a story never opens by itself, it would cover the boat and the tools (Tulio: people
    // would think there is nothing to do). Arriving shows the Equipo sheet, with "You've reached"
    // and the button that opens the story.
    if (phone) {
      setSheet((k) => k ?? "tools");
      return;
    }
    // Computers: a story opens on arrival (the card sits at the side), except where there is
    // something to find first (whale sharks, turtles, reef sharks, a wreck): there the arrival tag
    // offers it, and the hint has the screen.
    if (s.kind === "story" && !s.scene && !s.wreck) setStory(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  // Things to find in this zone: how far and which way each one is from the boat ("1.7 km NE"),
  // and sailing to it. For the whale sharks the boat stops well short of the contact zone.
  const whereIs = (id: string) => {
    const p = placePos[id];
    if (!p || !tele) return "";
    const dx = p.x - tele.x, dz = p.z - tele.z, d = Math.hypot(dx, dz); // +x east, +z south
    if (d < 60) return t("boat.here");
    const dir = (lang === "es" ? ["N", "NE", "E", "SE", "S", "SO", "O", "NO"] : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"])[Math.round((Math.atan2(dx, -dz) / Math.PI) * 4 + 8) % 8];
    return `${meters(d)} ${dir}`;
  };
  const howFar = (id: string) => {
    const p = placePos[id];
    return p && tele ? meters(Math.hypot(p.x - tele.x, p.z - tele.z)) : "";
  };
  const sailTo = (id: string) => {
    const p = placePos[id];
    if (!p || !tele) return;
    const dx = tele.x - p.x, dz = tele.z - p.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, p.standoff / d);
    useBoat.getState().setTarget({ x: p.x + dx * k, z: p.z + dz * k });
  };
  // On boarding: say what there is to find here (the list is in the logbook).
  useEffect(() => {
    if (!wild.length) return;
    const names = [...new Set(wild.map((id) => SITES.find((s) => s.id === id)).map((s) => { const k = s && missionType(s); return k ? t(`boat.scene.${k}`) : ""; }))].filter(Boolean);
    const timer = window.setTimeout(() => flash(`${t("boat.sightings")}: ${names.join(", ").toLowerCase()}`), 3200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wild]);

  const storySite = SITES.find((s) => s.id === story);
  const missionSite = mission ? SITES.find((s) => s.id === mission.id) : undefined;
  const nearSite = SITES.find((s) => s.id === near);
  // Photos: the zone's own gallery (from the title plate), and a site's photos from the arrival bar.
  const photos = usePhotos();
  const zoneId = useScene((s) => s.boat?.zone);
  // The album and its count: this island's missions only (another island's photos stay saved for it).
  const islandMissions = useMemo(() => MISSION_SITES.filter((s) => s.island === island), [island]);
  const zonePhotos = zoneId ? photos?.places[`zone:${zoneId}`] : undefined;
  const [gallery, setGallery] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);
  useStackRoom(stackRef, `${lang}|${zoneName}|${sonarOpen}|${gallery}`);
  const nearHasPhotos = !!(nearSite && photos?.places[nearSite.id]?.length);
  const openNear = nearSite && (nearSite.kind === "story" || (nearHasPhotos && !under)) ? () => (setGallery(false), setStory(nearSite.id)) : null;
  const openLabel = nearSite?.kind === "story" ? t("boat.readStory") : t("boat.seePhotos");
  const knots = tele ? Math.abs(tele.speed) * 1.94384 : 0;
  const deg = tele ? (tele.heading * 180) / Math.PI : 0;
  const toggle = (k: "sonar" | "grid") => useBoat.setState((s) => ({ [k]: !s[k] }) as never);
  const openSheet = (k: "tools" | "sonda") => {
    setSheet(sheet === k ? null : k);
    if (sheet !== k) (setStory(null), setGallery(false));
  };
  function toggleSonar() {
    if (phone) openSheet("sonda");
    else setInstOpen(!instOpen);
  }
  // A story card or the gallery opening on a phone closes the sheet under it (both stand on the bar).
  useEffect(() => {
    if (story || gallery) setSheet(null);
  }, [story, gallery]);

  return (
    <>
      <div className="label-layer" style={under ? { display: "none" } : undefined}>
        {/* Every place of the zone as a tag over it: what it is, its name and how far it is. A press
            sails the boat there. The projector (scenes/labels.tsx) keeps them from overlapping. */}
        {buoys.map((id) => {
          const s = SITES.find((x) => x.id === id);
          if (!s) return null;
          const kind = missionType(s) ?? s.kind;
          const name = siteName(s, lang);
          return (
            <div key={id} className="label-anchor" ref={labelRef(`buoy:${id}`)}>
              <button type="button" className={`tag k-${kind}${near === id ? " on" : ""}`} data-k={`${name}|${lang}`} onClick={() => sailTo(id)} title={t("boat.sailTo")}>
                <span className="tag-mark" aria-hidden="true">
                  <PlaceMark kind={kind} />
                </span>
                <span className="tag-name">{name}</span>
                <span className="tag-dist">{howFar(id)}</span>
              </button>
              <i className="tag-stem" aria-hidden="true" />
            </div>
          );
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

      <div className="scrim-top" />
      <div className="scrim-bottom" />

      <header className="hud plate">
        <div className="plate-actions">
          {/* Under the water the way back is to the surface (Tulio), not to the island. */}
          {under ? (
            <button className="back-btn surface-back" onClick={toggleDive}>
              <IconSurface />
              <span className="lbl">
                <span className="back-long">{t("boat.surface")}</span>
                <span className="back-short">{t("boat.surfaceTo")}</span>
              </span>
            </button>
          ) : (
            <button className="back-btn" onClick={() => setBoat(null)}>
              <IconBack />
              <span className="lbl">
                <span className="back-long">{t("boat.backTo").replace("{island}", islandName)}</span>
                <span className="back-short">{islandName}</span>
              </span>
            </button>
          )}
          {/* The place's photo gallery: from the boat, not under the water (the camera is there). */}
          {!under && zonePhotos && zonePhotos.length > 0 && (
            <button className="plate-chip" aria-pressed={gallery} onClick={() => (setStory(null), setGallery(!gallery))}>
              <IconCamera /> {t("photos.button")}
            </button>
          )}
        </div>
        <div className="kicker">{t("boat.kicker")}</div>
        <h1>{zoneName}</h1>
        <div className="coords">{tele ? `${fmtLat(tele.lat, lang)} · ${fmtLon(tele.lon, lang)}` : "\u00a0"}</div>
        <HeatStatus dhw={dhw} prefix={dateISO ? fmtDate(dateISO, lang) : undefined} />
      </header>

      <div className="hud heading-tape" aria-hidden="true">
        {!SMALL && <HeadingTape deg={deg} />}
        <div className="read">
          <span>
            <b>{Math.round(deg).toString().padStart(3, "0")}°</b>
          </span>
          <span>
            <b>{fmtNum(knots, lang)}</b> {t("boat.knots")}
          </span>
        </div>
      </div>

      <div ref={toolsRef} className="hud tools">
        {/* Phones: one instrument pill (heading, speed, depth); tapping it opens the sounder. */}
        <button className="panel instrument" aria-expanded={sonarOpen} onClick={() => toggleSonar()} title={t("boat.sounder")}>
          <span>
            <b>{Math.round(deg).toString().padStart(3, "0")}°</b>
          </span>
          <span>
            <b>{fmtNum(knots, lang, 0)}</b> {t("boat.knotsShort")}
          </span>
          {tele && (
            <span>
              <b>
                {estimated && tele.depth > 0 ? "≈" : ""}
                {fmtNum(tele.depth, lang, tele.depth < 30 ? 1 : 0)}
              </b>{" "}
              m
            </span>
          )}
          <Chevron open={sonarOpen} />
        </button>
        <div className="hide-sm">
          <LangToggle />
        </div>
      </div>

      <AnimatePresence initial={false}>
      {storySite ? (
        <SiteCard key={`story:${storySite.id}`} site={storySite} onClose={() => setStory(null)} />
      ) : gallery && zonePhotos ? (
        <motion.aside key="gallery" className="hud site-card panel" aria-label={t("photos.title")} {...panelMotion}>
          <div className="card-head">
            <div className="card-place">
              <span className="place-name">{zoneName}</span>
            </div>
            <button className="close-btn" onClick={() => setGallery(false)} aria-label={t("scene.close")}>
              <IconClose />
            </button>
          </div>
          <PhotoStrip photos={zonePhotos} />
        </motion.aside>
      ) : (
        <motion.aside key="sounder" ref={sbRef} className={sonarOpen ? "hud hud-right panel sounder open" : "hud hud-right panel sounder"} aria-live="off" {...panelMotion}>
          <div className="hud-section">
            <button className="fold-head" aria-expanded={sonarOpen} onClick={() => toggleSonar()}>
              <h4>{t("boat.sounder")}</h4>
              <Chevron open={sonarOpen} />
            </button>
            {tele && (
              <div className="depth" title={estimated ? t("scene.depthModel") : undefined}>
                {estimated && tele.depth > 0 ? "≈ " : ""}
                {fmtNum(tele.depth, lang, tele.depth < 30 ? 1 : 0)}
                <small>m</small>
              </div>
            )}
            {/* Open, the sounder folds out (echogram, readout, survey) instead of jumping. */}
            <Fold open={sonarOpen}>
              {tele && (
                <>
                  <Echogram />
                  <dl className="readout">
                    <dt>{t("scene.habitat")}</dt>
                    <dd className="txt">{habitatName(tele.benthic, tele.depth)}</dd>
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
              <div className="hud-section survey-section">
                <h4>{t("boat.survey")}</h4>
                {/* The figure stays on one line; a long label ("Plataforma cartografiada") wraps instead. */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 13.5 }}>
                  <span className="hud-faint">{t("boat.surveyed")}</span>
                  <span className="hud-value" style={{ whiteSpace: "nowrap", flex: "none" }}>
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
                  <span className="check">
                    <IconCheck />
                  </span>
                </button>
                <button className="toggle" aria-pressed={grid} onClick={() => toggle("grid")}>
                  {t("boat.grid")}
                  <span className="check">
                    <IconCheck />
                  </span>
                </button>
                <button className="toggle" aria-pressed={mapColors} onClick={() => useBoat.getState().toggleMapColors()}>
                  {t("boat.colors")}
                  <span className="check">
                    <IconCheck />
                  </span>
                </button>
              </div>
            </Fold>
          </div>
        </motion.aside>
      )}
      </AnimatePresence>

      {TOUCH && !under && !storySite && !mission && !gallery && !(phone && sheet === "sonda") && <TapHint />}
      {/* Top center, one stack: the mission in range (or the plain arrival tag), then messages. */}
      <div className="hud top-stack" ref={stackRef}>
        {missionSite && mission && !storySite ? (
          <MissionTag
            key={mission.id}
            type={mission.type}
            name={siteName(missionSite, lang)}
            line={
              shots[mission.id] && mission.state !== "dived"
                ? t("mission.done")
                : t(`mission.${mission.type}.${mission.type === "whale-shark" && mission.state === "logged" && under ? "close" : mission.state}` as "mission.wreck.above")
            }
            warn={mission.state === "dived"}
            steps={3}
            done={
              shots[mission.id] ? 3
              : sightings.includes(mission.id) ? 2
              : mission.type === "whale-shark" ? (mission.state === "watch" ? 1 : 0)
              : 1
            }
            // Its story, or for a dive site its photos (above the water: under it, the camera).
            onRead={missionSite.kind === "story" || (!under && photos?.places[missionSite.id]?.length) ? () => (setGallery(false), setStory(missionSite.id)) : null}
            readLabel={missionSite.kind === "story" ? t("boat.readStory") : t("boat.seePhotos")}
            readIcon={missionSite.kind === "story" ? "book" : "photos"}
          />
        ) : (
          nearSite && !storySite && (
            <div className="arrive panel top-only">
              <Arrival name={siteName(nearSite, lang)} onRead={openNear} label={openLabel} />
            </div>
          )
        )}
        {aground ? <div className="toast warn">{t(groundEdge ? "boat.edge" : "boat.aground")}</div> : toast && <div className="toast">{toast}</div>}
      </div>

      {under && camOn && <Viewfinder onShoot={shoot} onClose={() => useRoll.getState().setCamera(false)} />}

      <div className={`hud boat-bottom${camOn && under ? " cam-hidden" : ""}${sheet !== "tools" ? " closed" : ""}`} ref={bottomRef}>
        {/* Phones: everything at the bottom lives in this one dock (arrival, guide or logbook, actions). */}
        {nearSite && !storySite && !mission && (
          <div className="arrive-row dock-only">
            <Arrival name={siteName(nearSite, lang)} onRead={openNear} label={openLabel} />
          </div>
        )}
        {under ? (
          <FieldGuide bleachNote={bleach > 0.05 && dhw !== null && dateISO ? t("boat.bleachNote").replace("{date}", fmtDate(dateISO, lang)).replace("{dhw}", fmtNum(dhw, lang)) : null} />
        ) : (
        <div className="panel logbook-panel">
          <button className="fold-head" aria-expanded={logOpen} onClick={() => setLogOpen(!logOpen)}>
            <h4>{t("boat.samples")}</h4>
            <span className="hud-faint num" style={{ fontSize: 12.5, marginLeft: "auto" }}>
              {sampled.size} / {present.length} {t("boat.habitats")}
            </span>
            <Chevron open={logOpen} />
          </button>
          <Fold open={logOpen} gap={10}>
            <div className="log-tabs" role="tablist">
              <button role="tab" aria-selected={logTab === "habitats"} onClick={() => setLogTab("habitats")}>
                {t("log.habitats")}
              </button>
              <button role="tab" aria-selected={logTab === "photos"} onClick={() => setLogTab("photos")}>
                <IconCamera />
                {t("shot.tab")}
                <span className="num">
                  {islandMissions.filter((s) => shots[s.id]).length}/{islandMissions.length}
                </span>
              </button>
            </div>
            {/* The tabs stay put; only what is under them scrolls (Tulio: they scrolled out of sight). */}
            <div className="log-scroll">
            {logTab === "photos" && <PhotoAlbum shots={shots} here={wild} sites={islandMissions} islandName={islandName} />}
            {logTab === "habitats" && (
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
            {/* Wildlife documented in this zone: seen once the boat has met it (whale shark: by the rules). */}
            {wild.length > 0 && (
              <div className="checklist sightings">
                <span className="hud-faint">{t("boat.sightings")}</span>
                {wild.map((id) => {
                  const place = SITES.find((s) => s.id === id);
                  const scene = place && missionType(place);
                  // Each one says how far and which way it is, and a press sails the boat there.
                  return scene ? (
                    <button key={id} type="button" className={sightings.includes(id) ? "done" : undefined} style={{ "--c": "#7fd6ff" } as React.CSSProperties} onClick={() => sailTo(id)} title={t("boat.sailTo")}>
                      <i />
                      <span>{scene === "divers" ? t("boat.scene.diversAt").replace("{name}", siteName(place!, lang)) : t(`boat.scene.${scene}`)}</span>
                      <span className="where">{whereIs(id)}</span>
                    </button>
                  ) : null;
                })}
              </div>
            )}
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
          </Fold>
        </div>
        )}
        {/* Computers: the action buttons stand at the bottom center, the controls card under them
            (Tulio: they sat too far in the corner). Phones: display: contents, the dock as before. */}
        <div className="dock-center">
          <div className="boat-actions">
          {/* Under the water the way up is the title plate's "Back to the surface": the dock keeps
              only the camera and the CTD (Tulio). */}
          {!under && (
            <button className="hbtn cast-btn" onClick={toggleDive}>
              <IconDive />
              <span>{t("boat.dive")}</span>
            </button>
          )}
          {under && (
            <button className="hbtn primary cast-btn" aria-pressed={camOn} onClick={toggleCamera}>
              <IconCamera />
              <span>{t("shot.open")}</span>
            </button>
          )}
          <button className={under ? "hbtn cast-btn" : "hbtn primary cast-btn"} onClick={startCast} disabled={!tele || tele.depth <= 1 || casting}>
            <IconCast />
            {casting
              ? (
                <>
                  <span className="lbl-long">{`${t(cast.phase === "up" ? "boat.castUp" : cast.phase === "hold" ? "boat.castHold" : "boat.castDown")} ${fmtNum(cast.depth, lang)} m`}</span>
                  <span className="lbl-short">{`${fmtNum(cast.depth, lang)} m`}</span>
                </>
              )
              : (
                <>
                  <span className="lbl-long">{t("boat.cast")}</span>
                  <span className="lbl-short">{under ? "CTD" : t("boat.cast")}</span>
                </>
              )}
          </button>
          </div>
          {/* Every control in one card (Tulio: the keys were a loose line of text around it). */}
          <div className="controls-hint">
            {!under && !TOUCH && (
              <MouseGuide
                inline
                items={[
                  { part: "left", label: t("boat.mouse.look"), how: t("boat.mouse.lookHow") },
                  { part: "left", label: t("boat.mouse.sail"), how: t("boat.mouse.sailHow") },
                  { part: "wheel", label: t("scene.mouse.zoom"), how: t("scene.mouse.zoomHow") },
                ]}
                keys={[
                  { caps: ["W", "A", "S", "D"], label: t("boat.key.sail") },
                  { caps: [t("boat.key.space")], label: t("boat.key.cast") },
                  { caps: ["U"], label: t("boat.key.under") },
                  { caps: ["F"], label: t("shot.open") },
                ]}
              />
            )}
          </div>
        </div>
      </div>

      {/* Phones only (styles.css hides it on computers): the boat's controls as an app's tab bar.
          Under the water the first is the way up; the camera is in Equipo. */}
      <nav ref={navRef} className={camOn && under ? "hud panel scene-nav cam-hidden" : "hud panel scene-nav"} aria-label={t("bar.boat")}>
        {under ? (
          <button onClick={toggleDive}>
            <span className="ind">
              <IconSurface />
            </span>
            <span className="lbl">{t("boat.surfaceTo")}</span>
          </button>
        ) : (
          <button onClick={() => setBoat(null)}>
            <span className="ind">
              <IconBack />
            </span>
            <span className="lbl">{islandName}</span>
          </button>
        )}
        <button aria-pressed={sheet === "tools"} onClick={() => openSheet("tools")}>
          <span className="ind">
            <IconTools />
          </span>
          <span className="lbl">{t("bar.tools")}</span>
        </button>
        <button aria-pressed={gallery} disabled={!zonePhotos?.length} onClick={() => (setStory(null), setGallery(!gallery))}>
          <span className="ind">
            <IconPhotos />
          </span>
          <span className="lbl">{t("photos.button")}</span>
        </button>
        <button aria-pressed={sheet === "sonda"} onClick={() => openSheet("sonda")}>
          <span className="ind">
            <IconSonar />
          </span>
          <span className="lbl">{t("boat.sounder")}</span>
        </button>
      </nav>
    </>
  );
}

// Touch screens: show that tapping the water sails the boat there (Tulio). A ripple on the water
// with a short label, until the first tap on the water (remembered) or after a while. It takes no
// taps itself.
const TAP_KEY = "rq-tap-sail-1";
function TapHint() {
  const t = useT();
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(TAP_KEY);
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setShow(false), 20000);
    const unsub = useBoat.subscribe((s) => {
      if (!s.target) return;
      setShow(false);
      try {
        localStorage.setItem(TAP_KEY, "1");
      } catch {
        /* private mode: it shows again next time */
      }
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [show]);
  if (!show) return null;
  return (
    <div className="hud tap-hint" aria-live="polite">
      <span className="tap-ripple" aria-hidden="true">
        <i />
        <i />
        <b />
      </span>
      <span className="tap-label">{t("boat.tapHint")}</span>
    </div>
  );
}

function Arrival({ name, onRead, label }: { name: string; onRead: (() => void) | null; label: string }) {
  const t = useT();
  return (
    <>
      <span className="hud-faint">{t("boat.near")}</span> <strong>{name}</strong>
      {onRead && (
        <button className="hbtn" onClick={onRead}>
          {label}
        </button>
      )}
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

/** A compass tape like a ship's heading display: ticks every 5°, labels every 30°, lubber line in the middle. */
function HeadingTape({ deg }: { deg: number }) {
  const W = 340, span = 90; // degrees visible across the tape
  const px = W / span;
  const ticks = [];
  const start = Math.floor((deg - span / 2) / 5) * 5;
  for (let d = start; d <= deg + span / 2; d += 5) {
    const x = W / 2 + (d - deg) * px;
    const n = ((d % 360) + 360) % 360;
    const major = n % 30 === 0;
    const label = n === 0 ? "N" : n === 90 ? "E" : n === 180 ? "S" : n === 270 ? "W" : major ? String(n) : null;
    ticks.push(
      <g key={d} transform={`translate(${x.toFixed(1)} 0)`} opacity={1 - Math.min(1, Math.abs(d - deg) / (span / 2)) * 0.85}>
        <line y1={major ? 0 : 4} y2={12} stroke="#eef2f5" strokeWidth={major ? 1.2 : 0.8} />
        {label && (
          <text y={26} textAnchor="middle" fontSize={label.length === 1 ? 12 : 10} fontFamily="var(--mono)" fill={label === "N" ? "#ff8a6e" : "#c9d6e0"}>
            {label}
          </text>
        )}
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${W} 34`} preserveAspectRatio="none">
      <line x1={0} x2={W} y1={12.5} y2={12.5} stroke="rgba(255,255,255,.25)" />
      {ticks}
      <path d={`M${W / 2 - 5} -4 L${W / 2 + 5} -4 L${W / 2} 4 Z`} fill="#6ae3ee" />
    </svg>
  );
}

/** Underwater: the species of the (illustrative) reef around the boat, with how to recognize them. */
function FieldGuide({ bleachNote }: { bleachNote: string | null }) {
  const t = useT();
  const L = useL();
  const nearby = useBoat((s) => s.nearby);
  const [open, setOpen] = useState(!SMALL);
  // A real photo of each species from the Bay Islands (iNaturalist), credited under the list.
  const photos = usePhotos();
  const shown = nearby.slice(0, 7);
  const credited = shown.map((sp) => photos?.species[sp]).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <aside className="panel logbook-panel field-guide">
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <h4>{t("boat.fieldGuide")}</h4>
        <span className="hud-faint" style={{ fontSize: 12.5, marginLeft: "auto" }}>
          {nearby.length ? t("boat.aroundYou") : t("boat.noReef")}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <>
          {bleachNote && <p className="bleach-note" style={{ marginTop: 8 }}>{bleachNote}</p>}
          {nearby.length > 0 && (
            <ul>
              {shown.map((sp) => {
                const s = REEF_LIFE[sp];
                const ph = photos?.species[sp];
                return (
                  <li key={sp} className={ph ? "has-photo" : undefined}>
                    {ph ? <img className="fg-photo" src={ph.src.s} alt={L(s.name)} loading="lazy" decoding="async" style={{ borderColor: s.color }} /> : <i style={{ background: s.color }} />}
                    <span>
                      <b style={{ fontWeight: 600 }}>{L(s.name)}</b> <em>{s.sci}</em>
                      <span className="hud-faint" style={{ display: "block", fontSize: 12.5 }}>
                        {L(s.look)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {credited.length > 0 && (
            <p className="notes fg-credits">
              {t("photos.label")}:{" "}
              {credited.map((p, k) => (
                <span key={p.id}>
                  {k > 0 && "; "}
                  <a href={p.source} target="_blank" rel="noreferrer">
                    {p.credit}
                  </a>{" "}
                  ({p.license})
                </span>
              ))}
            </p>
          )}
          <p className="notes" style={{ margin: 0 }}>
            {L(REEF_LIFE_NOTE)}{" "}
            {REEF_LIFE_SOURCES.map((src, k) => (
              <span key={src.url}>
                {k > 0 && "; "}
                <a href={src.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                  {src.label}
                </a>
              </span>
            ))}
          </p>
        </>
      )}
    </aside>
  );
}

/** A distance for a tag or a list: "480 m", "1.8 km". */
const meters = (d: number) => (d < 950 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(1)} km`);
/** What there is to find at a place, if anything (content/sites.ts `scene`, or a `wreck`). */
const missionType = (s: (typeof SITES)[number]): MissionType | undefined =>
  s.wreck ? "wreck" : s.scene ?? (s.kind === "dive" ? "divers" : undefined); // a plain dive site: its divers

/** The mark of a place: its mission's own icon, a diamond for a story, a dot for a dive site. */
function PlaceMark({ kind }: { kind: MissionType | "story" | "dive" }) {
  if (kind === "whale-shark") return <IconWhaleShark />;
  if (kind === "turtles") return <IconTurtle />;
  if (kind === "reef-sharks") return <IconShark />;
  if (kind === "wreck") return <IconWreck />;
  if (kind === "divers") return <IconDiver />;
  if (kind === "stingrays") return <IconStingray />;
  return <i />;
}

/** The mission in range, top center: its icon, the place on a line of its own with the steps
 *  done so far, what to do now, and the way to its story. In the family of the arrival tag (Tulio
 *  found the first version, a bordered box with a colored label run into the text, generic). */
function MissionTag({ type, name, line, warn, steps, done, onRead, readLabel, readIcon }: { type: MissionType; name: string; line: string; warn: boolean; steps: number; done: number; onRead: (() => void) | null; readLabel: string; readIcon: "book" | "photos" }) {
  return (
    <div className={`mission panel m-${type}${warn ? " warn" : ""}`} role="status">
      <span className="mission-icon" aria-hidden="true">
        <PlaceMark kind={type} />
      </span>
      <span className="mission-body">
        <span className="mission-kicker">
          <span className="mission-name">{name}</span>
          <span className="mission-steps" aria-hidden="true">
            {Array.from({ length: steps }, (_, i) => (
              <i key={i} className={i < done ? "done" : undefined} />
            ))}
          </span>
        </span>
        <span className="mission-line" key={line}>
          {line}
        </span>
      </span>
      {onRead && (
        <button className="hbtn" onClick={onRead} title={readLabel}>
          {readIcon === "book" ? <IconBook /> : <IconPhotos />}
          <span className="lbl">{readLabel}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Where the top stack (mission tag, arrival tag, messages) goes on computers: always centered on
 * the screen (Tulio: it drifted right of center beside long zone names). Beside the title plate
 * when there is room for both: the stack gets the room left between the title (at least
 * PLATE_MIN, where a long name like "Esquina noreste · Pumpkin Hill" breaks onto two lines) and
 * any panel at the top right, up to STACK_MAX, and the title is held to its side of the stack, so
 * long names wrap rather than run under it. A narrower window puts the stack, still centered,
 * under the title. Phones use the CSS (above the dock).
 */
// The title's narrowest at its full size and, when that leaves the stack too little room, at the
// slightly smaller "tight" size; the stack needs ~480 px for a mission tag (icon, two lines, button).
const PLATE_MIN = 380, PLATE_TIGHT = 300, STACK_MIN = 480, STACK_MAX = 640;
function useStackRoom(ref: React.RefObject<HTMLDivElement | null>, key: string) {
  useLayoutEffect(() => {
    const stack = ref.current;
    if (!stack) return;
    const root = stack.parentElement!;
    const place = () => {
      const st = stack.style;
      const plate = root.querySelector<HTMLElement>(".plate");
      if (window.innerWidth <= 760) {
        st.left = st.right = st.top = st.justifyItems = "";
        stack.classList.remove("narrow");
        if (plate) (plate.style.maxWidth = ""), plate.classList.remove("tight");
        return;
      }
      const box = root.getBoundingClientRect();
      // The panel on the right, if it stands at the top (the sounder moves to the bottom corner on wide screens).
      const right = [...root.querySelectorAll(".hud-right, .site-card")].find((el) => el.getBoundingClientRect().top - box.top < box.height / 2);
      const plateLeft = plate ? plate.getBoundingClientRect().left - box.left : 22;
      const rightNeed = (right ? box.width - (right.getBoundingClientRect().left - box.left) : 18) + 20;
      const roomFor = (plateW: number) => Math.min(STACK_MAX, box.width - 2 * Math.max(plateLeft + plateW + 20, rightNeed));
      const tight = roomFor(PLATE_MIN) < STACK_MIN;
      const room = roomFor(tight ? PLATE_TIGHT : PLATE_MIN);
      st.justifyItems = "center";
      plate?.classList.toggle("tight", tight && room >= STACK_MIN);
      // Narrower than a mission tag needs: the tag's story button shows its icon alone.
      stack.classList.toggle("narrow", room < STACK_MIN && box.width - 2 * Math.max(22, rightNeed) < STACK_MIN);
      if (room >= STACK_MIN) {
        // Beside the title, centered; the title keeps to its side (it depends only on the room, not
        // on what the stack shows, so it doesn't rewrap as messages come and go).
        const inset = Math.round((box.width - room) / 2);
        st.left = st.right = `${inset}px`;
        st.top = "96px";
        if (plate) plate.style.maxWidth = `${Math.floor(Math.min(460, box.width * 0.6, inset - 20 - plateLeft))}px`;
      } else {
        // No room beside it: under the title, still centered on the screen.
        if (plate) plate.style.maxWidth = "";
        const inset = Math.max(22, rightNeed);
        st.left = st.right = `${Math.round(inset)}px`;
        st.top = `${Math.round((plate ? plate.getBoundingClientRect().bottom - box.top : 120) + 14)}px`;
      }
    };
    place();
    const ro = new ResizeObserver(place);
    const plate = root.querySelector(".plate");
    if (plate) ro.observe(plate);
    ro.observe(root);
    return () => ro.disconnect();
  }, [ref, key]);
}

/** Every place with something to photograph, in the album's order. */
const MISSION_SITES = SITES.filter((s) => missionType(s));

/** The logbook's Fotos tab: one frame per place of this island with something to photograph, the
 *  photo once taken (saved with one press: a small JPEG), its outline until then. Every dive site
 *  has its divers, so the places of this zone come first, under their own heading. */
function PhotoAlbum({ shots, here, sites, islandName }: { shots: Record<string, { url: string }>; here: string[]; sites: typeof MISSION_SITES; islandName: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const near = sites.filter((s) => here.includes(s.id));
  const rest = sites.filter((s) => !here.includes(s.id));
  const frames = (list: typeof MISSION_SITES) => (
    <div className="album">
      {list.map((s) => {
        const p = shots[s.id];
        const name = siteName(s, lang);
        return (
          <figure key={s.id} className={p ? "shot" : "shot empty"}>
            <div className="shot-img">
              {p ? <img src={p.url} alt={name} loading="lazy" /> : <PlaceMark kind={missionType(s)!} />}
              {p && (
                <a className="shot-save" href={p.url} download={`ReefQuest-${s.id}.jpg`} title={t("shot.save")} aria-label={`${t("shot.save")}: ${name}`}>
                  <IconDownload />
                </a>
              )}
            </div>
            <figcaption>
              <b>{name}</b>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
  return (
    <>
      {near.length > 0 && rest.length > 0 ? (
        <>
          <span className="hud-faint album-head">{t("shot.here")}</span>
          {frames(near)}
          <span className="hud-faint album-head">{t("shot.elsewhere").replace("{island}", islandName)}</span>
          {frames(rest)}
        </>
      ) : (
        frames(sites)
      )}
      <p className="hud-faint album-note">{t("shot.hint")}</p>
    </>
  );
}

/** The viewfinder: the frame the photo keeps (a centered 16:9 crop), a reticle that closes on a
 *  subject, its name, the shutter. The 3D view still turns under it (drag). */
function Viewfinder({ onShoot, onClose }: { onShoot: () => void; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const aim = useRoll((s) => s.aim);
  const flashAt = useRoll((s) => s.flash);
  const last = useRoll((s) => s.last);
  const lastUrl = useRoll((s) => (s.last ? s.photos[s.last]?.url : undefined));
  const s = aim ? SITES.find((x) => x.id === aim) : undefined;
  return (
    <div className={aim ? "hud viewfinder on" : "hud viewfinder"}>
      {flashAt > 0 && <div key={flashAt} className="vf-flash" />}
      <div className="vf-frame" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <b className="vf-reticle" />
      </div>
      <div className="vf-label" role="status">
        {s ? (
          <>
            <PlaceMark kind={missionType(s)!} />
            {siteName(s, lang)}
          </>
        ) : (
          t("shot.none")
        )}
      </div>
      {last && lastUrl && <img key={last + flashAt} className="vf-print" src={lastUrl} alt="" />}
      <div className="vf-controls">
        <button className="vf-close" onClick={onClose} aria-label={t("shot.close")} title={t("shot.close")}>
          <IconClose />
        </button>
        <button className="vf-shutter" onClick={onShoot} aria-label={t("shot.take")} title={`${t("shot.take")} (F)`} />
        <span className="vf-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
