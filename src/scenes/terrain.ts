import * as THREE from "three";
import { B, blocksOf, gridNormals, lodIndices } from "../lib/gridLod";
import type { SceneMeta } from "../lib/data";

// Scene units: 1 unit = 100 m horizontally. Vertical: relief ×4; depths beyond 40 m are compressed
// (square root) so the 4 km-deep trench next to Roatán doesn't swallow the reef. The HUD says so.
export const UNIT_M = 100;
export const VE = 4;
const SHALLOW_LIMIT = 40;

export function displayY(h: number): number {
  if (h >= 0) return (h * VE) / UNIT_M;
  const d = -h;
  const s = d <= SHALLOW_LIMIT ? d * VE : SHALLOW_LIMIT * VE + 25 * Math.sqrt(d - SHALLOW_LIMIT);
  return -s / UNIT_M;
}

export interface TerrainData {
  meta: SceneMeta;
  w: number;
  h: number;
  heights: Float32Array; // meters, row-major, row 0 = north
  habitat: Uint8ClampedArray; // RGBA of habitat.png
  habW: number;
  habH: number;
  habitatTex: THREE.Texture;
  sizeX: number; // scene units
  sizeZ: number;
  center: { x: number; z: number }; // land centroid, scene units
}

async function imageData(url: string): Promise<{ data: Uint8ClampedArray; w: number; h: number; img: ImageBitmap | HTMLImageElement }> {
  const blob = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.blob();
  });
  // colorSpaceConversion/premultiply off: the PNGs carry numbers, not colors.
  const img = "createImageBitmap" in window
    ? await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" })
    : await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = URL.createObjectURL(blob);
      });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height, img };
}

export async function loadTerrain(meta: SceneMeta, base: string): Promise<TerrainData> {
  const [t, hab] = await Promise.all([imageData(`${base}/${meta.terrain.file}`), imageData(`${base}/${meta.habitat.file}`)]);
  const heights = new Float32Array(t.w * t.h);
  for (let i = 0; i < heights.length; i++) heights[i] = (t.data[i * 4] * 256 + t.data[i * 4 + 1]) / 10 - 3000;
  const tex = new THREE.DataTexture(new Uint8Array(hab.data.buffer.slice(0)), hab.w, hab.h, THREE.RGBAFormat);
  tex.flipY = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  // Land centroid: where the camera looks first.
  let sx = 0, sz = 0, n = 0;
  for (let j = 0; j < t.h; j += 2)
    for (let i = 0; i < t.w; i += 2)
      if (heights[j * t.w + i] > 0) {
        sx += i / (t.w - 1);
        sz += j / (t.h - 1);
        n++;
      }
  const sizeX = meta.size_m[0] / UNIT_M, sizeZ = meta.size_m[1] / UNIT_M;
  const center = n ? { x: (sx / n - 0.5) * sizeX, z: (sz / n - 0.5) * sizeZ } : { x: 0, z: 0 };
  return {
    center,
    meta,
    w: t.w,
    h: t.h,
    heights,
    habitat: hab.data,
    habW: hab.w,
    habH: hab.h,
    habitatTex: tex,
    sizeX,
    sizeZ,
  };
}

