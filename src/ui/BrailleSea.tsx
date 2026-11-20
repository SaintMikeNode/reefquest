// The package's "browser" entry swaps in a plain DOM canvas; index.js is the braille implementation.
import DrawilleCanvas from "drawille-canvas/index.js";
import { useEffect, useRef } from "react";
import { loadIslandShapes, loadRegion, loadRelief, loadSceneMeta, type GeoJSON, type Region } from "../lib/data";
import { LITE, MOBILE, REDUCED_MOTION } from "../lib/device";

// Home hero background: a drone's view of Roatán and its neighbors, drawn in braille dots.
// A 3D model of the real terrain is seen through a perspective camera that drifts along Roatán's
// south side and swings slowly from side to side, the way a drone films a coastline. The model is
// Roatán's own terrain (the island scene's heightmap: land, reef shelf from the Allen Coral Atlas,
// trench; 68 m cells) set into the regional GEBCO relief (~860 m cells) for Utila, Guanaja, Cayos
// Cochinos and the deep water, with OpenStreetMap coastlines. It is drawn as east–west transects every
// 500 m, like the passes of a survey: white on land, cyan over the reef shelf, blue down the slope and
// in the deep, brighter where a slope faces the sun. Every frame the transects are projected and
// rasterized into braille cells (2 × 4 dots per character) by drawille-canvas, the library behind
// terminal charts, and the cells are painted as round dots on a <canvas>, so every device shows the
// same thing whatever fonts it has. Hidden lines are removed with a depth buffer: each column of dots
// marches over the terrain front to back, as in old voxel flight games.
// Weak devices skip Roatán's detailed terrain; they and reduced motion get one still frame.

// drawille allocates its cell buffer with Node's Buffer; a typed array does the same job in a browser.
const g = globalThis as { Buffer?: { alloc: (n: number) => Uint8Array } };
g.Buffer ??= { alloc: (n: number) => new Uint8Array(n) };

// Braille bit → dot position inside a cell (x 0–1, y 0–3), as drawille packs them.
const BITS: [number, number, number][] = [[0x1, 0, 0], [0x2, 0, 1], [0x4, 0, 2], [0x40, 0, 3], [0x8, 1, 0], [0x10, 1, 1], [0x20, 1, 2], [0x80, 1, 3]];

// Dot classes, painted in this order: [shade, sun] pairs, then the coastline.
const DEEP = 0, SLOPE = 2, REEF = 4, LAND = 6, COAST = 8;
const CLASSES = [
  { color: "120, 170, 255", alpha: 0.5, r: 0.28 }, // seafloor deeper than 1,000 m
  { color: "160, 205, 255", alpha: 0.75, r: 0.3 },
  { color: "160, 205, 255", alpha: 0.62, r: 0.3 }, // slope, 60–1,000 m
  { color: "200, 228, 255", alpha: 0.9, r: 0.32 },
  { color: "100, 226, 214", alpha: 0.85, r: 0.33 }, // reef shelf, shallower than 60 m
  { color: "150, 248, 236", alpha: 1, r: 0.35 },
  { color: "196, 220, 255", alpha: 0.85, r: 0.35 }, // land
  { color: "255, 255, 255", alpha: 1, r: 0.38 },
  { color: "255, 255, 255", alpha: 0.95, r: 0.34 }, // coastline
];
const BANDS = [1, 0.72, 0.45]; // brightness by distance: near, middle, far
const classOf = (el: number) => (el > 0 ? LAND : el > -60 ? REEF : el > -1000 ? SLOPE : DEEP);

