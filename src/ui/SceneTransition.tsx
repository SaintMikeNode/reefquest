// Scene transitions with transition-style (clip-path mask animations, Tulio's pick), in two phases
// like a film cut: a curtain animates closed over the scene being left ("in:" effects), the scene
// switches behind it, and the curtain animates open on the new one ("out:" effects). It waits,
// closed, while a 3D scene is still loading (up to a few seconds), so the opening is always seen.
//
// The curtain is three layers (aqua, ocean blue, deep navy) that run the same effect one after
// another, so every change reads as a burst of color, not a flat slide. Effects: the library's
// circles into an island (an expanding sonar ping, then an iris), and custom shapes built with its
// "hackpack" (keyframes in styles.css): a circle swoop between pages and a wavy water line when
// boarding/leaving the boat and diving/surfacing. On the top layer the destination's name rises in
// out of a blur, sonar rings pulse while a scene loads, and bubbles rise around the boat and dives.
// With reduced motion the scene simply switches.
// The per-pack files of transition-style 0.1.4 leave out the shape variables the keyframes use
// (so their effects did nothing): the hackpack file carries them.
//
// Phones and tablets draw the same shapes another way (FAST below). transition-style animates
// `clip-path`, which the browser repaints on the main thread every frame: three full-screen layers
// of it stutter on a phone, and freeze whenever the page is busy (which is exactly when a scene
// changes). There the layers are real shapes (discs, sheets with a wavy edge) moved only with
// `transform`, which the GPU compositor animates by itself: nothing is repainted and a busy page
// can't stall them. Desktops keep the library's effects.
//
// The curtain opens only when the new scene is ready: no loading screen, the 3D view has drawn its
// first frames (holdCurtain / releaseCurtain) and the page has stopped doing heavy work for a
// moment. Opening earlier made the reveal run while the scene was still being built, so it stuck.
import "transition-style/transition.hackpack.min.css";
import "transition-style/transition.circles.min.css";
import { useEffect } from "react";
import { create } from "zustand";
import { MOBILE, REDUCED_MOTION } from "../lib/device";

/** Compositor-only curtain (see above). */
const FAST = MOBILE;

export type TransitionKind = "island" | "page" | "board" | "leave" | "dive" | "surface";

export interface TransitionSpec {
  kind: TransitionKind;
  label: string;
  sub?: string; // small line above the name
  apply: () => void; // switches the scene while the curtain is closed
}

interface Look {
  in: string;
  out: string;
  /** The same effect as a transformed shape (FAST). */
  shape: "iris" | "swoop" | "wave-up" | "wave-down";
  inSeconds: number;
  outSeconds: number;
  fx: "sonar" | "bubbles";
}
const LOOKS: Record<TransitionKind, Look> = {
  island: { in: "in:circle:center", out: "out:circle:hesitate", shape: "iris", inSeconds: 0.75, outSeconds: 1.35, fx: "sonar" },
  page: { in: "in:custom:swoop", out: "out:custom:swoop", shape: "swoop", inSeconds: 0.7, outSeconds: 1.05, fx: "sonar" },
  board: { in: "in:custom:wave-up", out: "out:custom:wave-up", shape: "wave-up", inSeconds: 0.75, outSeconds: 1.1, fx: "bubbles" },
  leave: { in: "in:custom:wave-down", out: "out:custom:wave-down", shape: "wave-down", inSeconds: 0.75, outSeconds: 1.1, fx: "sonar" },
  dive: { in: "in:custom:wave-down", out: "out:custom:wave-down", shape: "wave-down", inSeconds: 0.55, outSeconds: 0.95, fx: "bubbles" },
  surface: { in: "in:custom:wave-up", out: "out:custom:wave-up", shape: "wave-up", inSeconds: 0.55, outSeconds: 0.95, fx: "bubbles" },
};
const STAGGER = 0.09; // seconds between the three layers
const LAYERS = 3;

// When to open: the page must run smoothly (every frame under CALM_FRAME_MS) for CALM_MS in a row,
// with no loading screen and no 3D view still drawing its first frames. Never longer than MAX_HOLD_MS.
// A page that never gets that smooth (a slow phone drawing the home page's animated sea) must not
// keep the curtain shut: once nothing is loading, it opens after SETTLE_MAX_MS at the latest.
const CALM_FRAME_MS = 50;
const CALM_MS = 120;
const SETTLE_MAX_MS = 900;
const MAX_HOLD_MS = 7000;

// A 3D view holds the curtain closed from the moment it starts mounting until it has drawn
// (scenes/AdaptiveQuality.tsx: SceneReady). One view is on screen at a time, so one flag is enough.
let sceneHeld = false;
export const holdCurtain = () => {
  sceneHeld = true;
};
export const releaseCurtain = () => {
  sceneHeld = false;
};

// Wavy edge of the FAST water sheets: one SVG path (0–100 wide, 0–10 tall, filled below the line).
const WAVE = (() => {
  let d = "M0,10";
  for (let i = 0; i <= 48; i++) {
    const x = i / 48;
    const y = 4.6 + 2.9 * Math.sin(2 * Math.PI * (x * 1.55 + 0.12)) + 1.3 * Math.sin(2 * Math.PI * (x * 3.7 + 0.4));
    d += `L${(x * 100).toFixed(2)},${y.toFixed(2)}`;
  }
  return d + "L100,10Z";
})();

interface Shot extends TransitionSpec {
  key: number;
  phase: "in" | "hold" | "out";
}
const useCurtain = create<{ shot: Shot | null }>(() => ({ shot: null }));
let n = 0;

