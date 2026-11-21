import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { REDUCED_MOTION } from "../lib/device";
import { displayY, type TerrainData } from "./terrain";

// A small high-wing light plane (in the spirit of a Cessna 172) on a sightseeing lap around the
// island: white with ocean-blue trim, banking into its turns, a faint propeller disc and a soft
// shadow on the sea. Decoration only: it never takes the pointer.
// Budget: three draw calls and about 240 triangles, built in code. The airframe is one mesh with the
// light baked into its vertex colors, so it needs no lights and an unlit material.
// It never asks for a redraw. On computers the island's own ~30 fps loop moves it; on phones, where
// the island redraws only when something changes, it is simply somewhere new at the next redraw.

type V3 = readonly [number, number, number];

const WHITE = new THREE.Color("#f7fafc");
const BLUE = new THREE.Color("#0a66f0");
const GLASS = new THREE.Color("#12324f");
const TIRE = new THREE.Color("#1b2733");
/** What white turns into on the faces the light doesn't reach: a cool blue-gray, not a neutral gray. */
const SHADE = new THREE.Color(0.16, 0.25, 0.42);

/** Collects triangles painted one color each, with light from above baked in face by face. */
function painter() {
  const pos: number[] = [], col: number[] = [];
  /** A triangle facing `out` (roughly): the winding is turned to match, so no face is inside out. */
  const tri = (a: V3, b: V3, c: V3, paint: THREE.Color, out: V3) => {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-10) return;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) {
      [b, c] = [c, b];
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    // Mostly from above, a little from the left and the front.
    const k = THREE.MathUtils.clamp(0.58 + (0.42 * ny + 0.09 * nx + 0.05 * nz) / len, 0, 1);
    pos.push(...a, ...b, ...c);
    for (let v = 0; v < 3; v++)
      col.push(paint.r * (SHADE.r + (1 - SHADE.r) * k), paint.g * (SHADE.g + (1 - SHADE.g) * k), paint.b * (SHADE.b + (1 - SHADE.b) * k));
  };
  /** A flat convex outline as a fan of triangles. */
  const fan = (pts: V3[], paint: THREE.Color, out: V3) => {
    for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1], paint, out);
  };
  const middle = (pts: V3[]): V3 => {
    let x = 0, y = 0, z = 0;
    for (const p of pts) (x += p[0]), (y += p[1]), (z += p[2]);
    return [x / pts.length, y / pts.length, z / pts.length];
  };
  /** Skin between consecutive rings of points (a fuselage, a wing, a strut), facing away from the rings' middles. */
  const loft = (rings: V3[][], paint: (segment: number, side: number) => THREE.Color) => {
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      const ma = middle(A), mb = middle(B);
      for (let j = 0; j < A.length; j++) {
        const a = A[j], b = A[(j + 1) % A.length], c = B[(j + 1) % B.length], d = B[j];
        const out: V3 = [
          (a[0] + b[0] + c[0] + d[0]) / 4 - (ma[0] + mb[0]) / 2,
          (a[1] + b[1] + c[1] + d[1]) / 4 - (ma[1] + mb[1]) / 2,
          (a[2] + b[2] + c[2] + d[2]) / 4 - (ma[2] + mb[2]) / 2,
        ];
        tri(a, b, c, paint(i, j), out);
        tri(a, c, d, paint(i, j), out);
      }
    }
  };
  const build = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  };
  return { tri, fan, loft, build };
}

// ---- The airframe: 1 unit from spinner to tail, nose toward +z, y up; wingspan 1.34.
// Fuselage sections from nose to tail: z, then half width and height of the roof edge, the belt
// (the top and the bottom of the cheat line) and the belly edge.
const SECTIONS: number[][] = [
  [0.44, 0.036, 0.04, 0.052, 0.012, -0.012, 0.036, -0.058], // front of the cowling
  [0.27, 0.046, 0.052, 0.066, 0.022, -0.004, 0.046, -0.074], // firewall, foot of the windshield
  [0.17, 0.05, 0.118, 0.068, 0.026, 0, 0.048, -0.078], // top of the windshield
  [-0.04, 0.044, 0.112, 0.064, 0.026, 0, 0.044, -0.07], // back of the cabin
  [-0.24, 0.022, 0.07, 0.036, 0.03, 0.01, 0.022, -0.026], // tail cone
];
const TAIL: V3 = [0, 0.036, -0.5];
const HALF_SPAN = 0.67;
const PROP: V3 = [0, -0.006, 0.452]; // propeller hub

