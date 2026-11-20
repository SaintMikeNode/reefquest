import { useEffect, useRef } from "react";
import { LITE, MOBILE, REDUCED_MOTION } from "../lib/device";

// Home hero background: a calm sea drawn as a field of dots. The dots rise, swell and fade with
// slow rolling swells (a few drifting sine fronts warped into each other), brighter and larger on the
// crests. Small schools of reef fish and an eagle ray, drawn in fine dots, glide underneath: they
// wander along smooth curves, keep loosely together, light up the water as they pass, and dart
// away from the cursor. Moving the pointer leaves a wake of ripples; a click or tap sends out a
// splash; now and then a fish rises and rings the surface. The dots fade under the headline so the
// type stays clean. Inspired by the "Dotted Waves" idea Tulio pointed to (our own code).
//
// Canvas 2D: dots are drawn in a handful of color/alpha buckets (one path each) and fish in two
// paths, so a frame is ~10 fills. Phones run at 30 fps with fewer dots and fish, lite devices at
// 24 fps with fewer still, and with reduced motion one still frame is drawn.

const BACK: [number, number, number] = [56, 122, 240]; // dots in the troughs
const FRONT: [number, number, number] = [208, 240, 255]; // dots on the crests
const BUCKETS = 8;
const BUCKET_STYLE = Array.from({ length: BUCKETS }, (_, b) => {
  const k = b / (BUCKETS - 1);
  const m = Math.pow(k, 1.25);
  const c = BACK.map((v, i) => Math.round(v + (FRONT[i] - v) * m));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(0.16 + 0.84 * k).toFixed(3)})`;
});

const TIER = LITE ? 0 : MOBILE ? 1 : 2;
const SPACING = [24, 19, 22][TIER];
const DOT = [2.4, 2.4, 2.8][TIER]; // radius on a crest, CSS px
const FPS = [24, 30, 60][TIER];
const SCHOOLS = [2, 2, 3][TIER];
const PER_SCHOOL = [4, 6, 8][TIER];
const FISH_LEN = [20, 21, 27][TIER];
const RAY_SPAN = [80, 86, 124][TIER];

// A fish in dots, nose at u = 0, tail fork at u = 1; y is across the body. Units: body lengths.
const FISH_PTS: [number, number][] = [];
for (let i = 0; i <= 8; i++) {
  const u = (i / 8) * 0.74;
  const hw = 0.15 * Math.sin(Math.PI * Math.pow(Math.max(u, 0.02) / 0.74, 0.62));
  const n = Math.max(1, Math.round((hw * 2) / 0.075));
  for (let k = 0; k < n; k++) FISH_PTS.push([u, n === 1 ? 0 : -hw + (2 * hw * k) / (n - 1)]);
}
for (let i = 1; i <= 4; i++) {
  const u = 0.74 + i * 0.065, s = 0.035 + i * 0.045;
  FISH_PTS.push([u, s], [u, -s]);
}

// An eagle ray from above in dots: pointed wings, a rounded head, a long thin tail. Units: px for
// the given span; x forward, y across. `w` is how far out on the wing a dot is (0 body, 1 tip).
function rayPoints(span: number) {
  const b = span / 2, a = span * 0.62, st = span / 21;
  const hw = (x: number) =>
    x > -0.1 * a ? b * Math.pow(Math.max(0, (0.32 * a - x) / (0.42 * a)), 0.75) : b * Math.pow(Math.max(0, 1 - (-0.1 * a - x) / (0.46 * a)), 1.35) + 0.04 * b;
  const pts: { x: number; y: number; w: number }[] = [];
  for (let x = -0.56 * a; x <= 0.32 * a; x += st) {
    const h = hw(x);
    for (let y = -h; y <= h + 0.01; y += st) pts.push({ x, y, w: Math.abs(y) / b });
  }
  pts.push({ x: 0.36 * a, y: 0.09 * b, w: 0 }, { x: 0.36 * a, y: -0.09 * b, w: 0 }); // head lobes
  return { pts, a, b };
}

interface Swimmer {
  x: number;
  y: number;
  heading: number;
  speed: number; // cruising, px/s
  v: number; // current speed
  seed: number;
}
interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  phase: number;
  len: number;
  back: number;
  side: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const turnToward = (h: number, want: number, amt: number) => h + Math.max(-amt, Math.min(amt, wrap(want - h)));
const rnd = (() => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
})();

// The sea: drifting swells bent into each other, in units of 9 px so they read the same on any
// screen. Roughly −1 (trough) to 1 (crest).
function swell(x: number, y: number, t: number) {
  const a = Math.sin(x * 0.11 + y * 0.035 + t * 0.9 + Math.sin(y * 0.05 + t * 0.23) * 1.5);
  const b = Math.sin(-x * 0.05 + y * 0.115 - t * 0.7 + Math.sin(x * 0.04 - t * 0.19) * 1.3);
  const c = Math.sin((x + y) * 0.075 + t * 1.3) * 0.35;
  return (a * 0.55 + b * 0.45 + c) / 1.2;
}

export default function DottedSea() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const c = canvas?.getContext("2d");
    if (!canvas || !host || !c) return;

    let w = 0, h = 0, dpr = 1;
    let gx = new Float32Array(0), gy = new Float32Array(0), fade = new Float32Array(0);
    let text = { x: 0, y: 0, rx: 1, ry: 1 }; // the headline's area, where everything dims
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    const ripples: { x: number; y: number; t: number; amp: number; width: number }[] = [];
    const ripple = (x: number, y: number, amp: number, width = 34) => {
      if (ripples.length > 14) ripples.shift();
      ripples.push({ x, y, t: clock, amp, width });
    };
    const pointer = { x: -1e4, y: -1e4, at: -1e4, lastX: -1e4, lastY: -1e4, lastRipple: 0 };

    const schools: { lead: Swimmer; fish: Fish[] }[] = [];
    let ray: (Swimmer & { flap: number; shape: ReturnType<typeof rayPoints> }) | null = null;
    let clock = 0;

    const inText = (x: number, y: number) => {
      const dx = (x - text.x) / text.rx, dy = (y - text.y) / text.ry;
      return dx * dx + dy * dy;
    };

    const layout = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, TIER === 2 ? 2 : 1.5);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const tr = host.querySelector(".hero-content")?.getBoundingClientRect();
      text = tr
        ? { x: tr.left - r.left + tr.width / 2, y: tr.top - r.top + tr.height * 0.48, rx: Math.min(tr.width * 0.4, 420), ry: tr.height * 0.4 }
        : { x: w / 2, y: h * 0.4, rx: w * 0.3, ry: h * 0.25 };
      // The grid reaches past the edges so dots lifted by a swell still fill the frame.
      const cols = Math.ceil(w / SPACING) + 3, rows = Math.ceil(h / SPACING) + 4;
      gx = new Float32Array(cols * rows);
      gy = new Float32Array(cols * rows);
      fade = new Float32Array(cols * rows);
      const ox = (w - (cols - 1) * SPACING) / 2;
      for (let j = 0, k = 0; j < rows; j++)
        for (let i = 0; i < cols; i++, k++) {
          const x = ox + i * SPACING, y = (j - 1.5) * SPACING;
          gx[k] = x;
          gy[k] = y;
          const e = inText(x, y);
          const s = Math.min(1, Math.max(0, (e - 0.55) / 0.75));
          fade[k] = 0.42 + 0.58 * s * s * (3 - 2 * s);
        }
      if (!schools.length) spawn();
    };

    const spawn = () => {
      for (let s = 0; s < SCHOOLS; s++) {
        const lead: Swimmer = { x: w * (0.15 + 0.7 * rnd()), y: h * (0.2 + 0.65 * rnd()), heading: rnd() * Math.PI * 2, speed: 34 + rnd() * 18, v: 40, seed: rnd() * 100 };
        const fish: Fish[] = [];
        for (let k = 0; k < PER_SCHOOL; k++) {
          const back = 6 + k * 13 + rnd() * 10;
          const side = (k % 2 ? 1 : -1) * (9 + ((k * 13) % 5) * 7 + rnd() * 6);
          fish.push({ x: lead.x - back, y: lead.y + side, vx: 0, vy: 0, heading: lead.heading, phase: rnd() * 6, len: FISH_LEN * (0.82 + rnd() * 0.36), back, side });
        }
        schools.push({ lead, fish });
      }
      ray = { x: w * 0.8, y: h * 0.75, heading: Math.PI * 0.95, speed: 22, v: 22, seed: 3.3, flap: 0, shape: rayPoints(RAY_SPAN) };
    };

    // Wander along smooth curves, turn back before the edges, and swerve away from the pointer.
    const steer = (a: Swimmer, dt: number, margin: number, shy: number) => {
      a.heading += (Math.sin(clock * 0.31 + a.seed) * 0.42 + Math.sin(clock * 0.73 + a.seed * 1.7) * 0.28) * dt;
      let ex = 0, ey = 0;
      if (a.x < margin) ex = (margin - a.x) / margin;
      else if (a.x > w - margin) ex = -(a.x - (w - margin)) / margin;
      if (a.y < margin * 0.8) ey = (margin * 0.8 - a.y) / (margin * 0.8);
      else if (a.y > h - margin * 0.6) ey = -(a.y - (h - margin * 0.6)) / (margin * 0.6);
      if (ex || ey) a.heading = turnToward(a.heading, Math.atan2(ey, ex), Math.min(1.6, Math.hypot(ex, ey)) * 1.5 * dt);
      let boost = 1;
      const fresh = clock - pointer.at < 1.5;
      if (fresh) {
        const dx = a.x - pointer.x, dy = a.y - pointer.y, d = Math.hypot(dx, dy);
        if (d < shy) {
          const k = 1 - d / shy;
          a.heading = turnToward(a.heading, Math.atan2(dy, dx), k * 5 * dt);
          boost += k * 2.4;
        }
      }
      a.v += (a.speed * boost - a.v) * Math.min(1, dt * 2.2);
      a.x += Math.cos(a.heading) * a.v * dt;
      a.y += Math.sin(a.heading) * a.v * dt;
    };

    const update = (dt: number) => {
      const fresh = clock - pointer.at < 1.5;
      for (const s of schools) {
        steer(s.lead, dt, Math.min(170, w * 0.2), 190);
        const L = s.lead, ch = Math.cos(L.heading), sh = Math.sin(L.heading);
        for (const [k, f] of s.fish.entries()) {
          const side = f.side + Math.sin(clock * 0.5 + k * 1.3) * 4;
          const tx = L.x - ch * f.back - sh * side, ty = L.y - sh * f.back + ch * side;
          let ax = (tx - f.x) * 3.2 - f.vx * 2.3, ay = (ty - f.y) * 3.2 - f.vy * 2.3;
          if (fresh) {
            const dx = f.x - pointer.x, dy = f.y - pointer.y, d = Math.hypot(dx, dy) || 1;
            if (d < 120) {
              ax += (dx / d) * (1 - d / 120) * 900;
              ay += (dy / d) * (1 - d / 120) * 900;
            }
          }
          f.vx += ax * dt;
          f.vy += ay * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          const sp = Math.hypot(f.vx, f.vy);
          const want = sp > 6 ? Math.atan2(f.vy, f.vx) : L.heading;
          f.heading = turnToward(f.heading, want, 6 * dt);
          f.phase += dt * (5 + Math.min(sp, 160) * 0.09);
        }
      }
      if (ray) {
        steer(ray, dt, Math.min(220, w * 0.26), 230);
        ray.flap += dt * (1.15 + (ray.v - ray.speed) * 0.04);
      }
      // Now and then a fish rises and rings the surface.
      if (rnd() < dt / 3.2 && schools.length) {
        const s = schools[Math.floor(rnd() * schools.length)];
        const f = s.fish[Math.floor(rnd() * s.fish.length)];
        ripple(f.x, f.y, 0.55, 26);
      }
      while (ripples.length && clock - ripples[0].t > 3) ripples.shift();
    };

    const draw = () => {
      if (!w) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const t = clock;

      // Glow from everything swimming underneath.
      const glow: number[] = [];
      for (const s of schools) for (const f of s.fish) glow.push(f.x, f.y, 34, 0.5);
      if (ray) glow.push(ray.x, ray.y, RAY_SPAN * 0.62, 0.42);

      for (const b of buckets) b.length = 0;
      const jump = SPACING * 0.62;
      for (let k = 0; k < gx.length; k++) {
        const x = gx[k], y = gy[k];
        let v = swell(x / 9, y / 9, t);
        for (const r of ripples) {
          const age = t - r.t, front = age * 230;
          const d = Math.hypot(x - r.x, y - r.y), off = d - front;
          if (off > r.width * 3 || off < -r.width * 3) continue;
          v += r.amp * Math.exp(-age * 1.2) * Math.exp(-(off * off) / (2 * r.width * r.width)) * Math.sin(off / 11);
        }
        let g = 0;
        for (let i = 0; i < glow.length; i += 4) {
          const dx = x - glow[i], R = glow[i + 2];
          if (dx > R || dx < -R) continue;
          const dy = y - glow[i + 1];
          if (dy > R || dy < -R) continue;
          const q = 1 - (dx * dx + dy * dy) / (R * R);
          if (q > 0) g += q * q * glow[i + 3];
        }
        const lift = Math.max(-1.3, Math.min(1.3, v + g * 0.6));
        const lvl = Math.min(1, Math.max(0, (0.1 + ((lift + 1) / 2) * 0.9) * fade[k] + g * 0.55));
        if (lvl < 0.03) continue;
        const b = Math.min(BUCKETS - 1, Math.round(lvl * (BUCKETS - 1)));
        buckets[b].push(x, y - lift * jump, DOT * (0.32 + 0.68 * lvl) + g * 0.7);
      }
      for (let b = 0; b < BUCKETS; b++) {
        const list = buckets[b];
        if (!list.length) continue;
        c.beginPath();
        for (let i = 0; i < list.length; i += 3) {
          c.moveTo(list[i] + list[i + 2], list[i + 1]);
          c.arc(list[i], list[i + 1], list[i + 2], 0, Math.PI * 2);
        }
        c.fillStyle = BUCKET_STYLE[b];
        c.fill();
      }

      // Fish and the ray, in fine bright dots (dimmer where they pass under the headline).
      const bright = new Path2D(), dim = new Path2D();
      const dot = (p: Path2D, x: number, y: number, r: number) => {
        p.moveTo(x + r, y);
        p.arc(x, y, r, 0, Math.PI * 2);
      };
      const fr = TIER === 2 ? 1.15 : 1;
      for (const s of schools)
        for (const f of s.fish) {
          const p = inText(f.x, f.y) < 1 ? dim : bright;
          const ch = Math.cos(f.heading), sh = Math.sin(f.heading), L = f.len;
          for (const [u, py] of FISH_PTS) {
            const lx = (0.5 - u) * L, ly = py * L + Math.sin(f.phase - u * 5.5) * (0.03 + 0.11 * u) * L;
            dot(p, f.x + lx * ch - ly * sh, f.y + lx * sh + ly * ch, fr);
          }
        }
      if (ray) {
        const p = inText(ray.x, ray.y) < 1 ? dim : bright;
        const ch = Math.cos(ray.heading), sh = Math.sin(ray.heading);
        const beat = 0.5 - 0.5 * Math.cos(ray.flap * 2.2);
        const { pts, a } = ray.shape;
        for (const q of pts) {
          const ly = q.y * (1 - 0.3 * Math.pow(q.w, 1.6) * beat);
          const lx = q.x - 0.06 * a * q.w * q.w * Math.sin(ray.flap * 2.2);
          dot(p, ray.x + lx * ch - ly * sh, ray.y + lx * sh + ly * ch, fr * 1.05);
        }
        for (let i = 1; i <= 14; i++) {
          const lx = -0.56 * a - i * a * 0.06, ly = Math.sin(ray.flap * 2.2 - i * 0.35) * i * 0.35;
          dot(p, ray.x + lx * ch - ly * sh, ray.y + lx * sh + ly * ch, fr * (1 - i * 0.04));
        }
      }
      c.fillStyle = "rgba(236, 251, 255, 0.92)";
      c.fill(bright);
      c.fillStyle = "rgba(236, 251, 255, 0.42)";
      c.fill(dim);
    };

    let raf = 0, last = 0, visible = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) {
        last = now;
        return;
      }
      if (now - last < 1000 / FPS - 2) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      clock += dt;
      update(dt);
      draw();
    };

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const move = (e: PointerEvent) => {
      const [x, y] = local(e);
      pointer.x = x;
      pointer.y = y;
      pointer.at = clock;
      const d = Math.hypot(x - pointer.lastX, y - pointer.lastY);
      if (d > 20 && clock - pointer.lastRipple > 0.06) {
        // A wake: faster strokes make bigger ripples.
        const speed = d / Math.max(0.016, clock - pointer.lastRipple);
        ripple(x, y, Math.min(0.9, 0.2 + speed / 2200), 26);
        pointer.lastX = x;
        pointer.lastY = y;
        pointer.lastRipple = clock;
      }
    };
    const down = (e: PointerEvent) => {
      const [x, y] = local(e);
      pointer.x = x;
      pointer.y = y;
      pointer.at = clock;
      ripple(x, y, 1.5, 44);
    };

    if (import.meta.env.DEV) (window as unknown as { __rqSea: object }).__rqSea = { step: (sec: number) => { for (let i = 0; i < sec * 30; i++) { clock += 1 / 30; update(1 / 30); } draw(); } };
    layout();
    if (REDUCED_MOTION) {
      clock = 4;
      draw();
    } else {
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerdown", down);
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => {
      layout();
      draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", down);
    };
  }, []);

  return <canvas ref={ref} className="hero-sea" aria-hidden="true" />;
}
