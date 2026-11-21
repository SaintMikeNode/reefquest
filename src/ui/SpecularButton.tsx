import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LITE } from "../lib/device";

// A pill whose edge catches the light, with a highlight that glides toward the cursor: React Bits'
// "Specular Button" (MIT + Commons Clause, reactbits.dev; Tulio's pick), ported to TypeScript and to
// our style. It can render as a link or a span (our main calls to action are links). The rim is drawn
// by a small WebGL2 shader on a canvas behind the label; it only redraws while the light moves.
// Lite devices, browsers without WebGL2 and reduced motion (no gliding) still get the plain pill.

const PAD = 24;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uCenter, uHalf, uEntry, uWindow;
uniform float uRadius, uPx, uSpot, uIntensity, uThickness, uGlow;
uniform vec3 uLineColor, uBaseColor;
out vec4 outColor;
float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float loopPosition(vec2 p, vec2 b, float r) {
  vec2 inner = b - r;
  float arc = 1.5707963 * r;
  float quarter = inner.x + inner.y + arc;
  vec2 a = abs(p);
  vec2 q = a - inner;
  float s = q.x > 0.0 && q.y > 0.0 ? inner.y + atan(q.y, q.x) * r : (q.x > q.y ? min(a.y, inner.y) : inner.y + arc + inner.x - min(a.x, inner.x));
  if (p.x < 0.0) s = p.y >= 0.0 ? 2.0 * quarter - s : 2.0 * quarter + s;
  else if (p.y < 0.0) s = 4.0 * quarter - s;
  return s / max(4.0 * quarter, 0.0001);
}
float lobe(float position, float center) {
  float gap = abs(fract(position - center + 0.5) - 0.5);
  return 1.0 - smoothstep(uWindow.x, uWindow.x + uWindow.y, gap);
}
void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = roundedBox(p, uHalf, uRadius);
  float position = loopPosition(p, uHalf, uRadius);
  float key = lobe(position, uSpot);
  float back = lobe(position, uSpot + 0.5);
  float streak = key + back * 0.45;
  float width = max(uThickness * uPx * mix(1.0, max(key, back), 0.6), 0.35);
  float band = smoothstep(-width - 0.6, -width + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float hair = smoothstep(-uPx - 0.6, -uPx + 0.6, d) * (1.0 - smoothstep(-0.6, 0.6, d));
  float inside = 1.0 - smoothstep(-0.6, 0.6, d);
  vec2 pool = (p - uEntry) / (uHalf.y * vec2(1.6, 1.1));
  float glow = streak * 0.2 * exp(-abs(d + width * 0.5) / (5.0 * uPx)) + inside * 0.08 * exp(-dot(pool, pool));
  float light = clamp((band * streak + glow * uGlow) * uIntensity, 0.0, 1.0);
  vec4 base = vec4(uBaseColor, 1.0) * hair * 0.6;
  outColor = vec4(uLineColor, 1.0) * light + base * (1.0 - light);
}`;

const UNIFORMS = ["uCenter", "uHalf", "uRadius", "uPx", "uSpot", "uEntry", "uLineColor", "uBaseColor", "uIntensity", "uWindow", "uThickness", "uGlow"] as const;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrap = (v: number) => v - Math.floor(v);

/** Position (0..1) along a rounded rectangle's outline, matching the shader. */
function loopPosition(x: number, y: number, halfX: number, halfY: number, r: number) {
  const innerX = halfX - r, innerY = halfY - r, arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  const ax = Math.abs(x), ay = Math.abs(y), qx = ax - innerX, qy = ay - innerY;
  let s: number;
  if (qx > 0 && qy > 0) s = innerY + Math.atan2(qy, qx) * r;
  else if (qx > qy) s = Math.min(ay, innerY);
  else s = innerY + arc + innerX - Math.min(ax, innerX);
  if (x < 0) s = y >= 0 ? 2 * quarter - s : 2 * quarter + s;
  else if (y < 0) s = 4 * quarter - s;
  return wrap(s / Math.max(4 * quarter, 0.0001));
}
/** The outline point at a loop position. */
function rimPoint(position: number, halfX: number, halfY: number, r: number): [number, number] {
  const innerX = halfX - r, innerY = halfY - r, arc = (Math.PI / 2) * r;
  const quarter = innerX + innerY + arc;
  let s = wrap(position) * 4 * quarter, sx = 1, sy = 1;
  if (s > 3 * quarter) (s = 4 * quarter - s), (sy = -1);
  else if (s > 2 * quarter) (s -= 2 * quarter), (sx = -1), (sy = -1);
  else if (s > quarter) (s = 2 * quarter - s), (sx = -1);
  let x = innerX - (s - innerY - arc), y = halfY;
  if (s <= innerY) (x = halfX), (y = s);
  else if (s <= innerY + arc) {
    const a = (s - innerY) / Math.max(r, 0.0001);
    x = innerX + Math.cos(a) * r;
    y = innerY + Math.sin(a) * r;
  }
  return [x * sx, y * sy];
}
function link(gl: WebGL2RenderingContext) {
  const make = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    gl.deleteShader(s);
    return null;
  };
  const v = make(gl.VERTEX_SHADER, VERTEX), f = make(gl.FRAGMENT_SHADER, FRAGMENT), p = gl.createProgram();
  if (!v || !f || !p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, "aPosition");
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (gl.getProgramParameter(p, gl.LINK_STATUS)) return p;
  gl.deleteProgram(p);
  return null;
}

export interface SpecularProps {
  children: ReactNode;
  href?: string; // renders a link
  as?: "button" | "span"; // without href: a button, or a span inside a larger link
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  lineColor?: string; // the light on the rim
  baseColor?: string; // the faint rim at rest
  intensity?: number;
  idleIntensity?: number; // brightness when the cursor is far
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  proximity?: number; // px from the button where the light starts to follow
  "aria-label"?: string;
  title?: string;
}

export function SpecularButton({
  children, href, as = "button", onClick, className = "", style,
  lineColor = "#ffffff", baseColor = "#bfe0ff", intensity = 1, idleIntensity = 0.45,
  shineSize = 12, shineFade = 40, thickness = 1.3, glow = 1, proximity = 260, ...aria
}: SpecularProps) {
  const ref = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = { lineColor, baseColor, intensity, idleIntensity: clamp(idleIntensity, 0, 1), shineSize, shineFade, thickness, glow, proximity: Math.max(1, proximity) };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const host = ref.current, canvas = canvasRef.current;
    if (LITE || !host || !canvas) return;
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return;
    const program = link(gl);
    if (!program) return;
    const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const colors = new Map<string, number[]>();
    const view = { width: 1, height: 1, ratio: 1 };
    const pointer = { x: 0, y: 0, known: false };
    const state = { spot: 0, level: 0, press: 0, ready: false };
    let raf = 0, last = 0, visible = true;
    const toRgb = (value: string) => {
      if (colors.has(value)) return colors.get(value)!;
      let rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      colors.set(value, rgb);
      return rgb;
    };
    const radius = () => Math.min(view.width / 2, view.height / 2); // a pill
    const restSpot = () => {
      const r = radius(), inset = r * (1 - Math.SQRT1_2);
      return loopPosition(inset - view.width / 2, view.height / 2 - inset, view.width / 2, view.height / 2, r);
    };
    const aim = () => {
      const s = settingsRef.current;
      if (!pointer.known || reduce) return null;
      const rect = host.getBoundingClientRect();
      const scale = rect.width / view.width || 1;
      const hx = view.width / 2, hy = view.height / 2;
      const x = (pointer.x - rect.left - rect.width / 2) / scale, y = (rect.top + rect.height / 2 - pointer.y) / scale;
      const dist = Math.hypot(Math.max(Math.abs(x) - hx, 0), Math.max(Math.abs(y) - hy, 0));
      const t = clamp(1 - dist / s.proximity, 0, 1);
      const near = t * t * (3 - 2 * t);
      const nearest = loopPosition(x, y, hx, hy, radius());
      if (dist > 0) return { spot: nearest, near };
      const depth = clamp(Math.min(hx - Math.abs(x), hy - Math.abs(y)) / (hy * 0.8), 0, 1);
      const sway = restSpot() - (x / hx) * 0.06 - (y / hy) * 0.02;
      const off = sway - nearest - Math.round(sway - nearest);
      return { spot: wrap(nearest + off * depth * depth * (3 - 2 * depth)), near };
    };
    const draw = () => {
      const s = settingsRef.current, { width, height } = view;
      const kx = canvas.width / (width + PAD * 2), ky = canvas.height / (height + PAD * 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      const r = radius();
      gl.uniform2f(u.uCenter, (PAD + width / 2) * kx, (PAD + height / 2) * ky);
      gl.uniform2f(u.uHalf, (width / 2) * kx, (height / 2) * ky);
      gl.uniform1f(u.uRadius, r * kx);
      gl.uniform1f(u.uPx, view.ratio);
      const [rx, ry] = rimPoint(state.spot, width / 2, height / 2, r);
      const pull = 1 - Math.min(0.35 * (height / 2), Math.hypot(rx, ry)) / Math.max(Math.hypot(rx, ry), 0.0001);
      gl.uniform1f(u.uSpot, state.spot);
      gl.uniform2f(u.uEntry, rx * pull * kx, ry * pull * ky);
      gl.uniform3fv(u.uLineColor, toRgb(s.lineColor));
      gl.uniform3fv(u.uBaseColor, toRgb(s.baseColor));
      gl.uniform1f(u.uIntensity, s.intensity * (state.level + state.press * 0.8));
      gl.uniform2f(u.uWindow, s.shineSize / 360 + state.press * 0.06, s.shineFade / 360 + 0.0001);
      gl.uniform1f(u.uThickness, s.thickness);
      gl.uniform1f(u.uGlow, s.glow);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };
    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = aim();
      if (!state.ready) {
        state.spot = restSpot();
        state.level = s.idleIntensity;
        state.ready = true;
      }
      let diff = (target && target.near > 0 ? target.spot : restSpot()) - state.spot;
      diff -= Math.round(diff);
      state.spot = wrap(state.spot + diff * (1 - Math.exp(-dt * 8)));
      const level = s.idleIntensity + (1 - s.idleIntensity) * (target ? target.near : 0);
      state.level += (level - state.level) * (1 - Math.exp(-dt * 7));
      state.press *= Math.exp(-dt * 5);
      draw();
      if (Math.abs(diff) > 0.0002 || Math.abs(level - state.level) > 0.001 || state.press > 0.002) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };
    const measure = () => {
      // The canvas is positioned from the padding box (inside any border): measure that box.
      view.width = Math.max(1, host.clientWidth);
      view.height = Math.max(1, host.clientHeight);
      view.ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.max(1, Math.round((view.width + PAD * 2) * view.ratio));
      canvas.height = Math.max(1, Math.round((view.height + PAD * 2) * view.ratio));
      if (state.ready) draw();
      wake();
    };
    const move = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.known = true;
      wake();
    };
    const down = (e: PointerEvent) => {
      move(e);
      state.press = 1;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      pointer.known = false;
      wake();
    };
    const leave = () => {
      pointer.known = false;
      wake();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) (last = 0), wake();
    });
    io.observe(host);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", end, { passive: true });
    addEventListener("pointercancel", end, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    host.addEventListener("pointerdown", down);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      document.documentElement.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointerdown", down);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext(); // only once really gone (dev runs effects twice)
    };
  }, []);

  const cls = `specular ${className}`.trim();
  const inner = (
    <>
      <canvas ref={canvasRef} className="specular-light" aria-hidden="true" />
      <span className="specular-label">{children}</span>
    </>
  );
  if (href)
    return (
      <a ref={(el) => void (ref.current = el)} href={href} className={cls} style={style} onClick={onClick} {...aria}>
        {inner}
      </a>
    );
  if (as === "span")
    return (
      <span ref={(el) => void (ref.current = el)} className={cls} style={style} {...aria}>
        {inner}
      </span>
    );
  return (
    <button ref={(el) => void (ref.current = el)} type="button" className={cls} style={style} onClick={onClick} {...aria}>
      {inner}
    </button>
  );
}