/** Bilinear height (m) at uv (0..1, v = 0 at the north edge). */
export function heightAt(td: TerrainData, u: number, v: number): number {
  const x = Math.min(Math.max(u * (td.w - 1), 0), td.w - 1);
  const y = Math.min(Math.max(v * (td.h - 1), 0), td.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, td.w - 1), y1 = Math.min(y0 + 1, td.h - 1);
  const fx = x - x0, fy = y - y0;
  const H = td.heights;
  const a = H[y0 * td.w + x0], b = H[y0 * td.w + x1], c = H[y1 * td.w + x0], d = H[y1 * td.w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

export function habitatAt(td: TerrainData, u: number, v: number): { benthic: number; geomorphic: number } {
  const x = Math.min(td.habW - 1, Math.max(0, Math.floor(u * td.habW)));
  const y = Math.min(td.habH - 1, Math.max(0, Math.floor(v * td.habH)));
  const i = (y * td.habW + x) * 4;
  return { benthic: td.habitat[i], geomorphic: td.habitat[i + 1] };
}

export const uvToXZ = (td: TerrainData, u: number, v: number) => ({ x: (u - 0.5) * td.sizeX, z: (v - 0.5) * td.sizeZ });
export const xzToUV = (td: TerrainData, x: number, z: number) => ({ u: x / td.sizeX + 0.5, v: z / td.sizeZ + 0.5 });

export function lonLatToUV(td: TerrainData, lon: number, lat: number) {
  const [fu, fv] = td.meta.geo.lonlat_to_uv;
  return { u: fu[0] * lon + fu[1] * lat + fu[2], v: fv[0] * lon + fv[1] * lat + fv[2] };
}
export function uvToLonLat(td: TerrainData, u: number, v: number) {
  const [fl, fa] = td.meta.geo.uv_to_lonlat;
  return { lon: fl[0] * u + fl[1] * v + fl[2], lat: fa[0] * u + fa[1] * v + fa[2] };
}

/** Grid mesh with displaced heights. `stride` skips heightmap samples (2 = quarter the vertices). */
/**
 * Terrain mesh with level of detail: land and the reef shelf (shallower than 45 m, plus a margin)
 * use cells of `fine` grid steps; deep open water, most of the scene, uses 4-step cells.
 * Only the vertices actually used are uploaded.
 */
export function buildGeometry(td: TerrainData, fine: 1 | 2): THREE.BufferGeometry {
  const { w, h } = td;
  const bw = blocksOf(w), bh = blocksOf(h);
  const shallow = new Uint8Array(bw * bh);
  for (let bj = 0; bj < bh; bj++)
    for (let bi = 0; bi < bw; bi++) {
      const x1 = Math.min(bi * B + B, w - 1), y1 = Math.min(bj * B + B, h - 1);
      scan: for (let y = bj * B; y <= y1; y++)
        for (let x = bi * B; x <= x1; x++)
          if (td.heights[y * w + x] > -45) {
            shallow[bj * bw + bi] = 1;
            break scan;
          }
    }
  const level = (bi: number, bj: number) => {
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const x = bi + di, y = bj + dj;
        if (x >= 0 && y >= 0 && x < bw && y < bh && shallow[y * bw + x]) return fine;
      }
    return B;
  };
  const { index, count } = lodIndices(w, h, level);
  const normals = gridNormals(w, h, (k) => displayY(td.heights[k]), td.sizeX / (w - 1), td.sizeZ / (h - 1), fine);

  // Compact: keep only referenced vertices.
  const map = new Int32Array(w * h).fill(-1);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const v = index[i];
    if (map[v] < 0) map[v] = n++;
    index[i] = map[v];
  }
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), hm = new Float32Array(n), nor = new Float32Array(n * 3);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const src = j * w + i, k = map[src];
      if (k < 0) continue;
      const u = i / (w - 1), v = j / (h - 1), ht = td.heights[src];
      pos[k * 3] = (u - 0.5) * td.sizeX;
      pos[k * 3 + 1] = displayY(ht);
      pos[k * 3 + 2] = (v - 0.5) * td.sizeZ;
      uv[k * 2] = u;
      uv[k * 2 + 1] = v;
      hm[k] = ht;
      nor.set(normals.subarray(src * 3, src * 3 + 3), k * 3);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("aH", new THREE.BufferAttribute(hm, 1));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(n > 65535 ? index.slice(0, count) : Uint16Array.from(index.subarray(0, count)), 1));
  g.computeBoundingSphere();
  return g;
}

/** March a ray across the heightfield; returns the hit uv or null. */
export function pickHeightfield(td: TerrainData, ray: THREE.Ray): { u: number; v: number } | null {
  const o = ray.origin, d = ray.direction;
  const step = 0.6;
  let prev = { x: o.x, y: o.y, z: o.z };
  for (let t = 0; t < 2600; t += step) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    const { u, v } = xzToUV(td, x, z);
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      const ground = displayY(heightAt(td, u, v));
      if (y <= Math.max(ground, 0)) {
        // Refine between prev and current.
        let a = 0, b = 1;
        for (let k = 0; k < 8; k++) {
          const m = (a + b) / 2;
          const mx = prev.x + (x - prev.x) * m, my = prev.y + (y - prev.y) * m, mz = prev.z + (z - prev.z) * m;
          const q = xzToUV(td, mx, mz);
          if (my <= Math.max(displayY(heightAt(td, q.u, q.v)), 0)) b = m; else a = m;
        }
        return xzToUV(td, prev.x + (x - prev.x) * b, prev.z + (z - prev.z) * b);
      }
    } else if (y < -30) break;
    prev = { x, y, z };
  }
  return null;
}

/** Opening camera distance, scaled to the scene: portrait phones stand farther back. */
export function homeDistance(td: TerrainData): number {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const size = Math.max(td.sizeX, td.sizeZ * 1.6);
  return size * (aspect >= 1.2 ? 0.64 : aspect >= 0.8 ? 0.86 : 0.75);
}

/** Portrait screens look along the island from its western end (the islands run roughly W–E). */
export const isPortrait = () => window.innerWidth < window.innerHeight * 0.8;

/** Camera offset from the target for the opening view. */
export function homeOffset(td: TerrainData): [number, number, number] {
  const d = homeDistance(td);
  return isPortrait() ? [-d * 0.62, d * 0.62, d * 0.48] : [-d * 0.05, d * 0.68, d * 0.73];
}
