import { useFrame } from "@react-three/fiber";
import { cropShare, fulfilShot, photoSubjects, trackSubject, untrack, useRoll } from "./photos";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Site } from "../content/sites";
import { MOBILE, pick } from "../lib/device";
import { useBoat, type MissionType } from "./boatStore";
import { subject, zonePlaces, type ZonePlace } from "./places";
import { underwater, WATER, WATER_GLSL } from "./props";
import { diverGeometry, diverMaterial } from "./divers";
import { buildWreck } from "./wreck";
import { floorY, hash, heightAtXZ, type Zone } from "./zone";

// Things to find in the boat mode: what a place in content/sites.ts says is there (`scene`, or a
// `wreck`), as a small mission of its own. Every one stands for something documented at that place
// (the sources are on its story card); shapes, numbers and behavior are illustrative, and the views
// say so. Each has its own water (props.ts MOODS), its own cast and its own way of being found:
//
//  "whale-shark"  Utila's north-east shelf edge, open blue water. At the surface a tuna "boil"
//                 (white water, leaping tuna, seabirds wheeling: what captains look for); under it
//                 a bait ball, a whale shark feeding through it and a pod of dolphins. The mission
//                 follows the island's own guidelines: come in slowly and stay out of the boil.
//                 Rush it and the shark dives; hold still and it comes over and circles the boat,
//                 a few meters from a snorkeler's mask.
//  "turtles"      Sea turtles over the reef, coming up to breathe. Go under and they glide in.
//  "reef-sharks"  Caribbean reef sharks over the sand by the bait bucket their dive is named for.
//                 Go under and they circle you.
//  wrecks         The ship on the seafloor (wreck.ts) with a school of fish living on it.
//  "divers"       Every plain dive site (a mooring and nothing else documented): a small group of
//                 scuba divers on the reef, found the way dive boats find theirs, by the bubbles
//                 breaking the surface. Go under and they swim over and circle you.
//
// **Whatever there is to see comes close** (Tulio: a shark the size of a speck is "boring and
// lame"): under the water the animals close in on the boat, and the camera starts out facing them.
//
// Budget: a handful of meshes and under 6k triangles in all; phones get fewer birds, splashes and
// fish. Nothing here costs anything away from its place: each scene is hidden, and its animation
// skipped, until the boat is within sight of it (SEE_*), so a zone with wildlife sails like one
// without. The schools of small fish move entirely in their vertex shader.

/** Radius (m) of the contact zone around the boil, and of the boil itself. Utila's guidelines flag
 *  a contact zone about 600 ft across around the sharks. */
export const CONTACT_R = 90;
/** From this far out the HUD says the whale sharks are ahead and how to go in. */
export const APPROACH_R = 240;
const BOIL_R = 20;
const SLOW = 1.55; // m/s (3 knots): the most the boat may do inside the contact zone
/** From how far (m) each scene is drawn: the birds and white water of a boil are what captains
 *  look for from a distance; animals below the surface and wrecks are lost in the water sooner. */
const SEE_BOIL = 1300, SEE_SWIMMERS = 380, SEE_REEF = 300;

const BACK = new THREE.Color();
const BELLY = new THREE.Color();

/** A body along +z (nose at +0.5, tail tip at −0.5) from elliptical rings; `r(t)` gives the half
 *  width and half height at t (0 = tail, 1 = nose). */
