// The package's "browser" entry swaps in a plain DOM canvas; index.js is the braille implementation.
import DrawilleCanvas from "drawille-canvas/index.js";
import { useEffect, useRef } from "react";
import { loadIslandShapes, loadRegion, loadRelief, type GeoJSON, type Region } from "../lib/data";
import { LITE, MOBILE, REDUCED_MOTION } from "../lib/device";

// Home hero background: the Bay Islands and their seafloor as a ridgeline landscape in braille dots.
// Real terrain (GEBCO 2023, ~860 m cells) is drawn row by row, looking north from the shelf south of
// the islands: lines of seafloor in front, the islands as a white skyline (Roatán in the middle,
// Guanaja's peak to the right), hidden lines removed. Lines are rasterized into braille cells
// (2 × 4 dots per character) by drawille-canvas, the library behind terminal charts, and the cells
// are painted as dots on a <canvas>, so every device shows the same thing whatever fonts it has.
// A satellite crosses the sky; the strip of sea under it lights up as it scans ("seen from space").

// drawille allocates its cell buffer with Node's Buffer; a typed array does the same job in a browser.
const g = globalThis as { Buffer?: { alloc: (n: number) => Uint8Array } };
g.Buffer ??= { alloc: (n: number) => new Uint8Array(n) };

// Braille bit → dot position inside a cell (x 0–1, y 0–3), as drawille packs them.
const BITS: [number, number, number][] = [[0x1, 0, 0], [0x2, 0, 1], [0x4, 0, 2], [0x40, 0, 3], [0x8, 1, 0], [0x10, 1, 1], [0x20, 1, 2], [0x80, 1, 3]];

// Dot classes by elevation: deep water, slope, reef shelf (above −60 m), land.
const CLASSES = [
  { color: "140, 182, 255", alpha: 0.42 },
  { color: "168, 208, 255", alpha: 0.6 },
  { color: "150, 240, 232", alpha: 0.9 },
  { color: "255, 255, 255", alpha: 1 },
];
const classOf = (h: number) => (h > 0 ? 3 : h > -60 ? 2 : h > -900 ? 1 : 0);

interface Scene {
  w: number;
  h: number;
  p: number;
  dpr: number;
  dots: Float32Array[]; // per class: x, y in CSS px
  base: HTMLCanvasElement; // every dot at rest brightness, plus labels
}