/** Wing section at span position x: leading edge, top, trailing edge, bottom. */
function wingSection(x: number): V3[] {
  const t = Math.abs(x) / HALF_SPAN;
  const taper = THREE.MathUtils.clamp((Math.abs(x) - 0.28) / (HALF_SPAN - 0.28), 0, 1); // straight inboard, tapered outboard
  const lead = 0.235 - 0.023 * taper, trail = 0.035 + 0.037 * taper, thick = 0.03 - 0.012 * taper;
  const y = 0.112 + 0.03 * t; // a little dihedral
  const crown = lead - (lead - trail) * 0.32;
  return [[x, y + thick * 0.45, lead], [x, y + thick, crown], [x, y + thick * 0.5, trail], [x, y, crown]];
}

function airframe(): THREE.BufferGeometry {
  const { tri, fan, loft, build } = painter();

  // Fuselage, eight sides: roof, window, cheat line and lower side on the right, belly, and the same
  // back up the left. The windshield is the roof of the second segment.
  const rings = SECTIONS.map(([z, wt, yt, w, yu, yl, wb, yb]): V3[] => [
    [-wt, yt, z], [wt, yt, z], [w, yu, z], [w, yl, z], [wb, yb, z], [-wb, yb, z], [-w, yl, z], [-w, yu, z],
  ]);
  const skin = (segment: number, side: number) => {
    if (side === 2 || side === 6) return BLUE; // cheat line
    if ((side === 1 || side === 7) && (segment === 1 || segment === 2)) return GLASS; // side windows
    if (side === 0 && segment === 1) return GLASS; // windshield
    return WHITE;
  };
  loft(rings, skin);
  const last = rings[rings.length - 1];
  for (let j = 0; j < 8; j++) {
    const a = last[j], b = last[(j + 1) % 8];
    tri(a, b, TAIL, skin(4, j), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.03, 0]);
  }
  fan(rings[0], WHITE, [0, 0, 1]);
  // Spinner.
  for (let j = 0; j < 6; j++) {
    const a0 = (j / 6) * Math.PI * 2, a1 = ((j + 1) / 6) * Math.PI * 2, r = 0.026;
    tri(
      [PROP[0] + Math.cos(a0) * r, PROP[1] + Math.sin(a0) * r, 0.44],
      [PROP[0] + Math.cos(a1) * r, PROP[1] + Math.sin(a1) * r, 0.44],
      [PROP[0], PROP[1], 0.506],
      BLUE,
      [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0.4],
    );
  }

  // One wing across the top of the cabin, with blue tips.
  const stations = [-HALF_SPAN, -0.575, -0.28, 0.28, 0.575, HALF_SPAN];
  const wing = stations.map(wingSection);
  loft(wing, (segment) => (segment === 0 || segment === 4 ? BLUE : WHITE));
  fan(wing[0], BLUE, [-1, 0, 0]);
  fan(wing[5], BLUE, [1, 0, 0]);
  // Two struts from the lower fuselage to the wing: thin three-sided bars.
  for (const s of [-1, 1]) {
    const bar = (x: number, y: number): V3[] => [[x, y, 0.163], [x, y, 0.137], [x + s * 0.004, y - 0.007, 0.15]];
    loft([bar(s * 0.064, -0.02), bar(s * 0.31, 0.123)], () => WHITE);
  }

  // Tail: a flat stabilizer and a swept fin with a dorsal fillet, each two faces back to back.
  const stab: V3[] = [[-0.215, 0.044, -0.455], [-0.215, 0.044, -0.385], [0, 0.044, -0.345], [0.215, 0.044, -0.385], [0.215, 0.044, -0.455], [0, 0.044, -0.47]];
  fan(stab, WHITE, [0, 1, 0]);
  fan(stab, WHITE, [0, -1, 0]);
  const fin = (z: number, y: number): V3 => [0, y, z];
  const lower = [fin(-0.5, 0.03), fin(-0.2, 0.07), fin(-0.335, 0.105), fin(-0.379, 0.175), fin(-0.5, 0.175)];
  const upper = [fin(-0.379, 0.175), fin(-0.41, 0.225), fin(-0.505, 0.225), fin(-0.5, 0.175)];
  for (const s of [-1, 1]) {
    fan(lower, WHITE, [s, 0, 0]);
    fan(upper, BLUE, [s, 0, 0]);
  }

  // Fixed tricycle gear: three flat wheels, leaf-spring legs and a nose strut.
  const wheel = (x: number, y: number, z: number, r: number) => {
    const rim: V3[] = [];
    for (let j = 0; j < 6; j++) rim.push([x, y + Math.sin((j / 6) * Math.PI * 2) * r, z + Math.cos((j / 6) * Math.PI * 2) * r]);
    fan(rim, TIRE, [1, 0, 0]);
    fan(rim, TIRE, [-1, 0, 0]);
  };
  for (const s of [-1, 1]) {
    wheel(s * 0.125, -0.135, 0.105, 0.03);
    const leg: V3[] = [[s * 0.045, -0.068, 0.12], [s * 0.045, -0.068, 0.09], [s * 0.125, -0.128, 0.095], [s * 0.125, -0.128, 0.115]];
    fan(leg, WHITE, [s * 0.6, 0.8, 0]);
    fan(leg, WHITE, [-s * 0.6, -0.8, 0]);
  }
  wheel(0, -0.128, 0.37, 0.026);
  const strut: V3[] = [[0, -0.06, 0.383], [0, -0.06, 0.367], [0, -0.125, 0.365], [0, -0.125, 0.375]];
  fan(strut, WHITE, [1, 0, 0]);
  fan(strut, WHITE, [-1, 0, 0]);

  return build();
}

