import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { pick } from "../lib/device";
import { releaseCurtain } from "../ui/SceneTransition";

// Canvas resolution follows the frame rate actually measured on the device. The tier only sets the
// range: a phone that can't hold ~35 fps steps its resolution down (the HUD stays sharp, it is
// HTML); one with headroom steps up to its ceiling.

const NATIVE = Math.min(window.devicePixelRatio || 1, 3);
export const DPR = {
  min: pick(0.7, 0.85, 1),
  start: Math.min(NATIVE, pick(1, 1.5, 1.75)),
  max: Math.min(NATIVE, pick(1.25, 2, 1.75)),
};

export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ dpr: DPR.start, ema: 16, slow: 0, fast: 0, ceiling: DPR.max, frames: 0 });
  useFrame((_, dt) => {
    const s = st.current;
    const ms = dt * 1000;
    // Idle gaps (demand rendering) and one-off hitches (shader compiles, loading) don't count.
    if (ms > 100 || s.frames++ < 30) return;
    s.ema = s.ema * 0.9 + ms * 0.1;
    if (s.ema > 29) {
      s.fast = 0;
      if (++s.slow > 24 && s.dpr > DPR.min) {
        s.dpr = Math.max(DPR.min, s.dpr * 0.85);
        s.ceiling = s.dpr; // the level above couldn't hold: don't climb back to it
        s.slow = 0;
        s.ema = 20;
        setDpr(s.dpr);
      }
    } else if (s.ema < 18.5) {
      s.slow = 0;
      if (++s.fast > 240 && s.dpr < s.ceiling - 0.01) {
        s.dpr = Math.min(s.ceiling, s.dpr * 1.15);
        s.fast = 0;
        setDpr(s.dpr);
      }
    } else {
      s.slow = Math.max(0, s.slow - 1);
      s.fast = 0;
    }
  });
  return null;
}

/** Continuous rendering capped at `fps` (for 90/120 Hz phones: half the work, cooler device). The
 *  Canvas must use frameloop="demand". */
export function FrameCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fps - 2) return;
      last = now;
      invalidate();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  return null;
}

/** Lets the transition curtain open once this view has really drawn: the first frame compiles the
 *  shaders and uploads the geometry (a long stall on phones), so the curtain is released after the
 *  third. Mount it inside the view it stands for (it draws those frames even with frameloop="demand").
 *  It must not release on unmount: the view it leaves is unmounted after the next one has taken the
 *  hold (IslandScene releases when the whole scene goes away). */
export function SceneReady() {
  const n = useRef(0);
  useFrame((st) => {
    if (n.current > 3) return;
    if (++n.current <= 3) st.invalidate();
    else releaseCurtain();
  });
  return null;
}
