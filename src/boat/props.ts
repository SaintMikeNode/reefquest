import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash, type Zone } from "./zone";

// Illustrative reef life placed by the Allen Coral Atlas habitat classes (5 m cells). Shapes and
// colors are generic, not species-accurate: the HUD says "illustrative".

export type PropKind = "boulder" | "branch" | "sponge" | "grass";

/** Candidate positions per kind: flat arrays of x, y(seafloor), z, seed. */
export interface Candidates {
  boulder: Float32Array;
  branch: Float32Array;
  sponge: Float32Array;
  grass: Float32Array;
}

export function buildCandidates(z: Zone): Candidates {
  const out: Record<PropKind, number[]> = { boulder: [], branch: [], sponge: [], grass: [] };
  const cell = z.sizeX / z.habW;
  for (let j = 0; j < z.habH; j++) {
    for (let i = 0; i < z.habW; i++) {
      const k = j * z.habW + i;
      const cls = z.habitat[k * 4];
      if (cls !== 13 && cls !== 14 && cls !== 15) continue;
      const r = hash(k);
      const x = (i + hash(k + 7) ) * cell - z.sizeX / 2;
      const zz = (j + hash(k + 13)) * cell - z.sizeZ / 2;
      // Seafloor height (nearest heightmap sample is fine here).
      const hi = Math.min(z.w - 1, Math.floor(((i + 0.5) / z.habW) * z.w));
      const hj = Math.min(z.h - 1, Math.floor(((j + 0.5) / z.habH) * z.h));
      const h = z.heights[hj * z.w + hi];
      if (h > -0.6 || h < -28) continue;
      if (cls === 15) {
        if (r < 0.32) out.boulder.push(x, h, zz, hash(k + 3));
        else if (r < 0.5) out.branch.push(x, h, zz, hash(k + 5));
      } else if (cls === 13) {
        if (r < 0.08) out.sponge.push(x, h, zz, hash(k + 9));
      } else if (r < 0.3) out.grass.push(x, h, zz, hash(k + 11));
    }
  }
  return {
    boulder: new Float32Array(out.boulder),
    branch: new Float32Array(out.branch),
    sponge: new Float32Array(out.sponge),
    grass: new Float32Array(out.grass),
  };
}

function noise3(x: number, y: number, z: number) {
  return Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - y * 2.9) * 0.5 + Math.sin(x * 7.3 - z * 5.1) * 0.15;
}

export function propGeometries(): Record<PropKind, THREE.BufferGeometry> {
  // Boulder / brain coral: lumpy flattened dome.
  const boulder = new THREE.IcosahedronGeometry(1, 2);
  const p = boulder.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = 1 + noise3(x, y, z) * 0.18;
    p.setXYZ(i, x * s, Math.max(y, -0.2) * s * 0.62, z * s);
  }
  boulder.computeVertexNormals();

  // Branching coral: a few tapered, leaning cylinders.
  const parts: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 6; b++) {
    const c = new THREE.CylinderGeometry(0.05, 0.12, 1.1, 5);
    c.translate(0, 0.55, 0);
    c.rotateZ((hash(b * 31) - 0.5) * 1.1);
    c.rotateY(b * 1.05);
    parts.push(c);
  }
  const branch = mergeGeometries(parts)!;

  // Sponges: clustered open tubes.
  const tubes: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 3; b++) {
    const hgt = 0.45 + b * 0.15;
    const t = new THREE.CylinderGeometry(0.3, 0.2, hgt, 9, 1, false);
    t.translate(Math.cos(b * 2.1) * 0.3, hgt / 2, Math.sin(b * 2.1) * 0.3);
    tubes.push(t);
  }
  const sponge = mergeGeometries(tubes)!;

  // Seagrass tuft: thin blades.
  const blades: THREE.BufferGeometry[] = [];
  for (let b = 0; b < 7; b++) {
    const g = new THREE.PlaneGeometry(0.05, 0.9, 1, 3);
    g.translate(0, 0.45, 0);
    g.rotateY(b * 0.9);
    g.rotateX((hash(b * 17) - 0.5) * 0.4);
    g.translate((hash(b) - 0.5) * 0.4, 0, (hash(b + 3) - 0.5) * 0.4);
    blades.push(g);
  }
  const grass = mergeGeometries(blades)!;
  return { boulder, branch, sponge, grass };
}

export const PALETTES: Record<PropKind, string[]> = {
  boulder: ["#c9a066", "#a8884a", "#d6a96a", "#8f9a4f", "#b07a95", "#d9b070", "#7d6bb0"],
  branch: ["#efc583", "#d9a86a", "#c98fa0", "#f0d090", "#e08a5a"],
  sponge: ["#f08a4b", "#b26ad0", "#f2c037", "#e0603c", "#8f7be0"],
  grass: ["#3f6b2e", "#4f7a35", "#5b8a3a"],
};

export const CAPS: Record<PropKind, number> = { boulder: 1400, branch: 900, sponge: 400, grass: 2600 };

/** Swaying material for seagrass (vertex shader bend by height). */
export function grassMaterial(time: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float sway = sin(uTime * 1.6 + instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2) * 0.18 * position.y;
        transformed.x += sway;`,
      );
  };
  return m;
}

/** Tint a standard material by the water column above it (same light loss as the seafloor shader). */
export function underwater<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRqY;\nvarying vec3 vRqW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vRqW = (inverse(viewMatrix) * mvPosition).xyz;\n  vRqY = vRqW.y;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRqY;\nvarying vec3 vRqW;")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        float rqD = max(-vRqY, 0.0);
        // Line-of-sight path through the water (longer at low viewing angles), like the seafloor.
        rqD = rqD / max(normalize(cameraPosition - vRqW).y, 0.08) * (11.0 / 12.0);
        vec3 rqWater = mix(vec3(0.10, 0.72, 0.74), vec3(0.02, 0.30, 0.48), smoothstep(2.0, 30.0, rqD));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, rqWater, 1.0 - exp(-rqD / 11.0));`,
      );
  };
  return m;
}
