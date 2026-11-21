import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SITES } from "../content/sites";
import { LITE, MOBILE, pick, REDUCED_MOTION } from "../lib/device";
import { clearLabels, LabelProjector, setLabelAnchor } from "../scenes/labels";
import { CANOPY_GREENS, canopyGeometry, h01, PALM_GREENS, palmGeometry, vegetationMaterial } from "../scenes/nature";
import { abyssMaterial, seafloorMaterial, seaMaterial, skyMaterial, SKY_HORIZON, SUN } from "./boatMaterials";
import { makeVessel } from "./boatModel";
import { useBoat } from "./boatStore";
import { echo } from "./echo";
import { CAP, PALETTE, placeAround, reefCells, SIZE, SPECIES, speciesGeometries, speciesMaterial, type Species } from "./corals";
import { underwater, WATER, waterColorAt } from "./props";
import { LightShafts, MarineSnow } from "./underwaterFx";
import { SCENE_FOG } from "../scenes/materials";
import { COV_CELL, makeCoverage, resetCoverage, saveCoverage, SonarFan, stamp, type Coverage } from "./sonar";
import { floorY, habitatAtXZ, hash, heightAtXZ, loadZone, lonLatToXZ, xzToLonLat, ZoneLod, type Zone } from "./zone";

// Physics (m, s), tuned for fun rather than realism (a fun experience first: a real ~24 m research
// vessel cruises at ~4 m/s and turns slowly). Top speed ~26 m/s (~50 knots; Tulio found 31 knots
// still too slow to be fun) reached in about three seconds, quick turns, bow lift and lean, and a bump back off the shallows.
const V_MAX = 26;
const V_REV = 7;
const ACCEL = 14;
const DRAG = 0.54; // terminal speed = ACCEL / DRAG; also how fast it coasts to a stop
const YAW = 1.1; // rad/s at speed
const DRAFT = 2.2; // keel depth: shallower water ahead stops the boat
const BOW = 12.5;
const STERN = -12;
const PROP_RADIUS = 380;
const UP = new THREE.Vector3(0, 1, 0);
const CAST_SPEED = 2.2; // m/s winch speed

export default function BoatWorld({ island, zoneId, start }: { island: string; zoneId: string; start: { lon: number; lat: number } }) {
  const [zone, setZone] = useState<Zone | null>(null);
  useEffect(() => {
    let alive = true;
    useBoat.setState({ loading: true });
    echo.reset();
    loadZone(island, zoneId).then((z) => {
      if (!alive) return;
      useBoat.setState({ loading: false });
      const seen = new Set<number>();
      for (let i = 0; i < z.habitat.length; i += 4 * 7) if (z.habitat[i]) seen.add(z.habitat[i]);
      useBoat.getState().setPresent([...seen].sort((a, b) => a - b));
      useBoat.setState({ estimated: z.meta.bathymetry_source !== "aca-bathymetry" });
      setZone(z);
    });
    useBoat.getState().loadSamples(zoneId);
    return () => {
      alive = false;
    };
  }, [island, zoneId]);
  if (!zone) return null;
  return (
    <>
      <Scene zone={zone} start={start} />
      <LabelProjector />
    </>
  );
}

