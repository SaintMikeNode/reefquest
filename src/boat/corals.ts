import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash } from "./zone";

// Stylized Caribbean reef life, placed by the Allen Coral Atlas habitat class and depth of each
// 5 m cell. Shapes follow the growth forms a diver learns to recognize (brain domes, star-coral
// mounds, elkhorn paddles, staghorn antlers, pillar columns, sea fans, sea rods, barrel / tube /
// vase sponges, turtle grass); the mix per habitat is illustrative, not a survey (the HUD says so).
// Each species is one InstancedMesh: a low-poly shape with a per-vertex shade (dark base → light
// tips) times a per-instance color, plus a small surface pattern in the fragment shader.

export const SPECIES = ["brain", "star", "elkhorn", "staghorn", "pillar", "fan", "rod", "barrel", "tube", "vase", "grass"] as const;
export type Species = (typeof SPECIES)[number];

// Stylized but grounded colors: warm golds and tans for stony corals (their symbiotic algae), purples
// and yellows for sea fans, saturated sponges. Water absorbs reds with depth, so these start warm.
export const PALETTE: Record<Species, string[]> = {
  brain: ["#e2b45e", "#d79c58", "#cfc06a", "#e6a86e", "#b9b768"],
  star: ["#d1a15a", "#c4a752", "#b9b45e", "#dd9d63", "#c98f52"],
  elkhorn: ["#eeb062", "#e49c4e", "#f2c178"],
  staghorn: ["#f0c58c", "#e6b37a", "#f6d3a2"],
  pillar: ["#ead8a8", "#dfc690", "#f1e1b9"],
  fan: ["#b56be6", "#c987f0", "#f0c24a", "#a45ad8"],
  rod: ["#9a62b4", "#c07a5c", "#8455a6", "#d39a6a"],
  barrel: ["#c85a3e", "#b84c38", "#d66a4c"],
  tube: ["#a066ec", "#f4b636", "#f27a3e", "#7f8cf0"],
  vase: ["#a9b6ff", "#c3abff", "#9cc4ff"],
  grass: ["#5f9a3c", "#6fa844", "#4f8a34"],
};

/** Instance budget per species (scaled down in lite mode). */
export const CAP: Record<Species, number> = {
  brain: 600, star: 700, elkhorn: 400, staghorn: 500, pillar: 100, fan: 700, rod: 700, barrel: 240, tube: 450, vase: 240, grass: 2400,
};

/** Size range (m) per species: [min, extra]. */
export const SIZE: Record<Species, [number, number]> = {
  brain: [0.5, 1.3], star: [0.7, 1.8], elkhorn: [0.9, 1.4], staghorn: [0.6, 0.9], pillar: [0.8, 1.0], fan: [0.5, 0.8],
  rod: [0.6, 0.8], barrel: [0.6, 1.1], tube: [0.5, 0.7], vase: [0.4, 0.5], grass: [0.5, 0.5],
};

// ---------- Geometry helpers ----------

/** Smooth normals (shared vertices welded first), then non-indexed so parts can be merged. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute("uv");
  if (g.attributes.color && g.attributes.normal) return g.index ? g.toNonIndexed() : g; // already prepared
  g.deleteAttribute("normal");
  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  return welded.index ? welded.toNonIndexed() : welded;
}

/** Writes a grayscale vertex color from a function of the (final) vertex position. */
function shade(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, i: number) => number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = f(p.getX(i), p.getY(i), p.getZ(i), i);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts.map(clean))!;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A tapered cylinder from `a` along `dir` (unit) for `len`, with a per-vertex shade from t0 to t1. */
function limb(a: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, r1: number, seg: number, t0: number, t1: number, flatten = 1) {
  // Thin limbs are open-ended (their tips are too small to see); flattened paddles keep their caps.
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, flatten === 1);
  if (flatten !== 1) g.scale(flatten, 1, 0.45);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  const c = clean(g);
  const p = c.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(a);
    const t = Math.min(1, Math.max(0, v.dot(dir) / len));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t0 + (t1 - t0) * t;
  }
  c.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return c;
}

