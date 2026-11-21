import type { Transition } from "motion/react";
import { MOBILE } from "../lib/device";

// Shared motion for panels in the 3D views (story cards, readout, guide, galleries), so everything
// moves alike: a spring with no wobble that rises in through a light blur, and a quick fade out.
// Phones and tablets skip the blur: an animated filter repaints the whole panel every frame, over
// a 3D canvas, and that is where panels stuttered. Motion itself honors reduced motion.
const blur = (px: number) => (MOBILE ? {} : { filter: `blur(${px}px)` });

export const spring: Transition = { type: "spring", visualDuration: 0.42, bounce: 0.08 };

export const panelMotion = {
  initial: { opacity: 0, y: 14, scale: 0.98, ...blur(6) },
  animate: { opacity: 1, y: 0, scale: 1, ...blur(0), transition: spring },
  exit: { opacity: 0, y: 10, scale: 0.985, ...blur(4), transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
} as const;

/** For elements centered with a -50% translate (the guide): keep the centering, animate the rest. */
export const centeredMotion = {
  initial: { opacity: 0, scale: 0.96, x: "-50%", y: "-46%", ...blur(6) },
  animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%", ...blur(0), transition: spring },
  exit: { opacity: 0, scale: 0.97, x: "-50%", y: "-48%", ...blur(4), transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
} as const;

export const fadeMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
} as const;
