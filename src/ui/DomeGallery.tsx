import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import type { Photo } from "../lib/data";
import { LITE, REDUCED_MOTION } from "../lib/device";
import { IconClose } from "./Icons";
import { Lightbox } from "./Lightbox";

// Every photo at once, on the inside of a dome you look around in (after React Bits' "Dome
// Gallery", Tulio's pick; our own code, CSS 3D, no gesture library). Tiles sit on a sphere around
// the viewer; dragging turns it (with momentum), a slow drift turns it on its own until you touch
// it, and a tap opens the photo in the lightbox with its credit. Loaded lazily, only when opened.
// Lite devices get a plain scrolling grid instead of the 3D dome.

const COLS = 12, ROWS = 6;

export default function DomeGallery({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const t = useT();
  const sphere = useRef<HTMLDivElement>(null);
  const rot = useRef({ x: -4, y: 0, vx: 0, vy: 0.03 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  // Fill the sphere's slots, repeating photos when there are fewer slots than tiles.
  const tiles = useMemo(() => {
    const out: { p: Photo; i: number; col: number; row: number }[] = [];
    let k = 0;
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) out.push({ p: photos[k % photos.length], i: k % photos.length, col: col + (row % 2) * 0.5, row }), k++;
    return out;
  }, [photos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && open === null && close();
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Turn the dome: momentum after a drag, then a slow drift.
  useEffect(() => {
    if (LITE) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = rot.current;
      if (!drag.current) {
        r.y += r.vy * dt * 60;
        r.x += r.vx * dt * 60;
        const drift = REDUCED_MOTION ? 0 : 0.03;
        r.vy += (drift * Math.sign(r.vy || 1) - r.vy) * Math.min(1, dt * 1.6);
        r.vx *= Math.pow(0.05, dt);
        r.x += (Math.max(-28, Math.min(28, r.x)) - r.x) * Math.min(1, dt * 6);
      }
      if (sphere.current) sphere.current.style.transform = `translateZ(var(--dome-r)) rotateX(${r.x.toFixed(2)}deg) rotateY(${r.y.toFixed(2)}deg)`;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Dragging is tracked on the window (not captured on the stage, so taps still reach the tiles).
  const justDragged = useRef(0);
  const tileEls = useRef<(HTMLButtonElement | null)[]>([]);
  // Which tile is under the pointer. The browser's own hit testing loses these tiles once the dome
  // turns (the viewpoint sits inside the sphere), so a tap landed on the stage and nothing opened.
  // Instead: among the tiles facing us, the one whose on-screen box holds the point, nearest its center.
  const tileAt = (x: number, y: number) => {
    const r = rot.current;
    let best = -1, bestD = Infinity;
    tiles.forEach(({ col, row }, k) => {
      const yaw = (((col * 360) / COLS + r.y) * Math.PI) / 180, pitch = (((row - (ROWS - 1) / 2) * 17 + r.x) * Math.PI) / 180;
      if (Math.cos(yaw) * Math.cos(pitch) < 0.3) return; // behind or edge-on
      const el = tileEls.current[k];
      if (!el) return;
      const b = el.getBoundingClientRect();
      if (b.width > innerWidth * 0.7 || x < b.left || x > b.right || y < b.top || y > b.bottom) return;
      const d = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
      if (d < bestD) (bestD = d), (best = k);
    });
    return best;
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    const move = (ev: PointerEvent) => onMove(ev);
    const up = (ev: PointerEvent) => {
      if (drag.current?.moved) justDragged.current = performance.now();
      else if (ev.type === "pointerup") {
        const k = tileAt(ev.clientX, ev.clientY);
        if (k >= 0) setOpen(tiles[k].i);
      }
      drag.current = null;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    const r = rot.current;
    r.vy = dx * 0.14;
    r.vx = -dy * 0.1;
    r.y += r.vy;
    r.x = Math.max(-40, Math.min(40, r.x + r.vx));
    d.x = e.clientX;
    d.y = e.clientY;
  };

  return createPortal(
    <div className={closing ? "dome closing" : "dome"} role="dialog" aria-modal="true" aria-label={t("photos.allTitle")}>
      <div className="dome-head">
        <p className="dome-title">{t("photos.allTitle")}</p>
        <p className="dome-hint">{LITE ? "" : t("photos.domeHint")}</p>
      </div>
      {LITE ? (
        <div className="dome-grid">
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setOpen(i)}>
              <img src={p.src.s} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : (
        <div className="dome-stage" onPointerDown={onDown}>
          <div ref={sphere} className="dome-sphere">
            {tiles.map(({ p, i, col, row }, k) => (
              <button
                key={k}
                ref={(el) => void (tileEls.current[k] = el)}
                className="dome-tile"
                style={{ transform: `rotateY(${(col * 360) / COLS}deg) rotateX(${(row - (ROWS - 1) / 2) * 17}deg) translateZ(calc(var(--dome-r) * -1))` }}
                // Pointer taps are handled by the stage (tileAt); this is for the keyboard (Enter/Space).
                onClick={(e) => {
                  if (e.detail === 0) setOpen(i);
                }}
                aria-label={`${i + 1}`}
              >
                {/* Not lazy: inside a 3D transform the browser never sees the tiles as on screen, so lazy
                    images never loaded and the dome stayed empty. The gallery only opens on request. */}
                <img src={p.src.s} alt="" decoding="async" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="lb-close" onClick={close} aria-label={t("scene.close")}>
        <IconClose />
      </button>
      {open !== null && <Lightbox photos={photos} start={open} onClose={() => setOpen(null)} />}
    </div>,
    document.body,
  );
}
