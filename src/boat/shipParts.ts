import * as THREE from "three";
import { heightAtXZ, type Zone } from "./zone";

// Shared by the other boats on the water (cruiseShip.tsx, smallBoats.tsx): building blocks for
// toon hulls painted in vertex colors, a route finder that keeps a boat over deep water near the
// research vessel, and the list of boats the research vessel bumps into (BoatWorld's helm).

/** Toon shading in three flat bands, a little lighter than the R/V's (they're seen from farther). */
export const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const _c = new THREE.Color();
/** Position only plus one flat color (and optional extra per-vertex values), ready to merge. */
export function paint(g: THREE.BufferGeometry, hex: string, extra?: Record<string, number>) {
  for (const k of Object.keys(g.attributes)) if (k !== "position") g.deleteAttribute(k);
  const flat = g.index ? g.toNonIndexed() : g;
  _c.set(hex);
  const n = flat.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
  flat.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const [k, v] of Object.entries(extra ?? {})) flat.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n).fill(v), 1));
  return flat;
}

/** The plan of a hull or a deck: a rounded stern, straight sides and a bow that comes to a point
 *  (`point` 1) or a rounded front (`point` 0), in x (beam) and z (length), bow toward +z. */
export function planShape(halfW: number, stern: number, bowStart: number, bow: number, point: number) {
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
/** A plan extruded from y0 up to y1, painted one color. */
export function slab(shape: THREE.Shape, y0: number, y1: number, hex: string, segs = 8, extra?: Record<string, number>) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: segs });
  // Shape (x, s) → x stays, s becomes the length axis (+z, bow forward) and the extrusion runs
  // from 0 down to −(y1 − y0); lifted to sit between y0 and y1. (A rotation, not a mirror: a
  // mirror would turn the faces inside out.)
  g.rotateX(Math.PI / 2);
  g.translate(0, y1, 0);
  return paint(g, hex, extra);
}

// ---- Bumping into other boats.

/** A boat the research vessel can't pass through: center, heading (0 = +z, toward +x as it grows)
 *  and half length and half beam, in meters. Kept current by each boat while it is on the water. */
export interface Obstacle {
  x: number;
  z: number;
  yaw: number;
  hl: number;
  hw: number;
}
export const obstacles = new Map<string, Obstacle>();

/** How far point (px, pz) is inside an obstacle grown by r, and the way out (unit vector); null
 *  if it's outside every one. */
export function insideObstacle(px: number, pz: number, r: number): { depth: number; nx: number; nz: number } | null {
  let best: { depth: number; nx: number; nz: number } | null = null;
  for (const o of obstacles.values()) {
    const dx = px - o.x, dz = pz - o.z;
    const s = Math.sin(o.yaw), c = Math.cos(o.yaw);
    const along = dx * s + dz * c, side = dx * c - dz * s;
    const pa = o.hl + r - Math.abs(along), ps = o.hw + r - Math.abs(side);
    if (pa <= 0 || ps <= 0) continue;
    // Out along whichever axis is the shorter way.
    const hit = ps < pa
      ? { depth: ps, nx: c * Math.sign(side || 1), nz: -s * Math.sign(side || 1) }
      : { depth: pa, nx: s * Math.sign(along || 1), nz: c * Math.sign(along || 1) };
    if (!best || hit.depth > best.depth) best = hit;
  }
  return best;
}

// ---- Roaming over deep water near the research vessel.

/** Is the water at least `min` meters deep all along the line from a to b (every 30 m)? */
export function deepLine(zone: Zone, min: number, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / 30));
  for (let i = 0; i <= n; i++) if (heightAtXZ(zone, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n) > -min) return false;
  return true;
}
/** Distance from point p to the segment a–b. */
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

export interface RoamOptions {
  minDepth: number; // m of water it keeps under its keel line
  speed: number; // m/s
  turn: number; // rad/s
  near: [number, number]; // targets this far from the research vessel (m)
  spawnAt: [number, number]; // where it appears, from the research vessel (m)
  clear: number; // keeps its course at least this far from the research vessel (m)
  leash: number; // left farther behind than this, it comes back near the boat (m)
  look: number; // how far ahead it watches for shallows (m)
}

/**
 * A boat roaming over deep water near the research vessel: it steers toward a point at `near`
 * meters from the vessel whose straight line stays over `minDepth` meters of water and keeps
 * `clear` meters off the vessel, picks a new one when it gets there, when the vessel has moved
 * on or when shallows lie ahead, and turns at a limited rate (faster near shallows). Left
 * `leash` meters behind (the vessel does 50 knots), it reappears near the vessel. A zone with no
 * deep water near the vessel simply has none.
 */
