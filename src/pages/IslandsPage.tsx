import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { Fragment, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { accent, fmtNum, useLang, useT } from "../i18n";
import { loadLatest, loadSceneMeta, type Latest, type SceneMeta } from "../lib/data";
import { LITE, REDUCED_MOTION, pick } from "../lib/device";
import { ISLAND_ORDER, SCENE_ISLANDS } from "../lib/islands";
import { href } from "../lib/router";
import { AlertChip } from "../ui/AlertChip";
import { IconArrow } from "../ui/Icons";
import { SpecularButton } from "../ui/SpecularButton";
import { allPhotos, DomeGallery } from "../ui/AllPhotos";
import { usePhotos } from "../ui/PhotoStrip";
import { HAS_WEBGL } from "../webgl";

// "Explore the islands in 3D": one card per island with a live 3D preview of its relief and reef
// shelf, turning slowly over a light that rises from the deep (our take on a "shader card"). Hover
// lifts the light, speeds the turn and swings the camera toward the pointer; the card opens the
// island. All the previews share ONE WebGL canvas (each card's stage is a scissored region of it),
// so phones hold a single context. The canvas lies in the page over the cards and scrolls with
// them: it is not fixed to the screen, because phones scroll the page without waiting for the next
// redraw and a fixed canvas left the islands behind, drawn outside their cards. The meshes are
// coarse (≤ ~45k triangles each, deep water dropped) and built from the island scene's own
// terrain.png, so a later visit is cached. Lite devices and reduced motion draw still frames,
// redrawn only when the layout changes or a card is hovered.

const STILL = LITE || REDUCED_MOTION;
// Only the islands with a 3D scene (Cayos Cochinos has no detailed data yet), side by side.
const SHOWN = ISLAND_ORDER.filter((id) => SCENE_ISLANDS.has(id));
const GRID = pick(96, 150, 210); // columns sampled from the heightmap

// The light behind each island: core and edge colors.
const GLOW: Record<string, [string, string]> = {
  roatan: ["#8ff8ff", "#1b8dff"],
  utila: ["#9dffe0", "#10a894"],
  guanaja: ["#b9ceff", "#4560ff"],
  "cayos-cochinos": ["#ffd0c2", "#ff6d5f"],
};

interface Preview {
  geo: THREE.BufferGeometry;
  radius: number;
  landTop: number; // m, for the contour interval
}
const previews = new Map<string, Promise<Preview>>();

/** A coarse 3D tile of an island: land and reef shelf, with deep water fading out. */
function loadPreview(id: string): Promise<Preview> {
  if (!previews.has(id)) previews.set(id, buildPreview(id));
  return previews.get(id)!;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function buildPreview(id: string): Promise<Preview> {
  const meta: SceneMeta = await loadSceneMeta(id);
  const blob = await fetch(`/data/${id}/${meta.terrain.file}`).then((r) => {
    if (!r.ok) throw new Error(`${id}: ${r.status}`);
    return r.blob();
  });
  const img = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, img.width, img.height).data;
  const W = img.width, H = img.height;
  const heightAt = (i: number, j: number) => {
    const k = (j * W + i) * 4;
    return (px[k] * 256 + px[k + 1]) / 10 - 3000;
  };

  const step = Math.max(1, Math.ceil(W / GRID));
  const cols = Math.floor((W - 1) / step) + 1, rows = Math.floor((H - 1) / step) + 1;
  const [sx, sz] = meta.size_m;
  const scale = 4 / Math.max(sx, sz);
  const landTop = Math.max(150, meta.terrain.max_m);
  // Distance to the nearest land (m, chamfer transform on the sampled grid): the preview keeps the
  // reef within a margin of the coast, so small cays aren't lost in a wide shallow bank (Cayos Cochinos).
  const cell = (step * Math.max(sx, sz)) / (Math.max(W, H) - 1);
  const D = Math.SQRT2;
  // Distance (m) from each sample to the nearest sample where `seed` holds (two-pass chamfer).
  const chamfer = (seed: (k: number) => boolean) => {
    const out = new Float32Array(cols * rows);
    for (let k = 0; k < out.length; k++) out[k] = seed(k) ? 0 : 1e9;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (i > 0) out[k] = Math.min(out[k], out[k - 1] + cell);
        if (j > 0) {
          out[k] = Math.min(out[k], out[k - cols] + cell);
          if (i > 0) out[k] = Math.min(out[k], out[k - cols - 1] + cell * D);
          if (i < cols - 1) out[k] = Math.min(out[k], out[k - cols + 1] + cell * D);
        }
      }
    for (let j = rows - 1; j >= 0; j--)
      for (let i = cols - 1; i >= 0; i--) {
        const k = j * cols + i;
        if (i < cols - 1) out[k] = Math.min(out[k], out[k + 1] + cell);
        if (j < rows - 1) {
          out[k] = Math.min(out[k], out[k + cols] + cell);
          if (i < cols - 1) out[k] = Math.min(out[k], out[k + cols + 1] + cell * D);
          if (i > 0) out[k] = Math.min(out[k], out[k + cols - 1] + cell * D);
        }
      }
    return out;
  };
  const raw = new Float32Array(cols * rows);
  let l0 = Infinity, l1 = -Infinity, m0 = Infinity, m1 = -Infinity;
  for (let j = 0, k = 0; j < rows; j++)
    for (let i = 0; i < cols; i++, k++) {
      raw[k] = heightAt(i * step, j * step);
      if (raw[k] > 0) (l0 = Math.min(l0, i)), (l1 = Math.max(l1, i)), (m0 = Math.min(m0, j)), (m1 = Math.max(m1, j));
    }
  const dist = chamfer((k) => raw[k] > 0);
  // Low strips at or just under sea level that cross an island (Guanaja's lowlands and canal) would
  // draw as coastline and split it into separate islands at this coarse scale. Close the land mask
  // (grow it, then shrink it back) and raise the very shallow water it covers to low land.
  const CLOSE = 450; // m
  const open = chamfer((k) => dist[k] > CLOSE);
  for (let k = 0; k < raw.length; k++) if (raw[k] <= 0 && raw[k] > -6 && open[k] > CLOSE) (raw[k] = 1.5), (dist[k] = 0);
  const margin = Math.max(1800, 0.3 * Math.max(l1 - l0, m1 - m0) * cell);
  const pos = new Float32Array(cols * rows * 3);
  const alpha = new Float32Array(cols * rows); // how visible each vertex is
  const meters = new Float32Array(cols * rows); // height (m), for contours and the coastline
  for (let j = 0, k = 0; j < rows; j++)
    for (let i = 0; i < cols; i++, k++) {
      const h = raw[k];
      const d = -h;
      // Height: islands lifted to a similar scale (stylized), shelf shallow, deep water compressed.
      const y = h > 0 ? 0.3 * Math.pow(h / landTop, 0.85) : -0.12 * Math.pow(Math.min(1, d / 60), 0.7) - 0.05 * Math.min(1, Math.max(0, d - 60) / 300);
      pos[k * 3] = ((i * step) / (W - 1) - 0.5) * sx * scale;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = ((j * step) / (H - 1) - 0.5) * sz * scale;
      // Fade deep water, and fade toward the tile's edges (shallow banks like Utila's reach them).
      const eu = Math.abs((i * step) / (W - 1) - 0.5) * 2, ev = Math.abs((j * step) / (H - 1) - 0.5) * 2;
      const edge = 1 - smooth(0.7, 0.97, Math.pow(Math.pow(eu, 4) + Math.pow(ev, 4), 0.25));
      const near = 1 - smooth(margin * 0.35, margin, dist[k]);
      alpha[k] = (h > 0 ? 1 : 1 - smooth(35, 135, d)) * edge * near;
      meters[k] = h;
    }
  // Triangles: only where something is visible (the open ocean is dropped).
  const idx: number[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if (alpha[a] + alpha[b] + alpha[c] + alpha[d] < 0.02) continue;
      idx.push(a, c, b, b, c, d);
      for (const v of [a, d]) {
        minX = Math.min(minX, pos[v * 3]);
        maxX = Math.max(maxX, pos[v * 3]);
        minZ = Math.min(minZ, pos[v * 3 + 2]);
        maxZ = Math.max(maxZ, pos[v * 3 + 2]);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aMeters", new THREE.BufferAttribute(meters, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.translate(-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2);
  return { geo, radius: Math.hypot(maxX - minX, maxZ - minZ) / 2, landTop };
}

// The rising light: noise flowing upward, shaped into a soft column, with faint contour lines (like
// depth lines on a chart) and grain. Drawn as a full-view quad behind the island.
const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const glowFragment = /* glsl */ `
uniform float uTime, uHover, uIntro, uAspect;
uniform vec3 uCore, uEdge;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  float x = (uv.x - 0.5) * uAspect;
  float t = uTime;
  float n = fbm(vec2(x * 2.4, uv.y * 2.0 - t * 0.42));
  float n2 = fbm(vec2(x * 5.0 + 3.1, uv.y * 4.2 - t * 0.8));
  float top = (0.78 + 0.22 * uHover) * uIntro;
  float width = (0.36 + 0.12 * uHover) * (0.85 + 0.3 * n);
  float body = exp(-pow(x / width, 2.0));
  float rise = 1.0 - smoothstep(0.0, max(top, 0.001), uv.y + (n - 0.5) * 0.34);
  float core = body * rise * (0.72 + 0.56 * n2);
  float field = core * 3.2 + n * 0.7 - t * 0.15;
  float line = 1.0 - smoothstep(0.02, 0.07, abs(fract(field * 2.2) - 0.5));
  vec3 col = mix(uEdge, uCore, smoothstep(0.12, 0.85, core));
  col += pow(core, 3.0) * 0.4;
  float a = clamp(core * (1.1 + 0.35 * uHover), 0.0, 1.0);
  a = clamp(a + line * core * 0.22, 0.0, 1.0);
  a *= smoothstep(0.0, 0.16, uv.y);
  col += (hash(uv * vec2(913.0, 677.0) + fract(t * 7.0)) - 0.5) * 0.07;
  gl_FragColor = vec4(col * a, a);
}`;

// Blueprint look: the relief as glowing lines on a nearly clear surface: a survey grid draped over
// it, contour lines on land, depth lines on the shelf (closer together in the shallows), a bright coastline, and a
// faint rim where slopes turn away. Lines are antialiased with screen-space derivatives.
const bpVertex = /* glsl */ `
attribute float aAlpha, aMeters;
varying float vAlpha, vM;
varying vec2 vXZ;
varying vec3 vN, vV;
void main() {
  vAlpha = aAlpha;
  vM = aMeters;
  vXZ = position.xz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const bpFragment = /* glsl */ `
uniform vec3 uLine, uSea, uCoast;
uniform float uGrid, uLandStep, uHover;
varying float vAlpha, vM;
varying vec2 vXZ;
varying vec3 vN, vV;
float lines(float v, float width) {
  float d = fwidth(v);
  float g = abs(fract(v - 0.5) - 0.5) / max(d, 1e-5);
  return 1.0 - clamp(g - width + 1.0, 0.0, 1.0);
}
void main() {
  bool land = vM > 0.0;
  float grid = max(lines(vXZ.x * uGrid, 0.6), lines(vXZ.y * uGrid, 0.6));
  float contour = land ? lines(vM / uLandStep, 0.9) : lines(sqrt(max(-vM, 0.0)) / 1.15, 0.8);
  float coast = 1.0 - smoothstep(0.0, fwidth(vM) * 1.6 + 0.01, abs(vM));
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  vec3 col = land ? uLine : uSea;
  float a = grid * (land ? 0.32 : 0.2) + contour * (land ? 0.8 : 0.55) + rim * (land ? 0.35 : 0.1) + (land ? 0.07 : 0.02);
  col = mix(col, uCoast, coast);
  a = max(a, coast);
  a *= vAlpha * (0.85 + 0.25 * uHover);
  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`;

interface Hover {
  on: number; // 0 or 1, from the card
  x: number; // pointer across the card, -1..1
  y: number;
  k: number; // smoothed hover
}

/** A card's preview: the stage element its region of the canvas follows, and the pointer over the card. */
interface Slot {
  el: HTMLElement | null;
  hover: Hover;
}

/**
 * One island's preview, in its own scene (a portal) with its own camera, drawn into its card's
 * stage. The stage and the canvas are measured at the same moment, so the region is right however
 * far the page has scrolled.
 */
function Stage({ id, slot }: { id: string; slot: Slot }) {
  const [p, setP] = useState<Preview | null>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let live = true;
    loadPreview(id)
      .then((v) => live && (setP(v), invalidate()))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, invalidate]);

  const cam = useMemo(() => new THREE.PerspectiveCamera(28, 1, 0.05, 60), []);
  const turn = useRef<THREE.Group>(null);
  const born = useRef(-1);
  const glow = useMemo(() => {
    const [core, edge] = GLOW[id] ?? GLOW.roatan;
    return new THREE.ShaderMaterial({
      vertexShader: glowVertex,
      fragmentShader: glowFragment,
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uIntro: { value: STILL ? 1 : 0 },
        uAspect: { value: 1 },
        uCore: { value: new THREE.Color(core) },
        uEdge: { value: new THREE.Color(edge) },
      },
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
  }, [id]);
  const land = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bpVertex,
        fragmentShader: bpFragment,
        uniforms: {
          uLine: { value: new THREE.Color("#d8f4ff") },
          uSea: { value: new THREE.Color("#7fdcff") },
          uCoast: { value: new THREE.Color("#ffffff") },
          uGrid: { value: 9 },
          uLandStep: { value: 30 },
          uHover: { value: 0 },
        },
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => {
    if (p) land.uniforms.uLandStep.value = Math.max(20, Math.round(p.landTop / 7 / 10) * 10);
  }, [p, land]);
  useEffect(() => () => (glow.dispose(), land.dispose()), [glow, land]);

  const startAngle = useMemo(() => ({ roatan: -0.35, utila: 0.4, guanaja: -0.9, "cayos-cochinos": 0.2 })[id] ?? 0, [id]);
  // Priority 1: R3F leaves the drawing to us, and each preview draws only its own region.
  useFrame((state, dt) => {
    const r = slot.el?.getBoundingClientRect();
    if (!r || r.width < 1 || r.height < 1) return;
    // Animated, a card more than a screen away is skipped; still frames draw every card, since
    // they are only redrawn when the layout changes.
    if (!STILL && (r.bottom < -innerHeight || r.top > 2 * innerHeight)) return;
    const h = slot.hover;
    h.k += (h.on - h.k) * Math.min(1, dt * 4);
    const t = state.clock.elapsedTime;
    if (born.current < 0) born.current = t;
    const u = glow.uniforms;
    const aspect = r.width / r.height;
    u.uTime.value = STILL ? 3 : t;
    u.uHover.value = h.k;
    land.uniforms.uHover.value = h.k;
    if (!STILL) u.uIntro.value = Math.min(1, (t - born.current) / 1.6) ** 0.6;
    u.uAspect.value = aspect;
    if (cam.aspect !== aspect) (cam.aspect = aspect), cam.updateProjectionMatrix();
    if (turn.current && !STILL) turn.current.rotation.y += dt * (0.09 + 0.3 * h.k);
    if (p) {
      // Orbit a little toward the pointer, the way a tilted card would.
      const az = h.x * 0.35 * h.k, el = 0.92 - h.y * 0.12 * h.k;
      const dist = (p.radius / Math.sin((28 * Math.PI) / 360)) * 0.88;
      cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
      cam.lookAt(0, p.radius * 0.16, -p.radius * 0.1); // the island sits low, inside the light
    }
    // The stage's rectangle of the canvas, from its bottom-left corner in CSS pixels. With the
    // scissor on, the renderer's clear only empties this rectangle.
    const { gl } = state;
    const c = gl.domElement.getBoundingClientRect();
    const x = r.left - c.left, y = c.bottom - r.bottom;
    gl.setViewport(x, y, r.width, r.height);
    gl.setScissor(x, y, r.width, r.height);
    gl.setScissorTest(true);
    gl.render(state.scene, cam);
    gl.setScissorTest(false);
  }, 1);

  return (
    <>
      <mesh material={glow} frustumCulled={false} renderOrder={-1}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      {p && (
        <group ref={turn} rotation-y={startAngle}>
          <mesh geometry={p.geo} material={land} />
        </group>
      )}
    </>
  );
}

/** Inside the shared canvas: a scene per island, and the redraw the cards ask for with still frames. */
function Previews({ slots, redraw }: { slots: Record<string, Slot>; redraw: React.RefObject<() => void> }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    redraw.current = () => invalidate();
    invalidate();
    return () => {
      redraw.current = () => {};
    };
  }, [invalidate, redraw]);
  const scenes = useMemo(() => SHOWN.map(() => new THREE.Scene()), []);
  return (
    <>
      {SHOWN.map((id, i) => (
        <Fragment key={id}>{createPortal(<Stage id={id} slot={slots[id]} />, scenes[i])}</Fragment>
      ))}
    </>
  );
}

function IslandCard({ id, latest, meta, slot, redraw }: { id: string; latest: Latest | null; meta: SceneMeta | undefined; slot: Slot; redraw: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const hover = slot.hover;
  const s = latest?.islands[id];
  const open = SCENE_ISLANDS.has(id) && HAS_WEBGL;
  const name = s?.name ?? meta?.name ?? id;
  const worst = s ? s.year_max_dhw.indexOf(Math.max(...s.year_max_dhw)) : -1;
  const b = meta?.bounds_lonlat;
  const where = b ? `${fmtNum((b.south + b.north) / 2, lang, 2)}° N · ${fmtNum(-(b.west + b.east) / 2, lang, 2)}° ${lang === "es" ? "O" : "W"}` : "";

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = ((e.clientY - r.top) / r.height) * 2 - 1;
    hover.x = x;
    hover.y = y;
    e.currentTarget.style.setProperty("--px", x.toFixed(3));
    e.currentTarget.style.setProperty("--py", y.toFixed(3));
  };
  const body = (
    <>
      <div className="isle-stage">{HAS_WEBGL ? <div className="isle-view" ref={(el) => void (slot.el = el)} /> : <div className="isle-fallback" />}</div>
      <div className="isle-body">
        <p className="isle-where num">{where}</p>
        <h2>{name}</h2>
        {s && (
          <p className="isle-status">
            <AlertChip dhw={s.dhw} /> <span className="num">{fmtNum(s.dhw, lang)} {t("unit.dhw")}</span>
          </p>
        )}
        {/* Something to look forward to before the record year: how much reef the Allen Coral Atlas maps around it. */}
        {meta?.reef_km2 != null && (
          <p className="isle-reef">
            <i aria-hidden="true" /> {t("isles.reef").replace("{n}", fmtNum(meta.reef_km2, lang, 0))}
          </p>
        )}
        {s && worst >= 0 && (
          <p className="isle-worst">
            {t("card.record")}: <span className="num">{latest!.years[worst]} ({fmtNum(s.year_max_dhw[worst], lang)})</span>
          </p>
        )}
        {open && (
          <SpecularButton as="span" className="btn primary small" lineColor="#ffffff" baseColor="#bfe0ff">
            {t("home.enter3d")} <IconArrow />
          </SpecularButton>
        )}
      </div>
    </>
  );
  const handlers = {
    onPointerEnter: () => ((hover.on = 1), redraw()),
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      hover.on = 0;
      redraw();
      e.currentTarget.style.setProperty("--px", "0");
      e.currentTarget.style.setProperty("--py", "0");
    },
    onPointerMove: onMove,
    // Still frames: draw again once the card has finished lifting or settling.
    onTransitionEnd: redraw,
  };
  return open ? (
    <a className="isle-card" href={href.island(id)} {...handlers}>
      {body}
    </a>
  ) : (
    <div className="isle-card" {...handlers}>
      {body}
    </div>
  );
}

/**
 * The fourth card: the photos. Same frosted card and blueprint floor as the islands; its preview is
 * a ring of reef photos turning slowly in CSS 3D (eight small 240 px images, loaded right away:
 * lazy images inside 3D transforms never load). It opens the dome of every photo.
 */
function PhotosCard() {
  const t = useT();
  const index = usePhotos();
  const [open, setOpen] = useState(false);
  const photos = useMemo(() => (index ? allPhotos(index) : []), [index]);
  const ring = photos.slice(0, 8);
  return (
    <>
      <button type="button" className="isle-card photos-card" onClick={() => setOpen(true)} disabled={!index}>
        <div className="isle-stage" aria-hidden="true">
          <div className="pc-ring">
            {ring.map((p, i) => (
              <img key={p.id} src={p.src.s} alt="" decoding="async" draggable={false} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
        </div>
        <div className="isle-body">
          <p className="isle-where num">{index ? t("photos.cardCount").replace("{n}", String(photos.length)) : "\u00a0"}</p>
          <h2>{t("photos.label")}</h2>
          <p className="isle-status">{t("photos.cardFrom")}</p>
          <p className="isle-worst">{t("photos.cardLicense")}</p>
          <SpecularButton as="span" className="btn primary small" lineColor="#ffffff" baseColor="#bfe0ff">
            {t("home.enter3d")} <IconArrow />
          </SpecularButton>
        </div>
      </button>
      {open && (
        <Suspense fallback={null}>
          <DomeGallery photos={photos} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

export function IslandsPage() {
  const t = useT();
  const [latest, setLatest] = useState<Latest | null>(null);
  const [metas, setMetas] = useState<Record<string, SceneMeta>>({});
  useEffect(() => {
    loadLatest().then(setLatest).catch(() => {});
    for (const id of SHOWN)
      loadSceneMeta(id)
        .then((m) => setMetas((all) => ({ ...all, [id]: m })))
        .catch(() => {});
  }, []);

  // Each card's stage and pointer, shared with the canvas; and its redraw, for still frames.
  const slots = useMemo(
    () => Object.fromEntries(SHOWN.map((id) => [id, { el: null, hover: { on: 0, x: 0, y: 0, k: 0 } } as Slot])),
    [],
  );
  const redraw = useRef<() => void>(() => {});
  const grid = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  // The canvas lies over the island stages only (with room for a card's hover lift), not the whole
  // grid: on phones the cards are one column, and a canvas over all of it would be a lot of pixels.
  useLayoutEffect(() => {
    const g = grid.current, l = layer.current;
    if (!g || !l) return;
    const PAD = 12;
    const fit = () => {
      const top0 = g.getBoundingClientRect().top;
      let top = Infinity, bottom = -Infinity;
      for (const id of SHOWN) {
        const r = slots[id].el?.getBoundingClientRect();
        if (r) (top = Math.min(top, r.top)), (bottom = Math.max(bottom, r.bottom));
      }
      if (!(bottom > top)) return;
      l.style.top = `${Math.floor(top - top0) - PAD}px`;
      l.style.height = `${Math.ceil(bottom - top) + 2 * PAD}px`;
      redraw.current();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(g);
    for (const id of SHOWN) if (slots[id].el) ro.observe(slots[id].el!);
    return () => ro.disconnect();
  }, [slots]);
  const redrawNow = () => redraw.current();

  return (
    <div className="sea-bg islands-page">
      <main className="page">
        <header className="page-head page-band-head">
          <p className="eyebrow">{t("isles.kicker")}</p>
          <h1>{accent(t("isles.title"))}</h1>
          <p className="standfirst">{t("isles.lead")}</p>
        </header>
        <section className="section">
          <div className="isle-grid" ref={grid}>
            {SHOWN.map((id) => (
              <IslandCard key={id} id={id} latest={latest} meta={metas[id]} slot={slots[id]} redraw={redrawNow} />
            ))}
            <PhotosCard />
            {HAS_WEBGL && (
              <div className="isle-canvas" ref={layer} aria-hidden="true">
                <Canvas
                  frameloop={STILL ? "demand" : "always"}
                  dpr={pick<[number, number]>([1, 1], [1, 1.5], [1, 2])}
                  // No depth buffer: nothing here tests depth, and the canvas can be tall on phones.
                  gl={{ antialias: !LITE, alpha: true, depth: false, powerPreference: "high-performance" }}
                  // It scrolls with the page, so its place on screen changes all the time: don't re-measure on scroll.
                  resize={{ scroll: false }}
                  style={{ pointerEvents: "none" }}
                >
                  <Previews slots={slots} redraw={redraw} />
                </Canvas>
              </div>
            )}
          </div>
          <div className="isle-foot">
            <p className="fig-source isle-note">{t("isles.note")}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