function Scene({ zone, start }: { zone: Zone; start: { lon: number; lat: number } }) {
  const { camera, scene } = useThree();
  const time = useRef({ value: 0 });
  const mapColors = useBoat((s) => s.mapColors);
  const sonarOn = useBoat((s) => s.sonar);
  const gridOn = useBoat((s) => s.grid);
  const resetReq = useBoat((s) => s.resetSurveyReq);

  const coverage = useMemo(() => makeCoverage(zone), [zone]);
  const floorLod = useMemo(() => new ZoneLod(zone, pick(160, 220, 500), pick(400, 560, 1200)), [zone]);
  const floorMat = useMemo(() => seafloorMaterial(zone.habitatTex, LITE, coverage.tex, [zone.sizeX, zone.sizeZ], COV_CELL), [zone, coverage]);
  const seaMat = useMemo(() => seaMaterial(zone.depthTex, [zone.sizeX, zone.sizeZ]), [zone]);
  const sky = useMemo(() => skyMaterial(), []);
  const abyss = useMemo(() => abyssMaterial(), []);
  const skyMesh = useRef<THREE.Mesh>(null);
  const abyssMesh = useRef<THREE.Mesh>(null);
  const shafts = useMemo(() => new LightShafts(pick(3, 5, 7)), []);
  const snow = useMemo(() => new MarineSnow(pick(300, 500, 900)), []);
  const { gl } = useThree();

  useEffect(() => {
    floorMat.uniforms.uMapColors.value = mapColors ? 1 : 0;
    floorMat.uniforms.uSonar.value = sonarOn ? 1 : 0;
    seaMat.uniforms.uGrid.value = gridOn ? 1 : 0;
  }, [mapColors, sonarOn, gridOn, floorMat, seaMat]);

  useEffect(() => {
    useBoat.setState({ surveyPct: coverage.totalSurveyable ? (100 * coverage.covered) / coverage.totalSurveyable : 0, surveyHa: (coverage.covered * COV_CELL * COV_CELL) / 10000 });
    const t = window.setInterval(() => saveCoverage(zone.meta.id, coverage), 10000);
    return () => {
      clearInterval(t);
      saveCoverage(zone.meta.id, coverage);
    };
  }, [zone, coverage]);

  useEffect(() => {
    if (!resetReq) return;
    resetCoverage(zone.meta.id, coverage);
    useBoat.setState({ surveyPct: 0, surveyHa: 0 });
  }, [resetReq, zone, coverage]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.3;
    cam.far = 12000;
    cam.fov = 50;
    cam.updateProjectionMatrix();
    scene.background = SKY_HORIZON.clone();
    return () => {
      scene.background = SCENE_FOG.clone(); // back to the island scene's mood color
    };
  }, [camera, scene]);

  useFrame((_, dt) => {
    if (!REDUCED_MOTION) time.current.value += dt;
    const t = time.current.value;
    floorMat.uniforms.uTime.value = t;
    seaMat.uniforms.uTime.value = t;
    sky.uniforms.uTime.value = t;
    // Underwater when the camera is below the surface: water fog instead of air haze.
    const under = camera.position.y < -0.05;
    WATER.uRqUnder.value = under ? 1 : 0;
    waterColorAt(-camera.position.y, WATER.uRqFog.value);
    WATER.uRqVis.value = LITE ? 18 : 26;
    if (skyMesh.current) skyMesh.current.visible = !under;
    if (abyssMesh.current) abyssMesh.current.visible = !under;
    (scene.background as THREE.Color).copy(under ? WATER.uRqFog.value : SKY_HORIZON);
    const { tele, under: diving } = useBoat.getState();
    const fx = tele?.x ?? startXZ.x, fz = tele?.z ?? startXZ.z;
    floorLod.update(fx, fz, diving);
    shafts.update(camera, fx, fz, floorY(heightAtXZ(zone, fx, fz)), t, under);
    snow.update(camera, t, gl.getPixelRatio(), under);
  });

  // Start as close to the site as possible in 4.5–14 m of water with reef (coral or hard bottom) close by, so the first
  // view is the reef; fall back to the nearest water at least 6 m deep (zone centers can be inland).
  const startXZ = useMemo(() => {
    const p = lonLatToXZ(zone, start.lon, start.lat);
    let best: { x: number; z: number } | null = null, bestD = Infinity;
    let deep = p, deepD = Infinity;
    for (let j = 0; j < zone.h; j += 2)
      for (let i = 0; i < zone.w; i += 2) {
        const h = zone.heights[j * zone.w + i];
        if (h >= -4.5) continue;
        const x = (i / (zone.w - 1) - 0.5) * zone.sizeX, z = (j / (zone.h - 1) - 0.5) * zone.sizeZ;
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (h < -6 && d < deepD) (deepD = d), (deep = { x, z });
        if (h < -14 || d >= bestD) continue; // anywhere in the zone, nearest to the site wins
        let reef = 0;
        for (const [ox, oz] of [[0, 0], [25, 0], [-25, 0], [0, 25], [0, -25]]) {
          const b = habitatAtXZ(zone, x + ox, z + oz).benthic;
          if (b === 15 || b === 13) reef++;
        }
        if (reef >= 3) (bestD = d), (best = { x, z });
      }
    if (best) return best;
    if (heightAtXZ(zone, p.x, p.z) < -6) return p;
    const dx = deep.x - p.x, dz = deep.z - p.z, l = Math.hypot(dx, dz) || 1;
    return { x: deep.x + (dx / l) * 50, z: deep.z + (dz / l) * 50 };
  }, [zone, start]);

  return (
    <>
      <mesh ref={skyMesh} material={sky} renderOrder={-1}>
        <sphereGeometry args={[9000, 32, 16]} />
      </mesh>
      <hemisphereLight args={["#d6efff", "#7d8270", 1.05]} />
      <directionalLight position={SUN.clone().multiplyScalar(100)} intensity={1.7} color="#fff3dc" />
      <mesh geometry={floorLod.geo} material={floorMat} frustumCulled={false} />
      <mesh ref={abyssMesh} rotation-x={-Math.PI / 2} position-y={-70} material={abyss}>
        <planeGeometry args={[30000, 30000, 1, 1]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={seaMat} renderOrder={3}>
        <planeGeometry args={[30000, 30000, 1, 1]} />
      </mesh>
      <Reef zone={zone} time={time.current} />
      <primitive object={shafts.group} />
      <primitive object={snow.points} />
      <Fish zone={zone} />
      <Vegetation zone={zone} time={time.current} />
      <Buoys zone={zone} />
      <Boat zone={zone} start={startXZ} coverage={coverage} />
    </>
  );
}