/** Lathe from a profile of [radius, height] (outside going up, then back down the inside), with optional ribs. */
function lathe(profile: [number, number][], seg: number, ribs = 0, ribAmp = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  if (ribs) {
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const k = 1 + ribAmp * Math.cos(Math.atan2(z, x) * ribs);
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
  }
  const top = Math.max(...profile.map((q) => q[1]));
  // Inside points sit well inward of the outside wall at the same height: shade them dark.
  return shade(clean(g), (x, y, z) => (Math.hypot(x, z) < profileRadius(profile, y) * 0.86 ? 0.42 : 0.6 + 0.5 * Math.min(1, y / top)));
}

function profileRadius(profile: [number, number][], y: number) {
  let best = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i], [r1, y1] = profile[i + 1];
    if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) best = Math.max(best, r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1));
  }
  return best || 1;
}

// ---------- Species shapes (about 1 m across, base at y = 0) ----------

function brain() {
  const g = new THREE.IcosahedronGeometry(0.5, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = 1 + 0.05 * Math.sin(x * 9 + z * 5) * Math.cos(z * 7 - y * 4);
    p.setXYZ(i, x * s, Math.max(y, -0.08) * 0.78 * s + 0.06, z * s);
  }
  return shade(clean(g), (_x, y) => 0.62 + 0.7 * Math.max(0, y));
}

function star() {
  const parts: THREE.BufferGeometry[] = [];
  const lobes = [
    [0, 0, 0, 0.52],
    [0.42, 0, 0.1, 0.36],
    [-0.3, 0, 0.32, 0.4],
    [-0.1, 0.05, -0.4, 0.34],
  ];
  for (const [x, y, z, r] of lobes) {
    const s = new THREE.IcosahedronGeometry(r, 1);
    s.scale(1, 0.82, 1);
    s.translate(x, y + r * 0.55, z);
    parts.push(s);
  }
  return shade(merge(parts), (_x, y) => 0.58 + 0.55 * Math.min(1, y / 0.8));
}

function elkhorn() {
  const parts: THREE.BufferGeometry[] = [];
  const base = new THREE.Vector3(0, 0, 0);
  parts.push(limb(base, new THREE.Vector3(0, 1, 0), 0.32, 0.17, 0.13, 6, 0.5, 0.7));
  const top = new THREE.Vector3(0, 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const ang = i * 1.26 + hash(i * 7) * 0.5;
    const tilt = 0.75 + hash(i * 3) * 0.45; // from vertical: broad, spreading paddles
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(ang), Math.cos(tilt), Math.sin(tilt) * Math.sin(ang));
    const len = 0.6 + hash(i * 11) * 0.35;
    parts.push(limb(top, dir, len, 0.13, 0.06, 6, 0.7, 1.25, 2.6));
    // A fork near the end, angled up and out.
    const mid = top.clone().addScaledVector(dir, len * 0.62);
    const d2 = dir.clone().applyAxisAngle(UP, 0.55 * (i % 2 ? 1 : -1)).add(new THREE.Vector3(0, 0.25, 0)).normalize();
    parts.push(limb(mid, d2, len * 0.5, 0.08, 0.04, 6, 0.95, 1.3, 2.2));
  }
  return merge(parts);
}

