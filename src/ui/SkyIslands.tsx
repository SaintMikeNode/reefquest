import { useEffect, useRef } from "react";
import { loadRegion, loadRelief } from "../lib/data";
import { LITE, MOBILE, REDUCED_MOTION } from "../lib/device";

// The footer's landscape: the Bay Islands seen from the sky, drawn as contour lines in perspective
// (after the footer of saintmikenode.org, Tulio's own site; our code). The relief is the coarse GEBCO
// grid already shipped for the home page (relief.bin, ~860 m cells), smoothed and upsampled, cut
// into contours with marching squares once, then only projected each frame: land in white rings
// rising from the coast, the seafloor in blue lines falling to the deep (depths compressed), a dot
// grid on the sea surface, and a marker with each island's name. The view drifts slowly from side
// to side; the lines draw in from the deep up to the peaks when the footer first comes into view.
// Loaded lazily (its own chunk) when the footer gets near; still on lite and with reduced motion.

type Seg = Float32Array; // x0,y0,z0,x1,y1,z1 per segment, in km (x east, y north, z up)

const ISLANDS = [
  { name: "Utila", lat: 16.0977, lon: -86.932 },
  { name: "Roatán", lat: 16.3696, lon: -86.4221 },
  { name: "Guanaja", lat: 16.4681, lon: -85.8843 },
  { name: "Cayos Cochinos", lat: 15.96, lon: -86.49 },
];
// Contour levels (m) and how each is drawn. Land: white, brighter higher up; sea: blue, fading with depth.
const LEVELS = [-4000, -3200, -2500, -1800, -1200, -800, -500, -300, -150, -80, -40, -15, 0, 30, 80, 140, 210, 290, 370];
const COAST = LEVELS.indexOf(0);
const SOUTH = 15.88; // crop: keep Cayos Cochinos, only a sliver of the mainland coast
const LAND_CAP = 420; // mainland mountains would tower over the islands

function z(h: number) {
  // Display height in km: land ×35, depths compressed (power 0.6) so the trench reads but doesn't swallow the view.
  return h >= 0 ? Math.min(h, LAND_CAP) * 0.035 : -Math.pow(-h, 0.6) * 0.075;
}

