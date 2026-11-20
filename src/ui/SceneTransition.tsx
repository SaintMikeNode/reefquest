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
import "transition-style/transition.hackpack.min.css";
import "transition-style/transition.circles.min.css";
import { useEffect } from "react";
import { create } from "zustand";
import { REDUCED_MOTION } from "../lib/device";

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
  inSeconds: number;
  outSeconds: number;
  fx: "sonar" | "bubbles";
}
const LOOKS: Record<TransitionKind, Look> = {
  island: { in: "in:circle:center", out: "out:circle:hesitate", inSeconds: 0.75, outSeconds: 1.35, fx: "sonar" },
  page: { in: "in:custom:swoop", out: "out:custom:swoop", inSeconds: 0.7, outSeconds: 1.05, fx: "sonar" },
  board: { in: "in:custom:wave-up", out: "out:custom:wave-up", inSeconds: 0.75, outSeconds: 1.1, fx: "bubbles" },
  leave: { in: "in:custom:wave-down", out: "out:custom:wave-down", inSeconds: 0.75, outSeconds: 1.1, fx: "sonar" },
  dive: { in: "in:custom:wave-down", out: "out:custom:wave-down", inSeconds: 0.55, outSeconds: 0.95, fx: "bubbles" },
  surface: { in: "in:custom:wave-up", out: "out:custom:wave-up", inSeconds: 0.55, outSeconds: 0.95, fx: "bubbles" },
};
const STAGGER = 0.09; // seconds between the three layers
const LAYERS = 3;

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
    let raf = 0;
    const wait = () => {
      const loading = document.querySelector(".loading-screen");
      if (loading && performance.now() - start < 4000) raf = requestAnimationFrame(wait);
      else raf = requestAnimationFrame(() => useCurtain.setState((s) => (s.shot?.key === shot.key ? { shot: { ...shot, phase: "out" } } : s)));
    };
    raf = requestAnimationFrame(() => requestAnimationFrame(wait));
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
              {look.fx === "sonar" ? (
                <div className="curtain-rings">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                <div className="curtain-bubbles">
                  {BUBBLES.map((b, k) => (
                    <i key={k} style={{ "--x": `${b.x}%`, "--s": `${b.s}px`, "--d": `${b.d}s`, "--delay": `${b.delay}s`, "--w": `${b.w}px` } as React.CSSProperties} />
                  ))}
                </div>
              )}
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
