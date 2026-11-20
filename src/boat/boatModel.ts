import * as THREE from "three";

// A small research vessel (~13 m) built from primitives: no model download. Forward is +z.
export function makeBoat(): { group: THREE.Group; radar: THREE.Object3D } {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: "#f4f6f7", roughness: 0.45, metalness: 0.05 });
  const navy = new THREE.MeshStandardMaterial({ color: "#14324a", roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: "#b8382b", roughness: 0.7 });
  const teak = new THREE.MeshStandardMaterial({ color: "#a98a5f", roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: "#123a52", roughness: 0.15, metalness: 0.4, emissive: "#0a2a3d", emissiveIntensity: 0.4 });
  const yellow = new THREE.MeshStandardMaterial({ color: "#f5c518", roughness: 0.5 });
  const steel = new THREE.MeshStandardMaterial({ color: "#9aa5ad", roughness: 0.35, metalness: 0.7 });

  // Hull: a box tapered to a bow and V'd underneath.
  const hullGeo = new THREE.BoxGeometry(4, 1.8, 13, 4, 2, 10);
  const pos = hullGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i);
    const z = pos.getZ(i);
    if (z > 2.5) x *= Math.max(0.02, 1 - Math.pow((z - 2.5) / 4.0, 1.6));
    if (y < 0) x *= 0.45;
    const sheer = z > 3 ? ((z - 3) / 3.5) * 0.5 : 0;
    if (y > 0) y += sheer;
    pos.setXYZ(i, x, y, z);
  }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, white);
  hull.position.y = 0.4;
  g.add(hull);
  const boot = new THREE.Mesh(hullGeo, red);
  boot.scale.set(1.01, 0.32, 1.005);
  boot.position.y = -0.18;
  g.add(boot);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.06, 0.18, 9), navy);
  stripe.position.set(0, 0.75, -0.8);
  g.add(stripe);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 10.5), teak);
  deck.position.set(0, 1.32, -0.6);
  g.add(deck);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.0, 4.2), white);
  cabin.position.set(0, 2.35, 0.6);
  g.add(cabin);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.55, 3.9), glass);
  windows.position.set(0, 2.75, 0.6);
  g.add(windows);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 4.6), navy);
  roof.position.set(0, 3.42, 0.6);
  g.add(roof);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.2, 6), steel);
  mast.position.set(0, 5.0, 0.2);
  g.add(mast);
  const radar = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.18), white);
  radar.add(bar);
  radar.position.set(0, 5.6, 0.2);
  g.add(radar);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  light.position.set(0, 6.65, 0.2);
  g.add(light);

  // Stern A-frame with a yellow sensor (CTD / camera sled).
  for (const sx of [-1.4, 1.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 0.16), steel);
    leg.position.set(sx, 2.6, -5.3);
    leg.rotation.x = -0.25;
    g.add(leg);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.16), steel);
  cross.position.set(0, 3.9, -5.65);
  g.add(cross);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10), yellow);
  sensor.position.set(0, 2.9, -5.7);
  g.add(sensor);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), navy);
  cable.position.set(0, 3.5, -5.7);
  g.add(cable);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false;
  });
  return { group: g, radar };
}
