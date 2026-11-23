import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LITE, pick } from "../lib/device";
import { useBoat } from "./boatStore";
import { zonePlaces } from "./places";
import { obstacles, paint, planShape, RAMP, Roamer, slab } from "./shipParts";
import { hash, heightAtXZ, type Zone } from "./zone";

// Small dive and fishing boats (Tulio's photo: flybridge boats moored on the reef with
// snorkelers around them), our own toon design: ~13 m long against the research vessel's ~25 m,
// a colored hull under a white sheer line, a white cabin with a dark window band, a flybridge
// under a T-top canopy, and two outrigger poles. One is moored at every plain dive site of the
// zone (where the divers missions are), bow to the buoy and swinging gently on its line, and two
// more cruise around at ~15 knots (shipParts `Roamer`, over 6 m of water, 200–500 m from the
// research vessel), each with a small wake.
//
// Cost: every boat is an instance of one merged mesh (~900 triangles): one draw call for all of
// them, plus one for the two cruisers' wakes. The hull color is per boat (`aHull` marks the hull's
// vertices; the shader takes the instance color there only). Hidden under the water; boats more
// than 2 km away are scaled to nothing. All of them are solid (`obstacles`).

const LEN = 13, HALF_W = 2.2;
const HULLS = ["#2f6fd0", "#1c2330", "#2a8f9f", "#2f6fd0", "#1c2330", "#b8493b", "#e9eef2"];
const C = { white: "#f5f7fa", glass: "#1b2b44", deck: "#d8cdb8", pole: "#c8ced4", canvas: "#f2f4f6" };
const CRUISERS = 2;

/** A thin pole from a to b. */
function pole(a: [number, number, number], b: [number, number, number], r: number, hex: string) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), 4, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return paint(g, hex, { aHull: 0 });
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return paint(g, hex, { aHull: 0 });
};

/** One boat, bow toward +z, waterline at y = 0. */
function boatGeometry() {
  const stern = -LEN / 2, bow = LEN / 2;
  const hull = planShape(HALF_W, stern, 1.5, bow, 1);
  const cabin = planShape(1.85, -1.2, 2.2, 3.9, 0);
  const parts = [
    slab(hull, -0.8, 1.3, "#ffffff", 8, { aHull: 1 }), // the colored hull (instance color), most of the side
    slab(hull, 1.3, 1.65, C.white, 8, { aHull: 0 }), // thin white sheer line and bulwark
    slab(planShape(HALF_W - 0.2, stern + 0.2, 1.4, bow - 0.6, 1), 1.35, 1.45, C.deck, 6, { aHull: 0 }), // decks
    slab(cabin, 1.6, 2.15, C.white, 6, { aHull: 0 }),
    slab(cabin, 2.15, 2.75, C.glass, 6, { aHull: 0 }), // window band
    slab(cabin, 2.75, 3.0, C.white, 6, { aHull: 0 }),
    box(2.6, 0.7, 1.6, 0, 3.35, 0.6, C.white), // flybridge console
    slab(planShape(1.6, -1.6, 0.9, 1.7, 0), 4.8, 4.95, C.canvas, 4, { aHull: 0 }), // T-top canopy
  ];
  for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) parts.push(pole([x, 3.0, z], [x * 1.05, 4.8, z], 0.05, C.pole));
  // Outriggers, raised up and out like the photo's.
  for (const side of [-1, 1]) parts.push(pole([side * 1.5, 3.0, 0.6], [side * 3.4, 9.6, -2.4], 0.045, C.pole));
  const g = mergeGeometries(parts)!;
  g.computeVertexNormals();
  return g;
}