/** A flat disc of triangles with a color and an opacity per vertex (center first, then the rings). */
function softDisc(rings: { r: [number, number]; alpha: (angle: number) => number }[], center: number, rgb: V3, sides: number, plane: "xy" | "xz") {
  const pos: number[] = [], col: number[] = [];
  const put = (rx: number, rz: number, a: number, alpha: number) => {
    const u = Math.cos(a) * rx, v = Math.sin(a) * rz;
    if (plane === "xy") pos.push(u, v, 0);
    else pos.push(u, 0, v);
    col.push(rgb[0], rgb[1], rgb[2], alpha);
  };
  let inner = { r: [0, 0] as [number, number], alpha: (_: number) => center };
  for (const ring of rings) {
    for (let j = 0; j < sides; j++) {
      const a0 = (j / sides) * Math.PI * 2, a1 = ((j + 1) / sides) * Math.PI * 2;
      put(inner.r[0], inner.r[1], a0, inner.alpha(a0));
      put(ring.r[0], ring.r[1], a0, ring.alpha(a0));
      put(ring.r[0], ring.r[1], a1, ring.alpha(a1));
      if (inner.r[0] === 0) continue; // the middle is a fan, not a band
      put(inner.r[0], inner.r[1], a0, inner.alpha(a0));
      put(ring.r[0], ring.r[1], a1, ring.alpha(a1));
      put(inner.r[0], inner.r[1], a1, inner.alpha(a1));
    }
    inner = ring;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.computeBoundingSphere();
  return g;
}

/** The spinning propeller as a faint disc, a little brighter along two blurred blades. */
const propDisc = () => softDisc([{ r: [0.125, 0.125], alpha: (a) => 0.1 + 0.3 * Math.cos(a) ** 2 }], 0.16, [0.82, 0.9, 0.96], 10, "xy");
/** The shadow on the sea: dark in the middle, fading to nothing at the rim. */
const shadowBlob = () =>
  softDisc([{ r: [0.34, 0.27], alpha: () => 0.24 }, { r: [0.64, 0.5], alpha: () => 0 }], 0.32, [0, 0.02, 0.05], 12, "xz");

// ---- The lap.
const SAMPLES = 256;
const OFFSHORE = 18; // scene units (1.8 km): how far outside the land the loop runs
const ROUNDING = 14; // how far along the loop each point is averaged with its neighbors
const CRUISE = 12.5; // scene units a second, within laps of 70 to 100 s
const CLEARANCE = 7; // above the island's highest ground, in display units
const FLOOR = 12; // lowest altitude, for flat islands

interface Route {
  /** SAMPLES + 1 points evenly spaced along the loop (the last repeats the first). */
  x: Float32Array;
  z: Float32Array;
  yaw: Float32Array; // heading, continuous around the loop
  bank: Float32Array;
  length: number;
  lap: number; // seconds
  alt: number;
}

/** A closed line resampled to n points evenly spaced along it. */
function evenly(px: Float64Array, pz: Float64Array, n: number) {
  const m = px.length, cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    cum[i + 1] = cum[i] + Math.hypot(px[j] - px[i], pz[j] - pz[i]);
  }
  const length = cum[m], x = new Float64Array(n), z = new Float64Array(n);
  for (let i = 0, k = 0; i < n; i++) {
    const s = (i / n) * length;
    while (k < m - 1 && cum[k + 1] < s) k++;
    const f = cum[k + 1] > cum[k] ? (s - cum[k]) / (cum[k + 1] - cum[k]) : 0, j = (k + 1) % m;
    x[i] = px[k] + (px[j] - px[k]) * f;
    z[i] = pz[k] + (pz[j] - pz[k]) * f;
  }
  return { x, z, length };
}

