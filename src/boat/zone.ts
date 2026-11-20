import * as THREE from "three";
import { B, blocksOf, gridNormals, lodIndices } from "../lib/gridLod";

// Detailed zone tiles for the research boat (made by pipeline/zone_tiles.py). Scene units here are
// real meters. Vertical scale is 1:1 down to 60 m; deeper water is compressed (you can't see it
// from the boat anyway), so the reef walls don't become kilometer-deep canyons.

export interface ZoneMeta {
  id: string;
  island: string;
  name: string;
  size_m: [number, number];
  cell_m: number;
  height: { file: string; width: number; height: number; min_m: number; max_m: number };
  habitat: { file: string; width: number; height: number };
  bathymetry_source: string;
  center: { lat: number; lon: number };
  geo: { lonlat_to_uv: number[][]; uv_to_lonlat: number[][] };
}

export interface ZoneIndexEntry {
  id: string;
  name: string;
  name_es?: string;
  lat: number;
  lon: number;
  size_m: [number, number];
}

export interface Zone {
  meta: ZoneMeta;
  w: number;
  h: number;
  heights: Float32Array; // meters, row 0 = north
  habitat: Uint8ClampedArray; // RGBA
  habW: number;
  habH: number;
  habitatTex: THREE.DataTexture;
  depthTex: THREE.DataTexture; // R = depth × 8 (0–32 m), for the water shader
  sizeX: number;
  sizeZ: number;
}

export const DEEP_LIMIT = 60;
export function floorY(h: number): number {
  if (h >= -DEEP_LIMIT) return h;
  return -(DEEP_LIMIT + 10 * Math.sqrt(-h - DEEP_LIMIT));
}

async function pixels(url: string) {
  const blob = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.blob();
  });
  const img = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
}

export const loadZoneIndex = (island: string) =>
  fetch(`/data/${island}/zones/index.json`).then((r) => (r.ok ? (r.json() as Promise<ZoneIndexEntry[]>) : []));

export async function loadZone(island: string, id: string): Promise<Zone> {
  const base = `/data/${island}/zones/${id}`;
  const meta: ZoneMeta = await fetch(`${base}/meta.json`).then((r) => r.json());
  const [ht, hab] = await Promise.all([pixels(`${base}/${meta.height.file}`), pixels(`${base}/${meta.habitat.file}`)]);
  const heights = new Float32Array(ht.w * ht.h);
  const depth = new Uint8Array(ht.w * ht.h);
  for (let i = 0; i < heights.length; i++) {
    const h = (ht.data[i * 4] * 256 + ht.data[i * 4 + 1]) / 10 - 3000;
    heights[i] = h;
    depth[i] = Math.max(0, Math.min(255, Math.round(-h * 8)));
  }
  const habitatTex = new THREE.DataTexture(new Uint8Array(hab.data.buffer.slice(0)), hab.w, hab.h, THREE.RGBAFormat);
  habitatTex.magFilter = habitatTex.minFilter = THREE.NearestFilter;
  habitatTex.needsUpdate = true;
  const depthTex = new THREE.DataTexture(depth, ht.w, ht.h, THREE.RedFormat);
  depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;
  return {
    meta,
    w: ht.w,
    h: ht.h,
    heights,
    habitat: hab.data,
    habW: hab.w,
    habH: hab.h,
    habitatTex,
    depthTex,
    sizeX: meta.size_m[0],
    sizeZ: meta.size_m[1],
  };
}

export const toUV = (z: Zone, x: number, zz: number) => ({ u: x / z.sizeX + 0.5, v: zz / z.sizeZ + 0.5 });
export const toXZ = (z: Zone, u: number, v: number) => ({ x: (u - 0.5) * z.sizeX, z: (v - 0.5) * z.sizeZ });

