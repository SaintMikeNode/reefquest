import { MetalFx } from "metal-fx";
import type { ReactNode } from "react";
import { REDUCED_MOTION } from "../lib/device";

// A liquid-metal ring around the hero's main button (metal-fx, the engine behind cult-ui's "metal
// button", which Tulio picked; used directly so the button keeps our own pill style). The white
// pill (the most prominent button) with a silver ring tuned for light surfaces; no glow (its baked
// halo showed as a dark smudge on the blue hero). One shared WebGL2
// context for the page; browsers without WebGL2 just show the plain button. Loaded lazily (the
// plain button shows first), skipped on lite devices, still with reduced motion.
export default function MetalRing({ children }: { children: ReactNode }) {
  return (
    <MetalFx variant="button" preset="silver" theme="light" strength={0.95} disableGlow paused={REDUCED_MOTION} className="metal-ring">
      {children}
    </MetalFx>
  );
}
