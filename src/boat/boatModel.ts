import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// A stylized modern oceanographic research vessel (~24 m), built from extruded outlines and
// primitives: no model download. Forward is +z, the waterline is y = 0.

// Livery after modern research vessels (cf. R/V Falkor (too), E/V Nautilus): royal-blue hull over a
// red-brown boot-top, white superstructure, black mast, white radomes, dark A-frame, one orange
// accent (the enclosed lifeboat), yellow ROV.
export const LIVERY = {
  hull: "#0b4d97",
  stripe: "#f4f6f7",
  boot: "#8f3a25",
  superstructure: "#ffffff",
  glass: "#14222e",
  aframe: "#3b4249",
  crane: "#d9dde0",
  band: "#0b4d97",
  lifeboat: "#f2822a",
  mast: "#1f2328",
  deck: "#7f878d",
  rov: "#f2c42b",
  steel: "#a9b2b8",
};

function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts });
}

/** Top-view outline (x across, y = forward) of a hull or deckhouse. */
function plan(halfW: number, stern: number, bowStart: number, bow: number, sternRound = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(-halfW + sternRound, stern);
  s.lineTo(halfW - sternRound, stern);
  s.quadraticCurveTo(halfW, stern, halfW, stern + sternRound);
  s.lineTo(halfW, bowStart);
  s.bezierCurveTo(halfW, bowStart + (bow - bowStart) * 0.55, halfW * 0.35, bow - 0.4, 0, bow);
  s.bezierCurveTo(-halfW * 0.35, bow - 0.4, -halfW, bowStart + (bow - bowStart) * 0.55, -halfW, bowStart);
  s.lineTo(-halfW, stern + sternRound);
  s.quadraticCurveTo(-halfW, stern, -halfW + sternRound, stern);
  return s;
}

/** Extrude a plan upward: shape (x, y=forward) → geometry with x, y = height, z = forward. */
function extrudeUp(shape: THREE.Shape, height: number, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 });
  // Rotate (not mirror, which would flip the faces inside out): shape y → +z (forward), extrusion → −y.
  g.rotateX(Math.PI / 2);
  g.translate(0, height, 0); // extrusion now spans y = 0 … height
  g.computeVertexNormals();
  return g;
}

function nameTexture(text: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "#f4f6f7";
  g.font = "600 52px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";
  g.textBaseline = "middle";
  g.fillText(text, 8, 40);
  g.font = "500 22px 'IBM Plex Mono', Menlo, monospace";
  g.fillText(sub, 10, 80);
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
  ctdTop: THREE.Vector3; // A-frame sheave position (vessel space)
  flag: THREE.Mesh;
}

