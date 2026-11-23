import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LITE } from "../lib/device";
import { useBoat } from "./boatStore";
import { heightAtXZ, type Zone } from "./zone";

// A passenger ship cruising the open water of every boat zone, a few hundred meters from the
// research vessel (Tulio: something like a cruise ship roaming around, bigger than our boat, a bit
// in the distance). Our own design in the toon style of R/V Arrecife, not a copy of his reference:
// ~70 m long against the R/V's ~25 m, a blue-and-white hull with a navy boot top, four decks of
// window bands stepping back toward a rounded front, one raked funnel, orange lifeboats along the
// side. Scenery only: no label, no claim about real ships.
//
// Cost: the ship is one merged mesh with vertex colors (~2.5k triangles, one draw call), its wake
// a second one (a few triangles with vertex alpha). Hidden under the water and when far away.
// Route: it steers toward a point in deep water 350–700 m from the boat, chosen so the straight
// line there stays over at least MIN_DEPTH meters of water and keeps clear of the boat, and picks
// a new one when it gets there, when the boat has moved on, or when shallows lie ahead. A big
// ship turns slowly. A zone without enough deep water near the boat simply has no ship.

const LENGTH = 70; // m
const SPEED = 4.6; // m/s, about 9 knots
const MIN_DEPTH = 16; // m of water it keeps under its keel line
const TURN = 0.07; // rad/s, normal turning (≈65 m radius at this speed)

const COLORS = {
  boot: "#1d2f5c", // dark blue below the waterline band
  hull: "#2f6fc6", // blue hull
  stripe: "#f2c230",
  white: "#f5f7fa",
  glass: "#1b2b44",
  deck: "#c9a874", // teak decks
  funnel: "#f5f7fa",
  funnelBand: "#2f6fc6",
  cap: "#1a1f29",
  boat: "#f2622e", // orange lifeboats
};

const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const _c = new THREE.Color();
/** Position only plus one flat color, ready to merge. */
function paint(g: THREE.BufferGeometry, hex: string) {
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const flat = g.index ? g.toNonIndexed() : g;
  _c.set(hex);
  const n = flat.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  flat.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return flat;
}

/** The plan of the hull or a deck: a rounded stern, straight sides and a bow that comes to a
 *  point (`point` 1) or a rounded front (`point` 0), in x (beam) and z (length), bow toward +z. */
function planShape(halfW: number, stern: number, bowStart: number, bow: number, point: number) {
  const s = new THREE.Shape();
  const r = halfW * 0.55;
  s.moveTo(-halfW, stern + r);
  s.quadraticCurveTo(-halfW, stern, -halfW + r, stern);
  s.lineTo(halfW - r, stern);
  s.quadraticCurveTo(halfW, stern, halfW, stern + r);
  s.lineTo(halfW, bowStart);
  const tip = halfW * (1 - point) * 0.35;
  s.bezierCurveTo(halfW, bowStart + (bow - bowStart) * 0.55, tip + 0.01, bow, 0, bow);
  s.bezierCurveTo(-tip - 0.01, bow, -halfW, bowStart + (bow - bowStart) * 0.55, -halfW, bowStart);
  s.closePath();
  return s;
}
/** A plan extruded from y0 up to y1. */
function slab(shape: THREE.Shape, y0: number, y1: number, hex: string, segs = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: segs });
  // Shape (x, s) → x stays, s becomes the length axis (+z, bow forward) and the extrusion runs
  // from 0 down to −(y1 − y0); lifted to sit between y0 and y1. (A rotation, not a mirror: a
  // mirror would turn the faces inside out.)
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return paint(g, hex);
}