export function heightAtXZ(z: Zone, x: number, zz: number): number {
  const { u, v } = toUV(z, x, zz);
  const fx = Math.min(Math.max(u * (z.w - 1), 0), z.w - 1);
  const fy = Math.min(Math.max(v * (z.h - 1), 0), z.h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, z.w - 1), y1 = Math.min(y0 + 1, z.h - 1);
  const tx = fx - x0, ty = fy - y0;
  const H = z.heights;
  const a = H[y0 * z.w + x0], b = H[y0 * z.w + x1], c = H[y1 * z.w + x0], d = H[y1 * z.w + x1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

export function habitatAtXZ(z: Zone, x: number, zz: number) {
  const { u, v } = toUV(z, x, zz);
  const px = Math.min(z.habW - 1, Math.max(0, Math.floor(u * z.habW)));
  const py = Math.min(z.habH - 1, Math.max(0, Math.floor(v * z.habH)));
  const i = (py * z.habW + px) * 4;
  return { benthic: z.habitat[i], geomorphic: z.habitat[i + 1] };
}

export function lonLatToXZ(z: Zone, lon: number, lat: number) {
  const [fu, fv] = z.meta.geo.lonlat_to_uv;
  return toXZ(z, fu[0] * lon + fu[1] * lat + fu[2], fv[0] * lon + fv[1] * lat + fv[2]);
}
export function xzToLonLat(z: Zone, x: number, zz: number) {
  const { u, v } = toUV(z, x, zz);
  const [fl, fa] = z.meta.geo.uv_to_lonlat;
  return { lon: fl[0] * u + fl[1] * v + fl[2], lat: fa[0] * u + fa[1] * v + fa[2] };
}

/** Seafloor/land mesh in meters. */
/** Seafloor/land vertices at full resolution (10 m). Triangles come from ZoneLod, which draws full
 *  detail near the boat and coarser cells with distance. */
export function zoneGeometry(z: Zone): THREE.BufferGeometry {
  const { w, h } = z;
  const pos = new Float32Array(w * h * 3);
  const uv = new Float32Array(w * h * 2);
  const hm = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const u = i / (w - 1), v = j / (h - 1);
      const ht = z.heights[k];
      pos[k * 3] = (u - 0.5) * z.sizeX;
      pos[k * 3 + 1] = floorY(ht);
      pos[k * 3 + 2] = (v - 0.5) * z.sizeZ;
      uv[k * 2] = u;
      uv[k * 2 + 1] = v;
      hm[k] = ht;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("aH", new THREE.BufferAttribute(hm, 1));
  g.setAttribute("normal", new THREE.BufferAttribute(gridNormals(w, h, (k) => floorY(z.heights[k]), z.sizeX / (w - 1), z.sizeZ / (h - 1)), 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * Distance-based level of detail for the zone mesh: 10 m cells within `r1` of the boat, 20 m to
 * `r2`, 40 m beyond. Underwater, where visibility is tens of meters, nothing beyond `rUnder` is
 * drawn at all. Only the index buffer changes; call update() as the boat moves.
 */
export class ZoneLod {
  /** The mesh geometry (owned by this object: one geometry per ZoneLod). */
  readonly geo: THREE.BufferGeometry;
  private index: THREE.BufferAttribute;
  private last = { x: 1e9, z: 1e9, under: false };
  constructor(private z: Zone, private r1: number, private r2: number, private rUnder = 170) {
    const geo = (this.geo = zoneGeometry(z));
    // Upper bound for the index size: the fine disc, the middle ring, and coarse cells everywhere.
    const blocks = blocksOf(z.w) * blocksOf(z.h);
    const cell = z.sizeX / (z.w - 1), blockArea = (B * cell) ** 2;
    const fine = (Math.PI * (r1 + 60) ** 2) / blockArea, mid = (Math.PI * (r2 + 60) ** 2) / blockArea;
    const cap = Math.ceil((Math.min(fine, blocks) * 16 + Math.min(mid, blocks) * 4 + blocks) * 6 * 1.15);
    this.index = new THREE.BufferAttribute(new Uint32Array(cap), 1);
    this.index.setUsage(THREE.DynamicDrawUsage);
    geo.setIndex(this.index);
    geo.setDrawRange(0, 0);
  }
  update(x: number, zz: number, under: boolean) {
    const l = this.last;
    if (under === l.under && Math.hypot(x - l.x, zz - l.z) < 50) return;
    this.last = { x, z: zz, under };
    const { z, r1, r2, rUnder } = this;
    const bx = (B * z.sizeX) / (z.w - 1), bz = (B * z.sizeZ) / (z.h - 1);
    const level = (bi: number, bj: number) => {
      const d = Math.hypot((bi + 0.5) * bx - z.sizeX / 2 - x, (bj + 0.5) * bz - z.sizeZ / 2 - zz);
      if (under) return d < rUnder * 0.6 ? 1 : d < rUnder ? 2 : 0;
      return d < r1 ? 1 : d < r2 ? 2 : B;
    };
    const { index, count } = lodIndices(z.w, z.h, level, this.index.array as Uint32Array);
    if (index !== this.index.array) {
      // Larger than estimated (should not happen): swap in a bigger buffer.
      this.index = new THREE.BufferAttribute(index, 1);
      this.index.setUsage(THREE.DynamicDrawUsage);
      this.geo.setIndex(this.index);
    } else {
      this.index.clearUpdateRanges();
      this.index.addUpdateRange(0, count);
      this.index.needsUpdate = true;
    }
    this.geo.setDrawRange(0, count);
  }
}

/** Deterministic pseudo-random in [0,1) from an integer (for stable prop placement). */
export function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Zone name in the current language (Roatán zones are proper names, the same in both). */
export const zoneName = (z: { name: string; name_es?: string }, lang: "es" | "en") => (lang === "es" && z.name_es ? z.name_es : z.name);
