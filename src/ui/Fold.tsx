import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { MOBILE, REDUCED_MOTION } from "../lib/device";

// A section that folds open and closed under its header (the boat's logbook and sounder), so the
// panel grows and shrinks smoothly instead of jumping (Tulio: "smooth optimized animations").
// Computers: the height eases from 0 to its natural size while the content fades in, and back.
// Phones and tablets never animate layout (it stuttered over the 3D canvas, see CLAUDE.md): the
// content fades and rises in with opacity and transform only, and the panel takes its size at once.
// Reduced motion: it just opens and closes.
const ease = [0.22, 1, 0.36, 1] as const;

export function Fold({ open, gap = 0, children }: { open: boolean; /** the grid gap of the panel it sits in, kept inside the fold so nothing jumps */ gap?: number; children: ReactNode }) {
  const still = REDUCED_MOTION;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="fold"
          className="fold"
          style={{ overflow: MOBILE ? undefined : "hidden", marginTop: gap ? -gap : undefined }}
          initial={still ? false : MOBILE ? { opacity: 0, y: -6 } : { height: 0, opacity: 0 }}
          animate={
            MOBILE
              ? { opacity: 1, y: 0, transition: { duration: 0.24, ease } }
              : { height: "auto", opacity: 1, transition: { height: { duration: 0.34, ease }, opacity: { duration: 0.22, delay: 0.06 } } }
          }
          exit={
            still || MOBILE
              ? { opacity: 0, transition: { duration: 0 } }
              : { height: 0, opacity: 0, transition: { height: { duration: 0.26, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.12 } } }
          }
        >
          <div className="fold-inner" style={gap ? { display: "grid", gap, paddingTop: gap } : undefined}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