function staghorn() {
  const parts: THREE.BufferGeometry[] = [];
  const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number, s: number) => {
    const tip = depth === 0;
    parts.push(limb(a, dir, len, r, r * (tip ? 0.55 : 0.75), 5, 0.62 + (2 - depth) * 0.18, tip ? 1.45 : 0.62 + (3 - depth) * 0.18));
    if (depth === 0) return;
    const end = a.clone().addScaledVector(dir, len);
    const n = depth === 2 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const yaw = (k / n) * Math.PI * 2 + hash(s * 13 + k) * 1.2;
      const spread = 0.35 + hash(s * 7 + k) * 0.35;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), spread).normalize();
      grow(end, d, len * (0.72 + hash(s + k) * 0.2), r * 0.72, depth - 1, s * 3 + k + 1);
    }
  };
  for (let i = 0; i < 2; i++) {
    const ang = i * 3.3 + 0.4;
    grow(new THREE.Vector3(Math.cos(ang) * 0.08, 0, Math.sin(ang) * 0.08), new THREE.Vector3(Math.cos(ang) * 0.35, 1, Math.sin(ang) * 0.35).normalize(), 0.34, 0.075, 2, i + 1);
  }
  return merge(parts);
}

function pillar() {
  const parts: THREE.BufferGeometry[] = [];
  const cols = [
    [0, 0, 0.19, 1.7],
    [0.34, 0.1, 0.15, 1.15],
    [-0.28, 0.22, 0.16, 1.4],
    [0.05, -0.36, 0.14, 0.9],
    [-0.3, -0.25, 0.13, 0.7],
  ];
  for (const [x, z, r, h] of cols) {
    const c = new THREE.CylinderGeometry(r * 0.92, r, h, 9, 4, true);
    c.translate(0, h / 2, 0);
    const cap = new THREE.SphereGeometry(r * 0.92, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(0, h, 0);
    for (const part of [c, cap]) {
      // Gently wavy columns (displaced before normals are computed, so they stay smooth).
      const p = part.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const k = 1 + 0.07 * Math.sin(py * 9 + x * 20) * Math.cos(Math.atan2(pz, px) * 3 + z * 9);
        p.setXYZ(i, px * k + x, py, pz * k + z);
      }
      parts.push(part);
    }
  }
  return shade(merge(parts), (_x, y) => 0.6 + 0.35 * Math.min(1, y / 1.7));
}

function fan() {
  // A flat blade (lattice cut out in the shader) on a short stalk, facing the current.
  const blade = new THREE.PlaneGeometry(1.4, 1.15, 7, 6);
  blade.translate(0, 0.72, 0);
  const stalk = new THREE.CylinderGeometry(0.025, 0.04, 0.2, 4);
  stalk.translate(0, 0.1, 0);
  return shade(merge([blade, stalk]), (_x, y) => 0.75 + 0.35 * Math.min(1, y / 1.2));
}

function rod() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = i * 1.05 + hash(i * 5) * 0.4;
    const lean = 0.12 + hash(i * 9) * 0.32;
    const dir = new THREE.Vector3(Math.sin(lean) * Math.cos(ang), Math.cos(lean), Math.sin(lean) * Math.sin(ang));
    const len = 0.5 + hash(i * 13) * 0.35;
    const a = new THREE.Vector3(Math.cos(ang) * 0.05, 0, Math.sin(ang) * 0.05);
    parts.push(limb(a, dir, len, 0.035, 0.028, 4, 0.6, 0.95));
    const end = a.clone().addScaledVector(dir, len);
    for (const s of [-1, 1]) {
      const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)), 0.32 * s).normalize();
      parts.push(limb(end, d2, len * 0.75, 0.026, 0.016, 4, 0.95, 1.25));
    }
  }
  return merge(parts);
}

function barrel() {
  const prof: [number, number][] = [
    [0.3, 0], [0.42, 0.18], [0.52, 0.55], [0.58, 0.92], [0.6, 1.02], [0.52, 1.05], [0.47, 0.95], [0.4, 0.6], [0.24, 0.3], [0.02, 0.22],
  ];
  return lathe(prof, 14, 14, 0.06);
}

function tube() {
  const parts: THREE.BufferGeometry[] = [];
  const tubes = [
    [0, 0, 1.0], [0.2, 0.06, 0.75], [-0.14, 0.17, 0.85], [0.04, -0.2, 0.6],
  ];
  for (const [x, z, h] of tubes) {
    const t = lathe([[0.085, 0], [0.105, h], [0.08, h * 1.005], [0.06, h * 0.55], [0.02, h * 0.12]], 8);
    t.translate(x, 0, z);
    parts.push(t);
  }
  return mergeGeometries(parts)!;
}

