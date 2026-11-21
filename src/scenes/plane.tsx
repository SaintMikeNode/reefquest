import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MOBILE, REDUCED_MOTION } from "../lib/device";
import { displayY, type TerrainData } from "./terrain";

// A small high-wing light plane (in the spirit of a Cessna 172) on a sightseeing lap around the
// island: white with ocean-blue trim, banking into its turns, with its shadow on the sea.
// Decoration only: it never takes the pointer.
//
// It is not drawn in the 3D scene. The island redraws only when something changes on phones and
// tablets (battery), so a plane in the scene stood still and then jumped (Tulio). Instead it is a
// small vector image over the map, placed where its 3D position projects and turned and squashed
// with the view (its wings and body follow the ground plane in perspective, the wings narrow as it
// banks). Moving it is a CSS transform, which the browser's compositor applies without redrawing
// the island or repainting anything: smooth at any frame rate, for a handful of arithmetic a frame
// (~30 a second on phones, every frame on computers). It also follows every redraw, so it stays put
// on the map while the view moves. With reduced motion it sits still at one point of its lap.

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
const SEA = 0.06; // its shadow, just above the water surface
const PARKED = 0.08; // with reduced motion: where on the lap it sits (level, along the south coast)
const SPRITE = 64; // px, the image's box; its wingspan is 60 px of it
const DEV_SCALE = () => (import.meta.env.DEV ? ((window as { __rqPlaneScale?: number }).__rqPlaneScale ?? 1) : 1);

// Seen from above, nose up: wing with blue tips, fuselage with a blue stripe running into the fin,
// tailplane, windshield ahead of the wing, a faint propeller disc. Thin dark edges keep it readable
// over white surf and sand.
const OUTLINE = '<path d="M23 50.5Q32 48.5 41 50.5L41 54Q32 53 23 54Z"/><path d="M32 6.5C34.8 6.5 36 9.5 36 13L35.4 38L33.2 55.5L30.8 55.5L28.6 38L28 13C28 9.5 29.2 6.5 32 6.5Z"/><path d="M3 22.5Q32 20.5 61 22.5Q62 23 61.6 26.5L61 29.5Q32 31 3 29.5L2.4 26.5Q2 23 3 22.5Z"/>';
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<g fill="#f7fafc" stroke="rgba(4,16,29,0.6)" stroke-width="1" stroke-linejoin="round">${OUTLINE}</g>
<path d="M3 22.5Q2 23 2.4 26.5L3 29.5L8.6 29.85L8.6 22.15Z" fill="#0a66f0"/>
<path d="M61 22.5Q62 23 61.6 26.5L61 29.5L55.4 29.85L55.4 22.15Z" fill="#0a66f0"/>
<path d="M31.35 31L32.65 31L32.5 55.3L31.5 55.3Z" fill="#0a66f0"/>
<path d="M28.6 21.6L35.4 21.6L34.8 17.4Q32 16.3 29.2 17.4Z" fill="#12324f"/>
<ellipse cx="32" cy="5.4" rx="8.5" ry="1.3" fill="rgba(255,255,255,0.5)"/>
</svg>`;
const SHADOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><g fill="#02101f">${OUTLINE}</g></svg>`;

const P = new THREE.Vector3(), Q = new THREE.Vector3();

export function Plane({ td }: { td: TerrainData }) {
  const route = useMemo(() => flightRoute(td), [td]);
  const { camera, gl } = useThree();
  const get = useThree((s) => s.get);

  // The two images, in a layer of their own over the canvas (under the labels and the HUD).
  const els = useMemo(() => {
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2;contain:strict";
    const make = (svg: string, opacity: string) => {
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;left:0;top:0;width:${SPRITE}px;height:${SPRITE}px;transform-origin:0 0;will-change:transform;visibility:hidden;opacity:${opacity}`;
      el.innerHTML = svg;
      layer.appendChild(el);
      return el;
    };
    const shadow = make(SHADOW_SVG, "0.24");
    const plane = make(PLANE_SVG, "1");
    return { layer, shadow, plane, shown: false };
  }, []);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    host?.appendChild(els.layer);
    return () => els.layer.remove();
  }, [gl, els]);

  /** Put the images where the plane is at time t (seconds), as the camera sees it now. */
  const place = useMemo(() => {
    const at = (arr: Float32Array, i: number, k: number) => arr[i] + (arr[i + 1] - arr[i]) * k;
    const px = (v: THREE.Vector3, w: number, h: number) => [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h] as const;
    return (t: number) => {
      const { width: w, height: h } = get().size;
      const lap = REDUCED_MOTION ? PARKED : t / route.lap;
      const f = (lap - Math.floor(lap)) * SAMPLES;
      const i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i;
      const x = at(route.x, i, k), z = at(route.z, i, k), yaw = at(route.yaw, i, k), bank = at(route.bank, i, k);
      P.set(x, route.alt, z).project(camera);
      const on = P.z < 1 && Math.abs(P.x) < 1.15 && Math.abs(P.y) < 1.15;
      if (on !== els.shown) {
        els.shown = on;
        els.plane.style.visibility = els.shadow.style.visibility = on ? "visible" : "hidden";
      }
      if (!on) return;
      const [sx, sy] = px(P, w, h);
      // The plane's nose and right wing, 5 units long, as they project: the image's axes.
      const sf = Math.sin(yaw), cf = Math.cos(yaw);
      const [fx, fy] = px(Q.set(x + sf * 5, route.alt, z + cf * 5).project(camera), w, h);
      const [rx, ry] = px(Q.set(x - cf * 5, route.alt, z + sf * 5).project(camera), w, h);
      let Fx = fx - sx, Fy = fy - sy, Rx = rx - sx, Ry = ry - sy;
      // Same size on screen at any zoom: ~43 px of wingspan on a 1080 px tall view.
      const span = THREE.MathUtils.clamp(h * 0.04, 30, 52) * DEV_SCALE();
      const s = span / Math.max(1e-3, Math.hypot(Rx, Ry), Math.hypot(Fx, Fy)) / 60;
      const lean = Math.cos(bank);
      (Rx *= s * lean), (Ry *= s * lean), (Fx *= -s), (Fy *= -s); // image y runs nose → tail
      const bob = REDUCED_MOTION ? 0 : Math.sin(t * 1.1) * 1.2;
      const half = SPRITE / 2;
      const m = (cx: number, cy: number) => `matrix(${Rx},${Ry},${Fx},${Fy},${cx - (Rx + Fx) * half},${cy - (Ry + Fy) * half})`;
      els.plane.style.transform = m(sx, sy + bob);
      const [hx, hy] = px(Q.set(x, SEA, z).project(camera), w, h);
      els.shadow.style.transform = m(hx, hy);
    };
  }, [route, camera, get, els]);

  // Follow every redraw of the island (the view moved), and fly between them on a loop of its own.
  useFrame(() => place(performance.now() / 1000));
  useEffect(() => {
    if (REDUCED_MOTION) return;
    let raf = 0, last = 0;
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      if (document.hidden || (MOBILE && now - last < 32)) return;
      last = now;
      place(now / 1000);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [place]);
  return null;
}
