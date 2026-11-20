// Quality tiers for the 3D views. The tier picks the starting budgets (mesh detail, instance counts,
// shader detail); on top of it the canvas resolution adapts to the measured frame rate
// (scenes/AdaptiveQuality.tsx), because hardware hints can't tell a fast phone from a slow one.
//   0 "lite":  low-end phones and old PCs
//   1 "phone": other phones and tablets
//   2 "full":  laptops and desktops
// Force one with ?lite, ?phone or ?full in the URL.
const nav = navigator as Navigator & { deviceMemory?: number };
const q = location.search;
const cores = nav.hardwareConcurrency ?? 4;
const mem = nav.deviceMemory; // undefined on iOS and Firefox

export const TOUCH = matchMedia("(pointer: coarse)").matches;

function detect(): 0 | 1 | 2 {
  if (/[?&]lite\b/.test(q)) return 0;
  if (/[?&]phone\b/.test(q)) return 1;
  if (/[?&]full\b/.test(q)) return 2;
  if (cores <= 2 || (mem !== undefined && mem <= 2)) return 0;
  if (!TOUCH) return 2;
  // Android reports memory: 4 GB or less, or few cores, means a budget GPU. iPhones and iPads report
  // no memory figure and have strong GPUs for their screens.
  if ((mem !== undefined && mem <= 4) || cores <= 4) return 0;
  return 1;
}

export const TIER = detect();
export const LITE = TIER === 0;
/** Phones and tablets (tiers 0 and 1): tighter budgets than a desktop. */
export const MOBILE = TIER < 2;
export const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Picks a value by tier: pick(lite, phone, full). */
export const pick = <T,>(lite: T, phone: T, full: T): T => (TIER === 0 ? lite : TIER === 1 ? phone : full);

// Frosted-glass HUD surfaces (backdrop blur) re-blur the 3D canvas behind them every frame: solid on
// phones and weak machines.
if (MOBILE && typeof document !== "undefined") document.documentElement.classList.add("lite");