/** Smooth and upsample the grid, then cut every level into segments. */
function build(relief: Int16Array, meta: { w: number; h: number; west: number; north: number; step: number }) {
  const rows = Math.min(meta.h, Math.ceil((meta.north - SOUTH) / meta.step) + 1);
  const W = meta.w, K = 2; // upsample factor
  const gw = (W - 1) * K + 1, gh = (rows - 1) * K + 1;
  const g = new Float32Array(gw * gh);
  const at = (c: number, r: number) => relief[Math.min(rows - 1, r) * W + Math.min(W - 1, c)];
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const c = Math.floor(i / K), r = Math.floor(j / K), fx = i / K - c, fy = j / K - r;
      g[j * gw + i] = (at(c, r) * (1 - fx) + at(c + 1, r) * fx) * (1 - fy) + (at(c, r + 1) * (1 - fx) + at(c + 1, r + 1) * fx) * fy;
    }
  // One light 3×3 blur pass rounds the cell steps off the coastlines.
  const s = new Float32Array(g.length);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      let sum = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = i + di, y = j + dj;
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
          const wgt = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1;
          sum += g[y * gw + x] * wgt;
          n += wgt;
        }
      s[j * gw + i] = sum / n;
    }
  // Grid point → km, centered on the middle of the view.
  const kmLon = 111.32 * Math.cos((16.2 * Math.PI) / 180), kmLat = 110.57, cellDeg = meta.step / K;
  const lon0 = meta.west + ((gw - 1) * cellDeg) / 2, lat0 = meta.north - ((gh - 1) * cellDeg) / 2;
  const X = (i: number) => (meta.west + i * cellDeg - lon0) * kmLon;
  const Y = (j: number) => (meta.north - j * cellDeg - lat0) * kmLat;
  const out: Seg[] = [];
  for (const lv of LEVELS) {
    const seg: number[] = [], zz = z(lv);
    for (let j = 0; j < gh - 1; j++)
      for (let i = 0; i < gw - 1; i++) {
        const a = s[j * gw + i], b = s[j * gw + i + 1], c = s[(j + 1) * gw + i + 1], d = s[(j + 1) * gw + i];
        const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const t = (p: number, q: number) => (lv - p) / (q - p || 1e-6);
        // Edge points: top (a→b), right (b→c), bottom (d→c), left (a→d).
        const top = [X(i + t(a, b)), Y(j)], right = [X(i + 1), Y(j + t(b, c))], bottom = [X(i + t(d, c)), Y(j + 1)], left = [X(i), Y(j + t(a, d))];
        const add = (p: number[], q: number[]) => seg.push(p[0], p[1], zz, q[0], q[1], zz);
        switch (idx) {
          case 1: case 14: add(left, bottom); break;
          case 2: case 13: add(bottom, right); break;
          case 3: case 12: add(left, right); break;
          case 4: case 11: add(top, right); break;
          case 5: add(left, top), add(bottom, right); break;
          case 6: case 9: add(top, bottom); break;
          case 7: case 8: add(left, top); break;
          case 10: add(top, right), add(left, bottom); break;
        }
      }
    out.push(new Float32Array(seg));
  }
  // Each island's peak (for its marker) and the grid's extent (for the sea dots).
  const peaks = ISLANDS.map((isl) => {
    const i = Math.round((isl.lon - meta.west) / cellDeg), j = Math.round((meta.north - isl.lat) / cellDeg);
    let best = -1e9;
    for (let dj = -6; dj <= 6; dj++)
      for (let di = -6; di <= 6; di++) {
        const x = i + di, y = j + dj;
        if (x >= 0 && y >= 0 && x < gw && y < gh) best = Math.max(best, s[y * gw + x]);
      }
    return { name: isl.name, x: X(i), y: Y(j), z: z(Math.max(0, best)) };
  });
  // The view aims at the middle of the islands (they sit north of the grid's center).
  const focus = { x: X(Math.round((-86.44 - meta.west) / cellDeg)), y: Y(Math.round((meta.north - 16.29) / cellDeg)) };
  return { levels: out, peaks, focus, halfW: ((gw - 1) * cellDeg * kmLon) / 2, halfH: ((gh - 1) * cellDeg * kmLat) / 2 };
}