/** Averages each value of a closed series with its neighbors, `half` to each side. */
function blur(v: Float64Array, half: number) {
  const n = v.length, out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let d = -half; d <= half; d++) sum += v[(i + d + n) % n];
    out[i] = sum / (2 * half + 1);
  }
  return out;
}

const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)); // an angle difference, −π..π

/**
 * The loop around the island's land, worked out once from the heightfield: the outline a rubber band
 * would take around the land, pushed OFFSHORE out to sea, pulled back in where the coast curves away
 * from it (Roatán's south side), then rounded. Flown counterclockwise seen from above, the island on
 * the pilot's side, starting from its southernmost point (the near side of the opening view).
 */
function flightRoute(td: TerrainData): Route {
  const { w, h, heights: H, sizeX, sizeZ } = td;
  // The coast as points (land with sea next to it, every few cells), and the highest ground.
  const st = Math.max(1, Math.round(w / 400));
  const isLand = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && H[j * w + i] > 1;
  const coast: number[] = [];
  let top = 0;
  for (let k = 0; k < H.length; k++) if (H[k] > top) top = H[k];
  for (let j = 0; j < h; j += st)
    for (let i = 0; i < w; i += st)
      if (isLand(i, j) && !(isLand(i - st, j) && isLand(i + st, j) && isLand(i, j - st) && isLand(i, j + st)))
        coast.push((i / (w - 1) - 0.5) * sizeX, (j / (h - 1) - 0.5) * sizeZ);
  if (!coast.length) coast.push(td.center.x, td.center.z);

  // Rubber band + OFFSHORE: for each compass direction, the land point farthest that way, pushed out.
  const dirs = 120;
  const hx = new Float64Array(dirs), hz = new Float64Array(dirs);
  for (let k = 0; k < dirs; k++) {
    const a = -(k / dirs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let best = -Infinity, bx = 0, bz = 0;
    for (let i = 0; i < coast.length; i += 2) {
      const d = coast[i] * c + coast[i + 1] * s;
      if (d > best) (best = d), (bx = coast[i]), (bz = coast[i + 1]);
    }
    hx[k] = bx + c * OFFSHORE;
    hz[k] = bz + s * OFFSHORE;
  }
  let line = evenly(hx, hz, SAMPLES);
  // Where that leaves the plane far out at sea, come three quarters of the way back toward the coast;
  // and stay inside the scene.
  const mx = Math.max(0, sizeX / 2 - 10), mz = Math.max(0, sizeZ / 2 - 10);
  for (let i = 0; i < SAMPLES; i++) {
    let best = Infinity, bx = 0, bz = 0;
    for (let k = 0; k < coast.length; k += 2) {
      const dx = line.x[i] - coast[k], dz = line.z[i] - coast[k + 1], d = dx * dx + dz * dz;
      if (d < best) (best = d), (bx = coast[k]), (bz = coast[k + 1]);
    }
    const d = Math.sqrt(best);
    if (d > OFFSHORE) {
      const f = 1 - 0.75 * (1 - OFFSHORE / d);
      line.x[i] = bx + (line.x[i] - bx) * f;
      line.z[i] = bz + (line.z[i] - bz) * f;
    }
    line.x[i] = THREE.MathUtils.clamp(line.x[i], -mx, mx);
    line.z[i] = THREE.MathUtils.clamp(line.z[i], -mz, mz);
  }
  line = evenly(line.x, line.z, SAMPLES);
  const half = Math.max(1, Math.round(ROUNDING / (line.length / SAMPLES)));
  for (let pass = 0; pass < 3; pass++) {
    line.x = blur(line.x, half);
    line.z = blur(line.z, half);
  }
  line = evenly(line.x, line.z, SAMPLES);

  // Start at the southernmost point.
  let first = 0;
  for (let i = 1; i < SAMPLES; i++) if (line.z[i] > line.z[first]) first = i;
  const at = (i: number) => (((first + i) % SAMPLES) + SAMPLES) % SAMPLES;
  const step = line.length / SAMPLES;
  const heading = new Float64Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) heading[i] = Math.atan2(line.x[at(i + 1)] - line.x[at(i - 1)], line.z[at(i + 1)] - line.z[at(i - 1)]);
  // Bank into the turn: more the tighter it is, easing off toward 34°.
  let curve = new Float64Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) curve[i] = turn(heading[(i + 1) % SAMPLES] - heading[(i + SAMPLES - 1) % SAMPLES]) / (2 * step);
  curve = blur(curve, half);

  const x = new Float32Array(SAMPLES + 1), z = new Float32Array(SAMPLES + 1), yaw = new Float32Array(SAMPLES + 1), bank = new Float32Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const k = i % SAMPLES;
    x[i] = line.x[at(k)];
    z[i] = line.z[at(k)];
    yaw[i] = i ? yaw[i - 1] + turn(heading[k] - heading[(k + SAMPLES - 1) % SAMPLES]) : heading[0];
    bank[i] = -0.6 * Math.tanh((curve[k] * 10.5) / 0.6);
  }
  return {
    x,
    z,
    yaw,
    bank,
    length: line.length,
    lap: THREE.MathUtils.clamp(line.length / CRUISE, 70, 100),
    alt: Math.max(FLOOR, displayY(top) + CLEARANCE),
  };
}