function body(r: (t: number) => [number, number], rings: number, seg: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const [rx, ry] = r(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push(Math.sin(a) * rx, Math.cos(a) * ry, t - 0.5);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}
const fin = (pts: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
};
/** Piecewise-linear profile through [t, rx, ry] stops. */
const profile = (stops: number[][]) => (t: number): [number, number] => {
  for (let i = 1; i < stops.length; i++)
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0] || 1), s = k * k * (3 - 2 * k);
      return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    }
  const l = stops[stops.length - 1];
  return [l[1], l[2]];
};
/** Merge the parts and paint them: dark back, pale belly (by height on the body). */
function painted(parts: THREE.BufferGeometry[], back: string, belly: string, split: number) {
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  const p = g.attributes.position as THREE.BufferAttribute;
  const c = new Float32Array(p.count * 3);
  BACK.set(back);
  BELLY.set(belly);
  for (let i = 0; i < p.count; i++) {
    const k = THREE.MathUtils.smoothstep(p.getY(i), split - 0.02, split + 0.015);
    c[i * 3] = BELLY.r + (BACK.r - BELLY.r) * k;
    c[i * 3 + 1] = BELLY.g + (BACK.g - BELLY.g) * k;
    c[i * 3 + 2] = BELLY.b + (BACK.b - BELLY.b) * k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** Whale shark, 1 unit long: broad flat head, first dorsal set far back, tall upper tail lobe. */
function whaleSharkGeometry() {
  const r = profile([[0, 0.004, 0.006], [0.1, 0.016, 0.024], [0.34, 0.048, 0.05], [0.6, 0.084, 0.07], [0.82, 0.102, 0.06], [0.95, 0.096, 0.042], [1, 0.07, 0.014]]);
  return painted(
    [
      body(r, 16, 12),
      fin([0, 0.064, 0.02, 0, 0.15, -0.075, 0, 0.058, -0.11]), // first dorsal
      fin([0, 0.036, -0.24, 0, 0.076, -0.292, 0, 0.03, -0.31]), // second dorsal
      fin([0.082, -0.02, 0.2, 0.215, -0.05, 0.05, 0.078, -0.02, 0.1]), // pectorals
      fin([-0.082, -0.02, 0.2, -0.215, -0.05, 0.05, -0.078, -0.02, 0.1]),
      fin([0, 0.006, -0.455, 0, 0.2, -0.62, 0, 0.03, -0.52]), // tail, upper lobe
      fin([0, -0.004, -0.455, 0, -0.092, -0.565, 0, -0.022, -0.51]), // tail, lower lobe
    ],
    "#2b4a63",
    "#eef2f4",
    -0.012,
  );
}
/** Dolphin, 1 unit long: long beak with no crease at the forehead (rough-toothed), curved dorsal, flat flukes. */
function dolphinGeometry() {
  const r = profile([[0, 0.004, 0.004], [0.1, 0.018, 0.028], [0.4, 0.074, 0.084], [0.62, 0.084, 0.094], [0.8, 0.066, 0.074], [0.9, 0.03, 0.034], [1, 0.011, 0.011]]);
  return painted(
    [
      body(r, 14, 10),
      fin([0, 0.088, 0.03, 0, 0.19, -0.085, 0, 0.082, -0.11]),
      fin([0.066, -0.04, 0.18, 0.17, -0.1, 0.07, 0.058, -0.05, 0.1]),
      fin([-0.066, -0.04, 0.18, -0.17, -0.1, 0.07, -0.058, -0.05, 0.1]),
      fin([0, 0, -0.455, 0.135, 0, -0.57, 0, 0, -0.52]),
      fin([0, 0, -0.455, -0.135, 0, -0.57, 0, 0, -0.52]),
    ],
    "#66757f",
    "#e3e6e8",
    -0.02,
  );
}
/** Reef shark, 1 unit long: slim, pointed snout, tall first dorsal, long upper tail lobe. */
function reefSharkGeometry() {
  const r = profile([[0, 0.004, 0.006], [0.12, 0.02, 0.028], [0.45, 0.062, 0.068], [0.7, 0.07, 0.07], [0.9, 0.045, 0.036], [1, 0.008, 0.006]]);
  return painted(
    [
      body(r, 14, 10),
      fin([0, 0.064, 0.13, 0, 0.17, 0.03, 0, 0.06, -0.01]),
      fin([0, 0.03, -0.26, 0, 0.06, -0.31, 0, 0.026, -0.33]),
      fin([0.058, -0.03, 0.2, 0.19, -0.075, 0.06, 0.054, -0.03, 0.1]),
      fin([-0.058, -0.03, 0.2, -0.19, -0.075, 0.06, -0.054, -0.03, 0.1]),
      fin([0, 0.006, -0.455, 0, 0.17, -0.63, 0, 0.026, -0.52]),
      fin([0, -0.004, -0.455, 0, -0.07, -0.55, 0, -0.018, -0.505]),
    ],
    "#6d7478",
    "#e9ebec",
    -0.012,
  );
}
/** Sea turtle, 1 unit long: domed shell, head and four flippers. */
function turtleGeometry() {
  const shell = new THREE.SphereGeometry(0.5, 12, 8);
  shell.scale(0.78, 0.3, 0.9);
  const head = new THREE.SphereGeometry(0.12, 8, 6);
  head.translate(0, 0.02, 0.55);
  // Position only, like the flippers: parts must carry the same attributes to merge.
  for (const g of [shell, head]) {
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
  }
  return painted(
    [
      shell.toNonIndexed(),
      head.toNonIndexed(),
      fin([0.3, 0, 0.28, 0.82, 0.02, 0.02, 0.34, 0, 0.1]), // front flippers
      fin([-0.3, 0, 0.28, -0.82, 0.02, 0.02, -0.34, 0, 0.1]),
      fin([0.22, 0, -0.34, 0.42, 0, -0.58, 0.16, 0, -0.44]), // rear flippers
      fin([-0.22, 0, -0.34, -0.42, 0, -0.58, -0.16, 0, -0.44]),
    ],
    "#6b5a2e",
    "#e6dcae",
    -0.03,
  );
}

/** Lit, water-tinted material for an animal; `spots` adds the whale shark's rows of pale spots and
 *  bars, `beat` is the tail-beat rate. */
function animalMaterial(time: { value: number }, key: string, beat: number, spots = false) {
  const mat = MOBILE
    ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vObj;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vObj = position;
        // The rear half swings side to side (each instance out of step with the others).
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
        #endif
        transformed.x += sin(uTime * ${beat.toFixed(2)} + ph) * 0.05 * smoothstep(0.08, -0.5, position.z);`,
      );
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;");
    if (spots)
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Pale spots in rows with thin bars between them, on the back and flanks only.
        float back = smoothstep(-0.02, 0.012, vObj.y);
        vec2 g = vec2(vObj.z * 24.0, atan(vObj.x, vObj.y + 0.03) * 4.4);
        vec2 f = fract(g) - 0.5;
        float spot = 1.0 - smoothstep(0.12, 0.2, length(f));
        float bar = (1.0 - smoothstep(0.02, 0.06, abs(f.x - 0.5 * sign(f.x)))) * 0.45;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.97), max(spot, bar) * back);`,
      );
  };
  mat.customProgramCacheKey = () => `rq-animal-${key}`;
  return underwater(mat);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** Place an animal whose nose points along +z: at (x, y, z), heading `yaw` (0 = +z, toward +x as it grows), nose up by `pitch`. */
function place(mesh: THREE.InstancedMesh | THREE.Mesh, i: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, size: number) {
  _e.set(-pitch, yaw, roll);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(size, size, size));
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).setMatrixAt(i, _m);
  else {
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(_m);
  }
}

/** A school of small fish that moves entirely in its vertex shader: each fish circles an axis
 *  inside an ellipsoid (radii in m, turned by `yaw`), bobbing, flashing as it turns. One draw
 *  call and three triangles a fish, with no work per frame on the CPU. */