export function makeVessel(): Vessel {
  const g = new THREE.Group();
  const L = LIVERY;
  const hullMat = mat(L.hull, { roughness: 0.45 });
  const white = mat(L.superstructure, { roughness: 0.65, emissive: "#ffffff", emissiveIntensity: 0.08 });
  const aframe = mat(L.aframe, { roughness: 0.5, metalness: 0.2 });
  const crane = mat(L.crane, { roughness: 0.5 });
  const mastMat = mat(L.mast, { roughness: 0.6 });
  const steel = mat(L.steel, { roughness: 0.35, metalness: 0.6 });
  const glass = mat(L.glass, { roughness: 0.15, metalness: 0.4 });
  const deckMat = mat(L.deck, { roughness: 0.85 });

  // ---- Hull: plan extruded, V'd below the waterline, with sheer rising to the bow.
  const hullPlan = plan(3.2, -12, 4, 12.5, 0.9);
  const hull = extrudeUp(hullPlan, 4.2, 0.12);
  hull.translate(0, -1.6, 0);
  const hp = hull.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i), y = hp.getY(i);
    const z = hp.getZ(i);
    if (y < -0.5) x *= 0.42 + 0.58 * Math.min(1, (y + 1.72) / 1.2); // V bottom
    if (y > 2.0) y += Math.max(0, (z - 2) / 10.5) * 0.9; // sheer rising forward
    hp.setXYZ(i, x, y, z);
  }
  hull.computeVertexNormals();
  g.add(new THREE.Mesh(hull, hullMat));
  // Boot-top (red below the waterline) and a white sheer stripe: thin scaled shells of the hull.
  const boot = new THREE.Mesh(hull, mat(L.boot, { roughness: 0.7 }));
  boot.scale.set(1.006, 0.3, 1.003);
  boot.position.y = -1.15;
  g.add(boot);
  const stripeG = extrudeUp(plan(3.23, -11.95, 4, 12.45, 0.9), 0.22, 0);
  stripeG.translate(0, 1.9, 0);
  g.add(new THREE.Mesh(stripeG, mat(L.stripe)));

  // ---- Main deck.
  const deck = extrudeUp(plan(3.05, -11.85, 4, 12.2, 0.8), 0.08, 0);
  deck.translate(0, 2.55, 0);
  g.add(new THREE.Mesh(deck, deckMat));

  // ---- Superstructure: three stepped levels, rounded front, bridge with wraparound windows.
  const lvl1 = extrudeUp(plan(2.7, -1.5, 5, 8.2, 0.3), 2.0, 0.1);
  lvl1.translate(0, 2.6, 0);
  g.add(new THREE.Mesh(lvl1, white));
  const lvl2 = extrudeUp(plan(2.45, -0.5, 4.8, 7.4, 0.3), 1.8, 0.1);
  lvl2.translate(0, 4.7, 0);
  g.add(new THREE.Mesh(lvl2, white));
  const bridge = extrudeUp(plan(2.3, 0.6, 4.6, 6.8, 0.3), 1.7, 0.08);
  bridge.translate(0, 6.6, 0);
  g.add(new THREE.Mesh(bridge, white));
  const windows = extrudeUp(plan(2.34, 0.55, 4.6, 6.85, 0.3), 0.75, 0);
  windows.translate(0, 7.3, 0);
  g.add(new THREE.Mesh(windows, glass));
  const roof = extrudeUp(plan(2.55, 0.3, 4.6, 7.0, 0.3), 0.14, 0);
  roof.translate(0, 8.35, 0);
  g.add(new THREE.Mesh(roof, mat("#d9dde0")));
  // Bridge wings.
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.6), white);
    wing.position.set(sx * 2.85, 6.65, 5.2);
    g.add(wing);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: sx < 0 ? "#ff3b30" : "#34c759" }));
    nav.position.set(sx * 3.3, 6.9, 5.6);
    g.add(nav);
  }
  // Portholes / lower windows as dark strips.
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 5.2), glass);
    strip.position.set(sx * 2.72, 3.9, 3.0);
    g.add(strip);
  }

  // ---- Enclosed lifeboat (the one orange accent), port side.
  const lb = new THREE.CapsuleGeometry(0.75, 3.2, 4, 10);
  lb.rotateX(Math.PI / 2);
  lb.scale(1, 0.85, 1);
  const lifeboat = new THREE.Mesh(lb, mat(L.lifeboat, { roughness: 0.5 }));
  lifeboat.position.set(-3.0, 5.3, 1.2);
  g.add(lifeboat);
  const davit = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), steel);
  davit.position.set(-2.75, 5.3, -0.4);
  g.add(davit);

  // ---- Stack with a blue band.
  const stack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.6), white);
  stack.position.set(0, 6.9, -1.4);
  stack.rotation.x = -0.12;
  g.add(stack);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.45, 1.64), mat(L.band));
  band.position.set(0, 7.6, -1.48);
  band.rotation.x = -0.12;
  g.add(band);

  // ---- Mast: tapered post, two radar bars, radomes, antennas.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.2, 8), mastMat);
  mast.position.set(0, 10.5, 2.6);
  g.add(mast);
  const yard = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.2), mastMat);
  yard.position.set(0, 11.2, 2.6);
  g.add(yard);
  const radar: THREE.Object3D[] = [];
  for (const [y, w] of [[12.3, 2.4], [9.2, 1.8]] as const) {
    const r = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.3), white);
    r.add(bar);
    r.position.set(0, y, y > 10 ? 2.6 : 4.4);
    g.add(r);
    radar.push(r);
  }
  for (const [x, z, rad] of [[-1.4, 1.6, 0.5], [1.4, 1.6, 0.42], [0, 0.6, 0.62]] as const) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8), steel);
    ped.position.set(x, 8.75, z);
    g.add(ped);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), white);
    dome.position.set(x, 9.1 + rad * 0.6, z);
    g.add(dome);
  }
  for (const [x, h] of [[-0.9, 2.6], [0.9, 2.0], [0.4, 3.0]] as const) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, h, 5), steel);
    ant.position.set(x, 11.2 + h / 2, 2.6);
    g.add(ant);
  }

  // ---- Aft science deck: A-frame, CTD rosette, crane, winches, ROV.
  const aLeg = new THREE.BoxGeometry(0.3, 5.2, 0.3);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(aLeg, aframe);
    leg.position.set(sx * 2.4, 4.9, -11.3);
    leg.rotation.x = -0.28;
    leg.rotation.z = sx * 0.06;
    g.add(leg);
  }
  const aTop = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.34, 0.34), aframe);
  aTop.position.set(0, 7.35, -12.0);
  g.add(aTop);
  const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 14), steel);
  sheave.position.set(0, 7.05, -12.1);
  g.add(sheave);
  const ctdTop = new THREE.Vector3(0, 6.85, -12.15);

  // CTD rosette: a ring of sample bottles around a frame.
  const rosette = new THREE.Group();
  const bottles: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 10; k++) {
    const b = new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8);
    const a = (k / 10) * Math.PI * 2;
    b.translate(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    bottles.push(b);
  }
  rosette.add(new THREE.Mesh(mergeGeometries(bottles)!, mat("#e8eef2", { roughness: 0.3 })));
  for (const y of [-0.55, 0.55]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    rosette.add(ring);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), mat(L.rov));
  rosette.add(core);
  rosette.position.copy(ctdTop).add(new THREE.Vector3(0, -1.2, 0));
  g.add(rosette);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), mat("#222831"));
  g.add(cable);

  // Knuckle-boom crane on the starboard side.
  const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), crane);
  cBase.position.set(2.2, 3.1, -4.6);
  g.add(cBase);
  const boom1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 4.2), crane);
  boom1.position.set(2.2, 4.4, -6.2);
  boom1.rotation.x = 0.55;
  g.add(boom1);
  const boom2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 3.0), crane);
  boom2.position.set(2.2, 5.0, -8.9);
  boom2.rotation.x = -0.35;
  g.add(boom2);

  // Winches.
  for (const [x, z] of [[-1.6, -7.4], [-1.6, -9.4]] as const) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 14), steel);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(x, 3.1, z);
    g.add(drum);
  }

  // ROV on deck: yellow float block over a dark frame with thrusters.
  const rov = new THREE.Group();
  const rFloat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 2.2), mat(L.rov));
  rFloat.position.y = 0.95;
  rov.add(rFloat);
  const rFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.1), mat("#2b3036", { roughness: 0.8 }));
  rFrame.position.y = 0.35;
  rov.add(rFrame);
  for (const sx of [-1, 1]) {
    const thr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 10), steel);
    thr.rotation.x = Math.PI / 2;
    thr.position.set(sx * 0.95, 0.6, -0.9);
    rov.add(thr);
  }
  rov.position.set(0.2, 2.65, -4.4);
  g.add(rov);

  // Railings along the aft deck.
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 10.5), steel);
    rail.position.set(sx * 3.0, 3.6, -6.4);
    g.add(rail);
    for (let z = -11.4; z <= -1.4; z += 1.25) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.04), steel);
      post.position.set(sx * 3.0, 3.1, z);
      g.add(post);
    }
  }

  // Hull name on both bows.
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTexture("R/V ARRECIFE", "HONDURAS · OCEAN SCIENCE"), transparent: true, depthWrite: false });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), nameMat);
    p.position.set(sx * 3.27, 1.15, 5.6);
    p.rotation.y = sx * (Math.PI / 2);
    g.add(p);
  }

  // Ensign on the stern staff.
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), steel);
  staff.position.set(-2.4, 3.7, -11.6);
  g.add(staff);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6, 6, 1), new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  flag.position.set(-2.4 - 0.6, 4.45, -11.6);
  g.add(flag);

  return { group: g, radar, rosette, cable, ctdTop, flag };
}
