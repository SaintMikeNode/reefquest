import * as THREE from "three";
import { MOBILE } from "../lib/device";
import { underwater } from "./props";

// Rays for the Stingray Point mission (wildlife.tsx), built in code, 1 unit across the wings, nose
// toward +z, back up. A stingray is a rounded diamond, slightly domed, with a thin tail; its margins
// ripple in a wave running back along the body. A spotted eagle ray has long pointed wings it flaps
// slowly, a short snout and a very long tail, dark on top with white spots. One draw call per kind;
// all the motion is in the vertex shader. The sources don't name the stingray species: shapes and
// colors are illustrative.

export type RayKind = "stingray" | "eagle";

/** The outline (half width at each point along the body) and the tail, per kind. */
const SHAPE: Record<RayKind, { outline: (u: number) => number; front: number; back: number; tail: number; dome: number }> = {
  // u runs 0 (snout) → 1 (back of the disc). A diamond with blunt wing corners, widest a little
  // ahead of the middle.
  stingray: { outline: (u) => 0.5 * (u < 0.42 ? Math.pow(u / 0.42, 0.85) : Math.pow((1 - u) / 0.58, 0.75)), front: 0.46, back: -0.42, tail: 1.05, dome: 0.07 },
  // Swept, pointed wings: widest near the middle, narrowing quickly toward the back.
  eagle: { outline: (u) => 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 2.2) + 0.03 * (1 - u), front: 0.3, back: -0.26, tail: 1.9, dome: 0.05 },
};

/** A ray: the disc as rows across the body (so it can ripple), and the tail as a thin strip. The
 *  disc's triangles face up. `aEdge` is 0 on the midline, 1 at the wing tips. */
export function rayGeometry(kind: RayKind) {
  const sh = SHAPE[kind];
  const ROWS = 14, COLS = 10;
  const pos: number[] = [], edge: number[] = [];
  const grid: number[][] = [];
  for (let i = 0; i <= ROWS; i++) {
    const u = i / ROWS, z = sh.front + (sh.back - sh.front) * u, half = Math.max(0.004, sh.outline(u));
    const row: number[] = [];
    for (let j = 0; j <= COLS; j++) {
      const v = (j / COLS) * 2 - 1, x = v * half;
      const e = Math.abs(v);
      row.push(pos.length / 3);
      pos.push(x, sh.dome * (1 - e * e) * Math.sin(Math.PI * u), z);
      edge.push(e * (half / 0.5));
    }
    grid.push(row);
  }
  const idx: number[] = [];
  for (let i = 0; i < ROWS; i++)
    for (let j = 0; j < COLS; j++) {
      const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j], d = grid[i + 1][j + 1];
      idx.push(a, b, c, b, d, c);
    }
  // Tail: a thin tapering strip, two triangles.
  const t0 = pos.length / 3, w = kind === "eagle" ? 0.012 : 0.018, tz = sh.back + 0.02;
  pos.push(-w, 0.01, tz, w, 0.01, tz, 0, 0, tz - sh.tail);
  edge.push(0, 0, 0);
  idx.push(t0, t0 + 1, t0 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Lit, water-tinted material: dorsal color on top, pale belly underneath; a stingray's margins
 *  ripple, an eagle ray flaps; the tail sways. Each instance is out of step with the others. */
export function rayMaterial(time: { value: number }, kind: RayKind) {
  const mat = MOBILE
    ? new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75 });
  const top = new THREE.Color(kind === "eagle" ? "#2b3644" : "#7a6d58");
  const belly = new THREE.Color("#e9ece8");
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.uniforms.uTop = { value: top };
    sh.uniforms.uBelly = { value: belly };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nattribute float aEdge;\nvarying vec3 vObj;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vObj = position;
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.5;
        #endif
        ${
          kind === "eagle"
            ? `transformed.y += sin(uTime * 1.5 + ph) * 0.22 * pow(aEdge, 1.6);`
            : `transformed.y += sin(uTime * 3.2 + ph - position.z * 9.0) * 0.045 * aEdge * aEdge;`
        }
        float tail = 1.0 - smoothstep(-1.6, ${kind === "eagle" ? "-0.26" : "-0.42"}, position.z);
        transformed.x += sin(uTime * 2.1 + ph + position.z * 3.0) * 0.07 * tail;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTop, uBelly;\nvarying vec3 vObj;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 dorsal = uTop;
        ${
          kind === "eagle"
            ? `// White spots on the back.
               vec2 g = vObj.xz * 26.0;
               vec2 f = fract(g + vec2(0.5 * step(0.5, fract(g.y * 0.5)), 0.0)) - 0.5;
               dorsal = mix(dorsal, vec3(0.93), 1.0 - smoothstep(0.12, 0.2, length(f)));`
            : `// A slightly darker middle.
               dorsal *= 0.85 + 0.25 * smoothstep(0.05, 0.4, abs(vObj.x));`
        }
        diffuseColor.rgb = gl_FrontFacing ? dorsal : uBelly;`,
      );
  };
  mat.customProgramCacheKey = () => `rq-ray-${kind}`;
  return underwater(mat);
}