function schoolMesh(count: number, time: { value: number }, o: { center: THREE.Vector3; radii: [number, number, number]; yaw?: number; size: number; spin: number; color: string; flash: string }) {
  const g = new THREE.InstancedBufferGeometry();
  // A flat fish, nose toward +z: two triangles of body and a tail.
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 0.17, 0.05, 0, -0.17, 0.05, 0, 0.17, 0.05, 0, -0.17, 0.05, 0, 0, -0.3, 0, 0, -0.26, 0, 0.15, -0.5, 0, -0.15, -0.5], 3));
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([hash(i * 3.1) * Math.PI * 2, 0.3 + 0.7 * Math.sqrt(hash(i * 7.7 + 1)), hash(i * 5.3 + 2) * 2 - 1, 0.7 + hash(i * 9.1 + 3) * 0.6], i * 4);
  g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: time,
      uCenter: { value: o.center },
      uRadii: { value: new THREE.Vector3(...o.radii) },
      uYaw: { value: o.yaw ?? 0 },
      uSize: { value: o.size },
      uSpin: { value: o.spin },
      uColor: { value: new THREE.Color(o.color) },
      uFlash: { value: new THREE.Color(o.flash) },
      ...WATER,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uYaw, uSize, uSpin;
      uniform vec3 uCenter, uRadii;
      varying vec3 vRqW;
      varying float vFlash;
      void main() {
        float a = aSeed.x + uTime * uSpin * aSeed.w;
        float r = aSeed.y;
        float pulse = 1.0 + 0.1 * sin(uTime * 0.8 + aSeed.x * 2.0);
        vec3 c = vec3(cos(a) * r * uRadii.x, aSeed.z * uRadii.y * sqrt(1.0 - r * r * 0.8) + sin(uTime * 1.6 + aSeed.x * 9.0) * 0.22, sin(a) * r * uRadii.z) * pulse;
        vec3 fwd = normalize(vec3(-sin(a) * uRadii.x, 0.0, cos(a) * uRadii.z)) * sign(uSpin);
        float cy = cos(uYaw), sy = sin(uYaw);
        c = vec3(c.x * cy + c.z * sy, c.y, -c.x * sy + c.z * cy);
        fwd = vec3(fwd.x * cy + fwd.z * sy, 0.0, -fwd.x * sy + fwd.z * cy);
        vec3 side = vec3(fwd.z, 0.0, -fwd.x);
        float wag = sin(uTime * 13.0 + aSeed.x * 20.0) * 0.14 * max(0.0, -position.z);
        vec3 w = uCenter + c + (side * wag + vec3(0.0, position.y, 0.0) + fwd * position.z) * uSize * (0.7 + 0.6 * fract(aSeed.x * 7.3));
        vRqW = w;
        // Now and then a fish turns its flank to the light.
        vFlash = pow(max(0.0, sin(a * 2.0 + uTime * 0.7 + aSeed.z * 6.0)), 9.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uFlash;
      varying vec3 vRqW;
      varying float vFlash;
      ${WATER_GLSL}
      void main() {
        gl_FragColor = vec4(rqWaterTint(mix(uColor, uFlash, vFlash), vRqW), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}
const free = (...objs: THREE.Object3D[]) => {
  for (const o of objs as THREE.Mesh[]) {
    o.geometry.dispose();
    (o.material as THREE.Material).dispose();
  }
};

/** The places in this zone that have a wildlife scene, with their position in the zone. */
const scenesIn = (zone: Zone, scene: Site["scene"]) => zonePlaces(zone).filter((p) => p.site.scene === scene);
/** How far the boat is from a point (m); far away while there is no boat yet. */
function boatDist(x: number, z: number) {
  const tele = useBoat.getState().tele;
  return tele ? Math.hypot(tele.x - x, tele.z - z) : 1e9;
}
/** The height the underwater view looks at, under the boat (BoatWorld's diving camera). */
const eyeY = (zone: Zone, x: number, z: number) => Math.min(-1.5, floorY(heightAtXZ(zone, x, z)) + 1.6);
const turn = (from: number, to: number, k: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;
/** 0 → 1 while the boat is under the water inside this mission, easing both ways. */
function useCloseIn(id: string) {
  const k = useRef(0);
  return (dt: number) => {
    const { mission, under } = useBoat.getState();
    const want = under && mission?.id === id ? 1 : 0;
    k.current += (want - k.current) * Math.min(1, dt * 0.9);
    return k.current;
  };
}

export function Wildlife({ zone }: { zone: Zone }) {
  const boils = useMemo(() => scenesIn(zone, "whale-shark").slice(0, 1), [zone]);
  const turtles = useMemo(() => scenesIn(zone, "turtles").slice(0, 1), [zone]);
  const sharks = useMemo(() => scenesIn(zone, "reef-sharks").slice(0, 1), [zone]);
  const wrecks = useMemo(() => zonePlaces(zone).filter((p) => p.site.wreck), [zone]);
  const dives = useMemo(() => zonePlaces(zone).filter((p) => p.site.kind === "dive" && !p.site.scene && !p.site.wreck), [zone]);
  // Things seen only from under the water: within `r` of one the mission is on (the HUD says to
  // go under), and looking from below puts it in the logbook.
  const below = useMemo(
    () =>
      [...turtles, ...sharks, ...wrecks, ...dives].map((p) => {
        const L = p.site.wreck?.length_m ?? 0;
        return {
          id: p.site.id, x: p.x, z: p.z,
          r: L ? L / 2 + 30 : 80,
          type: (L ? "wreck" : p.site.scene ?? "divers") as MissionType,
          look: L ? { y: floorY(p.floor ?? heightAtXZ(zone, p.x, p.z)) + L * 0.12, dist: Math.max(16, L * 0.48), yaw: p.yaw ?? 0 } : null,
        };
      }),
    [turtles, sharks, wrecks, dives, zone],
  );
  useEffect(() => {
    useBoat.setState({ wild: [...boils.map((b) => b.site.id), ...below.map((b) => b.id)] });
    return () => {
      subject.on = false;
      useBoat.setState({ wild: [], mission: null });
    };
  }, [boils, below]);
  const next = useRef(0);
  useFrame((fr) => {
    if (!below.length || fr.clock.elapsedTime < next.current) return;
    next.current = fr.clock.elapsedTime + 0.4;
    const { tele, logSighting, under, mission } = useBoat.getState();
    if (!tele || mission?.type === "whale-shark") return; // that one runs its own mission
    const hit = below.find((b) => Math.hypot(tele.x - b.x, tele.z - b.z) <= b.r);
    if (hit) {
      if (under) logSighting(hit.id);
      const state = under ? "below" : "above";
      if (mission?.id !== hit.id || mission.state !== state) useBoat.setState({ mission: { id: hit.id, type: hit.type, state } });
      Object.assign(subject, { on: true, x: hit.x, z: hit.z, look: hit.look });
    } else if (mission) {
      subject.on = false;
      useBoat.setState({ mission: null });
    }
  });
  return (
    <>
      <PhotoAim />
      {wrecks.map((w) => (
        <Wreck key={w.site.id} zone={zone} place={w} />
      ))}
      {boils.map((b) => (
        <WhaleSharkBoil key={b.site.id} id={b.site.id} cx={b.x} cz={b.z} />
      ))}
      {turtles.map((b) => (
        <Turtles key={b.site.id} id={b.site.id} zone={zone} cx={b.x} cz={b.z} />
      ))}
      {sharks.map((b) => (
        <ReefSharks key={b.site.id} id={b.site.id} zone={zone} cx={b.x} cz={b.z} />
      ))}
      {dives.map((b) => (
        <Divers key={b.site.id} id={b.site.id} zone={zone} cx={b.x} cz={b.z} depth={b.site.depth_m} />
      ))}
    </>
  );
}

/** The whale shark mission: tuna boil and seabirds above, bait ball below, the shark and a pod of
 *  dolphins, and the encounter rules. */
function WhaleSharkBoil({ id, cx, cz }: { id: string; cx: number; cz: number }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const SPLASH = pick(18, 28, 44), BIRDS = pick(5, 7, 10), TUNA = pick(3, 4, 6), POD = pick(3, 4, 5), BAIT = pick(110, 180, 300);
  const shark = useMemo(() => {
    const m = new THREE.Mesh(whaleSharkGeometry(), animalMaterial(time, "whale-shark", 1.5, true));
    m.frustumCulled = false;
    return m;
  }, [time]);
  const dolphins = useMemo(() => {
    const im = new THREE.InstancedMesh(dolphinGeometry(), animalMaterial(time, "dolphin", 5.5), POD);
    im.frustumCulled = false;
    return im;
  }, [time, POD]);
  const tuna = useMemo(() => {
    const r = profile([[0, 0.004, 0.02], [0.15, 0.02, 0.04], [0.55, 0.075, 0.13], [0.85, 0.06, 0.1], [1, 0.008, 0.01]]);
    const g = painted([body(r, 8, 8), fin([0, 0.01, -0.44, 0, 0.17, -0.56, 0, -0.17, -0.56])], "#1d2b3a", "#dfe6ea", 0.0);
    const im = new THREE.InstancedMesh(g, animalMaterial(time, "tuna", 14), TUNA);
    im.frustumCulled = false;
    return im;
  }, [time, TUNA]);
  // The boil seen from below: the small fish the tuna have driven up, packed into a turning ball.
  const bait = useMemo(() => schoolMesh(BAIT, time, { center: new THREE.Vector3(cx, -6, cz), radii: [8, 3.4, 8], size: 0.5, spin: 0.55, color: "#8fb6cc", flash: "#ffffff" }), [BAIT, time, cx, cz]);
  const splashes = useMemo(() => {
    const g = new THREE.CircleGeometry(0.5, 10);
    g.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.72, depthWrite: false }), SPLASH);
    im.frustumCulled = false;
    im.renderOrder = 4; // after the sea surface, like the boat's foam
    return im;
  }, [SPLASH]);
  const birds = useMemo(() => {
    // A seabird as two swept wings and a short body, seen from below or the side.
    const g = mergeGeometries([
      fin([0, 0, 0.16, 0.95, 0.12, -0.12, 0, 0, -0.14]),
      fin([0, 0, 0.16, -0.95, 0.12, -0.12, 0, 0, -0.14]),
      fin([0.05, 0, 0.3, -0.05, 0, 0.3, 0, 0, -0.34]),
    ])!;
    g.computeVertexNormals();
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#14212c", side: THREE.DoubleSide }), BIRDS);
    im.frustumCulled = false;
    return im;
  }, [BIRDS]);
  // From the boat a whale shark is a big dark shape under the water (the sea surface is opaque in
  // this view): its outline, flattened onto the surface and drawn after it, follows the shark.
  const shadow = useMemo(() => {
    const m = new THREE.Mesh(shark.geometry, new THREE.MeshBasicMaterial({ color: "#021a33", transparent: true, opacity: 0.5, depthWrite: false }));
    m.frustumCulled = false;
    m.renderOrder = 4;
    m.matrixAutoUpdate = false;
    return m;
  }, [shark]);
  useEffect(() => () => free(shark, dolphins, tuna, bait, splashes, birds), [shark, dolphins, tuna, bait, splashes, birds]);
  useEffect(() => () => (shadow.material as THREE.Material).dispose(), [shadow]);
  useEffect(() => () => untrack(`ws:${id}`), [id]);

  // The mission: "near" coming up to the contact zone; inside it "far" until the boat holds off
  // slowly ("watch"), "logged" once seen long enough, "dived" when the boat rushed it.
  type S = "near" | "far" | "watch" | "logged" | "dived";
  const st = useRef({
    state: "far" as S, watch: 0, dived: 0, logged: useBoat.getState().sightings.includes(id),
    // The shark: where it is, where it points, how deep; its place on the feeding figure of eight
    // and, while it visits the boat, on the circle it swims around it.
    x: cx + 30, z: cz, head: 0, depth: -0.8, th: 0, phi: 0, visiting: false,
    pod: 2.4, podK: 0,
  });

  useFrame((fr, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime, s = st.current;
    const store = useBoat.getState(), tele = store.tele;
    const far = tele ? Math.hypot(tele.x - cx, tele.z - cz) : 1e9;
    const seen = far < SEE_BOIL, close = far < SEE_SWIMMERS;
    splashes.visible = birds.visible = seen;
    shark.visible = dolphins.visible = tuna.visible = bait.visible = close;
    if (!seen) return; // out of sight: nothing drawn, nothing animated
    time.value = t;

    // ---- The rules.
    const inside = far < CONTACT_R;
    const dShark = tele ? Math.hypot(tele.x - s.x, tele.z - s.z) : 1e9;
    if (tele) {
      if (s.state === "dived") {
        if ((s.dived -= dt) <= 0 && far > BOIL_R + 25) s.state = s.logged ? "logged" : "far";
      } else if (far < BOIL_R + 2 || (inside && tele.speed > SLOW * 1.35) || (dShark < 9 && tele.speed > 0.9)) {
        // In the boil, speeding through the zone, or driving at the shark (it may come to a boat
        // that holds still: that is the point).
        s.state = "dived";
        s.dived = 30;
        s.watch = 0;
        store.notify(far < BOIL_R + 2 || dShark < 9 ? "boat.sight.tooClose" : "boat.sight.tooFast");
      } else if (s.logged) s.state = "logged";
      else if (inside && tele.speed <= SLOW) {
        s.state = "watch";
        if ((s.watch += dt) > 6) {
          s.logged = true;
          s.state = "logged";
          store.logSighting(id);
        }
      } else {
        s.state = "far";
        s.watch = Math.max(0, s.watch - dt * 0.5);
      }
      const shown: S | null = inside ? s.state : far < APPROACH_R ? "near" : null;
      const m = store.mission;
      if (shown ? m?.id !== id || m.state !== shown : m?.id === id) useBoat.setState({ mission: shown ? { id, type: "whale-shark", state: shown } : null });
    }

    // ---- The whale shark. It feeds in slow figures of eight through the boil; when the boat is
    // holding still nearby it comes over and circles it, close enough to count its spots.
    const visiting = !!tele && inside && tele.speed <= SLOW && (s.state === "watch" || s.state === "logged");
    if (visiting && !s.visiting) s.phi = Math.atan2(s.z - tele!.z, s.x - tele!.x);
    s.visiting = visiting;
    let tx: number, tz: number, v: number;
    if (visiting) {
      const R = 9.5 + Math.sin(t * 0.13) * 1.5;
      s.phi += dt * (1.15 / R);
      tx = tele!.x + Math.cos(s.phi) * R;
      tz = tele!.z + Math.sin(s.phi) * R;
      v = dShark > 22 ? 4.6 : 1.3; // hurries over, then glides
    } else {
      s.th += dt * 0.024;
      tx = cx + Math.cos(s.th) * 30;
      tz = cz + Math.sin(s.th * 2) * 15;
      v = 1.7;
    }
    const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const step = Math.min(d, v * dt);
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
      s.head = turn(s.head, Math.atan2(dx, dz), Math.min(1, dt * (visiting ? 1.4 : 0.8)));
    }
    // Feeding, its dorsal fin and tail tip cut the surface; for a snorkeler it swims at eye level.
    const want = s.state === "dived" ? -34 : visiting && store.under ? -2.5 - 0.35 * Math.sin(t * 0.3) : -0.72 - 0.2 * Math.sin(t * 0.35);
    s.depth += (want - s.depth) * Math.min(1, dt * (s.state === "dived" ? 0.5 : 0.6));
    place(shark, 0, s.x, s.depth, s.z, s.head, s.state === "dived" && s.depth > -30 ? -0.35 : 0, 0, 8);
    trackSubject(`ws:${id}`, id, s.x, s.depth, s.z, s.state === "dived" ? 0 : 45);
    shadow.visible = !store.under && s.depth > -8;
    if (shadow.visible) {
      _e.set(0, s.head, 0);
      shadow.matrix.compose(_p.set(s.x, 0.04, s.z), _q.setFromEuler(_e), _s.set(8, 0.002, 8));
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.min(1, (8 + s.depth) / 6);
    }
    if (store.mission?.id === id) {
      Object.assign(subject, { on: s.state !== "dived", x: s.x, z: s.z, look: null });
      // Seen from below, up close: the last step of the mission.
      if (visiting && store.under && dShark < 16) store.logSighting(`${id}:close`);
    }

    // ---- The boil: white water breaking out in patches, tuna leaping through it.
    for (let i = 0; i < SPLASH; i++) {
      const life = (t * (0.9 + hash(i) * 0.7) + hash(i * 3.1) * 5) % 1;
      const k = Math.floor(t * (0.9 + hash(i) * 0.7) + hash(i * 3.1) * 5);
      const a = hash(i * 7 + k) * Math.PI * 2, rr = Math.sqrt(hash(i * 13 + k * 3)) * BOIL_R;
      const size = (1.2 + hash(i + k) * 2.8) * Math.sin(life * Math.PI);
      _m.makeScale(size, 1, size).setPosition(cx + Math.cos(a) * rr, 0.07 + i * 0.0005, cz + Math.sin(a) * rr);
      splashes.setMatrixAt(i, _m);
    }
    splashes.instanceMatrix.needsUpdate = true;
    // Seabirds wheel over it (what captains look for).
    for (let i = 0; i < BIRDS; i++) {
      const sp = (0.22 + hash(i * 3) * 0.16) * (i % 2 ? 1 : -1), a = t * sp + i * 1.9, rr = 9 + hash(i * 9) * 16;
      place(birds, i, cx + Math.cos(a) * rr, 9 + hash(i * 5) * 12 + Math.sin(t * 0.9 + i) * 1.2, cz + Math.sin(a) * rr, Math.atan2(-Math.sin(a) * sp, Math.cos(a) * sp), 0, -0.45 * Math.sign(sp), 1.5);
    }
    birds.instanceMatrix.needsUpdate = true;
    if (!close) return;
    for (let i = 0; i < TUNA; i++) {
      const cyc = t * 0.7 + hash(i * 5) * 9, k = Math.floor(cyc), u = (cyc % 1) / 0.42; // airborne for part of each cycle
      const a = hash(i * 11 + k) * Math.PI * 2, rr = Math.sqrt(hash(i * 17 + k)) * (BOIL_R - 3), dir = hash(i + k * 7) * Math.PI * 2;
      const x0 = cx + Math.cos(a) * rr, z0 = cz + Math.sin(a) * rr;
      if (u < 1) place(tuna, i, x0 + Math.sin(dir) * u * 2.6, 1.5 * Math.sin(u * Math.PI) - 0.25, z0 + Math.cos(dir) * u * 2.6, dir, 1.1 * Math.cos(u * Math.PI), 0, 0.85);
      else {
        // Between leaps: streaking through the bait ball.
        const w = t * 1.4 + i * 2.1, r2 = 5 + hash(i * 3) * 3;
        place(tuna, i, cx + Math.cos(w) * r2, -4.5 - hash(i * 7) * 3, cz + Math.sin(w) * r2, Math.atan2(-Math.sin(w), Math.cos(w)), 0, 0.3, 0.85);
      }
    }
    tuna.instanceMatrix.needsUpdate = true;
    // Dolphins travel past in a loose line outside the boil, rising to breathe; with a snorkeler
    // in the water they swing in for a look.
    s.podK += ((visiting && store.under ? 1 : 0) - s.podK) * Math.min(1, dt * 0.5);
    const pk = s.podK, pcx = cx + ((tele?.x ?? cx) - cx) * pk, pcz = cz + ((tele?.z ?? cz) - cz) * pk, pr = 62 - 45 * pk;
    s.pod += dt * (0.021 + 0.12 * pk);
    for (let i = 0; i < POD; i++) {
      const a = s.pod - i * (0.045 + 0.1 * pk), rr = pr + (i % 2) * (5 - 3 * pk);
      const hop = Math.sin(t * 0.9 - i * 1.3), up = Math.max(0, hop);
      const y = (-0.95 + 1.15 * up * up) * (1 - pk) + (-2.2 - (i % 3) * 0.7 + Math.sin(t * 0.8 + i) * 0.5) * pk;
      place(dolphins, i, pcx + Math.cos(a) * rr, y, pcz + Math.sin(a) * rr, Math.atan2(-Math.sin(a), Math.cos(a)), 0.5 * Math.cos(t * 0.9 - i * 1.3) * (hop > -0.2 ? 1 : 0) * (1 - pk), 0.2 * pk, 2.4);
    }
    dolphins.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={shark} />
      <primitive object={shadow} />
      <primitive object={dolphins} />
      <primitive object={tuna} />
      <primitive object={bait} />
      <primitive object={splashes} />
      <primitive object={birds} />
    </>
  );
}

/** Sea turtles cruising over the bottom near the place and coming up to breathe now and then. With
 *  the boat's snorkeler in the water they glide in and circle at arm's length. */
function Turtles({ id, zone, cx, cz }: { id: string; zone: Zone; cx: number; cz: number }) {
  const N = pick(2, 3, 4);
  const time = useMemo(() => ({ value: 0 }), []);
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(turtleGeometry(), animalMaterial(time, "turtle", 0), N);
    im.frustumCulled = false;
    return im;
  }, [time, N]);
  useEffect(() => () => free(mesh), [mesh]);
  const ang = useRef<number[]>([]);
  const closeIn = useCloseIn(id);
  useEffect(() => () => untrack(`t:${id}:`), [id]);
  useFrame((fr, dtRaw) => {
    if (!(mesh.visible = boatDist(cx, cz) < SEE_REEF)) return;
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime, k = closeIn(dt);
    const tele = useBoat.getState().tele;
    const bx = tele?.x ?? cx, bz = tele?.z ?? cz, eye = eyeY(zone, bx, bz);
    time.value = t;
    for (let i = 0; i < N; i++) {
      // Each one wanders its own slow loop within ~120 m of the place; close in, a tight circle
      // around the boat, each at its own height and pace.
      const dir = i % 2 ? 1 : -1;
      const a = (ang.current[i] = (ang.current[i] ?? i * 2.1) + dt * dir * (0.012 + hash(i * 3 + 1) * 0.01 + k * (0.12 + i * 0.02)));
      const rr = (28 + hash(i * 7 + 2) * 60) * (1 - k) + (4.5 + i * 1.7) * k;
      const ox = (cx + (hash(i * 5) - 0.5) * 90) * (1 - k) + bx * k, oz = (cz + (hash(i * 11) - 0.5) * 90) * (1 - k) + bz * k;
      const x = ox + Math.cos(a) * rr, z = oz + Math.sin(a) * rr;
      const bottom = floorY(Math.min(-2.5, heightAtXZ(zone, x, z)));
      // Up for air for a short while every couple of minutes; otherwise a meter or two off the bottom.
      const breath = THREE.MathUtils.smoothstep(Math.sin(t * 0.055 + i * 2.3), 0.9, 1) * (1 - k);
      const cruise = Math.min(-1.4, bottom + 1.6) * (1 - k) + Math.max(bottom + 0.6, Math.min(-0.9, eye + 0.9 - i * 0.6 + Math.sin(t * 0.4 + i * 1.9) * 0.5)) * k;
      const y = THREE.MathUtils.lerp(cruise, -0.35, breath);
      place(mesh, i, x, y, z, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), 0.25 * Math.sin(t * 0.055 + i * 2.3 + 1.2) * breath, 0.08 * Math.sin(t * 1.3 + i) - 0.25 * k * dir, 0.95);
      trackSubject(`t:${id}:${i}`, id, x, y, z, 20);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

/** Caribbean reef sharks circling over the sand, around the small bucket of fish scraps this
 *  baited dive is run with (see the place's story). Under the water they circle the boat instead. */
function ReefSharks({ id, zone, cx, cz }: { id: string; zone: Zone; cx: number; cz: number }) {
  const N = pick(4, 6, 9);
  const time = useMemo(() => ({ value: 0 }), []);
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(reefSharkGeometry(), animalMaterial(time, "reef-shark", 3.2), N);
    im.frustumCulled = false;
    return im;
  }, [time, N]);
  const bucket = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.2, 0.16, 0.34, 10, 1, true);
    const m = new THREE.Mesh(g, underwater(new THREE.MeshBasicMaterial({ color: "#f4f1e6", side: THREE.DoubleSide })));
    m.position.set(cx, floorY(heightAtXZ(zone, cx, cz)) + 0.17, cz);
    return m;
  }, [zone, cx, cz]);
  useEffect(() => () => free(mesh, bucket), [mesh, bucket]);
  useEffect(() => () => untrack(`rs:${id}:`), [id]);
  const ang = useRef<number[]>([]);
  const closeIn = useCloseIn(id);
  useFrame((fr, dtRaw) => {
    if (!(mesh.visible = bucket.visible = boatDist(cx, cz) < SEE_REEF)) return;
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime, k = closeIn(dt);
    const tele = useBoat.getState().tele;
    const bx = tele?.x ?? cx, bz = tele?.z ?? cz, eye = eyeY(zone, bx, bz);
    const ox = cx + (bx - cx) * k, oz = cz + (bz - cz) * k;
    time.value = t;
    for (let i = 0; i < N; i++) {
      const dir = i % 2 ? 1 : -1;
      const a = (ang.current[i] = (ang.current[i] ?? i * 1.4) + dt * dir * (0.05 + hash(i * 3) * 0.035) * (1 + k * 1.3));
      const rr = (7 + hash(i * 7) * 16) * (1 - k) + (4 + hash(i * 7) * 9) * k;
      const x = ox + Math.cos(a) * rr, z = oz + Math.sin(a) * rr * (0.8 + 0.2 * k);
      const bottom = floorY(Math.min(-4, heightAtXZ(zone, x, z)));
      const low = Math.min(-2, bottom + 1.2 + hash(i * 13) * 3.5 + Math.sin(t * 0.3 + i) * 0.5);
      const y = low * (1 - k) + Math.max(bottom + 0.8, eye - 0.8 + hash(i * 13) * 2.6 + Math.sin(t * 0.3 + i) * 0.4) * k;
      place(mesh, i, x, y, z, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir * (0.8 + 0.2 * k)), 0, -0.14 * dir, 1.9 + hash(i * 17) * 0.7);
      trackSubject(`rs:${id}:${i}`, id, x, y, z, 24);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <primitive object={mesh} />
      <primitive object={bucket} />
    </>
  );
}

