import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LITE } from "../lib/device";

// The research vessel R/V Arrecife, stylized like a game boat (Tulio's reference: a chunky cartoon
// tugboat) but in research-ship blues and whites and kitted out for ocean science: a stout ~24 m hull with a bold sheer rising
// to the bow, thick white gunwale trim, tire fenders, a white wheelhouse with portholes under an
// overhanging roof, a banded funnel, a radar mast with a radome, and an aft science
// deck with a white A-frame (the CTD rosette hangs from it), crane, winch, ROV and sample crates.
// Toon shading (three light bands) and dark ink outlines give it the illustrated look; everything
// is built from shapes and primitives, no model download. Forward is +z, the waterline is y = 0.
// The hull keeps the old size (bow +12.5, stern −12, draft ~2 m), which the physics relies on.

// Blues and whites, like a real research ship (a first coral/terracotta palette read as a toy).
const C = {
  hull: "#1f5fae", // royal blue
  hullDark: "#1a4f93",
  trim: "#f4f7fa", // white gunwale rail and stripe
  boot: "#0f2a4d", // deep navy below the waterline
  deck: "#b9c3cc", // light grey non-slip deck
  house: "#f7f9fb", // white wheelhouse
  roof: "#d6e2ee", // pale blue-grey
  glass: "#1d2f4a",
  funnel: "#1f5fae",
  band: "#f7f9fb",
  science: "#eef2f5", // white A-frame and crane
  rov: "#f2c230", // the one yellow accent: the ROV
  steel: "#9aa6ae",
  rubber: "#26282c",
  buoy: "#f2622e", // orange lifebuoys (safety color)
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
function plan(halfW: number, stern: number, bowStart: number, bow: number, sternRound = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(-halfW + sternRound, stern);
  s.lineTo(halfW - sternRound, stern);
  s.quadraticCurveTo(halfW, stern, halfW, stern + sternRound);
  s.lineTo(halfW, bowStart);
  s.bezierCurveTo(halfW, bowStart + (bow - bowStart) * 0.6, halfW * 0.45, bow - 0.3, 0, bow);
  s.bezierCurveTo(-halfW * 0.45, bow - 0.3, -halfW, bowStart + (bow - bowStart) * 0.6, -halfW, bowStart);
  s.lineTo(-halfW, stern + sternRound);
  s.quadraticCurveTo(-halfW, stern, -halfW + sternRound, stern);
  return s;
}

/** Extrude a plan upward: shape (x, y=forward) → geometry with x, y = height (0…h), z = forward. */
function extrudeUp(shape: THREE.Shape, height: number, bevel = 0.08, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments });
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

  // ---- Hull: a stout V-bottomed block up to the deck, bent with the sheer.
  const hull = extrudeUp(plan(4.0, -12, 2.0, 12.5, 1.4), 3.8, 0.18);
  hull.translate(0, -1.9, 0);
  {
    const p = hull.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.4) p.setX(i, p.getX(i) * (0.45 + 0.55 * Math.min(1, (y + 1.95) / 1.55))); // V bottom
    }
  }
  bend(hull, -1.9, DECK_Y);
  add(part(hull, C.hull, 0.09));
  // Navy bottom below the waterline, and a white stripe along the side.
  const boot = hull.clone();
  const bp = boot.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) bp.setY(i, Math.min(bp.getY(i), 0.15 + sheer(bp.getZ(i)) * 0.15));
  boot.computeVertexNormals();
  const bootMesh = new THREE.Mesh(boot, toon(C.boot));
  bootMesh.scale.set(1.012, 1, 1.006);
  add(bootMesh);
  const stripe = extrudeUp(plan(4.04, -11.97, 2.0, 12.46, 1.4), 0.32, 0);
  stripe.translate(0, 1.0, 0);
  bend(stripe, -1.9, DECK_Y); // same bend as the hull at that height
  add(new THREE.Mesh(stripe, toon(C.trim)));

  // ---- Bulwark: a wall around the deck, blue, capped with a thick white rail.
  const ring = plan(4.0, -12, 2.0, 12.5, 1.4);
  ring.holes.push(plan(3.55, -11.55, 2.2, 11.6, 1.1) as unknown as THREE.Path);
  const bulwark = bend(extrudeUp(ring, 1.0, 0.04), -2, -1); // the whole wall rides on the sheer
  bulwark.translate(0, DECK_Y, 0);
  add(part(bulwark, C.hullDark, 0.06));
  const capRing = plan(4.15, -12.15, 2.0, 12.7, 1.5);
  capRing.holes.push(plan(3.45, -11.45, 2.2, 11.5, 1.0) as unknown as THREE.Path);
  const cap = bend(extrudeUp(capRing, 0.28, 0.06), -2, -1);
  cap.translate(0, DECK_Y + 1.0, 0);
  add(part(cap, C.trim, 0.05));

  // ---- Deck: wood, following the sheer.
  const deck = new THREE.ShapeGeometry(plan(3.6, -11.6, 2.2, 11.7, 1.1), 12);
  deck.rotateX(-Math.PI / 2);
  deck.scale(1, 1, -1); // shape y → +z forward
  const dp = deck.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < dp.count; i++) dp.setY(i, DECK_Y + 0.02 + sheer(dp.getZ(i)));
  deck.deleteAttribute("uv");
  deck.computeVertexNormals();
  const deckMesh = new THREE.Mesh(deck, toon(C.deck));
  (deckMesh.material as THREE.Material).side = THREE.DoubleSide;
  add(deckMesh);
  // Plank lines.
  for (let x = -3; x <= 3; x += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 20), toon("#a87745"));
    add(plank, x, DECK_Y + 0.05, 0);
  }

  // ---- Tire fenders hanging over the sides.
  const tire = new THREE.TorusGeometry(0.42, 0.2, 8, 16);
  tire.rotateY(Math.PI / 2);
  for (const sx of [-1, 1])
    for (const z of [-6.5, -1.5, 3.5]) {
      add(part(tire, C.rubber, 0.04), sx * 4.25, 1.15 + sheer(z) * 0.8, z);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), toon("#d9c79e"));
      add(rope, sx * 4.2, 2.3 + sheer(z) * 0.8, z);
    }

  // ---- Wheelhouse: white, rounded, big front windows and round portholes, overhanging roof.
  const houseY = DECK_Y + sheer(3) * 0.9;
  const house = extrudeUp(plan(2.5, -0.5, 4.2, 6.4, 0.9), 3.1, 0.18);
  add(part(house, C.house, 0.08), 0, houseY, 0);
  // Wraparound windows across the rounded front.
  const glassBand = extrudeUp(plan(2.56, 3.0, 4.2, 6.48, 0.9), 1.1, 0.04);
  add(part(glassBand, C.glass, 0.04), 0, houseY + 1.6, 0);
  for (const sx of [-1, 1])
    for (const z of [0.6, 2.2]) {
      const rim = new THREE.TorusGeometry(0.42, 0.11, 8, 18);
      rim.rotateY(Math.PI / 2);
      add(part(rim, C.trim, 0.03), sx * 2.6, houseY + 2.0, z);
      const pane = new THREE.CircleGeometry(0.36, 18);
      pane.rotateY(sx * (Math.PI / 2));
      add(new THREE.Mesh(pane, toon("#7fb8d8")), sx * 2.62, houseY + 2.0, z);
    }
  const roof = extrudeUp(plan(3.05, -1.2, 4.4, 7.3, 1.0), 0.4, 0.2);
  add(part(roof, C.roof, 0.08), 0, houseY + 3.1, 0);
  const roof2 = extrudeUp(plan(1.9, -0.2, 3.6, 5.6, 0.7), 0.5, 0.18);
  add(part(roof2, C.roof, 0.07), 0, houseY + 3.55, 0);
  // Lifebuoys on the wheelhouse sides.
  const buoy = new THREE.TorusGeometry(0.55, 0.17, 8, 20);
  buoy.rotateY(Math.PI / 2);
  for (const sx of [-1, 1]) add(part(buoy, C.buoy, 0.04), sx * 2.62, houseY + 1.0, 3.6);

  // ---- Funnel: stands on the deck just aft of the wheelhouse (not on its roof) and rises above it,
  // tilted back, blue with a white band and a dark rim at the top where the smoke comes out.
  const fz = -2.7, fBase = DECK_Y + sheer(fz), fH = 5.3, tilt = -0.12;
  const fun = new THREE.CylinderGeometry(0.7, 0.85, fH, 16);
  const funnel = part(fun, C.funnel, 0.06);
  funnel.rotation.x = tilt;
  add(funnel, 0, fBase + fH / 2, fz);
  // Points along the tilted axis, measured from the funnel's middle.
  const onAxis = (d: number) => [fBase + fH / 2 + d * Math.cos(tilt), fz + d * Math.sin(tilt)] as const;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.78, 0.5, 16), toon(C.band));
  band.rotation.x = tilt;
  const [by, bz] = onAxis(fH / 2 - 0.9);
  add(band, 0, by, bz);
  const fRim = new THREE.TorusGeometry(0.7, 0.12, 6, 18);
  fRim.rotateX(Math.PI / 2);
  const rim = part(fRim, C.ink, 0);
  rim.rotation.x = tilt;
  const [ry, rz] = onAxis(fH / 2);
  add(rim, 0, ry, rz);

  // ---- Mast on the roof: radar bars (spinning), a white radome, antennas.
  const mastY = houseY + 4.05;
  add(part(new THREE.CylinderGeometry(0.12, 0.18, 4.2, 8), "#f7f9fb", 0.04), 0, mastY + 2.1, 3.4);
  add(part(new THREE.BoxGeometry(2.6, 0.16, 0.22), "#f7f9fb", 0.04), 0, mastY + 2.9, 3.4);
  const radar: THREE.Object3D[] = [];
  for (const [y, w, z] of [[mastY + 4.3, 2.2, 3.4], [mastY + 0.55, 1.4, 5.0]] as const) {
    const r = new THREE.Group();
    r.add(part(new THREE.BoxGeometry(w, 0.18, 0.32), "#f7f9fb", 0.04));
    r.position.set(0, y, z);
    g.add(r);
    radar.push(r);
  }
  add(part(new THREE.SphereGeometry(0.7, 16, 12), "#ffffff", 0.05), -1.2, mastY + 0.75, 1.4);
  add(part(new THREE.CylinderGeometry(0.035, 0.05, 2.4, 5), C.steel, 0), 1.0, mastY + 1.2, 1.2);

  // ---- Aft science deck.
  const aftY = DECK_Y + sheer(-9) + 0.05;
  // A-frame: chunky white legs and crossbar at the stern, as one group that pivots at the foot of
  // its legs (it swings out over the stern for a cast, so the rosette clears the hull).
  const aframe = new THREE.Group();
  aframe.position.set(0, aftY, -10.61);
  for (const sx of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(0.22, 0.28, 5.4, 10), C.science, 0.05);
    leg.rotation.x = -0.26;
    leg.rotation.z = sx * 0.06;
    leg.position.set(sx * 2.4, 2.6, -0.69);
    aframe.add(leg);
  }
  const aTop = part(new THREE.CylinderGeometry(0.26, 0.26, 5.2, 10), C.science, 0.05);
  aTop.rotation.z = Math.PI / 2;
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
  rosette.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), toon(C.rov)));
  rosette.position.copy(ctdTop).add(new THREE.Vector3(0, -1.2, 0));
  g.add(rosette);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), toon(C.ink));
  g.add(cable);

  // Crane (starboard), winch drum, ROV, sample crates.
  add(part(new THREE.CylinderGeometry(0.45, 0.6, 1.0, 12), C.science, 0.05), 2.4, aftY + 0.5, -4.4);
  const boom = part(new THREE.BoxGeometry(0.42, 0.42, 4.6), C.science, 0.05);
  boom.rotation.x = 0.5;
  add(boom, 2.4, aftY + 1.9, -6.0);
  const drum = part(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14), C.steel, 0.05);
  drum.rotation.z = Math.PI / 2;
  add(drum, -1.8, aftY + 0.6, -8.2);
  const rov = new THREE.Group();
  rov.add(part(new THREE.BoxGeometry(1.7, 0.55, 2.0), C.rov, 0.05));
  const rovFrame = part(new THREE.BoxGeometry(1.6, 0.6, 1.9), "#3a3f47", 0.04);
  rovFrame.position.y = -0.55;
  rov.add(rovFrame);
  add(rov, 0.3, aftY + 1.0, -3.8);
  for (const [x, z, col, s] of [[-2.2, -3.4, "#4f8fd9", 0.9], [-2.4, -4.6, "#f7f9fb", 0.75], [-1.3, -3.6, "#2b6cb8", 0.65]] as const)
    add(part(new THREE.BoxGeometry(s, s * 0.8, s), col, 0.04), x, aftY + s * 0.4, z);

  // Name boards on both bows.
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTexture("R/V ARRECIFE"), transparent: true });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.92), nameMat);
    p.position.set(sx * 3.95, 2.4, 6.4);
    p.rotation.y = sx * (Math.PI / 2 - 0.12);
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
