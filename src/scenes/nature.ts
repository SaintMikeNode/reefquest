import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Stylized, low-poly island vegetation shared by the island overview and the boat zones.
// Shapes are generic (coconut palms on the coast, broadleaf canopy inland), placed by elevation:
// a visual impression of the islands' green cover, not a vegetation map.

function bend(g: THREE.BufferGeometry, amount: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + amount * y * y);
  }
  return g;
}

/** Coconut palm, ~1 unit tall: leaning trunk and a crown of drooping fronds.
 *  `detail` 2 = 106 triangles (close views), 0 = 32 (phones and distant views). */
export function palmGeometry(detail: 0 | 1 | 2 = 2): THREE.BufferGeometry {
  const low = detail < 2;
  const trunk = new THREE.CylinderGeometry(0.025, 0.04, 1, low ? 3 : 5, low ? 2 : 4, low);
  trunk.translate(0, 0.5, 0);
  bend(trunk, 0.18);
  const parts: THREE.BufferGeometry[] = [trunk];
  const top = new THREE.Vector3(0.18, 1, 0);
  const fronds = low ? 5 : 7;
  for (let k = 0; k < fronds; k++) {
    // Each frond: a thin triangle strip that droops.
    const f = new THREE.BufferGeometry();
    const pts: number[] = [];
    const segs = low ? 2 : 4;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = 0.09 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      const x = t * 0.5, y = 0.12 * t - 0.42 * t * t;
      pts.push(x, y, -w, x, y, w);
    }
    const idx: number[] = [];
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    f.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    f.setIndex(idx);
    f.computeVertexNormals();
    f.rotateY((k / fronds) * Math.PI * 2 + 0.3);
    f.translate(top.x, top.y, top.z);
    parts.push(f);
  }
  // Color: trunk brown, fronds green (vertex colors).
  for (const [i, g] of parts.entries()) {
    const c = new THREE.Color(i === 0 ? "#7a5c3c" : "#3f7d3a");
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) col.set([c.r, c.g, c.b], v * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (!g.index) g.setIndex([...Array(n).keys()]);
  }
  return mergeGeometries(parts.map((g) => clean(g.toNonIndexed())))!;
}

/** Broadleaf tree / canopy clump, ~1 unit tall.
 *  `detail` 2 = trunk + 3 blobs (80 triangles), 1 = open trunk + 2 blobs (46), 0 = one blob (20). */
export function canopyGeometry(detail: 0 | 1 | 2 = 2): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = (detail === 2 ? new THREE.CylinderGeometry(0.04, 0.06, 0.4, 5) : new THREE.CylinderGeometry(0.04, 0.06, 0.4, 3, 1, true)).toNonIndexed();
  trunk.translate(0, 0.2, 0);
  if (detail > 0) parts.push(trunk);
  const blobs: [number, number, number, number][] =
    detail === 0
      ? [[0, 0.42, 0, 0.44]]
      : [
          [0, 0.62, 0, 0.36],
          [0.2, 0.52, 0.08, 0.24],
          [-0.18, 0.55, -0.1, 0.26],
        ].slice(0, detail + 1) as [number, number, number, number][];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.IcosahedronGeometry(r, 0).toNonIndexed();
    b.scale(1, 0.85, 1);
    b.translate(x, y, z);
    parts.push(b);
  }
  for (const [i, g] of parts.entries()) {
    const c = new THREE.Color(i === 0 && detail > 0 ? "#6b5136" : "#ffffff"); // part 0 is the trunk when there is one
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) col.set([c.r, c.g, c.b], v * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  return mergeGeometries(parts.map(clean))!;
}

/** Same attribute set on every part so they can be merged (position, normal, color). */
function clean(g: THREE.BufferGeometry) {
  if (g.attributes.uv) g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

export const CANOPY_GREENS = ["#2f5d2c", "#3a6b30", "#466f2e", "#2b5534", "#55793a", "#37632f"];
export const PALM_GREENS = ["#3f7d3a", "#4b8a3c", "#5a8f3a"];

/** Vegetation material: flat-shaded, vertex colors × instance colors, optional gentle sway. */
export function vegetationMaterial(time?: { value: number }, sway = 0, doubleSide = true) {
  // Lambert (diffuse only): much cheaper per pixel than a physically based material, same look here.
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
  if (time && sway > 0) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float rqSway = sin(uTime * 1.3 + instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07) * ${sway.toFixed(3)} * max(position.y - 0.6, 0.0);
          transformed.x += rqSway;
          transformed.z += rqSway * 0.6;`,
        );
    };
  }
  return m;
}

/** Deterministic hash → [0,1). */
export function h01(n: number): number {
  let x = (n ^ 0x2545f491) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0;
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