// World units: km east (x) and north (y) of the middle of the archipelago; z up, km, exaggerated.
const LON0 = -86.42, LAT0 = 16.25;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180), KY = 110.57;
// Land stands 8× taller than true; below sea level the first 40 m are stretched the same way so the
// reef shelf reads, and deeper water is compressed (square root) so the 4 km trench doesn't swallow it.
const lift = (el: number) => {
  if (el >= 0) return el * 0.008;
  const d = -el;
  return -(Math.min(d, 40) * 0.012 + 0.075 * Math.sqrt(Math.max(0, d - 40)));
};
// Hillshade from the slope (dz/dx, dz/dy in display units), with the sun in the north-west.
const SUN_DIR = [-0.45, 0.5, 0.74];
const shadeOf = (hx: number, hy: number) => (-hx * SUN_DIR[0] - hy * SUN_DIR[1] + SUN_DIR[2]) / Math.hypot(hx, hy, 1);

/** Roatán's heightmap from the island scene (meters, row 0 north) and its lon/lat → uv fit. */
interface Fine {
  w: number;
  h: number;
  heights: Float32Array;
  fu: number[];
  fv: number[];
  size: [number, number]; // km
}

async function loadFine(): Promise<Fine> {
  const meta = await loadSceneMeta("roatan");
  const blob = await fetch(`/data/roatan/${meta.terrain.file}`).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  });
  // The PNG carries numbers, not colors: no color conversion or premultiplying.
  const img = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const heights = new Float32Array(c.width * c.height);
  for (let i = 0; i < heights.length; i++) heights[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 10 - 3000;
  const [fu, fv] = meta.geo.lonlat_to_uv;
  return { w: c.width, h: c.height, heights, fu, fv, size: [meta.size_m[0] / 1000, meta.size_m[1] / 1000] };
}

interface World {
  lines: Float32Array[]; // transects: x, y, z, class per point
  rows: Int32Array; // which transect row each line lies on (for thinning far away)
  coasts: Float32Array[]; // x, y per ring point (at sea level)
  peaks: { name: string; x: number; y: number; z: number }[];
  height: (x: number, y: number) => number; // display height, NaN outside the data
}

