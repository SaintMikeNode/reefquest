import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { loadZoneIndex, zoneName, type ZoneIndexEntry } from "../boat/zone";
import { siteName, SITES } from "../content/sites";
import { useLang } from "../i18n";
import { MOBILE } from "../lib/device";
import { useScene } from "./sceneStore";
import { displayY, heightAt, lonLatToUV, uvToXZ, type TerrainData } from "./terrain";

// The clickable places on the island (story and dive-site pins), and a small survey boat at anchor
// at each one so people feel invited to click. Tech look, like a holographic chart marker: a solid
// faceted hull and cabin in dark navy with a glowing rim (fresnel), faint moving scan lines and
// bright edge lines, a radar bar spinning on its arch; on the water a white waterline, a target
// reticle (tick marks and a rotating dashed ring) and a sonar ping spreading out. The boat rides at
// anchor (heave, pitch, roll, slow swing), lights up when the mouse is over it, and clicking it
// opens the place like its pin does. Each stays about the same size on screen at any zoom.

/**
 * A clickable place on the island: a story or dive site (content/sites.ts), or a boat zone that has
 * no site in it (every zone in pipeline/zones.json gets a place, so Utila and Guanaja have theirs).
 */
export interface Pin {
  id: string;
  name: string;
  kind: "story" | "dive" | "zone";
  lon: number;
  lat: number;
  date?: string;
  x: number;
  y: number;
  z: number;
}

/** Story and dive-site anchor points for the pins (screen-space overlay) and the boats. */
export function pinList(td: TerrainData, lang: "es" | "en" = "en"): Pin[] {
  return SITES.filter((s) => s.island === td.meta.island).map((s) => anchor(td, { ...s, name: siteName(s, lang) }));
}
function anchor(td: TerrainData, p: Omit<Pin, "x" | "y" | "z">): Pin {
  const { u, v } = lonLatToUV(td, p.lon, p.lat);
  const { x, z } = uvToXZ(td, u, v);
  return { ...p, x, z, y: Math.max(displayY(heightAt(td, u, v)), 0) + (p.kind === "story" ? 9 : 4) };
}

const zoneCache = new Map<string, Promise<ZoneIndexEntry[]>>();
const inZone = (z: ZoneIndexEntry, lon: number, lat: number) =>
  Math.abs((lon - z.lon) * 111320 * Math.cos((lat * Math.PI) / 180)) < z.size_m[0] / 2 && Math.abs((lat - z.lat) * 110570) < z.size_m[1] / 2;

/** All clickable places on this island: its sites, plus a place for each boat zone without one. */
export function usePlaces(td: TerrainData): Pin[] {
  const lang = useLang((s) => s.lang);
  const island = td.meta.island;
  const [zones, setZones] = useState<ZoneIndexEntry[]>([]);
  useEffect(() => {
    let alive = true;
    if (!zoneCache.has(island)) zoneCache.set(island, loadZoneIndex(island).catch(() => []));
    zoneCache.get(island)!.then((z) => alive && setZones(z));
    return () => {
      alive = false;
    };
  }, [island]);
  return useMemo(() => {
    const sites = pinList(td, lang);
    const empty = zones.filter((z) => !sites.some((s) => inZone(z, s.lon, s.lat)));
    return [...sites, ...empty.map((z) => anchor(td, { id: `zone:${z.id}`, name: zoneName(z, lang), kind: "zone", lon: z.lon, lat: z.lat }))];
  }, [td, zones, lang]);
}

/** What clicking a pin or its boat does: open the place (fly there, jump to its date), or, for a
 * boat zone, head out on the research boat. */
export function openSite(s: Pin) {
  const st = useScene.getState();
  if (s.kind === "zone") {
    st.setBoat({ zone: s.id.slice(5), lon: s.lon, lat: s.lat });
    return;
  }
  st.setSite(s.id);
  st.fly(s.x, s.z, s.kind === "story" ? 70 : 50);
  if (s.date) {
    const y = Number(s.date.slice(0, 4));
    const d = Math.round((Date.parse(s.date + "T12:00:00Z") - Date.parse(`${y}-01-01T12:00:00Z`)) / 864e5);
    st.setYear(y, d);
  }
}