// Readable at any zoom, like the survey boats: the plane grows with its distance from the camera,
// about 43 px of wingspan on a 1080 px tall screen, within limits so it is neither a speck up close
// nor a blimp from afar.
const SIZE = 0.023;
const SMALLEST = 0.45;
const LARGEST = 16;
const SEA = 0.06; // just above the water surface
const PARKED = 0.08; // with reduced motion: where on the lap it sits (level, along the south coast)
// Dev only: window.__rqPlaneScale = 6 enlarges the plane to inspect it.
const DEV_SCALE = () => (import.meta.env.DEV ? ((window as { __rqPlaneScale?: number }).__rqPlaneScale ?? 1) : 1);
const noHit = () => null;

export function Plane({ td }: { td: TerrainData }) {
  const route = useMemo(() => flightRoute(td), [td]);
  const kit = useMemo(
    () => ({
      airframe: airframe(),
      prop: propDisc(),
      shadow: shadowBlob(),
      // Unlit, and outside the scene's fog and tone mapping: the white stays white at any zoom.
      paint: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false }),
      soft: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      kit.airframe.dispose();
      kit.prop.dispose();
      kit.shadow.dispose();
      kit.paint.dispose();
      kit.soft.dispose();
    },
    [kit],
  );

  const craft = useRef<THREE.Group>(null);
  const prop = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);

  // Where the plane is depends only on the clock: nothing here asks for a frame.
  useFrame(({ clock, camera }) => {
    const g = craft.current, p = prop.current, s = shadow.current;
    if (!g || !p || !s) return;
    const t = REDUCED_MOTION ? 0 : clock.elapsedTime;
    const lap = REDUCED_MOTION ? PARKED : t / route.lap;
    const f = (lap - Math.floor(lap)) * SAMPLES;
    const i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i;
    const x = route.x[i] + (route.x[i + 1] - route.x[i]) * k;
    const z = route.z[i] + (route.z[i + 1] - route.z[i]) * k;
    const yaw = route.yaw[i] + (route.yaw[i + 1] - route.yaw[i]) * k;
    const bank = route.bank[i] + (route.bank[i + 1] - route.bank[i]) * k;
    const c = camera.position;
    const size = THREE.MathUtils.clamp(Math.hypot(c.x - x, c.y - route.alt, c.z - z) * SIZE, SMALLEST, LARGEST) * DEV_SCALE();
    // A very slight bob, with the nose and the wings nodding along.
    g.position.set(x, route.alt + size * 0.05 * Math.sin(t * 1.1), z);
    g.rotation.set(0.02 * Math.sin(t * 0.8), yaw, bank + 0.03 * Math.sin(t * 0.6 + 1), "YXZ");
    g.scale.setScalar(size);
    p.rotation.z = t * 9;
    s.position.set(x, SEA, z);
    s.rotation.y = yaw;
    s.scale.setScalar(size);
  });

  return (
    <>
      <group ref={craft}>
        <mesh geometry={kit.airframe} material={kit.paint} raycast={noHit} />
        {/* After the sea (render order 2), which is see-through and would otherwise paint over them. */}
        <mesh ref={prop} geometry={kit.prop} material={kit.soft} position={PROP} renderOrder={3} raycast={noHit} />
      </group>
      <mesh ref={shadow} geometry={kit.shadow} material={kit.soft} renderOrder={3} raycast={noHit} />
    </>
  );
}
