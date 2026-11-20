import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Screen-space labels without a React root per label: 3D anchor points live in this map, a
// projector inside the Canvas moves the matching DOM elements every rendered frame, and the
// elements themselves are ordinary React children of an overlay outside the Canvas.
interface Label {
  x: number;
  y: number;
  z: number;
  el: HTMLElement | null;
}
export const labels = new Map<string, Label>();

export function setLabelAnchor(id: string, x: number, y: number, z: number) {
  const l = labels.get(id);
  if (l) Object.assign(l, { x, y, z });
  else labels.set(id, { x, y, z, el: null });
}
export function labelRef(id: string) {
  return (el: HTMLElement | null) => {
    const l = labels.get(id);
    if (l) l.el = el;
    else labels.set(id, { x: 0, y: -1e6, z: 0, el });
  };
}
/** Park labels off-screen. Entries are kept so DOM element refs survive effect re-runs. */
export function clearLabels(prefix: string) {
  for (const [k, l] of labels) {
    if (!k.startsWith(prefix)) continue;
    l.y = -1e6;
    if (l.el) l.el.style.visibility = "hidden";
  }
}

const v = new THREE.Vector3();
export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const l of labels.values()) {
      if (!l.el) continue;
      if (l.y < -1e5) continue;
      v.set(l.x, l.y, l.z).project(camera);
      const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.visibility = visible ? "visible" : "hidden";
      if (visible) l.el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px)`;
    }
  });
  return null;
}
