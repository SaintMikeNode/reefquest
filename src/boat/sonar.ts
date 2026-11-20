import * as THREE from "three";
import { floorY, heightAtXZ, type Zone } from "./zone";

// Multibeam survey: as the boat moves, its sonar swath "maps" the seafloor. A wide-swath shallow-water
// multibeam (~150° fan) covers up to ~3.5 × depth on each side, so deeper water gives a wider swath. Coverage is
// kept at 20 m resolution, shown on the seafloor as a bathymetry overlay, and saved per zone.

export const COV_CELL = 20; // m

export interface Coverage {
  w: number;
  h: number;
  data: Uint8Array; // 255 = surveyed
  tex: THREE.DataTexture;
  surveyable: Uint8Array; // 1 = water 0.5–40 m deep (the shelf we care about)
  totalSurveyable: number;
  covered: number;
  dirty: boolean;
}

const KEY = (zone: string) => `rq-survey-${zone}`;

export function makeCoverage(z: Zone): Coverage {
  const w = Math.ceil(z.sizeX / COV_CELL), h = Math.ceil(z.sizeZ / COV_CELL);
  const data = new Uint8Array(w * h);
  const surveyable = new Uint8Array(w * h);
  let total = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * COV_CELL - z.sizeX / 2, zz = (j + 0.5) * COV_CELL - z.sizeZ / 2;
      const d = -heightAtXZ(z, x, zz);
      if (d > 0.5 && d < 40) {
        surveyable[j * w + i] = 1;
        total++;
      }
    }
  // Restore a saved survey (bitset, base64).
  let covered = 0;
  try {
    const saved = localStorage.getItem(KEY(z.meta.id));
    if (saved) {
      const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
      for (let k = 0; k < w * h; k++)
        if (bytes[k >> 3] & (1 << (k & 7))) {
          data[k] = 255;
          if (surveyable[k]) covered++;
        }
    }
  } catch {
    /* storage blocked or corrupt */
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { w, h, data, tex, surveyable, totalSurveyable: total, covered, dirty: false };
}

export function saveCoverage(zoneId: string, c: Coverage) {
  try {
    const bytes = new Uint8Array(Math.ceil((c.w * c.h) / 8));
    for (let k = 0; k < c.w * c.h; k++) if (c.data[k]) bytes[k >> 3] |= 1 << (k & 7);
    let s = "";
    for (let i = 0; i < bytes.length; i += 4096) s += String.fromCharCode(...bytes.subarray(i, i + 4096));
    localStorage.setItem(KEY(zoneId), btoa(s));
  } catch {
    /* storage blocked or full */
  }
}

export function resetCoverage(zoneId: string, c: Coverage) {
  c.data.fill(0);
  c.covered = 0;
  c.tex.needsUpdate = true;
  try {
    localStorage.removeItem(KEY(zoneId));
  } catch {
    /* ignore */
  }
}

export const swathHalfWidth = (depth: number) => Math.min(160, Math.max(25, depth * 3.5));

/** Mark the swath line across the boat's track as surveyed. */
export function stamp(c: Coverage, z: Zone, x: number, zz: number, heading: number, depth: number) {
  if (depth < 0.5) return;
  const hw = swathHalfWidth(depth);
  const px = Math.cos(heading), pz = -Math.sin(heading); // perpendicular to the track (track dir = sin, cos)
  for (let t = -hw; t <= hw; t += COV_CELL * 0.5) {
    for (const along of [-COV_CELL * 0.5, 0, COV_CELL * 0.5]) {
      const sx = x + px * t + Math.sin(heading) * along, sz = zz + pz * t + Math.cos(heading) * along;
      const i = Math.floor((sx + z.sizeX / 2) / COV_CELL), j = Math.floor((sz + z.sizeZ / 2) / COV_CELL);
      if (i < 0 || j < 0 || i >= c.w || j >= c.h) continue;
      const k = j * c.w + i;
      if (!c.data[k]) {
        c.data[k] = 255;
        if (c.surveyable[k]) c.covered++;
        c.dirty = true;
      }
    }
  }
}

/** The sonar fan: a triangle fan from the hull to the seafloor across the swath, with pings. */
export class SonarFan {
  N = 18;
  mesh: THREE.Mesh;
  private pos: Float32Array;
  private dist: Float32Array;
  mat: THREE.ShaderMaterial;
  constructor() {
    this.pos = new Float32Array((this.N + 1) * 3);
    this.dist = new Float32Array(this.N + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(this.dist, 1));
    const idx: number[] = [];
    for (let i = 1; i < this.N; i++) idx.push(0, i, i + 1);
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute float aDist; varying float vD; void main(){ vD = aDist; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; varying float vD;
        void main(){
          float ping = smoothstep(0.0, 0.08, fract(vD - uTime * 1.4)) * (1.0 - smoothstep(0.08, 0.16, fract(vD - uTime * 1.4)));
          float a = 0.025 + 0.05 * (1.0 - vD) + ping * 0.28;
          gl_FragColor = vec4(vec3(0.37, 0.85, 0.9) * a, a);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
  update(z: Zone, x: number, zz: number, heading: number, depth: number, time: number, visible: boolean) {
    this.mesh.visible = visible && depth > 0.5;
    if (!this.mesh.visible) return;
    this.mat.uniforms.uTime.value = time;
    const hw = swathHalfWidth(depth);
    const px = Math.cos(heading), pz = -Math.sin(heading);
    this.pos.set([x, -0.6, zz], 0);
    this.dist[0] = 0;
    for (let i = 0; i < this.N; i++) {
      const t = -hw + (2 * hw * i) / (this.N - 1);
      const sx = x + px * t, sz = zz + pz * t;
      const fy = floorY(heightAtXZ(z, sx, sz)) + 0.15;
      this.pos.set([sx, Math.min(fy, -0.6), sz], (i + 1) * 3);
      this.dist[i + 1] = 1;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.aDist.needsUpdate = true;
  }
}