/** Close the curtain, switch the scene with `apply`, then open it on the new scene. */
export function transition(spec: TransitionSpec) {
  if (REDUCED_MOTION) return spec.apply();
  const cur = useCurtain.getState().shot;
  if (cur && cur.phase === "in") cur.apply(); // a new change before the last one switched: switch now
  useCurtain.setState({ shot: { ...spec, key: ++n, phase: "in" } });
}

// Bubbles: fixed positions, sizes and timings (no randomness between renders).
const BUBBLES = Array.from({ length: 16 }, (_, i) => {
  const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: 4 + r(1) * 92, s: 6 + r(2) * 22, d: 1.6 + r(3) * 1.6, delay: -r(4) * 2, w: (r(5) - 0.5) * 60 };
});

export function Curtain() {
  const shot = useCurtain((s) => s.shot);

  // Closed: switch the scene, then open once it has drawn (and any 3D loading screen is gone).
  useEffect(() => {
    if (!shot || shot.phase !== "hold") return;
    shot.apply();
    const start = performance.now();
    let raf = 0, last = start, calmSince = 0, readySince = 0;
    const wait = (now: number) => {
      const smooth = now - last < CALM_FRAME_MS;
      last = now;
      const busy = sceneHeld || !!document.querySelector(".loading-screen");
      if (busy) readySince = 0;
      else if (!readySince) readySince = now;
      if (busy || !smooth) calmSince = 0;
      else if (!calmSince) calmSince = now;
      if ((calmSince && now - calmSince >= CALM_MS) || (readySince && now - readySince > SETTLE_MAX_MS) || now - start > MAX_HOLD_MS)
        useCurtain.setState((s) => (s.shot?.key === shot.key ? { shot: { ...shot, phase: "out" } } : s));
      else raf = requestAnimationFrame(wait);
    };
    raf = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(raf);
  }, [shot]);

  if (!shot) return null;
  const look = LOOKS[shot.kind];
  const opening = shot.phase === "out";
  const effect = opening ? look.out : look.in;
  const seconds = opening ? look.outSeconds : look.inSeconds;
  // Closing: aqua first, navy last. Opening: navy first, aqua last. The last one ends the phase.
  const last = opening ? 0 : LAYERS - 1;
  const delayOf = (i: number) => (opening ? LAYERS - 1 - i : i) * STAGGER;

  const ended = () =>
    useCurtain.setState((s) => {
      if (s.shot?.key !== shot.key) return s;
      if (shot.phase === "in") return { shot: { ...shot, phase: "hold" } };
      if (shot.phase === "out") return { shot: null };
      return s;
    });

  const fx =
    look.fx === "sonar" ? (
      <div className="curtain-rings">
        <span />
        <span />
        <span />
      </div>
    ) : (
      <div className="curtain-bubbles">
        {(FAST ? BUBBLES.slice(0, 10) : BUBBLES).map((b, k) => (
          <i key={k} style={{ "--x": `${b.x}%`, "--s": `${b.s}px`, "--d": `${b.d}s`, "--delay": `${b.delay}s`, "--w": `${b.w}px` } as React.CSSProperties} />
        ))}
      </div>
    );

  if (FAST) {
    const wave = look.shape === "wave-up" || look.shape === "wave-down";
    const w = window.innerWidth, h = window.innerHeight;
    return (
      <div
        key={shot.key}
        className={`curtain fast k-${look.shape} fx-${look.fx} ${opening ? "opening" : "closing"}${shot.phase === "hold" ? " held" : ""}`}
        aria-hidden="true"
        style={
          {
            "--diag": `${Math.ceil(Math.hypot(w, h))}px`,
            "--vh": `${h}px`,
            "--dur": `${seconds}s`,
            "--ease": opening ? "cubic-bezier(.25,1,.3,1)" : "cubic-bezier(.65,0,.35,1)",
            // The name and the rings or bubbles come in once the navy layer is over the middle.
            "--label-delay": `${STAGGER * 2 + seconds * 0.6}s`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: LAYERS }, (_, i) => (
          <div
            key={i}
            className={`cshape l${i + 1}${wave ? " sheet" : ""}`}
            style={{ animationDelay: `${delayOf(i)}s` }}
            onAnimationEnd={i === last ? (e) => e.target === e.currentTarget && ended() : undefined}
          >
            {wave && (
              <>
                <svg className="cap" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d={WAVE} />
                </svg>
                <div className="body" />
                <svg className="cap b" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d={WAVE} />
                </svg>
              </>
            )}
          </div>
        ))}
        <div className="curtain-content">
          {fx}
          <div className="curtain-title">
            {shot.sub && <small>{shot.sub}</small>}
            <span>{shot.label}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={shot.key} className={`curtain fx-${look.fx}${opening ? " opening" : ""}`} aria-hidden="true">
      {Array.from({ length: LAYERS }, (_, i) => (
        <div
          key={i}
          className={`curtain-layer l${i + 1}`}
          transition-style={effect}
          style={
            {
              "--transition__duration": `${seconds}s`,
              "--transition__delay": `${delayOf(i)}s`,
              "--transition__easing": opening ? "cubic-bezier(.25,1,.3,1)" : "cubic-bezier(.65,0,.35,1)",
            } as React.CSSProperties
          }
          // Only the layer's own clip animation counts (the name, rings and bubbles inside bubble up too).
          onAnimationEnd={i === last ? (e) => e.target === e.currentTarget && ended() : undefined}
        >
          {i === LAYERS - 1 && (
            <>
              {fx}
              <div className="curtain-title" style={{ "--label-delay": `${STAGGER * 2 + seconds * 0.35}s` } as React.CSSProperties}>
                {shot.sub && <small>{shot.sub}</small>}
                <span>{shot.label}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