/** Looks for the divers of a group: wetsuit, fin and tank colors. */
const KITS: [string, string, string][] = [["#2f5f9a", "#f2c230", "#f2c230"], ["#2a6f78", "#e8edf2", "#c9d1d8"], ["#3a4f8a", "#f0663c", "#f2c230"], ["#38506a", "#2f9bd8", "#c9d1d8"]];

/**
 * A small group of scuba divers at a dive site (a Marine Park mooring, or a site from the dive
 * maps): they follow their guide in a slow loop over the reef near the buoy, kicking gently and
 * breathing out a burst of bubbles every few seconds. From the boat the surface is opaque, so they
 * show as their bubbles breaking it, which is how dive boats keep track of their divers. With the
 * boat's snorkeler in the water they swim over and circle at a few meters, at eye level.
 * Three draw calls (divers, bubbles under the water, bubbles at the surface), ~500 triangles a
 * diver, all hidden away from the site.
 */
function Divers({ id, zone, cx, cz, depth }: { id: string; zone: Zone; cx: number; cz: number; depth?: number }) {
  const N = pick(2, 3, 4), BUB = pick(36, 60, 96), POP = pick(9, 13, 18);
  const time = useMemo(() => ({ value: 0 }), []);
  const mesh = useMemo(() => {
    // One geometry for the group (instances share it); each group gets its own kit, by site.
    const kit = KITS[Math.floor(hash(cx * 0.013 + cz * 0.007) * KITS.length) % KITS.length];
    const im = new THREE.InstancedMesh(diverGeometry(kit[0], kit[1], kit[2]), diverMaterial(time), N);
    im.frustumCulled = false;
    im.visible = false;
    return im;
  }, [time, N, cx, cz]);
  const bubbles = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(g, underwater(new THREE.MeshBasicMaterial({ color: "#e4f5ff", transparent: true, opacity: 0.6, depthWrite: false })), BUB);
    im.frustumCulled = false;
    im.visible = false;
    im.count = 0;
    return im;
  }, [BUB]);
  const pops = useMemo(() => {
    // Foam patches, not rings: the sea's own cell lines are thin white curves, and rings vanished into them.
    const g = new THREE.CircleGeometry(1, 12);
    g.rotateX(-Math.PI / 2);
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false }), POP);
    im.frustumCulled = false;
    im.renderOrder = 5; // after the sea surface (4), which is transparent too
    im.visible = false;
    return im;
  }, [POP]);
  useEffect(() => () => free(mesh, bubbles, pops), [mesh, bubbles, pops]);
  useEffect(() => () => untrack(`dv:${id}:`), [id]);
  const st = useRef({ a: hash(cx) * Math.PI * 2, next: 0, head: 0, pos: [] as { x: number; y: number; z: number; yaw: number }[], ax: cx, az: cz, fx: 0, fz: -1 });
  // Bubbles in flight: where each burst left a regulator and when.
  const flight = useRef<{ x: number; y: number; z: number; t: number; s: number }[]>([]);
  const closeIn = useCloseIn(id);
  // The guide's loop: centered a little off the buoy, at the site's depth when it is known.
  const loopR = 16 + hash(cz * 0.01) * 10;
  useFrame((fr, dtRaw) => {
    const near = boatDist(cx, cz) < SEE_REEF;
    const { under } = useBoat.getState();
    mesh.visible = near && under;
    bubbles.visible = near && under;
    pops.visible = near && !under;
    if (!near) return;
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime, k = closeIn(dt), s = st.current;
    time.value = t;
    // Close in, the loop becomes a flat oval a few meters in front of the snorkeler's mask, as wide
    // as the view (a phone held upright sees only a meter or two to each side), so the group crosses
    // the view back and forth and is never behind you. It drifts after the view, unhurried: they
    // come over to where you look.
    const cam = fr.camera as THREE.PerspectiveCamera;
    const tanH = Math.tan(((cam.fov ?? 50) * Math.PI) / 360) * (cam.aspect ?? 1.6);
    const D = Math.min(10, Math.max(6, 2.2 / tanH)), RA = Math.min(6, Math.max(2.2, tanH * D * 1.15));
    _p.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const fl = Math.hypot(_p.x, _p.z) || 1, ffx = _p.x / fl, ffz = _p.z / fl;
    // Only under the water (above it this is the chase camera, far behind the boat); on the first
    // frames down it starts right in front of the mask.
    if (under) {
      const ease = k < 0.05 ? 1 : Math.min(1, dt * 0.5);
      s.ax += (cam.position.x + ffx * D - s.ax) * ease;
      s.az += (cam.position.z + ffz * D - s.az) * ease;
      s.fx += (ffx - s.fx) * ease;
      s.fz += (ffz - s.fz) * ease;
    }
    const fn = Math.hypot(s.fx, s.fz) || 1, fx = s.fx / fn, fz = s.fz / fn, sx = fz, sz = -fx;
    const RB = 2.2, Reff = loopR * (1 - k) + 4 * k;
    s.a += dt * ((0.32 + 0.28 * k) / Reff); // ~0.3 m/s, an easy dive pace; a little livelier up close
    for (let i = 0; i < N; i++) {
      // In a loose line behind the guide, each a little to one side.
      const a = s.a - i * (1.9 / Reff), side = (i % 2 ? 1 : -1) * (i ? 0.7 : 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      // Far: a circle round the site. Close: the oval in front of the mask.
      const x = (cx + ca * (loopR + side)) * (1 - k) + (s.ax + sx * ca * (RA + side) + fx * sa * RB) * k;
      const z = (cz + sa * (loopR + side)) * (1 - k) + (s.az + sz * ca * (RA + side) + fz * sa * RB) * k;
      const dx = -sa * loopR * (1 - k) + (-sx * sa * RA + fx * ca * RB) * k;
      const dz = ca * loopR * (1 - k) + (-sz * sa * RA + fz * ca * RB) * k;
      const bottom = floorY(Math.min(-3, heightAtXZ(zone, x, z)));
      const want = depth ? -Math.min(depth, 22) : bottom + 2;
      const cruise = Math.max(bottom + 1.4, Math.min(-2.5, want));
      const level = Math.max(bottom + 1, Math.min(-1.4, cam.position.y - 0.3 - i * 0.35));
      const y = cruise * (1 - k) + level * k + Math.sin(t * 0.5 + i * 1.7) * 0.25;
      const yaw = Math.atan2(dx, dz);
      s.pos[i] = { x, y, z, yaw };
      place(mesh, i, x, y, z, yaw, -0.08 + 0.05 * Math.sin(t * 0.4 + i), 0.06 * Math.sin(t * 0.7 + i * 2), 1.12);
      trackSubject(`dv:${id}:${i}`, id, x, y, z, 20);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Breathing: every ~4 s one diver breathes out a burst from the regulator (only drawn under the water).
    if (!under) flight.current.length = 0;
    else if (t >= s.next) {
      const i = Math.floor(hash(t * 3.3) * N) % N, p = s.pos[i];
      s.next = t + 4.2 / N;
      if (p) for (let j = 0; j < 7; j++) flight.current.push({ x: p.x + Math.sin(p.yaw) * 0.68, y: p.y + 0.05, z: p.z + Math.cos(p.yaw) * 0.68, t, s: 0.6 + hash(t + j) * 0.8 });
    }
    // Bubbles rise ~0.9 m/s, wobbling and growing as the pressure drops, and pop at the surface.
    const list = flight.current;
    let n = 0;
    for (let j = 0; j < list.length; j++) {
      const b = list[j], age = t - b.t, y = b.y + age * (0.75 + b.s * 0.25);
      if (y > -0.12 || n >= BUB) continue;
      list[n] = b;
      const w = Math.sin(age * 7 + b.s * 20) * 0.08 * Math.min(1, age);
      const size = (0.018 + 0.03 * b.s) * (1 + Math.min(1.5, age * 0.12));
      _m.makeScale(size, size * 0.8, size).setPosition(b.x + w + (b.s - 1) * age * 0.12, y, b.z + Math.cos(age * 5 + b.s * 9) * 0.06 * Math.min(1, age));
      bubbles.setMatrixAt(n++, _m);
    }
    list.length = n;
    bubbles.count = n;
    bubbles.instanceMatrix.needsUpdate = true;
    // At the surface, above the group: patches of bubbles boiling up and spreading, a few meters
    // across, big enough to spot from the boat (they are drawn larger than life on purpose).
    if (!under) {
      const gx = s.pos[0]?.x ?? cx, gz = s.pos[0]?.z ?? cz;
      for (let j = 0; j < POP; j++) {
        const life = (t * (0.45 + hash(j) * 0.4) + hash(j * 3.7)) % 1, cyc = Math.floor(t * (0.45 + hash(j) * 0.4) + hash(j * 3.7));
        const ang = hash(j * 11 + cyc) * Math.PI * 2, rr = Math.sqrt(hash(j * 5 + cyc * 3)) * 5;
        const size = (0.8 + 1.6 * life) * (0.6 + hash(j + cyc) * 0.8) * Math.sin(Math.min(1, life * 1.2) * Math.PI);
        _m.makeScale(size, 1, size).setPosition(gx + Math.cos(ang) * rr, 0.06 + j * 0.0005, gz + Math.sin(ang) * rr);
        pops.setMatrixAt(j, _m);
      }
      pops.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <primitive object={mesh} />
      <primitive object={bubbles} />
      <primitive object={pops} />
    </>
  );
}

/** A shipwreck on the seafloor (wreck.ts) and the school of fish that lives over it: two meshes,
 *  drawn only while the boat is near. */
function Wreck({ zone, place: w }: { zone: Zone; place: ZonePlace }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const mesh = useMemo(() => buildWreck(w), [w]);
  const school = useMemo(() => {
    const L = w.site.wreck!.length_m, lying = w.site.wreck!.pose === "side";
    const y = floorY(w.floor ?? heightAtXZ(zone, w.x, w.z)) + L * (lying ? 0.2 : 0.24);
    // Lengthwise along the hull (the ship's bow points along its yaw), over the deck and around the masts.
    return schoolMesh(pick(40, 70, 130), time, { center: new THREE.Vector3(w.x, y, w.z), radii: [L * 0.13, 1.2 + L * 0.03, L * 0.36], yaw: w.yaw ?? 0, size: 0.42, spin: 0.2, color: "#d9c95e", flash: "#fff7c2" });
  }, [w, zone, time]);
  useEffect(() => () => free(mesh, school), [mesh, school]);
  // Points along the hull, low and high, can be photographed: any part of the ship in frame counts
  // (up close, one end may be all there is in view).
  useEffect(() => {
    const L = w.site.wreck!.length_m, yaw = w.yaw ?? 0, y0 = floorY(w.floor ?? heightAtXZ(zone, w.x, w.z));
    for (const k of [-0.45, -0.22, 0, 0.22, 0.45])
      for (const h of [0.05, 0.16]) trackSubject(`w:${w.site.id}:${k}:${h}`, w.site.id, w.x + Math.sin(yaw) * L * k, y0 + L * h, w.z + Math.cos(yaw) * L * k, 48);
    return () => untrack(`w:${w.site.id}:`);
  }, [w, zone]);
  useFrame((fr) => {
    const on = boatDist(w.x, w.z) < SEE_REEF;
    mesh.visible = school.visible = on;
    if (on) time.value = fr.clock.elapsedTime;
  });
  return (
    <>
      <primitive object={mesh} />
      <primitive object={school} />
    </>
  );
}

/** The camera's side inside the Canvas: takes the photo asked for (right after drawing the frame)
 *  and, while the viewfinder is up, works out 5 times a second which subject is in frame: within
 *  its range, inside the part of the screen the photo keeps, the nearest to the middle. */
function PhotoAim() {
  const v = useMemo(() => new THREE.Vector3(), []);
  const t = useRef(0);
  useFrame((st, dt) => {
    fulfilShot(st.gl, st.scene, st.camera);
    const roll = useRoll.getState();
    if (!roll.camera || (t.current += dt) < 0.2) return;
    t.current = 0;
    const { fx, fy } = cropShare(st.size.width, st.size.height);
    let best: string | null = null, score = Infinity;
    for (const p of photoSubjects.values()) {
      const d = st.camera.position.distanceTo(v.set(p.x, p.y, p.z));
      if (d > p.r) continue;
      v.project(st.camera);
      if (v.z > 1) continue;
      const cx = v.x / fx, cy = v.y / fy;
      if (Math.abs(cx) > 0.85 || Math.abs(cy) > 0.85) continue;
      const sc = Math.hypot(cx, cy) * 30 + d * 0.4;
      if (sc < score) (score = sc), (best = p.id);
    }
    roll.setAim(best);
  });
  return null;
}