function buildScene(canvas: HTMLCanvasElement, region: Region, z: Int16Array, shapes: GeoJSON): Scene | null {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const rel = region.relief;
  if (!w || !h || !rel) return null;
  const narrow = w < 700;
  const dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
  const p = Math.max(3.1, Math.min(4.2, w / 340)); // dot spacing inside a cell, CSS px
  const cols = Math.ceil(w / (2.5 * p)), rows = Math.ceil(h / (4.5 * p));
  const BW = cols * 2, BH = rows * 4;
  const ctxs = CLASSES.map(() => new DrawilleCanvas(BW, BH));
  ctxs.forEach((c) => c.beginPath());

  // View: rows from the shelf south of the islands (near, bottom) to the deep water north of them (far).
  const south = Math.min(rel.h - 1, Math.round((rel.north - 15.97) / rel.step)); // leave the mainland out
  const yNear = BH * 1.03;
  // Put Roatán's skyline in the gap between the buttons and the data cards (measured from the page),
  // or halfway down when that layout isn't there.
  const frame = canvas.getBoundingClientRect();
  const above = canvas.parentElement?.querySelector(".hero-actions")?.getBoundingClientRect();
  // Side by side, the skyline clears the wide card in the middle; stacked, it clears the first card.
  const below = canvas.parentElement?.querySelector(narrow ? ".hero-cards .card" : ".strip-card")?.getBoundingClientRect();
  const gapPx = above && below && below.top > above.bottom ? (above.bottom + below.top) / 2 - frame.top + 20 : h * 0.56;
  const roatanBase = gapPx / (1.125 * p); // in dot rows
  const yFar = (roatanBase - 0.176 * yNear) / (1 - 0.176); // Roatán's rows sit about 17.6% of the way from far to near

  // Only the islands are drawn as solid land; the mainland tip in the south-east stays a dim outline.
  const boxes = shapes.features.map((f) => {
    let w0 = 180, e0 = -180, s0 = 90, n0 = -90;
    for (const poly of f.geometry.coordinates)
      for (const q of poly[0]) {
        w0 = Math.min(w0, q[0]); e0 = Math.max(e0, q[0]);
        s0 = Math.min(s0, q[1]); n0 = Math.max(n0, q[1]);
      }
    return { w0: w0 - 0.02, e0: e0 + 0.02, s0: s0 - 0.02, n0: n0 + 0.02 };
  });
  const isIsland = (lon: number, lat: number) => boxes.some((b) => lon >= b.w0 && lon <= b.e0 && lat >= b.s0 && lat <= b.n0);
  const zoom0 = narrow ? 1.9 : 0.95, zoom1 = narrow ? 2.5 : 1.45;
  const liftOf = (el: number, t: number) => (el > 0 ? Math.pow(el, 0.62) * landK * 1.15 : el * seaK) * (0.55 + 0.45 * t);
  const landK = (narrow ? 0.65 : 1) * (BH / 190), seaK = 0.011 * (BH / 190);
  const horizon = new Float32Array(BW).fill(1e9);
  // Every terrain row shapes the islands (so their ridges join up); the sea is drawn on every other
  // row to stay airy.
  const rowStep = 1;
  const nRows = Math.floor(south / rowStep) + 1;
  const rowBase: number[] = [], rowZoom: number[] = [];

  for (let k = 0; k < nRows; k++) {
    const j = south - k * rowStep;
    const t = 1 - k / (nRows - 1); // 1 near → 0 far
    const base = yFar + (yNear - yFar) * Math.pow(t, 1.7);
    const zoom = zoom0 + (zoom1 - zoom0) * t;
    rowBase[j] = base;
    rowZoom[j] = zoom;
    const lat = rel.north - (j + 0.5) * rel.step;
    let px = 0, py = 0, pv = false;
    for (let x = 0; x < BW; x++) {
      const u = (x / (BW - 1) - 0.5) / zoom + 0.5;
      if (u < 0 || u > 1) {
        pv = false;
        continue;
      }
      const cf = u * (rel.w - 1), c0 = Math.floor(cf), c1 = Math.min(c0 + 1, rel.w - 1), f = cf - c0;
      const el = z[j * rel.w + c0] * (1 - f) + z[j * rel.w + c1] * f;
      // Land stands taller than its true scale (the islands are low next to a 3 km deep basin).
      const y = base - liftOf(el, t);
      const visible = y < horizon[x];
      const cls = el > 0 && !isIsland(rel.west + u * rel.w * rel.step, lat) ? 1 : classOf(el);
      if (visible && cls < 3 && k % 2 === 1) {
        // A skipped sea row still hides what lies behind it.
        horizon[x] = y;
        pv = false;
        continue;
      }
      if (visible) {
        const c = ctxs[cls];
        if (pv) {
          c.moveTo(px, py);
          c.lineTo(x, y);
        } else {
          c.moveTo(x, y);
          c.lineTo(x, y);
        }
        if (cls === 3) {
          // The island's body: a stipple from its crest down to sea level.
          const floor = Math.min(base, horizon[x]);
          for (let q = Math.ceil(y) + 1 + (x % 2); q < floor; q += 2) {
            c.moveTo(x, q);
            c.lineTo(x, q);
          }
        }
        horizon[x] = y;
      }
      px = x;
      py = y;
      pv = visible;
    }
  }
  ctxs.forEach((c) => c.stroke());

  // Braille cells → dot positions.
  const dots = ctxs.map((c) => {
    const out: number[] = [];
    const str = c.toString();
    let col = 0, row = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      if (ch === 10) {
        row++;
        col = 0;
        continue;
      }
      if (ch !== 32) {
        const bits = ch - 0x2800;
        for (const [mask, dx, dy] of BITS) if (bits & mask) out.push(col * 2.5 * p + (dx + 0.5) * p, row * 4.5 * p + (dy + 0.5) * p);
      }
      col++;
    }
    return new Float32Array(out);
  });

  // Island names above their crests.
  const labels: { name: string; x: number; y: number }[] = [];
  for (const f of shapes.features) {
    let ring: number[][] = [];
    for (const poly of f.geometry.coordinates) if (poly[0].length > ring.length) ring = poly[0];
    if (!ring.length) continue;
    const lon = ring.reduce((s, q) => s + q[0], 0) / ring.length, lat = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    let j = Math.round((rel.north - lat) / rel.step);
    j = south - Math.round((south - j) / rowStep) * rowStep;
    if (j < 0 || j > south || rowBase[j] === undefined) continue;
    const u = (lon - rel.west) / (rel.w * rel.step);
    const x = Math.round(((u - 0.5) * rowZoom[j] + 0.5) * (BW - 1));
    if (x < 8 || x > BW - 8) continue;
    // The island's own crest: the highest point of its rows around the label.
    const t = 1 - (south - j) / rowStep / (nRows - 1);
    let y = rowBase[j];
    for (let dj = -6; dj <= 6; dj += 2)
      for (let dc = -5; dc <= 5; dc++) {
        const jj = Math.min(south, Math.max(0, j + dj)), cc = Math.min(rel.w - 1, Math.max(0, Math.round(u * (rel.w - 1)) + dc));
        y = Math.min(y, (rowBase[jj] ?? rowBase[j]) - liftOf(Math.max(0, z[jj * rel.w + cc]), t));
      }
    labels.push({ name: f.properties.name, x: (x / 2) * 2.5 * p, y: (y / 4) * 4.5 * p - 3.4 * p });
  }

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const base = document.createElement("canvas");
  base.width = canvas.width;
  base.height = canvas.height;
  const b = base.getContext("2d")!;
  b.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintDots(b, dots, p, () => true, 1);
  b.font = `500 ${narrow ? 10 : 11.5}px "IBM Plex Mono", Menlo, monospace`;
  b.textAlign = "center";
  b.fillStyle = "rgba(255, 255, 255, 0.92)";
  for (const l of labels) b.fillText(l.name.toUpperCase(), l.x, l.y);
  return { w, h, p, dpr, dots, base };
}