function vase() {
  return lathe([[0.07, 0], [0.13, 0.22], [0.27, 0.55], [0.4, 0.78], [0.42, 0.82], [0.37, 0.8], [0.24, 0.56], [0.1, 0.28], [0.02, 0.2]], 12, 6, 0.08);
}

function grass() {
  const parts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 9; b++) {
    const g = new THREE.PlaneGeometry(0.06, 1, 1, 4);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.5;
      p.setXYZ(i, p.getX(i), y, y * y * 0.22);
    }
    g.scale(1, 0.55 + hash(b * 3) * 0.6, 1);
    g.rotateY(b * 0.7 + hash(b) * 0.8);
    g.translate((hash(b + 3) - 0.5) * 0.35, 0, (hash(b + 9) - 0.5) * 0.35);
    parts.push(g);
  }
  return shade(merge(parts), (_x, y) => 0.5 + 0.7 * Math.min(1, y / 1.1));
}

export function speciesGeometries(): Record<Species, THREE.BufferGeometry> {
  return { brain: brain(), star: star(), elkhorn: elkhorn(), staghorn: staghorn(), pillar: pillar(), fan: fan(), rod: rod(), barrel: barrel(), tube: tube(), vase: vase(), grass: grass() };
}

// ---------- Materials ----------

const NOISE = /* glsl */ `
  float rqH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float rqN(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(rqH(i), rqH(i + vec3(1,0,0)), f.x), mix(rqH(i + vec3(0,1,0)), rqH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(rqH(i + vec3(0,0,1)), rqH(i + vec3(1,0,1)), f.x), mix(rqH(i + vec3(0,1,1)), rqH(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;

/** Surface pattern per species (multiplies the diffuse color; may discard for the fan lattice). */
const PATTERN: Partial<Record<Species, string>> = {
  // Meandering valleys of a brain coral.
  brain: `float m = rqN(vLocal * 7.0) * 0.6 + rqN(vLocal * 14.0) * 0.4;
          float v = abs(fract(m * 6.0) - 0.5) * 2.0;
          diffuseColor.rgb *= mix(0.5, 1.12, smoothstep(0.08, 0.5, v));`,
  // Star coral: a dense field of polyp cups.
  star: `vec3 c = fract(vLocal * 16.0) - 0.5; float d = length(c);
         diffuseColor.rgb *= 1.0 - 0.32 * smoothstep(0.32, 0.18, d) + 0.12 * smoothstep(0.42, 0.34, d);`,
  // Pillar coral: fuzzy extended polyps.
  pillar: `diffuseColor.rgb *= 0.86 + 0.32 * rqN(vLocal * 38.0);`,
  // Elkhorn / staghorn: fine corallites.
  elkhorn: `diffuseColor.rgb *= 0.9 + 0.2 * rqN(vLocal * 30.0);`,
  staghorn: `diffuseColor.rgb *= 0.9 + 0.2 * rqN(vLocal * 34.0);`,
  // Sea fan: a lattice of fine branches inside an oval outline.
  fan: `if (vLocal.y > 0.2) {
          vec2 q = vec2(vLocal.x / 0.7, (vLocal.y - 0.72) / 0.56);
          float edge = dot(q, q);
          if (edge > 1.0 - 0.18 * rqN(vLocal * 5.0)) discard;
          // Main veins radiate from the holdfast; a finer mesh joins them.
          float ang = atan(vLocal.x, vLocal.y - 0.12);
          float vein = smoothstep(0.0, 0.03, abs(fract(ang * 4.5 + rqN(vLocal * 3.0) * 0.6) - 0.5) - 0.43);
          vec2 g = vLocal.xy * vec2(13.0, 11.0) + vec2(sin(vLocal.y * 7.0), sin(vLocal.x * 6.0)) * 0.8;
          float net = max(smoothstep(0.0, 0.04, abs(fract(g.x) - 0.5) - 0.38), smoothstep(0.0, 0.04, abs(fract(g.y) - 0.5) - 0.38));
          if (max(vein, net) < 0.5 && edge < 0.88) discard;
          diffuseColor.rgb *= 0.9 + 0.35 * vein;
        }`,
  // Sponges: pitted surface; inside of the tube darker.
  barrel: `diffuseColor.rgb *= (gl_FrontFacing ? 1.0 : 0.45) * (0.85 + 0.25 * rqN(vLocal * 22.0));`,
  tube: `diffuseColor.rgb *= (gl_FrontFacing ? 1.0 : 0.4) * (0.9 + 0.2 * rqN(vLocal * 30.0));`,
  vase: `diffuseColor.rgb *= (gl_FrontFacing ? 1.0 : 0.5) * (0.88 + 0.22 * rqN(vLocal * 26.0));`,
};

/** Bleaching (0..1) of the reef around the boat on the selected date, set from the 5 km heat cell. */
export const BLEACH = { value: 0 };
/** How strongly each species shows bleaching: branching and pillar corals first, stony mounds next,
 *  soft corals less; sponges and seagrass have no algae partners to lose (they don't bleach this way). */
const BLEACH_SENS: Record<Species, number> = {
  staghorn: 1, elkhorn: 1, pillar: 1, brain: 0.9, star: 0.85, fan: 0.35, rod: 0.3, barrel: 0, tube: 0, vase: 0, grass: 0,
};

/** Species that sway in the surge (bend grows with height). */
const SWAY: Partial<Record<Species, number>> = { fan: 0.07, rod: 0.09, grass: 0.16 };

export function speciesMaterial(sp: Species, time: { value: number }): THREE.MeshStandardMaterial {
  const twoSided = sp === "fan" || sp === "grass" || sp === "barrel" || sp === "tube" || sp === "vase";
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: sp === "grass" ? 0.8 : 0.92, metalness: 0, side: twoSided ? THREE.DoubleSide : THREE.FrontSide });
  const pattern = PATTERN[sp] ?? "";
  const sway = SWAY[sp] ?? 0;
  const sens = BLEACH_SENS[sp];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.uniforms.uBleach = BLEACH;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vLocal;\nvarying vec3 vInst;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLocal = position;
        vInst = instanceMatrix[3].xyz;
        ${sway ? `{ float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          float b = position.y * position.y;
          transformed.x += sin(uTime * 1.25 + ph) * ${sway.toFixed(3)} * b;
          transformed.z += cos(uTime * 0.9 + ph * 1.3) * ${(sway * 0.6).toFixed(3)} * b; }` : ""}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vLocal;\nvarying vec3 vInst;\nuniform float uBleach;\n${NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\n${pattern}
        ${sens > 0 ? `{ float b = uBleach * ${sens.toFixed(2)} * (0.7 + 0.3 * rqN(vLocal * 4.0 + vInst * 0.37));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.96, 0.92), clamp(b, 0.0, 1.0)); }` : ""}`,
      )
      // A little self-light keeps colors alive in the blue-green water (a stylization, like fill light).
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.16;");
  };
  m.customProgramCacheKey = () => `rq-${sp}`;
  return m;
}