export class Roamer {
  on = false;
  x = 0;
  z = 0;
  head = 0; // radians, 0 = +z, toward +x as it grows
  turnNow = 0; // how hard it is turning (for the heel)
  private tx = 0;
  private tz = 0;
  private check = 0;
  private seed: number;
  private lim: { x: number; z: number };
  constructor(private zone: Zone, private o: RoamOptions, seed: number) {
    this.seed = 1 + (seed % 100000);
    this.lim = { x: zone.sizeX / 2 - 150, z: zone.sizeZ / 2 - 150 };
  }
  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  private inside(x: number, z: number) {
    return Math.abs(x) < this.lim.x && Math.abs(z) < this.lim.z;
  }
  private pickTarget(bx: number, bz: number) {
    const [r0, r1] = this.o.near;
    let best: { x: number; z: number; score: number } | null = null;
    for (let i = 0; i < 48; i++) {
      const a = this.rand() * Math.PI * 2, r = r0 + this.rand() * (i < 32 ? r1 - r0 : (r1 - r0) * 2.5);
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      if (!this.inside(x, z) || !deepLine(this.zone, this.o.minDepth, this.x, this.z, x, z) || segDist(bx, bz, this.x, this.z, x, z) < this.o.clear) continue;
      // Prefer going on more or less straight ahead.
      const dir = Math.atan2(x - this.x, z - this.z);
      const turn = Math.abs(Math.atan2(Math.sin(dir - this.head), Math.cos(dir - this.head)));
      const score = turn + Math.abs(r - (r0 + r1) / 2) / (r1 - r0 + 100);
      if (!best || score < best.score) best = { x, z, score };
    }
    if (best) (this.tx = best.x), (this.tz = best.z);
    return !!best;
  }
  private spawn(bx: number, bz: number) {
    const [r0, r1] = this.o.spawnAt;
    for (let i = 0; i < 80; i++) {
      const a = this.rand() * Math.PI * 2, r = r0 + this.rand() * (i < 50 ? r1 - r0 : (r1 - r0) * 3);
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      if (!this.inside(x, z) || heightAtXZ(this.zone, x, z) > -this.o.minDepth - 3) continue;
      this.x = x;
      this.z = z;
      this.head = Math.atan2(bz - z, -(bx - x)) + (this.rand() < 0.5 ? 0 : Math.PI); // across the vessel's view
      if (this.pickTarget(bx, bz)) return (this.on = true);
    }
    return (this.on = false);
  }
  private shallow(dist: number) {
    return heightAtXZ(this.zone, this.x + Math.sin(this.head) * dist, this.z + Math.cos(this.head) * dist) > -this.o.minDepth;
  }
  /** Advance by dt seconds; (bx, bz) is the research vessel. Returns whether it is on the water. */
  step(t: number, dt: number, bx: number, bz: number) {
    if (!this.on) {
      if (t > this.check) {
        this.check = t + 4; // try now and then: the vessel may have moved into deeper water
        this.spawn(bx, bz);
      }
      return this.on;
    }
    if (Math.hypot(bx - this.x, bz - this.z) > this.o.leash) {
      this.on = false;
      this.check = 0;
      return false;
    }
    if (t > this.check) {
      this.check = t + 0.5;
      const ahead = this.shallow(this.o.look);
      if (Math.hypot(this.tx - this.x, this.tz - this.z) < 40 || Math.hypot(this.tx - bx, this.tz - bz) > this.o.near[1] * 1.6 || ahead || !this.inside(this.tx, this.tz)) {
        if (!this.pickTarget(bx, bz) && ahead) this.head += Math.PI * dt; // nowhere to go: turn away
      }
    }
    const want = Math.atan2(this.tx - this.x, this.tz - this.z);
    const diff = Math.atan2(Math.sin(want - this.head), Math.cos(want - this.head));
    const near = this.shallow(this.o.look * 0.45);
    const rate = near ? this.o.turn * 3 : this.o.turn;
    this.head += Math.max(-rate * dt, Math.min(rate * dt, diff));
    this.turnNow = Math.max(-1, Math.min(1, diff));
    const v = near ? this.o.speed * 0.4 : this.o.speed;
    this.x += Math.sin(this.head) * v * dt;
    this.z += Math.cos(this.head) * v * dt;
    return true;
  }
}