/** The vessel, its physics, sonar, CTD casts, wake, foam, chase camera and inputs. */
function Boat({ zone, start, coverage }: { zone: Zone; start: { x: number; z: number }; coverage: Coverage }) {
  const { camera, gl } = useThree();
  const vessel = useMemo(() => makeVessel(), []);
  const controls = useRef<OrbitControlsImpl>(null);
  const orbiting = useRef(false); // the person is dragging the camera: no auto chase
  const st = useRef({ x: start.x, z: start.z, a: Math.PI, v: 0, aground: false, lastTele: 0, sx: start.x, sz: start.z, lastTex: 0, under: false });
  const diving = useBoat((b) => b.under);
  const cast = useRef({ phase: "idle" as "idle" | "down" | "hold" | "up", L: 0, target: 0, t: 0, req: useBoat.getState().castReq });
  const wake = useMemo(() => new Wake(), []);
  const fan = useMemo(() => new SonarFan(), []);
  const foam = useMemo(() => hullFoam(), []);
  const marker = useRef<THREE.Mesh>(null);
  const base = useMemo(() => vessel.rosette.position.clone(), [vessel]);

  useEffect(() => {
    const s = st.current;
    const dx = Math.sin(s.a), dz = Math.cos(s.a);
    camera.position.set(s.x - dx * 62 + 18, 30, s.z - dz * 62);
    controls.current?.target.set(s.x, 3, s.z);
    controls.current?.update();
  }, [camera]);

  // Dev only: move the boat from the console (window.__rqBoat.current.x = …) and inspect the zone.
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __rqBoat: st, __rqZone: zone });
  }, [zone]);

  // Keyboard.
  useEffect(() => {
    const map: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    };
    const on = (v: boolean) => (e: KeyboardEvent) => {
      const k = map[e.code];
      if (!k || (e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      useBoat.getState().setKey(k, v);
    };
    const down = on(true), up = on(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      useBoat.setState({ keys: { up: false, down: false, left: false, right: false } });
    };
  }, []);

  // Tap / click on the water to steer there (ignored if the pointer moved: that was a camera drag).
  useEffect(() => {
    const el = gl.domElement;
    let downAt: { x: number; y: number; t: number } | null = null;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const pd = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() });
    const pu = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const quick = performance.now() - downAt.t < 450;
      downAt = null;
      if (moved > 8 || !quick || e.button !== 0) return;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (ray.ray.intersectPlane(plane, hit)) useBoat.getState().setTarget({ x: hit.x, z: hit.z });
    };
    el.addEventListener("pointerdown", pd);
    el.addEventListener("pointerup", pu);
    return () => {
      el.removeEventListener("pointerdown", pd);
      el.removeEventListener("pointerup", pu);
    };
  }, [gl, camera]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const c = cast.current;
    const store = useBoat.getState();
    const { keys, target, setTarget } = store;
    const t = state.clock.elapsedTime;
    const depthHere = Math.max(0, -heightAtXZ(zone, s.x, s.z));

    // ---- CTD cast: hold station, lower the rosette to ~1.5 m above the bottom, record, recover.
    const rest = base.y + 0.6; // rosette center above the waterline at rest
    if (store.castReq !== c.req && c.phase === "idle" && depthHere > 1) {
      c.req = store.castReq;
      c.phase = "down";
      c.target = rest + Math.max(0.5, depthHere - 1.5);
      setTarget(null);
    }
    const casting = c.phase !== "idle";
    if (casting) {
      if (c.phase === "down") {
        c.L = Math.min(c.target, c.L + CAST_SPEED * dt);
        if (c.L >= c.target) (c.phase = "hold"), (c.t = 0);
      } else if (c.phase === "hold") {
        c.t += dt;
        if (c.t > 1.2) {
          const hab = habitatAtXZ(zone, s.x, s.z);
          const ll = xzToLonLat(zone, s.x, s.z);
          store.addSample({ t: Date.now(), lat: ll.lat, lon: ll.lon, depth: depthHere, benthic: hab.benthic, geomorphic: hab.geomorphic, dhw: null });
          c.phase = "up";
        }
      } else {
        c.L = Math.max(0, c.L - CAST_SPEED * 1.3 * dt);
        if (c.L <= 0) c.phase = "idle";
      }
      useBoat.setState({ cast: { phase: c.phase, depth: Math.max(0, c.L - rest), target: depthHere } });
    }
    vessel.rosette.position.set(base.x, base.y - c.L, base.z);
    const cableTop = vessel.ctdTop.y, cableBottom = base.y - c.L + 0.6;
    vessel.cable.scale.y = Math.max(0.01, cableTop - cableBottom);
    vessel.cable.position.set(base.x, (cableTop + cableBottom) / 2, base.z);

    // ---- Helm.
    let throttle = casting ? 0 : (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    let turn = casting ? 0 : (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    if (!casting && target && !throttle && !turn) {
      const dx = target.x - s.x, dz = target.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 18) setTarget(null);
      else {
        let diff = Math.atan2(dx, dz) - s.a;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        turn = Math.max(-1, Math.min(1, diff * 2));
        throttle = Math.abs(diff) > 1.6 ? 0.25 : Math.min(1, Math.max(0.3, dist / 150));
      }
    }
    // Reversing against forward way (or the other way round) brakes hard.
    const braking = throttle !== 0 && Math.sign(throttle) !== Math.sign(s.v) && Math.abs(s.v) > 0.5;
    s.v += (throttle * (throttle > 0 ? ACCEL : ACCEL * 0.6) * (braking ? 1.8 : 1) - DRAG * s.v) * dt;
    if (casting) s.v *= 1 - Math.min(1, dt * 1.5);
    s.v = Math.max(-V_REV, Math.min(V_MAX, s.v));
    const turnRate = YAW * Math.min(1, 0.3 + Math.abs(s.v) / 4);
    s.a += turn * turnRate * dt * (s.v < -0.1 ? -1 : 1);
    const dirx = Math.sin(s.a), dirz = Math.cos(s.a);
    const nx = s.x + dirx * s.v * dt, nz = s.z + dirz * s.v * dt;
    const probe = s.v >= 0 ? BOW : STERN;
    const ahead = heightAtXZ(zone, nx + dirx * probe, nz + dirz * probe);
    const margin = 100;
    const inside = Math.abs(nx) < zone.sizeX / 2 - margin && Math.abs(nz) < zone.sizeZ / 2 - margin;
    if (ahead > -DRAFT || !inside) {
      s.aground = Math.abs(s.v) > 0.05 || s.aground;
      s.v = Math.abs(s.v) > 2 ? -s.v * 0.3 : 0; // bounce back a little
      if (target) setTarget(null);
    } else {
      s.x = nx;
      s.z = nz;
      if (Math.abs(s.v) > 0.3) s.aground = false;
    }

    // ---- Pose: swell, pitch with speed, heel into turns.
    // At speed she rises onto the plane (bow up), skips over the chop and leans into turns.
    const fast = Math.max(0, s.v) / V_MAX;
    const hop = Math.abs(Math.sin(t * 5.3)) * 0.35 * fast * fast;
    vessel.group.position.set(s.x, Math.sin(t * 0.9) * 0.18 - 0.05 + fast * 0.5 + hop, s.z);
    vessel.group.rotation.set(Math.sin(t * 0.7) * 0.015 - fast * 0.09 - hop * 0.08, s.a, Math.sin(t * 0.8) * 0.02 - turn * fast * 0.2, "YXZ");
    // Diving, the camera sits right under the boat: its dark red bottom paint filled the top of the
    // view like a wall (worst on tall phone screens). Hide the vessel then, keeping the CTD and its cable.
    for (const ch of vessel.group.children) ch.visible = !store.under || ch === vessel.rosette || ch === vessel.cable;
    vessel.radar[0].rotation.y += dt * 2.2;
    vessel.radar[1].rotation.y -= dt * 3.1;
    const fp = vessel.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i);
      fp.setZ(i, Math.sin(t * 6 + x * 5) * 0.08 * (x + 0.6));
    }
    fp.needsUpdate = true;

    foam.visible = wake.mesh.visible = !store.under; // surface effects: seen from below they read as slabs
    foam.position.set(s.x, 0.05, s.z);
    foam.rotation.y = s.a;
    (foam.material as THREE.ShaderMaterial).uniforms.uSpeed.value = Math.abs(s.v) / V_MAX;
    (foam.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    // ---- Chase camera: above the water, or diving close to the reef under the boat.
    const ctl = controls.current;
    if (ctl) {
      const diving = store.under;
      const bottom = floorY(heightAtXZ(zone, s.x, s.z));
      if (diving !== s.under) {
        s.under = diving;
        if (diving) {
          ctl.target.set(s.x, Math.min(-1.5, bottom + 1.6), s.z);
          camera.position.set(s.x - dirx * 11 + dirz * 7, ctl.target.y + 2.2, s.z - dirz * 11 - dirx * 7);
        } else {
          ctl.target.set(s.x, 3, s.z);
          camera.position.set(s.x - dirx * 62 + 18, 30, s.z - dirz * 62);
        }
      }
      const ddx = s.x - ctl.target.x, ddz = s.z - ctl.target.z;
      ctl.target.x += ddx;
      ctl.target.z += ddz;
      camera.position.x += ddx;
      camera.position.z += ddz;
      if (!diving && !orbiting.current && fast > 0.15) {
        // Under way and not being dragged: the camera swings round behind the boat, like a chase cam.
        const ox = camera.position.x - ctl.target.x, oz = camera.position.z - ctl.target.z;
        let diff = Math.atan2(-dirx, -dirz) - Math.atan2(ox, oz);
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const k = diff * Math.min(1, dt * 1.6 * fast);
        const c = Math.cos(k), sn = Math.sin(k);
        camera.position.x = ctl.target.x + ox * c + oz * sn;
        camera.position.z = ctl.target.z - ox * sn + oz * c;
      }
      if (diving) {
        // Follow the seafloor smoothly, and keep the camera in the water column.
        const dy = (Math.min(-1.5, bottom + 1.6) - ctl.target.y) * Math.min(1, dt * 2);
        ctl.target.y += dy;
        camera.position.y += dy;
      }
      ctl.update();
      if (diving) {
        const floorCam = floorY(heightAtXZ(zone, camera.position.x, camera.position.z));
        camera.position.y = Math.min(-0.5, Math.max(floorCam + 0.7, camera.position.y));
      }
    }

    wake.push(s.x - dirx * 12, s.z - dirz * 12, Math.abs(s.v), dt);

    // ---- Multibeam survey.
    const sonarOn = store.sonar;
    fan.update(zone, s.x, s.z, s.a, depthHere, t, sonarOn && !store.under);
    if (sonarOn && Math.hypot(s.x - s.sx, s.z - s.sz) > 4) {
      s.sx = s.x;
      s.sz = s.z;
      stamp(coverage, zone, s.x, s.z, s.a, depthHere);
    }
    if (coverage.dirty && t - s.lastTex > 0.25) {
      s.lastTex = t;
      coverage.dirty = false;
      coverage.tex.needsUpdate = true;
      useBoat.setState({ surveyPct: coverage.totalSurveyable ? (100 * coverage.covered) / coverage.totalSurveyable : 0, surveyHa: (coverage.covered * COV_CELL * COV_CELL) / 10000 });
    }

    if (marker.current) {
      marker.current.visible = !!target;
      if (target) marker.current.position.set(target.x, 0.15 + Math.sin(t * 4) * 0.1, target.z);
    }

    // ---- Telemetry ~10×/s (and the echogram).
    if (t - s.lastTele > (MOBILE ? 0.16 : 0.1)) { // HUD updates: 6 per second on phones, 10 on desktop
      s.lastTele = t;
      const hab = habitatAtXZ(zone, s.x, s.z);
      const ll = xzToLonLat(zone, s.x, s.z);
      echo.push(depthHere, hab.benthic);
      store.setTele({
        x: s.x, z: s.z, heading: (((Math.PI - s.a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), speed: s.v,
        depth: depthHere, benthic: hab.benthic, geomorphic: hab.geomorphic, lat: ll.lat, lon: ll.lon, aground: s.aground,
      });
      let near: string | null = null;
      for (const site of SITES) {
        if (site.island !== zone.meta.island) continue;
        const p = lonLatToXZ(zone, site.lon, site.lat);
        if (Math.hypot(p.x - s.x, p.z - s.z) < 80) near = site.id;
      }
      if (near !== store.near) store.setNear(near);
    }
  });

  return (
    <>
      <primitive object={vessel.group} />
      <primitive object={foam} />
      <primitive object={wake.mesh} />
      <primitive object={fan.mesh} />
      <mesh ref={marker} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[3.2, 4.2, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <OrbitControls
        ref={controls as never}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        enablePan={false}
        minDistance={diving ? 2.5 : 22}
        maxDistance={diving ? 38 : 520}
        maxPolarAngle={diving ? Math.PI * 0.94 : Math.PI * 0.47}
        onStart={() => (orbiting.current = true)}
        onEnd={() => (orbiting.current = false)}
      />
    </>
  );
}

/** White water around the hull and a bow wave that grows with speed. */
function hullFoam() {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uSpeed: { value: 0 }, uTime: { value: 0 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform float uSpeed; uniform float uTime; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
      float band(float x, float a, float b){ float w = fwidth(x); return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
      void main(){
        // vP: x across, y forward (local). r = 1 roughly at the hull's waterline.
        vec2 q = vec2(vP.x / 4.3, (vP.y - 0.3) / 13.4);
        float r = length(q) + (n(vP * 0.7 + uTime * 1.2) - 0.5) * 0.05;
        // Foam collar hugging the hull (wider when moving).
        float collar = band(r, 0.86, 1.04 + 0.06 * uSpeed);
        // At rest, thin rings spreading from the hull as it bobs.
        float rings = 0.0;
        for (int k = 0; k < 2; k++) {
          float ph = fract(uTime * 0.3 + float(k) * 0.5);
          rings += band(r, 1.06 + ph * 0.55, 1.09 + ph * 0.55) * (1.0 - ph);
        }
        // Bow wave: two crisp V stripes spreading back from the bow, broken up by noise.
        float side = abs(vP.x) - (12.8 - vP.y) * 0.42;
        float bow = (band(side, -0.3, 0.5) + band(side, 1.6, 2.1) * 0.6) * smoothstep(-10.0, 8.0, vP.y) * step(vP.y, 13.0);
        float brk = smoothstep(0.35, 0.5, n(vP * 0.9 + vec2(0.0, uTime * 3.0)));
        float a = max(collar * (0.75 + 0.2 * uSpeed), rings * 0.55 * (1.0 - uSpeed));
        a = max(a, bow * uSpeed * brk);
        gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), a);
      }`,
  });
  // Flat plane in the XZ plane; z = forward.
  const g = new THREE.PlaneGeometry(24, 52, 1, 1); // room for the rings
  g.rotateX(-Math.PI / 2); // plane y → −z
  g.scale(1, 1, -1); // so local "forward" is +z (a flat plane: winding doesn't matter, DoubleSide)
  m.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return mesh;
}

/** Foam trail behind the stern: a ribbon of recent positions that widens and fades. */
class Wake {
  N = 80;
  pts: { x: number; z: number; age: number }[] = [];
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private alpha: Float32Array;
  constructor() {
    this.pos = new Float32Array(this.N * 2 * 3);
    this.alpha = new Float32Array(this.N * 2);
    const side = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) side[i * 2 + 1] = 1; // 0 = one edge of the trail, 1 = the other
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: "attribute float aAlpha; attribute float aSide; varying float vA; varying float vS; varying vec2 vP; void main(){ vA = aAlpha; vS = aSide; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        varying float vA; varying float vS; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
        void main(){
          float e = abs(vS - 0.5) * 2.0; // 0 in the middle, 1 at the edges
          float w = fwidth(e);
          float lines = smoothstep(0.7 - w, 0.7 + w, e) * (1.0 - smoothstep(0.97 - w, 0.97 + w, e));
          float churn = smoothstep(0.45, 0.65, n(vP * 0.35)) * (1.0 - e) * 0.55;
          float a = vA * 1.4 * max(lines * smoothstep(0.3, 0.55, n(vP * 0.5)), churn);
          gl_FragColor = vec4(0.97, 0.99, 1.0, min(a, 0.95));
        }`,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }
  push(x: number, z: number, speed: number, dt: number) {
    for (const p of this.pts) p.age += dt;
    const last = this.pts[0];
    if (speed > 0.5 && (!last || Math.hypot(last.x - x, last.z - z) > 3)) this.pts.unshift({ x, z, age: 0 });
    while (this.pts.length > this.N || (this.pts.length && this.pts[this.pts.length - 1].age > 14)) this.pts.pop();
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[i];
      const q = this.pts[Math.min(i + 1, this.pts.length - 1)] ?? p;
      if (!p) {
        this.alpha[i * 2] = this.alpha[i * 2 + 1] = 0;
        continue;
      }
      let dx = p.x - (q?.x ?? p.x), dz = p.z - (q?.z ?? p.z);
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const w = 2.6 + p.age * 1.9;
      this.pos.set([p.x - dz * w, 0.06, p.z + dx * w, p.x + dz * w, 0.06, p.z - dx * w], i * 6);
      const a = Math.max(0, 0.6 - p.age / 14) * Math.min(1, speed / 2 + 0.3);
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

/** Instanced reef life within PROP_RADIUS of the boat, refreshed as it moves. */
function Reef({ zone, time }: { zone: Zone; time: { value: number } }) {
  const cells = useMemo(() => reefCells(zone), [zone]);
  // Two meshes per species: detailed shapes near the boat, simplified ones beyond (and everywhere on
  // phones while above water, where colonies are a few pixels seen through the surface).
  const meshes = useMemo(() => {
    const hiGeo = speciesGeometries(false), loGeo = speciesGeometries(true);
    const m = {} as Record<Species, { hi: THREE.InstancedMesh; lo: THREE.InstancedMesh }>;
    for (const sp of SPECIES) {
      const mat = underwater(speciesMaterial(sp, time));
      const make = (geo: THREE.BufferGeometry, cap: number) => {
        const im = new THREE.InstancedMesh(geo, mat, Math.max(8, Math.round(cap)));
        im.count = 0;
        im.frustumCulled = false;
        im.visible = false;
        return im;
      };
      m[sp] = { hi: make(hiGeo[sp], CAP[sp] * pick(0.12, 0.2, 0.45)), lo: make(loGeo[sp], CAP[sp] * pick(0.35, 0.6, 1)) };
    }
    return m;
  }, [time]);
  const last = useRef({ x: 1e9, z: 1e9, under: false });
  useEffect(() => {
    last.current = { x: 1e9, z: 1e9, under: false }; // new (empty) meshes: place again
  }, [meshes]);
  const tmp = useMemo(
    () => ({ m4: new THREE.Matrix4(), q: new THREE.Quaternion(), sc: new THREE.Vector3(), pos: new THREE.Vector3(), col: new THREE.Color(), tilt: new THREE.Quaternion(), axis: new THREE.Vector3(), near: new Map<Species, number>() }),
    [],
  );
  const palettes = useMemo(() => Object.fromEntries(SPECIES.map((sp) => [sp, PALETTE[sp].map((c) => new THREE.Color(c))])) as Record<Species, THREE.Color[]>, []);

  useFrame(() => {
    const st = useBoat.getState();
    const tele = st.tele;
    if (!tele) return;
    const moved = Math.hypot(tele.x - last.current.x, tele.z - last.current.z);
    if (moved < (st.under ? 12 : 40) && st.under === last.current.under) return;
    last.current = { x: tele.x, z: tele.z, under: st.under };
    // Underwater the water hides everything past a few tens of meters: place only what can be seen.
    const radius = st.under ? pick(45, 58, 75) : pick(200, 260, PROP_RADIUS);
    const dense = st.under ? radius * 0.6 : pick(35, 50, 75);
    const hiR = st.under ? pick(16, 24, 60) : pick(0, 0, 60);
    const hiR2 = hiR * hiR;
    const { m4, q, sc, pos, tilt, axis, near } = tmp;
    for (const sp of SPECIES) meshes[sp].hi.count = meshes[sp].lo.count = 0;
    near.clear();
    placeAround(cells, tele.x, tele.z, radius, dense, (sp, x, z, seed, d2) => {
      const pair = meshes[sp];
      // Detailed mesh while there is room, else the simplified one; over budget: skip (nearest came first).
      const im = d2 < hiR2 && pair.hi.count < pair.hi.instanceMatrix.count ? pair.hi : pair.lo;
      const n = im.count;
      if (n >= im.instanceMatrix.count) return;
      if (d2 < 1600) near.set(sp, (near.get(sp) ?? 0) + 1);
      const [s0, s1] = SIZE[sp];
      const size = s0 + hash(seed * 17.3) * s1;
      const y = floorY(heightAtXZ(zone, x, z));
      pos.set(x, y - (sp === "brain" || sp === "star" ? size * 0.08 : 0.02), z);
      q.setFromAxisAngle(UP, seed * 40);
      // Everything stands with a small random tilt (seagrass leans more).
      axis.set(hash(seed * 3.1) - 0.5, 0, hash(seed * 5.7) - 0.5).normalize();
      tilt.setFromAxisAngle(axis, (hash(seed * 9.1) - 0.5) * (sp === "grass" ? 0.5 : 0.22));
      q.premultiply(tilt);
      sc.set(size, size * (0.85 + hash(seed * 23.9) * 0.3), size);
      m4.compose(pos, q, sc);
      im.setMatrixAt(n, m4);
      const pal = palettes[sp];
      im.setColorAt(n, pal[Math.floor(hash(seed * 31.3) * pal.length) % pal.length]);
      im.count = n + 1;
    });
    for (const sp of SPECIES)
      for (const im of [meshes[sp].hi, meshes[sp].lo]) {
        im.visible = im.count > 0;
        if (!im.count) continue;
        im.instanceMatrix.clearUpdateRanges();
        im.instanceMatrix.addUpdateRange(0, im.count * 16);
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) {
          im.instanceColor.clearUpdateRanges();
          im.instanceColor.addUpdateRange(0, im.count * 3);
          im.instanceColor.needsUpdate = true;
        }
      }
    // What grows within 40 m, most common first (for the field guide).
    const nearby = [...near.entries()].sort((a, b) => b[1] - a[1]).map(([sp]) => sp);
    const prev = st.nearby;
    if (nearby.length !== prev.length || nearby.some((sp, i) => sp !== prev[i])) useBoat.setState({ nearby });
  });

  return (
    <>
      {SPECIES.map((sp) => (
        <group key={sp}>
          <primitive object={meshes[sp].hi} />
          <primitive object={meshes[sp].lo} />
        </group>
      ))}
    </>
  );
}

/**
 * A low-poly forest clump (one to three faceted blobs, white vertex colors darkening toward the
 * base so instance colors shade it): stands in for many trees on far hillsides.
 */
function clumpGeometry(blobs: 1 | 3): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const spots = blobs === 1 ? [[0, 0.5, 0, 0.55]] : [[0, 0.55, 0, 0.5], [0.42, 0.4, 0.15, 0.38], [-0.3, 0.38, -0.32, 0.36]];
  for (const [x, y, z, r] of spots) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, 0.85, 1);
    g.translate(x, y, z);
    parts.push(g.toNonIndexed());
  }
  const g = mergeGeometries(parts)!;
  g.deleteAttribute("uv");
  const p = g.getAttribute("position"), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) col.fill(0.7 + 0.3 * Math.min(1, p.getY(i) / 0.9), i * 3, i * 3 + 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Vegetation on the zone's land, stylized and chunky so the islands read from the water:
 * palms on the coast and broadleaf trees inland near the boat (within R), and big forest clumps
 * over the rest of the tile out to RF so the far hills aren't bare. All instanced (one draw call
 * per kind), distance-culled around the boat and capped per device tier; refilled every 150 m.
 */