// ---------- Placement ----------

/** Reef cells: flat array of x, seafloor height, z, seed, habitat class (stride 5). */
export function reefCells(z: { sizeX: number; sizeZ: number; habW: number; habH: number; habitat: ArrayLike<number>; w: number; h: number; heights: ArrayLike<number> }): Float32Array {
  const out: number[] = [];
  const cell = z.sizeX / z.habW;
  for (let j = 0; j < z.habH; j++)
    for (let i = 0; i < z.habW; i++) {
      const k = j * z.habW + i;
      const cls = z.habitat[k * 4];
      if (cls < 12 || cls > 18 || cls === 16 || cls === 17) continue;
      const hi = Math.min(z.w - 1, Math.floor(((i + 0.5) / z.habW) * z.w));
      const hj = Math.min(z.h - 1, Math.floor(((j + 0.5) / z.habH) * z.h));
      const h = z.heights[hj * z.w + hi];
      if (h > -0.7 || h < -30) continue;
      out.push((i + 0.5) * cell - z.sizeX / 2, h, (j + 0.5) * cell - z.sizeZ / 2, hash(k), cls);
    }
  return new Float32Array(out);
}

type Mix = [Species, number][];
// Species mix by habitat and depth (weights). Illustrative ecology: elkhorn on shallow reef crests,
// staghorn and star/brain corals on the fore reef, sponges and gorgonians deeper and on hard bottom.
function mixFor(cls: number, depth: number): Mix {
  if (cls === 15) {
    if (depth < 4) return [["elkhorn", 26], ["brain", 18], ["star", 12], ["fan", 16], ["rod", 14], ["tube", 5], ["pillar", 2]];
    if (depth < 12) return [["staghorn", 16], ["brain", 16], ["star", 22], ["pillar", 4], ["fan", 12], ["rod", 13], ["barrel", 5], ["tube", 7], ["vase", 5]];
    return [["star", 24], ["brain", 10], ["staghorn", 3], ["fan", 14], ["rod", 14], ["barrel", 14], ["tube", 11], ["vase", 10]];
  }
  if (cls === 13) return [["fan", 24], ["rod", 30], ["tube", 14], ["brain", 8], ["star", 10], ["barrel", 8], ["vase", 6]];
  if (cls === 14) return [["grass", 100]];
  if (cls === 12) return [["rod", 40], ["tube", 25], ["star", 15], ["fan", 20]];
  return [["grass", 60], ["rod", 40]]; // microalgal mats: sparse
}