function paintDots(c: CanvasRenderingContext2D, dots: Float32Array[], p: number, pick: (x: number, y: number) => boolean, boost: number) {
  dots.forEach((d, cls) => {
    const r = p * (cls === 0 ? 0.3 : 0.36);
    c.beginPath();
    for (let i = 0; i < d.length; i += 2) {
      if (!pick(d[i], d[i + 1])) continue;
      c.moveTo(d[i] + r, d[i + 1]);
      c.arc(d[i], d[i + 1], r, 0, 6.2832);
    }
    // Brighter passes are drawn over the base, so only the extra brightness is added.
    c.fillStyle = `rgba(${CLASSES[cls].color}, ${Math.min(1, CLASSES[cls].alpha * (boost > 1 ? boost - 1 : 1))})`;
    c.fill();
  });
}

export default function BrailleSea() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true, raf = 0, visible = true;
    let data: { region: Region; z: Int16Array; shapes: GeoJSON } | null = null;
    let scene: Scene | null = null;

    const draw = (t: number) => {
      if (!scene) return;
      const { w, p, dpr, dots, base } = scene;
      const c = canvas.getContext("2d")!;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.drawImage(base, 0, 0);
      if (LITE || REDUCED_MOTION) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The satellite crosses the sky every 11 s on a shallow arc; the strip of sea under it lights up.
      const k = ((t / 11) % 1) * 1.3 - 0.15;
      const sx = k * w, sy = (w < 700 ? 88 : 106) + 9 * (2 * k - 1) ** 2;
      const half = Math.max(26, w * 0.028);
      paintDots(c, dots, p, (x) => Math.abs(x - sx) < half, 1.5);
      paintDots(c, dots, p, (x) => Math.abs(x - sx) < half * 0.35, 1.5);
      // The satellite itself: a braille-sized cluster with a short dotted trail.
      c.fillStyle = "rgba(255, 255, 255, 0.95)";
      for (const [dx, dy] of [[0, 0], [p, 0], [0, p], [p, p], [-p, p * 0.5], [2 * p, p * 0.5]]) {
        c.beginPath();
        c.arc(sx + dx, sy + dy, p * 0.38, 0, 6.2832);
        c.fill();
      }
      for (let i = 1; i <= 7; i++) {
        c.fillStyle = `rgba(255, 255, 255, ${0.5 - i * 0.065})`;
        c.beginPath();
        c.arc(sx - i * p * 2.6, sy + p * 0.5 + i * i * 0.06, p * 0.3, 0, 6.2832);
        c.fill();
      }
    };

    const rebuild = () => {
      if (!data) return;
      scene = buildScene(canvas, data.region, data.z, data.shapes);
      draw(performance.now() / 1000);
    };

    // 24 frames a second on desktops, 14 on phones; a still frame on weak devices or reduced motion.
    const interval = 1000 / (MOBILE ? 14 : 24);
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < interval) return;
      last = now;
      draw(now / 1000);
    };

    Promise.all([loadRegion(), loadRelief(), loadIslandShapes()])
      .then(([region, z, shapes]) => {
        if (!alive) return;
        data = { region, z, shapes };
        rebuild();
        if (!LITE && !REDUCED_MOTION) raf = requestAnimationFrame(loop);
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