function buildWorld(region: Region, z: Int16Array, shapes: GeoJSON, fine: Fine | null): World | null {
  const rel = region.relief;
  if (!rel) return null;
  const { w, h, west, north, step } = rel;

  // Island extents. Land outside them is the mainland tip in the south: flattened and not drawn.
  const boxes = shapes.features.map((f) => {
    let w0 = 180, e0 = -180, s0 = 90, n0 = -90;
    for (const poly of f.geometry.coordinates)
      for (const q of poly[0]) {
        w0 = Math.min(w0, q[0]); e0 = Math.max(e0, q[0]);
        s0 = Math.min(s0, q[1]); n0 = Math.max(n0, q[1]);
      }
    return { w0, e0, s0, n0 };
  });
  const nearIsland = (lon: number, lat: number) => boxes.some((b) => lon >= b.w0 - 0.02 && lon <= b.e0 + 0.02 && lat >= b.s0 - 0.02 && lat <= b.n0 + 0.02);
  const raw = new Float32Array(w * h), skip = new Uint8Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      raw[k] = z[k];
      if (z[k] > 0 && !nearIsland(west + (i + 0.5) * step, north - (j + 0.5) * step)) {
        raw[k] = 0;
        skip[k] = 1;
      }
    }

  // Coarse grid coordinates from world km (cell centers at integer positions).
  const ax = 1 / (KX * step), bx = (LON0 - west) / step - 0.5;
  const ay = 1 / (KY * step), by = (north - LAT0) / step - 0.5;
  const coarse = (x: number, y: number) => {
    const gx = x * ax + bx, gy = by - y * ay;
    if (gx < 0 || gy < 0 || gx > w - 1 || gy > h - 1) return NaN;
    const i = Math.min(Math.floor(gx), w - 2), j = Math.min(Math.floor(gy), h - 2), fx = gx - i, fy = gy - j, k = j * w + i;
    return (raw[k] * (1 - fx) + raw[k + 1] * fx) * (1 - fy) + (raw[k + w] * (1 - fx) + raw[k + w + 1] * fx) * fy;
  };
  const skipAt = (x: number, y: number) => {
    const gx = Math.round(x * ax + bx), gy = Math.round(by - y * ay);
    return gx < 0 || gy < 0 || gx >= w || gy >= h || skip[gy * w + gx] === 1;
  };

  // Roatán's detailed terrain, faded into the coarse grid over its outer 3 km.
  let detail: ((x: number, y: number, c: number) => number) | null = null;
  if (fine) {
    const { fu, fv, heights: fh, w: fw, h: fhh, size } = fine;
    const ux = fu[0] / KX, uy = fu[1] / KY, u0 = fu[0] * LON0 + fu[1] * LAT0 + fu[2];
    const vx = fv[0] / KX, vy = fv[1] / KY, v0 = fv[0] * LON0 + fv[1] * LAT0 + fv[2];
    detail = (x, y, c) => {
      const u = ux * x + uy * y + u0, v = vx * x + vy * y + v0;
      if (u < 0 || v < 0 || u > 1 || v > 1) return c;
      const gx = u * (fw - 1), gy = v * (fhh - 1);
      const i = Math.min(Math.floor(gx), fw - 2), j = Math.min(Math.floor(gy), fhh - 2), fx = gx - i, fy = gy - j, k = j * fw + i;
      const f = (fh[k] * (1 - fx) + fh[k + 1] * fx) * (1 - fy) + (fh[k + fw] * (1 - fx) + fh[k + fw + 1] * fx) * fy;
      const t = Math.min(1, Math.min(u, 1 - u) * size[0] / 3, Math.min(v, 1 - v) * size[1] / 3);
      return c !== c ? f : c + (f - c) * t;
    };
  }
  const elev = (x: number, y: number) => (detail ? detail(x, y, coarse(x, y)) : coarse(x, y));
  const height = (x: number, y: number) => {
    const e = elev(x, y);
    return e !== e ? NaN : lift(e);
  };
  const toX = (lon: number) => (lon - LON0) * KX, toY = (lat: number) => (lat - LAT0) * KY;

  // OpenStreetMap land, rasterized once into a mask (point-in-polygon tests on detailed coasts are slow).
  const MW = -87.05, MN = 16.6, MS = 0.0015;
  const mw = Math.ceil(1.4 / MS), mh = Math.ceil(0.75 / MS);
  const mc = document.createElement("canvas");
  mc.width = mw;
  mc.height = mh;
  const m = mc.getContext("2d", { willReadFrequently: true })!;
  m.fillStyle = "#fff";
  m.beginPath();
  for (const f of shapes.features)
    for (const poly of f.geometry.coordinates)
      for (const ring of poly) ring.forEach((q, n) => (n ? m.lineTo : m.moveTo).call(m, (q[0] - MW) / MS, (MN - q[1]) / MS));
  m.fill("evenodd");
  const mask = m.getImageData(0, 0, mw, mh).data;
  const isLand = (x: number, y: number) => {
    const i = Math.floor((LON0 + x / KX - MW) / MS), j = Math.floor((MN - LAT0 - y / KY) / MS);
    return i >= 0 && j >= 0 && i < mw && j < mh && mask[(j * mw + i) * 4 + 3] > 127;
  };

  // Transects: every 500 m north to south (800 m on phones), sampled every 250 m (300 m).
  const LS = MOBILE ? 0.8 : 0.5, DS = MOBILE ? 0.3 : 0.25;
  const x0 = toX(west + step), x1 = toX(west + (w - 1) * step);
  const yS = toY(north - (h - 1) * step), yN = toY(north - step);
  const lines: Float32Array[] = [];
  const peakOf = new Map<number, { x: number; y: number; z: number }>();
  const cur: number[] = [];
  const flush = () => {
    if (cur.length >= 8) {
      lines.push(new Float32Array(cur));
      rowOf.push(row);
    }
    cur.length = 0;
  };
  const rowOf: number[] = [];
  let row = 0;
  for (let y = yS; y <= yN; y += LS, row++) {
    for (let x = x0; x <= x1; x += DS) {
      let el = elev(x, y);
      if (el !== el || skipAt(x, y)) {
        flush();
        continue;
      }
      // Land is wherever OpenStreetMap says so (the coarse grid smears coasts), at least 2 m up.
      const land = isLand(x, y);
      if (land) el = Math.max(el, 2);
      else if (el > 0) el = -1;
      const zz = lift(el), e = 0.3;
      const lit = shadeOf((height(x + e, y) - height(x - e, y)) / (2 * e), (height(x, y + e) - height(x, y - e)) / (2 * e)) > (land ? 0.8 : 0.86);
      cur.push(x, y, zz, classOf(el) + (lit ? 1 : 0));
      if (land) {
        const b = boxes.findIndex((bb) => toX(bb.w0) <= x && x <= toX(bb.e0) && toY(bb.s0) <= y && y <= toY(bb.n0));
        const pk = peakOf.get(b);
        if (b >= 0 && (!pk || zz > pk.z)) peakOf.set(b, { x, y, z: zz });
      }
    }
    flush();
  }
  const peaks = [...peakOf].map(([b, pk]) => ({ name: shapes.features[b].properties.name, ...pk }));

  // Coastlines: outer rings, thinned to ~120 m steps and split into ≤ 400 m pieces for the depth test.
  const coasts: Float32Array[] = [];
  for (const f of shapes.features)
    for (const poly of f.geometry.coordinates) {
      const out: number[] = [];
      let len = 0;
      for (const q of poly[0]) {
        const x = toX(q[0]), y = toY(q[1]);
        const n = out.length;
        if (n) {
          const dd = Math.hypot(x - out[n - 2], y - out[n - 1]);
          if (dd < 0.12) continue;
          const pieces = Math.ceil(dd / 0.4);
          for (let s = 1; s < pieces; s++) out.push(out[n - 2] + ((x - out[n - 2]) * s) / pieces, out[n - 1] + ((y - out[n - 1]) * s) / pieces);
          len += dd;
        }
        out.push(x, y);
      }
      if (len > 1.5) coasts.push(new Float32Array(out));
    }

  return { lines, rows: new Int32Array(rowOf), coasts, peaks, height };
}