function Vegetation({ zone, time }: { zone: Zone; time: { value: number } }) {
  const R = pick(700, 900, 1200), RF = pick(2000, 2600, 3400);
  const cand = useMemo(() => {
    const palms: number[] = [], trees: number[] = [], clumps: number[] = [];
    // Forest clumps on a coarser grid (every 4th cell, ~40 m), on land above 2.5 m.
    for (let j = 0; j < zone.h; j += 4)
      for (let i = 0; i < zone.w; i += 4) {
        const k = j * zone.w + i;
        const h = zone.heights[k];
        if (h < 2.5 || h01(k + 7) > 0.85) continue;
        const x = ((i + h01(k + 5) * 4) / (zone.w - 1) - 0.5) * zone.sizeX, z = ((j + h01(k + 6) * 4) / (zone.h - 1) - 0.5) * zone.sizeZ;
        clumps.push(x, h, z, h01(k + 8));
      }
    for (let j = 0; j < zone.h; j++)
      for (let i = 0; i < zone.w; i++) {
        const k = j * zone.w + i;
        const h = zone.heights[k];
        if (h < 0.9) continue;
        const r = h01(k);
        const x = ((i + h01(k + 1)) / (zone.w - 1) - 0.5) * zone.sizeX, z = ((j + h01(k + 2)) / (zone.h - 1) - 0.5) * zone.sizeZ;
        if (h < 7 && r < 0.3) palms.push(x, h, z, h01(k + 3));
        else if (h >= 3 && r < 0.42) trees.push(x, h, z, h01(k + 4));
      }
    return { palms: new Float32Array(palms), trees: new Float32Array(trees), clumps: new Float32Array(clumps) };
  }, [zone]);
  const meshes = useMemo(() => {
    const capP = pick(300, 500, 1100), capT = pick(500, 900, 2400), capC = pick(260, 500, 800);
    const palms = new THREE.InstancedMesh(palmGeometry(pick(0, 0, 2)), vegetationMaterial(time, 0.06), capP);
    const trees = new THREE.InstancedMesh(canopyGeometry(pick(0, 1, 2)), vegetationMaterial(undefined, 0, false), capT);
    const clumps = new THREE.InstancedMesh(clumpGeometry(pick(1, 1, 3)), vegetationMaterial(undefined, 0, false), capC);
    palms.count = trees.count = clumps.count = 0;
    palms.frustumCulled = trees.frustumCulled = clumps.frustumCulled = false;
    return { palms, trees, clumps };
  }, [time]);
  const last = useRef({ x: 1e9, z: 1e9 });
  useFrame(() => {
    const { tele, under } = useBoat.getState();
    meshes.palms.visible = meshes.trees.visible = meshes.clumps.visible = !under; // land can't be seen from under the water
    if (!tele || under || Math.hypot(tele.x - last.current.x, tele.z - last.current.z) < 150) return;
    last.current = { x: tele.x, z: tele.z };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const fill = (arr: Float32Array, im: THREE.InstancedMesh, greens: string[], h0: number, h1: number, wide: number, r0 = 0, r1 = R) => {
      const cap = im.instanceMatrix.count;
      const inBand = (i: number) => {
        const d2 = (arr[i] - tele.x) ** 2 + (arr[i + 2] - tele.z) ** 2;
        return d2 >= r0 * r0 && d2 < r1 * r1;
      };
      let inR = 0;
      for (let i = 0; i < arr.length; i += 4) if (inBand(i)) inR++;
      const keep = Math.min(1, cap / Math.max(inR, 1));
      let n = 0;
      for (let i = 0; i < arr.length && n < cap; i += 4) {
        if (!inBand(i)) continue;
        const seed = arr[i + 3];
        if ((seed * 7919) % 1 > keep) continue;
        const ht = h0 + seed * (h1 - h0);
        p.set(arr[i], arr[i + 1] - 0.3, arr[i + 2]);
        q.setFromAxisAngle(up, seed * 60);
        s.set(ht * wide, ht, ht * wide);
        m4.compose(p, q, s);
        im.setMatrixAt(n, m4);
        im.setColorAt(n, col.set(greens[Math.floor(seed * 991) % greens.length]));
        n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    // Chunky, stylized sizes (about 1.4× real) so they read from the water.
    fill(cand.palms, meshes.palms, PALM_GREENS, 11, 19, 0.9);
    fill(cand.trees, meshes.trees, CANOPY_GREENS, 10, 21, 1.15);
    // Clumps start a little inside the tree radius so the two blend, out to the far hills.
    fill(cand.clumps, meshes.clumps, CANOPY_GREENS, 26, 44, 1.5, R * 0.8, RF);
  });
  return (
    <>
      <primitive object={meshes.palms} />
      <primitive object={meshes.trees} />
      <primitive object={meshes.clumps} />
    </>
  );
}

/** Mooring buoys at the real dive-site positions inside this zone (labels: BoatHud overlay). */
function Buoys({ zone }: { zone: Zone }) {
  const sites = useMemo(
    () =>
      SITES.filter((s) => s.island === zone.meta.island)
        .map((s) => ({ ...s, ...lonLatToXZ(zone, s.lon, s.lat) }))
        .filter((s) => Math.abs(s.x) < zone.sizeX / 2 - 50 && Math.abs(s.z) < zone.sizeZ / 2 - 50),
    [zone],
  );
  useEffect(() => {
    for (const s of sites) setLabelAnchor(`buoy:${s.id}`, s.x, 3.6, s.z);
    useBoat.setState({ buoys: sites.map((s) => s.id) });
    return () => {
      clearLabels("buoy:");
      useBoat.setState({ buoys: [] });
    };
  }, [sites]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = Math.sin(t * 1.7 + i) * 0.15;
      g.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.12;
    });
  });
  return (
    <>
      {sites.map((s, i) => (
        <group key={s.id} position={[s.x, 0, s.z]} ref={(g) => { refs.current[i] = g; }}>
          <mesh position-y={0.4}>
            <sphereGeometry args={[0.75, 14, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.4} />
          </mesh>
          <mesh position-y={0.45}>
            <cylinderGeometry args={[0.77, 0.77, 0.26, 14]} />
            <meshStandardMaterial color={s.kind === "story" ? "#c2412d" : "#1d4e89"} roughness={0.5} />
          </mesh>
          <mesh position-y={1.7}>
            <cylinderGeometry args={[0.05, 0.05, 1.8, 5]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position-y={2.65}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshBasicMaterial color={s.kind === "story" ? "#ffb08a" : "#bfe6ff"} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A few small schools of illustrative reef fish circling coral near the boat (one instanced mesh). */
/** A stylized reef fish: flattened body, forked tail and dorsal fin, lighter belly; nose along +z. */
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 10, 7);
  body.scale(0.3, 0.58, 1);
  body.deleteAttribute("uv");
  const fin = (pts: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return g;
  };
  const tail = fin([0, 0, -0.42, 0, 0.3, -0.78, 0, 0.02, -0.62, 0, 0, -0.42, 0, -0.02, -0.62, 0, -0.3, -0.78]);
  const dorsal = fin([0, 0.26, 0.18, 0, 0.42, -0.08, 0, 0.24, -0.3]);
  const g = mergeGeometries([body.toNonIndexed(), tail, dorsal])!;
  const p = g.attributes.position as THREE.BufferAttribute;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) < -0.05 ? 1.35 : p.getZ(i) < -0.4 ? 0.85 : 1.0;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** Schools of reef fish circling over coral and hard bottom (closer to the camera when diving). */
function Fish({ zone }: { zone: Zone }) {
  const SCHOOLS = pick(4, 6, 8);
  const PER = pick(10, 14, 20);
  const time = useMemo(() => ({ value: 0 }), []);
  const mesh = useMemo(() => {
    const mat = MOBILE
      ? new THREE.MeshLambertMaterial({ color: "#ffffff", vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.45, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // Tail beat: the rear of the body swings side to side.
        float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
        transformed.x += sin(uTime * 9.0 + ph) * 0.16 * max(0.0, -position.z - 0.05);`,
      );
    };
    mat.customProgramCacheKey = () => "rq-fish";
    const im = new THREE.InstancedMesh(fishGeometry(), underwater(mat), SCHOOLS * PER);
    // Blue tang, yellowtail snapper, sergeant major, French grunt, creole wrasse, parrotfish, schoolmaster, blue chromis.
    const pal = ["#3a66d8", "#dfe4ea", "#e6d66a", "#f0c040", "#7454c8", "#3fb39a", "#e2c79a", "#4f9fe8"];
    const col = new THREE.Color();
    for (let i = 0; i < SCHOOLS * PER; i++) im.setColorAt(i, col.set(pal[Math.floor(i / PER) % pal.length]));
    im.frustumCulled = false;
    return im;
  }, [SCHOOLS, PER, time]);
  const schools = useRef<{ x: number; z: number; y: number; r: number; speed: number; size: number }[]>([]);
  const last = useRef({ x: 1e9, z: 1e9, under: false });
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const sc3 = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame((st) => {
    const { tele, under } = useBoat.getState();
    if (!tele) return;
    time.value = st.clock.elapsedTime;
    if (Math.hypot(tele.x - last.current.x, tele.z - last.current.z) > (under ? 40 : 120) || under !== last.current.under) {
      last.current = { x: tele.x, z: tele.z, under };
      const list: typeof schools.current = [];
      for (let k = 0; k < 60 && list.length < SCHOOLS; k++) {
        const a = hash(k + Math.floor(tele.x)) * Math.PI * 2;
        const r = under ? 5 + hash(k * 7 + Math.floor(tele.z)) * 32 : 25 + hash(k * 7 + Math.floor(tele.z)) * 140;
        const x = tele.x + Math.cos(a) * r, z = tele.z + Math.sin(a) * r;
        const h = heightAtXZ(zone, x, z);
        const cls = habitatAtXZ(zone, x, z).benthic;
        if (h < -2.5 && h > -25 && (cls === 15 || cls === 13 || k > 40))
          list.push({ x, z, y: floorY(h) + 0.9 + hash(k) * 1.8, r: 2.5 + hash(k + 3) * 4.5, speed: 0.22 + hash(k + 5) * 0.3, size: 0.22 + hash(k + 9) * 0.25 });
      }
      schools.current = list;
    }
    const t = st.clock.elapsedTime;
    let n = 0;
    schools.current.forEach((sc, si) => {
      for (let i = 0; i < PER; i++) {
        const ph = (i / PER) * Math.PI * 2;
        const ang = t * sc.speed + ph + Math.sin(t * 0.7 + i) * 0.15;
        const rr = sc.r * (0.7 + 0.3 * Math.sin(i * 1.7 + si));
        pos.set(sc.x + Math.cos(ang) * rr, sc.y + Math.sin(t * 1.5 + i) * 0.25 + (i % 3) * 0.3, sc.z + Math.sin(ang) * rr);
        // Swim along the circle (tangent), with a slight roll.
        e.set(0, -ang, Math.sin(t * 2 + i) * 0.08);
        q.setFromEuler(e);
        const k = sc.size * (0.85 + 0.3 * hash(i + si * 31));
        m4.compose(pos, q, sc3.set(k, k, k));
        mesh.setMatrixAt(n++, m4);
      }
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
