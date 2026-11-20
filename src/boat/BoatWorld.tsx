import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { SITES } from "../content/sites";
import { LITE, REDUCED_MOTION } from "../lib/device";
import { abyssMaterial, seafloorMaterial, seaMaterial, skyMaterial, SKY_HORIZON, SUN } from "./boatMaterials";
import { makeBoat } from "./boatModel";
import { useBoat } from "./boatStore";
import { buildCandidates, CAPS, grassMaterial, PALETTES, propGeometries, underwater, type Candidates, type PropKind } from "./props";
import { clearLabels, LabelProjector, setLabelAnchor } from "../scenes/labels";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { floorY, habitatAtXZ, hash, heightAtXZ, loadZone, lonLatToXZ, xzToLonLat, zoneGeometry, type Zone } from "./zone";

// Physics (m, s).
const V_MAX = 9; // ~17 knots
const V_REV = 3;
const ACCEL = 2.4;
const DRAG = 0.55;
const YAW = 0.55; // rad/s at speed
const DRAFT = 1.1; // the boat touches bottom shallower than this
const PROP_RADIUS = 350;

export default function BoatWorld({ island, zoneId, start }: { island: string; zoneId: string; start: { lon: number; lat: number } }) {
  const [zone, setZone] = useState<Zone | null>(null);
  useEffect(() => {
    let alive = true;
    useBoat.setState({ loading: true });
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

  const floorGeo = useMemo(() => zoneGeometry(zone, LITE ? 2 : 1), [zone]);
  const floorMat = useMemo(() => seafloorMaterial(zone.habitatTex, LITE), [zone]);
  const seaMat = useMemo(() => seaMaterial(zone.depthTex, [zone.sizeX, zone.sizeZ]), [zone]);
  const sky = useMemo(() => skyMaterial(), []);
  const abyss = useMemo(() => abyssMaterial(), []);

  useEffect(() => {
    floorMat.uniforms.uMapColors.value = mapColors ? 1 : 0;
  }, [mapColors, floorMat]);

  // Camera for close range; restored by the island view when it remounts.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.3;
    cam.far = 12000;
    cam.fov = 50;
    cam.updateProjectionMatrix();
    scene.background = SKY_HORIZON.clone();
    return () => {
      scene.background = new THREE.Color("#020d16");
    };
  }, [camera, scene]);

  useFrame((_, dt) => {
    if (!REDUCED_MOTION) time.current.value += dt;
    floorMat.uniforms.uTime.value = time.current.value;
    seaMat.uniforms.uTime.value = time.current.value;
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__zone = { zone, h: (x: number, z: number) => heightAtXZ(zone, x, z), floorGeo };

  // Start on the site, or the nearest water at least 4 m deep (zone centers can be inland).
  const startXZ = useMemo(() => {
    const p = lonLatToXZ(zone, start.lon, start.lat);
    if (heightAtXZ(zone, p.x, p.z) < -4) return p;
    let best = p, bestD = Infinity;
    for (let j = 0; j < zone.h; j += 2)
      for (let i = 0; i < zone.w; i += 2) {
        if (zone.heights[j * zone.w + i] >= -4) continue;
        const x = (i / (zone.w - 1) - 0.5) * zone.sizeX, z = (j / (zone.h - 1) - 0.5) * zone.sizeZ;
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bestD) (bestD = d), (best = { x, z });
      }
    // Step a little further out so the bow isn't right on the edge of the shallows.
    const dx = best.x - p.x, dz = best.z - p.z, l = Math.hypot(dx, dz) || 1;
    return { x: best.x + (dx / l) * 40, z: best.z + (dz / l) * 40 };
  }, [zone, start]);

  return (
    <>
      <mesh material={sky} renderOrder={-1}>
        <sphereGeometry args={[9000, 32, 16]} />
      </mesh>
      <hemisphereLight args={["#cfeeff", "#3d5a4a", 1.0]} />
      <directionalLight position={SUN.clone().multiplyScalar(100)} intensity={1.6} color="#fff4e0" />
      <mesh geometry={floorGeo} material={floorMat} />
      <mesh rotation-x={-Math.PI / 2} position-y={-70} material={abyss}>
        <planeGeometry args={[30000, 30000, 1, 1]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={seaMat} renderOrder={3}>
        <planeGeometry args={[30000, 30000, 1, 1]} />
      </mesh>
      <Reef zone={zone} time={time.current} />
      <Fish zone={zone} />
      <Buoys zone={zone} />
      <Boat zone={zone} start={startXZ} />
    </>
  );
}

/** The boat, its physics, the wake, the chase camera and the inputs. */
function Boat({ zone, start }: { zone: Zone; start: { x: number; z: number } }) {
  const { camera, gl } = useThree();
  const { group, radar } = useMemo(() => makeBoat(), []);
  const controls = useRef<OrbitControlsImpl>(null);
  const st = useRef({ x: start.x, z: start.z, a: Math.PI, v: 0, aground: false, lastTele: 0 });
  const wake = useMemo(() => new Wake(), []);
  const marker = useRef<THREE.Mesh>(null);

  // Initial camera behind and above the boat.
  useEffect(() => {
    const s = st.current;
    const dx = Math.sin(s.a), dz = Math.cos(s.a);
    camera.position.set(s.x - dx * 38, 18, s.z - dz * 38);
    controls.current?.target.set(s.x, 1.5, s.z);
    controls.current?.update();
  }, [camera]);

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
    const { keys, target, setTarget } = useBoat.getState();
    let throttle = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    let turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    if (target && !throttle && !turn) {
      const dx = target.x - s.x, dz = target.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 10) setTarget(null);
      else {
        let diff = Math.atan2(dx, dz) - s.a;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        turn = Math.max(-1, Math.min(1, diff * 2));
        throttle = Math.abs(diff) > 1.6 ? 0.25 : Math.min(1, Math.max(0.3, dist / 60));
      }
    }
    s.v += (throttle * (throttle > 0 ? ACCEL : ACCEL * 0.6) - DRAG * s.v) * dt;
    s.v = Math.max(-V_REV, Math.min(V_MAX, s.v));
    const turnRate = YAW * Math.min(1, 0.25 + Math.abs(s.v) / 4);
    s.a += turn * turnRate * dt * (s.v < -0.1 ? -1 : 1);
    const dirx = Math.sin(s.a), dirz = Math.cos(s.a);
    const nx = s.x + dirx * s.v * dt, nz = s.z + dirz * s.v * dt;
    // Grounding: check the water depth ahead of the bow (or behind the stern when reversing).
    const probe = s.v >= 0 ? 7 : -7;
    const ahead = heightAtXZ(zone, nx + dirx * probe, nz + dirz * probe);
    const margin = 80;
    const inside = Math.abs(nx) < zone.sizeX / 2 - margin && Math.abs(nz) < zone.sizeZ / 2 - margin;
    if (ahead > -DRAFT || !inside) {
      s.aground = Math.abs(s.v) > 0.05 || s.aground;
      s.v = 0;
      if (target) setTarget(null);
    } else {
      s.x = nx;
      s.z = nz;
      if (Math.abs(s.v) > 0.3) s.aground = false;
    }

    // Pose: bob, pitch with speed, lean into turns.
    const t = state.clock.elapsedTime;
    group.position.set(s.x, Math.sin(t * 1.3) * 0.12 - 0.05, s.z);
    group.rotation.set(Math.sin(t * 0.9) * 0.02 - s.v * 0.006, s.a, Math.sin(t * 1.1) * 0.025 - turn * s.v * 0.012, "YXZ");
    radar.rotation.y += dt * 2.5;

    // Chase: carry the camera and orbit target along with the boat.
    const c = controls.current;
    if (c) {
      const ddx = s.x - c.target.x, ddz = s.z - c.target.z;
      c.target.x += ddx;
      c.target.z += ddz;
      camera.position.x += ddx;
      camera.position.z += ddz;
      c.update();
    }

    wake.push(s.x - dirx * 6.5, s.z - dirz * 6.5, Math.abs(s.v), dt);

    if (marker.current) {
      marker.current.visible = !!target;
      if (target) marker.current.position.set(target.x, 0.15 + Math.sin(t * 4) * 0.1, target.z);
    }

    // Telemetry to the HUD ~10×/s.
    if (t - s.lastTele > 0.1) {
      s.lastTele = t;
      const h = heightAtXZ(zone, s.x, s.z);
      const hab = habitatAtXZ(zone, s.x, s.z);
      const ll = xzToLonLat(zone, s.x, s.z);
      useBoat.getState().setTele({
        x: s.x, z: s.z, heading: (((Math.PI - s.a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), speed: s.v,
        depth: Math.max(0, -h), benthic: hab.benthic, geomorphic: hab.geomorphic, lat: ll.lat, lon: ll.lon, aground: s.aground,
      });
      // Nearest story/dive site buoy.
      let near: string | null = null;
      for (const site of SITES) {
        if (site.island !== zone.meta.island) continue;
        const p = lonLatToXZ(zone, site.lon, site.lat);
        if (Math.hypot(p.x - s.x, p.z - s.z) < 60) near = site.id;
      }
      if (near !== useBoat.getState().near) useBoat.getState().setNear(near);
    }
  });

  return (
    <>
      <primitive object={group} />
      <primitive object={wake.mesh} />
      <mesh ref={marker} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[2.2, 3, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <OrbitControls
        ref={controls as never}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        enablePan={false}
        minDistance={14}
        maxDistance={420}
        maxPolarAngle={Math.PI * 0.47}
      />
    </>
  );
}

/** Foam trail behind the stern: a ribbon of recent positions that widens and fades. */
class Wake {
  N = 70;
  pts: { x: number; z: number; age: number }[] = [];
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private alpha: Float32Array;
  constructor() {
    this.pos = new Float32Array(this.N * 2 * 3);
    this.alpha = new Float32Array(this.N * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: "attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying float vA; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA); }",
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }
  push(x: number, z: number, speed: number, dt: number) {
    for (const p of this.pts) p.age += dt;
    const last = this.pts[0];
    if (speed > 0.6 && (!last || Math.hypot(last.x - x, last.z - z) > 2.5)) this.pts.unshift({ x, z, age: 0 });
    while (this.pts.length > this.N || (this.pts.length && this.pts[this.pts.length - 1].age > 9)) this.pts.pop();
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
      const w = 1.4 + p.age * 1.6;
      this.pos.set([p.x - dz * w, 0.06, p.z + dx * w, p.x + dz * w, 0.06, p.z - dx * w], i * 6);
      const a = Math.max(0, 0.75 - p.age / 9) * Math.min(1, speed / 2 + 0.3);
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

/** Instanced reef life within PROP_RADIUS of the boat, refreshed as it moves. */
function Reef({ zone, time }: { zone: Zone; time: { value: number } }) {
  const cand = useMemo<Candidates>(() => buildCandidates(zone), [zone]);
  const geos = useMemo(() => propGeometries(), []);
  const mats = useMemo(
    () => ({
      boulder: underwater(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95 })),
      branch: underwater(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 })),
      sponge: underwater(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 })),
      grass: underwater(grassMaterial(time)),
    }),
    [time],
  );
  const kinds: PropKind[] = ["boulder", "branch", "sponge", "grass"];
  const meshes = useMemo(() => {
    const m: Record<string, THREE.InstancedMesh> = {};
    for (const k of kinds) {
      const cap = Math.round(CAPS[k] * (LITE ? 0.35 : 1));
      const im = new THREE.InstancedMesh(geos[k], mats[k], cap);
      im.count = 0;
      im.frustumCulled = false;
      m[k] = im;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geos, mats]);
  const last = useRef({ x: 1e9, z: 1e9 });

  useFrame(() => {
    const tele = useBoat.getState().tele;
    if (!tele) return;
    if (Math.hypot(tele.x - last.current.x, tele.z - last.current.z) < 60) return;
    last.current = { x: tele.x, z: tele.z };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const k of kinds) {
      const arr = cand[k];
      const im = meshes[k];
      const cap = im.instanceMatrix.count;
      // Count candidates in range, then keep each with probability cap/count (even spread).
      const r2 = PROP_RADIUS * PROP_RADIUS;
      let inRange = 0;
      for (let i = 0; i < arr.length; i += 4) {
        const dx = arr[i] - tele.x, dz = arr[i + 2] - tele.z;
        if (dx * dx + dz * dz < r2) inRange++;
      }
      const keep = Math.min(1, cap / Math.max(inRange, 1));
      let n = 0;
      const pal = PALETTES[k];
      for (let i = 0; i < arr.length && n < cap; i += 4) {
        const dx = arr[i] - tele.x, dz = arr[i + 2] - tele.z;
        if (dx * dx + dz * dz >= r2) continue;
        const seed = arr[i + 3];
        if (((seed * 9973) % 1) > keep) continue;
        const size = k === "boulder" ? 0.6 + seed * 1.8 : k === "branch" ? 0.7 + seed * 1.2 : k === "sponge" ? 0.6 + seed * 0.9 : 0.6 + seed * 0.5;
        p.set(arr[i], floorY(arr[i + 1]) - (k === "boulder" ? size * 0.12 : 0), arr[i + 2]);
        q.setFromAxisAngle(up, seed * 40);
        s.set(size, size * (k === "grass" ? 0.8 + seed * 0.6 : 1), size);
        m4.compose(p, q, s);
        im.setMatrixAt(n, m4);
        im.setColorAt(n, col.set(pal[Math.floor(seed * 997) % pal.length]));
        n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {kinds.map((k) => (
        <primitive key={k} object={meshes[k]} />
      ))}
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
    for (const s of sites) setLabelAnchor(`buoy:${s.id}`, s.x, 3.2, s.z);
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
          <mesh position-y={0.35}>
            <sphereGeometry args={[0.6, 14, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.4} />
          </mesh>
          <mesh position-y={0.4}>
            <cylinderGeometry args={[0.62, 0.62, 0.22, 14]} />
            <meshStandardMaterial color={s.kind === "story" ? "#ff6f5e" : "#2563eb"} roughness={0.5} />
          </mesh>
          <mesh position-y={1.4}>
            <cylinderGeometry args={[0.04, 0.04, 1.4, 5]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A few small schools of illustrative reef fish circling coral near the boat (one instanced mesh). */
function Fish({ zone }: { zone: Zone }) {
  const SCHOOLS = LITE ? 3 : 6;
  const PER = LITE ? 14 : 24;
  const mesh = useMemo(() => {
    const body = new THREE.ConeGeometry(0.12, 0.42, 6);
    body.rotateX(Math.PI / 2);
    const tail = new THREE.ConeGeometry(0.1, 0.16, 4);
    tail.rotateX(-Math.PI / 2);
    tail.translate(0, 0, -0.27);
    const geo = mergeGeometries([body, tail])!;
    const im = new THREE.InstancedMesh(geo, underwater(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 })), SCHOOLS * PER);
    const pal = ["#ffd23f", "#2f6bff", "#c0c8d0", "#ff8c42", "#7b5cff", "#30c0b0"];
    const c = new THREE.Color();
    for (let i = 0; i < SCHOOLS * PER; i++) im.setColorAt(i, c.set(pal[Math.floor(i / PER) % pal.length]));
    im.frustumCulled = false;
    return im;
  }, [SCHOOLS, PER]);
  const schools = useRef<{ x: number; z: number; y: number; r: number; speed: number }[]>([]);
  const last = useRef({ x: 1e9, z: 1e9 });
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame((st) => {
    const tele = useBoat.getState().tele;
    if (!tele) return;
    // Re-seat the schools over nearby reef when the boat has moved on.
    if (Math.hypot(tele.x - last.current.x, tele.z - last.current.z) > 120) {
      last.current = { x: tele.x, z: tele.z };
      const list: typeof schools.current = [];
      for (let k = 0; k < 40 && list.length < SCHOOLS; k++) {
        const a = hash(k + Math.floor(tele.x)) * Math.PI * 2, r = 25 + hash(k * 7 + Math.floor(tele.z)) * 140;
        const x = tele.x + Math.cos(a) * r, z = tele.z + Math.sin(a) * r;
        const h = heightAtXZ(zone, x, z);
        const cls = habitatAtXZ(zone, x, z).benthic;
        if (h < -2.5 && h > -25 && (cls === 15 || cls === 13 || k > 30)) list.push({ x, z, y: floorY(h) + 1.2 + hash(k) * 1.5, r: 3 + hash(k + 3) * 5, speed: 0.25 + hash(k + 5) * 0.35 });
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
        e.set(0, -ang, Math.sin(t * 8 + i) * 0.15);
        q.setFromEuler(e);
        m4.compose(pos, q, one);
        mesh.setMatrixAt(n++, m4);
      }
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