interface View {
  w: number;
  h: number;
  p: number; // dot spacing inside a cell, CSS px
  dpr: number;
  narrow: boolean;
  BW: number; // dot columns
  BH: number; // dot rows
  gapPx: number; // where the camera's target sits on screen
  depth: Float32Array; // distance of the visible terrain behind each dot
  layers: DrawilleCanvas[][]; // [class][distance band]
}

function buildView(canvas: HTMLCanvasElement): View | null {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  const narrow = w < 700;
  const dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
  const p = Math.max(3.1, Math.min(4.2, w / 340));
  const BW = Math.ceil(w / (2.5 * p)) * 2, BH = Math.ceil(h / (4.5 * p)) * 4;
  // Put the island in the gap between the buttons and the data cards (measured from the page), or a
  // little below the middle when that layout isn't there.
  const frame = canvas.getBoundingClientRect();
  const above = canvas.parentElement?.querySelector(".hero-actions")?.getBoundingClientRect();
  const below = canvas.parentElement?.querySelector(narrow ? ".hero-cards .card" : ".strip-card")?.getBoundingClientRect();
  const gapPx = above && below && below.top > above.bottom ? (above.bottom + below.top) / 2 - frame.top + 16 : h * 0.6;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  return {
    w, h, p, dpr, narrow, BW, BH, gapPx,
    depth: new Float32Array(BW * BH),
    layers: CLASSES.map(() => BANDS.map(() => new DrawilleCanvas(BW, BH))),
  };
}