/** A small V wake (two foam arms and a churned strip), vertex alpha. */
function wakeGeometry() {
  const pos: number[] = [], col: number[] = [];
  const quad = (p: number[][], a0: number, a1: number) => {
    const [nl, nr, fl, fr] = p;
    for (const [q, a] of [[nl, a0], [nr, a0], [fl, a1], [nr, a0], [fr, a1], [fl, a1]] as [number[], number][]) {
      pos.push(q[0], 0.07, q[1]);
      col.push(1, 1, 1, a);
    }
  };
  const z0 = -LEN / 2, z1 = z0 - 40;
  quad([[-1.5, z0], [1.5, z0], [-3, z1], [3, z1]], 0.55, 0);
  quad([[-2.4, z0 + 3], [-1.8, z0 + 3], [-12, z1 + 4], [-10.6, z1 + 4]], 0.65, 0);
  quad([[1.8, z0 + 3], [2.4, z0 + 3], [10.6, z1 + 4], [12, z1 + 4]], 0.65, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  return g;
}

function boatMaterial() {
  const mat = LITE ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aHull;").replace(
      "#include <color_vertex>",
      `#include <color_vertex>
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz = mix(color.xyz, instanceColor.xyz, aHull); // only the hull takes the boat's color
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => "rq-small-boat";
  return mat;
}

interface Moored {
  x: number;
  z: number;
  yaw: number; // bow toward the buoy
  ph: number;
}

export function SmallBoats({ zone }: { zone: Zone }) {
  // The plain dive sites they moor at (how many boats there will be).
  const sites = useMemo(() => zonePlaces(zone).filter((p) => p.site.kind === "dive" && !p.site.scene && !p.site.wreck).slice(0, pick(4, 6, 8)), [zone]);
  const count = CRUISERS + sites.length;
  // Where each lies, on a 20 m line from its buoy (30 or 45 m if need be) in water at least 2.5 m deep, worked out on the
  // first frame with the research vessel on the water: never within 40 m of where she starts
  // (she starts by a dive site, and a boat moored on top of her bumped her at once).
  const moored = useRef<Moored[] | null>(null);
  const moor = (bx: number, bz: number) =>
    sites.map((p) => {
      // A longer line where she starts close to the buoy (no spot 20 m out may be 40 m from her).
      let best: Moored | null = null;
      for (const len of [20, 30, 45])
        for (let k = 0; k < 12; k++) {
          const a = hash(p.x * 0.01 + p.z * 0.013 + k) * Math.PI * 2;
          const x = p.x + Math.cos(a) * len, z = p.z + Math.sin(a) * len;
          if (heightAtXZ(zone, x, z) > -2.5) continue;
          const b = { x, z, yaw: Math.atan2(p.x - x, p.z - z), ph: a * 3 };
          if (Math.hypot(x - bx, z - bz) > 40) return b;
          best ??= b;
        }
      return best;
    });

  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(boatGeometry(), boatMaterial(), count);
    const c = new THREE.Color();
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0); // a slot with no boat (no room at its site) stays empty
    for (let i = 0; i < count; i++) im.setColorAt(i, c.set(HULLS[i % HULLS.length])), im.setMatrixAt(i, hidden);
    im.frustumCulled = false;
    im.visible = false;
    return im;
  }, [count]);
  const wakes = useMemo(() => {
    const im = new THREE.InstancedMesh(wakeGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }), CRUISERS);
    im.frustumCulled = false;
    im.renderOrder = 4; // after the sea surface, like the other foam
    im.visible = false;
    return im;
  }, []);
  const cruisers = useMemo(
    () => Array.from({ length: CRUISERS }, (_, i) => new Roamer(zone, { minDepth: 6, speed: 7.5, turn: 0.28, near: [200, 500], spawnAt: [260, 600], clear: 60, leash: 2000, look: 50 }, 101 + i * 977)),
    [zone],
  );
  useEffect(
    () => () => {
      for (const o of [mesh, wakes]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      for (const k of [...obstacles.keys()]) if (k.startsWith("sb:")) obstacles.delete(k);
    },
    [mesh, wakes],
  );

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const zero = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame((fr, dtRaw) => {
    const { tele, under } = useBoat.getState();
    if (!tele) return;
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime;
    mesh.visible = wakes.visible = !under;
    const set = (i: number, x: number, z: number, yaw: number, y: number, pitch: number, roll: number, on: boolean) => {
      const near = on && Math.hypot(tele.x - x, tele.z - z) < 2000;
      e.set(pitch, yaw, roll);
      m.compose(p.set(x, y, z), q.setFromEuler(e), near ? one : zero);
      mesh.setMatrixAt(i, m);
      if (on) obstacles.set(`sb:${i}`, { x, z, yaw, hl: LEN / 2, hw: HALF_W });
      else obstacles.delete(`sb:${i}`);
      return near;
    };
    // The two cruisers, each with its wake.
    cruisers.forEach((r, i) => {
      const on = r.step(t, dt, tele.x, tele.z);
      const shown = set(i, r.x, r.z, r.head, 0.15 + Math.sin(t * 1.7 + i) * 0.06, -0.06, Math.sin(t * 1.3 + i) * 0.02 - r.turnNow * 0.12, on);
      e.set(0, r.head, 0);
      m.compose(p.set(r.x, 0, r.z), q.setFromEuler(e), shown ? one : zero);
      wakes.setMatrixAt(i, m);
    });
    // Moored: riding on the swell and swinging a little on their lines.
    if (!moored.current) moored.current = moor(tele.x, tele.z).filter((b): b is Moored => !!b);
    moored.current.forEach((b, k) => {
      const swing = Math.sin(t * 0.07 + b.ph) * 0.25;
      set(CRUISERS + k, b.x, b.z, b.yaw + swing, Math.sin(t * 1.1 + b.ph) * 0.12, Math.sin(t * 0.9 + b.ph) * 0.02, Math.sin(t * 0.8 + b.ph * 2) * 0.03, true);
    });
    mesh.instanceMatrix.needsUpdate = true;
    wakes.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={mesh} />
      <primitive object={wakes} />
    </>
  );
}
