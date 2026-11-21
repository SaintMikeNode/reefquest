import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LITE } from "../lib/device";

// The research vessel R/V Arrecife, stylized like a game boat (toon shading, ink outlines, chunky
// shapes) but shaped like a modern coastal research ship (Tulio's reference: a French
// oceanographic fleet vessel; an earlier version after a cartoon tugboat, with a funnel and tire
// fenders, read as another kind of boat). A ~24 m hull with a high bow: dark navy below a yellow
// line that rises toward the bow, blue topsides, and the white of the bow sweeping down
// diagonally; a white deckhouse with square windows, a bridge with a wraparound band of raked
// windows under a yellow brow, a railed top deck with two radomes and a tall white mast; a long
// open working deck aft with a navy A-frame (the CTD rosette hangs from it), a navy side gantry,
// crane, winch, ROV and an orange rescue boat. No funnel. Everything is built from shapes and
// primitives, no model download. Forward is +z, the waterline is y = 0. The hull keeps the old
// size (bow +12.5, stern −12, draft ~2 m), which the physics relies on.

const C = {
  hull: "#1f4a95", // blue topsides
  navy: "#14203a", // dark lower hull
  frame: "#1d3570", // navy A-frame and gantry
  white: "#f4f7fa",
  yellow: "#f2c230", // the hull line, the bridge brow and the ROV
  deck: "#aeb8c2", // light grey non-slip deck
  topDeck: "#c4ccd4",
  glass: "#17233a",
  steel: "#9aa6ae",
  rubber: "#22252b", // rub rail
  buoy: "#f2622e", // orange lifebuoys and rescue boat (safety color)
  ink: "#16202e",
};

// Toon shading: three flat bands instead of smooth light.
const RAMP = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const mats = new Map<string, THREE.MeshToonMaterial>();
function toon(color: string) {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP })));
  return m;
}
const INK = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });

/** Ink outline: the shape pushed out along its normals and drawn inside out, so a dark rim shows. */
function outline(geo: THREE.BufferGeometry, width: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", geo.getAttribute("position").clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const m = mergeVertices(g, 1e-3);
  m.computeVertexNormals();
  const p = m.getAttribute("position") as THREE.BufferAttribute, n = m.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * width, p.getY(i) + n.getY(i) * width, p.getZ(i) + n.getZ(i) * width);
  return new THREE.Mesh(m, INK);
}

/** A solid part: toon-shaded mesh plus (optionally) its ink outline. */
function part(geo: THREE.BufferGeometry, color: string, ink = 0.07) {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(geo, toon(color)));
  if (ink > 0 && !LITE) grp.add(outline(geo, ink)); // weakest devices: no ink outlines (half the triangles)
  return grp;
}

/** Top-view outline (x across, y = forward) of a hull or deckhouse. */
function plan(halfW: number, stern: number, bowStart: number, bow: number, sternRound = 0.6, step = 0) {
  const s = new THREE.Shape();
  // Straight sides get a point every `step` m, so a part can be cut or shaped along the length.
  const side = (x: number, from: number, to: number) => {
    if (step > 0) for (let n = Math.ceil(Math.abs(to - from) / step), i = 1; i < n; i++) s.lineTo(x, from + ((to - from) * i) / n);
    s.lineTo(x, to);
  };
  s.moveTo(-halfW + sternRound, stern);
  s.lineTo(halfW - sternRound, stern);
  s.quadraticCurveTo(halfW, stern, halfW, stern + sternRound);
  side(halfW, stern + sternRound, bowStart);
  s.bezierCurveTo(halfW, bowStart + (bow - bowStart) * 0.6, halfW * 0.45, bow - 0.3, 0, bow);
  s.bezierCurveTo(-halfW * 0.45, bow - 0.3, -halfW, bowStart + (bow - bowStart) * 0.6, -halfW, bowStart);
  side(-halfW, bowStart, stern + sternRound);
  s.quadraticCurveTo(-halfW, stern, -halfW + sternRound, stern);
  return s;
}

/** A copy of the hull with every point's height held between lo(z) and hi(z), pushed out a little:
 *  a painted band on the hull (the navy bottom, the yellow line, the white bow). */
