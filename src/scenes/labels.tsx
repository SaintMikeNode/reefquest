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
// Boat view tags (ids "buoy:…"): measured once per text, re-measured when the text changes.
const tagSize = new WeakMap<HTMLElement, { w: number; h: number; k: string }>();
const tags: { el: HTMLElement; btn: HTMLElement; x: number; y: number; depth: number }[] = [];
const TAG_GAP = 12; // px between a place and the bottom of its tag
// The HUD's boxes in canvas pixels, re-read twice a second (layout reads are cheap at that rate):
// tags step around them. `side`: a panel along the left or right edge, which a tag slides away
// from sideways; the others (compass, arrival tag, messages) it steps above or below.
type Box = { x0: number; x1: number; y0: number; y1: number; side?: boolean };
let blocks: Box[] = [];
let blocksAt = 0;
function readBlocks(root: Element | null, canvas: HTMLCanvasElement) {
  blocks = [];
  if (!root) return;
  const off = canvas.getBoundingClientRect();
  const add = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return;
    const x0 = r.left - off.left, x1 = r.right - off.left;
    blocks.push({ x0, x1, y0: r.top - off.top, y1: r.bottom - off.top, side: x0 < 40 || x1 > off.width - 40 });
  };
  for (const el of root.querySelectorAll(".hud")) {
    if (el.matches(".tap-hint, .viewfinder")) continue; // a passing hint, or the camera (tags are off then)
    if (!el.matches(".top-stack, .boat-bottom, .plate")) add(el);
    else
      for (const c of el.children) {
        if (c.matches(".controls-hint")) for (const cc of c.children) add(cc); // the card, not its wide row
        else add(c);
      }
  }
}
/** How far each tag is stepped from its own spot (px), eased: when tags trade places they glide
 *  instead of snapping, while the tag still follows its place exactly. */
const shift = new WeakMap<HTMLElement, { dx: number; dy: number; seen: number; down: boolean }>();
let frameNo = 0;
const overlaps = (a: Box, b: Box, m: number) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.y0 < b.y1 + m && a.y1 > b.y0 - m;

