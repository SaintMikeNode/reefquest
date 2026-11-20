import { MapControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import { SITES } from "../content/sites";
import { useLang, useT } from "../i18n";
import { rampTable } from "../lib/alert";
import { loadHeatIndex, loadLatest, loadSceneMeta, loadYearGrid, type HeatIndex } from "../lib/data";
import { LITE, REDUCED_MOTION } from "../lib/device";
import { BoatHud } from "../boat/BoatHud";
import { zoneName, type ZoneIndexEntry } from "../boat/zone";
import { Hud } from "./Hud";
import { terrainMaterial, waterMaterial } from "./materials";
import { clearLabels, LabelProjector, labelRef, setLabelAnchor } from "./labels";
import { CANOPY_GREENS, canopyGeometry, h01, PALM_GREENS, palmGeometry, vegetationMaterial } from "./nature";
import { heatRef, useScene } from "./sceneStore";
import { buildGeometry, displayY, homeDistance, homeOffset, habitatAt, heightAt, loadTerrain, lonLatToUV, pickHeightfield, uvToLonLat, uvToXZ, type TerrainData } from "./terrain";

const RAMP = rampTable();
// The boat mode (detailed zone tiles, boat, reef props) loads only when someone sets sail.
const BoatWorld = lazy(() => import("../boat/BoatWorld"));

export default function IslandScene({ island }: { island: string }) {
  const t = useT();
  const [td, setTd] = useState<TerrainData | null>(null);
  const [index, setIndex] = useState<HeatIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const boat = useScene((s) => s.boat);
  const [zoneEntry, setZoneEntry] = useState<ZoneIndexEntry | null>(null);
  const lang = useLang((s) => s.lang);

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
        useScene.setState({ year: last.year, day: last.days - 1, site: null, playing: false, readout: null, boat: null });
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
        dpr={LITE ? 1 : [1, 1.75]}
        gl={{ antialias: !LITE, powerPreference: "high-performance" }}
        camera={{ position: homeCamera(td), fov: 42, near: 0.5, far: 4000 }}
        frameloop={boat ? "always" : "demand"}
      >
        <color attach="background" args={["#020d16"]} />
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

function World({ td, index }: { td: TerrainData; index: HeatIndex }) {
  const layers = useScene((s) => s.layers);
  const year = useScene((s) => s.year);
  const day = useScene((s) => s.day);
  const invalidate = useThree((s) => s.invalidate);

  const geometry = useMemo(() => buildGeometry(td, LITE ? 2 : 1), [td]);
  const terrainMat = useMemo(() => terrainMaterial(td.habitatTex), [td]);

  // Heat cells texture (cols × rows), refilled for the selected day.
  const heat = useMemo(() => {
    const tex = new THREE.DataTexture(new Uint8Array(index.cols * index.rows * 4), index.cols, index.rows, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.flipY = false;
    return tex;
  }, [index]);
  const waterMat = useMemo(
    () => waterMaterial(heat, td.meta.geo.uv_to_lonlat, { lat0: index.lat[0], lon0: index.lon[0], cell: index.cell_deg, cols: index.cols, rows: index.rows }),
    [heat, td, index],
  );
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
    invalidate();
  }

  useEffect(() => {
    if (gridRef.current) fill(gridRef.current, day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    terrainMat.uniforms.uShowHabitat.value = layers.habitat ? 1 : 0;
    terrainMat.uniforms.uShowContours.value = layers.contours ? 1 : 0;
    waterMat.uniforms.uShowHeat.value = layers.heat ? 1 : 0;
    invalidate();
  }, [layers, terrainMat, waterMat, invalidate]);

  // Gentle animation (caustics, sheen) at ~30 fps unless lite / reduced motion.
  useEffect(() => {
    if (LITE || REDUCED_MOTION) return;
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
      {layers.sites && <Pins td={td} />}
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

/** Dive-site anchor points for the screen-space pin overlay (rendered outside the Canvas). */
export function pinList(td: TerrainData) {
  return SITES.filter((s) => s.island === td.meta.island).map((s) => {
    const { u, v } = lonLatToUV(td, s.lon, s.lat);
    const { x, z } = uvToXZ(td, u, v);
    return { ...s, x, z, y: Math.max(displayY(heightAt(td, u, v)), 0) + (s.kind === "story" ? 9 : 4) };
  });
}

function Pins({ td }: { td: TerrainData }) {
  const sites = useMemo(() => pinList(td), [td]);
  useEffect(() => {
    for (const s of sites) setLabelAnchor(`pin:${s.id}`, s.x, s.y, s.z);
    return () => clearLabels("pin:");
  }, [sites]);
  return (
    <>
      {sites.map((s) => (
        <mesh key={s.id} position={[s.x, (s.y - 0.1) / 2, s.z]}>
          <cylinderGeometry args={[0.12, 0.12, s.y, 6]} />
          <meshBasicMaterial color={s.kind === "story" ? "#f2dcc8" : "#b9d4ee"} transparent opacity={0.7} />
        </mesh>
      ))}
    </>
  );
}

/** HTML pins positioned by LabelProjector. */
function PinOverlay({ td }: { td: TerrainData }) {
  const site = useScene((s) => s.site);
  const show = useScene((s) => s.layers.sites);
  const sites = useMemo(() => pinList(td), [td]);
  if (!show) return null;
  return (
    <div className="label-layer" aria-label="Sites">
      {sites.map((s) => (
        <div key={s.id} className="label-anchor" ref={labelRef(`pin:${s.id}`)}>
          <button
            className={[site === s.id ? "pin on" : "pin", s.kind === "dive" ? "dive" : ""].join(" ")}
            onClick={() => {
              const st = useScene.getState();
              st.setSite(s.id);
              st.fly(s.x, s.z, s.kind === "story" ? 70 : 50);
              if (s.date) {
                const y = Number(s.date.slice(0, 4));
                const d = Math.round((Date.parse(s.date + "T12:00:00Z") - Date.parse(`${y}-01-01T12:00:00Z`)) / 864e5);
                st.setYear(y, d);
              }
            }}
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
    const step = LITE ? 3 : 2;
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
    const make = (arr: number[], geo: THREE.BufferGeometry, greens: string[], size: [number, number], tall: number) => {
      const n = arr.length / 4;
      const im = new THREE.InstancedMesh(geo, vegetationMaterial(), n);
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
    return [make(canopy, canopyGeometry(), CANOPY_GREENS, [0.32, 0.55], 1.5), make(palms, palmGeometry(), PALM_GREENS, [0.35, 0.5], 1.8)];
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