/** The ship, bow toward +z, waterline at y = 0. */
function shipGeometry() {
  const half = 6.2, stern = -LENGTH / 2, bow = LENGTH / 2;
  const hullPlan = planShape(half, stern, bow - 16, bow, 1);
  const parts: THREE.BufferGeometry[] = [
    slab(hullPlan, -3, 0.6, COLORS.boot, 10),
    slab(hullPlan, 0.6, 1.0, COLORS.stripe, 10),
    slab(hullPlan, 1.0, 4.2, COLORS.hull, 10),
    slab(planShape(half - 0.05, stern + 0.05, bow - 16, bow - 0.15, 1), 4.2, 5.4, COLORS.white, 10), // bulwark
    slab(planShape(half - 0.4, stern + 0.4, bow - 17, bow - 1.2, 1), 5.0, 5.2, COLORS.deck, 10), // fore deck
  ];
  // Four decks of windows stepping back: each a glass band under a white band, the front rounded.
  for (let i = 0; i < 4; i++) {
    const hw = half - 0.8 - i * 0.55, aft = stern + 5 + i * 3.5, fwd = bow - 22 - i * 4;
    const y = 5.4 + i * 2.6;
    const p = planShape(hw, aft, fwd - hw * 1.2, fwd, 0);
    parts.push(slab(p, y, y + 1.15, COLORS.glass, 8), slab(p, y + 1.15, y + 2.6, COLORS.white, 8));
  }
  // Sun deck on top, and the bridge's dark window band across the front of the top deck.
  const topY = 5.4 + 4 * 2.6;
  parts.push(slab(planShape(half - 3.5, stern + 18, bow - 44, bow - 38, 0), topY, topY + 0.3, COLORS.deck, 6));
  // The funnel: raked back, white with a blue band and a dark cap.
  const funnel = (y0: number, h: number, r0: number, r1: number, hex: string) => {
    const g = new THREE.CylinderGeometry(r1, r0, h, 12, 1, false);
    g.scale(1, 1, 1.5);
    g.translate(0, y0 + h / 2, 0);
    return paint(g, hex);
  };
  // Its foot stands on the sun deck, aft of the middle (it used to overhang the top deck's back edge).
  const fz = stern + 22, rake = new THREE.Matrix4().makeShear(0, 0, 0, -0.25, 0, 0); // z −= 0.25·y: raked aft
  const fy = topY + 0.3; // on the sun deck
  for (const g of [funnel(fy, 4.2, 2.0, 1.8, COLORS.funnel), funnel(fy + 4.2, 1.6, 1.8, 1.75, COLORS.funnelBand), funnel(fy + 5.8, 0.5, 1.75, 1.6, COLORS.cap)]) {
    g.applyMatrix4(rake);
    g.translate(0, 0, fz + 0.25 * fy);
    parts.push(g);
  }
  // Orange lifeboats in a row along each side, under the top decks.
  for (const side of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const g = new THREE.CapsuleGeometry(0.9, 3.2, 2, 6);
      g.rotateX(Math.PI / 2);
      g.translate(side * (half - 0.3), 8.3, stern + 14 + i * 6.2);
      parts.push(paint(g, COLORS.boat));
    }
  const geo = mergeGeometries(parts)!;
  geo.computeVertexNormals();
  return geo;
}

/** The wake: two thin foam arms spreading in a V behind the stern and a broad churned strip down
 *  the middle, all fading out, in vertex alpha (one draw call, drawn over the sea like the
 *  boat's foam). */
function wakeGeometry() {
  const pos: number[] = [], col: number[] = [];
  const quad = (pts: number[][], a0: number, a1: number) => {
    // pts: near-left, near-right, far-left, far-right
    const [nl, nr, fl, fr] = pts;
    for (const [p, a] of [[nl, a0], [nr, a0], [fl, a1], [nr, a0], [fr, a1], [fl, a1]] as [number[], number][]) {
      pos.push(p[0], 0.07, p[1]);
      col.push(1, 1, 1, a);
    }
  };
  const z0 = -LENGTH / 2 + 1, z1 = z0 - 90;
  quad([[-3.5, z0], [3.5, z0], [-7, z1], [7, z1]], 0.45, 0); // churned water behind the stern
  quad([[-6.6, z0 + 6], [-5.4, z0 + 6], [-28, z1 + 10], [-25, z1 + 10]], 0.6, 0); // left arm
  quad([[5.4, z0 + 6], [6.6, z0 + 6], [25, z1 + 10], [28, z1 + 10]], 0.6, 0); // right arm
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  return g;
}

