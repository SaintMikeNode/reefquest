import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { useLang, useT } from "../i18n";
import { rampTable } from "../lib/alert";
import { navGuard } from "../lib/router";
import { transition } from "../ui/SceneTransition";
import { loadHeatIndex, loadLatest, loadSceneMeta, loadYearGrid, type HeatIndex } from "../lib/data";
import { MOBILE, pick, REDUCED_MOTION } from "../lib/device";
import { AdaptiveQuality, DPR, FrameCap } from "./AdaptiveQuality";
import { BoatHud } from "../boat/BoatHud";
import { zoneName, type ZoneIndexEntry } from "../boat/zone";
import { Hud } from "./Hud";
import { FOG_CALM, FOG_SEVERE, SCENE_FOG, terrainMaterial, waterMaterial } from "./materials";
import { clearLabels, LabelProjector, labelRef, setLabelAnchor } from "./labels";
import { CANOPY_GREENS, canopyGeometry, h01, PALM_GREENS, palmGeometry, vegetationMaterial } from "./nature";
import { heatRef, useScene } from "./sceneStore";
import { openSite, SiteBoats, sitesFade, usePlaces } from "./siteBoats";
import { buildGeometry, displayY, homeDistance, homeOffset, habitatAt, heightAt, loadTerrain, pickHeightfield, uvToLonLat, type TerrainData } from "./terrain";

const RAMP = rampTable();
const ISLAND_LABEL: Record<string, string> = { roatan: "Roatán", utila: "Utila", guanaja: "Guanaja", "cayos-cochinos": "Cayos Cochinos" };
// The boat mode (detailed zone tiles, boat, reef props) loads only when someone sets sail.
const BoatWorld = lazy(() => import("../boat/BoatWorld"));

export default function IslandScene({ island }: { island: string }) {
  const t = useT();
  const [td, setTd] = useState<TerrainData | null>(null);
  const [index, setIndex] = useState<HeatIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // The boat on screen follows the store through a transition: a water line rising when boarding, falling when
  // coming back to the island (the curtain closes, the scene switches, it opens again).
  const boatWanted = useScene((s) => s.boat);
  const [boat, setShownBoat] = useState(boatWanted);
  useEffect(() => {
    if (boatWanted === boat) return;
    const next = boatWanted;
    transition(
      next && !boat
        ? { kind: "board", label: "R/V Arrecife", apply: () => setShownBoat(next) }
        : !next
          ? { kind: "leave", label: ISLAND_LABEL[island] ?? island, apply: () => setShownBoat(null) }
          : { kind: "board", label: "R/V Arrecife", apply: () => setShownBoat(next) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boatWanted]);
  const [zoneEntry, setZoneEntry] = useState<ZoneIndexEntry | null>(null);
  const lang = useLang((s) => s.lang);

  useMouseGuards();

  const [glKey, setGlKey] = useState(0); // bumped to rebuild the 3D view after a lost GPU context

  // Zone display name for the boat HUD.
  useEffect(() => {
    if (!boat) return;
    fetch(`/data/${island}/zones/index.json`)
      .then((r) => r.json())
      .then((zs: ZoneIndexEntry[]) => setZoneEntry(zs.find((z) => z.id === boat.zone) ?? null))
      .catch(() => {});
  }, [boat, island]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadSceneMeta(island).then((m) => loadTerrain(m, `/data/${island}`)), loadHeatIndex(), loadLatest()])
      .then(([terrain, idx]) => {
        if (!alive) return;
        const last = idx.years[idx.years.length - 1];
        useScene.setState({ year: last.year, day: last.days - 1, site: null, playing: false, intro: false, introPending: true, readout: null, boat: null });
        setIndex(idx);
        setTd(terrain);
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [island]);

  if (err) return <div className="loading-screen"><div className="box">{err}</div></div>;
  if (!td || !index)
    return (
      <div className="loading-screen">
        <div className="box">
          <div>{t("scene.loadingTerrain")}</div>
          <div className="bar"><i /></div>
        </div>
      </div>
    );

  return (
    <div className="scene-root">
      <Canvas
        key={glKey}
        dpr={DPR.start}
        gl={{ antialias: !MOBILE, powerPreference: "high-performance" }}
        camera={{ position: homeCamera(td), fov: 42, near: 0.5, far: 4000 }}
        frameloop={boat && !MOBILE ? "always" : "demand"}
        onCreated={(st) => {
          if (import.meta.env.DEV) Object.assign(window, { __rqGl: st.gl, __rqScene: st.scene }); // dev: renderer.info for perf checks
          // If the GPU drops the 3D context (driver reset, memory pressure), the view would freeze
          // and stop answering clicks. Rebuild it: when the browser restores the context, or after
          // 2 s if it doesn't.
          const el = st.gl.domElement;
          let timer = 0;
          el.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            timer = window.setTimeout(() => setGlKey((k) => k + 1), 2000);
          });
          el.addEventListener("webglcontextrestored", () => {
            clearTimeout(timer);
            setGlKey((k) => k + 1);
          });
        }}
      >
        <color attach="background" args={["#020d16"]} />
        <AdaptiveQuality />
        {boat && MOBILE && <FrameCap fps={60} />}
        {boat ? (
          <Suspense fallback={null}>
            <BoatWorld key={boat.zone + boat.lon} island={island} zoneId={boat.zone} start={boat} />
          </Suspense>
        ) : (
          <World td={td} index={index} />
        )}
      </Canvas>
      {!boat && <PinOverlay td={td} />}
      {boat ? <BoatHud index={index} zoneName={zoneEntry ? zoneName(zoneEntry, lang) : ""} islandName={td.meta.name} /> : <Hud td={td} index={index} />}
    </div>
  );
}