// ---- Geometry: a launch 1 scene unit long, bow toward −z, waterline at y = 0.
const DECK = 0.1;
// Hull stations from stern to bow: z, half-beam at the gunwale, gunwale height (sheer rises forward).
const STATIONS: [number, number, number][] = [
  [0.46, 0.17, DECK], [0.3, 0.19, DECK], [0.08, 0.2, DECK + 0.004], [-0.12, 0.19, DECK + 0.012],
  [-0.3, 0.15, DECK + 0.026], [-0.43, 0.085, DECK + 0.045], [-0.53, 0, DECK + 0.065],
];
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function hullGeometry(): THREE.BufferGeometry {
  // Each station's cross-section: gunwale, chine, keel (a V hull), mirrored.
  const sec = STATIONS.map(([z, b, gy]) => [v3(-b, gy, z), v3(-b * 0.78, -0.005, z), v3(0, -0.06, z), v3(b * 0.78, -0.005, z), v3(b, gy, z)]);
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < sec.length - 1; i++)
    for (let k = 0; k < 4; k++) {
      const a = sec[i][k], b = sec[i][k + 1], c = sec[i + 1][k + 1], d = sec[i + 1][k];
      tri(a, b, c);
      tri(a, c, d);
    }
  // Transom and deck (fan from the middle of the deck).
  const t = sec[0];
  tri(t[0], t[2], t[1]);
  tri(t[0], t[4], t[2]);
  tri(t[4], t[3], t[2]);
  const mid = v3(0, DECK, 0);
  const rim = [...sec.map((s) => s[4]), ...sec.slice().reverse().map((s) => s[0])];
  for (let i = 0; i < rim.length; i++) tri(mid, rim[(i + 1) % rim.length], rim[i]);
  // Cabin: a block with a raked windshield, aft of the pole.
  const prof = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(-0.02, 0), new THREE.Vector2(-0.08, 0.12), new THREE.Vector2(-0.3, 0.12)]);
  const cab = new THREE.ExtrudeGeometry(prof, { depth: 0.24, bevelEnabled: false });
  cab.rotateY(Math.PI / 2);
  cab.translate(-0.12, DECK, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const cabin = cab.toNonIndexed();
  cabin.deleteAttribute("uv");
  cabin.deleteAttribute("normal");
  const out = mergeGeometries([g, cabin])!;
  out.computeVertexNormals(); // non-indexed: flat, faceted shading
  return out;
}

