import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Site } from "../content/sites";
import { underwater } from "./props";
import { floorY, hash } from "./zone";
import type { ZonePlace } from "./places";

// Shipwrecks on the seafloor of the boat mode: a stylized small freighter (hull, deck, deckhouse
// aft, cargo hatches, masts), rusted and overgrown, built in code. Length, depth and how it lies
// come from the place's story (content/sites.ts); the shape is illustrative.
// Budget: one mesh and about 400 triangles per wreck, one unlit material (its shading is baked
// into the vertex colors), drawn only near the boat.

const BEAM = 0.078; // half the beam, as a share of the length
const DEPTH = 0.115; // keel to deck

/** Half beam and deck height at t (0 = stern, 1 = bow). */
function section(t: number): [number, number] {
  const bow = THREE.MathUtils.smoothstep(t, 0.68, 1);
  const b = BEAM * (0.82 + 0.18 * THREE.MathUtils.smoothstep(t, 0, 0.18)) * (1 - bow * bow * 0.97);
  return [b, DEPTH * (1 + 0.3 * bow)];
}

/** The hull between t0 and t1 with its deck; cut ends stay open (a broken hull shows its hold). */
function hull(t0: number, t1: number, rings: number, closeStern: boolean) {
  const pos: number[] = [];
  const ring = (t: number) => {
    const [b, d] = section(t), z = t - 0.5;
    return [
      [-b, d, z], [-b * 0.94, d * 0.3, z], [-b * 0.42, 0, z], [b * 0.42, 0, z], [b * 0.94, d * 0.3, z], [b, d, z],
    ];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...b, ...d, ...c);
  for (let i = 0; i < rings; i++) {
    const A = ring(t0 + ((t1 - t0) * i) / rings), B = ring(t0 + ((t1 - t0) * (i + 1)) / rings);
    for (let j = 0; j < 5; j++) quad(A[j], A[j + 1], B[j], B[j + 1]);
    quad(A[5], A[0], B[5], B[0]); // deck
  }
  if (closeStern) {
    const A = ring(t0);
    for (let j = 1; j < 5; j++) pos.push(...A[0], ...A[j + 1], ...A[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g.translate(x, y + h / 2, z);
  return g;
};

// Bright on purpose: 30 m down the water takes most of the red and much of the light.
const HULL = new THREE.Color("#c9744e"), DECK = new THREE.Color("#8fb3a2"), HOUSE = new THREE.Color("#e3e8d8");
const GROWTH = [new THREE.Color("#f0a35c"), new THREE.Color("#5fc7a4"), new THREE.Color("#ee7f96"), new THREE.Color("#f2d06b"), new THREE.Color("#b48be0")];
const _c = new THREE.Color();
/** Paint a part one base color, face by face, with patches of rust and growth. */
function paint(g: THREE.BufferGeometry, base: THREE.Color, seed: number) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let f = 0; f < n / 3; f++) {
    const q = f >> 1; // the two triangles of a plate share a color
    const r = hash(q * 7.13 + seed * 31.7), k = hash(q * 3.71 + seed * 11.3);
    _c.copy(base).multiplyScalar(0.82 + r * 0.36);
    if (k > 0.7) _c.lerp(GROWTH[Math.floor(hash(q + seed) * GROWTH.length) % GROWTH.length], 0.35 + 0.4 * (k - 0.7) / 0.3);
    for (let v = 0; v < 3; v++) c.set([_c.r, _c.g, _c.b], (f * 3 + v) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

/** One section of the ship (stern, midship or bow) with what stands on it, 1 unit long overall. */
function sectionParts(part: 0 | 1 | 2, t0: number, t1: number, whole: boolean): THREE.BufferGeometry[] {
  const out = [paint(hull(t0, t1, part === 2 ? 6 : 4, part === 0), HULL, part + 1)];
  // The deck quads were painted with the hull: repaint every sixth quad (the deck) in deck color.
  const col = out[0].attributes.color as THREE.BufferAttribute;
  const quads = (part === 2 ? 6 : 4) * 6;
  for (let q = 5; q < quads; q += 6)
    for (let v = 0; v < 6; v++) {
      _c.copy(DECK).multiplyScalar(0.85 + hash(q * 1.7 + part) * 0.3);
      col.setXYZ(q * 6 + v, _c.r, _c.g, _c.b);
    }
  const d = DEPTH;
  if (part === 0) {
    out.push(paint(box(BEAM * 1.6, 0.085, 0.15, 0, d, -0.36), HOUSE, 5)); // deckhouse
    if (whole) out.push(paint(box(BEAM * 1.15, 0.05, 0.085, 0, d + 0.085, -0.345), HOUSE, 6)); // wheelhouse
    const funnel = new THREE.CylinderGeometry(0.016, 0.02, 0.07, 6).toNonIndexed();
    funnel.deleteAttribute("uv");
    funnel.deleteAttribute("normal");
    funnel.translate(0, d + (whole ? 0.17 : 0.12), -0.4);
    out.push(paint(funnel, HULL, 7));
  }
  if (part === 1) {
    out.push(paint(box(BEAM * 1.25, 0.014, 0.13, 0, d, -0.13), HOUSE, 8)); // hatch coamings
    out.push(paint(box(BEAM * 1.25, 0.014, 0.13, 0, d, 0.06), HOUSE, 9));
    out.push(paint(box(0.012, whole ? 0.16 : 0.07, 0.012, 0, d, -0.035), HULL, 10)); // derrick post
    if (whole) out.push(paint(box(BEAM * 1.1, 0.008, 0.008, 0, d + 0.12, -0.035), HULL, 11));
  }
  if (part === 2) {
    out.push(paint(box(BEAM * 1.0, 0.014, 0.1, 0, d * 1.04, 0.2), HOUSE, 12)); // forward hatch
    out.push(paint(box(0.011, whole ? 0.13 : 0.05, 0.011, 0, d * 1.2, 0.33), HULL, 13)); // foremast
  }
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function wreckGeometry(pose: NonNullable<Site["wreck"]>["pose"]) {
  const move = (parts: THREE.BufferGeometry[], x: number, y: number, z: number, yaw: number, roll: number, pitch: number) => {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, "YXZ")), _s);
    for (const g of parts) g.applyMatrix4(_m);
    return parts;
  };
  let parts: THREE.BufferGeometry[];
  if (pose === "pieces")
    // Broken in three: the stern has settled over to one side, the bow has swung away.
    parts = [
      ...move(sectionParts(0, 0, 0.3, false), 0.012, -0.012, -0.03, 0.1, 0.32, 0.03),
      ...move(sectionParts(1, 0.36, 0.66, false), -0.01, -0.02, 0, -0.05, -0.12, 0),
      ...move(sectionParts(2, 0.72, 1, false), 0.05, -0.015, 0.04, 0.34, 0.2, -0.05),
    ];
  else {
    parts = [...sectionParts(0, 0, 0.34, true), ...sectionParts(1, 0.34, 0.68, true), ...sectionParts(2, 0.68, 1, true)];
    // On its side: starboard (−x with the bow toward +z) down, the keel a little off the sand.
    if (pose === "side") move(parts, 0, BEAM * 0.9, 0, 0, 1.45, 0);
  }
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  // Light from above baked into the colors, face by face: the wreck needs no lights of its own
  // (an unlit material is the cheapest there is) and keeps its shape in the dim water.
  g.computeBoundingBox();
  const mid = g.boundingBox!.getCenter(new THREE.Vector3());
  const pos = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    a.fromBufferAttribute(pos, f);
    b.fromBufferAttribute(pos, f + 1);
    c.fromBufferAttribute(pos, f + 2);
    n.subVectors(b, a).cross(_p.subVectors(c, a)).normalize();
    // Faces are wound either way: take the side that looks away from the middle of the ship.
    _p.addVectors(a, b).add(c).multiplyScalar(1 / 3);
    if (n.x * (_p.x - mid.x) + n.y * (_p.y - mid.y) < 0) n.negate();
    const shade = 0.5 + 0.55 * Math.max(0, n.x * 0.24 + n.y * 0.96 + n.z * 0.14) + 0.1 * Math.max(0, -n.x);
    for (let v = 0; v < 3; v++) col.setXYZ(f + v, col.getX(f + v) * shade, col.getY(f + v) * shade, col.getZ(f + v) * shade);
  }
  return g;
}

/** The wreck of a place, at its spot on the seafloor (see places.ts), sunk a little into the sand. */
export function buildWreck(place: ZonePlace) {
  const w = place.site.wreck!;
  const mesh = new THREE.Mesh(wreckGeometry(w.pose), underwater(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  mesh.scale.setScalar(w.length_m);
  mesh.position.set(place.x, floorY(place.floor ?? -20) - w.length_m * 0.012, place.z);
  mesh.rotation.y = place.yaw ?? 0;
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}