function render(canvas: HTMLCanvasElement, v: View, world: World, t: number) {
  const { w, h, p, dpr, BW, BH, depth, layers, narrow } = v;
  const sx = 1.25 * p, sy = 1.125 * p; // CSS px per dot, on average
  const TAU = 2 * Math.PI;

  // The drone: off Roatán's south shore, sliding along the island and back while it swings to look
  // up and down the coast, drifting in and out a little. Roatán runs about 25° north of east.
  const along = Math.sin((TAU * t) / 70);
  const yaw = -0.35 + 0.42 * Math.sin((TAU * t) / 46 + 0.6) * (narrow ? 0.7 : 1);
  const R = (narrow ? 30 : 34) * (1 + 0.06 * Math.sin((TAU * t) / 31));
  const H = R * Math.tan((22 * Math.PI) / 180);
  const span = narrow ? 30 : Math.min(54, Math.max(40, w * 0.034)); // km across the screen at the target
  const F = (w * R) / span;
  const tx = -11 + 13 * along * 0.906, ty = 11.5 + 13 * along * 0.423;
  const fx = Math.sin(yaw), fy = Math.cos(yaw), rx = Math.cos(yaw), ry = -Math.sin(yaw);
  const cx = tx - fx * R, cy = ty - fy * R;
  const horizon = v.gapPx - (F * H) / R;

  // Depth buffer: every dot column marches over the terrain front to back; a step that rises above
  // everything nearer claims the dots between.
  depth.fill(Infinity);
  const dMax = R + 170;
  for (let xd = 0; xd < BW; xd++) {
    const k = ((xd + 0.5) * sx - w / 2) / F;
    const dx = fx + rx * k, dy = fy + ry * k;
    let top = BH;
    for (let d = 2; d < dMax && top > 0; d += 0.08 + d * 0.005) {
      const hh = world.height(cx + dx * d, cy + dy * d);
      if (hh !== hh) continue;
      const yd = Math.max(0, Math.ceil((horizon + (F * (H - hh)) / d) / sy));
      for (let yy = yd; yy < top; yy++) depth[yy * BW + xd] = d;
      if (yd < top) top = yd;
    }
  }

  for (const row of layers)
    for (const c of row) {
      c._canvas.clear();
      c.beginPath();
    }
  const nearD = R * 0.9, farD = R * 1.6;
  // Projects a point; fills q with dot column, dot row, distance band, px, py, distance. False if hidden.
  const q = [0, 0, 0, 0, 0, 0];
  const project = (x: number, y: number, z: number) => {
    const ex = x - cx, ey = y - cy;
    const d = ex * fx + ey * fy;
    if (d < 1) return false;
    const px = w / 2 + (F * (ex * rx + ey * ry)) / d, py = horizon + (F * (H - z)) / d;
    if (px < 0 || py < 0 || px >= w || py >= h) return false;
    const xd = Math.floor(px / sx), yd = Math.floor(py / sy);
    if (d > depth[yd * BW + xd] * 1.01 + 0.35) return false;
    q[0] = xd;
    q[1] = yd;
    q[2] = d < nearD ? 0 : d < farD ? 1 : 2;
    q[3] = px;
    q[4] = py;
    q[5] = d;
    return true;
  };
  // A visible piece of line: neighbouring dots are set directly, longer pieces go through drawille's
  // path (Bresenham lines).
  const piece = (c: DrawilleCanvas, x0: number, y0: number, x1: number, y1: number) => {
    if (Math.abs(x1 - x0) <= 1 && Math.abs(y1 - y0) <= 1) {
      c._canvas.set(x0, y0);
      c._canvas.set(x1, y1);
    } else {
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
    }
  };
  // Far away, transects are thinned (every 2nd, then every 4th) so they don't merge into a flat sheet.
  const thin1 = R * 1.3, thin2 = R * 2.3;
  world.lines.forEach((line, n) => {
    const row = world.rows[n];
    let prev = false, px = 0, py = 0;
    for (let i = 0; i < line.length; i += 4) {
      let ok = project(line[i], line[i + 1], line[i + 2]);
      if (ok && row % 4 && q[5] > (row % 2 ? thin1 : thin2)) ok = false;
      if (ok && prev) piece(layers[line[i + 3]][q[2]], px, py, q[0], q[1]);
      prev = ok;
      px = q[0];
      py = q[1];
    }
  });
  for (const ring of world.coasts) {
    let prev = false, px = 0, py = 0;
    for (let i = 0; i < ring.length; i += 2) {
      const ok = project(ring[i], ring[i + 1], 0.03);
      if (ok && prev) piece(layers[COAST][q[2]], px, py, q[0], q[1]);
      prev = ok;
      px = q[0];
      py = q[1];
    }
  }
  for (const row of layers) for (const c of row) c.stroke();

  // Braille cells → round dots.
  const g2 = canvas.getContext("2d")!;
  g2.setTransform(1, 0, 0, 1, 0, 0);
  g2.clearRect(0, 0, canvas.width, canvas.height);
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = BW / 2;
  layers.forEach((row, cls) => {
    const r = p * CLASSES[cls].r;
    row.forEach((c, band) => {
      const cells = c._canvas.content;
      g2.beginPath();
      for (let n = 0; n < cells.length; n++) {
        const bits = cells[n];
        if (!bits) continue;
        const ox = (n % cols) * 2.5 * p + 0.5 * p, oy = Math.floor(n / cols) * 4.5 * p + 0.5 * p;
        for (const [mask, bx, by] of BITS)
          if (bits & mask) {
            const x = ox + bx * p, y = oy + by * p;
            g2.moveTo(x + r, y);
            g2.arc(x, y, r, 0, TAU);
          }
      }
      g2.fillStyle = `rgba(${CLASSES[cls].color}, ${CLASSES[cls].alpha * BANDS[band]})`;
      g2.fill();
    });
  });

  // Island names above their highest point, while it's in sight.
  g2.font = `500 ${narrow ? 10 : 11.5}px "IBM Plex Mono", Menlo, monospace`;
  g2.textAlign = "center";
  g2.fillStyle = "rgba(255, 255, 255, 0.92)";
  for (const pk of world.peaks) if (project(pk.x, pk.y, pk.z) && q[4] > 30) g2.fillText(pk.name.toUpperCase(), q[3], q[4] - 3.4 * p);
}

