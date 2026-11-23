import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LITE } from "../lib/device";
import { useBoat } from "./boatStore";
import { obstacles, paint, planShape, RAMP, Roamer, slab } from "./shipParts";
import type { Zone } from "./zone";

// A passenger ship cruising the open water of every boat zone, a few hundred meters from the
// research vessel (Tulio: something like a cruise ship roaming around, bigger than our boat, a bit
// in the distance). Our own design in the toon style of R/V Arrecife, not a copy of his reference:
// ~70 m long against the R/V's ~25 m, a blue-and-white hull with a navy boot top, four decks of
// window bands stepping back toward a rounded front, one raked funnel, orange lifeboats along the
// side. Scenery only: no label, no claim about real ships.
//
// Cost: the ship is one merged mesh with vertex colors (~2.5k triangles, one draw call), its wake
// a second one (a few triangles with vertex alpha). Hidden under the water and when far away.
// Route (shipParts.ts `Roamer`): deep water (16 m or more) 350–700 m from the boat, clear of it,
// turning slowly. It is solid: the research vessel bumps off it (`obstacles`).

const LENGTH = 70; // m
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

  const roam = useMemo(
    () => new Roamer(zone, { minDepth: 16, speed: 4.6, turn: 0.07, near: [350, 700], spawnAt: [450, 750], clear: 140, leash: 2600, look: 130 }, 7),
    [zone],
  );
  useEffect(() => () => void obstacles.delete("cruise"), []);

  useFrame((fr, dtRaw) => {
    const { tele, under } = useBoat.getState();
    if (!tele) return;
    const dt = Math.min(dtRaw, 0.1), t = fr.clock.elapsedTime;
    if (!roam.step(t, dt, tele.x, tele.z)) {
      ship.visible = false;
      obstacles.delete("cruise");
      return;
    }
    obstacles.set("cruise", { x: roam.x, z: roam.z, yaw: roam.head, hl: LENGTH / 2, hw: 6.2 });
    // Shown from above the water only, and while it's within sight.
    ship.visible = !under && Math.hypot(tele.x - roam.x, tele.z - roam.z) < 2400;
    if (!ship.visible) return;
    ship.position.set(roam.x, Math.sin(t * 0.5) * 0.08, roam.z);
    // Heeling a little into turns, and a slow roll and pitch on the swell.
    ship.rotation.set(Math.sin(t * 0.37) * 0.006, roam.head, Math.sin(t * 0.29) * 0.012 - roam.turnNow * 0.05, "YXZ");
  });

  return <primitive object={ship} />;
}