/**
 * Keeps the mouse from leaving the 3D view by accident.
 * - Right-drag turns the camera, so the browser's context menu (whose first item is "Back") never
 *   opens anywhere over the scene, panels included (links and text fields keep theirs).
 * - A mouse's side "back" button pressed while dragging is ignored.
 * - The boat is a history step: Back (button, gesture or key) returns from the boat to the island
 *   instead of leaving the page, and leaving the boat with its own button consumes that step.
 * - Some browsers (Edge with mouse gestures on, Opera, Vivaldi, gesture extensions) read "hold the
 *   right button and drag left" as Back, and a page can't turn that off. A Back that arrives during
 *   or just after a right-drag over the scene is undone (history.go(1)), and the router ignores the
 *   hash change in between, so the view stays as it was.
 */
function useMouseGuards() {
  useEffect(() => {
    const inScene = (e: Event) => e.target instanceof Element && !!e.target.closest(".scene-root");
    const menu = (e: MouseEvent) => {
      if (inScene(e) && !(e.target as Element).closest("a, input, textarea, select")) e.preventDefault();
    };
    const side = (e: MouseEvent) => {
      if ((e.button === 3 || e.button === 4) && e.buttons & 3 && inScene(e)) e.preventDefault();
    };
    const sideEvents = ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick"] as const;
    document.addEventListener("contextmenu", menu, true);
    for (const t of sideEvents) document.addEventListener(t, side, true);

    // Right-drags over the scene: when the last one ended (ms), and whether one is under way.
    let rightDown = false, moved = false, rightUpAt = -1e9, downX = 0, downY = 0;
    const rDown = (e: PointerEvent) => {
      if (e.button !== 2 || !inScene(e)) return;
      rightDown = true;
      moved = false;
      downX = e.clientX;
      downY = e.clientY;
    };
    const rMove = (e: PointerEvent) => {
      // A right-drag whose release the browser swallowed (mouse gestures do): end it on the first move
      // without the right button, so a stale "right-drag under way" can't block later navigation.
      if (rightDown && !(e.buttons & 2)) {
        rightDown = false;
        if (moved) rightUpAt = performance.now();
        return;
      }
      if (rightDown && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
    };
    // A click on a link (e.g. "All islands") also fires popstate; that is never a gesture Back.
    let linkAt = -1e9;
    const linkClick = (e: MouseEvent) => {
      if (e.button === 0 && e.target instanceof Element && e.target.closest("a[href]")) linkAt = performance.now();
    };
    document.addEventListener("click", linkClick, true);
    const rUp = (e: PointerEvent) => {
      if (e.button !== 2 || !rightDown) return;
      rightDown = false;
      if (moved) rightUpAt = performance.now();
    };
    // Stuck camera: if a button's release never reaches the page (swallowed by a browser mouse
    // gesture, released outside the window, an alert…), the camera controls keep "holding" it, so the
    // view turns or pans on its own and clicks stop working. When the mouse moves with no button
    // down, or the window loses focus, while a press is still open, finish it with a pointerup.
    let held = 0, heldId = 1;
    const release = (pointerId: number) => {
      held = 0;
      document.dispatchEvent(new PointerEvent("pointerup", { pointerId, pointerType: "mouse", bubbles: true }));
    };
    const hDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !inScene(e)) return;
      held |= 1 << e.button;
      heldId = e.pointerId;
    };
    const hMove = (e: PointerEvent) => {
      if (held && e.pointerType !== "touch" && e.buttons === 0) release(e.pointerId);
    };
    const hUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") held = 0;
    };
    const blur = () => held && release(heldId);
    const rightEvents = [["pointerdown", rDown], ["pointermove", rMove], ["pointerup", rUp], ["pointerdown", hDown], ["pointermove", hMove], ["pointerup", hUp]] as const;
    for (const [t, fn] of rightEvents) window.addEventListener(t, fn, true);
    window.addEventListener("blur", blur);
    const sceneHash = location.hash;

    let pushed = false;
    const unsub = useScene.subscribe((s, prev) => {
      if (s.boat && !prev.boat && !pushed) {
        history.pushState({ rqBoat: true }, "");
        pushed = true;
      } else if (!s.boat && prev.boat && pushed) {
        pushed = false;
        if ((history.state as { rqBoat?: boolean } | null)?.rqBoat) history.back();
      }
    });
    const pop = (e: PopStateEvent) => {
      const fromLink = performance.now() - linkAt < 500;
      if (!fromLink && ((rightDown && moved) || performance.now() - rightUpAt < 1500)) {
        rightUpAt = -1e9;
        if (location.hash !== sceneHash) {
          navGuard.skip = 1;
          setTimeout(() => (navGuard.skip = 0), 1000); // never leave the router ignoring a real link
        }
        history.go(1);
        return;
      }
      if (!pushed || (e.state as { rqBoat?: boolean } | null)?.rqBoat) return;
      pushed = false;
      useScene.getState().setBoat(null);
    };
    window.addEventListener("popstate", pop);
    return () => {
      document.removeEventListener("contextmenu", menu, true);
      document.removeEventListener("click", linkClick, true);
      for (const t of sideEvents) document.removeEventListener(t, side, true);
      window.removeEventListener("popstate", pop);
      for (const [t, fn] of rightEvents) window.removeEventListener(t, fn, true);
      window.removeEventListener("blur", blur);
      unsub();
    };
  }, []);
}

