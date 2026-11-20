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
// Pin name sizes (measured once; reading layout every frame would be slow).
const sizes = new WeakMap<HTMLElement, { w: number; h: number }>();
const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
const EDGE = 6;

export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    const pins: { el: HTMLElement; btn: HTMLElement; x: number; y: number; rank: number }[] = [];
    for (const [id, l] of labels) {
      if (!l.el) continue;
      if (l.y < -1e5) continue;
      v.set(l.x, l.y, l.z).project(camera);
      const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      l.el.style.visibility = visible ? "visible" : "hidden";
      if (!visible) continue;
      const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
      l.el.style.transform = `translate(${x}px, ${y}px)`;
      const btn = l.el.firstElementChild as HTMLElement | null;
      if (id.startsWith("pin:") && btn) {
        const c = btn.classList;
        pins.push({ el: l.el, btn, x, y, rank: (c.contains("on") ? 8 : 0) + (c.contains("hover") ? 4 : 0) + (c.contains("dive") ? 0 : 2) });
      }
    }
    // Pin names: no overlaps and nothing cut off at the screen edges. Higher-ranked names (selected,
    // hovered, stories, then dive sites; nearer ones first) win; a name that would overlap one
    // already placed is hidden, but its marker stays (still clickable). Names near an edge slide
    // inward instead of being cut off.
    pins.sort((a, b) => b.rank - a.rank || b.y - a.y);
    placed.length = 0;
    for (const p of pins) {
      const span = p.btn.firstElementChild as HTMLElement | null;
      if (!span) continue;
      let sz = sizes.get(span);
      if (!sz || !sz.w) {
        sz = { w: span.offsetWidth, h: span.offsetHeight };
        sizes.set(span, sz);
      }
      const marker = p.btn.offsetHeight ? p.btn.offsetHeight - sz.h : 14; // name sits above the marker
      let x0 = p.x - sz.w / 2;
      const dx = x0 < EDGE ? EDGE - x0 : x0 + sz.w > size.width - EDGE ? size.width - EDGE - (x0 + sz.w) : 0;
      x0 += dx;
      const box = { x0: x0 - 3, x1: x0 + sz.w + 3, y0: p.y - marker - sz.h - 2, y1: p.y - marker + 2 };
      const clash = placed.some((q) => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0);
      p.btn.classList.toggle("quiet", clash);
      span.style.transform = dx ? `translateX(${dx}px)` : "";
      if (!clash) placed.push(box);
    }
  });
  return null;
}
