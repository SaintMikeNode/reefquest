import * as THREE from "three";

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
export function zoneGeometry(z: Zone, stride: number): THREE.BufferGeometry {
  const nx = Math.floor((z.w - 1) / stride) + 1;
  const nz = Math.floor((z.h - 1) / stride) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const hm = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const u = (i * stride) / (z.w - 1), v = (j * stride) / (z.h - 1);
      const h = z.heights[j * stride * z.w + i * stride];
      pos[k * 3] = (u - 0.5) * z.sizeX;
      pos[k * 3 + 1] = floorY(h);
      pos[k * 3 + 2] = (v - 0.5) * z.sizeZ;
      uv[k * 2] = u;
      uv[k * 2 + 1] = v;
      hm[k] = h;
    }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("aH", new THREE.BufferAttribute(hm, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
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