export function LabelProjector() {
  const { camera, size, gl } = useThree();
  useFrame((_, dt) => {
    frameNo++;
    const pins: { el: HTMLElement; btn: HTMLElement; x: number; y: number; rank: number }[] = [];
    tags.length = 0;
    for (const [id, l] of labels) {
      if (!l.el) continue;
      if (l.y < -1e5) continue;
      v.set(l.x, l.y, l.z).project(camera);
      // Boat view tags show whenever the view faces their place, even when it lies above the top
      // of the screen (far places sit on the horizon): the tag is then held inside the screen.
      const tag = id.startsWith("buoy:");
      const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < (tag ? 1.04 : 1.1) && (tag || Math.abs(v.y) < 1.1);
      l.el.style.visibility = visible ? "visible" : "hidden";
      if (!visible) continue;
      const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
      l.el.style.transform = `translate(${x}px, ${y}px)`;
      const btn = l.el.firstElementChild as HTMLElement | null;
      if (id.startsWith("buoy:") && btn) tags.push({ el: l.el, btn, x, y, depth: v.z });
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
    // Boat view tags: none hidden and none overlapping. Nearest first; a tag that would cover one
    // already placed is lifted above it on its stem (and so on up), and tags near a side of the
    // screen slide inward.
    // Boat view tags: every place the view faces gets its tag, never hidden behind a panel and never
    // on top of another tag. Nearest first, each takes the first free spot: above its place, inside
    // the screen; slid sideways off a panel along the edge; then stepped up, or else down, past
    // whatever it would cover (far places crowd the horizon under the compass and stack downward).
    // The stem joins tag and place when the tag is above it. (Before, a tag that touched the HUD was
    // hidden, and far places only flashed into view when the camera swung: Tulio.)
    if (tags.length) {
      const now = performance.now();
      if (now - blocksAt > 500) {
        blocksAt = now;
        readBlocks(gl.domElement.closest(".scene-root"), gl.domElement);
      }
      const W = size.width, H = size.height;
      tags.sort((a, b) => a.depth - b.depth);
      placed.length = 0;
      for (const g of tags) {
        const k = g.btn.dataset.k ?? "";
        let sz = tagSize.get(g.btn);
        if (!sz || sz.k !== k || !sz.w) {
          sz = { w: g.btn.offsetWidth, h: g.btn.offsetHeight, k };
          tagSize.set(g.btn, sz);
        }
        const w = sz.w, h = sz.h;
        const home = Math.min(Math.max(g.x - w / 2, EDGE), Math.max(EDGE, W - EDGE - w));
        let x0 = home;
        const pref = Math.min(Math.max(g.y - TAG_GAP, EDGE + h), H - EDGE);
        // Off a panel along the edge, sideways.
        for (const r of blocks)
          if (r.side && overlaps({ x0, x1: x0 + w, y0: pref - h, y1: pref }, r, 6)) {
            if (r.x0 < W / 2) x0 = Math.max(x0, r.x1 + 8);
            else x0 = Math.min(x0, r.x0 - 8 - w);
          }
        x0 = Math.min(Math.max(x0, EDGE), Math.max(EDGE, W - EDGE - w));
        const clash = (y1: number) => {
          const box = { x0, x1: x0 + w, y0: y1 - h, y1 };
          return blocks.find((r) => overlaps(box, r, 6)) ?? placed.find((r) => overlaps(box, r, 4));
        };
        // Up past what it covers, or down: in the order that worked last frame, so tags don't trade
        // places back and forth.
        const before = shift.get(g.btn);
        const wasDown = !!before && before.seen === frameNo - 1 && before.down;
        const search = (down: boolean) => {
          let y = pref;
          for (let t = 0; t < 14; t++) {
            const hit = clash(y);
            if (!hit) return y;
            y = down ? hit.y1 + 6 + h : hit.y0 - 6;
            if (down ? y > H - EDGE : y - h < EDGE) return null;
          }
          return null;
        };
        let y1 = pref, ok = false, down = wasDown;
        let found = search(down);
        if (found === null) (down = !down), (found = search(down));
        if (found !== null) (y1 = found), (ok = true);
        if (!ok) {
          g.el.style.visibility = "hidden";
          continue;
        }
        placed.push({ x0, x1: x0 + w, y0: y1 - h, y1 });
        // Ease the step away from its own spot (a tag just come into view starts where it belongs).
        let sh = shift.get(g.btn);
        if (!sh || sh.seen !== frameNo - 1) sh = { dx: x0 - home, dy: y1 - pref, seen: frameNo, down };
        sh.down = down;
        const ease = 1 - Math.exp(-Math.min(dt, 0.1) * 20);
        sh.dx += (x0 - home - sh.dx) * ease;
        sh.dy += (y1 - pref - sh.dy) * ease;
        sh.seen = frameNo;
        shift.set(g.btn, sh);
        x0 = home + sh.dx;
        y1 = pref + sh.dy;
        const tf = `translate(${Math.round(x0 - g.x)}px, ${Math.round(y1 - h - g.y)}px)`;
        if (g.btn.style.transform !== tf) g.btn.style.transform = tf;
        // The stem: from the tag down to its place, when the tag is above it and right over it.
        const stem = g.btn.nextElementSibling as HTMLElement | null;
        if (stem) {
          const len = g.y - y1;
          const show = len > 2 && g.y < H && g.x > x0 + 4 && g.x < x0 + w - 4;
          const top = show ? `${Math.round(-len)}px` : "0px", ht = show ? `${Math.round(len)}px` : "0px";
          if (stem.style.top !== top) stem.style.top = top;
          if (stem.style.height !== ht) stem.style.height = ht;
        }
      }
    }
  });
  return null;
}
