import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MOBILE } from "../lib/device";
import { underwater } from "./props";

// A scuba diver for the dive-site missions (wildlife.tsx): built in code, in meters, swimming
// level with the head toward +z and the back (and the tank) up. One merged mesh of ~500 triangles
// painted with vertex colors: black wetsuit and hood, a yellow tank, a mask, colored fins. The fins
// flutter-kick in the vertex shader, so a group of divers is one draw call with no work per frame
// beyond placing them.

const A = new THREE.Vector3(), B = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();
const COL = new THREE.Color();

/** A part with position only (merged parts must carry the same attributes) and one color. */
function paint(g: THREE.BufferGeometry, hex: string) {
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const flat = g.index ? g.toNonIndexed() : g;
  COL.set(hex);
  const n = flat.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([COL.r, COL.g, COL.b], i * 3);
  flat.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return flat;
}
/** A tapered tube from a to b. */
function tube(a: number[], b: number[], r0: number, r1: number, seg: number, hex: string) {
  A.fromArray(a);
  B.fromArray(b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  Q.setFromUnitVectors(Y, B.clone().sub(A).normalize());
  g.applyQuaternion(Q);
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return paint(g, hex);
}
/** An ellipsoid at (x, y, z) with radii (rx, ry, rz). */
function blob(x: number, y: number, z: number, rx: number, ry: number, rz: number, w: number, h: number, hex: string) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return paint(g, hex);
}
/** A flat fin from the ankle back, a little wider at the tip, both faces. */
function finBlade(x: number, hex: string) {
  const g = new THREE.BufferGeometry();
  // ankle (z −0.86) to tip (z −1.42), tilted a little down like a relaxed kick.
  const p = [x - 0.05, -0.02, -0.86, x + 0.05, -0.02, -0.86, x + 0.11, -0.09, -1.42, x - 0.05, -0.02, -0.86, x + 0.11, -0.09, -1.42, x - 0.11, -0.09, -1.42];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return paint(g, hex);
}

/** One diver, 1.85 m from the mask to the fin tips. The wetsuit, fins and tank vary from group to
 *  group; the jacket (BCD) is black. Colors are a little brighter than life so a diver reads in
 *  blue water at 15 m. */
export function diverGeometry(suit: string, fins: string, tank: string) {
  const bcd = "#20262f", gear = "#2a3442";
  const parts = [
    blob(0, 0, 0.18, 0.21, 0.13, 0.33, 10, 7, bcd), // torso in the BCD
    blob(0, -0.07, 0.2, 0.17, 0.08, 0.28, 8, 5, suit), // chest and belly in the wetsuit
    blob(0, 0.005, 0.6, 0.1, 0.105, 0.115, 8, 6, suit), // head in its hood
    blob(0, -0.03, 0.705, 0.075, 0.04, 0.025, 6, 4, "#bfe6ff"), // mask glass
    blob(0, -0.03, 0.69, 0.085, 0.05, 0.03, 6, 4, gear), // mask frame
    tube([0, 0.17, -0.1], [0, 0.17, 0.46], 0.085, 0.085, 10, tank), // tank on the back
    tube([0, 0.17, 0.46], [0, 0.17, 0.52], 0.03, 0.03, 6, "#9aa5ae"), // valve
    tube([0.05, 0.16, 0.5], [0.045, -0.07, 0.68], 0.014, 0.014, 4, gear), // regulator hose
    // Arms folded in front, as calm divers swim.
    tube([0.19, 0.02, 0.36], [0.17, -0.1, 0.18], 0.05, 0.045, 6, suit),
    tube([0.17, -0.1, 0.18], [0.02, -0.13, 0.24], 0.045, 0.04, 6, suit),
    tube([-0.19, 0.02, 0.36], [-0.17, -0.1, 0.18], 0.05, 0.045, 6, suit),
    tube([-0.17, -0.1, 0.18], [-0.02, -0.13, 0.24], 0.045, 0.04, 6, suit),
    // Legs, slightly apart, and fins.
    tube([0.09, 0, -0.12], [0.1, -0.02, -0.5], 0.085, 0.07, 7, suit),
    tube([0.1, -0.02, -0.5], [0.08, -0.02, -0.86], 0.065, 0.05, 7, suit),
    tube([-0.09, 0, -0.12], [-0.1, -0.02, -0.5], 0.085, 0.07, 7, suit),
    tube([-0.1, -0.02, -0.5], [-0.08, -0.02, -0.86], 0.065, 0.05, 7, suit),
    finBlade(0.08, fins),
    finBlade(-0.08, fins),
  ];
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** Lit, water-tinted material for divers: each leg kicks up and down from the hip, the two out of
 *  step (a flutter kick), each diver at its own pace. */
export function diverMaterial(time: { value: number }) {
  const mat = MOBILE
    ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float ph = 0.0;
      #ifdef USE_INSTANCING
        ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.6;
      #endif
      // From the hip back the leg swings; the fin tip the most.
      float leg = 1.0 - smoothstep(-1.42, -0.12, position.z);
      transformed.y += sin(uTime * 2.6 + ph + (position.x > 0.0 ? 0.0 : 3.1416)) * 0.13 * leg * leg;`,
    );
  };
  mat.customProgramCacheKey = () => "rq-diver";
  return underwater(mat);
}