function edgeLines(hull: THREE.BufferGeometry): THREE.BufferGeometry {
  const e = new THREE.EdgesGeometry(hull, 28);
  const pts = Array.from(e.attributes.position.array as Float32Array);
  // Radar arch over the cabin roof, and the antenna.
  const yt = DECK + 0.12;
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  seg(v3(-0.1, yt, 0.2), v3(-0.07, yt + 0.09, 0.2));
  seg(v3(-0.07, yt + 0.09, 0.2), v3(0.07, yt + 0.09, 0.2));
  seg(v3(0.07, yt + 0.09, 0.2), v3(0.1, yt, 0.2));
  seg(v3(0.05, yt + 0.09, 0.2), v3(0.05, yt + 0.2, 0.2));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** Arcs of a circle on the water, as line segments. */
function arcs(r: number, from: number[], to: number[], steps = 64): THREE.BufferGeometry {
  const pts: number[] = [];
  from.forEach((a0, i) => {
    const a1 = to[i], n = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * steps));
    for (let k = 0; k < n; k++) {
      const p = a0 + ((a1 - a0) * k) / n, q = a0 + ((a1 - a0) * (k + 1)) / n;
      pts.push(Math.cos(p) * r, 0, Math.sin(p) * r, Math.cos(q) * r, 0, Math.sin(q) * r);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function reticle(): THREE.BufferGeometry {
  // Four arcs with gaps on the axes, and eight ticks pointing outward.
  const q = Math.PI / 2, gap = 0.22;
  const ring = arcs(0.62, [0, 1, 2, 3].map((i) => i * q + gap), [0, 1, 2, 3].map((i) => (i + 1) * q - gap));
  const pts = Array.from(ring.attributes.position.array as Float32Array);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r0 = i % 2 ? 0.66 : 0.56, r1 = 0.74;
    pts.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const dashed = () => {
  const n = 36, from: number[] = [], to: number[] = [];
  for (let i = 0; i < n; i++) {
    from.push((i / n) * Math.PI * 2);
    to.push(((i + 0.5) / n) * Math.PI * 2);
  }
  return arcs(0.86, from, to, 180);
};

/** Waterline: where the hull's chine meets the sea, a little outside it (foam). */
function waterline(): THREE.BufferGeometry {
  const side = STATIONS.map(([z, b]) => v3(b * 0.86 + 0.012, 0, z));
  const loop = [...side, ...side.slice().reverse().map((p) => v3(-p.x, 0, p.z))];
  const pts: number[] = [];
  loop.forEach((p, i) => {
    const q = loop[(i + 1) % loop.length];
    pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

// Hologram body: dark navy, facets lit softly, a rim that glows in the boat's color (stronger when
// hovered) and thin scan lines drifting up.
function bodyMaterial(color: string) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uGlow: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uGlow; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec3 n = normalize(vN);
        float face = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(-0.3, 0.9, 0.35))), 0.0, 1.0);
        float rim = pow(1.0 - clamp(abs(dot(n, normalize(vV))), 0.0, 1.0), 2.2);
        float scan = smoothstep(0.35, 0.5, abs(fract(vY * 55.0 - uTime * 0.8) - 0.5));
        vec3 col = vec3(0.035, 0.09, 0.17) * face + uColor * 0.16 * face;
        col += uColor * rim * (0.75 + 0.9 * uGlow);
        col += uColor * scan * (0.07 + 0.1 * uGlow);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// Dev only: window.__rqBoatScale = 6 enlarges the boats to inspect them.
/** The "Dive sites" layer's visibility, eased 0..1 by IslandScene so boats and markers fade. */
export const sitesFade = { v: 1 };

const DEV_SCALE = () => (import.meta.env.DEV ? ((window as { __rqBoatScale?: number }).__rqBoatScale ?? 1) : 1);
const COLORS = { story: "#ff9a7c", dive: "#5ff2ff", zone: "#7dffb5" };
const EDGE = { story: "#ffd2c2", dive: "#c8fbff", zone: "#d4ffe6" };
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

interface Parts {
  root: THREE.Group;
  boat: THREE.Group;
  radar: THREE.Mesh;
  mirror: THREE.Group;
  dashes: THREE.LineSegments;
  ping: THREE.LineSegments;
  foam: THREE.LineSegments;
  body: THREE.ShaderMaterial;
  mats: { edge: THREE.LineBasicMaterial; hud: THREE.LineBasicMaterial; dash: THREE.LineBasicMaterial; ping: THREE.LineBasicMaterial; foam: THREE.LineBasicMaterial };
}

export function SiteBoats({ td }: { td: TerrainData }) {
  const sites = usePlaces(td);
  const geo = useMemo(() => {
    const hull = hullGeometry();
    return {
      hull,
      edges: edgeLines(hull),
      radar: new THREE.BoxGeometry(0.12, 0.012, 0.022),
      reticle: reticle(),
      dashes: dashed(),
      ping: arcs(1, [0], [Math.PI * 2], 72),
      foam: waterline(),
      hit: new THREE.SphereGeometry(0.62, 10, 8),
      hitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    };
  }, []);

  // One set of objects per place, built imperatively (a dozen boats; materials are per boat so each
  // can light up on its own when hovered).
  const parts = useMemo(
    () =>
      sites.map((s): Parts => {
        const color = COLORS[s.kind];
        const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
        const mats = {
          // Edges are solid (not additive) so they stay crisp on bright, heat-colored water.
          edge: new THREE.LineBasicMaterial({ color: EDGE[s.kind], transparent: true }),
          hud: new THREE.LineBasicMaterial({ color, ...add }),
          dash: new THREE.LineBasicMaterial({ color, ...add }),
          ping: new THREE.LineBasicMaterial({ color: "#e8fbff", ...add }),
          foam: new THREE.LineBasicMaterial({ color: "#ffffff", ...add }),
        };
        const body = bodyMaterial(color);
        const root = new THREE.Group();
        root.position.set(s.x, 0.03, s.z);
        const boat = new THREE.Group();
        const radar = new THREE.Mesh(geo.radar, body);
        radar.position.set(0.05, DECK + 0.32, 0.2);
        boat.add(new THREE.Mesh(geo.hull, body), new THREE.LineSegments(geo.edges, mats.edge), radar);
        // Reflection in the sea: the edge lines mirrored, faint.
        const mirror = new THREE.Group();
        mirror.scale.y = -1;
        mirror.add(new THREE.LineSegments(geo.edges, new THREE.LineBasicMaterial({ color, ...add, opacity: 0.18 })));
        const dashes = new THREE.LineSegments(geo.dashes, mats.dash);
        const ping = new THREE.LineSegments(geo.ping, mats.ping);
        const foam = new THREE.LineSegments(geo.foam, mats.foam);
        root.add(boat, mirror, foam, new THREE.LineSegments(geo.reticle, mats.hud), dashes, ping);
        // Phones and tablets redraw the island only when something changes, so a spreading ping
        // would sit frozen; without it and the faint reflection each boat is two draw calls
        // lighter there (an island can have twenty of them).
        mirror.visible = ping.visible = !MOBILE;
        return { root, boat, radar, mirror, dashes, ping, foam, body, mats };
      }),
    [sites, geo],
  );
  // Materials are per boat: free them when the boats go away.
  useEffect(
    () => () =>
      parts.forEach((p) =>
        p.root.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined;
          if (m && m !== geo.hitMat) m.dispose();
        }),
      ),
    [parts, geo],
  );

  const lift = useRef<number[]>([]);
  const hover = useScene((s) => s.hover);
  const setHover = useScene((s) => s.setHover);
  const { camera, gl } = useThree();
  useEffect(
    () => () => {
      gl.domElement.style.cursor = "";
      useScene.getState().setHover(null);
    },
    [gl],
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    sites.forEach((s, i) => {
      const p = parts[i];
      const ph = hash(s.id) * 6.28;
      // About the same size on screen at any zoom (dive-site boats a little smaller).
      const sc = Math.max(0.7, camera.position.distanceTo(p.root.position) * 0.03) * (s.kind === "story" ? 1 : 0.82);
      const on = hover === s.id ? 1 : 0;
      const k = (lift.current[i] = (lift.current[i] ?? 0) + (on - (lift.current[i] ?? 0)) * Math.min(1, dt * 10));
      p.root.scale.setScalar(Math.max(1e-4, sc * (1 + 0.15 * k) * DEV_SCALE() * sitesFade.v));
      p.root.visible = sitesFade.v > 0.01;
      // Riding at anchor: heave, pitch and roll, swinging slowly; the waterline stays on the sea and
      // the reflection mirrors every motion.
      const heave = Math.sin(t * 1.7 + ph) * 0.008 + k * 0.03;
      const pitch = Math.sin(t * 1.3 + ph) * 0.05, roll = Math.sin(t * 1.05 + ph * 2) * 0.07;
      const yaw = ph + Math.sin(t * 0.3 + ph) * 0.35;
      p.boat.position.y = heave;
      p.boat.rotation.set(pitch, yaw, roll, "YXZ");
      p.mirror.position.y = -heave;
      p.mirror.rotation.set(-pitch, yaw, -roll, "YXZ");
      p.foam.rotation.y = yaw;
      p.radar.rotation.y = t * 3;
      p.body.uniforms.uTime.value = t;
      p.body.uniforms.uGlow.value = k;
      p.mats.edge.opacity = 0.85 + 0.15 * k;
      p.mats.foam.opacity = 0.55 + 0.25 * Math.sin(t * 2.3 + ph) + 0.2 * k;
      // Target reticle: the dashed ring turns; the marker tightens and brightens on hover.
      p.mats.hud.opacity = 0.8 + 0.2 * k;
      p.mats.dash.opacity = 0.5 + 0.5 * k;
      p.dashes.rotation.y = t * 0.25 * (i % 2 ? 1 : -1);
      p.dashes.scale.setScalar(1 - 0.12 * k);
      // Sonar ping: a ring spreading from the hull every 2.4 s and fading.
      const f = ((t / 2.4 + ph) % 1 + 1) % 1;
      p.ping.scale.setScalar(0.5 + f * 1.1);
      p.mats.ping.opacity = (1 - f) * (1 - f) * 0.7;
    });
  });

  return (
    <>
      {sites.map((s, i) => (
        <primitive key={s.id} object={parts[i].root}>
          <mesh
            geometry={geo.hit}
            material={geo.hitMat}
            position={[0, 0.1, 0]}
            visible={false} // never drawn (one draw call less per boat); pointer rays still hit it
            onPointerOver={(e) => {
              if (sitesFade.v < 0.5) return; // the layer is off
              e.stopPropagation();
              setHover(s.id);
              gl.domElement.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (useScene.getState().hover === s.id) setHover(null);
              gl.domElement.style.cursor = "";
            }}
            onClick={(e) => {
              if (e.delta > 6 || sitesFade.v < 0.5) return; // a camera drag, or the layer is off
              e.stopPropagation();
              openSite(s);
            }}
          />
        </primitive>
      ))}
    </>
  );
}