function pick(mix: Mix, r: number): Species {
  const total = mix.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [sp, w] of mix) {
    acc += w / total;
    if (r < acc) return sp;
  }
  return mix[mix.length - 1][0];
}

/** How many props a cell gets at distance `d` from the focus (dense near, sparse far). */
function countFor(cls: number, d: number, dense: number, seed: number): number {
  const base = cls === 15 ? 5 : cls === 14 ? 6 : cls === 13 ? 3 : 1.2;
  const far = cls === 15 ? 0.55 : cls === 14 ? 0.35 : cls === 13 ? 0.18 : 0.06;
  const t = Math.min(1, Math.max(0, (d - dense) / (dense * 1.6)));
  const n = base * (1 - t) + far * t;
  return Math.floor(n) + (seed < n - Math.floor(n) ? 1 : 0);
}

export interface Placement {
  d2: number;
  sp: Species;
  x: number;
  h: number;
  z: number;
  seed: number;
}

/** Props around (fx, fz): many per 5 m reef cell within `dense` m, then thinning out to `radius`. */
export function placeAround(cells: Float32Array, fx: number, fz: number, radius: number, dense: number, visit: (p: Placement) => void) {
  const r2 = radius * radius;
  for (let i = 0; i < cells.length; i += 5) {
    const dx = cells[i] - fx, dz = cells[i + 2] - fz;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    const seed = cells[i + 3], cls = cells[i + 4], h = cells[i + 1];
    const n = countFor(cls, Math.sqrt(d2), dense, seed);
    const mix = mixFor(cls, -h);
    for (let k = 0; k < n; k++) {
      const s = hash(seed * 7919 + k * 31.7);
      const sp = pick(mix, hash(s * 3571 + 0.37));
      visit({ d2, sp, x: cells[i] + (hash(s * 101) - 0.5) * 4.6, h, z: cells[i + 2] + (hash(s * 211) - 0.5) * 4.6, seed: s });
    }
  }
}