function hullBand(hull: THREE.BufferGeometry, lo: (z: number) => number, hi: (z: number) => number, grow: number) {
  const b = hull.clone();
  const p = b.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setY(i, Math.min(hi(z), Math.max(lo(z), p.getY(i))));
  }
  b.scale(1 + grow, 1, 1 + grow / 2);
  b.computeVertexNormals();
  return b;
}

/** One piece of a deck-edge wall: the band between an outer and an inner plan, aft of z = cut or
 *  forward of it, as its own outline (cutting a whole ring's triangles mixed colors on its top). */
function wallPiece(outer: THREE.Shape, inner: THREE.Shape, cut: number, aft: boolean) {
  const run = (sh: THREE.Shape) => {
    const pts = sh.getPoints(12);
    if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
    const n = pts.length, isAft = (i: number) => pts[((i % n) + n) % n].y < cut;
    // The outline runs stern → port side (+x) → bow → starboard side → stern: the aft part starts where
    // the starboard side crosses `cut`, the forward part where the port side does.
    let start = 0;
    while (!(isAft(start) === aft && isAft(start - 1) !== aft)) start++;
    const out: THREE.Vector2[] = [];
    for (let i = start; isAft(i) === aft; i++) out.push(pts[i % n]);
    return out;
  };
  const xo = Math.max(...outer.getPoints(4).map((p) => p.x)), xi = Math.max(...inner.getPoints(4).map((p) => p.x));
  const o = run(outer), ins = run(inner).reverse();
  const sa = aft ? -1 : 1; // the outer run starts on this side
  const pts = [new THREE.Vector2(sa * xo, cut), ...o, new THREE.Vector2(-sa * xo, cut), new THREE.Vector2(-sa * xi, cut), ...ins, new THREE.Vector2(sa * xi, cut)];
  return new THREE.Shape(pts);
}

/** Thin railings (no outline) along a path of [x, z] points at height y. */
function railing(pts: [number, number][], y: number, closed = true, h = 0.9) {
  const parts: THREE.BufferGeometry[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    for (const yy of [h, h * 0.5]) {
      const bar = new THREE.BoxGeometry(0.06, 0.06, len);
      bar.rotateY(ang);
      bar.translate((x0 + x1) / 2, y + yy, (z0 + z1) / 2);
      parts.push(bar);
    }
    for (let k = 0, m = Math.max(1, Math.round(len / 1.3)); k < m; k++) {
      const post = new THREE.BoxGeometry(0.07, h, 0.07);
      post.translate(x0 + ((x1 - x0) * k) / m, y + h / 2, z0 + ((z1 - z0) * k) / m);
      parts.push(post);
    }
  }
  return new THREE.Mesh(mergeGeometries(parts)!, toon(C.white));
}

/** Extrude a plan upward: shape (x, y=forward) → geometry with x, y = height (0…h), z = forward. */
function extrudeUp(shape: THREE.Shape, height: number, bevel = 0.08, curveSegments = 12, steps = 1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, steps, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments });
  g.rotateX(Math.PI / 2);
  g.translate(0, height, 0);
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

// The sheer: the deck line sweeps up toward the bow (and a little at the stern), cartoon-style.
const sheer = (z: number) => (z > 0 ? (z / 12.5) ** 2 * 2.2 : (z / 12) ** 2 * 0.6);
/** Bend a part with the sheer: vertices rise with it, more toward the top of the part. */
function bend(g: THREE.BufferGeometry, y0: number, y1: number) {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    p.setY(i, y + sheer(p.getZ(i)) * k);
  }
  g.computeVertexNormals();
  return g;
}

function nameTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 112;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0f2a4d";
  g.beginPath();
  g.roundRect(4, 4, 504, 104, 18);
  g.fill();
  g.strokeStyle = "#f7f9fb";
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = "#f7f9fb";
  g.font = "700 54px 'Inter Variable', 'Helvetica Neue', Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 58);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function flagTexture() {
  // Honduras: blue–white–blue with five blue stars.
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 48;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0073cf";
  g.fillRect(0, 0, 96, 48);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 16, 96, 16);
  g.fillStyle = "#0073cf";
  for (const [x, y] of [[48, 24], [38, 19], [58, 19], [38, 29], [58, 29]]) {
    g.beginPath();
    g.arc(x, y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Vessel {
  group: THREE.Group;
  radar: THREE.Object3D[];
  rosette: THREE.Group; // CTD rosette, lowered from the A-frame
  cable: THREE.Mesh;
  /** The A-frame, pivoting at the foot of its legs: it swings out over the stern for a cast. */
  aframe: THREE.Group;
  /** Where the cable leaves the sheave, in the A-frame's own space. */
  sheave: THREE.Vector3;
  flag: THREE.Mesh;
}

export function makeVessel(): Vessel {
  const g = new THREE.Group();
  const add = (o: THREE.Object3D, x = 0, y = 0, z = 0) => {
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  const DECK_Y = 1.9;
  const deckAt = (z: number) => DECK_Y + sheer(z);

  // ---- Hull: a V-bottomed block up to the deck (its top just under the deck), bent with the sheer.
  // Rings every 0.6 m up the side keep it vertical above the waterline, so the painted bands
  // below sit flush on it.
  const block = extrudeUp(plan(4.0, -12, 2.0, 12.5, 1.0, 0.75), 3.6, 0.18, 12, 6);
  block.translate(0, -1.9, 0);
  {
    const p = block.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.4) p.setX(i, p.getX(i) * (0.45 + 0.55 * Math.min(1, (y + 1.95) / 1.55))); // V bottom
    }
  }
  // Open at the top (the deck closes it): a top face only has points along its edge, so it can't
  // follow the sheer's curve and poked up through the deck in patches.
  const hull = new THREE.BufferGeometry();
  {
    const p = block.getAttribute("position") as THREE.BufferAttribute;
    const keep: number[] = [];
    for (let i = 0; i < p.count; i += 3)
      if (Math.min(p.getY(i), p.getY(i + 1), p.getY(i + 2)) < 1.69)
        for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
    hull.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  }
  bend(hull, -1.9, DECK_Y);
  add(part(hull, C.hull, 0.09));
  // Painted bands: navy bottom up to a yellow line that rises toward the bow, and the white of the
  // bow sweeping down diagonally to it (blue stays between them aft).
  const line = (z: number) => 0.35 + sheer(z) * 0.45;
  const top = (z: number) => 1.7 + sheer(z); // the hull side's upper edge (the bulwark goes on from there)
  add(new THREE.Mesh(hullBand(hull, () => -9, line, 0.012), toon(C.navy)));
  add(new THREE.Mesh(hullBand(hull, line, (z) => line(z) + 0.17, 0.02), toon(C.yellow)));
  const sweep = (z: number) => {
    const k = Math.min(1, Math.max(0, (z + 4.8) / 6.5)); // 0 aft of the deckhouse, 1 from z ≈ 1.7
    return Math.min(top(z), top(z) + 0.4 - k * (top(z) + 0.4 - (line(z) + 0.75)));
  };
  add(new THREE.Mesh(hullBand(hull, sweep, top, 0.014), toon(C.white)));
  // Dark rub rail along the deck edge.
  add(new THREE.Mesh(hullBand(hull, (z) => top(z) - 0.14, (z) => top(z) + 0.02, 0.026), toon(C.rubber)));
  // Portholes along the white band.
  const port = new THREE.CircleGeometry(0.17, 12);
  for (const sx of [-1, 1])
    for (const z of [-2.6, -1.4, -0.2, 1.0]) {
      const d = port.clone();
      d.rotateY(sx * (Math.PI / 2));
      add(new THREE.Mesh(d, toon(C.glass)), sx * 4.27, line(z) + 0.95 + sheer(z) * 0.15, z);
    }

  // ---- Bulwark: navy and low around the working deck aft, white and higher around the forecastle.
  const CUT = -4.6; // where the deckhouse starts
  const wall = (aft: boolean, h: number) => {
    const shape = wallPiece(plan(4.14, -12.14, 2.0, 12.64, 1.1, 0.75), plan(3.78, -11.78, 2.2, 11.9, 0.8, 0.75), CUT, aft);
    // From just under the hull side's upper edge (so no gap shows) to h above the deck.
    const geo = bend(extrudeUp(shape, h + 0.3, 0.04), -2, -1); // the whole wall rides on the sheer
    geo.translate(0, DECK_Y - 0.3, 0);
    return geo;
  };
  add(part(wall(true, 0.9), C.frame, 0.05));
  add(part(wall(false, 1.25), C.white, 0.05));

  // ---- Deck: light grey, following the sheer.
  const deck = new THREE.ShapeGeometry(plan(3.8, -11.8, 2.2, 11.95, 0.8, 1.5), 12);
  deck.rotateX(-Math.PI / 2);
  deck.scale(1, 1, -1); // shape y → +z forward
  const dp = deck.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < dp.count; i++) dp.setY(i, DECK_Y + 0.02 + sheer(dp.getZ(i)));
  deck.deleteAttribute("uv");
  deck.computeVertexNormals();
  const deckMesh = new THREE.Mesh(deck, toon(C.deck));
  (deckMesh.material as THREE.Material).side = THREE.DoubleSide;
  add(deckMesh);

  // ---- Deckhouse: white, square windows along the sides.
  const houseY = deckAt(1) - 0.05;
  const HOUSE_H = 2.5;
  add(part(extrudeUp(plan(3.25, CUT, 3.6, 7.0, 0.5), HOUSE_H, 0.1), C.white, 0.08), 0, houseY, 0);
  const win = new THREE.BoxGeometry(0.06, 0.6, 0.7);
  for (const sx of [-1, 1])
    for (const z of [-3.6, -2.4, -1.2, 0, 1.2, 2.4]) add(new THREE.Mesh(win, toon(C.glass)), sx * 3.37, houseY + 1.45, z);
  // Lifebuoys on the deckhouse sides.
  const buoy = new THREE.TorusGeometry(0.42, 0.13, 8, 20);
  buoy.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) add(part(buoy, C.buoy, 0.03), sx * 3.42, houseY + 1.35, -4.0);
  const roofY = houseY + HOUSE_H + 0.1;
  add(railing([[-3.2, -4.5], [3.2, -4.5], [3.2, -1.9]], roofY, false));
  add(railing([[-3.2, -1.9], [-3.2, -4.5]], roofY, false));

  // ---- Bridge: a deck higher, with a wraparound band of raked dark windows under a yellow brow.
  const BRIDGE_H = 2.1;
  add(part(extrudeUp(plan(2.75, -1.9, 3.4, 6.2, 0.5), BRIDGE_H, 0.1), C.white, 0.08), 0, roofY, 0);
  const glass = extrudeUp(plan(2.8, 0.4, 3.4, 6.27, 0.5), 1.05, 0.03);
  {
    // Rake: the top of the windows leans out over the deck, as on real bridges.
    const p = glass.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / 1.05;
      if (t > 0.5) {
        p.setX(i, p.getX(i) * 1.06);
        p.setZ(i, p.getZ(i) + (p.getZ(i) > 3 ? 0.22 : 0));
      }
    }
    glass.computeVertexNormals();
  }
  add(part(glass, C.glass, 0.03), 0, roofY + 0.75, 0);
  const browY = roofY + BRIDGE_H + 0.05;
  add(part(extrudeUp(plan(3.05, -2.1, 3.4, 6.75, 0.55), 0.36, 0.06), C.yellow, 0.06), 0, browY, 0);
  const topY = browY + 0.42;
  add(new THREE.Mesh(extrudeUp(plan(2.85, -1.9, 3.4, 6.5, 0.5), 0.02, 0), toon(C.topDeck)), 0, topY - 0.01, 0);
  add(railing([[-2.8, -1.8], [2.8, -1.8], [2.8, 3.4], [2.4, 5.6], [0, 6.4], [-2.4, 5.6], [-2.8, 3.4]], topY));
  // A small white cabin on top, the mast behind its front, and two radomes.
  add(part(new THREE.BoxGeometry(2.4, 1.5, 2.2), C.white, 0.06), 0, topY + 0.75, 0.6);
  const mastZ = 0.9, mastBase = topY + 1.5;
  add(part(new THREE.CylinderGeometry(0.13, 0.22, 4.6, 8), C.white, 0.04), 0, mastBase + 2.3, mastZ);
  add(part(new THREE.BoxGeometry(2.4, 0.16, 0.22), C.white, 0.04), 0, mastBase + 3.2, mastZ);
  add(part(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 5), C.steel, 0), 0.9, mastBase + 4.0, mastZ);
  for (const [x, z] of [[-1.7, 4.2], [1.6, 3.0]] as const) {
    add(part(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 6), C.white, 0.03), x, topY + 0.28, z);
    add(part(new THREE.SphereGeometry(0.52, 16, 12), C.white, 0.04), x, topY + 0.95, z);
  }
  const radar: THREE.Object3D[] = [];
  for (const [y, w, z] of [[mastBase + 4.65, 2.2, mastZ], [mastBase + 0.3, 1.5, 2.4]] as const) {
    const r = new THREE.Group();
    r.add(part(new THREE.BoxGeometry(w, 0.18, 0.32), C.white, 0.04));
    r.position.set(0, y, z);
    g.add(r);
    radar.push(r);
  }

  // ---- Orange rescue boat on the deckhouse roof (starboard side, aft), under a white davit.
  const rb = new THREE.SphereGeometry(1, 16, 10);
  rb.scale(0.75, 0.42, 1.75);
  add(part(rb, C.buoy, 0.05), -1.9, roofY + 0.5, -3.2);
  add(part(new THREE.BoxGeometry(1.0, 0.25, 1.8), C.white, 0.03), -1.9, roofY + 0.85, -3.4);
  const davitPost = part(new THREE.BoxGeometry(0.28, 2.1, 0.28), C.white, 0.04);
  add(davitPost, -0.6, roofY + 1.05, -3.2);
  const davitArm = part(new THREE.BoxGeometry(1.6, 0.24, 0.24), C.white, 0.04);
  davitArm.rotation.z = -0.25;
  add(davitArm, -1.25, roofY + 2.0, -3.2);

  // ---- Bow: windlass and a jackstaff.
  for (const sx of [-1, 1]) {
    const w = part(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12), C.steel, 0.04);
    w.rotation.z = Math.PI / 2;
    add(w, sx * 0.75, deckAt(8.6) + 0.4, 8.6);
  }
  add(part(new THREE.BoxGeometry(0.9, 0.55, 0.8), C.white, 0.04), 0, deckAt(8.6) + 0.3, 8.6);
  const jack = part(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 5), C.white, 0);
  jack.rotation.x = 0.35;
  add(jack, 0, deckAt(12) + 1.45, 12.1);

  // ---- Aft working deck.
  const aftY = DECK_Y + sheer(-9) + 0.05;
  // A-frame: chunky navy legs and crossbar at the stern, as one group that pivots at the foot of
  // its legs (it swings out over the stern for a cast, so the rosette clears the hull).
  const aframe = new THREE.Group();
  aframe.position.set(0, aftY, -10.61);
  for (const sx of [-1, 1]) {
    const leg = part(new THREE.BoxGeometry(0.5, 5.4, 0.5), C.frame, 0.05);
    leg.rotation.x = -0.26;
    leg.rotation.z = sx * 0.06;
    leg.position.set(sx * 2.4, 2.6, -0.69);
    aframe.add(leg);
    const foot = part(new THREE.BoxGeometry(0.8, 0.5, 0.9), C.frame, 0.04);
    foot.position.set(sx * 2.4, 0.15, 0);
    aframe.add(foot);
  }
  const aTop = part(new THREE.BoxGeometry(5.5, 0.55, 0.6), C.frame, 0.05);
  aTop.position.set(0, 7.35 - aftY, -1.39);
  aframe.add(aTop);
  const sheaveWheel = part(new THREE.TorusGeometry(0.3, 0.08, 6, 14), C.steel, 0.03);
  sheaveWheel.position.set(0, 7.05 - aftY, -1.49);
  aframe.add(sheaveWheel);
  bake(aframe, new Set()); // its own parts merged: a few draw calls, not a dozen
  g.add(aframe);
  const sheave = new THREE.Vector3(0, 6.85 - aftY, -1.54);
  const ctdTop = sheave.clone().add(aframe.position);

  // CTD rosette: a ring of sample bottles around a frame (hangs from the A-frame).
  const rosette = new THREE.Group();
  const bottles: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 10; k++) {
    const b = new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8);
    const a = (k / 10) * Math.PI * 2;
    b.translate(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    bottles.push(b);
  }
  rosette.add(new THREE.Mesh(mergeGeometries(bottles)!, toon("#e8eef2")));
  for (const y of [-0.55, 0.55]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), toon(C.steel));
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    rosette.add(r);
  }
  rosette.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), toon(C.yellow)));
  rosette.position.copy(ctdTop).add(new THREE.Vector3(0, -1.2, 0));
  g.add(rosette);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), toon(C.ink));
  g.add(cable);

  // Side gantry (port, +x): a navy frame whose arm reaches out over the side.
  for (const z of [-8.0, -6.4]) add(part(new THREE.BoxGeometry(0.34, 3.4, 0.34), C.frame, 0.04), 3.45, aftY + 1.7, z);
  add(part(new THREE.BoxGeometry(0.36, 0.36, 2.0), C.frame, 0.04), 3.45, aftY + 3.4, -7.2);
  add(part(new THREE.BoxGeometry(1.5, 0.32, 0.32), C.frame, 0.04), 4.05, aftY + 3.4, -7.2);

  // Crane (starboard, behind the deckhouse), winch drum, ROV, sample crates.
  add(part(new THREE.CylinderGeometry(0.42, 0.55, 1.1, 12), C.white, 0.05), -2.5, aftY + 0.55, -5.3);
  const boom = part(new THREE.BoxGeometry(0.4, 0.4, 4.2), C.white, 0.05);
  boom.rotation.x = 0.45;
  add(boom, -2.5, aftY + 1.9, -6.9);
  const drum = part(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14), C.steel, 0.05);
  drum.rotation.z = Math.PI / 2;
  add(drum, -1.6, aftY + 0.6, -8.6);
  const rov = new THREE.Group();
  rov.add(part(new THREE.BoxGeometry(1.5, 0.5, 1.8), C.yellow, 0.05));
  const rovFrame = part(new THREE.BoxGeometry(1.4, 0.55, 1.7), "#3a3f47", 0.04);
  rovFrame.position.y = -0.5;
  rov.add(rovFrame);
  add(rov, 0.6, aftY + 0.95, -6.6);
  for (const [x, z, col, s] of [[2.3, -5.3, "#4f8fd9", 0.85], [2.5, -4.9 - 0.9, C.white, 0.7], [1.5, -5.2, "#2b6cb8", 0.6]] as const)
    add(part(new THREE.BoxGeometry(s, s * 0.8, s), col, 0.04), x, aftY + s * 0.4, z);

  // Name boards on both bows, on the white.
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTexture("R/V ARRECIFE"), transparent: true });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), nameMat);
    p.position.set(sx * 3.98, 2.55, 6.6);
    p.rotation.y = sx * (Math.PI / 2 - 0.16);
    g.add(p);
  }

  // Ensign on the stern staff.
  add(part(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), C.steel, 0), -2.9, aftY + 2.2, -11.4);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6, 6, 1), new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  flag.position.set(-2.9 - 0.6, aftY + 3.0, -11.4);
  g.add(flag);

  bake(g, new Set<THREE.Object3D>([...radar, rosette, cable, flag, aframe]));
  return { group: g, radar, rosette, cable, aframe, sheave, flag };
}

/**
 * Merge every static mesh of the boat into one mesh per material (dozens of parts → about a dozen
 * draw calls), leaving the moving parts (radar bars, CTD rosette and cable, flag) as they are.
 */
function bake(g: THREE.Group, keep: Set<THREE.Object3D>) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Mesh[] = [];
  g.traverse((o) => {
    for (let p: THREE.Object3D | null = o; p && p !== g; p = p.parent) if (keep.has(p)) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || (m.material as THREE.MeshBasicMaterial).map) return; // textured parts stay
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material)!.push(geo);
    drop.push(m);
  });
  for (const m of drop) m.removeFromParent();
  for (const [mat, list] of buckets) g.add(new THREE.Mesh(mergeGeometries(list)!, mat));
}