export default function BrailleSea() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true, raf = 0, visible = true;
    let world: World | null = null, view: View | null = null;
    const still = LITE || REDUCED_MOTION;
    const t0 = performance.now();
    // Dev only: window.__rqHeroT = <seconds> holds the flight at that moment.
    const hold = () => (import.meta.env.DEV ? (window as { __rqHeroT?: number }).__rqHeroT : undefined);
    const draw = (now: number) => {
      if (!world || !view) return;
      const s = performance.now();
      render(canvas, view, world, hold() ?? (still ? 0 : (now - t0) / 1000));
      if (import.meta.env.DEV) (window as { __rqHeroMs?: number }).__rqHeroMs = performance.now() - s;
    };
    const rebuild = () => {
      view = buildView(canvas);
      draw(performance.now());
    };

    // 30 frames a second on desktops, 15 on phones and tablets.
    const interval = 1000 / (MOBILE ? 15 : 30);
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < interval * 0.9) return;
      last = now;
      draw(now);
    };

    // Roatán's detailed terrain is the same file the island page loads, so it's cached for that visit.
    Promise.all([loadRegion(), loadRelief(), loadIslandShapes(), LITE ? null : loadFine().catch(() => null)])
      .then(([region, z, shapes, fine]) => {
        if (!alive) return;
        world = buildWorld(region, z, shapes, fine);
        rebuild();
        if (!still) raf = requestAnimationFrame(loop);
      })
      .catch(() => {});

    let lastW = 0, lastH = 0;
    const ro = new ResizeObserver(() => {
      if (canvas.clientWidth === lastW && canvas.clientHeight === lastH) return;
      lastW = canvas.clientWidth;
      lastH = canvas.clientHeight;
      rebuild();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="hero-sea" aria-hidden="true" />;
}