export default function SkyIslands() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let scene: ReturnType<typeof build> | null = null;
    let raf = 0, visible = false, last = 0, reveal = 0, revealStart = 0, dead = false;
    const still = LITE || REDUCED_MOTION;
    const fps = MOBILE ? 20 : 30;
    const view = { w: 1, h: 1, dpr: 1 };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      view.dpr = Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2);
      view.w = Math.max(1, r.width);
      view.h = Math.max(1, r.height);
      cv.width = Math.round(view.w * view.dpr);
      cv.height = Math.round(view.h * view.dpr);
      draw(performance.now());
    };

    const draw = (now: number) => {
      if (!scene) return;
      const { w, h, dpr } = view;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Camera: south of the islands, high up, looking north and down; a slow sway from side to side.
      const t = still ? 0 : now / 1000;
      const yaw = Math.sin(t * 0.07) * 0.06;
      const pitch = 0.62; // ~36° below the horizon
      const narrow = w < 640;
      const dist = narrow ? 120 : 95;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const camY = -dist * cp, camZ = dist * sp;
      // Utila to Guanaja (~115 km) fit with room on computers and phones.
      const F = (w / (scene.halfW * 2)) * dist * (narrow ? 0.98 : 0.86);
      const ox = w / 2, oy = h * (narrow ? 0.56 : 0.58);
      const P = { x: 0, y: 0, d: 0 };
      const fx = scene.focus.x, fy = scene.focus.y;
      const project = (x0: number, y0: number, zz: number) => {
        const x = x0 - fx, y = y0 - fy;
        const rx = x * cy - y * sy, ry = x * sy + y * cy;
        const dy = ry - camY, dz = zz - camZ;
        const depth = dy * cp - dz * sp; // along the view direction
        const up = dy * sp + dz * cp;
        if (depth < 1) return false;
        P.x = ox + (F * rx) / depth;
        P.y = oy - (F * up) / depth;
        P.d = depth;
        return true;
      };

      // The sea surface: a sparse dot grid, fading into the distance.
      ctx.fillStyle = "rgba(170, 205, 255, 0.5)";
      const stepKm = narrow ? 5 : 4;
      for (let y = -scene.halfH; y <= scene.halfH; y += stepKm)
        for (let x = -scene.halfW; x <= scene.halfW; x += stepKm) {
          if (!project(x, y, 0)) continue;
          if (P.x < -4 || P.x > w + 4 || P.y < -4 || P.y > h + 4) continue;
          const a = Math.max(0, Math.min(1, 1.4 - P.d / (dist * 1.25)));
          ctx.globalAlpha = a * 0.5;
          ctx.fillRect(P.x, P.y, 1.2, 1.2);
        }
      ctx.globalAlpha = 1;

      // Contours, deep first so the land draws over the seafloor; each level draws in on reveal.
      const n = LEVELS.length;
      for (let k = 0; k < n; k++) {
        const lv = LEVELS[k];
        const show = Math.max(0, Math.min(1, reveal * (n + 3) - k));
        if (show <= 0) continue;
        const land = lv >= 0;
        const deep = land ? 0 : Math.min(1, Math.log10(-lv / 20 + 1) / Math.log10(176));
        ctx.strokeStyle = land ? `rgba(255, 255, 255, ${(lv === 0 ? 1 : Math.min(0.95, 0.6 + 0.07 * (k - COAST))) * show})` : `rgba(140, 192, 255, ${(0.72 - deep * 0.42) * show})`;
        ctx.lineWidth = lv === 0 ? 1.5 : land ? 1.05 : 0.85;
        ctx.beginPath();
        const seg = scene.levels[k];
        for (let q = 0; q < seg.length; q += 6) {
          if (!project(seg[q], seg[q + 1], seg[q + 2])) continue;
          const x0 = P.x, y0 = P.y;
          if (!project(seg[q + 3], seg[q + 4], seg[q + 5])) continue;
          ctx.moveTo(x0, y0);
          ctx.lineTo(P.x, P.y);
        }
        ctx.stroke();
      }

      // Island markers: a hairline mast from the peak, a dot, a soft pulse ring and the name.
      if (reveal > 0.85) {
        const a = Math.min(1, (reveal - 0.85) / 0.15);
        ctx.font = `600 ${narrow ? 10 : 11}px "IBM Plex Mono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        for (const p of scene.peaks) {
          if (!project(p.x, p.y, p.z)) continue;
          const bx = P.x, by = P.y, mast = narrow ? 22 : 30;
          ctx.globalAlpha = a;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx, by - mast);
          ctx.stroke();
          const pulse = still ? 0.4 : (t * 0.45 + p.x * 0.01) % 1;
          ctx.strokeStyle = `rgba(127, 196, 255, ${0.7 * (1 - pulse)})`;
          ctx.beginPath();
          ctx.ellipse(bx, by, 4 + pulse * 14, (4 + pulse * 14) * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(bx, by - mast, 2.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(235, 244, 255, 0.92)";
          // Names stay inside the frame (on phones the outer islands sit near the edges).
          const label = p.name.toUpperCase(), half = ctx.measureText(label).width / 2 + 6;
          ctx.fillText(label, Math.max(half, Math.min(w - half, bx)), by - mast - 9);
        }
        ctx.globalAlpha = 1;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (dead || !visible) return;
      if (revealStart && reveal < 1) reveal = Math.min(1, (now - revealStart) / 2200);
      if (now - last >= 1000 / fps - 2) {
        last = now;
        draw(now);
      }
      if (!still || reveal < 1) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && visible && scene) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible && !revealStart) revealStart = performance.now();
      wake();
    });
    io.observe(cv);
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    Promise.all([loadRegion(), loadRelief()])
      .then(([region, relief]) => {
        if (dead || !region.relief) return;
        scene = build(relief, region.relief);
        if (REDUCED_MOTION) reveal = 1;
        resize();
        wake();
      })
      .catch(() => {});
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);
  return <canvas ref={canvas} className="sky-islands" aria-hidden="true" />;
}