function World({ td, index }: { td: TerrainData; index: HeatIndex }) {
  const layers = useScene((s) => s.layers);
  const year = useScene((s) => s.year);
  // The day is read outside React (see the subscription below): re-rendering this whole 3D tree on
  // every timelapse step (30-60 a second) starved the camera controls.
  const invalidate = useThree((s) => s.invalidate);

  const geometry = useMemo(() => buildGeometry(td, MOBILE ? 2 : 1), [td]);
  const scene = useThree((s) => s.scene);

  // Heat cells texture (cols × rows), refilled for the selected day. Shared by the sea (heat
  // overlay) and the seafloor (reefs whiten as heat passes the bleaching thresholds).
  const heat = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array(index.cols * index.rows * 4), index.cols, index.rows, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.flipY = false;
    return tex;
  }, [index]);
  const gridInfo = useMemo(() => ({ lat0: index.lat[0], lon0: index.lon[0], cell: index.cell_deg, cols: index.cols, rows: index.rows }), [index]);
  const terrainMat = useMemo(() => terrainMaterial(td.habitatTex, heat, td.meta.geo.uv_to_lonlat, gridInfo), [td, heat, gridInfo]);
  const waterMat = useMemo(() => waterMaterial(heat, td.meta.geo.uv_to_lonlat, gridInfo), [heat, td, gridInfo]);
  // The 5 km cells inside this scene (for the area's mean heat → mood and status line).
  const areaCells = useMemo(() => {
    const [lo, la] = td.meta.geo.uv_to_lonlat;
    const ll = (u: number, v: number) => [lo[0] * u + lo[1] * v + lo[2], la[0] * u + la[1] * v + la[2]];
    const pts = [ll(0, 0), ll(1, 0), ll(0, 1), ll(1, 1)];
    const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const out: number[] = [];
    for (let r = 0; r < index.rows; r++)
      for (let c = 0; c < index.cols; c++) {
        const lat = index.lat[0] - r * index.cell_deg, lon = index.lon[0] + c * index.cell_deg;
        if (lon >= Math.min(...lons) && lon <= Math.max(...lons) && lat >= Math.min(...lats) && lat <= Math.max(...lats)) out.push(r * index.cols + c);
      }
    return out;
  }, [td, index]);
  const gridRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    let alive = true;
    if (!year) return;
    loadYearGrid(year).then((g) => {
      if (!alive) return;
      gridRef.current = g;
      heatRef.grid = g;
      heatRef.year = year;
      fill(g, useScene.getState().day);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  function fill(g: Uint8Array, d: number) {
    const n = index.cols * index.rows;
    const data = heat.image.data as Uint8Array;
    const off = Math.min(d, g.length / n - 1) * n;
    for (let i = 0; i < n; i++) {
      const v = g[off + i];
      if (v === 255) {
        data[i * 4 + 3] = 0;
        continue;
      }
      data.set(RAMP.subarray(v * 4, v * 4 + 3), i * 4);
      data[i * 4 + 3] = Math.min(255, Math.round((v / 120) * 255));
    }
    heat.needsUpdate = true;
    // Mood: the scene's fog and background deepen toward a dark wine as the area's heat rises.
    let sum = 0, cnt = 0;
    for (const i of areaCells) {
      const v = g[off + i];
      if (v !== 255) (sum += v / 10), cnt++;
    }
    const mean = cnt ? sum / cnt : null;
    useScene.setState({ areaDhw: mean });
    const mood = mean === null ? 0 : Math.min(1, Math.max(0, (mean - 3) / 9));
    SCENE_FOG.lerpColors(FOG_CALM, FOG_SEVERE, mood * mood * (3 - 2 * mood));
    if (scene.background instanceof THREE.Color) scene.background.copy(SCENE_FOG);
    invalidate();
  }

  useEffect(
    () =>
      useScene.subscribe((st, prev) => {
        if (st.day !== prev.day && gridRef.current) fill(gridRef.current, st.day);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sitesFadeRef = useMemo(() => ({ get value() { return sitesFade.v; }, set value(x: number) { sitesFade.v = x; } }), []);
  // Layers fade in and out (~350 ms, ease-out) instead of switching: the uniforms (and the dive
  // sites' visibility) ease toward their targets and the scene redraws until they arrive.
  useEffect(() => {
    const targets: [{ value: number }, number][] = [
      [sitesFadeRef, layers.sites ? 1 : 0],
      [terrainMat.uniforms.uShowHabitat, layers.habitat ? 1 : 0],
      [terrainMat.uniforms.uShowContours, layers.contours ? 1 : 0],
      [terrainMat.uniforms.uShowHeat, layers.heat ? 1 : 0],
      [waterMat.uniforms.uShowHeat, layers.heat ? 1 : 0],
    ];
    if (REDUCED_MOTION) {
      for (const [u, v] of targets) u.value = v;
      invalidate();
      return;
    }
    const from = targets.map(([u]) => u.value);
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 350);
      const e = 1 - Math.pow(1 - k, 3);
      targets.forEach(([u, v], i) => (u.value = from[i] + (v - from[i]) * e));
      invalidate();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layers, terrainMat, waterMat, invalidate]);

  // Gentle animation (caustics, sheen) at ~30 fps unless lite / reduced motion.
  useEffect(() => {
    if (MOBILE || REDUCED_MOTION) return; // phones redraw only when something changes (battery, heat)
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33 || document.hidden) return;
      last = now;
      terrainMat.uniforms.uTime.value = now / 1000;
      waterMat.uniforms.uTime.value = now / 1000;
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [terrainMat, waterMat, invalidate]);

  return (
    <>
      <mesh geometry={geometry} material={terrainMat} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} material={waterMat} renderOrder={2}>
        <planeGeometry args={[td.sizeX, td.sizeZ]} />
      </mesh>
      <InstrumentGrid td={td} />
      <IslandVegetation td={td} />
      {/* Always mounted: the "Dive sites" layer fades them (sitesFade) instead of removing them. */}
      <Pins td={td} />
      <SiteBoats td={td} />
      <Picker td={td} />
      <CameraRig td={td} />
      <LabelProjector />
    </>
  );
}

/** Faint coordinate frame around the scene: a ring of ticks at sea level. */
function InstrumentGrid({ td }: { td: TerrainData }) {
  const geom = useMemo(() => {
    const pts: number[] = [];
    const hx = td.sizeX / 2, hz = td.sizeZ / 2;
    const y = 0.05;
    // Outline.
    const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz], [-hx, -hz]];
    for (let i = 0; i < 4; i++) pts.push(corners[i][0], y, corners[i][1], corners[i + 1][0], y, corners[i + 1][1]);
    // Ticks every 5 km (50 units) along the edges.
    for (let x = -hx; x <= hx; x += 50) pts.push(x, y, -hz, x, y, -hz - 6, x, y, hz, x, y, hz + 6);
    for (let z = -hz; z <= hz; z += 50) pts.push(-hx, y, z, -hx - 6, y, z, hx, y, z, hx + 6, y, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [td]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#5ff2ff" transparent opacity={0.35} />
    </lineSegments>
  );
}

function Pins({ td }: { td: TerrainData }) {
  const sites = usePlaces(td);
  useEffect(() => {
    for (const s of sites) setLabelAnchor(`pin:${s.id}`, s.x, s.y, s.z);
    return () => clearLabels("pin:");
  }, [sites]);
  // The marker posts fade with the "Dive sites" layer.
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = sitesFade.v > 0.01;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && "opacity" in m) m.opacity = 0.7 * sitesFade.v;
    });
  });
  return (
    <group ref={group}>
      {sites.map((s) => (
        <mesh key={s.id} position={[s.x, (s.y - 0.1) / 2, s.z]}>
          <cylinderGeometry args={[0.12, 0.12, s.y, 6]} />
          <meshBasicMaterial color={s.kind === "story" ? "#f2dcc8" : "#b9d4ee"} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** HTML pins positioned by LabelProjector. */
function PinOverlay({ td }: { td: TerrainData }) {
  const t = useT();
  const site = useScene((s) => s.site);
  const hover = useScene((s) => s.hover);
  const show = useScene((s) => s.layers.sites);
  const sites = usePlaces(td);
  // Kept rendered so the names fade with the layer (CSS); hidden from pointers and screen readers when off.
  return (
    <div className={show ? "label-layer" : "label-layer off"} aria-label="Sites" aria-hidden={!show}>
      {sites.map((s) => (
        <div key={s.id} className="label-anchor" ref={labelRef(`pin:${s.id}`)}>
          <button
            className={[site === s.id ? "pin on" : "pin", s.kind === "story" ? "" : s.kind, hover === s.id ? "hover" : ""].join(" ")}
            title={s.kind === "zone" ? t("boat.explore") : undefined}
            onClick={() => openSite(s)}
          >
            <span>{s.name}</span>
            <i />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Pointer → heightfield ray march → readout (lat/lon, height, habitat, DHW). */
function Picker({ td }: { td: TerrainData }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pending: PointerEvent | null = null;
    let raf = 0;
    const run = () => {
      raf = 0;
      const e = pending;
      if (!e) return;
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = pickHeightfield(td, ray.ray);
      if (!hit) return useScene.getState().setReadout(null);
      const { lon, lat } = uvToLonLat(td, hit.u, hit.v);
      const h = heightAt(td, hit.u, hit.v);
      const hab = habitatAt(td, hit.u, hit.v);
      useScene.getState().setReadout({ lat, lon, h, benthic: hab.benthic, geomorphic: hab.geomorphic, dhw: null });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pending = e;
      if (!raf) raf = requestAnimationFrame(run);
    };
    const onLeave = () => useScene.getState().setReadout(null);
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerleave", onLeave);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [camera, gl, td]);
  return null;
}

/** Map-style controls plus smooth fly-to when a site is chosen. */
function CameraRig({ td }: { td: TerrainData }) {
  const controls = useRef<MapControlsImpl>(null);
  const flyTo = useScene((s) => s.flyTo);
  const anim = useRef<{ fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; t: number } | null>(null);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.5;
    cam.far = 4000;
    cam.fov = 42;
    cam.updateProjectionMatrix();
    cam.position.set(...homeCamera(td));
    c.target.set(td.center.x, 0, td.center.z);
    c.update();
    // Demand rendering: draw again once controls, textures and the heat grid are in place.
    invalidate();
    const t1 = setTimeout(invalidate, 300);
    return () => clearTimeout(t1);
  }, [invalidate, td, camera]);

  useEffect(() => {
    if (!flyTo || !controls.current) return;
    const c = controls.current;
    const toT = new THREE.Vector3(flyTo.x, 0, flyTo.z);
    const dir = flyTo.home ? new THREE.Vector3(...homeOffset(td)).normalize() : camera.position.clone().sub(c.target).normalize();
    if (dir.y < 0.45) dir.y = 0.45;
    dir.normalize();
    const toP = toT.clone().add(dir.multiplyScalar(flyTo.dist));
    anim.current = { fromT: c.target.clone(), toT, fromP: camera.position.clone(), toP, t: 0 };
    invalidate();
  }, [flyTo, camera, invalidate, td]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 1.4);
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
    c.target.lerpVectors(a.fromT, a.toT, k);
    camera.position.lerpVectors(a.fromP, a.toP, k);
    c.update();
    if (a.t < 1) invalidate();
    else anim.current = null;
  });

  const half = Math.max(td.sizeX, td.sizeZ) / 2;
  return (
    <MapControls
      ref={controls as never}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minDistance={12}
      maxDistance={Math.max(half * 1.6, homeDistance(td) * 1.15)}
      maxPolarAngle={Math.PI * 0.46}
      // Mouse: drag moves, Shift (or Ctrl/Cmd) + drag rotates, wheel zooms. The right button does
      // nothing: browsers with mouse gestures read a right-drag as Back. Touch is unchanged.
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }}
      onChange={() => invalidate()}
    />
  );
}

function homeCamera(td: TerrainData): [number, number, number] {
  // Look at the land centroid from the south (landscape) or from the west (portrait), ~45° down.
  const [x, y, z] = homeOffset(td);
  return [td.center.x + x, y, td.center.z + z];
}

/** Forest canopy and coastal palms across the island (static instancing, scaled like the relief). */
function IslandVegetation({ td }: { td: TerrainData }) {
  const { scene } = useThree();
  const meshes = useMemo(() => {
    const canopy: number[] = [], palms: number[] = [];
    const step = pick(4, 3, 2);
    for (let j = 0; j < td.h; j += step)
      for (let i = 0; i < td.w; i += step) {
        const k = j * td.w + i;
        const h = td.heights[k];
        if (h < 1.2) continue;
        const r = h01(k);
        const u = (i + h01(k + 1) * step) / (td.w - 1), v = (j + h01(k + 2) * step) / (td.h - 1);
        const x = (u - 0.5) * td.sizeX, z = (v - 0.5) * td.sizeZ;
        if (h < 9 && r < 0.55) palms.push(x, displayY(h), z, h01(k + 3));
        else if (h >= 4 && r < 0.85) canopy.push(x, displayY(h), z, h01(k + 4));
      }
    const make = (arr: number[], geo: THREE.BufferGeometry, greens: string[], size: [number, number], tall: number, doubleSide: boolean) => {
      const n = arr.length / 4;
      const im = new THREE.InstancedMesh(geo, vegetationMaterial(undefined, 0, doubleSide), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) {
        const seed = arr[i * 4 + 3];
        const sz = size[0] + seed * (size[1] - size[0]);
        p.set(arr[i * 4], arr[i * 4 + 1] - 0.02, arr[i * 4 + 2]);
        q.setFromAxisAngle(up, seed * 50);
        s.set(sz, sz * tall, sz);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
        im.setColorAt(i, c.set(greens[Math.floor(seed * 977) % greens.length]));
      }
      im.instanceMatrix.needsUpdate = true;
      return im;
    };
    // Fewer, simpler and slightly larger trees on phones: the same green cover for a tenth of the triangles.
    const grow = step / 2;
    return [
      make(canopy, canopyGeometry(pick(0, 0, 1)), CANOPY_GREENS, [0.32 * grow, 0.55 * grow], 1.5, false),
      make(palms, palmGeometry(pick(0, 0, 1)), PALM_GREENS, [0.35 * grow, 0.5 * grow], 1.8, true),
    ];
  }, [td]);

  // Standard materials need lights and fog (the terrain shader does its own).
  useEffect(() => {
    scene.fog = new THREE.Fog("#020d16", 500, 2400);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return (
    <>
      <hemisphereLight args={["#bfe6ff", "#16322a", 0.9]} />
      <directionalLight position={[-300, 500, -250]} intensity={1.4} />
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}
