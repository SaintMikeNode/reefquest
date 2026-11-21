import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "../lib/data";
import { REDUCED_MOTION } from "../lib/device";

// A curved photo carousel (after React Bits' "Circular Gallery", Tulio's pick), rebuilt with CSS 3D
// transforms instead of WebGL, so a story card doesn't open a second GPU context next to the 3D map.
// Cards sit on an arc that bends away from the center: neighbors tilt, shrink and fade toward the
// edges. Drag or swipe (with momentum), scroll the wheel, or use the arrow keys; it settles on the
// nearest photo with a spring. Only the photo in the middle is clickable (it opens the lightbox).
// One rAF loop runs only while the position is moving.

export function CurveCarousel({ photos, index, onIndex, onOpen, label }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onOpen: (i: number) => void; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const pos = useRef(index); // current position, in cards (fractional while moving)
  const target = useRef(index);
  const vel = useRef(0);
  const raf = useRef(0);
  const drag = useRef<{ x: number; start: number; last: number; t: number; moved: boolean } | null>(null);
  const [, force] = useState(0);
  const n = photos.length;

  const layout = useCallback(() => {
    const el = host.current;
    if (!el) return;
    const w = el.clientWidth;
    const cardW = Math.min(w * 0.7, 320);
    for (let i = 0; i < n; i++) {
      const c = cards.current[i];
      if (!c) continue;
      const d = i - pos.current; // distance from the middle, in cards
      const a = Math.max(-2.4, Math.min(2.4, d));
      const x = a * cardW * 0.62;
      const bend = a * a * 10; // the arc drops away from the middle
      const rot = a * 9; // and tilts
      const z = -Math.abs(a) * 90;
      const s = 1 - Math.min(Math.abs(a), 2) * 0.12;
      const o = Math.abs(d) > 2.6 ? 0 : 1 - Math.max(0, Math.abs(d) - 1.2) * 0.7;
      c.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), ${bend.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${(-rot).toFixed(2)}deg) rotateZ(${(rot * 0.35).toFixed(2)}deg) scale(${s.toFixed(3)})`;
      c.style.opacity = o.toFixed(3);
      c.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      c.style.width = `${cardW}px`;
      c.dataset.center = Math.abs(d) < 0.5 ? "true" : "false";
      c.tabIndex = Math.round(pos.current) === i ? 0 : -1;
    }
  }, [n]);

  // A critically damped spring toward the target, with the release velocity.
  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!drag.current) {
        const k = 90, c = 2 * Math.sqrt(k);
        const acc = (target.current - pos.current) * k - vel.current * c;
        vel.current += acc * dt;
        pos.current += vel.current * dt;
      }
      layout();
      if (drag.current || Math.abs(target.current - pos.current) > 0.001 || Math.abs(vel.current) > 0.001) raf.current = requestAnimationFrame(step);
      else {
        pos.current = target.current;
        layout();
      }
    };
    raf.current = requestAnimationFrame(step);
  }, [layout]);

  const go = useCallback(
    (i: number) => {
      const j = Math.max(0, Math.min(n - 1, i));
      target.current = j;
      if (j !== index) onIndex(j);
      if (REDUCED_MOTION) {
        pos.current = j;
        vel.current = 0;
        layout();
      } else run();
    },
    [n, index, onIndex, layout, run],
  );

  // Follow outside changes (e.g. a new place) and keep the layout on resize.
  useEffect(() => {
    if (Math.round(target.current) !== index) go(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (host.current) ro.observe(host.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [layout, photos]);
  useEffect(() => {
    pos.current = target.current = 0;
    vel.current = 0;
    force((k) => k + 1);
  }, [photos]);

  const cardW = () => Math.min((host.current?.clientWidth ?? 320) * 0.7, 320) * 0.62;
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, start: pos.current, last: e.clientX, t: performance.now(), moved: false };
    vel.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    run();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    const now = performance.now();
    const p = d.start - dx / cardW();
    // Rubber band past the ends.
    pos.current = p < 0 ? p * 0.35 : p > n - 1 ? n - 1 + (p - n + 1) * 0.35 : p;
    vel.current = (-(e.clientX - d.last) / cardW()) / Math.max(0.008, (now - d.t) / 1000);
    d.last = e.clientX;
    d.t = now;
  };
  const onUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // Throw: land on the photo the momentum carries to.
    go(Math.round(pos.current + Math.max(-2, Math.min(2, vel.current * 0.18))));
    if (d.moved) suppress.current = performance.now();
  };
  const suppress = useRef(0);
  const wheel = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0; // horizontal only; vertical scrolls the card
    if (!d) return;
    wheel.current += d;
    if (Math.abs(wheel.current) > 60) {
      go(index + Math.sign(wheel.current));
      wheel.current = 0;
    }
  };

  return (
    <div
      ref={host}
      className="curve"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.preventDefault(), go(index + 1));
        if (e.key === "ArrowLeft") (e.preventDefault(), go(index - 1));
      }}
    >
      {photos.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => void (cards.current[i] = el)}
          className="curve-card"
          style={{ aspectRatio: "3 / 2" }}
          aria-label={`${i + 1} / ${n}`}
          onClick={() => {
            if (performance.now() - suppress.current < 250) return; // that was a drag
            if (i === index) onOpen(i);
            else go(i);
          }}
        >
          <img src={Math.abs(i - index) <= 1 ? p.src.m : p.src.s} alt="" loading="lazy" decoding="async" draggable={false} />
        </button>
      ))}
    </div>
  );
}