/** Is the water at least MIN_DEPTH deep all along the line from a to b (every 30 m)? */
function deepLine(zone: Zone, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 30));
  for (let i = 0; i <= n; i++) if (heightAtXZ(zone, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n) > -MIN_DEPTH) return false;
  return true;
}
/** Distance from point p to the segment a–b. */
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export function CruiseShip({ zone }: { zone: Zone }) {
  const ship = useMemo(() => {
    const m = new THREE.Mesh(
      shipGeometry(),
      LITE ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP }),
    );
    m.visible = false;
    return m;
  }, []);
  const wake = useMemo(() => {
    const m = new THREE.Mesh(wakeGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 4; // after the sea surface, like the boat's foam
    ship.add(m);
    return m;
  }, [ship]);
  useEffect(
    () => () => {
      ship.geometry.dispose();
      (ship.material as THREE.Material).dispose();
      wake.geometry.dispose();
      (wake.material as THREE.Material).dispose();
    },
    [ship, wake],
  );

  // x, z, heading (radians, 0 = +z, toward +x as it grows: the mesh's own convention) and target.
  const st = useRef({ on: false, x: 0, z: 0, head: 0, tx: 0, tz: 0, check: 0, seed: 1 });
  const lim = { x: zone.sizeX / 2 - 150, z: zone.sizeZ / 2 - 150 };
  const rand = () => {
    const s = st.current;
    s.seed = (s.seed * 16807) % 2147483647;
    return s.seed / 2147483647;
  };
  const inside = (x: number, z: number) => Math.abs(x) < lim.x && Math.abs(z) < lim.z;

  /** A new place to head for, around the boat at (bx, bz). */
  const pickTarget = (bx: number, bz: number) => {
    const s = st.current;
    let best: { x: number; z: number; score: number } | null = null;
    for (let i = 0; i < 48; i++) {
      const a = rand() * Math.PI * 2, r = 350 + rand() * (i < 32 ? 350 : 900);
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      if (!inside(x, z) || !deepLine(zone, s.x, s.z, x, z) || segDist(bx, bz, s.x, s.z, x, z) < 140) continue;
      // Prefer going on more or less straight ahead: a big ship doesn't spin round.
      const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(x - s.x, z - s.z) - s.head), Math.cos(Math.atan2(x - s.x, z - s.z) - s.head)));
      const score = turn + Math.abs(r - 500) / 600;
      if (!best || score < best.score) best = { x, z, score };
    }
    if (best) (s.tx = best.x), (s.tz = best.z);
    return !!best;
  };
  /** Put the ship somewhere in deep water a good way from the boat, heading across its view. */
  const spawn = (bx: number, bz: number) => {
    const s = st.current;
    for (let i = 0; i < 80; i++) {
      const a = rand() * Math.PI * 2, r = 450 + rand() * (i < 50 ? 300 : 1000);
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      if (!inside(x, z) || heightAtXZ(zone, x, z) > -MIN_DEPTH - 4) continue;
      s.x = x;
      s.z = z;
      s.head = Math.atan2(-(bz - z), bx - x) + (rand() < 0.5 ? 0 : Math.PI); // broadside to the boat
      if (pickTarget(bx, bz)) return (s.on = true);
    }
    return (s.on = false);
  };

  useFrame((fr, dtRaw) => {
    const { tele, under } = useBoat.getState();
    const s = st.current;
    if (!tele) return;
    if (!s.on) {
      // Try to place it now and then (cheap), e.g. after the boat has moved into deeper water.
      if (fr.clock.elapsedTime > s.check) {
        s.check = fr.clock.elapsedTime + 4;
        s.seed = 1 + Math.floor((Math.abs(tele.x) + Math.abs(tele.z)) * 13) % 100000;
        spawn(tele.x, tele.z);
      }
      ship.visible = false;
      return;
    }
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime;
    const far = Math.hypot(tele.x - s.x, tele.z - s.z);
    // Left far behind (the boat does 50 knots): bring it back near the boat, out of sight.
    if (far > 2600) {
      s.on = false;
      s.check = 0;
      ship.visible = false;
      return;
    }
    // Retarget a few times a second: arrived, the boat has moved on, or shallows ahead.
    if (t > s.check) {
      s.check = t + 0.5;
      const ahead = heightAtXZ(zone, s.x + Math.sin(s.head) * 130, s.z + Math.cos(s.head) * 130) > -MIN_DEPTH;
      const toTarget = Math.hypot(s.tx - s.x, s.tz - s.z), targetFromBoat = Math.hypot(s.tx - tele.x, s.tz - tele.z);
      if (toTarget < 70 || targetFromBoat > 1100 || ahead || !inside(s.tx, s.tz)) {
        if (!pickTarget(tele.x, tele.z) && ahead) s.head += Math.PI * dt; // nowhere to go: turn away
      }
    }
    // Steer toward the target, slowly (faster when shallows are close ahead).
    const want = Math.atan2(s.tx - s.x, s.tz - s.z);
    const diff = Math.atan2(Math.sin(want - s.head), Math.cos(want - s.head));
    const shallowNear = heightAtXZ(zone, s.x + Math.sin(s.head) * 60, s.z + Math.cos(s.head) * 60) > -MIN_DEPTH;
    const rate = shallowNear ? TURN * 3 : TURN;
    s.head += Math.max(-rate * dt, Math.min(rate * dt, diff));
    const v = shallowNear ? SPEED * 0.4 : SPEED;
    s.x += Math.sin(s.head) * v * dt;
    s.z += Math.cos(s.head) * v * dt;

    // Shown from above the water only, and while it's within sight.
    ship.visible = !under && far < 2400;
    if (!ship.visible) return;
    ship.position.set(s.x, Math.sin(t * 0.5) * 0.08, s.z);
    // Heeling a little into turns, and a slow roll and pitch on the swell.
    ship.rotation.set(Math.sin(t * 0.37) * 0.006, s.head, Math.sin(t * 0.29) * 0.012 - diff * 0.05, "YXZ");
  });

  return <primitive object={ship} />;
}
